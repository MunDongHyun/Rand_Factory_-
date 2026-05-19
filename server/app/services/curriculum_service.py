import os
import json
from pathlib import Path
from dotenv import load_dotenv

from pydantic import BaseModel, Field
from typing import List
from langchain_openai import ChatOpenAI
from langchain_community.tools import DuckDuckGoSearchResults
from langchain_core.prompts import ChatPromptTemplate

class TemplateOutput(BaseModel):
    html_content: str = Field(description="학습자가 바로 작성할 수 있도록 구성된 HTML 양식 코드")

# 1. 환경변수 설정
CURRENT_DIR = Path(__file__).resolve().parent
BASE_DIR = CURRENT_DIR.parent.parent
PROJECT_DIR = BASE_DIR.parent

load_dotenv(BASE_DIR / ".env")
load_dotenv(PROJECT_DIR / ".env", override=False)

openai_api_key = os.getenv("OPENAI_API_KEY")
if not openai_api_key:
    print("🚨 경고: OPENAI_API_KEY를 찾을 수 없습니다.")


# 2. Pydantic 스키마 정의
class AssignmentDetails(BaseModel):
    title: str = Field(description="과제명")
    step_by_step_guide: List[str] = Field(description="학습자가 이 과제를 수행하기 위한 구체적인 1, 2, 3단계 행동 지침")
    expected_output_format: str = Field(description="제출해야 할 결과물의 구체적인 형태와 포함되어야 할 필수 항목")

class RecommendedArticle(BaseModel):
    title: str = Field(description="참고자료 제목")
    url: str = Field(description="반드시 제공된 컨텍스트에서 가져온 실제 URL (없으면 빈 문자열을 넣으세요)")
    reason_for_reading: str = Field(description="이 자료를 읽어야 과제 수행에 어떤 도움이 되는지 구체적인 이유")

class InstructorGuide(BaseModel):
    check_points: List[str] = Field(description="교육 담당자(사수)가 확인해야 할 체크 포인트 리스트")
    coaching_questions: List[str] = Field(description="1:1 미팅 시 피학습자에게 던져야 할 권장 질문 리스트")

class WeekPlan(BaseModel):
    week: int = Field(description="주차 (예: 1, 2, 3, 4)")
    theme: str = Field(description="해당 주차의 학습 주제")
    learning_objective: str = Field(description="학습 목표")
    assignments: List[AssignmentDetails] = Field(description="구체적인 실무 수행 과제 목록")
    instructor_guide: InstructorGuide = Field(description="교육 담당자(사수)를 위한 피드백 가이드")
    recommended_articles: List[RecommendedArticle] = Field(description="과제 수행을 돕는 실제 URL 기반 참고 자료")

class CurriculumOutput(BaseModel):
    curriculum: List[WeekPlan]

# 3. URL 검색 및 커리큘럼 생성 로직
def retrieve_real_urls_for_context(course_name: str, required_content: str) -> str:
    search_tool = DuckDuckGoSearchResults(num_results=5)
    search_query = f"{course_name} {required_content} 실무 가이드 템플릿"
    
    try:
        raw_results = search_tool.invoke(search_query)
        formatted_web_context = "=== [실제 웹 참고 자료 (이 URL들만 사용할 것)] ===\n" + raw_results 
        return formatted_web_context
    except Exception as e:
        print(f"Web Search Error: {e}")
        return "=== [웹 참고 자료 검색 실패. 내부 자료를 권장하도록 안내하세요.] ==="

