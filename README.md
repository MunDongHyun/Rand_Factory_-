# ArtiCulum

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
- **검색어 LRU 캐시** — 동일 검색어 재입력 시 LLM 호출 0
- **아티클 원본 PDF** — 관리자가 등록 시 업로드, 관리자만 다운로드(저작권 보호). 객체저장소(R2) 보관

### 커리큘럼 / 과제 (매니저 ↔ 학습자)
- 매니저 (`m`): 본인 회사 커리큘럼 생성 / AI 자동 주차 계획 생성 / 과제 템플릿 배포 / 학습자 배정 / 학습자 제출 피드백
- 학습자 (`j`): 본인에게 배정된 커리큘럼 / 과제 작성·제출 / 매니저 피드백 확인 / 재제출
- 과제 템플릿 작성 중 **임시저장** (localStorage 기반, 진입 시 자동 복원)
- **마감일 (DatePicker)** — 과제(assignment) 단위 마감일. 한국어 locale + 빠른 선택 칩(+1주/+2주/+4주) + D-Day 배지
- **마감일 검증** — 백엔드 POST `/api/task-submissions`에서 마감 지난 제출 차단
- **양식 1회 배포 잠금** — 학습자 제출이 발생한 주차의 `template_content` 매니저 수정 차단 (deadline 변경은 허용)
- **매니저 인라인 피드백** — 학습자 관리 페이지 제출 카드 클릭 시 본문/첨부/피드백을 한 화면에서. 빠른 코멘트 칩 + 재제출 요청 시 사유 필수
- **학습자별 진행률** — 매니저 시점 진행률 바 + "최근 활동: N일 전"
- 첨부파일 — 도큐먼트/이미지/압축 화이트리스트(20개), 20MB 제한, magic byte 검증, path traversal 차단. **Cloudflare R2 + 로컬 fallback**
- 커리큘럼 / 과제 화면에서 브라우저 뒤로가기 시 메인 대시보드 점프 방지 (상세 → 목록 → 메인 동선 유지)

### 알림
- 헤더 종 아이콘 + 60초 폴링으로 unread count 갱신
- 트리거: 학습자 제출 / 매니저 피드백 / 재제출 요청
- 클릭 시 자동 딥링크 + 자동 선택된 제출물에 2.4초 highlight 애니메이션
- **개별 삭제 (hover 시 × 버튼)** + **읽은 알림 일괄 비우기** (안 읽은 알림은 보호)
- soft delete (`notif_deleted_at`)

### 수료증 발급 (매니저 / 관리자)
- 발급 조건: **모든 주차 제출 + 재제출 요청 없음 + 피드백 완료**
- 수료증 번호: `AC-YYYYMMDD-xxxxxx`
- 발급 시 학습자명 / 커리큘럼명 / 발급자명 스냅샷 저장
- PDF 생성 후 R2 `certificates/{cur_id}/{learner_id}/{ts}.pdf`에 보관
- 학습자 관리 화면에서 발급 / 다운로드 버튼 직접 노출

### 마스터 페이지 (관리자 전용)
- 사용자 현황 통계 (총 사용자, 이번 달 가입자, 가장 많은 회사)
- 학습 활동 통계 (총 커리큘럼, 진행 중 학습자, 누적 과제 제출)
- 최근 활동 추이 라인 차트 (아티클 조회 / 신규 가입, 7/14/30일)
- 카테고리별 조회수 도넛 + 인기 아티클 TOP 5
- 회원관리 패널 — 검색 / 역할 필터 (관리자/매니저/일반회원/학습자/탈퇴) / 정렬 / 역할 변경 / 삭제·복구
- **아티클 등록 패널** — 출처(DBR/HBR), 메타 + 본문(RAG 자동 인제스트) + **원본 PDF 첨부(선택, 30MB 가드)**
- **주간 / 월간 운영 보고서 PDF** — html2pdf 생성 → 클라이언트 다운로드 + R2 best-effort 보관. **직전 동일 기간 대비 증감 지표** 포함

### 객체저장소 (Cloudflare R2)
- 모든 바이너리/파일 데이터를 R2에 통합 보관 (R2 설정 없으면 `server/uploads/` 로컬 fallback)
- 구조 분리: **메타데이터는 MySQL, 검색용 벡터는 Chroma, 바이너리는 R2**
- 보관 대상:
  - `task_attachments/{submission_id}/{stored_name}` — 학습자 과제 첨부
  - `thumbnails/{filename}` — 아티클 썸네일
  - `curriculum_exports/{cur_id}/{ts}.{ext}` — 매니저 다운로드 산출물(TXT/PDF/DOCX) best-effort
  - `reports/{kind}/{user_id}/{ts}.pdf` — 관리자 주간/월간 운영 리포트
  - `articles/{article_id}/source.pdf` — 아티클 원본 PDF
  - `certificates/{cur_id}/{learner_id}/{ts}.pdf` — 수료증
- path traversal 방어: 모든 key는 `_safe_object_key` 정규화 검사 통과 후 저장

## 기술 스택

