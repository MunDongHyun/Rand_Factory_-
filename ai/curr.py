import os
import json
from pathlib import Path

from dotenv import load_dotenv
from langchain_openai import ChatOpenAI
from langchain_core.prompts import PromptTemplate
from langchain_core.output_parsers import StrOutputParser

# 1. 환경 설정 및 기본 초기화
BASE_DIR = Path(__file__).resolve().parent
PROJECT_DIR = BASE_DIR.parent

load_dotenv(PROJECT_DIR / "server" / ".env")
load_dotenv(PROJECT_DIR / ".env", override=False)

openai_api_key = os.getenv("OPENAI_API_KEY")
if openai_api_key:
    os.environ["OPENAI_API_KEY"] = openai_api_key

llm = ChatOpenAI(model=os.getenv("AI_MODEL", "gpt-5.4-mini"), temperature=0.2)

# 임시 Vector DB 역할을 할 로컬 요약 폴더 경로
SUMMARY_DIR = BASE_DIR / "summary"
# 결과물이 저장될 폴더 경로 추가
OUTPUT_DIR = BASE_DIR / "curriculum_output"


# 2. 정보 검색 및 보충 (로컬 JSON + Web RAG 로직)
def retrieve_from_local_json(query_keywords: list, summary_dir: Path = SUMMARY_DIR) -> str:
    if not os.path.exists(summary_dir):
        os.makedirs(summary_dir)
        print(f"📁 '{summary_dir}' 폴더가 없어 새로 생성했습니다.")
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

def retrieve_and_supplement_context(course_name: str, training_goal: str, required_content: str):
    query_keywords = course_name.split() + required_content.split()
    db_context = retrieve_from_local_json(query_keywords)
    
    if len(db_context.strip()) < 100:
        print("⚠️ 로컬 폴더에 관련 아티클이 부족합니다. 웹 검색(RAG)을 통해 정보를 보충합니다...")
        try:
            from langchain_community.tools import DuckDuckGoSearchResults

            search_tool = DuckDuckGoSearchResults()
            web_query = f"{course_name} 대기업 S-OJT 실무 지침"
            web_context = search_tool.invoke(web_query)
            combined_context = f"[로컬 자료]\n관련 자료 없음\n\n[웹 검색 보충 자료]\n{web_context}"
        except Exception as e:
            combined_context = f"검색 중 오류 발생: {e}"
    else:
        print("🔍 로컬 폴더에서 관련 아티클 요약본을 찾았습니다.")
        combined_context = f"[로컬 아티클 자료]\n{db_context}"
        
    return combined_context

