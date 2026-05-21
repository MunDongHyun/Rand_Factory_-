from typing import Optional, List
from langchain_community.vectorstores import Chroma
from langchain_core.documents import Document
from fastapi import HTTPException
from langchain_openai import OpenAIEmbeddings, ChatOpenAI
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


def transform_query_for_search(user_query: str) -> str:
    """사용자의 검색어를 벡터 검색에 최적화된 형태로 재작성합니다."""
    llm = ChatOpenAI(model="gpt-5.4-mini", temperature=0, api_key=settings.openai_api_key)
    
    prompt = f"""
    당신은 RAG 시스템의 검색 도우미입니다. 사용자의 검색어를 벡터 DB 검색에 최적화된 형태로 재작성해주세요.

    [지침]
    1. [단어/짧은 명사형 검색어] (예: '물', '팀장')
       - 입력된 단어의 '본래 의미'를 명확히 고정하세요.
       - 특히 한 글자 단어(예: '물')의 경우, 다른 단어(예: '물류', '물건')와 벡터 공간에서 혼동되지 않도록 핵심 동의어나 영단어를 괄호 없이 덧붙이세요. 
         (예시: '물' -> '물, Water, 식수, 액체')
       - 의미를 명확히 하는 목적 외에 불필요한 확장은 피하세요.
       
    2. [문장/질문형 검색어] (예: '처음 겪는 상황에서 팀원을 안정시키는 팀장의 자세')
       - 문장의 숨은 의도와 핵심 상황을 분석하여 '위기 관리', '심리적 안전감' 등 해당 상황을 관통하는 전문적인 키워드로 변환하세요.
       
    3. [부적절한 검색어 필터링] 🚨
       - 욕설, 혐오 표현, 성적 비하, 폭력적이거나 사회적으로 부적절한 단어가 포함된 경우 절대 해석하거나 변환하지 말고 오직 "INAPPROPRIATE_QUERY"라고만 출력하세요.
       
    4. [무의미한 검색어 차단]
       - 'ㄹㄴㄻㅇㅁ', 'ㅋㅋㅋ', 의미 없는 알파벳 나열, 단순 오타 등은 절대 해석하지 말고 오직 "INVALID_QUERY"만 출력하세요.
       
    5. 출력 규칙
       - 부가 설명, 인사말 없이 오직 최종 검색어(또는 INVALID_QUERY, INAPPROPRIATE_QUERY)만 깔끔하게 출력하세요.

    사용자 검색어: {user_query}
    """
    
    try:
        response = llm.invoke(prompt)
        transformed_query = response.content.strip()
        print(f"\n🔄 [Query Transform] 원본: '{user_query}' -> 변환: '{transformed_query}'")
        return transformed_query
    except Exception as e:
        print(f"\n⚠️ [Query Transform Error] 변환 실패, 원본 검색어로 진행합니다. ({e})")
        return user_query


def search_similar_article_ids(query_text: str, k: int = 100, max_results: int = 10) -> List[int]:
    vs = _get_vectorstore()
    DISTANCE_THRESHOLD = 0.355  
    
    optimized_query = transform_query_for_search(query_text)
    
    # 🌟 무의미한 검색어 및 부적절한 단어 차단 로직
    if optimized_query == "INVALID_QUERY":
        print(f"무의미한 검색어로 판단되어 벡터 검색을 건너뜁니다.")
        return []
    if optimized_query == "INAPPROPRIATE_QUERY":
        print(f"부적절한 단어 감지됨 (검색 차단)")
        raise HTTPException(
            status_code=400,
            detail="적절하지 못한 단어로 검색을 하셨습니다 검색어를 다시 입력해주세요"
        )
        return []

    docs_and_scores = vs.similarity_search_with_score(optimized_query, k=k)
    
    top_candidates = []
    seen = set()
    for doc, distance in docs_and_scores:
        aid = doc.metadata.get("article_id")
        if aid and aid not in seen:
            top_candidates.append((int(aid), float(distance)))
            seen.add(aid)
            if len(top_candidates) >= max_results: 
                break
                
    print(f"\n🔍 검색어: '{query_text}' (터미널 확인용 상위 {len(top_candidates)}개)")
    for aid, dist in top_candidates:
        print(f"  - 아티클 ID: {aid} | 거리(Distance): {dist:.4f}")
    print("-" * 40)

    article_ids = []
    for aid, dist in top_candidates:
        if dist < DISTANCE_THRESHOLD:
            article_ids.append(aid)
            
    return article_ids


def get_article_content(article_id: int) -> str:
    vs = _get_vectorstore()
    result = vs.get(where={"article_id": article_id})
    if result and result['documents']:
        return "\n\n".join(result['documents'])
    return ""


def ingest_article(article_id: int, title: str, content: str, **kwargs) -> int:
    splitter = RecursiveCharacterTextSplitter(chunk_size=600, chunk_overlap=60)
    metadata = {"article_id": article_id, "title": title}
    metadata.update(kwargs)
    
    doc = Document(page_content=content, metadata=metadata)
    chunks = splitter.split_documents([doc])
    _get_vectorstore().add_documents(chunks)
    return len(chunks)


def search_similar_with_scores(query_text: str, k: int = 100, max_results: int = 10) -> list[tuple[int, float, str]]:
    vs = _get_vectorstore()
    DISTANCE_THRESHOLD = 0.355
    
    optimized_query = transform_query_for_search(query_text)
    
    # 🌟 무의미한 검색어 및 부적절한 단어 차단 로직
    if optimized_query == "INVALID_QUERY":
        print(f"무의미한 검색어로 판단되어 벡터 검색을 건너뜁니다.")
        return []
    if optimized_query == "INAPPROPRIATE_QUERY":
        print(f"부적절한 단어 감지됨 (검색 차단)")
        raise HTTPException(
            status_code=400,
            detail="적절하지 못한 단어로 검색을 하셨습니다 검색어를 다시 입력해주세요"
        )
        return []

    docs_and_scores = vs.similarity_search_with_score(optimized_query, k=k)
    
    top_candidates = []
    seen = set()
    for doc, distance in docs_and_scores:
        aid = doc.metadata.get("article_id")
        if aid and aid not in seen:
            top_candidates.append((int(aid), float(distance), doc.page_content))
            seen.add(aid)
            if len(top_candidates) >= max_results:
                break
                
    print(f"\n🔍 검색어: '{query_text}' (터미널 확인용 상위 {len(top_candidates)}개)")
    for aid, dist, _ in top_candidates:
        print(f"  - 아티클 ID: {aid} | 거리(Distance): {dist:.4f}")
    print("-" * 40)

    results = []
    for aid, dist, content in top_candidates:
        if dist < DISTANCE_THRESHOLD:
            results.append((aid, dist, content))
            
    return results