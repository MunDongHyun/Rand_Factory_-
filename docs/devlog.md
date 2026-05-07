# 개발 로그

팀 레포 오픈 후 git commit message로 이전 예정.

---

## 2026-05-06 - Claude

### 작업
- `routers/user.py` 버그 수정 2건

### 수정 내용
- **로그인 soft delete 미체크** (`POST /api/users/login`) — 탈퇴 계정(`user_deleted_at IS NOT NULL`)으로 로그인이 가능한 버그 수정. `user_deleted_at.is_(None)` 조건 추가
- **유저 조회 인증 없음** (`GET /api/users/{user_id}`) — 토큰 없이 누구나 유저 정보 조회 가능한 버그 수정. `get_current_user` 의존성 추가 + 탈퇴 계정 soft delete 필터도 동일하게 적용

---

## 2026-05-06 - Claude (2)

### 작업
- 전체 백엔드 구조 점검 후 권한/검증 이슈 일괄 수정 (9건)

### 권한/보안 수정
- **Signup 역할 무제한** (`POST /api/users/signup`) — 누구나 admin/manager로 가입 가능했던 버그 수정. `UserCreate`에서 `role` 필드 제거하고 라우터에서 `j`(학습자) 강제. m/a 계정은 DB 직접 변경으로 운영
- **Article 등록 권한 없음** (`POST /api/articles`) — admin(`a`)만 등록 가능하도록 역할 체크 추가
- **Curriculum 조회 전체 노출** (`GET /api/curricula`, `GET /api/curricula/{id}`) — 학습자가 배정 안 된 커리큘럼까지 다 보이는 문제 수정. `_scope_curriculum_query` helper로 role 기반 필터 적용 (j: 배정된 것, m: 본인 생성, a: 전체). 권한 없는 ID는 404로 숨김
- **Curriculum 생성 권한 없음** (`POST /api/curricula`) — m/a만 생성 가능하도록 제한
- **Task submission 매니저 권한 누락** (`GET/PATCH /api/task-submissions/{id}`) — 매니저가 본인이 만들지 않은 커리큘럼의 과제까지 조회/피드백 가능했던 문제 수정. `_can_access_submission` helper로 role별 접근 권한 판정
- **Chatbot 세션 검증 없음** (`POST /api/chatbot/sessions`) — 임의 `cb_curriculum_id` 지정 가능한 문제 수정. 챗봇은 매니저 전용으로 m/a만 사용 가능, 커리큘럼 지정 시 본인 소유 검증
- **Secret key 운영 강제** — `secret_key`의 기본값 `"changeme"` 제거. 환경변수에 설정 안 하면 앱 시작 자체가 안 됨

### 데이터 무결성 수정
- **스키마 enum 검증 추가** — `article_source`(DBR/HBR), `cur_status`, `task_status`, chatbot `role`, `output_type` 모두 `Literal`로 타입 강제. 잘못된 값 들어가면 422 반환
- **Curriculum soft delete 필터** — `_scope_curriculum_query`와 PATCH 라우터에 `cur_deleted_at IS NULL` 조건 추가. 삭제된 커리큘럼은 조회/수정 불가
- **`CurriculumResponse.cur_assigned_learner_ids` 타입 불일치** — Create는 `list[int]`, Response는 `dict`였던 것 → `list[int]`로 통일

### 검증
- `python -m compileall -q app` 통과
- `import app.main` 통과

### 다음
- 매니저용 "내 커리큘럼 과제 목록" 엔드포인트 추가 — 새 기능, 챗봇/AI 결과물 작업과 함께 결정

---

## 2026-05-06 - Claude (3)

### 작업
- 코드 품질 이슈 5건 일괄 정리

