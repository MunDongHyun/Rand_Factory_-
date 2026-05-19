from datetime import date, datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import create_access_token, get_current_user, hash_password, verify_password
from app.models.user import User
from app.schemas.article import TimelinePoint, TimelineResponse
from app.schemas.user import (
    BulkSignupRequest,
    BulkSignupResponse,
    TokenResponse,
    UserActivitySummary,
    UserCreate,
    UserListResponse,
    UserLogin,
    UserResponse,
    UserStatsResponse,
    UserUpdate,
)
from app.services import invite_code_service

router = APIRouter(prefix="/api/users", tags=["users"])


@router.post("/signup", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
def signup(body: UserCreate, db: Session = Depends(get_db)):
    """단일 가입.

    - ``invite_code`` 있으면 → 학습자(``j``), 회사는 매니저 회사 상속
    - ``invite_code`` 없으면 → 일반 회원(``c``), 사용자가 입력한 회사명 그대로
    """
    email = body.email.strip().lower()
    if db.query(User).filter(User.user_email == email).first():
        raise HTTPException(status_code=400, detail="이미 사용 중인 이메일입니다")

    if body.invite_code and body.invite_code.strip():
        manager = invite_code_service.find_manager_by_code(db, body.invite_code)
        if manager is None:
            raise HTTPException(status_code=400, detail="초대 코드가 올바르지 않습니다")
        user_role = "j"
        user_company = manager.user_company or ""
    else:
        user_role = "c"
        user_company = (body.company or "").strip()

    user = User(
        user_email=email,
        user_pw=hash_password(body.password),
        user_name=body.name.strip(),
        user_company=user_company,
        user_role=user_role,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@router.post("/signup/bulk", response_model=BulkSignupResponse, status_code=status.HTTP_201_CREATED)
def signup_bulk(body: BulkSignupRequest, db: Session = Depends(get_db)):
    """회사 + 매니저(첫 직원) + 학습자들을 한 번에 등록."""
    if not body.employees:
        raise HTTPException(status_code=400, detail="직원이 최소 한 명 이상 필요합니다")

    emails = [e.email.lower() for e in body.employees]
    if len(set(emails)) != len(emails):
        raise HTTPException(status_code=400, detail="요청 안에 중복된 이메일이 있습니다.")

    existing = db.query(User.user_email).filter(User.user_email.in_(emails)).first()
    if existing:
        raise HTTPException(status_code=400, detail=f"이미 사용 중인 이메일입니다: {existing[0]}")

    users: list[User] = []
    for i, emp in enumerate(body.employees):
        user = User(
            user_email=emp.email,
            user_pw=hash_password(emp.password),
            user_name=emp.name,
            user_company=body.company,
            user_role="m" if i == 0 else "j",
        )
        db.add(user)
        users.append(user)

    try:
        db.commit()
    except Exception:
        db.rollback()
        raise HTTPException(status_code=400, detail="가입 처리에 실패했습니다. 이메일 중복 또는 입력값을 확인해주세요.")

    for u in users:
        db.refresh(u)
    return BulkSignupResponse(users=users)


@router.post("/login", response_model=TokenResponse)
def login(body: UserLogin, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.user_email == body.email, User.user_deleted_at.is_(None)).first()
    if not user or not verify_password(body.password, user.user_pw):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="이메일 또는 비밀번호가 올바르지 않습니다")
    return TokenResponse(access_token=create_access_token(user.user_id))


@router.get("/me", response_model=UserResponse)
def get_me(current_user: User = Depends(get_current_user)):
    return current_user


@router.get("/stats", response_model=UserStatsResponse)
def get_user_stats(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """관리자(a) 전용: 회원 통계 (총수, 이번 달 가입자, 최다 회사)."""
    if current_user.user_role != "a":
        raise HTTPException(status_code=404, detail="찾을 수 없습니다")

    active = db.query(User).filter(User.user_deleted_at.is_(None))
    total_users = active.count()

    now = datetime.now(timezone.utc)
    month_start = datetime(now.year, now.month, 1, tzinfo=timezone.utc)
    monthly_signups = active.filter(User.user_created_at >= month_start).count()

    top_row = (
        db.query(User.user_company, func.count(User.user_id).label("cnt"))
        .filter(User.user_deleted_at.is_(None), User.user_company != "")
        .group_by(User.user_company)
        .order_by(func.count(User.user_id).desc())
        .first()
    )
    top_company = top_row[0] if top_row else None

    return UserStatsResponse(
        total_users=total_users,
        monthly_signups=monthly_signups,
        top_company=top_company,
    )


@router.get("", response_model=UserListResponse)
def list_users(
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """관리자(a) 전용: 전체 회원 목록 (페이지네이션)."""
    if current_user.user_role != "a":
        raise HTTPException(status_code=404, detail="찾을 수 없습니다")

    query = db.query(User)
    total = query.count()
    users = (
        query.order_by(User.user_created_at.desc())
        .offset((page - 1) * limit)
        .limit(limit)
        .all()
    )
    return UserListResponse(users=users, total=total)


@router.get("/stats/signups-timeline", response_model=TimelineResponse)
def get_signups_timeline(
    days: int = Query(30, ge=1, le=180),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """관리자(a) 전용: 최근 N일 일별 신규 가입자 수."""
    if current_user.user_role != "a":
        raise HTTPException(status_code=404, detail="찾을 수 없습니다")

    today = date.today()
    start_date = today - timedelta(days=days - 1)

    rows = (
        db.query(
            func.date(User.user_created_at).label("d"),
            func.count(User.user_id).label("cnt"),
        )
        .filter(
            User.user_deleted_at.is_(None),
            User.user_created_at >= start_date,
        )
        .group_by(func.date(User.user_created_at))
        .all()
    )
    date_counts = {row.d: int(row.cnt) for row in rows}

    items = []
    for i in range(days):
        d = start_date + timedelta(days=i)
        items.append(TimelinePoint(date=d, count=date_counts.get(d, 0)))
    return TimelineResponse(items=items)


@router.get("/learners", response_model=list[UserResponse])
def list_learners(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """매니저/관리자 전용: 학습자(j) 목록.

    - m (manager): 본인과 같은 회사의 활성 학습자
    - a (admin): 전체 활성 학습자
    """
    if current_user.user_role not in {"m", "a"}:
        raise HTTPException(status_code=404, detail="찾을 수 없습니다")

    query = db.query(User).filter(
        User.user_role == "j",
        User.user_deleted_at.is_(None),
    )
    if current_user.user_role == "m":
        query = query.filter(User.user_company == current_user.user_company)

    return query.order_by(User.user_name.asc()).all()


@router.get("/{user_id}/activity-summary", response_model=UserActivitySummary)
def get_user_activity_summary(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """관리자(a) 전용: 회원 1명의 활동 요약 (커리큘럼/과제/피드백 수)."""
    if current_user.user_role != "a":
        raise HTTPException(status_code=404, detail="찾을 수 없습니다")

    user = db.query(User).filter(User.user_id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="사용자를 찾을 수 없습니다")

    # 지연 import (순환 방지)
    from app.models.curriculum import Curriculum
    from app.models.task_submission import TaskSubmission

    curricula_created = (
        db.query(func.count(Curriculum.cur_id))
        .filter(
            Curriculum.cur_creator_id == user_id,
            Curriculum.cur_deleted_at.is_(None),
        )
        .scalar() or 0
    )

    curricula_assigned = 0
    if user.user_role == "j":
        # JSON 컬럼이라 Python 측에서 카운트
        rows = (
            db.query(Curriculum.cur_assigned_learner_ids)
            .filter(Curriculum.cur_deleted_at.is_(None))
            .all()
        )
        for (ids,) in rows:
            if isinstance(ids, list) and user_id in ids:
                curricula_assigned += 1

    submissions_count = (
        db.query(func.count(TaskSubmission.task_submission_id))
        .filter(TaskSubmission.task_learner_id == user_id)
        .scalar() or 0
    )

    feedbacks_received = (
        db.query(func.count(TaskSubmission.task_submission_id))
        .filter(
            TaskSubmission.task_learner_id == user_id,
            TaskSubmission.task_manager_feedback.isnot(None),
        )
        .scalar() or 0
    )

    # 매니저가 작성한 피드백 = 본인이 만든 커리큘럼의 피드백 작성 건
    feedbacks_given = 0
    if user.user_role in ("m", "a"):
        feedbacks_given = (
            db.query(func.count(TaskSubmission.task_submission_id))
            .join(Curriculum, TaskSubmission.task_curriculum_id == Curriculum.cur_id)
            .filter(
                Curriculum.cur_creator_id == user_id,
                TaskSubmission.task_manager_feedback.isnot(None),
            )
            .scalar() or 0
        )

    return UserActivitySummary(
        user_id=user_id,
        user_role=user.user_role,
        curricula_created=int(curricula_created),
        curricula_assigned=int(curricula_assigned),
        submissions_count=int(submissions_count),
        feedbacks_received=int(feedbacks_received),
        feedbacks_given=int(feedbacks_given),
    )


@router.get("/{user_id}", response_model=UserResponse)
def get_user(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """매니저/관리자 전용: 회원 1명 조회. 본인은 ``/me`` 사용."""
    if current_user.user_role not in {"m", "a"}:
        raise HTTPException(status_code=404, detail="찾을 수 없습니다")

    user = db.query(User).filter(User.user_id == user_id, User.user_deleted_at.is_(None)).first()
    if not user:
        raise HTTPException(status_code=404, detail="사용자를 찾을 수 없습니다")
    return user


@router.patch("/{user_id}", response_model=UserResponse)
def update_user(
    user_id: int,
    body: UserUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """관리자(a) 전용: 회원 역할 변경 및 강제 탈퇴/복구.

    안전장치:
    - 본인 강등/탈퇴 금지
    - 마지막 admin 강등/탈퇴 금지
    """
    if current_user.user_role != "a":
        raise HTTPException(status_code=404, detail="찾을 수 없습니다")

    user = db.query(User).filter(User.user_id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="사용자를 찾을 수 없습니다")

    if user.user_id == current_user.user_id:
        raise HTTPException(status_code=400, detail="본인의 역할/탈퇴 상태는 변경할 수 없습니다")

    will_lose_admin = False
    if body.user_role is not None and user.user_role == "a" and body.user_role != "a":
        will_lose_admin = True
    if body.is_deleted is True and user.user_role == "a":
        will_lose_admin = True

    if will_lose_admin:
        admin_count = (
            db.query(func.count(User.user_id))
            .filter(User.user_role == "a", User.user_deleted_at.is_(None))
            .scalar() or 0
        )
        if admin_count <= 1:
            raise HTTPException(
                status_code=400,
                detail="마지막 관리자는 강등하거나 탈퇴시킬 수 없습니다",
            )

    if body.user_role is not None:
        user.user_role = body.user_role

    if body.is_deleted is True:
        if user.user_deleted_at is None:
            user.user_deleted_at = datetime.now(timezone.utc)
    elif body.is_deleted is False:
        user.user_deleted_at = None

    db.commit()
    db.refresh(user)
    return user
