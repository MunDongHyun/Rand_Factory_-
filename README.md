# landfactory

> DBR 아티클 기반 RAG 멘토링 플랫폼

DBR(동아비즈니스리뷰) 아티클을 벡터 DB에 임베딩하고, LangChain RAG 파이프라인을 통해  
사용자의 비즈니스 질문에 근거 있는 멘토링 답변을 제공하는 플랫폼입니다.

---

## 기술 스택

| 영역 | 기술 |
|------|------|
| Frontend | React (Vite), Chart.js, React-Wordcloud, html2pdf.js |
| Backend | FastAPI (Python 3.11+) |
| AI/ML | LangChain, FAISS / ChromaDB, OpenAI API |
| DB | MySQL |
| Infra | Docker, GitHub |

---

## 프로젝트 구조

```
landfactory/
├── client/          # React (Vite) 프론트엔드
├── server/          # FastAPI 백엔드
├── ai/              # LangChain RAG 파이프라인
├── data/            # 로컬 데이터 (git 제외)
├── docs/            # 기획서, 분석 정의서 등 문서
└── docker/          # Docker 설정 파일
```

---

## 실행 방법

### 1. 환경 변수 설정

```bash
cp server/.env.example server/.env
# server/.env 파일을 열어 실제 값으로 수정
```

### 2. Docker로 전체 실행

```bash
cd docker
docker-compose up --build
```

### 3. 개별 실행 (개발)

**Backend**
```bash
cd server
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```

**Frontend**
```bash
cd client
npm install
npm run dev
```

---

## 팀원 역할

| 이름 | 역할 |
|------|------|
| - | PM / AI Modeling (LangChain, RAG 파이프라인) |
| - | DB 설계 및 관리 (MySQL 스키마, 쿼리 최적화) |
| - | Frontend 개발 (React, 시각화) |
| - | Backend 개발 (FastAPI, API 설계) |

---

## API 문서

서버 실행 후 아래 URL에서 자동 생성된 API 문서 확인:
- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc
