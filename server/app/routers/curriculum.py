from fastapi import APIRouter, Depends, HTTPException, status, Body
from fastapi.responses import StreamingResponse
from sqlalchemy import func
from sqlalchemy.orm import Query, Session
import io
import json
from fpdf import FPDF

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.curriculum import Curriculum
from app.models.task_submission import TaskSubmission
from app.models.user import User
from app.schemas.curriculum import (
    CurriculumCreate,
    CurriculumGenerateRequest,
    CurriculumGenerateResponse,
    CurriculumResponse,
    CurriculumStatsResponse,
    CurriculumUpdate,
)
from app.services import curriculum_service

# 원본 코드에 있던 빈 router 선언을 제거하여 Prefix 충돌 에러를 해결했습니다.
router = APIRouter(prefix="/api/curricula", tags=["curricula"])


def _validate_assigned_learners(
    learner_ids: list[int] | None,
    user: User,
    db: Session,
) -> list[int] | None:
    if learner_ids is None:
        return None

    unique_ids = list(dict.fromkeys(learner_ids))
    if not unique_ids:
        return []

    query = db.query(User).filter(
        User.user_id.in_(unique_ids),
        User.user_role == "j",
        User.user_deleted_at.is_(None),
    )
    if user.user_role == "m":
        query = query.filter(User.user_company == user.user_company)

    valid_ids = {learner.user_id for learner in query.all()}
    invalid_ids = [learner_id for learner_id in unique_ids if learner_id not in valid_ids]
    if invalid_ids:
        raise HTTPException(status_code=400, detail="배정할 수 없는 학습자가 포함되어 있습니다.")

    return unique_ids


def _scope_curriculum_query(query: Query, user: User) -> Query:
    """Role 기반으로 curriculum 조회 범위를 제한 (soft delete 제외).

    - a (admin): 전체
    - m (manager): 본인이 만든 것
    - j (learner): 본인이 cur_assigned_learner_ids에 포함된 것
    """
    query = query.filter(Curriculum.cur_deleted_at.is_(None))
    if user.user_role == "a":
        return query
    if user.user_role == "m":
        return query.filter(Curriculum.cur_creator_id == user.user_id)
    return query.filter(func.json_contains(Curriculum.cur_assigned_learner_ids, str(user.user_id)))


@router.post("", response_model=CurriculumResponse, status_code=status.HTTP_201_CREATED)
def create_curriculum(
    body: CurriculumCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.user_role not in {"m", "a"}:
        raise HTTPException(status_code=403, detail="Only manager/admin can create curricula")

    curriculum = Curriculum(
        cur_creator_id=current_user.user_id,
        cur_title=body.cur_title,
        cur_target_job=body.cur_target_job,
        cur_target_industry=body.cur_target_industry,
        cur_duration_weeks=body.cur_duration_weeks,
        cur_learning_goal=body.cur_learning_goal,
        cur_learning_detail_goal=body.cur_learning_detail_goal,
        cur_week_plan=body.cur_week_plan,
        cur_assigned_learner_ids=_validate_assigned_learners(body.cur_assigned_learner_ids, current_user, db),
        cur_status=body.cur_status,
    )
    db.add(curriculum)
    db.commit()
    db.refresh(curriculum)
    return curriculum


@router.post("/generate", response_model=CurriculumGenerateResponse)
def generate_curriculum(
    body: CurriculumGenerateRequest,
    current_user: User = Depends(get_current_user),
):
    if current_user.user_role not in {"m", "a"}:
        raise HTTPException(status_code=403, detail="Only manager/admin can generate curricula")

    try:
        week_plan = curriculum_service.generate_week_plan(
            cur_title=body.cur_title,
            cur_duration_weeks=body.cur_duration_weeks,
            cur_target_job=body.cur_target_job,
            cur_target_industry=body.cur_target_industry,
            cur_learning_goal=body.cur_learning_goal,
            required_content=body.required_content,
        )
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"AI 생성 실패: {exc}")

    return CurriculumGenerateResponse(
        cur_title=body.cur_title,
        cur_duration_weeks=body.cur_duration_weeks,
        cur_target_job=body.cur_target_job,
        cur_target_industry=body.cur_target_industry,
        cur_learning_goal=body.cur_learning_goal,
        cur_week_plan=week_plan,
    )


