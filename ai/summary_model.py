import os
import torch
import json
import re
from pathlib import Path

from dotenv import load_dotenv
from langchain_chroma import Chroma
from langchain_openai import ChatOpenAI
from langchain_huggingface import HuggingFaceEmbeddings
from langchain_core.prompts import PromptTemplate
from langchain_core.output_parsers import JsonOutputParser
from langchain_core.stores import InMemoryStore
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_classic.retrievers import ParentDocumentRetriever
from langchain_community.vectorstores.utils import filter_complex_metadata
from langchain_community.document_loaders import PyMuPDFLoader

  
# 1. 환경 설정 및 모델 초기화
BASE_DIR = Path(__file__).resolve().parent
PROJECT_DIR = BASE_DIR.parent

load_dotenv(PROJECT_DIR / "server" / ".env")
load_dotenv(PROJECT_DIR / ".env", override=False)

openai_api_key = os.getenv("OPENAI_API_KEY")
if openai_api_key:
    os.environ["OPENAI_API_KEY"] = openai_api_key

device = "cuda" if torch.cuda.is_available() else "cpu"
print(f"🚀 시스템 디바이스: {device.upper()}")


llm = ChatOpenAI(model=os.getenv("AI_MODEL", "gpt-5.4-mini"), temperature=0.2)

# 한국어 특화 임베딩 모델
embeddings = HuggingFaceEmbeddings(
    model_name="jhgan/ko-sroberta-multitask",
    model_kwargs={'device': device},
    encode_kwargs={'normalize_embeddings': True}
)


# 2. 루프를 통한 모든 PDF 개별 처리
data_path = BASE_DIR / "data"
summary_dir = BASE_DIR / "summary"  # ✅ 요약문 저장 폴더 지정

# 💡 요약문을 저장할 폴더가 없다면 새로 생성합니다.
if not os.path.exists(summary_dir):
    os.makedirs(summary_dir)
    print(f"📁 '{summary_dir}' 폴더가 존재하지 않아 새로 생성했습니다.")

pdf_files = [f for f in os.listdir(data_path) if f.endswith('.pdf')]

print(f"📂 총 {len(pdf_files)}개의 아티클을 발견했습니다.")

# 스플리터 초기화
parent_splitter = RecursiveCharacterTextSplitter(chunk_size=1500, chunk_overlap=150)
child_splitter = RecursiveCharacterTextSplitter(chunk_size=300, chunk_overlap=30)