# 3. 커리큘럼 생성 프롬프트 및 파서 설계 (내용 심화 적용)
curriculum_prompt_template = """
당신은 대기업 HRD(인적자원개발) 교육 담당자이자 최고 수준의 체계적 OJT(S-OJT) 설계 전문가입니다.
제공된 양식(표)을 엄격히 준수하되, 표 내부의 내용은 절대 단순 명사나 단답형으로 적지 마세요. 멘토가 당장 이 문서를 보고 실무 교육을 진행할 수 있도록 매우 구체적이고 실천적인 행동 지침(세부 스크립트, 체크리스트, 구체적 사례 등)으로 풍성하게 채워야 합니다.

[설계 핵심 지침 (표 내부 작성 규칙)]
1. 훈련실행 단계 표:
   - '핵심 OJT 학습 내용': 단순 나열이 아닌, "어떤 방식으로 무엇을 가르칠 것인지" 서술하세요.
   - '수행 실습 과제': 추상적인 과제가 아닌 구체적인 상황과 목표가 부여된 과제를 명시하세요. (예: "A기능을 B조건에 맞춰 구현하고 C양식으로 보고하기")
   - '멘토 피드백 포인트': "잘했는지 확인" 수준이 아니라, "1. 변수명 규칙 준수 여부 점검 2. 예외 처리 로직 포함 여부 확인" 등 구체적인 체크리스트 형태로 작성하세요.
2. 루브릭 평가표:
   - '우수/보통/미흡'의 기준은 반드시 눈에 보이는 "행동 지표(Behavioral Indicator)"로 작성하세요. (예: 미흡 = "코드가 작동하지 않음" (X) -> "사내 Git 컨벤션을 준수하지 않고, 코드 리뷰 지적 사항을 2회 이상 미반영함" (O))
   - 마크다운 표 안에서 줄바꿈이 필요할 경우 반드시 HTML 태그 `<br>` 을 사용하세요.

[사용자 입력 정보]
- 학습 형태: {training_type}
- 교육 과정명: {course_name}
- 훈련 기간: {training_duration}
- 훈련 목표: {training_goal}
- 세부 훈련 목표: {detailed_goals} (입력되지 않은 경우, 핵심 직무/소프트스킬 3~4가지 도출)
- 필수 포함 내용: {required_content}

[수집된 참고 자료]
{context}

---

# 📋 훈련 계획 및 준비 (S-OJT 실시 계획안)

| 구분 | 내용 |
|---|---|
| **과정명 (역량단위)** | {course_name} |
| **훈련 형태** | {training_type} |
| **훈련 기간/시간** | {training_duration} |
| **훈련 목표** | {training_goal} |
| **사전 준비물** | (접근 권한, 툴, 가이드북, 참고 레퍼런스 등을 구체적으로 명시) |
| **사수(멘토)/부사수(멘티) 역할** | (서로 기대하는 구체적인 행동 약속 작성) |

<br>

# 📚 훈련실행 단계 (주차별/단계별 세부 훈련 지도안)

| 세부 훈련 목표 (역량 요소) | 핵심 OJT 학습 내용 (상세) | 활용 실무 자료 | 수행 실습 과제 (현업 적용형) | 멘토 피드백 포인트 (체크리스트) |
|---|---|---|---|---|
| (세부 목표 1) | (구체적인 교육 진행 방식) | (문서명/시스템) | (구체적인 상황 기반 실습 지시) | (멘토가 확인해야 할 2~3가지 핵심 체크 포인트) |
| (세부 목표 2) | (구체적인 교육 진행 방식) | (문서명/시스템) | (구체적인 상황 기반 실습 지시) | (멘토가 확인해야 할 2~3가지 핵심 체크 포인트) |
| (세부 목표 3) | (구체적인 교육 진행 방식) | (문서명/시스템) | (구체적인 상황 기반 실습 지시) | (멘토가 확인해야 할 2~3가지 핵심 체크 포인트) |

<br>

# 📝 S-OJT 교수·학습 흐름도 (학습 전이 극대화)

* **핵심 학습 지도 전략:** (멘토가 어떤 태도와 코칭 스킬로 접근해야 하는지 상세 서술)
* **일정 흐름도 (주차별 Action Plan):**
  1. **(1단계 / Onboarding & Observe):** (단순 관찰이 아닌, 멘토가 무엇을 시연하고 멘티가 무엇을 기록해야 하는지 상세 서술)
  2. **(2단계 / Practice & Feedback):** (어떤 방식으로 실습하고 피드백 루프를 돌릴 것인지 상세 서술)
  3. **(3단계 / Perform & Evaluate):** (최종 업무 수행 방식과 피드백 면담 진행 방식 상세 서술)

<br>

# 📊 행동 지표 기반 역량 평가표 (Rubric)

### 📌 종합 실무 해결 시나리오 (Assessment)
* **최종 평가 과제:** (실무에서 발생할 수 있는 복합적이고 구체적인 문제 상황 시나리오 부여)

| 평가 항목 (역량) | 우수 (수행준거 완벽 충족) | 보통 (일부 피드백 필요) | 미흡 (집중 재교육 필요) |
|---|---|---|---|
| (직무 하드스킬 1) | (구체적 행동 지표) | (구체적 행동 지표) | (구체적 행동 지표) |
| (직무 하드스킬 2) | (구체적 행동 지표) | (구체적 행동 지표) | (구체적 행동 지표) |
| (소프트스킬/협업) | (구체적 행동 지표) | (구체적 행동 지표) | (구체적 행동 지표) |

* **💡 멘토 총평 및 향후 개발 계획(IDP):** (단순 피드백이 아닌, 평가 종료 후 멘티를 어떻게 지속 관리할 것인지에 대한 멘토의 액션 가이드)
"""

prompt = PromptTemplate.from_template(curriculum_prompt_template)
output_parser = StrOutputParser() 
curriculum_chain = prompt | llm | output_parser

