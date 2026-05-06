import json

from langchain_core.output_parsers import StrOutputParser
from langchain_core.prompts import ChatPromptTemplate
from langchain_openai import ChatOpenAI

from app.core.config import settings

INSIGHTS_PROMPT = (
    "아래 아티클 본문을 분석해서 핵심 인사이트를 추출해줘.\n"
    "반드시 아래 JSON 형식으로만 답해. 다른 설명 없이 JSON만.\n\n"
    "{{\n"
    '  "keywords": ["키워드1", "키워드2", "키워드3", "키워드4", "키워드5"],\n'
    '  "insights": [\n'
    "    {{\n"
    '      "title": "인사이트 제목",\n'
    '      "description": "2-3문장 설명",\n'
    '      "actions": ["실무 액션1", "실무 액션2", "실무 액션3"]\n'
    "    }}\n"
    "  ]\n"
    "}}\n\n"
    "규칙:\n"
    "- keywords는 정확히 5개\n"
    "- insights는 keywords와 같은 순서로 5개\n"
    "- actions는 각 인사이트당 3개, 실무자가 바로 적용할 수 있는 구체적인 행동\n"
    "- 한국어로 작성\n\n"
    "아티클 제목: {title}\n\n"
    "아티클 본문:\n{content}"
)


def extract_insights(title: str, content: str) -> dict:
    """아티클 본문에서 keywords와 insights를 LLM으로 추출."""
    prompt = ChatPromptTemplate.from_template(INSIGHTS_PROMPT)
    llm = ChatOpenAI(
        model="gpt-4o-mini",
        temperature=0.2,
        api_key=settings.openai_api_key,
    )
    chain = prompt | llm | StrOutputParser()

    # 본문이 너무 길면 앞 4000자만 사용
    truncated = content[:4000] if len(content) > 4000 else content

    raw = chain.invoke({"title": title, "content": truncated})
    cleaned = (
        raw.strip()
        .removeprefix("```json")
        .removeprefix("```")
        .removesuffix("```")
        .strip()
    )

    try:
        return json.loads(cleaned)
    except json.JSONDecodeError:
        return {"keywords": [], "insights": [], "error": cleaned}
