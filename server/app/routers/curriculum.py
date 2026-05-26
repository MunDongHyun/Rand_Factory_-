from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, Depends, HTTPException, Query as QueryParam, Request, status, Body
from fastapi.responses import StreamingResponse
from sqlalchemy import func, text
from sqlalchemy.orm import Query, Session
import os, io, json
from fpdf import FPDF
from docx import Document
from docx.shared import Pt, Inches, RGBColor
from docx.oxml.ns import qn

from app.core.database import get_db
from app.core.db_helpers import fetch_in_order
from app.core.limiter import limiter
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
        # JSON_CONTAINS 두 번째 인자는 JSON 문서여야 하므로 json.dumps 로 명시
        return query.filter(
            func.json_contains(
                Curriculum.cur_assigned_learner_ids,
                json.dumps(user.user_id),
            )
        )
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
@limiter.limit("10/hour")
def generate_curriculum(
    request: Request,
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
    limit: int = QueryParam(100, ge=1, le=500),
    offset: int = QueryParam(0, ge=0),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # sort buffer 폭발 방지 + 페이지네이션
    id_query = (
        _scope_curriculum_query(db.query(Curriculum.cur_id), current_user)
        .order_by(Curriculum.cur_created_at.desc())
        .offset(offset)
        .limit(limit)
    )
    return fetch_in_order(db, id_query, Curriculum, Curriculum.cur_id)


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

    # MySQL 8 JSON_TABLE 로 활성 커리큘럼의 배정 학습자 합집합 cardinality 를 DB 측에서 계산.
    # NULL 컬럼은 IFNULL 로 빈 배열 처리해 안전.
    active_learners = int(
        db.execute(
            text(
                """
                SELECT COUNT(DISTINCT jt.learner_id)
                FROM curriculum c
                CROSS JOIN JSON_TABLE(
                    IFNULL(c.cur_assigned_learner_ids, JSON_ARRAY()),
                    '$[*]' COLUMNS(learner_id BIGINT PATH '$')
                ) jt
                WHERE c.cur_deleted_at IS NULL AND c.cur_status = 'active'
                """
            )
        ).scalar()
        or 0
    )

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
    lines.append(" LandFactory 과제 템플릿 패키지")
    lines.append(f" {cur_title} 실무 온보딩 과정")
    lines.append("=" * 60 + "\n")

    # 1. 과정 개요
    lines.append("1. 과정 개요")
    lines.append("-" * 60)
    lines.append(f"과정명: {cur_title}")
    lines.append(f"대상 직무: {curriculum_data.get('cur_target_job', '미지정')}")
    lines.append(f"교육 기간: {curriculum_data.get('cur_duration_weeks', 0)}주")
    lines.append(f"교육 목적: {curriculum_data.get('cur_learning_goal', '미지정')}")
    lines.append("-" * 60 + "\n")

    # 2. 전체 과제 흐름
    lines.append("2. 전체 과제 흐름")
    lines.append("-" * 60)
    for week in week_plan:
        tasks = ", ".join([a.get("title", "") for a in week.get("assignments", [])])
        lines.append(f"[{week.get('week')}주차] 주제: {week.get('theme')}")
        lines.append(f"        핵심 산출물: {tasks}")
    lines.append("-" * 60 + "\n")

    # 3. 주차별 과제 템플릿
    lines.append("3. 주차별 과제 템플릿")
    for week in week_plan:
        lines.append("=" * 60)
        lines.append(f" [ {week.get('week')}주차 과제 템플릿 ]")
        lines.append(f" 주제: {week.get('theme')}")
        lines.append(f" 학습 목표: {week.get('learning_objective')}")
        lines.append("=" * 60)
        
        for idx, a in enumerate(week.get("assignments", [])):
            lines.append(f"\n▶ 과제명: {a.get('title')}")
            lines.append(f"  제출 형태: {a.get('expected_output_format')}")
            lines.append(f"  수행 방법:")
            for step in a.get("step_by_step_guide", []):
                lines.append(f"    - {step}")
                
        # 자기 점검 & 사수 피드백
        ig = week.get("instructor_guide", {})
        if ig and ig.get("check_points"):
            lines.append("\n[ 자기 점검 체크리스트 ]")
            for cp in ig.get("check_points", []):
                lines.append(f"  ☐ {cp}")
                
        if ig and ig.get("coaching_questions"):
            lines.append("\n[ 사수 피드백 질문 ]")
            for cq in ig.get("coaching_questions", []):
                lines.append(f"  Q. {cq}")
                
        lines.append("\n")

    # 4. 공통 평가 루브릭
    lines.append("4. 공통 평가 루브릭")
    lines.append("-" * 60)
    lines.append("구체성: 행동, 수량, 순서, 보고 대상이 명확한가?")
    lines.append("현장 적용성: 실제 업무에서 바로 사용할 수 있는가?")
    lines.append("근거 제시: 명확한 데이터나 상황적 근거가 포함되었는가?")
    lines.append("연결성: 이전 주차 산출물을 다음 과제에 잘 활용했는가?")
    lines.append("-" * 60 + "\n")

    return StreamingResponse(
        io.StringIO("\n".join(lines)),
        media_type="text/plain",
        headers={"Content-Disposition": f"attachment; filename=curriculum.txt"},
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
            
    def safe_print(text, border=0, fill=False, h=7):
        if not text: return
        text = str(text).replace('\r', '').replace('\t', '  ')
        
        max_w = pdf.w - pdf.l_margin - pdf.r_margin - 2 
        
        lines = []
        for p in text.split('\n'):
            if not p:
                lines.append("")
                continue
                
            current_line = ""
            for char in p:
                if pdf.get_string_width(current_line + char) > max_w:
                    lines.append(current_line)
                    current_line = char
                else:
                    current_line += char
            
            if current_line:
                lines.append(current_line)
        
        for i, line in enumerate(lines):
            b = 0
            if border:
                if len(lines) == 1: b = 1
                elif i == 0: b = 'LTR'
                elif i == len(lines) - 1: b = 'LBR'
                else: b = 'LR'
            pdf.cell(0, h, txt=line, border=b, ln=True, fill=fill)

    set_font('', 16)
    pdf.cell(0, 10, txt="LandFactory 과제 템플릿 패키지", ln=True, align='C')
    set_font('', 14)
    pdf.cell(0, 10, txt=f"{cur_title} 실무 온보딩 과정", ln=True, align='C')
    pdf.ln(5)

    # 1. 과정 개요
    set_font('', 12)
    pdf.cell(0, 10, txt="1. 과정 개요", ln=True)
    set_font('', 10)
    
    overview_text = f"과정명: {cur_title}\n대상 직무: {curriculum_data.get('cur_target_job', '미지정')}\n교육 기간: {curriculum_data.get('cur_duration_weeks', 0)}주\n교육 목적: {curriculum_data.get('cur_learning_goal', '미지정')}"
    safe_print(overview_text, border=1, h=8)
    pdf.ln(5)

    # 2. 전체 과제 흐름
    set_font('', 12)
    pdf.cell(0, 10, txt="2. 전체 과제 흐름", ln=True)
    set_font('', 10)
    
    for week in week_plan:
        week_num = week.get('week', '')
        theme = str(week.get('theme', ''))
        tasks = ", ".join([a.get("title", "") for a in week.get("assignments", [])])
        pdf.cell(0, 8, txt=f"[{week_num}주차] {theme}", ln=True)
        safe_print(f"산출물: {tasks}")

    pdf.ln(5)
    
    # 3. 주차별 상세 과제 가이드
    set_font('', 12)
    pdf.cell(0, 10, txt="3. 주차별 과제 템플릿", ln=True)
    set_font('', 10)
    
    for week in week_plan:
        pdf.set_fill_color(240, 240, 240)
        title_str = f"■ {week.get('week')}주차: {week.get('theme')}"
        pdf.cell(0, 8, txt=title_str, ln=True, fill=True)
        
        safe_print(f"학습 목표: {week.get('learning_objective')}")
        
        assignments = week.get('assignments', [])
        for idx, a in enumerate(assignments):
            pdf.ln(2)
            task_name = f"▶ 과제명: {a.get('title')}"
            pdf.cell(0, 7, txt=task_name, ln=True)
            
            safe_print(f"제출 형태: {a.get('expected_output_format')}")

            guide_text = "수행 방법:\n" + "\n".join([f"  - {g}" for g in a.get('step_by_step_guide', [])])
            safe_print(guide_text)
            
        ig = week.get('instructor_guide', {})
        if ig and ig.get('check_points'):
            pdf.ln(2)
            pdf.cell(0, 7, txt="[ 자기 점검 체크리스트 ]", ln=True)
            for cp in ig.get('check_points', []):
                safe_print(f"  ☐ {cp}")
                
        if ig and ig.get('coaching_questions'):
            pdf.ln(2)
            pdf.cell(0, 7, txt="[ 사수 피드백 질문 ]", ln=True)
            for cq in ig.get('coaching_questions', []):
                safe_print(f"  Q. {cq}")

        pdf.ln(5)

    # 4. 평가 루브릭
    set_font('', 12)
    pdf.cell(0, 10, txt="4. 공통 평가 루브릭", ln=True)
    set_font('', 10)
    rubric = "구체성: 행동/수량/순서 명확\n현장 적용성: 실무 즉시 적용 가능\n근거 제시: 데이터/상황 근거 포함\n연결성: 이전 주차 산출물 연계"
    safe_print(rubric, border=1, h=8)
    pdf_out = pdf.output(dest="S")
    pdf_bytes = pdf_out.encode("latin-1") if isinstance(pdf_out, str) else bytes(pdf_out)
    pdf_stream = io.BytesIO(pdf_bytes)

    return StreamingResponse(
        pdf_stream, 
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

    doc.add_heading("LandFactory 과제 템플릿 패키지", 0)
    doc.add_paragraph(f"{cur_title} 실무 온보딩 과정").bold = True

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

    # 2. 전체 과제 흐름
    doc.add_heading("2. 전체 과제 흐름", level=1)
    flow_table = doc.add_table(rows=1, cols=3)
    flow_table.style = 'Table Grid'
    flow_hdr = flow_table.rows[0].cells
    flow_hdr[0].text = '주차'
    flow_hdr[1].text = '주제'
    flow_hdr[2].text = '핵심 산출물'

    for week in week_plan:
        row = flow_table.add_row().cells
        row[0].text = f"{week.get('week')}주차"
        row[1].text = str(week.get('theme', ''))
        tasks = ", ".join([a.get('title', '') for a in week.get('assignments', [])])
        row[2].text = tasks
        
    doc.add_paragraph("\n")

    # 3. 주차별 과제 템플릿
    doc.add_heading("3. 주차별 과제 템플릿", level=1)
    for week in week_plan:
        doc.add_heading(f"{week.get('week')}주차 과제 템플릿", level=2)
        doc.add_paragraph(f"주제: {week.get('theme')}")
        doc.add_paragraph(f"학습 목표: {week.get('learning_objective')}")
        
        for idx, a in enumerate(week.get('assignments', [])):
            doc.add_heading(f"과제명: {a.get('title')}", level=3)
            doc.add_paragraph(f"제출 형태: {a.get('expected_output_format')}")
            
            p_guide = doc.add_paragraph("수행 방법:\n")
            for step in a.get('step_by_step_guide', []):
                p_guide.add_run(f"  - {step}\n")
                
        ig = week.get('instructor_guide', {})
        if ig and ig.get('check_points'):
            doc.add_heading("자기 점검 체크리스트", level=3)
            for cp in ig.get('check_points', []):
                doc.add_paragraph(f"☐ {cp}")
                
        if ig and ig.get('coaching_questions'):
            doc.add_heading("사수 피드백 질문", level=3)
            for idx, cq in enumerate(ig.get('coaching_questions', [])):
                doc.add_paragraph(f"{idx+1}. {cq}")
        
        doc.add_paragraph("\n")

    # 4. 공통 평가 루브릭
    doc.add_heading("4. 공통 평가 루브릭", level=1)
    rubric_table = doc.add_table(rows=5, cols=4)
    rubric_table.style = 'Table Grid'
    
    r_hdr = rubric_table.rows[0].cells
    r_hdr[0].text = '평가 항목'
    r_hdr[1].text = '우수'
    r_hdr[2].text = '보통'
    r_hdr[3].text = '미흡'
    
    rubric_data = [
        ("구체성", "행동, 수량, 순서가 명확하다", "대체로 구체적이나 일부 모호하다", "추상적 표현이 많다"),
        ("현장 적용성", "실제 업무에 바로 사용할 수 있다", "일부 수정 후 사용할 수 있다", "현장 상황과 연결이 약하다"),
        ("근거 제시", "명확한 데이터나 상황적 근거가 있다", "근거가 일부만 포함되어 있다", "개인 느낌 위주로 작성되었다"),
        ("연결성", "이전 주차 산출물을 다음 과제에 활용했다", "일부만 활용했다", "전혀 활용하지 않았다"),
    ]
    
    for i, row_data in enumerate(rubric_data, start=1):
        cells = rubric_table.rows[i].cells
        cells[0].text = row_data[0]
        cells[1].text = row_data[1]
        cells[2].text = row_data[2]
        cells[3].text = row_data[3]

    file_stream = io.BytesIO()
    doc.save(file_stream)
    file_stream.seek(0)

    return StreamingResponse(
        file_stream, 
        media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document", 
        headers={"Content-Disposition": f"attachment; filename=curriculum.docx"}
    )
    

@router.post("/generate-template", response_model=TemplateGenerateResponse)
@limiter.limit("20/hour")
def generate_template_api(
    request: Request,
    body: TemplateGenerateRequest,
    current_user: User = Depends(get_current_user),
):
    if current_user.user_role not in {"m", "a"}:
        raise HTTPException(status_code=403, detail="Only manager/admin can generate templates")

    try:
        val_result = curriculum_service.validate_curriculum_input(
            cur_title=body.assignment_title, 
            cur_target_job=body.theme or "",
            cur_target_industry="", 
            cur_learning_goal=body.learning_objective or "",
            required_content=" ".join(body.step_by_step_guide) if body.step_by_step_guide else ""
        )
        if not val_result.is_valid:
            raise HTTPException(status_code=400, detail=val_result.reason)
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"템플릿 입력값 검증 실패: {exc}")

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
    

@router.delete("/{cur_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_curriculum(
    cur_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    curriculum = (
        db.query(Curriculum)
        .filter(Curriculum.cur_id == cur_id, Curriculum.cur_deleted_at.is_(None))
        .first()
    )
    if not curriculum or (current_user.user_role != "a" and curriculum.cur_creator_id != current_user.user_id):
        raise HTTPException(status_code=404, detail="커리큘럼을 찾을 수 없습니다")

    KST = timezone(timedelta(hours=9))
    curriculum.cur_deleted_at = datetime.now(KST)
    db.commit()