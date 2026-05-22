# landfactory

**LLM·RAG 기반 DBR/HBR 아티클 요약 및 사내 매니저 주도형 AI 교육 커리큘럼 서비스**

DBR/HBR 아티클을 LLM·RAG 로 요약·검색하고, 회사 매니저가 학습자에게 맞춤 OJT 커리큘럼을 배포·피드백할 수 있는 사내 교육 플랫폼입니다.

## 주요 기능

### 인증 / 가입
- JWT 기반 로그인 + 세션 복원, 401 응답 시 자동 로그아웃
- 단일 회원가입 (`/api/users/signup`) — 이메일/비번/이름/회사(선택)/초대 코드(선택)
  - 초대 코드 **없음** → 일반 회원 (`c`)
  - 초대 코드 **있음** → 학습자 (`j`), 회사는 매니저 회사 자동 상속
- 일반 회원 → 매니저 승급 구독 팝업 (`POST /api/users/me/upgrade`)
  - 결제 게이트웨이는 발표용 시뮬레이션, 호출 즉시 매니저 권한 + 회사 초대 코드 발급

### 아티클 / RAG
- 카테고리별 아티클 조회, 상세 진입, 조회수 집계
- AI 요약 / 카드뉴스 노출
- 저자 이메일링 진입 (요약문 → 저자 이메일링 동선)
- 북마크 추가/해제 + 내 북마크 목록
- RAG 기반 키워드 검색 (벡터 + 키워드 직접 매칭 하이브리드, 카테고리 가중치 반영)
- 부적절 검색어 / 결과 없음 / 오류 분기 모달

### 커리큘럼 / 과제 (매니저 ↔ 학습자)
- 매니저 (`m`): 본인 회사 커리큘럼 생성 / AI 자동 주차 계획 생성 / 과제 템플릿 배포 / 학습자 배정 / 학습자 제출 피드백
- 학습자 (`j`): 본인에게 배정된 커리큘럼 / 과제 작성·제출 / 매니저 피드백 확인 / 재제출
- 과제 템플릿 작성 중 **임시저장** (localStorage 기반, 진입 시 자동 복원) — 매니저/학습자 양쪽 적용
- 커리큘럼 / 과제 화면에서 브라우저 뒤로가기 시 메인 대시보드 점프 방지 (상세 → 목록 → 메인 동선 유지)

### 마스터 페이지 (관리자 전용)
- 사용자 현황 통계 (총 사용자, 이번 달 가입자, 가장 많은 회사)
- 학습 활동 통계 (총 커리큘럼, 진행 중 학습자, 누적 과제 제출)
- 최근 활동 추이 라인 차트 (아티클 조회 / 신규 가입, 7/14/30일)
- 카테고리별 조회수 도넛 + 인기 아티클 TOP 5
- 회원관리 패널 — 검색 / 역할 필터 (관리자/매니저/일반회원/학습자/탈퇴) / 정렬 / 역할 변경 / 삭제·복구
- **아티클 등록 패널** — 출처(DBR/HBR), 제목/저자/발행일/카테고리/원문 URL 필수, 본문 입력 시 자동 RAG 인제스트
- 주간 / 월간 운영 보고서 PDF 다운로드 (html2pdf)

## 기술 스택

| 영역 | 기술 |
|------|------|
| Frontend | React (Vite), Axios, react-toastify, Chart.js, html2pdf.js, TipTap |
| Backend | FastAPI, SQLAlchemy, PyMySQL, JWT (passlib + bcrypt) |
| AI / RAG | LangChain, ChromaDB, OpenAI API |
| DB | MySQL |
| Infra | Docker, GitHub |

## 프로젝트 구조

