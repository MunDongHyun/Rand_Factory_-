from fastapi import APIRouter, Depends, HTTPException, status, Body
from fastapi.responses import StreamingResponse
from sqlalchemy import func
from sqlalchemy.orm import Query, Session
from fastapi.responses import StreamingResponse
import os,io,json
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
    TemplateGenerateRequest,
    TemplateGenerateResponse,
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
        raise HTTPException(status_code=403, detail="커리큘럼은 매니저/관리자만 생성할 수 있습니다")

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
        raise HTTPException(status_code=403, detail="커리큘럼 자동 생성은 매니저/관리자만 사용할 수 있습니다")

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
        raise HTTPException(status_code=404, detail="찾을 수 없습니다")

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
        raise HTTPException(status_code=404, detail="커리큘럼을 찾을 수 없습니다")
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
        raise HTTPException(status_code=404, detail="커리큘럼을 찾을 수 없습니다")

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
    if isinstance(curriculum_data, str):
        curriculum_data = json.loads(curriculum_data)

    lines = []
    lines.append("=" * 60)
    lines.append(" 🏢 S-OJT 실무 밀착 온보딩 커리큘럼 가이드")
    lines.append("=" * 60 + "\n")

    for week in curriculum_data:
        lines.append(f"🟩 [{week.get('week')}주차] {week.get('theme')}")
        lines.append(f"🎯 학습 목표: {week.get('learning_objective')}\n")
        
        # --- 학습자 파트 ---
        lines.append("▶️ [학습자 수행 과제]")
        for idx, a in enumerate(week.get('assignments', [])):
            lines.append(f"  {idx+1}. {a.get('title')}")
            lines.append("     [수행 방법]")
            for step in a.get('step_by_step_guide', []):
                lines.append(f"       - {step}")
            lines.append(f"     [제출 양식] {a.get('expected_output_format')}\n")
            
        # --- 참고 자료 파트 ---
        lines.append("📚 [과제 수행을 위한 필수 참고 자료]")
        for r in week.get('recommended_articles', []):
            lines.append(f"  - 제목: {r.get('title')}")
            lines.append(f"    URL: {r.get('url') if r.get('url') else '사내 가이드 참고'}")
            lines.append(f"    읽어야 하는 이유: {r.get('reason_for_reading')}\n")

        # --- 교육담당자 파트 ---
        lines.append("🛠️ [교육담당자(사수) 코칭 가이드]")
        ig = week.get('instructor_guide', {})
        lines.append("  [체크 포인트]")
        for cp in ig.get('check_points', []):
            lines.append(f"    ☑ {cp}")
        lines.append("  [1:1 미팅 시 권장 질문]")
        for cq in ig.get('coaching_questions', []):
            lines.append(f"    🗣️ \"{cq}\"")

        lines.append("\n" + "-" * 60 + "\n")
    
    txt_content = "\n".join(lines)
    
    # 메모리상에서 파일을 만들어 바로 전송
    file_stream = io.StringIO(txt_content)
    
    return StreamingResponse(
        iter([file_stream.getvalue()]), 
        media_type="text/plain", 
        headers={"Content-Disposition": "attachment; filename=curriculum.txt"}
    )



current_file = os.path.abspath(__file__)
router_dir = os.path.dirname(current_file)
app_dir = os.path.dirname(router_dir)
server_dir = os.path.dirname(app_dir)
FONT_PATH = os.path.join(server_dir, "resources", "fonts", "NanumGothic.ttf")

@router.post("/download/pdf")
async def download_curriculum_pdf(curriculum_data: list = Body(...)):
    if isinstance(curriculum_data, str):
        curriculum_data = json.loads(curriculum_data)

    pdf = FPDF()
    pdf.add_page()

    if os.path.exists(FONT_PATH):
        pdf.add_font('NanumGothic', '', FONT_PATH, uni=True)
        pdf.set_font('NanumGothic', size=16)
    else:
        print(f"폰트 파일을 찾을 수 없습니다: {FONT_PATH}")
        pdf.set_font('Arial', size=16)

    pdf.cell(200, 10, txt="Onboarding Curriculum Guide", ln=True, align='C')
    pdf.ln(10)

    if os.path.exists(FONT_PATH):
        pdf.set_font('NanumGothic', size=12)
    else:
        pdf.set_font('Arial', size=12)

    for week in curriculum_data:
        week_num = week.get('week', '1')
        theme_text = week.get('theme', '내용 없음')
        
        pdf.cell(200, 10, txt=f"Week {week_num}: {theme_text}", ln=True)

    pdf_output = pdf.output(dest="S")
    if isinstance(pdf_output, str):
        pdf_output = pdf_output.encode("latin-1")
    file_stream = io.BytesIO(pdf_output)
    file_stream.seek(0)

    return StreamingResponse(
        file_stream, 
        media_type="application/pdf", 
        headers={"Content-Disposition": f"attachment; filename=curriculum.pdf"}
    )
    
    
@router.post("/generate-template", response_model=TemplateGenerateResponse)
def generate_template_api(
    body: TemplateGenerateRequest,
    current_user: User = Depends(get_current_user),
):
    if current_user.user_role not in {"m", "a"}:
        raise HTTPException(status_code=403, detail="Only manager/admin can generate templates")

    try:
        html_content = curriculum_service.generate_assignment_template(
            theme=body.theme or "",
            learning_objective=body.learning_objective or "",
            assignment_title=body.assignment_title,
            step_by_step_guide=body.step_by_step_guide,
            expected_output_format=body.expected_output_format or "지정되지 않음",
        )
        return TemplateGenerateResponse(template_content=html_content)
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"템플릿 AI 생성 실패: {exc}")