for idx, file_name in enumerate(pdf_files):
    full_path = os.path.join(data_path, file_name)
    print(f"\n[{idx+1}/{len(pdf_files)}] 주제 맞춤형 심층 분석 중: {file_name}")

    try:
        loader = PyMuPDFLoader(full_path)
        raw_docs = loader.load()
        
        # 복잡한 메타데이터 필터링
        docs = filter_complex_metadata(raw_docs)

        # In-memory ChromaDB 생성
        vectorstore = Chroma(embedding_function=embeddings)
        store = InMemoryStore()

        retriever = ParentDocumentRetriever(
            vectorstore=vectorstore,
            docstore=store,
            child_splitter=child_splitter,
            parent_splitter=parent_splitter,
        )
        retriever.add_documents(docs)

        # 3. 주제 맞춤형 심층 분석 프롬프트
        prompt_template = """
        당신은 기업의 OJT 및 인터랙티브 교육 콘텐츠 설계를 위한 최고 수준의 AI 경영 멘토입니다.
        제공된 DBR 아티클을 분석하여, 실무진이 해당 '카테고리(주제)'의 핵심을 완벽히 이해하고 실무에 적용할 수 있도록 심층적인 JSON 데이터를 생성하세요.

        [카드뉴스 및 요약문 작성 제약 사항]
        1. 완벽한 독립성 보장: 원문을 전혀 읽지 않은 사람도 이해할 수 있도록 작성해야 합니다. 
        2. 고유명사 및 개별 사례 일반화: 원문에 등장하는 특정 인물 이름(예: 박 팀장, 김 대리 등)이나 특정 에피소드는 절대 그대로 사용하지 마세요. 대신 '리더', '팀장', '관리자', '신규 입사자'와 같은 보편적인 직명이나 역할로 대체하여 일반적인 상황으로 재작성하세요.
        3. 보편적 메시지 도출: 특정 인물의 개인적인 감정선이나 상황을 묘사하기보다는, 조직 내에서 누구나 공감할 수 있는 보편적인 문제 상황과 해결책의 형태로 문장을 수정하세요.
        4. 부득이하게 원문의 사례를 인용해야 할 경우, 독자가 납득할 수 있도록 해당 사례의 배경(Context)을 짧게 요약하여 문장 앞에 먼저 제시하세요.

        [핵심 지시사항]
        1. 주제 동기화(Category Alignment): 아티클의 주요 카테고리를 DBR의 아티클 카테고리 항목을 참조해서 먼저 정의하고, 모든 요약 내용은 이 '카테고리의 핵심 목적'에 부합하도록 서술하세요.
        2. 키워드 추출: 해당 카테고리 주제를 관통하는 실무 핵심 역량 키워드를 3~4개 추출하세요.
        3. 풍부한 맥락 서술(Detailed Summary): 각 키워드별 설명은 단편적인 요약이 아니라, [현상의 배경] -> [문제 또는 원인] -> [해결책 및 비즈니스적 결과]가 모두 연결된 4~5문장(300자 이상)의 완성된 스토리로 작성하세요.
        
        반드시 다음 JSON 구조를 엄격히 지켜서 출력하세요.
        추가로 사용자가 읽기 편하게 개행이 들엉가야되면 개행을 해서 작성하세요.

        {{
          "metadata": {{
            "title": "아티클 제목",
            "author": "저자 이름",
            "category": "산업/경영 카테고리 (예: 고객 경험 마케팅)"
          }},
          "theme_analysis": "이 아티클이 해당 카테고리 관점에서 왜 중요한지, 실무진이 얻을 수 있는 핵심 비즈니스 가치가 무엇인지 2~3문장으로 요약",
          "card_news": [
            {{
              "card_step": "Card 1",
              "keyword": "카테고리 맞춤형 핵심 키워드 1",
              "card_title": "키워드를 설명하는 매력적인 소제목",
              "core_message": "이 카드가 전달하려는 가장 중요한 1줄 핵심 주장",
              "detailed_summary": "배경, 원인, 결과를 포함한 300자 이상의 풍부한 서술형 맥락 요약"
            }}
            최소 3개에서 최대 4개의 Card 작성하도록
          ],
          "ojt_conclusion": {{
            "title": "💡 실무 적용 가이드",
            "discussion_topic": "해당 카테고리 주제와 직결되는 심도 있는 토론 질문",
            "practice_task": "이론을 실무에 바로 적용해 볼 수 있는 구체적인 미니 실습 과제"
          }}
        }}

        [입력된 아티클]
        {context}
        """

        prompt = PromptTemplate.from_template(prompt_template)
        output_parser = JsonOutputParser()
        
        def format_docs(docs):
            return "\n\n".join(doc.page_content for doc in docs)

        rag_chain = (
            {"context": retriever | format_docs}
            | prompt
            | llm
            | output_parser
        )

        # 분석 실행
        result = rag_chain.invoke("이 문서의 핵심 카테고리를 파악하고, 그 카테고리를 관통하는 3~4개의 핵심 키워드와 전체 맥락을 상세히 추출해줘.")

        # 4. 파일 저장 처리 (summary 폴더에 저장)
        meta = result.get("metadata", {})
        title = meta.get("title", "제목없음")
        author = meta.get("author", "저자없음")
        category = meta.get("category", "미분류")

        # 파일명 생성 및 특수문자 제거
        raw_file_name = f"{title}_{author}_{category}.json"
        clean_file_name = re.sub(r'[\\/*?:"<>|]', "", raw_file_name).strip()
        
        # ✅ 지정된 summary 폴더 경로와 합치기
        save_path = os.path.join(summary_dir, clean_file_name)

        with open(save_path, 'w', encoding='utf-8') as f:
            json.dump(result, f, ensure_ascii=False, indent=4)
        
        print(f"   ✅ 저장 완료: {save_path}")

        # 메모리 정리를 위해 DB 초기화
        vectorstore.delete_collection()

    except Exception as e:
        print(f"   ❌ {file_name} 처리 중 오류 발생: {e}")

print("\n✨ 모든 아티클 분석 및 파일 생성이 완료되었습니다!")