@router.get("", response_model=list[CurriculumResponse])
def list_curricula(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = _scope_curriculum_query(db.query(Curriculum), current_user)
    return query.order_by(Curriculum.cur_created_at.desc()).all()


@router.get("/stats", response_model=CurriculumStatsResponse)
def get_curriculum_stats(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """관리자(a) 전용: 커리큘럼/학습자/과제 제출 통계."""
    if current_user.user_role != "a":
        raise HTTPException(status_code=404, detail="Not found")

    total_curricula = (
        db.query(func.count(Curriculum.cur_id))
        .filter(Curriculum.cur_deleted_at.is_(None))
        .scalar()
        or 0
    )

    assigned_rows = (
        db.query(Curriculum.cur_assigned_learner_ids)
        .filter(
            Curriculum.cur_deleted_at.is_(None),
            Curriculum.cur_status == "active",
        )
        .all()
    )
    learner_set: set[int] = set()
    for (ids,) in assigned_rows:
        if isinstance(ids, list):
            for lid in ids:
                if isinstance(lid, int):
                    learner_set.add(lid)
    active_learners = len(learner_set)

    total_submissions = (
        db.query(func.count(TaskSubmission.task_submission_id)).scalar() or 0
    )

    return CurriculumStatsResponse(
        total_curricula=total_curricula,
        active_learners=active_learners,
        total_submissions=total_submissions,
    )


@router.get("/{cur_id}", response_model=CurriculumResponse)
def get_curriculum(
    cur_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = _scope_curriculum_query(db.query(Curriculum), current_user)
    curriculum = query.filter(Curriculum.cur_id == cur_id).first()
    if not curriculum:
        raise HTTPException(status_code=404, detail="Curriculum not found")
    return curriculum


@router.patch("/{cur_id}", response_model=CurriculumResponse)
def update_curriculum(
    cur_id: int,
    body: CurriculumUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    curriculum = (
        db.query(Curriculum)
        .filter(
            Curriculum.cur_id == cur_id,
            Curriculum.cur_creator_id == current_user.user_id,
            Curriculum.cur_deleted_at.is_(None),
        )
        .first()
    )
    if not curriculum:
        raise HTTPException(status_code=404, detail="Curriculum not found")

    update_data = body.model_dump(exclude_unset=True)
    if "cur_assigned_learner_ids" in update_data:
        update_data["cur_assigned_learner_ids"] = _validate_assigned_learners(
            update_data["cur_assigned_learner_ids"],
            current_user,
            db,
        )

    for field, value in update_data.items():
        setattr(curriculum, field, value)

    db.commit()
    db.refresh(curriculum)
    return curriculum


@router.post("/download/txt")
async def download_curriculum_txt(curriculum_data: list = Body(...)):
    """
    클라이언트(또는 DB)에서 커리큘럼 JSON 데이터를 받아 TXT 파일로 변환하여 다운로드
    """
    # 프론트엔드에서 문자열 형태로 데이터가 넘어올 경우를 대비한 안전 장치
    if isinstance(curriculum_data, str):
        curriculum_data = json.loads(curriculum_data)

    lines = []
    for week in curriculum_data:
        lines.append(f"[{week.get('week')}주차] {week.get('theme')}")
        lines.append(f"목표: {week.get('learning_objective')}")
        lines.append("-" * 30)
        
        lines.append("■ 주요 학습 과제:")
        for t in week.get('tasks', []):
            lines.append(f" - {t}")
            
        lines.append("\n■ 제출 과제:")
        for a in week.get('assignments', []):
            lines.append(f" [과제명: {a.get('title')}]\n   설명: {a.get('description')}\n   제출: {a.get('submission')}")
        
        lines.append("\n" + "=" * 50 + "\n")
    
    txt_content = "\n".join(lines)
    
    # 메모리상에서 파일을 만들어 바로 전송
    file_stream = io.StringIO(txt_content)
    
    return StreamingResponse(
        iter([file_stream.getvalue()]), 
        media_type="text/plain", 
        headers={"Content-Disposition": "attachment; filename=curriculum.txt"}
    )


@router.post("/download/pdf")
async def download_curriculum_pdf(curriculum_data: list = Body(...)):
    """
    클라이언트(또는 DB)에서 커리큘럼 JSON 데이터를 받아 PDF 파일로 변환하여 다운로드
    """
    if isinstance(curriculum_data, str):
        curriculum_data = json.loads(curriculum_data)

    pdf = FPDF()
    pdf.add_page()
    
    # 한글 폰트가 셋팅되어 있어야 깨지지 않습니다. (폰트 파일 필요)
    # pdf.add_font('Nanum', '', 'fonts/NanumGothic.ttf', uni=True)
    # pdf.set_font('Nanum', size=12)
    
    pdf.set_font("Arial", size=16) # 임시 영문 폰트
    pdf.cell(200, 10, txt="Onboarding Curriculum Guide", ln=True, align='C')
    
    for week in curriculum_data:
        pdf.set_font("Arial", size=14)
        pdf.cell(200, 10, txt=f"Week {week.get('week')}: {week.get('theme')}", ln=True)
        pdf.set_font("Arial", size=10)
        pdf.multi_cell(0, 5, txt=f"Objective: {week.get('learning_objective')}")
        pdf.ln(5)
    
    # PDF를 메모리 바이트로 변환하여 바로 전송
    pdf_bytes = bytes(pdf.output())
    file_stream = io.BytesIO(pdf_bytes)
    
    return StreamingResponse(
        file_stream, 
        media_type="application/pdf", 
        headers={"Content-Disposition": "attachment; filename=curriculum.pdf"}
    )