# 4. 챗봇 엔진 실행 함수
def generate_chatbot_curriculum(user_input: dict):
    print(f"\n[{user_input['course_name']}] 커리큘럼 설계를 시작합니다...")
    
    detailed_goals = user_input.get("detailed_goals", "").strip()
    if not detailed_goals:
        detailed_goals = "AI가 현업 적용을 위한 핵심 직무 역량 및 소프트 스킬 목표 3~4가지를 자동 도출해 표에 작성할 것."
        
    context = retrieve_and_supplement_context(
        user_input["course_name"], 
        user_input["training_goal"], 
        user_input["required_content"]
    )
    
    print("⚙️ AI HR 전문가가 대기업 S-OJT 커리큘럼을 작성 중입니다...")
    result = curriculum_chain.invoke({
        "training_type": user_input["training_type"],
        "course_name": user_input["course_name"],
        "training_duration": user_input["training_duration"],
        "training_goal": user_input["training_goal"],
        "detailed_goals": detailed_goals,
        "required_content": user_input["required_content"],
        "context": context
    })
    
    if not os.path.exists(OUTPUT_DIR):
        os.makedirs(OUTPUT_DIR)
        print(f"📁 '{OUTPUT_DIR}' 폴더를 새로 생성했습니다.")

    safe_course_name = user_input["course_name"].replace(" ", "_").replace("/", "_")
    save_filename = f"OJT_Curriculum_{safe_course_name}.md"
    save_path = os.path.join(OUTPUT_DIR, save_filename)
    
    with open(save_path, 'w', encoding='utf-8') as f:
        f.write(result)
        
    print(f"✅ 커리큘럼 생성 완료! 결과가 '{save_path}'에 저장되었습니다.")
    return result

# ==========================================
# 5. 다양한 상황의 테스트 케이스 일괄 실행
# ==========================================
if __name__ == "__main__":
    test_scenarios = [
        {
            "training_type": "1대1 사수-부사수 페어 프로그래밍 및 멘토링 OJT",
            "course_name": "Node.js 및 AI RAG 서비스 백엔드 개발 실무 온보딩",
            "training_duration": "8주 (주 2회 코드 리뷰 세션 포함)",
            "training_goal": "사내 API 서버 아키텍처 파악 및 AI RAG 파이프라인 연동 실무 완벽 적응",
            "detailed_goals": "", 
            "required_content": "사내 Git 컨벤션 준수, 효율적인 DB(MySQL) 쿼리 작성, 사내 코드 리뷰 예절 및 건설적인 피드백 수용 태도" 
        },
        {
            "training_type": "소그룹 워크샵 및 임원 1:1 팔로우업 코칭",
            "course_name": "신임 팀장 리더십 및 성과 창출 조직 문화 구축 과정",
            "training_duration": "1박 2일 집중 워크샵 + 1개월 현업 코칭",
            "training_goal": "팀 내 소통 갈등 예방 및 심리적 안전감이 확보된 성과 중심의 조직 문화 정착",
            "detailed_goals": "", 
            "required_content": "신규 입사자와의 세대 간 소통(반존대, 메신저 예절 등) 가이드, 명확한 업무 지시 및 성과 면담(1on1) 기법" 
        },
        {
            "training_type": "1대1 현장 동행 영업 관찰 및 주간 롤플레잉 S-OJT",
            "course_name": "B2B 엔터프라이즈 솔루션 세일즈 실무 과정",
            "training_duration": "4주 (주 2회 현장 동행, 주 1회 롤플레잉)",
            "training_goal": "고객사 니즈 파악부터 제안서 작성, 최종 클로징까지의 B2B 세일즈 전체 파이프라인 마스터",
            "detailed_goals": "", 
            "required_content": "실전 콜드콜 스크립트 작성, 기업 내 결정권자(Key-man) 식별법, 고객 거절 극복 화법, 영업 실패 시 멘탈 관리 및 회고 프로세스" 
        },
        {
            "training_type": "현장 실습형 S-OJT (점장-부점장 또는 현장 관리자 1:다)",
            "course_name": "프랜차이즈 신규 매장 현장 관리자 양성 과정",
            "training_duration": "2주 (주 5일 현장 밀착 실습)",
            "training_goal": "매장 오픈/마감 표준 프로세스 숙지, 효율적 재고 관리 및 돌발적인 진상 고객 응대 능력 확보",
            "detailed_goals": "", 
            "required_content": "POS 시스템 결제/환불 조작, 매장 위생 및 안전 매뉴얼 숙지, 클레임 발생 시 초기 대응 스크립트 및 감정 노동 보호 지침 적용" 
        }
    ]

    print(f"총 {len(test_scenarios)}개의 다양한 OJT 시나리오 테스트를 시작합니다...\n" + "="*50)

    for idx, scenario in enumerate(test_scenarios, 1):
        print(f"\n▶️ [테스트 {idx}/{len(test_scenarios)}] 실행 중...")
        try:
            generate_chatbot_curriculum(scenario)
        except Exception as e:
            print(f"❌ '{scenario['course_name']}' 실행 중 오류 발생: {e}")
            
    print("\n" + "="*50)
    print("🎉 모든 시나리오의 커리큘럼 생성이 완료되었습니다. 'curriculum_output' 폴더를 확인해주세요!")