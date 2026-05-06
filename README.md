# landfactory

> DBR/HBR 아티클 기반 AI 학습 지원 플랫폼

landfactory는 DBR/HBR 아티클을 기반으로 RAG 검색, AI 결과물 생성, 커리큘럼 관리, 과제 제출, 챗봇 세션 기능을 제공하는 학습 지원 플랫폼입니다.

---

## 핵심 기능

- 아티클 등록 및 조회
- RAG 기반 비즈니스 질문 응답
- AI 결과물 관리
  - summary
  - wordcloud
  - framework
- 커리큘럼 생성 및 관리
- 과제 제출 및 피드백 관리
- 챗봇 세션 / 메시지 관리

---

## 기술 스택

| 영역 | 기술 |
|------|------|
| Frontend | React (Vite) |
| Backend | FastAPI, SQLAlchemy, PyMySQL |
| AI/ML | LangChain, ChromaDB, OpenAI API |
| DB | MySQL |
| Infra | Docker, GitHub |

---

## 프로젝트 구조

```text
landfactory/
├── client/          # React (Vite) 프론트엔드
├── server/          # FastAPI 백엔드
├── ai/              # AI 실험 코드
├── data/            # 로컬 데이터
├── docs/            # 개발 로그 및 문서
├── docker/          # Docker 설정
└── article-lab/     # 아티클 시각화 샌드박스
```

---

## 실행 방법

### 1. 환경변수 설정

```bash
copy server/.env.example server/.env
```

`server/.env` 에 실제 DB 및 OpenAI 값을 입력합니다.

### 2. 백엔드 실행

```bash
cd server
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```

### 3. 프론트엔드 실행

```bash
cd client
npm install
npm run dev
```

### 4. API 문서 확인

- Swagger UI: `http://localhost:8000/docs`
- ReDoc: `http://localhost:8000/redoc`

---

## 현재 서버 도메인

- `users`
- `articles`
- `curriculum`
- `ai_outputs`
- `output_article_refs`
- `task_submissions`
- `chatbot_sessions`
- `chatbot_messages`

---

## 참고

- 실제 작업 로그는 `docs/devlog.md` 에 기록합니다.
- 로컬 ChromaDB 저장소는 `server/chroma_db/` 를 사용합니다.
- `article-lab/` 은 메인 프론트와 분리된 아티클 시각화 실험 폴더입니다.
