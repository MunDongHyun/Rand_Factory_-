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
- `ai_summaries`
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

`user_role` 값은 `c` / `j` / `m` / `a` 네 종류이며, 라우터에서 역할별로 접근 범위를 제한합니다.

| Role | 의미 | 접근 범위 |
|------|------|----------|
| `c` | 일반 회원 (consumer) | DBR 구독자. 아티클 요약문 + 저자 이메일링만 |
| `j` | 학습자 (junior) | 매니저로부터 초대받은 학습자. 본인 커리큘럼/과제 + 일반회원 권한 |
| `m` | 매니저 (manager) | OJT 결제로 승급한 회원. 본인 회사 커리큘럼 생성/수정, 과제 피드백, 학습자 초대, 챗봇 사용 |
| `a` | 관리자 (admin) | 전체 접근, 아티클 등록 전담 |

운영 규칙:

- 기본 가입 흐름 (`POST /api/users/signup`)
  - 이메일 / 비밀번호 / 이름 / 회사(선택) / 초대 코드(선택)로 가입
  - 초대 코드 **없음** → 일반 회원(`c`)으로 가입 (입력한 회사명 그대로 저장)
  - 초대 코드 **있음** → 학습자(`j`)로 가입, 회사는 코드 발급 매니저의 회사 강제 상속
- 매니저 승급 / 회사 초대 코드 발급
  - 일반 회원(`c`)이 OJT 결제 시 매니저(`m`)로 승급 + 회사 초대 코드 발급
  - 회사당 코드 1개, 최대 1회까지 재발급 가능
  - 결제 기능은 발표용 정책이며 미구현 (현재는 admin이 DB 직접 변경으로 시뮬레이션)
  - **저장 위치**: `users.user_invite_code VARCHAR(14) NULL UNIQUE` 컬럼 (매니저 행에만 값, 그 외 NULL)
    - 향후 회사 정규화(별도 `companies` 테이블) 또는 `company_invite_codes` 테이블로 분리하는 건 V2
  - **코드 형식**: Crockford Base32 12자 + 하이픈 3-3-3 그룹 (총 14자), 예: `9F3K-PXQ7-M2NJ`
    - 알파벳: `0-9` + `A-Z` 중 혼동 글자 `I, L, O, U` 제외한 32자
    - 32^12 ≈ 1.15×10^18 → 충돌 사실상 0, 손 입력 가능
  - **생성/검증**: 백엔드 전용 (`secrets` 모듈). 클라이언트 생성 금지 (위조/추측 방지)
  - **재발급 추적**: `user_invite_code_reissued_at DATETIME NULL` (1회 제한)
    - 현재 DB에는 추가되지 않음. 재발급 기능 구현 사이클에서 ALTER 같이
- `a` 계정은 DB에서 `user_role` 직접 변경으로 운영
- 새 라우터 추가 시 위 정책 기준으로 역할 체크 필수
- 권한 없는 ID 접근은 403 대신 404로 숨김 (정보 노출 방지)
- 챗봇(`/api/chatbot/*`)은 매니저(`m`/`a`) 전용 유지 — 학습자/일반회원 차단 (챗봇 자체가 현재 미구현, 정책만 보존)
- 일반 회원(`c`)은 커리큘럼/과제/챗봇 라우터 차단 — 라우터별 권한 매트릭스 점검은 별도 사이클 (현재 라우터 코드는 `c` 역할을 모르므로 점검 필요)

### 폐기된 정책 (참고)

- `POST /api/users/signup/bulk` (회사+매니저+학습자 일괄 등록) — 제거됨. 단일 `/signup`에 `invite_code` 기반 학습자 등록 흐름으로 대체.

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
- **JSX에 inline style 금지** — 디자인 수정 작업이 분리돼 있으므로 스타일은 별도 CSS 파일에만 작성. 동적 값(`width: ${pct}%` 등 props/state 기반 계산)만 예외적으로 inline 허용

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
- Codex/Claude는 커밋 메시지 설명을 기본적으로 한글로 작성
  - 예: `feat: 아티클 요약문 원문 링크 및 썸네일 표시 개선`
  - 예: `fix: 카드뉴스 클릭 시 레이아웃 흔들림 완화`
  - 예: `chore: fpdf 의존성 추가`
- 영어 설명 커밋 메시지는 사용자가 명시적으로 요청한 경우에만 사용

## Pull 전 체크리스트

