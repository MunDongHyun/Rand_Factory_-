import os
import json
from pathlib import Path
from dotenv import load_dotenv
from langchain_openai import ChatOpenAI
from langchain_core.prompts import PromptTemplate
from langchain_core.output_parsers import JsonOutputParser

CURRENT_DIR = Path(__file__).resolve().parent
BASE_DIR = CURRENT_DIR.parent.parent # /server 폴더
PROJECT_DIR = BASE_DIR.parent # 최상위 폴더

load_dotenv(BASE_DIR / ".env")
load_dotenv(PROJECT_DIR / ".env", override=False)

# LLM 초기화
openai_api_key = os.getenv("OPENAI_API_KEY")
if openai_api_key:
    os.environ["OPENAI_API_KEY"] = openai_api_key

llm = ChatOpenAI(model=os.getenv("AI_MODEL", "gpt-5.4"), temperature=0.2)

# 임시 Vector DB 역할을 할 로컬 요약 폴더 경로
SUMMARY_DIR = BASE_DIR / "summary"

def retrieve_from_local_json(query_keywords: list, summary_dir: Path = SUMMARY_DIR) -> str:
    if not os.path.exists(summary_dir):
        os.makedirs(summary_dir, exist_ok=True)
        return ""

    relevant_articles = []
    for file_name in os.listdir(summary_dir):
        if file_name.endswith('.json'):
            file_path = os.path.join(summary_dir, file_name)
            try:
                with open(file_path, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                    data_str = json.dumps(data, ensure_ascii=False)
                    
                    if any(keyword.lower() in data_str.lower() for keyword in query_keywords if len(keyword) > 1):
                        relevant_articles.append(data_str)
            except Exception as e:
                print(f"⚠️ {file_name} 읽기 오류: {e}")
                
    return "\n\n---\n\n".join(relevant_articles)

def retrieve_and_supplement_context(course_name: str, required_content: str):
    # 빈 문자열 처리 안전장치 추가
    safe_course_name = course_name or ""
    safe_req_content = required_content or ""
    
    query_keywords = safe_course_name.split() + safe_req_content.split()
    db_context = retrieve_from_local_json(query_keywords)
    
    if len(db_context.strip()) < 100:
        try:
            from langchain_community.tools import DuckDuckGoSearchResults
            search_tool = DuckDuckGoSearchResults()
            web_query = f"{safe_course_name} 실무 지침 커리큘럼"
            web_context = search_tool.invoke(web_query)
            combined_context = f"[로컬 자료 없음]\n[웹 검색 보충 자료]\n{web_context}"
        except Exception as e:
            combined_context = f"검색 중 오류 발생: {e}"
    else:
        combined_context = f"[로컬 아티클 자료]\n{db_context}"
        
    return combined_context

# 2. JSON 출력을 강제하는 프롬프트 (FastAPI DB 및 프론트엔드 연동용)
# LangChain에서 { } 괄호는 변수로 인식하므로, JSON 예시의 괄호는 {{ }} 로 이스케이프 처리했습니다.
curriculum_prompt_template = """
당신은 대기업 HRD(인적자원개발) 교육 담당자이자 최고 수준의 체계적 OJT(S-OJT) 설계 전문가입니다.
사용자의 요청과 수집된 참고 자료를 바탕으로 주차별(또는 단계별) 실무 교육 커리큘럼을 설계하세요.

절대 단순 명사나 단답형으로 적지 마세요. 멘토가 당장 이 문서를 보고 실무 교육을 진행할 수 있도록 매우 구체적이고 실천적인 행동 지침(세부 스크립트, 체크리스트, 구체적 사례 등)으로 풍성하게 채워야 합니다.

[설계 핵심 지침]
1. 'tasks' (핵심 학습 및 실습 과제): 추상적인 과제가 아닌 구체적인 상황과 목표가 부여된 과제를 명시하세요. (예: "A기능을 B조건에 맞춰 구현하고 C양식으로 보고하기")
2. 'success_criteria' (멘토 피드백 포인트 및 루브릭): "잘했는지 확인" 수준이 아니라, 눈에 보이는 행동 지표(Behavioral Indicator)와 구체적인 체크리스트 형태로 작성하세요. (예: "사내 Git 컨벤션을 준수하여 커밋을 작성했는가?", "예외 처리 로직이 2가지 이상 포함되었는가?")

[사용자 입력 정보]
- 교육 과정명: {cur_title}
- 대상 직무: {cur_target_job}
- 대상 산업: {cur_target_industry}
- 훈련 기간(주차): {cur_duration_weeks}주
- 학습 목표: {cur_learning_goal}
- 필수 포함 내용: {required_content}

[수집된 참고 자료]
{context}

[출력 형식 및 지침]
반드시 아래의 JSON 배열(Array of Objects) 형식으로만 응답하세요. 마크다운 백틱(```json)이나 다른 설명 텍스트는 절대 포함하지 마세요. 데이터베이스에 바로 저장할 수 있는 순수 JSON 포맷이어야 합니다.
총 {cur_duration_weeks}개의 주차(요소)가 생성되어야 합니다.

[
  {{
    "week": 1,
    "theme": "해당 주차의 핵심 교육 제목 (예: B2B 고객 분석 및 ICP 정의)",
    "learning_objective": "이 주차를 통해 달성할 구체적인 행동 목표",
    "tasks": [
      "어떤 방식으로 무엇을 가르칠 것인지 상세한 OJT 내용 작성",
      "구체적인 상황 기반 실습 지시 (현업 적용형)"
    ],
    "success_criteria": [
      "멘토가 확인해야 할 핵심 체크 포인트 1 (행동 지표 기준)",
      "멘토가 확인해야 할 핵심 체크 포인트 2 (행동 지표 기준)"
    ],
    "recommended_articles": [
      {{
        "title": "학습에 필요한 사내 문서, 시스템, 또는 가이드북 이름",
        "why_relevant": "이 자료를 활용해야 하는 구체적인 이유"
      }}
    ],
    "estimated_hours": 8
  }},
  {{
    "week": 2,
    "theme": "...",
    "learning_objective": "...",
    "tasks": ["..."],
    "success_criteria": ["..."],
    "recommended_articles": [{{ "title": "...", "why_relevant": "..." }}],
    "estimated_hours": 8
  }}
]
"""

# 3. 서비스 호출 함수 (라우터에서 이 함수를 호출합니다)
def generate_week_plan(cur_title: str, cur_duration_weeks: int, cur_target_job: str, cur_target_industry: str, cur_learning_goal: str, required_content: str):
    
    context = retrieve_and_supplement_context(cur_title, required_content)
    
    prompt = PromptTemplate.from_template(curriculum_prompt_template)
    # 마크다운 텍스트가 아닌 JSON 딕셔너리로 바로 파싱하는 파서 사용
    output_parser = JsonOutputParser() 
    
    curriculum_chain = prompt | llm | output_parser
    
    # LLM 실행
    result_json = curriculum_chain.invoke({
        "cur_title": cur_title,
        "cur_target_job": cur_target_job,
        "cur_target_industry": cur_target_industry,
        "cur_duration_weeks": cur_duration_weeks,
        "cur_learning_goal": cur_learning_goal,
        "required_content": required_content,
        "context": context
    })
    
    return result_json # 파싱된 list[dict] 형태 반환