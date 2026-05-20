from typing import Optional, List
from langchain_community.vectorstores import Chroma
from langchain_core.documents import Document
from langchain_openai import OpenAIEmbeddings
from langchain_text_splitters import RecursiveCharacterTextSplitter
from app.core.config import settings

_vectorstore: Optional[Chroma] = None

def _get_vectorstore() -> Chroma:
    global _vectorstore
    if _vectorstore is None:
        _vectorstore = Chroma(
            persist_directory=settings.chroma_persist_dir,
            embedding_function=OpenAIEmbeddings(api_key=settings.openai_api_key),
        )
    return _vectorstore

def search_similar_article_ids(query_text: str, k: int = 15) -> List[int]:
    """의미 기반 검색: 제목뿐만 아니라 '원문 내용'을 분석해 관련 ID 반환"""
    vs = _get_vectorstore()
    docs = vs.similarity_search(query_text, k=k)
    
    article_ids = []
    seen = set()
    for d in docs:
        aid = d.metadata.get("article_id")
        if aid and aid not in seen:
            article_ids.append(int(aid))
            seen.add(aid)
    return article_ids

def get_article_content(article_id: int) -> str:
    """DB에 저장된 요약본이 아닌, 벡터 DB에 저장된 '원문 청크' 전체를 가져옴"""
    vs = _get_vectorstore()
    result = vs.get(where={"article_id": article_id})
    if result and result['documents']:
        return "\n\n".join(result['documents'])
    return ""

def ingest_article(article_id: int, title: str, content: str, **kwargs) -> int:
    """새로 생성되거나 수집된 아티클 원문을 청크로 쪼개어 저장"""
    splitter = RecursiveCharacterTextSplitter(chunk_size=600, chunk_overlap=60)
    metadata = {"article_id": article_id, "title": title}
    metadata.update(kwargs)
    
    doc = Document(page_content=content, metadata=metadata)
    chunks = splitter.split_documents([doc])
    _get_vectorstore().add_documents(chunks)
    return len(chunks)


def search_similar_with_scores(query_text: str, k: int = 50) -> list[tuple[int, float, str]]:
    """검색어와 유사한 아티클 ID, 거리(Distance) 점수, 그리고 '요약문 내용'을 반환합니다."""
    vs = _get_vectorstore()
    
    DISTANCE_THRESHOLD = 0.37
    
    docs_and_scores = vs.similarity_search_with_score(query_text, k=k)
    
    results = []
    seen = set()
    for doc, distance in docs_and_scores:
        
        aid = doc.metadata.get("article_id")
        if aid and aid not in seen:
            results.append((int(aid), float(distance), doc.page_content))
            seen.add(aid)
            
    return results