# Codex 인수인계: ArtiCulum Render 배포

작성: 2026-05-29 Claude (코드 측 준비 완료 후 인수인계)

---

## 1. 배경 / 컨텍스트

- **프로젝트**: ArtiCulum (코드/디렉터리는 `landfactory`). DBR/HBR LLM·RAG 기반 사내 교육 플랫폼
- **발표**: 2026-06-10 (D-12)
- **목표**: 발표 시연용 클라우드 배포. 발표 후 1~2주 포트폴리오 URL로 유지
- **배포 전략**:
  - 백엔드 → **Render** (Web Service, 무료 티어)
  - 프론트 → **Vercel** (Static, 무료)
  - DB → **학원 MySQL 그대로** (`project-db-campus.smhrd.com:3307`, 외부 접속 가능 TCP 확인 완료)
  - 객체저장소 → **Cloudflare R2** (이미 운영 중)
  - 벡터 DB → **ChromaDB**, Docker 이미지에 `server/chroma_db/` 포함 (read-only)
- **로컬 환경 유지**: 디버깅·시연 폴백용. Render는 디버깅이 한 단계 멀어지므로 로컬 그대로 두고 push만 자동 배포

## 2. 이미 완료된 작업 (Claude, 이번 사이클)

코드 측 배포 준비는 다 끝나있다. 추가 코드 변경은 트러블슈팅 발생 시에만.

- **`client/src/lib/api.js`**: `baseURL`을 `import.meta.env.VITE_API_BASE_URL || '/api'` 로 환경변수화. 로컬 동작 변함 없음
- **`docker/Dockerfile.server`**: `--reload` 제거, `$PORT` 환경변수 우선 사용 (Render가 PORT 자동 주입). 로컬 도커는 기본 8000 유지
- **`server/.env.example`**: Render 배포용 환경변수 가이드 추가 (CORS_ORIGINS / SECRET_KEY 재발급 / R2 동일 등)
- **`client/.env.example`**: 신규. `VITE_API_BASE_URL` 가이드

## 3. Codex가 할 일

### 3-A. 사용자 환경 점검 (가장 먼저)

학원 DB에 마이그레이션 SQL이 다 적용됐는지 확인. 적용 안 됐으면 배포 직후 깨진다.

확인 스크립트는 이미 만들어져 있음: **`server/scripts/check_migration_state.py`**

```powershell
$env:PYTHONIOENCODING="utf-8"; server\venv\Scripts\python.exe server\scripts\check_migration_state.py
```

- `articles.article_pdf_key` 컬럼 / `certificates` 테이블 둘 다 OK 떠야 진행
- 없으면 `docs/article_pdf_key_migration_2026_05_28.sql`, `docs/certificates_migration_2026_05_28.sql` 학원 DB에 적용 후 재실행

### 3-B. Render Web Service 생성 안내 (사용자가 대시보드 클릭)

Codex는 대시보드를 직접 조작 못 한다. 사용자가 대시보드에서 클릭하는 동안 옆에서 안내한다.

**Render 대시보드 설정값**:

- Source: GitHub `MunDongHyun/Rand_Factory_-` 연결 → Branch `dev`
- **Runtime**: Docker
- **Dockerfile Path**: `docker/Dockerfile.server`
- **Docker Build Context Directory**: `./server`  ← 중요. `server/requirements.txt`, `server/app/`, `server/chroma_db/` 가져오기 위함
- Plan: Free
- Region: Singapore (한국에서 가장 가까움)
- Auto-Deploy: Yes (dev 브랜치 push 시 자동 배포)

**Environment Variables (Render Secrets에 입력)**:

로컬 `server/.env` 값을 그대로 복사. 다만 아래 두 개는 변경:

| 키 | 변경 사항 |
|---|---|
| `CORS_ORIGINS` | Vercel 프론트 도메인 추가. 예: `https://articulum.vercel.app,http://localhost:5173` |
| `SECRET_KEY` | 배포 환경용으로 새 키 생성 권장: `python -c "import secrets; print(secrets.token_hex(32))"` |

