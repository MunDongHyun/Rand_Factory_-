from fastapi import APIRouter, Depends, HTTPException, status, Body
from fastapi.responses import StreamingResponse
from sqlalchemy import func
from sqlalchemy.orm import Query, Session
import os, io, json
from fpdf import FPDF
from docx import Document
from docx.shared import Pt, Inches, RGBColor
from docx.oxml.ns import qn

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
    query = query.filter(Curriculum.cur_deleted_at.is_(None))
    if user.user_role == "a":
        return query
    if user.user_role == "m":
        return query.filter(Curriculum.cur_creator_id == user.user_id)
    if user.user_role == "j":
        return query.filter(func.json_contains(Curriculum.cur_assigned_learner_ids, str(user.user_id)))
    return query.filter(False)


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
        val_result = curriculum_service.validate_curriculum_input(
            cur_title=body.cur_title,
            cur_target_job=body.cur_target_job or "",
            cur_target_industry=body.cur_target_industry or "",
            cur_learning_goal=body.cur_learning_goal or "",
            required_content=body.required_content or ""
        )
        if not val_result.is_valid:
            raise HTTPException(status_code=400, detail=val_result.reason)
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"입력값 검증 실패: {exc}")

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
    if current_user.user_role not in {"m", "a"}:
        raise HTTPException(status_code=404, detail="커리큘럼을 찾을 수 없습니다")

    query = db.query(Curriculum).filter(
        Curriculum.cur_id == cur_id,
        Curriculum.cur_deleted_at.is_(None),
    )
    if current_user.user_role == "m":
        query = query.filter(Curriculum.cur_creator_id == current_user.user_id)

    curriculum = query.first()
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
async def download_curriculum_txt(
    curriculum_data: dict = Body(...),
    current_user: User = Depends(get_current_user),
):
    if current_user.user_role not in {"m", "a"}:
        raise HTTPException(status_code=404, detail="찾을 수 없습니다")
    
    cur_title = curriculum_data.get("cur_title", "커리큘럼")
    week_plan = curriculum_data.get("cur_week_plan", [])
    if isinstance(week_plan, str):
        week_plan = json.loads(week_plan)

    lines = []
    lines.append("=" * 60)
    lines.append(f" [S-OJT 실무 밀착 온보딩] {cur_title}")
    lines.append("=" * 60 + "\n")

    for week in week_plan:
        lines.append(f"[{week.get('week')}주차] {week.get('theme')}")
        lines.append(f"[학습 목표] {week.get('learning_objective')}\n")
        
        lines.append("[학습자 수행 과제]")
        for idx, a in enumerate(week.get('assignments', [])):
            lines.append(f"  {idx+1}. {a.get('title')}")
            lines.append("     [수행 방법]")
            for step in a.get('step_by_step_guide', []):
                lines.append(f"       - {step}")
            lines.append(f"     [제출 양식] {a.get('expected_output_format')}\n")
            
        lines.append("[과제 수행을 위한 필수 참고 자료]")
        for r in week.get('recommended_articles', []):
            lines.append(f"  - 제목: {r.get('title')}")
            lines.append(f"    URL: {r.get('url') if r.get('url') else '사내 가이드 참고'}")
            lines.append(f"    읽어야 하는 이유: {r.get('reason_for_reading')}\n")

        lines.append("[교육담당자 코칭 가이드]")
        ig = week.get('instructor_guide', {})
        lines.append("  [체크 포인트]")
        for cp in ig.get('check_points', []):
            lines.append(f"    - {cp}")
        lines.append("  [1:1 미팅 시 권장 질문]")
        for cq in ig.get('coaching_questions', []):
            lines.append(f"    - \"{cq}\"")

        lines.append("\n" + "-" * 60 + "\n")
    
    txt_content = "\n".join(lines)
    
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
async def download_curriculum_pdf(
    curriculum_data: dict = Body(...),
    current_user: User = Depends(get_current_user),
):
    if current_user.user_role not in {"m", "a"}:
        raise HTTPException(status_code=404, detail="찾을 수 없습니다")
    
    cur_title = curriculum_data.get("cur_title", "커리큘럼")
    week_plan = curriculum_data.get("cur_week_plan", [])
    if isinstance(week_plan, str):
        week_plan = json.loads(week_plan)

    pdf = FPDF()
    pdf.add_page()
    
    has_font = os.path.exists(FONT_PATH)
    if has_font:
        pdf.add_font('NanumGothic', '', FONT_PATH, uni=True)
    
    def set_font(style='', size=10):
        if has_font:
            pdf.set_font('NanumGothic', style, size)
        else:
            pdf.set_font('Arial', style, size)
            
    # 에러의 원인인 multi_cell()을 완벽하게 대체하는 커스텀 출력 함수
    def safe_print(text, border=0, fill=False, max_len=48, h=7):
        if not text: return
        text = str(text).replace('\r', '').replace('\t', '  ')
        lines = []
        for line in text.split('\n'):
            if not line.strip():
                lines.append("")
                continue
            
            # 띄어쓰기가 없어도 무조건 max_len 길이만큼 자릅니다.
            while len(line) > max_len:
                lines.append(line[:max_len])
                line = line[max_len:]
            if line:
                lines.append(line)
        
        # 잘라진 줄들을 fpdf에서 에러가 발생하지 않는 일반 cell()로 한 줄씩 그립니다.
        for i, line in enumerate(lines):
            b = 0
            if border:
                if len(lines) == 1: b = 1
                elif i == 0: b = 'LTR'
                elif i == len(lines) - 1: b = 'LBR'
                else: b = 'LR'
            pdf.cell(0, h, txt=line, border=b, ln=True, fill=fill)

    set_font('', 16)
    pdf.cell(0, 10, txt=f"{cur_title} 실무 온보딩 과정", ln=True, align='C')
    pdf.ln(5)

    # 1. 과정 개요 
    set_font('', 12)
    pdf.cell(0, 10, txt="1. 과정 개요", ln=True)
    set_font('', 10)
    
    overview_text = f"과정명: {cur_title}\n대상 직무: {curriculum_data.get('cur_target_job', '미지정')}\n교육 기간: {curriculum_data.get('cur_duration_weeks', 0)}주\n교육 목적: {curriculum_data.get('cur_learning_goal', '미지정')}"
    # multi_cell 대신 safe_print 사용
    safe_print(overview_text, border=1, max_len=45, h=8)
    pdf.ln(5)

    # 2. 주차별 흐름 요약
    set_font('', 12)
    pdf.cell(0, 10, txt="2. 주차별 과제 흐름", ln=True)
    set_font('', 10)
    
    for week in week_plan:
        week_num = week.get('week', '')
        theme = str(week.get('theme', ''))[:45]
        pdf.cell(0, 8, txt=f"[{week_num}주차] {theme}", ln=True)

    pdf.ln(5)
    
    # 3. 주차별 상세 과제 가이드
    set_font('', 12)
    pdf.cell(0, 10, txt="3. 주차별 상세 과제 가이드", ln=True)
    set_font('', 10)
    
    for week in week_plan:
        pdf.set_fill_color(240, 240, 240)
        title_str = str(f"■ {week.get('week')}주차: {week.get('theme')}")[:48]
        pdf.cell(0, 8, txt=title_str, ln=True, fill=True)
        
        safe_print(f"학습 목표: {week.get('learning_objective')}", max_len=48)
        
        assignments = week.get('assignments', [])
        for idx, a in enumerate(assignments):
            pdf.ln(2)
            task_name = str(f"  [과제 {idx+1}] {a.get('title')}")[:48]
            pdf.cell(0, 7, txt=task_name, ln=True)
            
            guide_text = "수행 방법:\n" + "\n".join([f"  - {g}" for g in a.get('step_by_step_guide', [])])
            safe_print(guide_text, max_len=48)
            
            output_fmt = a.get('expected_output_format', '지정되지 않음')
            safe_print(f"제출 형태: {output_fmt}", max_len=48)

        pdf.ln(5)

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