def generate_week_plan(cur_title: str, cur_duration_weeks: int, cur_target_job: str, cur_target_industry: str, cur_learning_goal: str, required_content: str):
    ai_model = os.getenv("AI_MODEL", "gpt-5.4-mini")
    llm = ChatOpenAI(model=ai_model, temperature=0.2, api_key=openai_api_key)
    
    structured_llm = llm.with_structured_output(CurriculumOutput)

    web_url_context = retrieve_real_urls_for_context(cur_title, required_content)
    combined_context = f"{web_url_context}"
    
    system_prompt = """
    당신은 최고 수준의 기업 S-OJT(내부직무교육) 설계 전문가입니다. 
    제공된 [실제 웹 참고 자료] 컨텍스트를 바탕으로, 현업에 즉시 적용 가능한 총 {cur_duration_weeks}주차 분량의 커리큘럼을 설계하세요.

    [핵심 설계 원칙]
    1. 분량 준수 (매우 중요): 반드시 1주차부터 {cur_duration_weeks}주차까지 하나도 빠짐없이, 총 {cur_duration_weeks}개의 주차별 계획을 순서대로 생성하세요.
    2. 구체성(Actionable): 과제는 "어떻게(How)" 해야 하는지 단계별 가이드(step_by-step)를 명시하세요. 빈 배열([])을 반환해서는 안 됩니다.
    3. 역할 분리: '학습자'가 할 일(assignments)과 '교육담당자'의 피드백 가이드(instructor_guide)를 채워 넣으세요.
    4. 팩트 기반 URL: 'recommended_articles'의 URL은 [실제 웹 참고 자료]에 있는 link만 사용하세요. 적절한 링크가 없다면 URL을 ""(빈 문자열)로 두세요.

    [컨텍스트 데이터]
    {context}
    """

    user_prompt = """
    다음 정보에 맞춰 커리큘럼을 생성하세요:
    - 과정명: {cur_title}
    - 직무/산업: {cur_target_job} / {cur_target_industry}
    - 교육 목표: {cur_learning_goal}
    - 필수 포함 내용: {required_content}
    """

    prompt = ChatPromptTemplate.from_messages([
        ("system", system_prompt),
        ("user", user_prompt)
    ])

    chain = prompt | structured_llm
    
    result = chain.invoke({
        "cur_title": cur_title,
        "cur_target_job": cur_target_job,
        "cur_target_industry": cur_target_industry,
        "cur_duration_weeks": cur_duration_weeks,
        "cur_learning_goal": cur_learning_goal,
        "required_content": required_content,
        "context": combined_context
    })
    
    return result.model_dump()["curriculum"]


# 과제 템플릿 생성하는 모델
def generate_assignment_template(theme: str, learning_objective: str, assignment_title: str, step_by_step_guide: list[str], expected_output_format: str) -> str:
    ai_model = os.getenv("AI_MODEL", "gpt-5.4-mini")
    llm = ChatOpenAI(model=ai_model, temperature=0.3, api_key=openai_api_key)
    
    structured_llm = llm.with_structured_output(TemplateOutput)

    # ✨ 수정사항: Tiptap 에디터를 쓰지 않고, 순수 HTML 입력 폼을 렌더링하도록 요구사항 변경
    system_prompt = """
    당신은 실무 기반 교육 과제 템플릿(양식)을 제작하는 전문가입니다.
    사용자가 제공한 과제 정보를 바탕으로, 학습자가 직접 값을 입력할 수 있는 직관적인 HTML 입력 폼 템플릿을 생성하세요.
    
    [작성 가이드]
    1. HTML 태그(h3, p, ul, li, table, th, td, div 등)를 적극적으로 사용하여 깔끔하게 구성하세요.
    2. '제출 형태'나 '가이드'에 표 형태의 요약이 필요하다면 반드시 <table> 태그를 사용하여 틀을 만들어주세요. (table 속성에 style="width: 100%; border-collapse: collapse; border: 1px solid #ccc;" 와 th, td에 테두리 스타일을 넣으세요)
    3. 용어 선택(매우 중요): 표의 헤더나 항목을 구분할 때 문맥에 맞지 않는 '채널(Channel)'이라는 단어의 사용을 엄격히 금지합니다.
    4. (★매우 중요) 학습자가 실제로 데이터를 채워넣어야 하는 영역(표 안의 빈칸, 서술형 답변란 등)에는 반드시 다음 형식의 입력 태그를 삽입하세요:
       - 짧은 단답형 텍스트: `<input type="text" class="template-input-text" placeholder="내용을 입력하세요" />`
       - 여러 줄의 서술형 텍스트: `<textarea class="template-input-textarea" placeholder="상세 내용을 입력하세요"></textarea>`
       - 빈 <td></td> 태그만 두지 말고, 반드시 그 안에 입력 태그를 포함하세요.
    5. 코드 블록(```html ... ```) 같은 마크다운 기호 없이, 웹 에디터에 바로 렌더링 가능한 순수 HTML 문자열만 반환하세요.
    """

    user_prompt = f"""
    [과제 정보]
    - 주차 주제: {theme}
    - 학습 목표: {learning_objective}
    - 과제명: {assignment_title}
    - 수행 방법 (가이드): {', '.join(step_by_step_guide)}
    - 제출 형태: {expected_output_format}

    위 정보를 바탕으로 학습자가 바로 내용을 채워넣을 수 있는 과제 양식을 HTML 형식으로 작성해주세요.
    """

    prompt = ChatPromptTemplate.from_messages([
        ("system", system_prompt),
        ("user", user_prompt)
    ])

    chain = prompt | structured_llm
    result = chain.invoke({})
    
    return result.html_content