1. `git status` — 로컬 변경사항 확인 (있으면 먼저 commit 또는 stash)
2. `git fetch` — 원격 변경만 받아옴 (머지는 아직 X)
3. `git log HEAD..origin/<branch> --oneline` — 들어올 커밋 미리보기
4. `git diff HEAD origin/<branch> --stat` — 변경 파일 목록 확인
5. 로컬 수정 중인 파일과 원격 변경 파일이 겹치면 충돌 대비 (rebase/merge 전략 결정)
6. 이상 없으면 `git pull`
7. Pull 이후: `server/.env.example`, `requirements.txt`, `client/package.json` 변경 여부 확인 후 본인 환경 동기화

Codex/Claude 작업 규칙:

- 사용자가 "풀 받아줘", "pull 하자"라고 해도 바로 `git pull` 하지 않고 위 체크리스트 1~5를 먼저 수행
- 로컬 변경사항이 있거나 원격 변경 파일과 겹칠 가능성이 있으면 사용자에게 상황을 설명하고 진행 여부 확인
- 로컬 변경을 임의로 되돌리거나 stash 하지 않음

## 로컬 Codex 권한 처리 규칙

- 이 로컬 Codex 환경에서는 `.git/index.lock`, `.git/FETCH_HEAD`, GitHub 네트워크 접근이 일반 권한에서 막히는 경우가 잦음
- 읽기 명령은 일반 권한으로 실행
  - 예: `git status`, `git diff`, `git log`, `git remote -v`
- `.git`에 쓰거나 원격 네트워크를 사용하는 명령은 처음부터 승인 권한으로 실행
  - 예: `git add`, `git commit`, `git pull`, `git push`, `git restore`
- 위 명령을 일반 권한으로 먼저 실행했다가 실패 후 재시도하는 왕복을 줄이는 것이 목적
- 파괴적 명령은 별도 규칙
  - `git reset`, 강제 push, 대량 삭제 등은 사용자 명시 요청과 확인 없이는 실행하지 않음

## Codex / Claude 하이브리드 협업 규칙

Claude Code(Anthropic)와 Codex CLI(OpenAI)를 함께 사용할 때 따르는 규칙입니다.

- **devlog가 허브**: 큰 흐름, 결정, API 변경, 테스트 결과는 어느 도구로 작업했든 반드시 `docs/devlog.md`에 남김
- **작업 단위는 작게 쪼개기**: "이 함수만 고쳐", "이 테스트만 추가해" 단위로 명확히 분리해서 위임
- **같은 파일 동시 작업 금지**: 한 파일을 두 도구가 동시에 만지지 않음. 충돌 가능성이 있으면 우선 정지 후 사용자 확인
- **위임 시작 시 역할 분담 명시**: Claude는 매 위임 시작 전 "Codex 담당 / Claude 담당 / 충돌 가능성" 한 묶음을 사용자에게 보여주고 진행. 사용자가 누가 어느 파일을 만지는지 추적 가능하게.
- **foreground vs background 선택 기준**:
  - **foreground** — 검증 사이클이 짧거나 결과 즉시 확인 필요(시범 단계, 짧은 변경, 실패 가능성 큰 첫 시도)
  - **background** — Codex 작업이 5분+로 길거나, Claude가 그 사이 다른 파일/문서 작업을 병행할 수 있을 때. 같은 파일 충돌 없는지부터 확인
- **Codex 결과도 devlog 한 줄**: Codex CLI에 위임한 작업도 마지막에 devlog에 짧게 요약 (`## YYYY-MM-DD - Codex (작업명)` 형식)
- **커밋 컨벤션 공유**: 위의 "커밋 컨벤션" 섹션은 Codex/Claude 모두 동일하게 적용 (한글 설명, prefix 준수)
- **PowerShell 콘솔의 한글 깨짐 무시**: Windows PowerShell 5.1은 콘솔 출력 인코딩이 CP949라 UTF-8 파일을 출력하면 한글이 깨져 보일 수 있음. 파일 자체는 정상이니 Codex가 깨진 출력을 보고 패닉하지 않도록 프롬프트에 미리 안내

Codex CLI 호출 예시 (Claude가 Bash로 호출하는 경우):

- `codex exec -s read-only "프롬프트"` — 읽기만 (분석/검토용, 안전)
- `codex exec -s workspace-write "프롬프트"` — 자동 실행 + 워크스페이스 쓰기 허용 (exec는 항상 비대화 모드라 approval 옵션 불필요)
- `codex review` — 코드 리뷰 전용

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