```text
landfactory/
├─ client/                  # React (Vite) 프론트엔드
│  ├─ src/
│  │  ├─ components/         # 화면 컴포넌트 (Dashboard, Curriculum, Master 등)
│  │  ├─ lib/                # API/auth/북마크/sanitize 공통 모듈
│  │  ├─ styles/             # 화면별 스타일
│  │  └─ public/             # 화면 이미지 리소스
│  ├─ package.json
│  └─ vite.config.js
├─ server/                  # FastAPI 백엔드
│  ├─ app/
│  │  ├─ main.py
│  │  ├─ core/               # 설정, DB, 보안 (JWT, bcrypt)
│  │  ├─ models/             # SQLAlchemy ORM 모델
│  │  ├─ schemas/            # Pydantic 요청/응답 스키마
│  │  ├─ routers/            # API 라우터
│  │  └─ services/           # 비즈니스 로직, AI/RAG, 초대 코드, 썸네일 등
│  ├─ scripts/               # PDF 인제스트 등 보조 스크립트
│  ├─ requirements.txt
│  ├─ .env.example
│  └─ chroma_db/             # ChromaDB 로컬 저장소 (커밋 제외)
├─ ai/                      # 실험용 AI 모델링 코드 및 산출물
├─ data/                    # 로컬 데이터
├─ docs/                    # 작업 로그(devlog.md) 및 문서
├─ docker/                  # Docker 설정
├─ article-lab/             # 아티클 시각화 테스트 샌드박스
├─ CLAUDE.md                # 협업 규칙 및 개발 체크리스트
└─ README.md
```

## 서버 구조

### 핵심 테이블

- `users`
- `articles`
- `authors`
- `article_authors_mapping`
- `curriculum`
- `ai_summaries`
- `task_submissions`
- `bookmarks`
- `user_activity`

> 참고: 과거 사용하던 `chatbot_sessions` / `chatbot_messages` 테이블은 ORM/라우터에서 제거됨. 데이터 보존 차원에서 테이블 자체는 남겨두며, 드롭 여부는 별도 결정.

### 현재 라우터

- `health`
- `user`
- `article`
- `author`
- `bookmark`
- `rag`
- `curriculum`
- `task_submission`

### 제거된 예전 구조 (현재 기준 아님)

- `mentor`, `mentoring`, `point`, `framework`, `chat`
- `chatbot` — 2026-05-19 결정으로 백엔드 라우터/모델/스키마 제거

## 권한 정책

`user_role` 값은 `c` / `j` / `m` / `a` 네 종류이며, 라우터에서 역할별로 접근 범위를 제한합니다. 자세한 운영 규칙은 [CLAUDE.md](CLAUDE.md)를 참고하세요.

| Role | 의미 | 접근 범위 |
|------|------|----------|
| `c` | 일반 회원 (consumer) | DBR 구독자. 아티클 요약문 + 저자 이메일링. 구독 시 매니저 승급 가능 |
| `j` | 학습자 (junior) | 본인 커리큘럼/과제 + 일반 회원 권한 |
| `m` | 매니저 (manager) | 본인 회사 커리큘럼 생성/수정, 과제 피드백, 학습자 초대 |
| `a` | 관리자 (admin) | 전체 접근, 아티클 등록 전담 |

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

- `OPENAI_API_KEY` — OpenAI API 키
- `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` — MySQL 접속 정보
- `SECRET_KEY` — JWT 서명 키 (기본값 없음, 누락 시 앱 시작 실패)
- `CHROMA_PERSIST_DIR` — ChromaDB 저장 경로
- `AI_MODEL` — 실험용 AI 스크립트에서 사용할 모델명

주의:

- `.env`, `.env.test`는 커밋하지 않습니다.
- 실제 DB 비밀번호나 API 키는 문서에 적지 않습니다.
- `bcrypt==4.0.1` 유지 (`passlib 1.7.4` 호환 이슈 방지)

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

- 작업 기록과 결정 사항은 `docs/devlog.md`
- 팀 협업 규칙, 브랜치 전략, 커밋 전 체크리스트는 `CLAUDE.md`
