import os
import json
from pathlib import Path
from dotenv import load_dotenv

# [추가된 부분] PDF 생성을 위한 모듈 임포트
from fpdf import FPDF 

# LangChain 관련 모듈
from langchain_openai import ChatOpenAI, OpenAIEmbeddings
from langchain_community.vectorstores import FAISS
from langchain_core.documents import Document
from langchain_core.prompts import PromptTemplate
from langchain_core.output_parsers import JsonOutputParser
from langchain_community.tools import DuckDuckGoSearchResults
from fastapi.responses import StreamingResponse

# 1. 경로 및 설정 로드
CURRENT_DIR = Path(__file__).resolve().parent
BASE_DIR = CURRENT_DIR.parent.parent  # /server 폴더
PROJECT_DIR = BASE_DIR.parent         # 최상위 폴더

load_dotenv(BASE_DIR / ".env")
load_dotenv(PROJECT_DIR / ".env", override=False)

# LLM 및 임베딩 초기화
openai_api_key = os.getenv("OPENAI_API_KEY")
if openai_api_key:
    os.environ["OPENAI_API_KEY"] = openai_api_key

llm = ChatOpenAI(model=os.getenv("AI_MODEL", "gpt-4o-mini"), temperature=0.2) # 모델명 gpt-4o-mini 로 임의수정 (오타 방지)
embeddings = OpenAIEmbeddings()

SUMMARY_DIR = BASE_DIR / "summary"
VECTOR_DB_PATH = BASE_DIR / "vector_db"

