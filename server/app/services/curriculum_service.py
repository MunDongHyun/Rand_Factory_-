import os
import json
from pathlib import Path
from dotenv import load_dotenv

# LangChain 관련 모듈
from langchain_openai import ChatOpenAI, OpenAIEmbeddings
from langchain_community.vectorstores import FAISS
from langchain_core.documents import Document
from langchain_core.prompts import PromptTemplate
from langchain_core.output_parsers import JsonOutputParser
from langchain_community.tools import DuckDuckGoSearchResults

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

llm = ChatOpenAI(model=os.getenv("AI_MODEL", "gpt-5.4-mini"), temperature=0.2)
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
                    
                    # 검색 대상이 될 본문 텍스트 (JSON 전체 혹은 특정 필드)
                    content = json.dumps(data, ensure_ascii=False)
                    
                    # 메타데이터에 URL과 제목을 명확히 분리하여 저장 (가장 중요)
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

    # 벡터 DB 생성 및 로컬 저장
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
        # 유사도 높은 상위 3개 문서 검색
        docs = vector_db.similarity_search(search_query, k=3)
        
        # LLM이 URL을 확실히 인지할 수 있도록 포맷팅
        context_parts = []
        for d in docs:
            url = d.metadata.get('url', '')
            title = d.metadata.get('title', 'Unknown')
            part = f"[자료: {title}]\nURL: {url if url else '정보 없음'}\n내용: {d.page_content}"
            context_parts.append(part)
        db_context = "\n\n---\n\n".join(context_parts)

    # 로컬 DB에 내용이 부족할 경우 웹 검색 수행
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

# --- [STEP 3] 최종 커리큘럼 생성 함수 ---

curriculum_prompt_template = """
당신은 최고 수준의 S-OJT 설계 전문가입니다. 제공된 [참고 자료]를 바탕으로 교육 커리큘럼을 JSON으로 설계하세요.

[핵심 규칙]
1. 'recommended_articles' 내의 'url' 필드는 반드시 [참고 자료]에 명시된 URL 주소를 그대로 사용하세요.
2. 만약 자료에 URL이 없거나 '정보 없음'이라면 반드시 ""(빈 문자열)로 표기하세요. 절대 주소를 지어내지 마세요.
3. 교육 내용은 구체적인 행동 지침 위주로 작성하세요.

[입력 정보]
- 과정명: {cur_title}
- 목표: {cur_learning_goal}
- 필수내용: {required_content}

[참고 자료]
{context}

[출력 형식: JSON 배열]
[
  {{
    "week": 1,
    "theme": "주제",
    "tasks": ["세부과제"],
    "recommended_articles": [
      {{ "title": "자료명", "url": "참고자료의 URL" }}
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
    
    # 3. 실행
    return curriculum_chain.invoke({
        "cur_title": cur_title,
        "cur_target_job": cur_target_job,
        "cur_target_industry": cur_target_industry,
        "cur_duration_weeks": cur_duration_weeks,
        "cur_learning_goal": cur_learning_goal,
        "required_content": required_content,
        "context": context
    })