| 영역 | 기술 |
|------|------|
| Frontend | React (Vite), Axios, react-toastify, Chart.js, html2pdf.js, TipTap, react-datepicker, date-fns, DOMPurify |
| Backend | FastAPI, SQLAlchemy, PyMySQL, JWT (passlib + bcrypt), slowapi (rate limit) |
| AI / RAG | LangChain, ChromaDB, OpenAI API |
| DB | MySQL |
| Object Storage | Cloudflare R2 (boto3) + 로컬 fallback |
| Infra | Docker, GitHub |

## 프로젝트 구조

```text
landfactory/                # 디렉터리 이름은 그대로, 서비스 라벨만 "ArtiCulum"
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
├─ docs/                    # 마이그레이션 SQL 등 (devlog.md는 로컬 개인 로그·git 미추적)
├─ docker/                  # Docker 설정
├─ CLAUDE.md                # 협업 규칙 및 개발 체크리스트 (로컬 전용, skip-worktree)
└─ README.md
```

## 서버 구조

### 핵심 테이블

- `users`
- `articles` (컬럼: `article_thumbnail_filename`, `article_pdf_key` 포함)
- `authors`
- `article_authors_mapping`
- `curriculum`
- `ai_summaries`
- `task_submissions` (컬럼: `task_deadline` 포함, `task_score` 코드는 제거됨)
- `task_submission_attachments`
- `bookmarks`
- `user_activity`
- `notifications`
- `certificates`

> 참고: 과거 사용하던 `chatbot_sessions` / `chatbot_messages` 테이블은 ORM/라우터에서 제거됨. 데이터 보존 차원에서 테이블 자체는 남겨두며, 드롭 여부는 별도 결정.

### 현재 라우터

- `health`
- `user`
- `article` (`POST /{id}/pdf`, `GET /{id}/pdf` 포함)
- `author`
- `bookmark`
- `thumbnail`
- `rag`
- `curriculum`
- `task_submission`
- `notification` (개별·일괄 삭제 포함)
- `reports` (운영 리포트 R2 업로드)
- `certificate` (수료증 발급/조회/다운로드)

### 제거된 예전 구조 (현재 기준 아님)

- `mentor`, `mentoring`, `point`, `framework`, `chat`
- `chatbot` — 2026-05-19 결정으로 백엔드 라우터/모델/스키마 제거
- `task_score` — 점수 평가 폐기 (2026-05-27). DB 컬럼은 별도 DROP 예정
- `cur_deadline` — 커리큘럼 단위 마감일 폐기, `task_deadline` (과제 단위)로 이동

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

## 배포

발표용 배포 구성입니다.

| 영역 | 플랫폼 | 비고 |
|------|--------|------|
| 백엔드 | Render Web Service (Docker) | `dev` 브랜치 자동 배포, `$PORT` 주입 대응 |
| 프론트 | Vercel (Vite Static) | `VITE_API_BASE_URL`로 백엔드 API 연결 |
| DB | MySQL | 외부 접속 |
| 객체저장소 | Cloudflare R2 | 로컬과 동일 자격증명 |
| 벡터 DB | ChromaDB | `server/chroma_db`를 이미지에 포함 |

- 백엔드 헬스체크: `GET /health`
- 무료 티어 특성상 유휴 시 슬립 → 첫 요청에 cold start 지연 발생 (발표 전 헬스체크로 워밍업 권장)
- 백엔드 Dockerfile: `docker/Dockerfile.server` (Build Context `./server`)

## 환경변수

`server/.env.example`을 복사해 `server/.env`를 만들고 실제 값을 채웁니다.

주요 변수:

- `OPENAI_API_KEY` — OpenAI API 키
- `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` — MySQL 접속 정보
- `SECRET_KEY` — JWT 서명 키 (기본값 없음, 누락 시 앱 시작 실패)
- `CHROMA_PERSIST_DIR` — ChromaDB 저장 경로
- `AI_MODEL` — 서버·실험 스크립트 공통 모델명 (`settings.ai_model`로 단일 통제)
- `CORS_ORIGINS` — 쉼표 구분 origin 화이트리스트 (비면 dev 기본값)
- `BACKEND_URL` — 배포 환경에서 썸네일 등 절대경로 생성 기준 (로컬은 비워두면 상대경로 유지)
- `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`, `R2_ENDPOINT_URL`, `R2_REGION` — Cloudflare R2 객체저장소 (모두 비우면 로컬 fallback)
- `SMTP_*` — 저자 이메일링용 SMTP 정보

프론트(`client/.env`)는 `client/.env.example` 참고:

- `VITE_API_BASE_URL` — 백엔드 API 기준 URL (미설정 시 `/api`, 로컬 dev proxy 사용)

주의:

- `.env`, `.env.test`는 커밋하지 않습니다.
- 실제 DB 비밀번호나 API 키는 문서에 적지 않습니다.
- `bcrypt==4.0.1` 유지 (`passlib 1.7.4` 호환 이슈 방지)
- `R2_ENDPOINT_URL`은 `https://<ACCOUNT_ID>.r2.cloudflarestorage.com` 형식이어야 head_bucket 통과

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

- 작업 기록과 결정 사항은 `docs/devlog.md` (로컬 개인 로그, git 미추적 — 클론 시 포함되지 않음)
- 팀 협업 규칙, 브랜치 전략, 커밋 전 체크리스트는 `CLAUDE.md`