나머지는 동일:
- `OPENAI_API_KEY`
- `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`
- `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`, `R2_ENDPOINT_URL`, `R2_REGION`
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM_NAME`
- `AI_MODEL`
- `CHROMA_PERSIST_DIR=./chroma_db` (이미지 안에 포함)
- `APP_ENV=production`

### 3-C. 첫 배포 트러블슈팅 흐름

배포 시도 후 발생 가능한 이슈 + 대응:

| 증상 | 원인 | 대응 |
|---|---|---|
| Docker build context 에러 (`requirements.txt not found`) | Build Context를 `./server`로 지정 안 함 | Render 설정에서 Context Directory `./server` 확인 |
| `chroma_db not found` 또는 RAG 빈 결과 | 이미지에 `server/chroma_db/` 미포함 (.dockerignore 또는 .gitignore 제외) | `.dockerignore`에서 `chroma_db` 항목 제거 또는 inline 인제스트 |
| MySQL 연결 실패 | DB_HOST/PORT/사용자 IP 화이트리스트 | 학원에 외부 IP 화이트리스트 정책 확인. portchecker.co 49.171.84.3:3307 → open 이지만 사용자 host 권한은 별개 |
| `OperationalError: ... not allowed to connect from ...` | MySQL 사용자 host가 `%` 아님 | 학원 관리자에게 사용자 host 허용 요청 또는 PlanetScale 폴백 |
| CORS 에러 (브라우저) | CORS_ORIGINS에 Vercel 도메인 누락 | Render Secrets 갱신 + auto-deploy 트리거 |
| Cold start 30초 | Render 무료 티어 sleep | 시연 30분 전 워밍업 호출 1회 (`curl https://.../health`) |
| 빌드 타임아웃 | 의존성 무거움 | requirements.txt에서 미사용 제거 (현재 정리됨) |

### 3-D. Vercel 프론트 배포 안내

대시보드 작업은 사용자. Codex는 안내.

**Vercel 설정**:

- Source: 같은 GitHub repo → Branch `dev`
- **Root Directory**: `client`
- Framework Preset: Vite
- Build Command: `npm run build` (기본)
- Output Directory: `dist` (기본)

**Environment Variables**:

| 키 | 값 |
|---|---|
| `VITE_API_BASE_URL` | `https://<Render에서 받은 백엔드 URL>/api` |

(주의: 끝에 `/api` 붙임. `api.js`가 baseURL로 직접 사용함)

### 3-E. 시연 검증

- 배포된 프론트 URL 접속 → 로그인 → 아티클 목록 → 검색 → 매니저 페이지 → 시연 동선 1회 완주
- R2 콘솔에서 객체 누적 확인 (`server/scripts/check_r2_objects.py`)
- 콘솔 에러 0, CORS 에러 0, 401 (의도된 거 제외) 외 4xx/5xx 0
- 백엔드 로그(Render 대시보드)에 ERROR 출력 0

### 3-F. devlog 업데이트

작업 끝나면 한 entry:

```markdown
## 2026-05-XX - Codex (Render + Vercel 배포)

### 결과
- 백엔드: https://...onrender.com
- 프론트: https://...vercel.app
- 학원 DB 그대로 사용 (외부 접속 OK 확인됨)
- R2 / OpenAI / SMTP 로컬과 동일 자격증명

### 트러블슈팅 메모
- [발생한 이슈 + 대응 한 줄씩]

### 발표 시연 준비
- 발표 30분 전 워밍업 호출 1회 권장
- 폴백: 로컬 uvicorn + npm run dev 동시 운영
```

## 4. 안 건드릴 것

- 학원 DB 스키마 (학원 정책)
- 기존 마이그레이션 SQL 파일 (이미 적용된 상태일 가능성 높음)
- 로컬 개발 환경 (배포 후에도 그대로 유지 — 디버깅·폴백)
- 큰 코드 리팩토링 (발표 D-12. 폴리싱만)

## 5. 비상 폴백

배포가 너무 꼬이면 **로컬 + ngrok**으로 폴백:

```powershell
# 백엔드
cd server; .\venv\Scripts\activate; uvicorn app.main:app --host 0.0.0.0 --port 8000

# 프론트
cd client; npm run build; npm run preview -- --host

# ngrok
ngrok http 5173
```

발표 30분만 살아있으면 되므로 ngrok 무료 티어로 충분.

## 6. 참고 자료

- 현재 README.md / CLAUDE.md
- `docs/devlog.md` 최근 entry (5/27~5/29)
- 시연 체크리스트: `docs/integration_test_2026_05_28.md`
- R2 prefix 확인 스크립트: `server/scripts/check_r2_objects.py`
- 마이그레이션 확인 스크립트: `server/scripts/check_migration_state.py`
- DB 외부 접속 확인 스크립트: `server/scripts/check_db_external_access.py`

---

**우선순위 행동**: 3-A → 3-B → 3-D → 3-E → 3-F
