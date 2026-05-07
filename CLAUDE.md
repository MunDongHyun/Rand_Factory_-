# landfactory

DBR/HBR 아티클 기반 AI 학습 지원 플랫폼입니다.

## 프로젝트 구조

```text
landfactory/
├─ client/               # React (Vite) 프론트엔드
├─ server/               # FastAPI 백엔드
│  ├─ app/
│  │  ├─ main.py
│  │  ├─ core/           # 설정, DB, 보안
│  │  ├─ models/         # SQLAlchemy ORM 모델
│  │  ├─ schemas/        # Pydantic 요청/응답 스키마
│  │  ├─ routers/        # API 라우터
│  │  └─ services/       # 비즈니스 로직, AI/RAG 로직
│  ├─ requirements.txt
│  ├─ .env.example
│  └─ chroma_db/         # ChromaDB 로컬 저장소
├─ ai/                   # 실험용 AI 코드
├─ data/                 # 로컬 데이터
├─ docs/                 # 작업 로그 및 문서
├─ docker/               # Docker 설정
└─ article-lab/          # 아티클 시각화 테스트 샌드박스
```

## 기술 스택

- Frontend: React (Vite)
- Backend: FastAPI, SQLAlchemy, PyMySQL
- AI/ML: LangChain, ChromaDB, OpenAI API
- DB: MySQL
- Infra: Docker, GitHub

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

### 제거된 예전 구조

아래 멘토링 중심 구조는 더 이상 현재 기준이 아닙니다.

- `mentor`
- `mentoring`
- `point`
- `framework`
- `chat`

## 개발 환경 설정

```bash
# backend
cd server
python -m venv venv
venv/Scripts/activate
pip install -r requirements.txt
copy .env.example .env
uvicorn app.main:app --reload

# frontend
cd client
npm install
npm run dev
```

## 작업 원칙

- Python 코드는 `snake_case` 사용
- 새 API 추가 시 `models / schemas / routers / services / main.py` 등록 여부까지 확인
- 정적 경로(`/me`, `/categories`)는 동적 경로(`/{id}`)보다 먼저 선언
- 환경변수는 `app/core/config.py`의 `settings` 객체를 통해서만 접근
- 진행 상황과 결정 사항은 `docs/devlog.md`에 기록
- 기능 변경과 무관한 스타일 수정은 피함
  - 예: 작은따옴표를 큰따옴표로 바꾸기, 의미 없는 공백/줄바꿈 정리
  - 포맷팅만 필요한 경우 별도 `style:` 커밋으로 분리
- 충돌 해결 시에는 필요한 코드만 선택하고, 기존 코드 스타일은 최대한 유지

## 권한 정책

`user_role` 값은 `j` / `m` / `a` 세 종류이며, 라우터에서 역할별로 접근 범위를 제한합니다.

| Role | 의미 | 접근 범위 |
|------|------|----------|
| `j` | 학습자 (junior) | 본인이 제출한 과제, 본인이 배정된 커리큘럼만 조회 |
| `m` | 매니저 (manager) | 본인이 만든 커리큘럼 생성/수정, 본인 커리큘럼의 과제 피드백, 챗봇 사용 |
| `a` | 관리자 (admin) | 전체 접근, 아티클 등록 전담 |

운영 규칙:

- `POST /api/users/signup`은 `j`만 자유 가입. `m`/`a` 계정은 DB에서 `user_role` 직접 변경으로 운영
- 새 라우터 추가 시 위 정책 기준으로 역할 체크 필수
- 권한 없는 ID 접근은 403 대신 404로 숨김 (정보 노출 방지)
- 챗봇(`/api/chatbot/*`)은 매니저(`m`/`a`) 전용, 학습자는 사용 불가

## 주의사항

- `.env`는 커밋하지 않음
- `venv/`, `server/chroma_db/`, 로컬 테스트 산출물은 커밋하지 않음
- 현재 DB는 팀원에게 받은 MySQL 계정을 사용 중이며 실제 값은 `server/.env` 참고
- `SECRET_KEY` 환경변수 필수 (기본값 없음, `.env`에 없으면 앱 시작 실패)
- 인증은 JWT 기반이며 `user_deleted_at is NULL`인 사용자만 유효 사용자로 취급
- `bcrypt==4.0.1` 유지 (`passlib 1.7.4` 호환 이슈 방지)
- 테스트 시 `user_id` 하드코딩보다 `/api/users/me` 기준 확인 우선

## 코드 컨벤션

- Python: `snake_case`
- API 라우터는 `app/routers/`에 기능별로 분리
- 환경변수는 `app/core/config.py`의 `settings` 객체를 통해서만 접근

## 브랜치 전략

- `main` — 발표용 최종 코드 (직접 push 금지, dev에서 머지만)
- `dev` — 개발 메인 브랜치
- `feature/기능명` — 각자 작업 브랜치 (예: `feature/rag-pipeline`)

## 커밋 컨벤션

- `feat:` 새 기능
- `fix:` 버그 수정
- `docs:` 문서 수정
- `refactor:` 리팩토링
- `style:` 코드 포맷팅
- `chore:` 설정, 빌드 관련
- 커밋 메시지는 prefix만 지키면 설명은 한글로 작성 가능

## 커밋 전 체크리스트

1. `git status`로 변경 파일 확인
2. `.env`, `venv`, `server/chroma_db` 포함 여부 확인
3. 기능 변경과 무관한 따옴표/공백/줄바꿈 수정이 섞였는지 확인
4. `server/app/main.py`의 router import / `include_router(...)` 누락 확인
5. `schemas / services / routers` import 오류 확인
6. `cd server && .\venv\Scripts\python.exe -m compileall -q app`
7. 프론트 변경 시 `cd client && npm run build` 확인
8. 변경한 핵심 API 최소 1회 확인
9. `docs/devlog.md` 최신화 확인
