"""커리큘럼 AI 생성 서비스.

`POST /api/curricula/generate`의 본 로직.
입력(과정명/직무/산업/기간/목표/필수내용)을 받아 LLM으로 주차별 계획을 생성하고
DB 스키마인 cur_week_plan JSON 형식으로 반환한다.

사내 아티클 요약문(`ai/summary/*.json`)을 키워드 매칭으로 검색해
LLM 컨텍스트에 주입한다 (ai/curr.py 패턴).
"""

import json
from pathlib import Path

from langchain_core.output_parsers import StrOutputParser
from langchain_core.prompts import ChatPromptTemplate
from langchain_openai import ChatOpenAI

from app.core.config import settings

# server/app/services/curriculum_service.py → parents[3] = 프로젝트 루트
SUMMARY_DIR = Path(__file__).resolve().parents[3] / "ai" / "summary"

CURRICULUM_PROMPT = (
    "당신은 대기업 HRD(인적자원개발) 교육 담당자이자 S-OJT 설계 전문가입니다.\n"
    "아래 입력과 [참고 자료]를 바탕으로 주차별 OJT 커리큘럼을 생성하세요.\n\n"
    "[입력]\n"
    "- 과정명: {cur_title}\n"
    "- 대상 직무: {cur_target_job}\n"
    "- 대상 산업: {cur_target_industry}\n"
    "- 훈련 기간: {cur_duration_weeks}주\n"
    "- 학습 목표: {cur_learning_goal}\n"
    "- 필수 포함 내용: {required_content}\n\n"
    "[참고 자료 (사내 아티클 요약문)]\n"
    "{articles_context}\n\n"
    "[출력 규칙]\n"
    "- 정확히 {cur_duration_weeks}개의 주차를 생성하세요.\n"
    "- 각 주차마다 아래 필드를 모두 포함하세요:\n"
    "  * week: 주차 번호 (number)\n"
    "  * theme: 해당 주의 핵심 테마/역량 (한 줄)\n"
    "  * learning_objective: \"이 주를 마치면 ~할 수 있다\" 형태의 학습 목적 (한 문장)\n"
    "  * tasks: 실무에서 바로 적용 가능한 산출물 단위 과제 2~3개 (array of string)\n"
    "  * recommended_articles: [참고 자료]에서 이 주차와 관련 있는 자료 0~3개 (array of object)\n"
    "    - filename: 정확히 위 [참고 자료]에 나온 파일명 그대로 (예: \"AI 시대...json\"). 없는 파일명 만들지 마세요.\n"
    "    - title: 아티클 제목\n"
    "    - why_relevant: 이 주차에 왜 관련 있는지 한 문장\n"
    "  * success_criteria: 학습 완료 판정 기준 2~3개 (array of string, 행동 지표 형태)\n"
    "  * estimated_hours: 예상 학습 시간 (number, 보통 4~12)\n"
    "- [참고 자료]가 비어있거나 관련 자료가 없으면 recommended_articles는 빈 배열로 두세요.\n"
    "- 단순 명사 나열이 아닌, 구체적인 행동/산출물을 명시하세요.\n"
    "- 한국어로 작성하세요.\n\n"
    "[출력 형식 — JSON만 출력하세요. 마크다운 코드블록이나 설명은 절대 포함하지 마세요.]\n"
    "[\n"
    '  {{"week": 1, "theme": "...", "learning_objective": "...", '
    '"tasks": ["..."], '
    '"recommended_articles": [{{"filename": "...", "title": "...", "why_relevant": "..."}}], '
    '"success_criteria": ["..."], "estimated_hours": 8}}\n'
    "]\n"
)


def _strip_code_fence(raw: str) -> str:
    cleaned = raw.strip()
    if cleaned.startswith("```"):
        cleaned = cleaned.split("\n", 1)[1] if "\n" in cleaned else cleaned[3:]
    if cleaned.endswith("```"):
        cleaned = cleaned.rsplit("```", 1)[0]
    return cleaned.strip()


def _collect_keywords(*parts: str | None) -> list[str]:
    """입력 문자열들을 공백 split 해서 1자 초과 키워드만 수집."""
    keywords: list[str] = []
    for p in parts:
        if not p:
            continue
        for token in p.split():
            t = token.strip()
            if len(t) > 1:
                keywords.append(t)
    return keywords


def retrieve_articles_context(keywords: list[str], max_articles: int = 5) -> tuple[str, list[str]]:
    """`ai/summary/*.json` 파일 중 키워드가 본문에 포함된 것들을 수집.

    Returns:
        (context_text, matched_filenames):
          context_text — LLM 프롬프트에 주입할 텍스트 (파일별로 구분)
          matched_filenames — 매칭된 파일명 리스트 (환각 필터링용)
    """
    if not SUMMARY_DIR.exists() or not keywords:
        return "", []

    keywords_lower = [k.lower() for k in keywords]
    matched: list[tuple[str, str]] = []

    for json_file in sorted(SUMMARY_DIR.glob("*.json")):
        try:
            content = json_file.read_text(encoding="utf-8")
        except Exception:
            continue
        content_lower = content.lower()
        if any(k in content_lower for k in keywords_lower):
            matched.append((json_file.name, content))

    matched = matched[:max_articles]
    if not matched:
        return "", []

    parts = [f"### 파일명: {name}\n{content}" for name, content in matched]
    filenames = [name for name, _ in matched]
    return "\n\n---\n\n".join(parts), filenames


def _normalize_week(week: dict, matched_filenames: set[str]) -> dict:
    """LLM 응답의 한 주차 dict를 정리.

    - 누락 필드 기본값 채움
    - recommended_articles 중 실제 디스크에 없는 filename 제거 (환각 방지)
    """
    week.setdefault("tasks", [])
    week.setdefault("recommended_articles", [])
    week.setdefault("success_criteria", [])

    recs = week.get("recommended_articles")
    if isinstance(recs, list):
        week["recommended_articles"] = [
            r for r in recs
            if isinstance(r, dict) and r.get("filename") in matched_filenames
        ]
    else:
        week["recommended_articles"] = []
    return week


def generate_week_plan(
    cur_title: str,
    cur_duration_weeks: int,
    cur_target_job: str | None = None,
    cur_target_industry: str | None = None,
    cur_learning_goal: str | None = None,
    required_content: str | None = None,
) -> list[dict]:
    """LLM으로 주차별 커리큘럼을 생성해 cur_week_plan 형식의 리스트로 반환."""
    keywords = _collect_keywords(
        cur_title,
        cur_target_job,
        cur_target_industry,
        cur_learning_goal,
        required_content,
    )
    articles_context, matched_filenames = retrieve_articles_context(keywords)

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
        "articles_context": articles_context or "(매칭되는 사내 아티클이 없습니다)",
    })

    cleaned = _strip_code_fence(raw)
    parsed = json.loads(cleaned)
    if not isinstance(parsed, list):
        raise ValueError("LLM 응답이 list가 아닙니다.")

    matched_set = set(matched_filenames)
    return [_normalize_week(w, matched_set) for w in parsed if isinstance(w, dict)]
