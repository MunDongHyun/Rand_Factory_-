# landfactory

DBR/HBR 아티클 기반 AI 학습 지원 플랫폼입니다.

landfactory는 DBR/HBR 아티클을 기반으로 아티클 조회, RAG 질의응답, AI 결과물 관리, 커리큘럼 관리, 과제 제출, 챗봇 세션 기능을 제공하는 학습 지원 서비스입니다.

## 주요 기능

- 로그인 / 회원가입 / JWT 세션 복원
- 역할 기반 화면 분기
  - `j`: 학습자
  - `m`: 매니저
  - `a`: 관리자
- Dashboard 아티클 목록 조회
- 아티클 상세 화면
- RAG 기반 비즈니스 질문 응답
- AI 결과물 관리
  - summary
  - wordcloud
  - framework
- 커리큘럼 생성 및 조회
- 과제 제출 및 피드백
- 챗봇 세션 / 메시지 관리
- 401 응답 시 프론트 자동 로그아웃

## 기술 스택

| 영역 | 기술 |
|------|------|
| Frontend | React, Vite, Axios |
| Backend | FastAPI, SQLAlchemy, PyMySQL |
| AI/RAG | LangChain, ChromaDB, OpenAI API |
| DB | MySQL |
| Infra | Docker, GitHub |

## 프로젝트 구조

```text
landfactory/
├─ client/                    # React (Vite) 프론트엔드
│  ├─ src/
│  │  ├─ components/           # 화면 컴포넌트
│  │  ├─ lib/                  # API/auth 공통 모듈
│  │  ├─ styles/               # 화면별 스타일
│  │  └─ public/               # 화면 이미지 리소스
│  ├─ package.json
│  └─ vite.config.js
├─ server/                    # FastAPI 백엔드
│  ├─ app/
│  │  ├─ main.py
│  │  ├─ core/                 # 설정, DB, 보안
│  │  ├─ models/               # SQLAlchemy ORM 모델
│  │  ├─ schemas/              # Pydantic 요청/응답 스키마
│  │  ├─ routers/              # API 라우터
│  │  └─ services/             # 비즈니스 로직, AI/RAG 로직
│  ├─ scripts/                 # PDF 인제스트 등 보조 스크립트
│  ├─ requirements.txt
│  └─ .env.example
├─ ai/                        # 실험용 AI 모델링 코드 및 산출물
│  ├─ curr.py
│  ├─ summary_model.py
│  ├─ requirements.txt
│  ├─ summary/
│  └─ curriculum_output/
├─ docs/                      # 작업 로그 및 프로젝트 문서
├─ docker/                    # Docker 설정
├─ CLAUDE.md                  # 협업 규칙 및 개발 체크리스트
└─ README.md
```

## 현재 서버 구조

### 핵심 테이블

- `users`
- `articles`
- `curriculum`
- `ai_outputs`
- `output_article_refs`
- `task_submissions`
- `chatbot_sessions`
- `chatbot_messages`

### 현재 라우터

- `user`
- `article`
- `rag`
- `curriculum`
- `ai_output`
- `chatbot`
- `task_submission`
- `health`

### 현재 기준이 아닌 예전 구조

아래 멘토링 중심 구조는 현재 서버 기준이 아닙니다.

- `mentor`
- `mentoring`
- `point`
- `framework`
- `chat`

## 개발 환경 설정

### 1. 백엔드 실행

```bash
cd server
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
copy .env.example .env
uvicorn app.main:app --reload
```

`server/.env`에는 실제 DB, OpenAI, SECRET_KEY 값을 입력합니다.

### 2. 프론트엔드 실행

```bash
cd client
npm install
npm run dev
```

### 3. 프론트엔드 빌드 확인

```bash
cd client
npm run build
```

### 4. API 문서 확인

- Swagger UI: `http://localhost:8000/docs`
- ReDoc: `http://localhost:8000/redoc`

## 환경변수

`server/.env.example`을 복사해 `server/.env`를 만들고 실제 값을 채웁니다.

주요 변수:

- `OPENAI_API_KEY`: OpenAI API 키
- `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`: MySQL 접속 정보
- `SECRET_KEY`: JWT 서명 키
- `CHROMA_PERSIST_DIR`: ChromaDB 저장 경로
- `AI_MODEL`: 실험용 AI 스크립트에서 사용할 모델명

주의:

- `.env`, `.env.test`는 커밋하지 않습니다.
- 실제 DB 비밀번호나 API 키는 문서에 적지 않습니다.

## 검증 명령

백엔드:

```bash
cd server
.\venv\Scripts\python.exe -m compileall -q app
```

프론트엔드:

```bash
cd client
npm run build
```

## 작업 로그

실제 작업 기록과 결정 사항은 `docs/devlog.md`에 남깁니다.

팀 협업 규칙, 브랜치 전략, 커밋 전 체크리스트는 `CLAUDE.md`를 기준으로 확인합니다.