# --- [STEP 1] Vector DB 구축 및 로드 함수 ---
def sync_vector_db():
    """로컬 JSON 파일들을 읽어 FAISS Vector DB를 생성하거나 업데이트합니다."""
    documents = []
    
    if not SUMMARY_DIR.exists():
        return None

    for file_name in os.listdir(SUMMARY_DIR):
        if file_name.endswith('.json'):
            file_path = SUMMARY_DIR / file_name
            try:
                with open(file_path, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                    
                    content = json.dumps(data, ensure_ascii=False)
                    
                    metadata = {
                        "source_file": file_name,
                        "url": data.get("url", ""),
                        "title": data.get("title", file_name)
                    }
                    documents.append(Document(page_content=content, metadata=metadata))
            except Exception as e:
                print(f"⚠️ {file_name} 파싱 오류: {e}")

    if not documents:
        return None

    vector_db = FAISS.from_documents(documents, embeddings)
    vector_db.save_local(str(VECTOR_DB_PATH))
    return vector_db

def get_vector_db():
    """저장된 Vector DB를 로드하거나, 없으면 새로 생성합니다."""
    if VECTOR_DB_PATH.exists():
        return FAISS.load_local(
            str(VECTOR_DB_PATH), 
            embeddings, 
            allow_dangerous_deserialization=True
        )
    return sync_vector_db()

# --- [STEP 2] 검색 및 컨텍스트 생성 로직 ---
def retrieve_and_supplement_context(course_name: str, required_content: str):
    search_query = f"{course_name} {required_content}"
    vector_db = get_vector_db()
    
    db_context = ""
    if vector_db:
        docs = vector_db.similarity_search(search_query, k=3)
        
        context_parts = []
        for d in docs:
            url = d.metadata.get('url', '')
            title = d.metadata.get('title', 'Unknown')
            part = f"[자료: {title}]\nURL: {url if url else '정보 없음'}\n내용: {d.page_content}"
            context_parts.append(part)
        db_context = "\n\n---\n\n".join(context_parts)

    if len(db_context.strip()) < 100:
        try:
            search_tool = DuckDuckGoSearchResults()
            web_query = f"{course_name} 실무 교육 커리큘럼 지침"
            web_context = search_tool.invoke(web_query)
            combined_context = f"[로컬 DB 결과 없음]\n[웹 실시간 검색 자료]\n{web_context}"
        except Exception as e:
            combined_context = f"검색 중 오류 발생: {e}"
    else:
        combined_context = f"[로컬 검증 자료]\n{db_context}"
        
    return combined_context


# --- [추가된 부분] 파일 생성 함수 정의 ---
def export_curriculum_to_files(curriculum_data, base_filename="onboarding_plan"):
    """
    생성된 커리큘럼 데이터를 JSON, TXT, PDF 형식으로 서버에 저장합니다.
    """
    # 1. JSON 저장
    with open(f"{base_filename}.json", "w", encoding="utf-8") as f:
        json.dump(curriculum_data, f, ensure_ascii=False, indent=2)

    # 2. TXT 저장
    with open(f"{base_filename}.txt", "w", encoding="utf-8") as f:
        for week in curriculum_data:
            f.write(f"[{week['week']}주차] {week['theme']}\n")
            f.write(f"목표: {week['learning_objective']}\n")
            f.write("-" * 30 + "\n")
            f.write("■ 주요 학습 과제:\n")
            for t in week['tasks']: f.write(f" - {t}\n")
            f.write("\n■ 제출 과제:\n")
            for a in week['assignments']:
                f.write(f" [과제명: {a['title']}]\n   설명: {a['description']}\n   제출: {a['submission']}\n")
            f.write("\n" + "=" * 50 + "\n\n")

    # 3. PDF 저장 (한글 폰트가 없으면 기본 Arial 사용)
    pdf = FPDF()
    pdf.add_page()
    pdf.set_font("Arial", size=16)
    pdf.cell(200, 10, txt="Onboarding Curriculum Guide", ln=True, align='C')
    
    for week in curriculum_data:
        pdf.set_font("Arial", size=14)
        pdf.cell(200, 10, txt=f"Week {week['week']}: {week['theme']}", ln=True)
        pdf.set_font("Arial", size=10)
        # multi_cell로 긴 텍스트 처리
        pdf.multi_cell(0, 5, txt=f"Objective: {week['learning_objective']}")
        pdf.ln(5) # 줄바꿈
        
    pdf.output(f"{base_filename}.pdf")
    print(f"✅ 파일 생성 완료: {base_filename}.json, .txt, .pdf")


# --- [STEP 3] 최종 커리큘럼 생성 함수 ---
curriculum_prompt_template = """
당신은 최고 수준의 S-OJT(내부직무교육) 설계 전문가입니다. 
제공된 [참고 자료]를 바탕으로 신입사원이 주차별로 수행해야 할 '실무 과제'와 교육담당자가 활용할 '평가 가이드'를 포함한 커리큘럼을 JSON으로 설계하세요.

[핵심 설계 원칙]
1. 과제(Assignments): 신입사원이 실제로 작성하거나 행동하여 제출할 수 있는 '구체적인 결과물' 형태로 정의하세요.
2. 시간 흐름: 1주차(기초/관찰) -> 2주차(모방/실습) -> 3주차(응용/협업) -> 4주차(성과/내재화)의 흐름을 따릅니다.
3. 교육자 가이드: 담당자가 피학습자에게 어떤 질문을 던져야 하는지, 무엇을 체크해야 하는지 명시하세요.

[입력 정보]
- 과정명: {cur_title}
- 목표: {cur_learning_goal}
- 필수내용: {required_content}

[출력 형식: JSON 배열]
[
  {{
    "week": 1,
    "theme": "주제명",
    "learning_objective": "이 주차에 달성해야 할 구체적 목표",
    "tasks": ["학습 활동 리스트"],
    "assignments": [
      {{
        "title": "과제 제목",
        "description": "과제에 대한 구체적인 수행 방법 및 제출 양식 설명",
        "submission": "제출물 형태 (예: 이메일 드래프트, 체크리스트 PDF, 보고서 초안)"
      }}
    ],
    "instructor_guide": {{
      "check_points": ["담당자가 확인해야 할 핵심 역량"],
      "feedback_tips": "피드백 시 유의사항 및 권장 멘트"
    }},
    "recommended_articles": [
      {{ "title": "자료명", "url": "URL 주소" }}
    ]
  }}
]
"""

def generate_week_plan(cur_title: str, cur_duration_weeks: int, cur_target_job: str, cur_target_industry: str, cur_learning_goal: str, required_content: str):
    # 1. 벡터 검색을 통한 컨텍스트 확보
    context = retrieve_and_supplement_context(cur_title, required_content)
    
    # 2. 체인 구성
    prompt = PromptTemplate.from_template(curriculum_prompt_template)
    output_parser = JsonOutputParser() 
    curriculum_chain = prompt | llm | output_parser
    
    # 3. LLM 실행 (결과를 result 변수에 담습니다)
    result = curriculum_chain.invoke({
        "cur_title": cur_title,
        "cur_target_job": cur_target_job,
        "cur_target_industry": cur_target_industry,
        "cur_duration_weeks": cur_duration_weeks,
        "cur_learning_goal": cur_learning_goal,
        "required_content": required_content,
        "context": context
    })
    return result