"""
RAG 서비스 — article 등록 시 ingest, 질문 시 검색+생성
vectorstore는 모듈 레벨 싱글톤으로 관리 (요청마다 재생성 방지)
"""

from typing import Optional

from langchain_community.vectorstores import Chroma
from langchain_core.output_parsers import StrOutputParser
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.documents import Document
from langchain_openai import ChatOpenAI, OpenAIEmbeddings
from langchain_text_splitters import RecursiveCharacterTextSplitter

from app.core.config import settings

_vectorstore: Optional[Chroma] = None


def _get_embeddings() -> OpenAIEmbeddings:
    return OpenAIEmbeddings(api_key=settings.openai_api_key)


def _get_vectorstore() -> Chroma:
    global _vectorstore
    if _vectorstore is None:
        _vectorstore = Chroma(
            persist_directory=settings.chroma_persist_dir,
            embedding_function=_get_embeddings(),
        )
    return _vectorstore


def get_article_content(article_id: int, max_chunks: int = 20) -> str:
    """특정 article_id의 청크들을 ChromaDB에서 가져와 하나의 텍스트로 합쳐 반환."""
    docs = _get_vectorstore().similarity_search("", k=max_chunks, filter={"article_id": article_id})
    return "\n\n".join(doc.page_content for doc in docs)


def ingest_article(
    article_id: int,
    title: str,
    content: str,
    category: Optional[str] = None,
    author: Optional[str] = None,
) -> int:
    """아티클 본문을 청크 분할 후 ChromaDB에 저장. 저장된 청크 수 반환."""
    splitter = RecursiveCharacterTextSplitter(chunk_size=500, chunk_overlap=50)
    doc = Document(
        page_content=content,
        metadata={
            "article_id": article_id,
            "title": title,
            "category": category or "",
            "author": author or "",
        },
    )
    chunks = splitter.split_documents([doc])
    _get_vectorstore().add_documents(chunks)
    return len(chunks)


def query_rag(question: str, k: int = 4) -> dict:
    """질문을 받아 관련 청크 검색 후 LLM 답변 생성. answer와 sources 반환."""
    vs = _get_vectorstore()
    retriever = vs.as_retriever(search_kwargs={"k": k})
    raw_docs = retriever.invoke(question)

    context = "\n\n".join(doc.page_content for doc in raw_docs)

    prompt = ChatPromptTemplate.from_template(
        "당신은 DBR 아티클 기반 비즈니스 멘토링 AI입니다.\n"
        "아래 아티클 내용을 참고해서 질문에 답하세요. "
        "모르면 '관련 아티클을 찾을 수 없습니다'라고 말하세요.\n\n"
        "참고 내용:\n{context}\n\n"
        "질문: {question}\n\n"
        "답변:"
    )
    llm = ChatOpenAI(
        model="gpt-4o-mini",
        temperature=0.3,
        api_key=settings.openai_api_key,
    )

    chain = prompt | llm | StrOutputParser()

    answer = chain.invoke({
        "context": context,
        "question": question,
    })

    # 참조 아티클 메타데이터 수집 (중복 제거)
    seen = set()
    sources = []
    for doc in raw_docs:
        aid = doc.metadata.get("article_id")
        if aid and aid not in seen:
            seen.add(aid)
            sources.append({
                "article_id": aid,
                "title": doc.metadata.get("title", ""),
            })

    return {"answer": answer, "sources": sources}
