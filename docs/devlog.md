# 개발 로그

팀 레포 오픈 후 git commit message로 이전 예정.

---

## 현재 상태 요약 (2026-04-22 기준)

### 백엔드 완성된 API

| 영역 | 엔드포인트 | 비고 |
|------|-----------|------|
| 회원 | POST /api/users/signup | 가입 시 1000P 자동 지급, mentor면 프로필 자동 생성 |
| | POST /api/users/login | JWT 토큰 발급 |
| | GET /api/users/me | 내 정보 (mentor_profile 포함) |
| | GET /api/users/{user_id} | 특정 유저 조회 |
| 멘토 | GET /api/mentors | is_verified=True, available=True 필터 / industry·keyword 검색 |
| | GET /api/mentors/{user_id} | 멘토 상세 |
| 멘토링 | POST /api/mentoring/request | 멘티 전용, 잔액 확인 후 pending 생성 |
| | PATCH /api/mentoring/{id}/status | 멘토가 수락/거절/취소, 수락 시 포인트 이동 |
| | PATCH /api/mentoring/{id}/complete | 멘토/멘티 모두 완료 처리 가능 |
| | POST /api/mentoring/{id}/review | 멘티가 별점·후기 작성, rating_avg 자동 갱신 |
| | GET /api/mentoring/my | 내 목록 (role 자동 분기, status 필터) |
| | GET /api/mentoring/{id} | 상세 (참여자만) |
| 포인트 | GET /api/points/balance | 내 잔액 |
| | GET /api/points/history | 거래 내역 (limit/offset) |
| 아티클 | POST /api/articles | 인증 필요 |
| | GET /api/articles | category·industry·keyword 필터, 페이지네이션 |
| | GET /api/articles/categories | 카테고리 목록 |
| | GET /api/articles/{id} | 상세 |
| 채팅 | POST /api/chat/{match_id}/messages | accepted 매칭만 허용, 민감정보 자동 감지 |
| | GET /api/chat/{match_id}/messages | 참여자만 조회 |

### 남은 작업

| 항목 | 우선순위 | 비고 |
|------|---------|------|
| RAG 파이프라인 연결 | ~~높음~~ | ✅ 완료 |
| 멘토 프로필 수정 API | ~~중간~~ | ✅ 완료 |
| 포인트 충전 API | ~~중간~~ | ✅ 완료 |
| 프론트엔드 | 높음 | client/src/App.jsx 뼈대만 있음 |
| 팀 레포 오픈 후 git 이전 | 높음 | 팀장 대기 중 |

### 알아두면 좋은 것

- **서버 실행**: `cd server && venv/Scripts/activate && uvicorn app.main:app --reload`
- **Swagger UI**: `http://localhost:8000/docs`
- **환경변수**: `server/.env` 참고 (절대 커밋 금지)
- **mentor 목록**은 `is_verified=True`인 멘토만 노출됨. 테스트 계정은 False라 목록에 안 나오는 게 정상
- **민감정보 감지**: 전화번호·이메일·주민번호 포함 메시지는 저장되되 `is_flagged=True` + 경고 반환
- **포인트 잔액**은 points 테이블 최신 레코드의 balance 컬럼 기준 (별도 집계 없음)
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
- 팀 레포 오픈 후 git 이전
- 프론트엔드 연결

### 주의
- `PATCH /api/mentors/me`는 `/me`를 `/{user_id}` 앞에 선언해야 라우팅 정상 동작
