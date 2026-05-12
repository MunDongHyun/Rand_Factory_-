from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import create_access_token, get_current_user, hash_password, verify_password
from app.models.user import User
from app.schemas.user import (
    BulkSignupRequest,
    BulkSignupResponse,
    TokenResponse,
    UserCreate,
    UserLogin,
    UserResponse,
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
        user_job_title=body.job_title,
        user_industry=body.industry,
        user_work_years=body.work_years,
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
            user_job_title=emp.job_title,
            user_industry=emp.industry,
            user_work_years=emp.work_years or 0,
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


@router.get("/{user_id}", response_model=UserResponse)
def get_user(user_id: int, db: Session = Depends(get_db), _current_user: User = Depends(get_current_user)):
    user = db.query(User).filter(User.user_id == user_id, User.user_deleted_at.is_(None)).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user