@router.post("/download/docx")
async def download_curriculum_docx(
    curriculum_data: dict = Body(...),
    current_user: User = Depends(get_current_user),
):
    if current_user.user_role not in {"m", "a"}:
        raise HTTPException(status_code=404, detail="찾을 수 없습니다")
    
    cur_title = curriculum_data.get("cur_title", "커리큘럼")
    week_plan = curriculum_data.get("cur_week_plan", [])
    if isinstance(week_plan, str):
        week_plan = json.loads(week_plan)

    doc = Document()
    
    style = doc.styles['Normal']
    style.font.name = 'Malgun Gothic'
    style._element.rPr.rFonts.set(qn('w:eastAsia'), 'Malgun Gothic')

    doc.add_heading(f"{cur_title} 실무 온보딩 과정", 0)

    # 1. 과정 개요
    doc.add_heading("1. 과정 개요", level=1)
    table = doc.add_table(rows=4, cols=2)
    table.style = 'Table Grid'
    
    hdr_cells = table.rows[0].cells
    hdr_cells[0].text = '과정명'
    hdr_cells[1].text = cur_title

    row1_cells = table.rows[1].cells
    row1_cells[0].text = '대상 직무'
    row1_cells[1].text = curriculum_data.get("cur_target_job", "미지정")

    row2_cells = table.rows[2].cells
    row2_cells[0].text = '교육 기간'
    row2_cells[1].text = f"{curriculum_data.get('cur_duration_weeks', 0)}주"

    row3_cells = table.rows[3].cells
    row3_cells[0].text = '교육 목적'
    row3_cells[1].text = curriculum_data.get("cur_learning_goal", "미지정")

    doc.add_paragraph("\n")

    # 2. 주차별 과제 흐름
    doc.add_heading("2. 주차별 과제 흐름", level=1)
    flow_table = doc.add_table(rows=1, cols=2)
    flow_table.style = 'Table Grid'
    flow_hdr = flow_table.rows[0].cells
    flow_hdr[0].text = '주차'
    flow_hdr[1].text = '주제 및 산출물'

    for week in week_plan:
        row = flow_table.add_row().cells
        row[0].text = f"{week.get('week')}주차"
        assignments_titles = [a.get('title') for a in week.get('assignments', [])]
        row[1].text = f"주제: {week.get('theme')}\n산출물: {', '.join(assignments_titles)}"
        
    doc.add_paragraph("\n")

    # 3. 주차별 상세 과제 가이드
    doc.add_heading("3. 주차별 상세 과제 가이드", level=1)
    for week in week_plan:
        doc.add_heading(f"[{week.get('week')}주차] {week.get('theme')}", level=2)
        doc.add_paragraph(f"학습 목표: {week.get('learning_objective')}")
        
        for idx, a in enumerate(week.get('assignments', [])):
            doc.add_heading(f"과제 {idx+1}: {a.get('title')}", level=3)
            
            task_table = doc.add_table(rows=2, cols=2)
            task_table.style = 'Table Grid'
            
            r0 = task_table.rows[0].cells
            r0[0].text = '수행 방법'
            r0[1].text = "\n".join([f"- {g}" for g in a.get('step_by_step_guide', [])])
            
            r1 = task_table.rows[1].cells
            r1[0].text = '제출 형태'
            r1[1].text = str(a.get('expected_output_format', ''))
            
            doc.add_paragraph("\n")

        ig = week.get('instructor_guide', {})
        if ig.get('check_points') or ig.get('coaching_questions'):
            doc.add_heading("교육담당자 피드백 가이드", level=3)
            if ig.get('check_points'):
                doc.add_paragraph("[평가 체크포인트]")
                for cp in ig.get('check_points', []):
                    doc.add_paragraph(f"- {cp}")
            if ig.get('coaching_questions'):
                doc.add_paragraph("[권장 질문]")
                for cq in ig.get('coaching_questions', []):
                    doc.add_paragraph(f"- {cq}")
        
        doc.add_paragraph("\n")

    file_stream = io.BytesIO()
    doc.save(file_stream)
    file_stream.seek(0)

    return StreamingResponse(
        file_stream, 
        media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document", 
        headers={"Content-Disposition": f"attachment; filename=curriculum.docx"}
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