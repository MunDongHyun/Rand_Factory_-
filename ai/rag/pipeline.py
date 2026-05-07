"""
RAG 파이프라인 — DBR 아티클 기반 멘토링 답변 생성

흐름:
  1. [Ingest]   DBR 아티클 텍스트 로드 → 청크 분할
  2. [Embed]    OpenAI Embeddings로 벡터 변환 → 벡터 DB 저장
  3. [Retrieve] 사용자 질문 임베딩 → 유사 청크 k개 검색
  4. [Generate] 검색된 컨텍스트 + 질문을 프롬프트에 주입 → LLM 답변 생성
"""

from langchain_openai import ChatOpenAI, OpenAIEmbeddings
from langchain_community.vectorstores import Chroma  # or FAISS
from langchain.text_splitter import RecursiveCharacterTextSplitter
from langchain.chains import RetrievalQA
from langchain.schema import Document
from typing import List


# ── 1. 문서 청크 분할 ──────────────────────────────────────────────
def split_documents(docs: List[Document]) -> List[Document]:
    splitter = RecursiveCharacterTextSplitter(
        chunk_size=500,
        chunk_overlap=50,
    )
    return splitter.split_documents(docs)


# ── 2. 벡터 DB 생성 / 로드 ────────────────────────────────────────
def build_vectorstore(chunks: List[Document], persist_dir: str = "./chroma_db") -> Chroma:
    embeddings = OpenAIEmbeddings()
    vectorstore = Chroma.from_documents(
        documents=chunks,
        embedding=embeddings,
        persist_directory=persist_dir,
    )
    return vectorstore


def load_vectorstore(persist_dir: str = "./chroma_db") -> Chroma:
    embeddings = OpenAIEmbeddings()
    return Chroma(persist_directory=persist_dir, embedding_function=embeddings)


# ── 3 & 4. 검색 + 생성 체인 ──────────────────────────────────────
def build_rag_chain(vectorstore: Chroma) -> RetrievalQA:
    llm = ChatOpenAI(model="gpt-4o-mini", temperature=0.3)
    retriever = vectorstore.as_retriever(search_kwargs={"k": 4})

    chain = RetrievalQA.from_chain_type(
        llm=llm,
        retriever=retriever,
        return_source_documents=True,  # 출처 아티클 반환
    )
    return chain


# ── 실행 진입점 (테스트용) ────────────────────────────────────────
if __name__ == "__main__":
    vs = load_vectorstore()
    chain = build_rag_chain(vs)
    result = chain.invoke({"query": "스타트업의 피벗 전략에 대해 알려줘"})
    print(result["result"])
