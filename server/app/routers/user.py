from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import create_access_token, get_current_user, hash_password, verify_password
from app.models.user import User
from app.schemas.user import (
    BulkSignupRequest,
    BulkSignupResponse,
    TokenResponse,
    UserCreate,
    UserListResponse,
    UserLogin,
    UserResponse,
    UserStatsResponse,
)

router = APIRouter(prefix="/api/users", tags=["users"])


@router.post("/signup", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
def signup(body: UserCreate, db: Session = Depends(get_db)):
    if db.query(User).filter(User.user_email == body.email).first():
        raise HTTPException(status_code=400, detail="Email already in use")

    user = User(
        user_email=body.email,
        user_pw=hash_password(body.password),
        user_name=body.name,
        user_company=body.company or "",
        user_role="j",
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@router.post("/signup/bulk", response_model=BulkSignupResponse, status_code=status.HTTP_201_CREATED)
def signup_bulk(body: BulkSignupRequest, db: Session = Depends(get_db)):
    """회사 + 매니저(첫 직원) + 학습자들을 한 번에 등록."""
    if not body.employees:
        raise HTTPException(status_code=400, detail="At least one employee required")

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
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password")
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
        raise HTTPException(status_code=404, detail="Not found")

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
        raise HTTPException(status_code=404, detail="Not found")

    query = db.query(User)
    total = query.count()
    users = (
        query.order_by(User.user_created_at.desc())
        .offset((page - 1) * limit)
        .limit(limit)
        .all()
    )
    return UserListResponse(users=users, total=total)


@router.get("/{user_id}", response_model=UserResponse)
def get_user(user_id: int, db: Session = Depends(get_db), _current_user: User = Depends(get_current_user)):
    user = db.query(User).filter(User.user_id == user_id, User.user_deleted_at.is_(None)).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user
