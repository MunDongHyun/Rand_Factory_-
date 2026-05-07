from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import MentorProfile, User
from app.schemas.mentor import MentorProfileUpdate, MentorResponse

router = APIRouter(prefix="/api/mentors", tags=["mentors"])


def _to_mentor_response(user: User, profile: MentorProfile) -> MentorResponse:
    return MentorResponse(
        user_id=user.user_id,
        name=user.name,
        job_title=user.job_title,
        industry=user.industry,
        years_of_experience=user.years_of_experience,
        profile_image_url=user.profile_image_url,
        mentor_profile_id=profile.mentor_profile_id,
        business_card_image_url=profile.business_card_image_url,
        is_verified=profile.is_verified,
        bio=profile.bio,
        specialties=profile.specialties,
        available=profile.available,
        rating_avg=profile.rating_avg,
        mentoring_count=profile.mentoring_count,
    )


@router.patch("/me", response_model=MentorResponse)
def update_my_profile(
    body: MentorProfileUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role != "mentor":
        raise HTTPException(status_code=403, detail="멘토만 프로필을 수정할 수 있습니다")

    profile = db.query(MentorProfile).filter(MentorProfile.user_id == current_user.user_id).first()
    if not profile:
        raise HTTPException(status_code=404, detail="멘토 프로필을 찾을 수 없습니다")

    if body.bio is not None:
        profile.bio = body.bio
    if body.specialties is not None:
        profile.specialties = body.specialties
    if body.available is not None:
        profile.available = body.available

    db.commit()
    return _to_mentor_response(current_user, profile)


@router.get("", response_model=list[MentorResponse])
def list_mentors(
    industry: str | None = None,
    job_title: str | None = None,
    keyword: str | None = None,
    db: Session = Depends(get_db),
):
    query = (
        db.query(User, MentorProfile)
        .join(MentorProfile, MentorProfile.user_id == User.user_id)
        .filter(
            User.role == "mentor",
            MentorProfile.is_verified.is_(True),
            MentorProfile.available.is_(True),
        )
    )

    if industry:
        query = query.filter(User.industry == industry)

    if job_title:
        query = query.filter(User.job_title == job_title)

    if keyword:
        search = f"%{keyword}%"
        query = query.filter(or_(User.name.ilike(search), MentorProfile.bio.ilike(search)))

    rows = query.order_by(MentorProfile.rating_avg.desc()).all()
    return [_to_mentor_response(user, profile) for user, profile in rows]


@router.get("/{user_id}", response_model=MentorResponse)
def get_mentor(user_id: int, db: Session = Depends(get_db)):
    row = (
        db.query(User, MentorProfile)
        .join(MentorProfile, MentorProfile.user_id == User.user_id)
        .filter(User.user_id == user_id, User.role == "mentor")
        .first()
    )
    if not row:
        raise HTTPException(status_code=404, detail="멘토를 찾을 수 없습니다")

    user, profile = row
    return _to_mentor_response(user, profile)