### 수정 내용
- **rag_service public API 분리** — `routers/article.py`에서 `_get_vectorstore()` private 호출하던 부분을 `services/rag_service.py`에 `get_article_content(article_id)` public 함수 추가하고 라우터는 이를 호출하도록 변경
- **`datetime.utcnow()` deprecation 제거** — `routers/task_submission.py`에서 `datetime.now(timezone.utc)`로 교체
- **Pydantic v2 스타일 마이그레이션** — `core/config.py`의 `class Config:`를 `model_config = SettingsConfigDict(...)`로 교체. v1 deprecation warning 제거
- **`services/content_filter.py` 삭제** — 예전 chat 라우터 제거 후 호출처 없는 dead code 정리. 챗봇 입력 검사가 필요해지면 그때 다시 추가
- **`AiOutputCreate` output_type 분기 검증** — `model_validator(mode="after")`로 output_type별 필수 필드 검증 추가:
  - `summary` → `summary_text` 필수
  - `wordcloud` → `result_json` 또는 `image_url` 필수
  - `framework` → `framework_type` + `generated_content` 모두 필수

### 검증
- `python -m compileall -q app` 통과
- `import app.main` 통과

---

## 현재 상태 요약 (2026-05-06 기준)

### 백엔드 현재 API

| 영역 | 엔드포인트 | 비고 |
|------|-----------|------|
| Health | GET /health | 서버 상태 확인 |
| 회원 | POST /api/users/signup | 현재 DB 컬럼명 기준 회원 생성 |
| | POST /api/users/login | JWT 토큰 발급 |
| | GET /api/users/me | 내 정보 조회 |
| | GET /api/users/{user_id} | 특정 유저 조회 |
| 아티클 | POST /api/articles | 아티클 등록 |
| | GET /api/articles | 목록/검색/페이지네이션 |
| | GET /api/articles/categories | 카테고리 목록 |
| | GET /api/articles/{id} | 상세 조회 |
| | GET /api/articles/{id}/insights | RAG/LLM 기반 인사이트 추출 |
| RAG | POST /api/rag/query | ChromaDB 기반 질의응답 |
| 커리큘럼 | /api/curricula/* | 커리큘럼 생성/조회/관리 |
| AI 결과물 | /api/ai-outputs/* | summary/wordcloud/framework 결과물 관리 |
| 챗봇 | /api/chatbot/* | 챗봇 세션/메시지 관리 |
| 과제 제출 | /api/task-submissions/* | 학습자 과제 제출 및 피드백 |

### 현재 서버 구조

| 구분 | 현재 사용 |
|------|-----------|
| 모델 | `users`, `articles`, `curriculum`, `ai_outputs`, `output_article_refs`, `task_submissions`, `chatbot_sessions`, `chatbot_messages` |
| 라우터 | `user`, `article`, `rag`, `curriculum`, `ai_output`, `chatbot`, `task_submission`, `health` |
| 제거된 예전 구조 | `mentor`, `mentoring`, `point`, `framework`, `chat` |

### 남은 작업

| 항목 | 우선순위 | 비고 |
|------|---------|------|
| Swagger 기준 엔드포인트 수동 확인 | 높음 | uvicorn 실행 후 주요 API 응답 확인 |
| 프론트엔드 연동 | 높음 | 현재 백엔드 API 이름 기준으로 화면 연결 필요 |
| AI 결과물 생성 흐름 정리 | 중간 | `ai_outputs` 중심으로 summary/wordcloud/framework 저장 흐름 결정 |
| 문서 최신화 | 중간 | 구조 변경 시 `CLAUDE.md`, `README.md`, `docs/devlog.md` 같이 갱신 |

### 알아두면 좋은 것

- **현재 작업 브랜치**: `dev`
- **서버 실행**: `cd server && venv/Scripts/activate && uvicorn app.main:app --reload`
- **Swagger UI**: `http://localhost:8000/docs`
- **환경변수**: `server/.env` 참고 (절대 커밋 금지)
- **로컬 벡터 저장소**: `server/chroma_db/` 사용, git 커밋 제외
- **PDF 인제스트 스크립트**: `server/scripts/ingest_pdfs.py`
- **bcrypt 버전 주의**: `bcrypt==4.0.1` 고정 (5.x는 passlib 1.7.4와 호환 안 됨)

---

## 2026-04-21

### 완료
- `server/app/core/config.py` — pydantic-settings 기반 환경변수 관리, `database_url` 프로퍼티
- `server/app/core/database.py` — SQLAlchemy engine/SessionLocal/Base, `get_db` 의존성
- `server/app/core/security.py` — bcrypt 해싱, JWT 생성/검증, `get_current_user` 의존성
- `server/app/models/` — ORM 모델 8개 (users, mentor_profiles, mentoring_matches, mentoring_reviews, points, articles, frameworks, chat_messages)
- `server/app/schemas/user.py` — Pydantic v2 스키마 (UserCreate, UserLogin, UserResponse, MentorProfileCreate/Response, TokenResponse)
- `server/app/routers/user.py` — 회원 API 4개
  - `POST /api/users/signup` — 가입, mentor면 프로필 자동생성, 1000P 지급
  - `POST /api/users/login` — JWT 발급
  - `GET /api/users/me` — 내 정보 (mentor_profile 포함)
  - `GET /api/users/{user_id}` — 특정 유저 조회

### 트러블슈팅
- `Decimal` → `Numeric` (SQLAlchemy에 Decimal 없음)
- `bcrypt 5.x` → `4.0.1` 고정 (passlib 1.7.4 호환성 문제)

### 미완료 / 다음 작업
- article, framework, chat 라우터
- RAG 파이프라인 연결
- 팀 레포 오픈 후 git 이전

---

## 2026-04-21 (2차)

### 완료
- `server/app/schemas/mentoring.py` — MatchCreate/Response, MatchStatusUpdate, ReviewCreate/Response
- `server/app/services/point_service.py` — get_balance, deduct_points, add_points
- `server/app/routers/mentoring.py` — 멘토링 API 6개
  - `POST /api/mentoring/request` — 매칭 요청 (멘티 전용, 잔액 확인)
  - `PATCH /api/mentoring/{match_id}/status` — 수락/거절/취소 (멘토 전용, 수락 시 포인트 이동)
  - `PATCH /api/mentoring/{match_id}/complete` — 완료 처리 (멘토/멘티 모두)
  - `POST /api/mentoring/{match_id}/review` — 리뷰 작성 + rating_avg/mentoring_count 자동 갱신
  - `GET /api/mentoring/my` — 내 목록 (role 자동 분기, status 필터)
  - `GET /api/mentoring/{match_id}` — 상세 조회 (참여자만)

### 검증
- 멘토가 매칭 요청 → 403
- 멘티가 status 변경 → 403
- 리뷰 중복 작성 → 400
- 수락 시 멘티 100P 차감, 멘토 100P 적립 정상 동작

### 미완료 / 다음 작업
- article, framework, chat 라우터
- RAG 파이프라인 연결
- 팀 레포 오픈 후 git 이전

---

## 2026-04-21 - Claude

### 작업
- `schemas/point.py` 생성 — PointResponse, PointBalanceResponse
- `routers/point.py` 생성 — GET /api/points/balance, GET /api/points/history
- `main.py` — point 라우터 등록

### 결정
- balance 조회는 point_service.get_balance() 재사용 (DB 직접 쿼리 중복 방지)
- history 정렬은 point_id desc (created_at 동일값 가능성 있어 삽입 순서 기준)
- 페이지네이션은 limit(max 100)/offset, cursor 방식은 아직 불필요

### 다음
- article, framework, chat 라우터
- RAG 파이프라인 연결

### 주의
- point_service의 deduct/add는 db.add()만 함, 호출부에서 commit() 필수
- 포인트 잔액은 points 테이블 최신 레코드 balance 기준 (집계 아님)

---

## 2026-04-21 - Codex

### 작업
- `server/app/schemas/article.py` 생성 — ArticleCreate, ArticleResponse, ArticleListResponse
- `server/app/routers/article.py` 생성 — 아티클 등록/목록/상세/카테고리 API
- `server/app/main.py` — article 라우터 등록

### 결정
- `POST /api/articles`는 `get_current_user` 의존성으로 인증된 사용자만 등록 가능
- 목록 조회는 category/industry/keyword 필터와 page/limit 페이지네이션 적용, 최신순 정렬
- `/api/articles/categories`는 `/{article_id}`보다 먼저 선언해 라우팅 충돌 방지

### 검증
- `server/venv` 기준 `python -m compileall -q server/app` 통과
- `app.main` import 후 `/api/articles` 라우트 등록 확인

### 다음
- article chunk/image 관련 실제 크롤링·RAG 파이프라인 연결
- 정식 DB 계정 발급 후 JSON 컬럼 필터(`industry_tags`) 실제 MySQL 동작 확인

---

## 2026-04-21 - Codex (2)

### 작업
- `server/app/schemas/mentor.py` 생성 — User + MentorProfile 병합 응답 스키마
- `server/app/routers/mentor.py` 생성 — 멘토 목록/상세 API
- `server/app/main.py` — mentor 라우터 등록

### 결정
- `GET /api/mentors`는 is_verified=True, available=True, role=mentor 조건만 노출
- industry/job_title은 User 컬럼 기준 필터, keyword는 name/bio 검색
- 목록 정렬은 mentor_profiles.rating_avg desc

### 다음
- 정식 DB 데이터 들어오면 specialties JSON 저장 형식 확정

---

## 2026-04-21 - Codex (3)

### 작업
- `server/app/schemas/chat.py` 생성 — ChatMessageCreate/Response
- `server/app/services/content_filter.py` 생성 — 전화번호/이메일/주민등록번호 정규식 감지
- `server/app/routers/chat.py` 생성 — 메시지 전송/조회 API
- `server/app/main.py` — chat 라우터 등록

### 결정
- 메시지 전송은 매칭 참여자이면서 status=accepted일 때만 허용
- 대화 조회는 매칭 참여자만 가능, created_at/message_id 오름차순 정렬
- 민감정보 감지 시 메시지는 저장하되 is_flagged/flag_reason과 warning 응답 포함

### 다음
- 프론트에서 warning 표시 UX 연결
- 정식 정책 확정 후 민감정보 패턴/차단 여부 조정

---

## 2026-04-22 - Codex

### 작업
- FastAPI `TestClient`로 전체 멘토링/포인트/채팅/리뷰 시나리오 통합 테스트 수행
- `mentor@test.com`, `mentee@test.com` 테스트 계정 데이터 초기화 후 재생성

### 검증
- 멘토/멘티 로그인 성공
- 매칭 요청 → 수락 → 멘티 900P / 멘토 1100P 확인
- 채팅 전송 및 전화번호 민감정보 경고 확인
- 멘토링 완료 처리 및 멘티 리뷰 작성 성공
- 멘토 프로필 `rating_avg=5.0`, `mentoring_count=1` 업데이트 확인

### 주의
- 이번 검증은 Swagger UI 클릭 대신 동일 API를 `TestClient` HTTP 흐름으로 재현

---

## 2026-04-22 - Codex (2)

### 작업
- `server/scripts/ingest_pdfs.py` 생성 — PDF 텍스트 추출, JWT 로그인, article 등록, RAG 질의 자동화
- `server/requirements.txt` — `PyMuPDF` 추가
- `data/articles/` 폴더 생성 및 DBR PDF 16개 인제스트 실행

### 검증
- PDF 16개 모두 등록 성공 (`article_id=3~18`)
- 각 PDF `content` 기반 자동 RAG 인덱싱 및 `chunk_count` 생성 확인
- RAG 질문 3개 모두 응답/소스 반환 확인

### 주의
- 스크립트는 `http://localhost:8000` 서버가 켜져 있어야 동작
- `published_date`는 현재 스크립트 실행일 기준 오늘 날짜로 저장
- 동일 `title` 존재 시 스킵하도록 구현

---

## 2026-04-22 - Codex (3)

### 작업
- `server/app/services/rag_service.py` 검색 2회 호출 구조를 1회 호출로 정리

### 결정
- retriever 결과를 재사용해서 `context`와 `sources`를 함께 구성
- 기능 동작은 유지하면서 질문당 벡터 검색/임베딩 비용을 줄이는 방향으로 수정

### 검증
- `server/app` compileall 통과

---

## 2026-04-22 - Claude

### 작업
- article / mentor / chat 엔드포인트 실 DB 동작 테스트 수행 (코드 변경 없음)

### 검증 결과
- **Article**: 등록/목록/카테고리/상세/keyword 필터/404 모두 정상
- **Mentor**: 목록(is_verified 필터 동작), 상세, industry 필터, 404 정상
- **Chat**: 일반 메시지/전화번호·이메일 플래그/목록 조회/비참여자 403/pending 매칭 400 모두 정상

### 결정
- 테스트 중 Codex가 DB 재생성하면서 mentor@test.com → user_id=3, mentee@test.com → user_id=4로 바뀐 상태. devlog나 테스트 스크립트에 user_id 하드코딩 금지, 항상 /api/users/me로 동적 확인할 것

### 다음
- RAG 파이프라인 연결 (ai/rag/pipeline.py → article 라우터)
- 프론트엔드 연결
- 팀 레포 오픈 후 git 이전

### 주의
- mentor 목록은 is_verified=True 인 멘토만 노출됨. 테스트 계정(mentor@test.com)은 is_verified=False라 목록에 안 나옴 — 정상 동작
- DB에 user_id=3(mentor), 4(mentee) 외 Codex 테스트 잔여 데이터 존재

---

## 2026-04-22 - Claude

### 작업
- `core/config.py` — `chroma_persist_dir` 설정 추가 (기본값 `./chroma_db`)
- `services/rag_service.py` — vectorstore 싱글톤, `ingest_article()`, `query_rag()` 구현
- `schemas/article.py` — `content` 필드 추가 (optional, 있으면 RAG 인덱싱)
- `routers/article.py` — 아티클 등록 시 content 있으면 자동 ingest + chunk_count 업데이트
- `schemas/rag.py` + `routers/rag.py` — `POST /api/rag/query` 엔드포인트

### 결정
- vectorstore를 모듈 레벨 싱글톤으로 관리 (요청마다 Chroma 재생성하면 느림)
- `langchain.schema.Document` → `langchain_core.documents.Document` (langchain 0.3 이후 경로 변경)
- `langchain.text_splitter` → `langchain_text_splitters` (동일 이유)
- 관련 아티클 없을 때 "관련 아티클을 찾을 수 없습니다" 응답하도록 프롬프트에 명시

### 검증
- 아티클 등록 시 content 포함 → chunk_count 자동 업데이트 확인
- OKR 관련 질문 → 정확한 답변 + sources 반환 확인
- 관련 없는 질문 → "관련 아티클을 찾을 수 없습니다" 확인

### 다음
- 멘토 프로필 수정 API (PATCH /api/mentors/me)
- 포인트 충전 API
- 프론트엔드 연결
- 팀 레포 오픈 후 git 이전

### 주의
- chroma_db는 `server/` 디렉토리 기준 `./chroma_db`에 저장됨 (uvicorn 실행 위치 기준)
- article 등록 시 content 없으면 RAG 인덱싱 안 됨 — 나중에 별도 ingest 엔드포인트 필요할 수 있음

---

## 2026-04-22 - Claude

### 작업
- `schemas/mentor.py` — `MentorProfileUpdate` 추가 (bio, specialties, available)
- `routers/mentor.py` — `PATCH /api/mentors/me` 추가
- `schemas/point.py` — `PointChargeRequest` 추가 (100P 이상, 100만P 이하)
- `routers/point.py` — `POST /api/points/charge` 추가

### 결정
- 프로필 수정은 None 필드 무시 (보낸 필드만 업데이트) — PATCH 시맨틱 준수
- 충전 상한선 100만P 설정 (과금 실수 방어)
- `PATCH /api/mentors/me`는 `/api/mentors/{user_id}` 앞에 선언해 라우팅 충돌 방지

### 검증
- bio/specialties/available 수정 후 목록 반영 확인
- 멘티가 수정 시도 → 403
- 5000P 충전 후 잔액 정상 반영
- 100P 미만 충전 → 422

### 다음
- 프론트엔드 연결

### 주의
- `PATCH /api/mentors/me`는 `/me`를 `/{user_id}` 앞에 선언해야 라우팅 정상 동작

---

## 2026-04-24 - Claude

### 작업
- `services/article_service.py` — LLM으로 아티클 keywords/insights 추출 서비스
- `schemas/article.py` — InsightItem, ArticleInsightsResponse 스키마 추가
- `routers/article.py` — `GET /api/articles/{id}/insights` 엔드포인트 추가
- `origin/dev` push — 프레임워크 API + PDF 인제스트 커밋 2개 업로드

### 결정
- DB 스키마 변경 없이 조회 시 LLM 실시간 추출 방식으로 구현 (방향 확정 전 리스크 최소화)
- ChromaDB에서 해당 article_id 청크를 복원해서 LLM 컨텍스트로 활용
- 본문 4000자 truncation으로 토큰 비용 제한
- 인덱싱 안 된 아티클은 422 반환

### 다음
- 서버 기동 후 `/api/articles/{id}/insights` 실제 테스트
- 프론트 담당자 합류 시 해당 엔드포인트 연결
- 팀 방향 확정 후 DB 저장 방식으로 전환 여부 결정

### 주의
- 호출마다 GPT 호출 발생 (캐싱 없음) — 향후 DB 저장 방식으로 전환 시 해결
- ChromaDB filter는 `{"article_id": int}` 형태로 전달

---

## 2026-04-22 - Claude

### 작업
- `schemas/framework.py` — FrameworkGenerate, FrameworkResponse
- `services/framework_service.py` — RAG 기반 프레임워크 생성 (OKR/AARRR/JTBD/Flywheel/린캔버스)
- `routers/framework.py` — 생성/목록/상세/저장토글 API
- Docker 테스트 — Docker Desktop 미설치로 생략, 배포 단계에서 진행 예정

### 결정
- 프레임워크 타입별 전용 프롬프트로 구조화된 JSON 생성 (OKR/AARRR/JTBD/Flywheel/린캔버스)
- LLM 응답에서 마크다운 코드블록 자동 제거 후 JSON 파싱, 실패 시 raw 텍스트로 저장
- 저장 여부는 PATCH /{id}/save 토글 방식

### 검증
- OKR 생성 → structured JSON + referenced_article_ids 반환 확인
- 저장 토글 동작 확인
- 내 목록 조회 확인

### 다음
- 프론트엔드 연결
- Docker 테스트 (Docker Desktop 설치 후)

### 주의
- ChromaDB에 아티클이 없으면 referenced_article_ids=[] 로 빈 컨텍스트로 생성됨 (LLM 자체 지식으로 답변)
- Docker compose의 DB_HOST는 'mysql'(컨테이너명)로 하드코딩 — 학원 DB 쓸 때는 .env의 DB_HOST로 오버라이드 필요

---

## 2026-05-06 - Codex

### 작업
- 기존 멘토링 중심 스키마에서 새 DB 스키마 기준으로 서버 모델 구조 전환
- 삭제한 구 모델 파일
  - `chat.py`
  - `framework.py`
  - `mentoring.py`
  - `point.py`
- 추가한 신규 모델 파일
  - `curriculum.py`
  - `ai_output.py`
  - `output_article_ref.py`
  - `task_submission.py`
  - `chatbot.py`
- 새 데이터 구조에 맞게 schema 파일 전체 재정리
- 삭제한 구 라우터
  - `chat`
  - `framework`
  - `mentor`
  - `mentoring`
  - `point`
- 추가한 신규 라우터
  - `curriculum`
  - `ai_output`
  - `chatbot`
  - `task_submission`
- `user`, `article`, `rag` 라우터를 새 컬럼명 기준으로 수정
- `server/app/main.py` 라우터 등록 구조를 새 앱 구조 기준으로 재작성
- `server/app/core/security.py` 를 `user_email`, `user_pw`, soft delete 기준에 맞게 재작성
- 사용하지 않는 서비스 제거
  - `framework_service.py`
  - `point_service.py`
- `server/.env.example` 에 `CHROMA_PERSIST_DIR` 추가

### 검증
- `import app.main` 통과
- 모델 import 체크 통과
- DB 연결 테스트 `SELECT 1` 통과

### 참고
- `server/.env` 는 이미 존재했고 실제 DB 접속 정보가 들어 있어 별도 실행용 `.env` 파일 생성은 하지 않음
- 현재 기준으로는 새 스키마에 맞는 최소 CRUD 뼈대와 import/DB 연결 정상화까지 완료한 상태

### 다음
- uvicorn 실행 후 Swagger 엔드포인트 수동 점검
- 프론트 전달용 API 명세를 새 curriculum / ai_output / chatbot 흐름 기준으로 재정리
- summary / wordcloud / framework 생성 로직을 `ai_outputs` 중심으로 유지할지, 보조 엔드포인트로 분리할지 결정

### 문서 정리
- `CLAUDE.md` 를 현재 서버 구조 기준으로 재작성
- `README.md` 를 멘토링 플랫폼 설명에서 AI 학습 지원 플랫폼 설명으로 갱신
- 문서 내 예전 `mentor / mentoring / point / framework / chat` 중심 설명 제거

---

## 2026-05-06 - Codex (2)

### 작업
- 현재 작업 폴더(`C:\Users\smhrd\Desktop\landfactory`) 기준 `server/.env` 생성
- `server/venv` 생성 및 `server/requirements.txt` 의존성 설치
- `README.md` 에 `server/app`, `server/scripts`, PDF 인제스트 스크립트 설명 추가
- `docs/devlog.md` 상단 현재 상태 요약을 `dev` 브랜치의 현재 API 구조 기준으로 갱신

### 검증
- `python -m compileall -q server\app` 통과
- `import app.main` 통과
- `GET /health` 200 확인
- `GET /docs` 200 확인
- DB 연결 테스트 `SELECT 1` 통과

### 참고
- `server/.env` 와 `server/venv/` 는 `.gitignore` 기준으로 커밋 제외됨
- uvicorn 실행 시 8000번 포트에 이미 서버가 떠 있어 새 프로세스 하나는 포트 충돌로 종료됐지만, 기존 서버 응답은 정상 확인됨

---

## 2026-05-06 - Codex (3)

### 작업
- `.env`로 연결되는 실제 MySQL DB 기준 테이블/컬럼 구조 확인
- 실제 DB의 8개 테이블과 SQLAlchemy 모델 테이블/컬럼명을 대조
  - `users`
  - `articles`
  - `curriculum`
  - `ai_outputs`
  - `output_article_refs`
  - `task_submissions`
  - `chatbot_sessions`
  - `chatbot_messages`
- DB에서 NULL 허용인 컬럼들이 모델에서는 `nullable=False`로 잡혀 있던 부분을 실제 DB 기준으로 수정
- 기존 데이터에 NULL이 있을 때 응답 변환이 실패하지 않도록 Pydantic response schema도 optional 기준으로 보정

### 검증
- 실제 DB 테이블/컬럼과 모델 컬럼 존재 여부 일치 확인
- 실제 DB nullable 설정과 모델 nullable 설정 일치 확인
- `python -m compileall -q app` 통과
- `import app.main` 통과
- TestClient 기준 `GET /health` 200 확인
- TestClient 기준 `/api/articles`, `/api/articles/categories`는 인증 필요로 401 반환 확인

### 참고
- SQL 파일은 팀원 오푸시 가능성이 있어 이번 점검 기준에서 제외
- 현재 점검 기준은 실제 `.env`의 DB와 `dev` 브랜치 코드

---

## 2026-05-06 - Codex (4)

### 작업
- 실제 DB의 활성 사용자 `user_id=1` 기준으로 테스트 JWT 생성
- DB 쓰기 없이 인증이 필요한 GET API 중심으로 수동 점검

### 검증
- `GET /health` 200
- `GET /api/users/me` 200
- `GET /api/users/1` 200
- `GET /api/articles` 200
- `GET /api/articles/categories` 200
- `GET /api/curricula` 200
- `GET /api/ai-outputs/my` 200
- `GET /api/chatbot/sessions` 200
- `GET /api/task-submissions/my` 200
- `GET /api/articles/1026` 200
- `GET /api/ai-outputs/5` 200

### 참고
- 현재 DB에 `curriculum`, `task_submissions`, `chatbot_sessions` 행이 없어 해당 상세 조회는 건너뜀
- 이번 점검은 TestClient 기반이며 실제 DB에 새 데이터를 생성하지 않음

---

## 2026-05-07 - Codex

### 작업
- `origin/mun_ai` 브랜치 확인
- `mun_ai` 전체 merge는 하지 않고 AI 모델링 산출물만 선별 반영
  - `ai/curr.py`
  - `ai/summary_model.py`
  - `ai/summary/`
  - `ai/curriculum_output/*.md`
  - `ai/requirements.txt`
- `mun_ai`에 포함된 압축 산출물(`.zip`, `.7z`)은 제외
- `mun_ai`의 `server/app`, `DB`, `README.md`, `CLAUDE.md`, `docs/devlog.md` 변경은 현재 `dev` 구조를 되돌릴 위험이 있어 반영하지 않음
- AI 스크립트가 `server/.env`를 읽도록 경로 정리
- AI 모델명을 환경변수로 설정 가능하게 정리
  - `AI_CURRICULUM_MODEL`
  - `AI_SUMMARY_MODEL`
- AI 전용 의존성은 백엔드 서버 의존성과 분리해 `ai/requirements.txt`에 기록

### 검증
- 백엔드 `python -m compileall -q app` 통과
- 백엔드 `import app.main` 통과
- `GET /health` 200 확인
- `python -m py_compile ai\curr.py ai\summary_model.py` 통과
- `ai/curr.py` import 및 로컬 summary JSON 검색 확인
- `ai/summary` JSON 26개 구조 검증 통과
- `ai/curriculum_output` Markdown 4개 공통 heading 구조 확인

### 주의
- `ai/` 폴더는 현재 백엔드 운영 코드가 아니라 모델링/실험 산출물 영역으로 구분
- `ai/rag/pipeline.py`는 기존 실험용 RAG 코드이며, 현재 서버 RAG 기준은 `server/app/services/rag_service.py`
- `ai/summary_model.py` 실제 실행에는 `torch`, `sentence-transformers`, `langchain-chroma`, `langchain-huggingface`, `ddgs` 등 AI 전용 패키지 설치가 필요
- AI 전용 패키지는 무거우므로 `server/requirements.txt`에 섞지 않고 `ai/requirements.txt`로 분리 유지

---

## 2026-05-07 - chanhui (프론트 로그인 연동 + 백엔드 안전성)

### 작업
- 프론트 로그인 API 실연결
  - `client/src/lib/auth.js`: localStorage 기반 토큰 헬퍼 (신규)
  - `client/src/lib/api.js`: axios 인스턴스 + 요청 시 토큰 자동 첨부, 401 응답 시 토큰 자동 클리어 (신규)
  - `client/src/components/Intro.jsx`: 하드코딩 로그인 제거. `POST /api/users/login` + `GET /api/users/me` 실호출, 로딩/에러 상태 추가
  - `client/src/App.jsx`: 새로고침 시 토큰 있으면 `/me`로 세션 복원, `user_role` 기반 화면 분기 (`a` → MasterDashboard, `m`/`j` → Dashboard), 로그아웃 시 토큰 클리어
- `verify_password` 안전 처리
  - bcrypt가 비-bcrypt 형식 해시(시드 더미 등)를 만나면 `UnknownHashError`(ValueError 하위)를 던져 로그인이 500으로 실패하던 버그 수정
  - `try/except (ValueError, TypeError)`로 감싸 False 반환 → 정상 401 흐름
- 의존성/설정 정리
  - `client/package.json`: 미사용 `react-wordcloud@1.2.7` 제거 (react@18 peer 충돌 해소)
  - `client/package-lock.json`: 그에 맞춰 재생성
  - `server/.env.example`: 미사용 `AI_CURRICULUM_MODEL`, `AI_SUMMARY_MODEL` 줄 제거 (`AI_MODEL` 단일 변수로 통합되는 흐름과 일치)

### 검증
- 백엔드 `python -m compileall -q app` 통과
- `verify_password` 단위 테스트: 빈 문자열/`hashed_pw_29`/`foobar` 모두 False 반환 확인
- 로그인 API: 잘못된 자격 증명에 대해 401 응답 확인 (이전엔 500)
- 브라우저 로그인 (Vite 5173, FastAPI 8000):
  - `j` 계정 → Dashboard 라우팅 OK
  - `a` 계정 → MasterDashboard 라우팅 OK
  - 새로고침 시 세션 유지 OK
  - 로그아웃 버튼 → Intro 복귀 OK, 토큰 클리어 OK

### 참고
- DB 시드 일부 사용자는 `user_pw` 컬럼에 평문 placeholder(`hashed_pw_N` 등)가 들어있어 그대로는 로그인 불가. 테스트 시 `app.core.security.hash_password('1234')` 결과로 `UPDATE` 필요
- `client/src/lib/`은 신규 폴더 (axios/auth 모듈 분리)
- Vite dev 서버 proxy(`/api` → `http://localhost:8000`)는 기존 설정 그대로 사용. CORS는 백엔드에서 별도 처리 안 함

