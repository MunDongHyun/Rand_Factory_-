"""커리큘럼 AI 생성 서비스.

`POST /api/curricula/generate`의 본 로직.
입력(과정명/직무/산업/기간/목표/필수내용)을 받아 LLM으로 주차별 계획을 생성하고
DB 스키마인 cur_week_plan JSON 형식으로 반환한다.
"""

import json

from langchain_core.output_parsers import StrOutputParser
from langchain_core.prompts import ChatPromptTemplate
from langchain_openai import ChatOpenAI

from app.core.config import settings

CURRICULUM_PROMPT = (
    "당신은 대기업 HRD(인적자원개발) 교육 담당자이자 S-OJT 설계 전문가입니다.\n"
    "아래 입력을 바탕으로 주차별 OJT 커리큘럼을 생성하세요.\n\n"
    "[입력]\n"
    "- 과정명: {cur_title}\n"
    "- 대상 직무: {cur_target_job}\n"
    "- 대상 산업: {cur_target_industry}\n"
    "- 훈련 기간: {cur_duration_weeks}주\n"
    "- 학습 목표: {cur_learning_goal}\n"
    "- 필수 포함 내용: {required_content}\n\n"
    "[출력 규칙]\n"
    "- 정확히 {cur_duration_weeks}개의 주차를 생성하세요.\n"
    "- 각 주차의 theme은 해당 주의 핵심 테마/역량을 한 줄로 표현하세요.\n"
    "- 각 주차의 tasks는 실무에서 바로 적용 가능한 산출물 단위 과제 2~3개로 작성하세요.\n"
    "- 단순 명사 나열이 아닌, 구체적인 행동/산출물을 명시하세요.\n"
    "- 한국어로 작성하세요.\n\n"
    "[출력 형식 — JSON만 출력하세요. 마크다운 코드블록이나 설명은 절대 포함하지 마세요.]\n"
    "[\n"
    '  {{"week": 1, "theme": "1주차 테마", "tasks": ["과제1", "과제2"]}},\n'
    '  {{"week": 2, "theme": "2주차 테마", "tasks": ["과제1", "과제2"]}}\n'
    "]\n"
)


def _strip_code_fence(raw: str) -> str:
    cleaned = raw.strip()
    if cleaned.startswith("```"):
        cleaned = cleaned.split("\n", 1)[1] if "\n" in cleaned else cleaned[3:]
    if cleaned.endswith("```"):
        cleaned = cleaned.rsplit("```", 1)[0]
    return cleaned.strip()


def generate_week_plan(
    cur_title: str,
    cur_duration_weeks: int,
    cur_target_job: str | None = None,
    cur_target_industry: str | None = None,
    cur_learning_goal: str | None = None,
    required_content: str | None = None,
) -> list[dict]:
    """LLM으로 주차별 커리큘럼을 생성해 cur_week_plan 형식의 리스트로 반환."""
    prompt = ChatPromptTemplate.from_template(CURRICULUM_PROMPT)
    llm = ChatOpenAI(
        model=settings.ai_model,
        temperature=0.2,
        api_key=settings.openai_api_key,
    )
    chain = prompt | llm | StrOutputParser()

    raw = chain.invoke({
        "cur_title": cur_title,
        "cur_target_job": cur_target_job or "(미지정)",
        "cur_target_industry": cur_target_industry or "(미지정)",
        "cur_duration_weeks": cur_duration_weeks,
        "cur_learning_goal": cur_learning_goal or "(미지정)",
        "required_content": required_content or "(없음)",
    })

    cleaned = _strip_code_fence(raw)
    parsed = json.loads(cleaned)
    if not isinstance(parsed, list):
        raise ValueError("LLM 응답이 list가 아닙니다.")
    return parsed
