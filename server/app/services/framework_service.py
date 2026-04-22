"""
프레임워크 생성 서비스
RAG로 관련 아티클 검색 → LLM으로 프레임워크 JSON 생성
"""

import json

from langchain_core.output_parsers import StrOutputParser
from langchain_core.prompts import ChatPromptTemplate
from langchain_openai import ChatOpenAI

from app.core.config import settings
from app.services.rag_service import _get_vectorstore

PROMPTS = {
    "OKR": (
        "OKR 프레임워크를 작성해줘.\n"
        "반드시 아래 JSON 형식으로만 답해.\n"
        '{{"objective": "달성 목표", "key_results": [{{"kr": "측정 지표", "target": "목표값"}}]}}\n\n'
        "참고 아티클:\n{context}\n\n상황: {user_input}"
    ),
    "AARRR": (
        "AARRR 퍼널 프레임워크를 작성해줘.\n"
        "반드시 아래 JSON 형식으로만 답해.\n"
        '{{"acquisition": "유입 전략", "activation": "활성화 전략", '
        '"retention": "유지 전략", "revenue": "수익화 전략", "referral": "추천 전략"}}\n\n'
        "참고 아티클:\n{context}\n\n상황: {user_input}"
    ),
    "JTBD": (
        "Jobs To Be Done 프레임워크를 작성해줘.\n"
        "반드시 아래 JSON 형식으로만 답해.\n"
        '{{"job": "핵심 과업", "circumstances": "상황 맥락", '
        '"desired_outcome": "원하는 결과", "obstacles": "주요 장애물", "solutions": "해결 방안"}}\n\n'
        "참고 아티클:\n{context}\n\n상황: {user_input}"
    ),
    "Flywheel": (
        "Flywheel 성장 모델을 작성해줘.\n"
        "반드시 아래 JSON 형식으로만 답해.\n"
        '{{"stages": [{{"name": "단계명", "action": "실행 내용", "outcome": "기대 성과"}}]}}\n\n'
        "참고 아티클:\n{context}\n\n상황: {user_input}"
    ),
    "린캔버스": (
        "린 캔버스를 작성해줘.\n"
        "반드시 아래 JSON 형식으로만 답해.\n"
        '{{"problem": "문제", "solution": "해결책", "unique_value": "고유 가치 제안", '
        '"customer_segments": "고객군", "channels": "채널", "revenue_streams": "수익원", '
        '"cost_structure": "비용 구조", "key_metrics": "핵심 지표", "unfair_advantage": "경쟁 우위"}}\n\n'
        "참고 아티클:\n{context}\n\n상황: {user_input}"
    ),
}

DEFAULT_PROMPT = (
    "아래 상황에 맞는 비즈니스 프레임워크를 작성해줘.\n"
    "반드시 JSON 형식으로만 답해.\n\n"
    "참고 아티클:\n{context}\n\n상황: {user_input}"
)


def generate_framework(framework_type: str, user_input: str) -> tuple[dict, list[int]]:
    """프레임워크 생성. (generated_content, referenced_article_ids) 반환."""
    vs = _get_vectorstore()
    retriever = vs.as_retriever(search_kwargs={"k": 4})
    docs = retriever.invoke(user_input)

    context = "\n\n".join(d.page_content for d in docs)
    referenced_ids = list({
        d.metadata["article_id"]
        for d in docs
        if "article_id" in d.metadata
    })

    template = PROMPTS.get(framework_type, DEFAULT_PROMPT)
    prompt = ChatPromptTemplate.from_template(template)
    llm = ChatOpenAI(
        model="gpt-4o-mini",
        temperature=0.3,
        api_key=settings.openai_api_key,
    )
    chain = prompt | llm | StrOutputParser()
    raw = chain.invoke({"context": context, "user_input": user_input})

    # JSON 파싱 — 마크다운 코드블록 제거 후 시도
    cleaned = raw.strip().removeprefix("```json").removeprefix("```").removesuffix("```").strip()
    try:
        content = json.loads(cleaned)
    except json.JSONDecodeError:
        content = {"raw": cleaned}

    return content, referenced_ids
