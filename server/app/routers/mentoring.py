from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.mentoring import MentoringMatch, MentoringReview
from app.models.user import MentorProfile, User
from app.schemas.mentoring import (
    MatchCreate,
    MatchResponse,
    MatchStatusUpdate,
    ReviewCreate,
    ReviewResponse,
)
from app.services.point_service import add_points, deduct_points, get_balance

router = APIRouter(prefix="/api/mentoring", tags=["mentoring"])

POINT_COST = 100


def _get_match_or_404(db: Session, match_id: int) -> MentoringMatch:
    match = db.query(MentoringMatch).filter(MentoringMatch.match_id == match_id).first()
    if not match:
        raise HTTPException(status_code=404, detail="매칭을 찾을 수 없습니다")
    return match


def _assert_participant(match: MentoringMatch, user_id: int) -> None:
    if match.mentee_id != user_id and match.mentor_id != user_id:
        raise HTTPException(status_code=403, detail="접근 권한이 없습니다")


# ── 1. 매칭 요청 ─────────────────────────────────────────────────────
@router.post("/request", response_model=MatchResponse, status_code=status.HTTP_201_CREATED)
def request_match(
    body: MatchCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role != "mentee":
        raise HTTPException(status_code=403, detail="멘티만 매칭을 요청할 수 있습니다")

    mentor = db.query(User).filter(User.user_id == body.mentor_id, User.role == "mentor").first()
    if not mentor:
        raise HTTPException(status_code=404, detail="멘토를 찾을 수 없습니다")

    mentor_profile = db.query(MentorProfile).filter(MentorProfile.user_id == body.mentor_id).first()
    if not mentor_profile or not mentor_profile.available:
        raise HTTPException(status_code=400, detail="현재 매칭이 불가능한 멘토입니다")

    balance = get_balance(db, current_user.user_id)
    if balance < POINT_COST:
        raise HTTPException(
            status_code=400,
            detail=f"포인트가 부족합니다 (잔액: {balance}P, 필요: {POINT_COST}P)",
        )

    match = MentoringMatch(
        mentee_id=current_user.user_id,
        mentor_id=body.mentor_id,
        title=body.title,
        description=body.description,
        status="pending",
        point_cost=POINT_COST,
    )
    db.add(match)
    db.commit()
    db.refresh(match)
    return match


# ── 2. 수락 / 거절 / 취소 ────────────────────────────────────────────
@router.patch("/{match_id}/status", response_model=MatchResponse)
def update_match_status(
    match_id: int,
    body: MatchStatusUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    match = _get_match_or_404(db, match_id)

    if match.mentor_id != current_user.user_id:
        raise HTTPException(status_code=403, detail="해당 매칭의 멘토만 상태를 변경할 수 있습니다")

    if match.status != "pending":
        raise HTTPException(status_code=400, detail=f"pending 상태인 매칭만 변경 가능합니다 (현재: {match.status})")

    if body.status == "accepted":
        deduct_points(
            db,
            user_id=match.mentee_id,
            amount=match.point_cost,
            description=f"멘토링 수락 - {match.title}",
            reference_id=match.match_id,
        )
        add_points(
            db,
            user_id=match.mentor_id,
            amount=match.point_cost,
            transaction_type="earn",
            description=f"멘토링 수락 - {match.title}",
            reference_id=match.match_id,
        )

    match.status = body.status
    db.commit()
    db.refresh(match)
    return match


# ── 3. 완료 처리 ─────────────────────────────────────────────────────
@router.patch("/{match_id}/complete", response_model=MatchResponse)
def complete_match(
    match_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    match = _get_match_or_404(db, match_id)
    _assert_participant(match, current_user.user_id)

    if match.status != "accepted":
        raise HTTPException(status_code=400, detail="수락된 매칭만 완료 처리할 수 있습니다")

    match.status = "completed"
    match.completed_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(match)
    return match


# ── 4. 리뷰 작성 ─────────────────────────────────────────────────────
@router.post("/{match_id}/review", response_model=ReviewResponse, status_code=status.HTTP_201_CREATED)
def create_review(
    match_id: int,
    body: ReviewCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    match = _get_match_or_404(db, match_id)

    if match.mentee_id != current_user.user_id:
        raise HTTPException(status_code=403, detail="멘티만 리뷰를 작성할 수 있습니다")

    if match.status != "completed":
        raise HTTPException(status_code=400, detail="완료된 멘토링에만 리뷰를 작성할 수 있습니다")

    if db.query(MentoringReview).filter(MentoringReview.match_id == match_id).first():
        raise HTTPException(status_code=400, detail="이미 리뷰가 존재합니다")

    review = MentoringReview(
        match_id=match_id,
        reviewer_id=current_user.user_id,
        rating=body.rating,
        comment=body.comment,
    )
    db.add(review)
    db.flush()

    # mentor_profiles 평점/횟수 업데이트
    mentor_profile = db.query(MentorProfile).filter(MentorProfile.user_id == match.mentor_id).first()
    if mentor_profile:
        avg = db.query(func.avg(MentoringReview.rating)).join(
            MentoringMatch, MentoringReview.match_id == MentoringMatch.match_id
        ).filter(MentoringMatch.mentor_id == match.mentor_id).scalar()

        mentor_profile.rating_avg = round(float(avg or 0), 1)
        mentor_profile.mentoring_count += 1

    db.commit()
    db.refresh(review)
    return review


# ── 5. 내 멘토링 목록 ────────────────────────────────────────────────
@router.get("/my", response_model=list[MatchResponse])
def get_my_matches(
    status_filter: Optional[str] = Query(None, alias="status"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role == "mentor":
        query = db.query(MentoringMatch).filter(MentoringMatch.mentor_id == current_user.user_id)
    else:
        query = db.query(MentoringMatch).filter(MentoringMatch.mentee_id == current_user.user_id)

    if status_filter:
        query = query.filter(MentoringMatch.status == status_filter)

    return query.order_by(MentoringMatch.created_at.desc()).all()


# ── 6. 매칭 상세 조회 ────────────────────────────────────────────────
@router.get("/{match_id}", response_model=MatchResponse)
def get_match(
    match_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    match = _get_match_or_404(db, match_id)
    _assert_participant(match, current_user.user_id)
    return match
