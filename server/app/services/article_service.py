import json
import logging

from langchain_core.output_parsers import StrOutputParser
from langchain_core.prompts import ChatPromptTemplate
from langchain_openai import ChatOpenAI

from app.core.config import settings

logger = logging.getLogger(__name__)

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
        model="gpt-5.4-mini",
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
    

GENERATION_PROMPT = (
"당신은 비즈니스 전문 에디터입니다. 아래 키워드와 관련된 최신 트렌드와 실무 인사이트를 담은 아티클을 작성하세요.\n"
"반드시 아래 JSON 형식으로만 답하세요.\n\n"
"{{\n"
'  "title": "아티클 제목",\n'
'  "content": "아티클 전체 본문 (최소 1000자 이상)"\n'
"}}\n\n"
"키워드: {keyword}\n"
"언어: 한국어"
)

def create_ai_generated_content(keyword: str) -> dict:
    """키워드를 기반으로 아티클 제목과 본문을 생성합니다."""
    prompt = ChatPromptTemplate.from_template(
        "비즈니스 전문가로서 '{keyword}'에 대한 심층 분석 아티클을 작성하세요. "
        "반드시 JSON 형식으로 응답하세요: {{\"title\": \"제목\", \"content\": \"본문\"}}"
    )
    llm = ChatOpenAI(model="gpt-5.4-mini", api_key=settings.openai_api_key)
    chain = prompt | llm | StrOutputParser()

    try:
        raw = chain.invoke({"keyword": keyword})
        # JSON 문자열 추출 및 파싱
        cleaned = raw.strip().removeprefix("```json").removeprefix("```").removesuffix("```").strip()
        return json.loads(cleaned)
    except Exception as e:
        logger.warning("AI article generation failed: %s", e)
        # 폴백 데이터 반환
        return {
            "title": f"{keyword} 관련 비즈니스 리포트",
            "content": f"{keyword}에 대한 분석 내용이 생성되는 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요."
        }
