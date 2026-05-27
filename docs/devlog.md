# 개발 로그

---

## 2026-05-27 - Codex (썸네일 R2 객체 저장소 이전)

### 배경
- `ai/thumbnails/`를 Git 추적에서 제외하면서 팀원 pull 환경에서 아티클 썸네일 파일이 내려오지 않는 문제가 발생.
- 시연 안정성을 위해 임시로 Git에 복구했으나, 장기적으로는 첨부파일과 동일하게 Cloudflare R2에서 관리하는 구조가 적합.

### 변경
- `server/app/services/thumbnail_storage.py` 추가
  - R2 `thumbnails/{filename}` 객체 조회
  - R2 조회 실패 또는 객체 없음 시 기존 로컬 `ai/thumbnails/` fallback 유지
- `server/app/routers/thumbnail.py` 추가
  - `GET /api/thumbnails/{filename}` 라우트에서 R2/로컬 썸네일을 `StreamingResponse`로 반환
- `server/app/services/thumbnail_service.py`
  - 로컬 파일 존재 여부에 의존하지 않고 DB의 `article_thumbnail_filename` 기준 URL 반환
- `server/app/main.py`
  - 기존 `StaticFiles` mount 제거
  - thumbnail router 등록
- `server/scripts/upload_thumbnails_to_r2.py` 추가
  - 로컬 썸네일 파일을 R2 `thumbnails/` prefix로 업로드하는 일회성 스크립트

### 검증
- `python -m compileall -q app scripts` 통과
- `from app.main import app` routes 61 및 `/api/thumbnails/{filename:path}` 등록 확인
- 로컬 fallback 라우트 응답 확인: `200 image/png`
- R2 업로드 완료: 53개
- R2 직접 조회 확인: `image/png`, 정상 Content-Length 반환

---

## 2026-05-27 - Claude (알림 삭제 + 헤더/카드 자잘 UX 정리)

### 배경
- 발표 전 자잘 UX 정리. 시연 동선 위주로 보이는 부분 보강
- 매니저 알림이 쌓일 때 정리할 방법이 "모두 읽음"뿐이라 불편

### 변경 1 — 알림 삭제 (개별 + 일괄)
- 백엔드: `Notification.notif_deleted_at` soft delete 컬럼이 모델·_base_query 필터에 이미 준비돼 있어 엔드포인트 2개만 추가
  - `DELETE /api/notifications/{id}` — 본인 알림 개별 soft delete
  - `POST /api/notifications/clear-read` — 본인 '읽은' 알림 일괄 soft delete (안 읽은 알림 보호)
- 프론트 `NotificationBell.jsx`:
  - 알림 항목 우측에 × 버튼 추가 (평소 숨김, hover 시 노출)
  - 헤더에 "읽은 알림 비우기" 버튼 — 읽은 알림이 있을 때만 표시
  - 삭제 후 클라이언트 list 즉시 반영 + unread count 갱신
- 라우트 수: 59 → 61

### 변경 2 — 헤더 아이콘 정렬 정리
- `.bellIcon`의 음의 margin / `align-self: flex-start` 제거 → 종 아이콘 종·횡 정렬 정상화
- `.bookmarkIcon` `align-self` 제거
- `.headerBookmarkBtn`, `.hamburgerBtn` 박스 36 → 40으로 통일 (아이콘 크기와 매칭)
- `.headerIcons gap` 34 → 20으로 보수적 조정
- `.hamburgerBtn span` 22 → 26 (시각 너비 다른 아이콘과 균형)
- 종 그래픽이 박스 중앙보다 위에 치우친 구조라 `margin-top` 미세 조정 적용 (사용자가 13px로 직접 조정)

### 변경 3 — NotificationBell hover 통일
- `.notifBellBtn` 옅은 회색 배경 박스 제거 → 다른 헤더 버튼과 동일하게 `transform: scale(1.08)`만 사용

### 변경 4 — 알림 드롭다운 전환 정리
- 드롭다운 등장 애니메이션: 0.18s ease-out (`opacity` + `translateY(-6px)` + `scale(0.98)`)
- 라운드 8 → 12, 그림자 이중으로 부드럽게
- 알림 항목 hover 영역을 `.notifItemRow`로 확장 (X 버튼 영역까지 같이 강조)
- X 버튼 hover 시 `scale(1.1)` + 빨강 톤
- 헤더 액션 버튼 hover 시 opacity 살짝 감소

### 변경 5 — 학습자 칩 hover
- `.assignedLearnerChip` 클릭 가능했지만 cursor·hover 효과 0 → cursor pointer + hover 시 primary 그린 border/color + 옅은 box-shadow + 배지도 같이 primary 톤
- `:not(.active)` 적용해 학습자 시점으로 선택된 칩과 색 충돌 방지

### 변경 파일
- 백엔드: `server/app/routers/notification.py`
- 프론트: `client/src/components/NotificationBell.jsx`, `client/src/styles/NotificationBell.css`, `client/src/styles/Dashboard.css`, `client/src/styles/Curriculum.css`

### 검증
- `python -m compileall -q app` 통과
- `from app.main import app` → routes 61 확인
- `npm run build` 통과

---

## 2026-05-27 - Claude (마감일 DatePicker 도입 — react-datepicker)

### 배경
- 양식 배포 모달의 마감일 입력이 네이티브 `<input type="date">` + 모달 헤더 한 줄에 끼어있어 시각 비중 낮고 브라우저별 외관 들쭉날쭉
- 매니저가 한눈에 D-Day를 못 봤고 빠른 선택지 없음

### 변경 — react-datepicker 11 도입
- 의존성 추가: `react-datepicker`, `date-fns` (peer)
- `CurriculumView.jsx` 상단에서 `registerLocale('ko', ko)` 1회 등록
- 모달 레이아웃 재배치:
  - **헤더에서 마감일 영역 제거** (AI 재작성/전체보기 버튼만 남김)
  - **본문 상단(에디터 위)에 별도 영역 신설**: 마감일 라벨 + DatePicker + D-Day 배지 + 빠른 선택 칩
- DatePicker 설정:
  - `dateFormat="yyyy.MM.dd (eee)"` 한국어 요일 표시
  - `locale="ko"` / `minDate={new Date()}` (지난 마감일 차단)
  - `showPopperArrow={false}` / `calendarClassName="templateDeadlineCalendar"` 우리 톤 매핑
- 빠른 선택 칩: 오늘 기준 `+1주 / +2주 / +4주` 3개
- D-Day 배지: 기존 `getDDayString` 재사용 → 날짜 옆에 표시
- 헬퍼 `formatDateLocal(date)`: 기존 컨벤션(`yyyy-MM-dd` 문자열)과 호환되게 변환

### 디자인 톤 매핑 (Curriculum.css)
- 입력 input: 라운드 8px / focus 시 `--primary` (#4A7C59) green ring
- 캘린더 popup: 흰 카드 + 옅은 shadow + 라운드 8px
- 선택된 날 / 오늘: `--primary` green
- 일요일: 빨강 유지 (한국 컨벤션)
- 빠른 선택 칩: 회색조 알약 + hover 시 green border
- D-Day 배지: 빨강 톤 알약

### 변경 파일
- 수정: `client/src/components/CurriculumView.jsx`, `client/src/styles/Curriculum.css`
- 의존성: `client/package.json` (`react-datepicker`, `date-fns` 추가)

### 검증
- `npm run build` 통과 (모듈 592 → 912, index.js gzip 340 → 390KB ≈ +50KB)
- vite chunk-size 경고는 기존 사항

### 검수 권장 시나리오
1. 양식 배포 모달 열기 → 본문 상단에 마감일 영역 노출 확인
2. DatePicker 클릭 → popup 캘린더 우리 톤(green/round) 적용 확인
3. 오늘 이전 날짜 선택 불가 (회색)
4. `+1주` 칩 클릭 → 1주 뒤 날짜 자동 입력 + 옆에 D-7 배지 표시
5. 한국어 요일 (`수`, `목`...) 표시 확인

### 후속
- 기존 사용 안 되는 `.template-deadline-label`, `.template-deadline-input` CSS 클래스 남아있음. 정리는 V2

---

## 2026-05-27 - Claude (학습자 진행률 + 마감일/양식 1회 배포 검증 + RAG 캐시)

### 배경
- 발표 직전 임팩트 묶음. 직전 사이클(매니저 피드백 강화) 위에 학습자 측 가시성·운영 안정성·시연 속도 보강
- `task_deadline` 컬럼은 풀로 들어와 있지만 검증 로직이 없어 마감 의미 없음 / 양식이 한 번 배포된 후 학습자 작업 중 매니저가 임의 수정 가능 / 동일 RAG 검색어를 매번 LLM 호출

### 변경 1 — RAG 검색어 LRU 캐시
- `services/rag_service.py::transform_query_for_search` 에 `@functools.lru_cache(maxsize=512)` 적용
- 동일 검색어 재입력 시 LLM 호출 0 → 응답 속도 / OpenAI 비용 절감
- 결정적이지 않은 LLM 응답이지만 검색어 정규화 용도라 같은 입력에 같은 결과 돌려주는 게 UX상 일관적

### 변경 2 — 학습자 진행률 + 마지막 활동 시각
- `schemas/user.py::UserActivitySummary` 에 `progress_avg: int = 0`, `last_activity_at: datetime | None = None` 추가
- `routers/user.py::get_user_activity_summary` 학습자(j) 한정 진행률 계산:
  - 배정 활성 커리큘럼들의 `cur_week_plan` 에서 주차 목록 추출
  - 학습자의 `(cur_id, week)` distinct 제출 집합과 교집합 → done_weeks
  - `int(round(100 * done_weeks / total_weeks))`
  - cur_week_plan이 list가 아닐 경우 `cur_duration_weeks` 폴백
- `last_activity_at` = `MAX(task_submitted_at)` (학습자 본인 제출 기준)
- 프론트 `LearnerManagementView`:
  - 학습 활동 요약 섹션 통계 카드 위에 `.learner-progress-bg` 진행률 바 + `진행률 N%` 텍스트
  - 우측에 "최근 활동: N일 전" (custom `formatRelative` 헬퍼)
  - 기존 통계 카드 그리드(3컬럼)는 그대로 유지
  - inline `style={{ marginTop: '8px' }}` 정적 값 제거 (CLAUDE.md inline style 룰)

### 변경 3 — 마감일 검증 (백엔드)
- `routers/task_submission.py` 신규 헬퍼 `_week_max_deadline(curriculum, week_number)`:
  - `cur_week_plan[week].assignments[].deadline` ISO 문자열 파싱 → `tzinfo=UTC` 보정 후 max
  - 주차 내 모든 deadline이 비면 None 반환 → 검증 skip(마감 없는 과제)
- `create_submission`에서 deadline 지난 경우 400 `"제출 마감일이 지났습니다"`
- 통과 시 새 `TaskSubmission.task_deadline` 컬럼에 해당 max deadline 채워 감사·통계용으로 보관

### 변경 4 — 양식 1회 배포 검증 (학습자 제출 후 잠금)
- `routers/curriculum.py` 신규 헬퍼 `_weeks_with_template_changed(old_wp, new_wp)`:
  - 기존 `template_content`가 set돼 있고 새 값이 다른 주차만 set 반환 (첫 set은 변경으로 보지 않음)
- `update_curriculum` PATCH에서 `cur_week_plan` 들어오면 위 헬퍼로 변경 주차 추출 → `TaskSubmission`에 같은 (cur_id, week) 제출이 1건이라도 있으면 400 `"이미 학습자 제출이 있는 양식은 수정할 수 없습니다: N주차"`
- `deadline` 변경은 제외 (마감 연장은 허용)
- 정책 의도: 학습자가 양식 보고 작업을 시작한 주차는 매니저가 임의 수정해서 학습자를 혼란시키지 않도록 보호

### 변경 파일
- 백엔드: `services/rag_service.py`, `schemas/user.py`, `routers/user.py`, `routers/task_submission.py`, `routers/curriculum.py`
- 프론트엔드: `components/LearnerManagementView.jsx`, `styles/LearnerManagement.css`

### 검증
- `python -m compileall -q app` 통과
- `npm run build` 통과 (vite chunk-size 경고는 기존 사항)

### 검수 권장 시나리오
1. 매니저 계정으로 학습자 관리 페이지 → 좌측 학습자 선택 → 우측 "진행률 N%" 바 + "최근 활동: N일 전" 표시 확인
2. 학습자 계정으로 마감일 지난 과제 제출 시도 → 400 차단 확인
3. 학습자가 1주차 제출 완료 후 → 매니저가 1주차 양식 수정 시도 → 400 차단 확인, 마감일 연장은 통과
4. 같은 검색어로 RAG 검색 2회 반복 → 두 번째 응답 시간 단축 (LLM transform 캐시 적중)

### 후속
- 학습자 진행률 좌측 카드 배지 노출은 N+1 호출 우려로 보류 (서버에 batch endpoint 도입 후 V2)
- 첫 set + 즉시 잠금 같은 더 엄격한 양식 정책은 동현님 합의 시 V2

---

## 2026-05-27 - Claude (매니저 피드백 강화 + task_score 제거)

### 배경
- 학습자 관리 페이지(`LearnerManagementView`)가 "최근 제출 이력" 카드만 노출하고 클릭 액션이 없어 매니저가 피드백을 주려면 CurriculumView로 이동해야 했음
- `task_score` 컬럼은 모델/스키마/라우터에 존재하지만 UI 입력이 없어 줄곧 NULL로 유지되던 죽은 필드 → 팀 결정으로 제거 (DB 컬럼 DROP은 팀원이 별도 처리)

### 변경 1 — task_score 코드 참조 제거
- `models/task_submission.py`: `task_score` 컬럼 정의 제거
- `schemas/task_submission.py`: `TaskSubmissionFeedbackUpdate` 입력 / `TaskSubmissionResponse` / `TaskSubmissionWithLearnerResponse` 3곳에서 필드 제거
- `routers/task_submission.py`: `_submission_response`, by-curriculum 응답 매핑, `update_feedback` PATCH 본문 처리 3곳 제거
- DB 컬럼은 NULL인 채로 유지 (CLAUDE.md 폐기 chatbot 패턴과 동일). 다른 팀원 환경 영향 없음

### 변경 2 — LearnerManagementView 제출 카드 인라인 펼침
- 제출 카드 클릭 시 그 자리에서 본문(`task_submitted_content.text`) + 첨부파일 + 매니저 피드백(작성/수정/표시) 영역이 펼쳐짐
- CurriculumView의 매니저 피드백 패턴과 동일 UX. 기존 `managerSubmission*` / `managerFeedback*` / `learner-submission-*` / `learner-feedback-*` 클래스 재사용 위해 `Curriculum.css` import 추가
- 한 번에 하나만 펼침 (`expandedSubmissionId` 단일 상태). 학습자 전환 시 자동 닫힘
- 피드백 저장 후 활동 요약 카운트 재요청해 우측 통계 카드 즉시 갱신

### 변경 3 — 재제출 요청 시 피드백 필수 검증 (프론트 + 백엔드)
- 프론트: `handleFeedbackSave`에서 빈 텍스트일 때 status별 메시지 분기 ("재제출 사유를 입력해야 합니다" / "피드백 내용을 입력하세요"). CurriculumView·LearnerManagementView 양쪽 동일
- 백엔드: `PATCH /task-submissions/{id}/feedback` 에서 `task_manager_feedback` strip 후 빈 값이면 400. status가 resubmit_requested 일 때는 메시지 분기. 프론트 우회(직접 API 호출) 차단

### 변경 4 — 빠른 코멘트 템플릿
- 신규 `client/src/lib/feedbackTemplates.js`: `FEEDBACK_QUICK_COMMENTS` 4개 + `appendQuickComment(current, comment)` 헬퍼 (기존 텍스트가 있으면 줄바꿈 후 append)
- 텍스트:
  1. "수고하셨습니다 :)"
  2. "좋은 시도예요. 다음 부분을 더 보완해 주세요."
  3. "이 부분을 다시 정리해 주시면 좋겠어요."
  4. "관련 아티클을 참고해 보완해 주세요."
- UI: 피드백 textarea 위에 chip 버튼 영역. 클릭 시 textarea에 이어 붙음 (덮어쓰기 X)
- CSS: `Curriculum.css` 끝에 `.quickCommentChips` / `.quickCommentChip` 추가 (양쪽 컴포넌트가 Curriculum.css import)

### 변경 파일
- 백엔드: `models/task_submission.py`, `schemas/task_submission.py`, `routers/task_submission.py`
- 프론트엔드: `components/LearnerManagementView.jsx`, `components/CurriculumView.jsx`, `styles/LearnerManagement.css`, `styles/Curriculum.css`
- 신규: `client/src/lib/feedbackTemplates.js`

### 검증
- `python -m compileall -q app` 통과
- `npm run build` 통과 (vite chunk-size 경고는 기존 사항)

### 후속
- DB `task_submissions.task_score` 컬럼 DROP은 팀원이 별도 처리 예정
- 인수인계 1번(백엔드 마감일·양식 1회 배포 검증)은 본 사이클에서 다루지 않음 — `cur_deadline` → `task_deadline` 모델 이동된 상태라 별도 사이클에서 재정의

---

## 2026-05-26 - Claude (sort_buffer 헬퍼 추출 + JSON_TABLE 푸시다운 + 페이지네이션)

### 배경
- 직전 사이클(JSON 풀스캔 #1·#4) 의 연장. A 그룹 나머지 #1(curriculum 측) / #2 / #3 처리
- 동현님이 `cur_deadline` 컬럼 추가 푸시한 직후로 라우터 영역은 동현님 변경과 겹치지 않음 확인하고 진행

### #2 — sort_buffer 우회 헬퍼 추출

신규 `server/app/core/db_helpers.py` 에 `fetch_in_order(db, id_query, model_class, pk_attr)` 헬퍼:
- 1단계: `id_query` (이미 정렬·필터된 PK만 SELECT) 실행
- 2단계: `WHERE pk IN (...)` 로 본 row 조회 후 1단계 순서대로 재정렬

복붙돼 있던 4곳을 헬퍼 호출 1줄로 치환:
- `curriculum.py` `list_curricula`
- `task_submission.py` `list_my_submissions`
- `task_submission.py` `list_submissions_by_learner`
- `task_submission.py` `list_submissions_by_curriculum`

동작 동일, 코드량 대폭 축소, sort buffer 정책 변경 시 한 곳만 수정하면 됨

### #1-curriculum — `get_curriculum_stats` active_learners JSON_TABLE 푸시다운

기존: 모든 활성 커리큘럼의 `cur_assigned_learner_ids` 컬럼 SELECT → Python 측 set 합집합 cardinality

변경: MySQL 8 `JSON_TABLE` 로 DB 측에서 합집합 cardinality 계산
```sql
SELECT COUNT(DISTINCT jt.learner_id)
FROM curriculum c
CROSS JOIN JSON_TABLE(
    IFNULL(c.cur_assigned_learner_ids, JSON_ARRAY()),
    '$[*]' COLUMNS(learner_id BIGINT PATH '$')
) jt
WHERE c.cur_deleted_at IS NULL AND c.cur_status = 'active'
```
- `IFNULL(col, JSON_ARRAY())` 로 NULL 컬럼 안전 처리
- **MySQL 8.0.4+ 필수** (JSON_TABLE)

### #3 — 페이지네이션 누락 라우터 3개

| 라우터 | 기본 limit | 최대 |
|---|---|---|
| `GET /api/curricula` | 100 | 500 |
| `GET /api/task-submissions/by-curriculum/{cur_id}` | 100 | 500 |
| `GET /api/users/learners` | 200 | 500 |

- 응답 형태는 기존 `list[...]` 그대로 유지 (백워드 호환)
- 프론트 변경 불필요 — limit 안 보내면 100/200 default 적용
- 100~200 초과 데이터가 있는 경우 잘릴 수 있음 → 추후 응답을 `{items, total}` 로 wrap 하는 V2 작업 가능

### 변경 파일
- 신규: `server/app/core/db_helpers.py`
- 수정: `server/app/routers/curriculum.py`, `task_submission.py`, `user.py`

### 검증
- `python -m compileall -q app` 통과
- `python -c "from app.main import app"` 통과 (59 routes 그대로)
- 회귀 확인은 실제 매니저/학습자 로그인 후 목록 화면 정상 조회로 진행

### 단톡 안내 사항
- DB / .env / 의존성 / 프론트 변경 없음 — pull만 받으면 됨
- MySQL 8.0.4+ 가정 (JSON_TABLE 사용). 미만 버전이면 `/api/curricula/stats` 호출 시 에러 가능 — 확인 필요

---

## 2026-05-26 - Claude (JSON 풀스캔 제거 + json_contains 인자 정합화)

### 배경
- 보안/성능 검토 시 짚어뒀던 A-1, A-4 항목 처리
- 학습자 활동 요약 조회 시 모든 커리큘럼을 Python 측에 적재하던 패턴 폭발 위험
- `func.json_contains(col, str(user_id))` 형태가 MySQL JSON 매칭 규칙상 미묘한 문제 가능

### 변경

**`server/app/routers/user.py` — `get_user_activity_summary`**
- 학습자(j)의 배정 커리큘럼 수 카운트
- 기존: 모든 활성 커리큘럼의 `cur_assigned_learner_ids` JSON 컬럼을 SELECT 한 뒤 Python 루프로 `in` 체크 (커리큘럼 수에 비례한 선형 폭발)
- 변경: `JSON_CONTAINS(col, JSON.dumps(uid))` 푸시다운으로 DB 측 카운트 한 번 호출
- 응답 형태/값 동일

**`server/app/routers/curriculum.py` — `_scope_curriculum_query`**
- 학습자(j) 본인 배정 커리큘럼 필터
- 기존: `json_contains(col, str(user.user_id))` — 두 번째 인자가 "5" 같은 plain string. MySQL이 JSON 문서로 파싱 성공 시 동작했지만 의도 불명확
- 변경: `json.dumps(user.user_id)` 사용으로 JSON 정수 스칼라 명시 (`5`)
- 동작 변화는 없으나 의도 명확화 + edge case 방어

### 보류
- `curriculum.py` `get_curriculum_stats` 의 `active_learners` 합집합 계산
  - 현재 모든 활성 커리큘럼의 JSON 컬럼만 SELECT 후 Python 측 set 합집합
  - SQL 푸시다운하려면 `JSON_TABLE` (MySQL 8+) 필요 — 별도 사이클 작업
  - 관리자 1명만 보는 통계 API이고 컬럼 1개만 SELECT 하므로 sort buffer 폭발 위험은 없음

### 검증
- `python -m compileall -q app` 통과
- `python -c "from app.main import app"` 통과 (59 routes)
- 회귀 테스트는 학습자(j)로 로그인 후 활동 요약 / 커리큘럼 목록 정상 조회 시 수동 확인

---

## 2026-05-26 - Claude (레이트 리미트 도입 — slowapi 기반 5개 라우터 보호)

### 배경
- 보안 검토 시 "로그인·회원가입 brute force 가능, AI 호출 비용 폭주 가능, 저자 메일 남발 가능" 짚어둔 상태
- 강사님이 "이메일링 관련 Firebase 의견" 주셨는데, 본 의도는 저자 메일 남발 방지 → DB 없이 메모리 기반 레이트 리미트로 해결 가능 판단
- DB 변경 없이 의존성 1개만 추가하는 방향

### 도입 라이브러리
- `slowapi>=0.1.9` — FastAPI 표준 레이트 리미트 라이브러리
- 메모리 백엔드 (서버 재시작 시 카운트 초기화)
- key 함수: `get_remote_address` (클라이언트 IP 기반)
- 단일 인스턴스 운영 가정. 다중 인스턴스 확장 시 Redis 백엔드 권장

### 신규
- `server/app/core/limiter.py` — `Limiter` 인스턴스 + key 함수

### 수정
- `server/app/main.py`
  - `app.state.limiter` 설정
  - `RateLimitExceeded` 예외 핸들러 (429 응답)
  - `SlowAPIMiddleware` 추가
- `server/requirements.txt` — `slowapi>=0.1.9` 추가

### 보호 라우터 5개

| 라우터 | 제한 | 의도 |
|---|---|---|
| `POST /api/users/login` | 10/minute | 브루트포스 방어 |
| `POST /api/users/signup` | 5/hour | 봇 가입 방어 |
| `POST /api/authors/{id}/email` | 5/hour, 20/day | 저자 메일 남발 방어 |
| `POST /api/curricula/generate` | 10/hour | OpenAI 비용 폭주 방어 |
| `POST /api/curricula/generate-template` | 20/hour | 템플릿 LLM 호출 폭주 방어 |

- 모든 라우터에 `@limiter.limit("…")` 데코레이터 + 함수 시그니처에 `request: Request` 인자 추가
- 클라이언트 호출 시 차이 없음 (FastAPI가 Request 자동 주입)

### 제한 수치 결정 근거
- **시연 중 안 막히게 보수적으로** 잡음
- 학습자 1명이 발표 시연에서 저자 메일 3통 보내도 여유
- AI 커리큘럼 생성도 10번까지 가능 — 매니저 시연 충분

### DB 없이 갈 때의 한계 (감안)
1. 서버 재시작 시 카운트 초기화 (메모리 백엔드)
2. 발송 이력 분석/추적 불가 (`author_email_logs` 같은 테이블 없음)
3. "같은 저자에게 7일에 1통" 같은 수신자별 정책 X (sender 기준만)
4. 여러 서버 인스턴스로 확장 시 정확도 떨어짐
- → V2에서 `author_email_logs` 테이블 추가 시 1·2·3 해결

### 검증
- `python -m compileall -q app` 통과
- `python -c "from app.main import app"` 통과 (59 routes)
- 실제 429 응답 확인은 시연 직전 수동 테스트로 진행

### 단톡 안내 사항
- `slowapi` 의존성 추가 — pull 후 `pip install -r requirements.txt` 한 번 필요
- `.env` / DB / package.json 변경 없음

---

## 2026-05-26 - Claude (알림 기능 1차 구현 — 헤더 🔔 + DB 기반 알림함)

### 배경
- 기존 "알림" 표면은 `react-toastify` 인앱 토스트뿐. 페이지 새로고침 시 사라지고 안 읽음 카운트도 없음
- 매니저↔학습자 양방향 흐름이 핵심인데 toast로는 "내가 자리 비운 사이 발생한 이벤트"를 알 수 없음
- 발표 시연 임팩트 + 매니저 운영 가시성 확보를 위해 **DB 기반 알림함**으로 새로 구현

### 1차 범위
- 알림 종류 3종 (V2 확장 여지 남김)
  - `submission_received` — 학습자 제출 → 커리큘럼 생성한 매니저
  - `feedback_received` — 매니저 피드백 → 제출 학습자
  - `resubmit_requested` — 매니저 재제출 요청 → 제출 학습자
- 인앱 드롭다운만 (이메일·WebSocket·푸시는 V2)
- 60초 폴링 기반

### DB
- `notifications` 테이블 신규 (DB 팀원이 별도 적용)
- 컬럼: `notif_id`, `notif_user_id`(FK users), `notif_type`(VARCHAR(30)), `notif_title`, `notif_body`, `notif_link`, `notif_ref_type`, `notif_ref_id`, `notif_read_at`, `notif_created_at`, `notif_deleted_at`
- 인덱스: `(notif_user_id, notif_created_at DESC)`, `(notif_user_id, notif_read_at)`
- `notif_type`은 ENUM 대신 VARCHAR — 종류 확장 시 ALTER 부담 회피
- `ref_type/ref_id` 폴리모픽 참조 — 향후 "커리큘럼 삭제 시 관련 알림 정리" 같은 작업 대비

### 백엔드 신규
- `server/app/models/notification.py`
- `server/app/schemas/notification.py` — `NotificationResponse`, `NotificationListResponse`, `NotificationUnreadCountResponse`
- `server/app/services/notification_service.py` — `create_for_user(...)` 헬퍼 + 타입 상수 3개
- `server/app/routers/notification.py` — 4개 API
  - `GET /api/notifications?limit=20&unread_only=false` (목록 + unread_count 동봉)
  - `GET /api/notifications/unread-count` (폴링용 경량)
  - `PATCH /api/notifications/{id}/read`
  - `POST /api/notifications/read-all`

### 백엔드 수정
- `server/app/main.py` — `notification` 라우터 include + `Notification` 모델 import (`Base.metadata.create_all`로 dev 환경에서도 자동 생성 보조)
- `server/app/schemas/__init__.py`, `models/__init__.py` — export 추가
- `server/app/routers/task_submission.py` 트리거 2곳 삽입
  - `POST ""` (create_submission) → 매니저에게 `submission_received`
  - `PATCH /{id}/feedback` (update_feedback) → 학습자에게 `feedback_received` 또는 `resubmit_requested` (task_status 분기)
  - 알림 생성 실패가 본 도메인 동작에 영향 주지 않도록 `try/except`로 감쌈

### 프론트
- 신규
  - `client/src/components/NotificationBell.jsx` — 🔔 버튼 + 빨간 unread 배지 + 드롭다운(최근 20개) + 60초 폴링 + 클릭 시 read 처리 + 외부 클릭 시 닫힘
  - `client/src/styles/NotificationBell.css` — theme 변수 기반 (하드코딩 없이 `var(--card/--line/--ink/--primary/--bg-alt)`)
- 수정
  - `client/src/components/Header.jsx` — 북마크 버튼 우측에 `<NotificationBell onViewChange={onViewChange} />` 1줄 삽입

### 라우팅
- `notif_link` 형식: `dashboard:{view}:{id}` (예: `dashboard:curriculum:123`)
- 클릭 시 view 이름만 파싱해서 `onViewChange(view)` 호출 (학습자/매니저 둘 다 `curriculum` view로 이동)
- 깊은 deep linking (특정 제출물까지 자동 펼침)은 V2

### 검증
- `python -m compileall -q app` 통과
- `npm run build` 5.23s 통과
- API 동작 확인은 실 사용 단계에서 진행

### DB 팀원 적용 스키마 (실제 운영본)
- 내 원안 대비 강화됨 — 그대로 수용
  - `notif_type` VARCHAR(50) — 원안 30 → 여유 확보
  - `notif_dedupe_key` VARCHAR(150) + UNIQUE `(notif_user_id, notif_dedupe_key)` — 중복 알림 방지 키
  - FK `ON DELETE RESTRICT ON UPDATE RESTRICT` — 사용자 삭제 안전장치
  - 인덱스 3개 (read_at·deleted_at 다 포함된 복합 인덱스 + ref 인덱스)
- 모델/서비스 동기화 완료 — `notif_dedupe_key` 컬럼 추가, `notif_type` 길이 50으로 일치
- 현재 트리거는 `dedupe_key` 를 NULL 로 둠 (MySQL UNIQUE는 NULL 다중 허용)
- 향후 "동일 이벤트 중복 알림 방지"가 필요해지면 트리거에서 `dedupe_key` 채워 호출

### 단톡 안내 사항
- requirements.txt / .env / package.json 변경 없음 — pull만 받으면 됨

---

## 2026-05-22 - Codex (매니저 커리큘럼별 제출 조회 500 수정)

### 배경
- 학습자가 과제를 제출해도 매니저 커리큘럼 관리 화면에서 제출물이 보이지 않음.
- 학습자 과제 제출 화면에서 파일 선택 후에도 첨부파일 목록에 파일명이 표시되지 않음.
- 실제 데이터는 `task_submissions`에 저장되어 있었고, `GET /api/task-submissions/by-learner/{id}`는 200으로 정상 응답.
- 반면 매니저 화면이 사용하는 `GET /api/task-submissions/by-curriculum/{cur_id}`는 500으로 실패.

### 원인
- `LearnerCurriculumView`의 파일 선택 핸들러가 `setSubmitFiles((prev) => ... e.target.files ...)` 형태로 state updater 안에서 `e.target.files`를 늦게 읽음.
- 직후 `e.target.value = ''`로 input을 비워 같은 파일 재선택을 허용하면서, updater 실행 시점에는 files가 비어 첨부 목록이 추가되지 않을 수 있었음.
- `/by-curriculum`이 `TaskSubmission + User` 전체 row를 조인한 상태로 `ORDER BY task_week_number, task_submitted_at`을 수행.
- `task_submitted_content`의 HTML/JSON이 큰 row로 함께 sort buffer에 적재되면서 MySQL `Out of sort memory` 발생.
- 프론트는 해당 실패를 `setSubmissions([])`로 삼켜서 화면상 “제출 없음”처럼 보였음.

### 수정
- 파일 선택 시 `const files = Array.from(e.target.files || [])`로 먼저 복사한 뒤 `setSubmitFiles`에 반영.
- `/by-curriculum`도 `/my`, `/by-learner`와 같은 2단계 조회로 변경.
  - 1단계: `task_submission_id`만 정렬 조회
  - 2단계: `id IN (...)`으로 실제 제출 row 조회 후 파이썬에서 원래 순서 복원
  - 학습자 이름/이메일은 별도 `User` 조회로 매핑
- 프론트 `CurriculumView`에서 제출물 조회 실패 시 조용히 숨기지 않고 toast 에러 표시.

### 검증
- `python -m py_compile server/app/routers/task_submission.py` 통과
- `npm run build` 통과
- 실제 API 확인:
  - 수정 전: `/api/task-submissions/by-curriculum/2079` → 500
  - 수정 후: `/api/task-submissions/by-curriculum/2079` → 200, 재호출 313ms

---

## 2026-05-22 - Claude (매니저 학습자 관리 → 분할 뷰 + theme 톤 재구성 / 커리큘럼 배정 동선 통합)

### 배경
- 직전 사이클에서 학습자 관리는 "리스트 + 모달 상세" 구조였음
- 매니저는 학습자를 자주 옮겨가며 비교/배정해야 하는데 모달은 좁고 컨텍스트 단절이 큼
- 프론트 담당 팀원이 `theme.css` 의 `--bg / --bg-alt / --ink / --ink-muted / --primary / --line / --card / --accent` 톤으로 통일 요청 → EmailingView 와 같은 패턴/색감으로 재구성

### 구조 변경
- **분할 뷰**: 좌측(초대 코드 + 검색/정렬 + 학습자 카드 리스트) ↔ 우측(선택된 학습자 상세)
- 좌측 카드 클릭 → 우측 상세 패널 갱신, 활동 요약 API (`GET /users/{id}/activity-summary`) 호출
- 우측 상세에 커리큘럼 배정 섹션 인라인 통합 (모달 안의 모달 X)

### 변경 파일
- 신규 (전면 재작성) `client/src/components/LearnerManagementView.jsx`
  - 분할 뷰 + selectedLearnerId 따라 우측 패널 컨텐츠 전환
  - 커리큘럼 목록은 한 번만 로드 (`GET /curricula`), 학습자 선택 변경 시 재호출 안 함
  - 활동 요약은 학습자별로 캐시 없이 매번 조회 (가벼움)
  - 커리큘럼 배정 흐름: 관리 버튼 → 체크박스 편집 → 저장 시 변경된 커리큘럼만 PATCH 병렬 호출
- `client/src/styles/LearnerManagement.css` 전면 재작성
  - 모든 색을 `var(--*)` 변수로 통일 (하드코딩 `#3182ce / #1a202c` 등 제거)
  - 분할 그리드 레이아웃 (좌 280-380px / 우 1fr)
  - 900px 이하에선 단일 컬럼으로 stack
- 삭제 `client/src/components/LearnerDetailModal.jsx`
  - 분할 뷰 우측에 흡수돼 사용처 사라짐

### 검증
- 프론트 `npm run build` 통과 (4.84s)
- 백엔드/의존성/마이그레이션 변경 없음

### 메모
- 매니저 학습자 운영 흐름이 이메일링과 시각적으로 통일됨
- 발표 시 "한 화면에서 학습자 비교 → 배정 → 활동 확인" 가능

---

## 2026-05-22 - Claude (학습자 과제 첨부파일 업로드 fix + 제출 이력 sort buffer 폭발 수정)

### 증상
1. 학습자가 과제 작성 후 파일 첨부해 제출하면 **첨부파일이 서버에 안 올라감**
2. 학습자 페이지 진입 시 `/api/task-submissions/my` 가 **500 (Internal Server Error)** 으로 응답

### 원인 1) 첨부 업로드 — Content-Type 헤더 수동 지정
- `LearnerCurriculumView.jsx` 의 첨부 업로드 요청에서 `headers: { 'Content-Type': 'multipart/form-data' }` 명시
- multipart 요청은 `boundary` 파라미터가 필수 (`multipart/form-data; boundary=----WebKit...`)
- 수동 지정하면 boundary 가 빠져서 서버가 form 파트 구분 못 함 → 빈 파일/422
- axios 는 FormData 가 body 면 알아서 boundary 포함한 Content-Type 을 설정. 수동 지정은 그 자동 동작을 깨뜨림

### 수정 1)
- `client/src/components/LearnerCurriculumView.jsx` 의 attachments POST 호출에서 `headers` 옵션 제거
- 동일 패턴이 다른 곳엔 없음 (grep 0건 확인)

### 원인 2) `/my` 500 — sort buffer 폭발
- 어제 `/api/curricula` 에서 발견한 `pymysql (1038, Out of sort memory)` 와 동일 패턴
- `db.query(TaskSubmission).filter(...).order_by(task_submitted_at.desc()).all()` 가 SELECT * 라
  `task_submitted_content` (HTML JSON), `task_manager_feedback` 등 큰 컬럼이 모두 sort buffer 로 적재
- MySQL 기본 `sort_buffer_size` (256KB) 만으로는 row 몇 개만 있어도 폭발

### 수정 2)
- `server/app/routers/task_submission.py` 의 `list_my_submissions` 와 신규 `list_submissions_by_learner` 둘 다
  - 1단계: `task_submission_id` 만 SELECT + ORDER BY → sort 비용 거의 0
  - 2단계: `id IN (...)` 로 PK 직 fetch + 파이썬에서 원래 순서로 재정렬
- 응답 schema/권한 로직 변경 없음

### 검증
- 프론트 `npm run build` 통과 (5.03s)
- 백엔드 `python -m compileall -q app` 통과
- 실 사용: 학습자 로그인 → 과제 화면 진입 (`/my` 200) → 파일 첨부 → 제출 (`/attachments` 200) 흐름 확인 필요

### 메모
- 의존성/마이그레이션 변경 없음
- `/by-curriculum` 도 동일 패턴이지만 per-curriculum row 수가 적어 현재 폭발 X. 추후 데이터 증가 시 같은 fix 가능

---

## 2026-05-22 - Claude (학습자 관리 분할 뷰 + theme 톤 + 레이아웃 안정화 + 제출 이력 추가)

### 배경
- 직전 사이클에서 매니저 학습자 관리는 "리스트 + 모달 상세" 구조
- 학습자 간 비교/배정이 잦은 매니저 동선에선 모달이 컨텍스트 단절 → 분할 뷰가 자연스러움
- 프론트 담당 팀원이 `theme.css` 변수(`--bg / --bg-alt / --ink / --ink-muted / --primary / --line / --card / --accent`)로 톤 통일 요청 (EmailingView 와 동일 색감)
- 우측 패널 콘텐츠가 변하면 학습자별로 좌측 카드 폭 / 우측 패널 폭이 미세하게 움직이는 issue 발견

### 구조 변경 — 분할 뷰
- `LearnerDetailModal.jsx` 폐기 (우측 패널 인라인 흡수)
- `LearnerManagementView.jsx` 전면 재작성: 좌측(초대 코드 + 검색/정렬 + 학습자 카드 리스트) ↔ 우측(상세)
- 우측 상세 = 정보 박스 + 활동요약(좌) + 커리큘럼 배정(우) + 최근 제출 이력 (풀폭)

### 시각 톤 통일
- `LearnerManagement.css` 의 모든 색을 `var(--*)` 으로 통일 (하드코딩 `#3182ce / #1a202c` 등 제거)
- EmailingView 와 동일 패턴/색감

### 레이아웃 안정화 (학습자 전환 시 폭 변동 차단)
- **진범**: `.dashMain` 이 `display: flex` 라 자식 `.learnerMgmtContainer` 가 콘텐츠 폭에 맞춰 줄어들었음 → 콘텐츠 길이에 따라 컨테이너 폭이 변동
- fix: `.learnerMgmtContainer { width: 100%; box-sizing: border-box }` 명시
- 보조 안전망:
  - `.learnerMgmtSplit` 우측 컬럼 `minmax(0, 1fr)` (auto 대신 0 min)
  - `.learnerMgmtDetailGrid` 양쪽 셀 `minmax(0, 1fr)` + `.learnerMgmtSection` `min-width: 0`
  - `.learnerMgmtDetail` `min-width: 0 + overflow-x: hidden`
  - 모든 텍스트 ellipsis 적용 (커리큘럼 제목 `.learnerMgmtAssignItem` 등)
  - `scrollbar-gutter: stable` 로 스크롤바 출현 따른 폭 변동 차단
- 뷰포트 고정 height + 내부 overflow 로 외부 페이지 스크롤 차단
  - `.learnerMgmtSplit { height: calc(100vh - 220px); min-height: 480px }`
  - 좌/우 패널 각각 `overflow-y: auto`
- summary stats 항상 3카드 렌더 (로딩 시 `⋯` placeholder) → 깜빡임 0

### 추가 기능 — 최근 제출 이력
- 신규 endpoint `GET /api/task-submissions/by-learner/{user_id}`
  - admin: 모든 학습자 / 매니저: 본인 회사 활성 학습자만
  - 기존 `_submission_response` 헬퍼 재사용, 응답: `list[TaskSubmissionResponse]` 최신순
- 우측 패널 하단 풀폭 섹션
- 각 행: `[N주차] 커리큘럼명 [상태 pill] 날짜`
- 상태 pill 색:
  - 피드백 대기 (waiting / 황색)
  - 피드백 완료 (done / 녹색)
  - 재제출 요청 (resubmit / 적색)
- 최대 8개 표시, 긴 커리큘럼 제목은 ellipsis + title 툴팁

### 검증
- 프론트 `npm run build` 통과 (4.83s)
- 백엔드 `python -m compileall -q app` 통과
- Console 로 측정: 두 학습자 전환 시 split/container/title 위치 픽셀 단위 동일

### 메모
- 의존성/마이그레이션 변경 없음
- 발표 시연 흐름: 학습자 관리 → 카드 클릭 → 우측에 활동요약 + 배정 관리 + 제출 이력 한 화면

---

## 2026-05-22 - Claude (매니저 학습자 chip 진행률 배지 표시)

### 배경
- 매니저 커리큘럼 화면 상단의 학습자 chip 이 이름만 표시. 학습자별 진행 정도를 보려면 chip 을 클릭해 들어가야만 알 수 있었음
- "한눈에 누가 어디까지 했는지" 정보 밀도 보강

### 변경
- `client/src/components/CurriculumView.jsx`
  - 학습자 chip 내부를 `chipName` + `chipBadge` 두 span 으로 분리
  - 현재 커리큘럼 의 `submissions` state 에서 학습자별 제출 unique week 수 카운트 (학습자 측 `submittedWeekCount` 와 동일 기준)
  - 배지 문구: `submittedCount/totalWeeks`
- `client/src/styles/Curriculum.css`
  - `.assignedLearnerChipName` (white-space:nowrap) + `.assignedLearnerChipBadge` (옅은 청색 pill) 추가
  - `.active` 상태에선 배지 색도 invert (흰색 pill)

### 검증
- 프론트 `npm run build` 통과 (5.61s)
- 백엔드 변경 없음

### 메모
- 의존성/마이그레이션 변경 없음

---

## 2026-05-22 - Claude (마스터 페이지: c-role 누락 보완 + 아티클 등록 UI 추가)

### 배경
- 마스터 페이지(admin 전용) 점검 결과 두 가지 누락 발견:
  1. `c` (일반 회원) 역할이 UI 곳곳에 처리 안 됨 — 회원 목록에서 "학습자"로 잘못 표기, 필터 옵션 없음, 역할 변경 버튼 없음, 정렬 시 끝으로 밀림
  2. admin 본분인 "아티클 등록" 화면 자체가 부재 (백엔드 `POST /api/articles` 는 존재했으나 호출할 UI 가 없었음)

### 수정 1) c-role 누락 보완 (4곳)
- `client/src/components/master/MasterMemberPanel.jsx`
  - `statusFor()` 에 `c → '일반회원'` 분기 추가
  - 역할 필터 select 에 `<option value="c">일반회원</option>` 추가
- `client/src/components/master/MasterMemberDetailModal.jsx`
  - 역할 변경 버튼 배열에 `{value: 'c', label: '일반회원'}` 추가 (a/m/c/j 4개로 확장)
- `client/src/components/MasterDashboard.jsx`
  - `ROLE_ORDER` 에 `c: 3` 추가 (a/m/j 뒤로 정렬)

### 수정 2) 아티클 등록 UI 추가
- 신규 컴포넌트 `client/src/components/master/MasterArticleCreateModal.jsx`
  - 사이드 패널 (회원관리 패널과 동일 패턴)
  - 폼 필드: 출처(DBR/HBR 토글) / 제목 / 저자 / 발행일 / 카테고리(datalist 자동완성) / 원문 URL / 본문(선택, 입력 시 RAG 인제스트)
  - 카테고리 옵션은 `GET /articles/categories` 에서 자동 로드
  - 필수 필드 검증 후 `POST /articles` 호출
  - 성공 시 토스트 + 폼 초기화 + 패널 닫힘
- `client/src/components/MasterDashboard.jsx`
  - 헤더에 "아티클 등록" 버튼 추가 (회원관리 버튼 왼쪽)
  - `articleCreateOpen` state + 모달 렌더
- `client/src/styles/MasterDashboard.css`
  - `.masterArticlePanel`, `.masterArticleForm`, `.masterArticleField`, `.masterArticleSourceBtn`, `.masterArticleSubmitBtn` 등 추가
  - 회원관리 패널과 동일한 어두운 톤 + 슬라이드인 애니메이션 재사용

### 백엔드 정합성 보완
- `server/app/schemas/article.py` `ArticleCreate`
  - 기존: author/published_date/category/source_url 가 Optional 이었음 (스키마 ↔ 모델 NOT NULL 불일치)
  - 변경: 모두 필수 (스키마와 DB 정합성 일치, 클라이언트가 빈 값 보내면 422 로 친절하게 거부)
- 새 endpoint 없음, 마이그레이션 없음

### 한계 / 후속
- 썸네일 업로드는 이번 사이클 제외 (별도 thumbnail_service 흐름 분석 필요)
- 아티클 수정/삭제 UI 없음 — 추후 사이클
- 회사 초대 코드 재발급 (1회 제한) 액션은 다음 작업

### 검증
- 프론트 `npm run build` 통과 (4.93s)
- 백엔드 `python -m compileall -q app` 통과
- 실 사용: admin 계정 → 회원관리에서 일반회원 표시/필터/역할변경 동작, "아티클 등록" 패널에서 폼 작성 후 등록 → 메인 대시보드에 즉시 반영 확인 필요

### 메모
- 의존성/마이그레이션 변경 없음

---

## 2026-05-22 - Claude (일반 회원 c → 매니저 m 승급 구독 팝업 추가 / 결제 시뮬레이션)

### 배경
- 발표용 정책상 결제 게이트웨이는 미구현이고 admin 이 DB 직접 수정으로 매니저 승급을 시뮬레이션해 옴
- 발표 시나리오에서 "일반 회원 → 결제 → 매니저 승급 → 학습자 초대" 사이클을 라이브로 보여주기 위해 UI 한 흐름 추가
- 실제 PG 연동 없이 즉시 승급 처리

### 백엔드
- `server/app/routers/user.py` 에 `POST /api/users/me/upgrade` 추가
  - 본인이 `c` 일 때만 허용 (그 외 400)
  - `user_role = 'm'` 으로 변경 + `invite_code_service.generate_unique_invite_code(db)` 로 회사 초대 코드 발급
  - 응답은 기존 `UserResponse` 재활용
- 신규 스키마/마이그레이션 없음 (기존 `user_invite_code` 컬럼 그대로 사용)

### 프론트
- 신규 컴포넌트 `client/src/components/SubscribeModal.jsx`
  - 요금제 카드(99,000원/월) + 기능 리스트 + 결제하기 버튼
  - 클릭 시 `POST /users/me/upgrade` 호출, 성공 시 `onSuccess(updatedUser)` 콜백 + 토스트
- `client/src/styles/Dashboard.css` 에 `.subscribeOverlay/.subscribeModal/.subscribePlan*/.subscribeActions/...` 추가 (createPortal 기반 모달 패턴)
- `client/src/App.jsx`: `Dashboard` 에 `onUserUpdate={setUser}` prop 전달
- `client/src/components/Dashboard.jsx`
  - `onUserUpdate` prop 수신 + `subscribeOpen` state 추가
  - `canSubscribe = user_role === 'c'` 분기로 HeroBanner CTA 토글
  - SubscribeModal 렌더, 성공 시 setUser 갱신 → Header 드로어의 초대 코드 자동 노출
- `client/src/components/HeroBanner.jsx`
  - 새 prop `showSubscribeCta`/`onSubscribe` 추가
  - `c` 일 때만 "OJT 매니저로 시작하기" CTA 노출 (m/a 는 기존 "커리큘럼 생성하기" 그대로)

### 시연 흐름
1. 일반 회원으로 로그인 → 메인 배너 하단 "OJT 매니저로 시작하기" 클릭
2. 구독 모달 → "결제하기" 클릭 (게이트웨이 시뮬레이션, 즉시 승급)
3. 토스트 "매니저로 승급되었습니다" + setUser 갱신
4. 햄버거 드로어 열면 회사 초대 코드 즉시 표시 (마스킹/복사/표시 토글 기존 그대로)
5. 메인 CTA 도 "커리큘럼 생성하기" 로 자동 전환

### 한계 / 후속
- 실제 PG/카드 입력 UI 없음. 발표 시연용
- 권한 회귀: m → c 다운그레이드 엔드포인트는 안 만듦 (어드민 DB 직접 처리)
- 초대 코드 재발급(1회 제한) 흐름도 별도 사이클

### 검증
- 프론트 `npm run build` 통과 (5.01s)
- 백엔드 `python -m compileall -q app` 통과
- 실 사용: 일반 회원 계정으로 클릭 → 매니저 권한 + 초대 코드 표시 확인 필요

### 메모
- 의존성/마이그레이션 변경 없음. 팀원 풀 후 추가 작업 없음

---

## 2026-05-22 - Claude (학습자/매니저 임시저장 기능 추가 / localStorage 기반)

### 배경
- 뒤로가기 점프 수정 후에도, 매니저가 템플릿 모달을 닫으면 다음에 다시 열 때 `openTemplateModal` 이 `assignment.template_content` 로 매번 reset 해서 작성 중이던 content 가 사라짐
- 학습자 측도 `handleAssignmentClick` 가 매번 `assignmentData` 로 새로 init 해서 작성 중이던 답안이 보존되지 않음
- 발표 시연 중 흐름이 끊기지 않도록 양쪽에 가벼운 임시저장 기능 필요

### 구현 방식 (localStorage)
- 백엔드 변경 없음. 브라우저 단위 임시저장
- 키 형식:
  - 매니저: `template_draft:{cur_id}:{week}:{idx}`
  - 학습자: `task_draft:{cur_id}:{week}:{idx}`
- 진입 시 자동 복원 + `toast.info('임시저장본을 불러왔습니다.')`
- "임시저장" 버튼 클릭 시 명시 저장 + 성공 토스트
- 정식 저장(매니저: 템플릿 배포 / 학습자: 최종 과제 제출) 성공 시 해당 키 삭제

### 변경 파일
- `client/src/components/CurriculumView.jsx`
  - `templateDraftKey()`, `saveTemplateDraft()` 추가
  - `openTemplateModal()`: localStorage 확인 → 있으면 우선 사용 + 토스트
  - `saveTemplate()` 성공 분기: localStorage 키 제거
  - 모달 footer 에 "임시저장" 버튼 (취소/배포 사이) 추가
- `client/src/components/LearnerCurriculumView.jsx`
  - `taskDraftKey()`, `saveTaskDraft()` 추가
  - `handleAssignmentClick()`: 편집 모드 진입 시 localStorage 우선 적용 + 토스트
  - `handleSubmit()` 성공 분기: localStorage 키 제거
  - 제출 버튼 옆에 "임시저장" 버튼 추가

### 한계 / 메모
- localStorage 기반이라 다른 PC/브라우저에서는 안 보임. 발표 시연용으론 충분
- 임시저장본 자동 만료 없음 — 오래된 키가 쌓일 수 있으나 발표용은 무관
- 동일 사용자/PC 가정. 한 PC 에서 학습자 계정 두 개 쓰는 케이스는 미고려 (드물고 발표 외 시나리오)

### 검증
- 프론트 `npm run build` 통과 (5.12s)
- 실 사용 흐름: 매니저 템플릿 작성 → 임시저장 → 모달 닫음/뒤로가기 → 재오픈 시 복원, 학습자 동일 시나리오, 정식 저장 후 localStorage 제거 확인 필요

---

## 2026-05-22 - Claude (학습자/매니저 커리큘럼 뒤로가기 시 메인 점프 수정)

### 증상
- 학습자가 과제 상세(activeTask)에 들어간 상태에서 브라우저 뒤로가기 → 메인 대시보드로 점프 (커리큘럼 목록 안 거침)
- 매니저가 "과제 양식 배포" 템플릿 모달(`templateModal.open=true`) 상태에서 뒤로가기 → 동일하게 메인 점프, 작성 중이던 content 가 사라짐

### 원인
- `Dashboard.jsx` 에 `curriculumDetailRef = useRef(false)` 라는 escape hatch 가 이미 만들어져 있고 popstate 핸들러가 `if (curriculumDetailRef.current) return` 로 빠져나가게 돼 있음
- 그러나 `LearnerCurriculumView` 는 ref 를 prop 으로 받기만 하고 한 번도 `true` 로 세팅하지 않음
- `CurriculumView` 는 그 ref 자체를 prop 으로 받지조차 않음
- 결과: 두 컴포넌트의 모든 상세 상태에서 popstate 가 Dashboard 의 fallback (`setView('articles')`)로 흘러서 메인 점프

### 수정
- `Dashboard.jsx`: `CurriculumView` 에도 `curriculumDetailRef` prop 으로 같은 ref 전달 (학습자 측은 이미 넘기고 있었음)
- `LearnerCurriculumView.jsx`: `activeTask` 변화 추적 useEffect 추가
  - 진입 시 ref.current = true + `pushState` 한 번
  - popstate 발생 시 `setActiveTask(null) + setEditorFullscreen(false)` 로 과제 닫고 목록으로 복귀
  - cleanup 에서 ref.current = false 복원
- `CurriculumView.jsx`: `templateModal.open` 변화 추적 useEffect 추가
  - 진입 시 ref.current = true + `pushState`
  - popstate 시 `setTemplateModal({...prev, open: false, fullscreen: false})` 로 모달만 닫음
  - `templateModal.content` 는 state 에 살아 있어서 같은 모달 다시 열면 복원됨

### 한계 / 후속
- 매니저의 다른 모달(`manageModalOpen`, `modalOpen`, `confirmOpen`, `assignModalOpen`)은 이번 사이클에서 처리 안 함. 같은 동선 발견 시 동일 패턴 한 번씩 추가
- 학습자 "전체보기 → 일반 편집 → 목록 → 메인" 4단계 백 스택은 미구현. 전체보기 상태에서도 뒤로가기 한 번에 목록으로 복귀하는 단순 흐름. 정밀 4단계는 V2

### 검증
- 프론트 `npm run build` 통과 (5.35s)
- 실 사용: 학습자/매니저 두 계정에서 과제 진입 + 뒤로가기 200/모달 닫힘 확인 필요

### 메모
- 의존성/마이그레이션 변경 없음. 팀원 풀 후 추가 작업 없음

---

## 2026-05-22 - Claude (커리큘럼 목록 500 / sort buffer 폭발 수정)

### 증상
- 로그인 후 `/api/curricula` 호출이 학습자(`j`)/매니저(`m`) 양쪽 모두 500
- 서버 traceback 끝: `pymysql.err.OperationalError: (1038, 'Out of sort memory, consider increasing server sort buffer size')`

### 원인
- `list_curricula` 핸들러가 `SELECT *` + `ORDER BY cur_created_at DESC`
- `cur_week_plan` (JSON), `cur_assigned_learner_ids` (JSON) 등 큰 컬럼이 전부 sort buffer에 적재됨
- MySQL 기본 `sort_buffer_size` (256KB) 만으로는 row 몇 개만 있어도 폭발
- 어제 임시배포 자체가 직접 원인은 아니나, 데이터가 일정 임계점을 넘으면 결국 터질 코드였음

### 수정
- `server/app/routers/curriculum.py` `list_curricula` 한 함수만 교체
  - 1단계: `cur_id` 컬럼만 SELECT + ORDER BY → sort 비용 거의 0
  - 2단계: `id IN (...)` 로 PK 인덱스 직접 fetch → 정렬 없음
  - 파이썬에서 ids 순서대로 재정렬해 DB 정렬 결과 보존
- 응답 schema/권한 로직/다른 핸들러 영향 없음

### 검증
- `python -m compileall -q app` 통과
- 실 사용 시 매니저/학습자 두 계정에서 커리큘럼 페이지 200 확인 필요

### 메모
- 의존성/마이그레이션 변경 없음. 팀원 풀 후 추가 작업 없음
- 동일 패턴이 다른 라우터(예: task_submissions list)에 있는지는 추후 점검 사이클로 미룸

---

## 2026-05-22 - Codex + Claude (학습자 화면 템플릿 표 깨짐 수정 / `.template-render` 공용 클래스 도입)

### 배경
- 매니저가 만든 과제 템플릿(표 포함)은 매니저 화면(TipTap 에디터)에서는 정상 렌더되지만 학습자가 받을 때 표 보더/패딩/너비가 다 깨져 보임
- 원인: 매니저 측은 `.tiptap-content-area .ProseMirror table` 셀렉터로 table 스타일이 적용되는데, 학습자 측은 plain `<div>`에 `dangerouslySetInnerHTML`로 raw HTML을 그대로 dump하므로 해당 CSS 셀렉터가 매칭되지 않음

### 변경 (어제 Codex가 작성, 오늘 Claude가 빌드 검증 + 커밋 마무리)
- `client/src/styles/Curriculum.css`
  - 기존 `.tiptap-content-area .ProseMirror table/td/th/th` 룰에 `.template-render` 셀렉터 추가 (둘 다 같은 스타일)
  - `td/th`에 `vertical-align: top` 추가 (셀 콘텐츠 위 정렬)
  - `.template-render p/ul/ol` 마진/패딩 룰 추가 (raw HTML이라 기본 마진이 너무 좁거나 넓어 보이는 문제 보정)
  - 파일 끝 newline 정리
- `client/src/components/LearnerCurriculumView.jsx`
  - 템플릿 작성 div (L548): `className="template-render learnerTemplateRender"` 추가
  - 본인 제출본 보기 div (L614): `template-render` 추가
- `client/src/components/CurriculumView.jsx`
  - TipTap 에디터 컨테이너 (L105): `template-render` 추가 (편집 중에도 동일 스타일 보장)
  - 매니저가 학습자 제출본 볼 때 div (L800): `template-render` 추가

### 검증
- 프론트 `npm run build` 통과 (6.18s)
- 매니저 측은 ProseMirror 룰 + template-render 룰 둘 다 적용되므로 회귀 없음

### 메모
- 의존성/마이그레이션 변경 없음. 팀원 풀 후 추가 설치 작업 없음

---

## 2026-05-21 - Claude (사용자 입장 점검 후속: 매니저 초대 코드 이동 + 검색 오류/가입 토스트)

### 매니저 초대 코드 → 햄버거 드로어 사용자 정보 박스 안
- 배경: 메인 대시보드 상단에 영구 노출되던 초대 코드 박스가 화면 공유 시 노출 위험. 사용자 정보 박스가 더 자연스러운 컨텍스트
- `Header.jsx` — `drawerUserInfo` 내부에 초대 코드 섹션 추가 (`m` 역할 + `user_invite_code` 있을 때만)
  - `maskInviteCode` 유틸: 영숫자만 `•`로, 하이픈은 그대로 유지 (예: `••••-••••-••••`)
  - `codeVisible` 상태 + 👁/🙈 토글, 📋 복사 (복사 성공 시 toast.success)
- `Dashboard.jsx` — 메인 상단의 `managerInviteNotice` 블록 제거
- `Dashboard.css` — `.drawerInviteSection`/`.drawerInviteLabel`/`.drawerInviteCode`/`.drawerInviteAction` 추가

### 검색 오류 시 토스트+모달 중복 → 'error' 모달 상태로 분리
- 기존: 네트워크/서버 오류 catch에서 `toast.error('검색 중 오류') + setModalStatus('not_found')` 동시 실행 → "결과 없음? 오류?" 혼란
- 변경: 400(부적절 단어)는 그대로 `'inappropriate'`, 그 외는 새로 추가한 `'error'` 모달로 분기. 토스트 제거
- `Dashboard.jsx` — handleSearch catch 분기 + 모달 'error' JSX 분기 ("검색 중 오류가 발생했습니다 / 잠시 후 다시 시도해주세요")

### 회원가입 완료 토스트
- 기존: 가입 성공 시 별도 피드백 없이 `onComplete()`로 Intro 복귀 → "가입 됐어?" 확신 부족
- 변경: `Signup.jsx` 에서 `toast.success('가입이 완료되었습니다. 로그인해주세요.')` 후 onComplete
- App level ToastContainer가 받아서 Intro 화면에서도 3초 노출

### handleGenerate 흔적 주석 제거
- `Dashboard.jsx:40` — `// AI 생성을 위해 보관할 검색어` 주석 제거 (handleGenerate 함수는 이전 merge에서 이미 제거됨)

### 검증
- 프론트 `npm run build` 통과 (4.89s)
- 백엔드 변경 없음

### 메모
- 의존성 변경 없음. 팀원 풀 후 추가 설치 작업 없음

---

## 2026-05-21 - Claude (origin/dev 머지: rag 검색 고도화 + 커리큘럼 이미지)

### 들어온 커밋
- `ef0aa27` rag 검색창 고도화 + 필터링 + 대시보드 모달창 메시지 바리에이션
- `673b37e` 커리큘럼 및 이미지 수정

### 충돌 해결
- `client/src/components/Dashboard.jsx` `handleSearch` catch 블록
  - 팀 변경: 400 에러(부적절한 단어)는 `setModalStatus('inappropriate')`로 분기
  - 내 변경: 모든 catch에 `toast.error`
  - 머지 방향: 400은 팀의 inappropriate 모달, 그 외는 `toast.error` + `setModalStatus('not_found')`
- `client/src/components/Dashboard.jsx` `handleGenerate` 함수
  - 팀이 origin/dev에서 제거함 (모달도 `'generating'` 상태 JSX가 함께 사라짐)
  - 내 토스트 작업과 충돌해 conflict marker에 끼었지만 팀 결정 따라 함수 제거
- `client/src/components/CurriculumView.jsx`
  - 한 곳에서 토스트가 alert로 되돌아 있던 부분 → toast 유지
  - 새로 들어온 `handleDeleteCurriculum`의 alert도 `toast.error`로 통일 (마이그레이션 일관성)

### 자동 머지된 파일
- `Dashboard.css`, `Curriculum.css`, `App.jsx`, `Header.jsx`, `HeroBanner.jsx`, `ArticleDetailView.jsx`, `LearnerCurriculumView.jsx`, `MasterDashboard.jsx`
- `server/app/main.py`, `models/__init__.py`, `schemas/__init__.py`, `routers/curriculum.py`, `services/rag_service.py`
- `docs/devlog.md` (각자 다른 위치에 항목 추가)

### 검증
- 백엔드 `compileall` + `import app.main` 통과 (routes 53)
- 프론트 `npm run build` 통과 (4.72s)

### 메모
- 푸시는 안 함. 로컬에 3 commits ahead 상태 (이전 UX + 북마크 + 머지 commit)

---

## 2026-05-21 - Claude (아티클 북마크 기능 추가)

### 배경
- 발표 전 UX 강화 차 아티클 북마크 기능 추가 요청
- 팀이 직접 SQL로 `bookmarks` 테이블 생성 (article 전용, BIGINT FK)

### 백엔드
- `server/app/models/bookmark.py` — `Bookmark` 모델 (user_id, article_id, created_at, `uq_user_article` 제약 + `idx_bookmark_user` 인덱스)
- `server/app/schemas/bookmark.py` — `BookmarkCreate`, `BookmarkArticleItem`, `MyBookmarksResponse`
- `server/app/routers/bookmark.py` — 3 endpoint
  - `GET /api/bookmarks/me` — 사용자 북마크 (썸네일/카테고리 hydrated, `created_at desc`)
  - `POST /api/bookmarks` body `{article_id}` — idempotent 추가
  - `DELETE /api/bookmarks/{article_id}` — idempotent 제거
- 권한: 로그인한 모든 사용자 (c/j/m/a). `get_current_user`만 의존
- `main.py` + `models/__init__.py` + `schemas/__init__.py` 등록

### 프론트엔드
- `client/src/lib/bookmarks.js` — API 헬퍼
- `Dashboard.jsx` — 북마크 ID Set 상태 (mount 시 fetch), optimistic toggle (실패 시 자동 롤백 + `toast.error`)
- 아티클 카드: 우상단 ★/☆ 버튼 (active 시 `#f5a623`)
- `ArticleDetailView.jsx` — 제목 옆 큰 ★/☆ 버튼
- `MyBookmarksView.jsx` (신규) — 북마크 그리드 + 빈 상태
- `Header.jsx` — 헤더 우상단(햄버거 옆) ★ 아이콘 + 드로어 "내 북마크" 메뉴 (이중 진입점). `currentView === 'bookmarks'`일 때 헤더 ★ 노란색 highlight
- `Dashboard.css` — `.bookmarkBtn`, `.headerBookmarkBtn`, `.bookmarkPage`, `.bookmarkGrid` 등 신규 클래스

### 설계 변경 메모: polymorphic → article-only
- 초기 설계: `bookmark_target_type` + `bookmark_target_id`로 article + author 둘 다 지원
- 실제 팀에서 생성한 테이블이 `article_id` 단일 컬럼 → 아티클 전용으로 단순화
- 저자 북마크는 V2로 미룸 (필요 시 별도 테이블 또는 polymorphic 컬럼 추가)

### 검증
- 백엔드 `python -m compileall -q app` 통과
- 백엔드 `from app.main import app` import 통과 (routes 52)
- 프론트 `npm run build` 통과 (4.83s)

### 메모
- 푸시는 안 함 (사용자 요청). 로컬 커밋만 남기고 다음 사이클에 같이 올림

---

## 2026-05-21 - Claude (발표 전 UX 다듬기 + 권한 회귀 복구)

### 토스트 알림 도입
- `client/package.json` — `react-toastify` 추가
- `client/src/App.jsx` — `<ToastContainer>` 마운트 (우상단, 3초 자동 닫힘)
- alert 17곳 → `toast.success/error/warn` 교체
  - CurriculumView 11, MasterDashboard 3, LearnerCurriculumView 2, Dashboard 1
- Dashboard 검색 실패 catch(`Dashboard.jsx:138`)에 `toast.error` 추가
- 조회수 증가 실패(`Dashboard.jsx:205`)는 백그라운드 호출이라 `console.error`만 유지

### 학습자/일반회원 권한 회귀 복구
- 배경: 디자이너 디자인 작업 중 `canUseCurriculum`/`canCreateCurriculum` 플래그가 함께 날아간 듯
- `Dashboard.jsx` — 두 플래그 부활, 세션 복원 가드, Header/HeroBanner/CurriculumView 가드 적용
- `Header.jsx` — 사이드 드로어 "커리큘럼 관리" 메뉴를 `canUseCurriculum && (...)` 조건 렌더
- `HeroBanner.jsx` — `.floatingCtaHidden` CSS 클래스가 정의되지 않은 죽은 클래스였음. 조건부 렌더(`{showCreateCta && <div>...</div>}`)로 교체

### 햄버거 드로어 사용자 정보
- `Header.jsx` — 닫기 버튼 아래 사용자 정보 블록 추가 (이름 + 역할·회사)
- `ROLE_LABELS` 상수로 c/j/m/a → 한글 매핑
- `Dashboard.css` — `.drawerUserInfo`/`.drawerUserName`/`.drawerUserMeta` 3개 클래스 (기존 토큰 재사용)

### 검증
- `cd client && npm run build` 통과 (4.73s)
- alert 검색 결과 0건 (`Grep alert\(` → no matches)
- 백엔드 변경 없음

### 메모
- 푸시는 안 함 (사용자 요청). 로컬 커밋만 남기고 다음 푸시 사이클에 같이 올림

---

## 2026-05-20 - Claude (챗봇 백엔드 제거 + CLAUDE.md 정리)

### 배경
- 2026-05-19 사용자 결정: 챗봇은 프로젝트 범위에서 제외 (memory [[project-chatbot-removed]])
- 백엔드에 챗봇 관련 라우터/모델/스키마/관계가 남아 있어 정리

### 삭제 파일
- `server/app/routers/chatbot.py`
- `server/app/models/chatbot.py`
- `server/app/schemas/chatbot.py`

### 수정 파일
- `server/app/main.py` — `chatbot` import 와 `app.include_router(chatbot.router)` 제거
- `server/app/models/__init__.py` — `ChatbotMessage`, `ChatbotSession` import/export 제거
- `server/app/schemas/__init__.py` — `Chatbot*` import/export 제거
- `server/app/models/user.py` — `chatbot_sessions` relationship 제거
- `server/app/models/curriculum.py` — `chatbot_sessions` relationship 제거
- `CLAUDE.md`
  - 핵심 테이블 섹션에서 `chatbot_sessions`, `chatbot_messages` 제거 (DB 테이블 자체는 데이터 보존 차원에서 남김)
  - 현재 라우터 목록에서 `chatbot` 제거, 누락됐던 `author` 추가
  - 권한 정책표 매니저 행에서 "챗봇 사용" 제거
  - 제거된 예전 구조에 `chatbot` 추가
  - 챗봇 전용 권한 차단 규칙 줄 제거

### 미정리 (의도)
- DB 테이블 `chatbot_sessions`, `chatbot_messages` — 데이터 영구 손실 방지 위해 보존. 드롭 여부는 별도 결정

### 검증
- `python -m compileall -q app` 통과
- `from app.main import app` import 정상, 등록된 routes 48개
- 프론트는 챗봇 참조 없음 확인 (`grep` 결과 비어있음)

---

## 2026-05-20 - Claude (잔여 미커밋 정리)

### 변경
- `.gitignore` — 로컬 `deliverables/` 디렉토리(기획서 hwp/pdf) 추적 제외
- `client/src/components/LearnerCurriculumView.jsx` — CSS import를 공용 `Curriculum.css` → 분리된 `LearnerCurriculum.css`로 교체 (어제 분리된 학습자 전용 스타일 파일과 정렬)

### 비고
- 어제(2026-05-19) 종료 시점에 남아 있던 워킹 트리 변경분 정리 차원의 커밋

---

## 2026-05-20 - Claude (요약문 페이지 → 저자 이메일링 진입점 추가)

### 배경
- 요약문 페이지(ArticleDetailView)에서 저자에게 바로 이메일을 보낼 수 있는 진입점이 없었음
- 사용자 결정: 저자명 옆에 메일 아이콘(✉) 버튼 + 클릭 시 EmailingView에서 해당 저자 자동 선택

### 백엔드
- `schemas/article.py` — `AuthorBrief`, `ArticleDetailResponse` 신설
  - `AuthorBrief`: `author_numb`, `author_name`, `author_email`
  - `ArticleDetailResponse(ArticleResponse)`: `authors: list[AuthorBrief] = []`
  - list 응답은 그대로 `ArticleResponse` 유지 (N+1 회피 — 단건 detail에서만 authors 노출)
- `routers/article.py` — `GET /articles/{id}` response_model을 `ArticleDetailResponse`로 교체. relationship `article.authors`를 직렬화해서 응답에 포함

### 프론트
- `ArticleDetailView.jsx`
  - prop에 `onOpenEmailing(authorNumb)` 추가
  - 메타 라인에서 `authors` 배열이 있으면 저자별로 `이름 ✉` 렌더 (각 저자 1:1 매칭)
  - `author_email`이 없는 저자는 ✉ 버튼 숨김
  - 매핑 없는 구 데이터(`authors` 빈 배열)는 fallback으로 기존 `article_author` 문자열만 표시
- `Dashboard.jsx`
  - `pendingAuthorNumb` state + `openEmailingForAuthor(authorNumb)` 함수 추가
  - `ArticleDetailView`에 `onOpenEmailing`, `EmailingView`에 `initialAuthorNumb`/`onConsumePendingAuthor` 전달
- `EmailingView.jsx`
  - prop에 `initialAuthorNumb`, `onConsumePendingAuthor` 추가
  - 마운트 후 `initialAuthorNumb` 있으면 한 번만 `handleAuthorClick` 자동 호출 → 부모에게 consume 콜백

### 스타일
- `styles/ArticleDetailView.css` — `.articleAuthorList`, `.articleAuthorItem`, `.articleAuthorSep`, `.authorMailBtn` 추가 (CLAUDE.md inline style 금지 룰 준수)

### 검증
- backend `python -m compileall -q app` 통과
- frontend `npm run build` 통과 (5.10s, 기존 청크 경고만 유지)

### 미결 / 후속
- 저자에 매핑이 안 된 구 article 데이터 비율 확인 필요 (백필 여부 결정)
  - 진단 결과: articles 53건 중 매핑 43건. 누락 10건. authors 41명 중 이메일 보유 25명. (예: article_id=50의 "미셸 테이트"는 authors 테이블에도 없음)
- 모바일에서 메타 라인 줄바꿈 시 ✉ 버튼 위치 확인 (CSS는 inline-flex로 짜였음)

### 후속 2 — articleDetail 진입 직전 view 로 뒤로가기 복귀 (일반화)
- 이메일링 → 저자 상세 → 그 저자가 쓴 아티클 클릭 → articleDetail 진입 후 뒤로가기를 누르면 메인 대시보드(articles)로 점프하던 문제 해결
- `Dashboard.jsx`
  - `previousViewRef` 추가
  - `openArticleDetail` 호출 시 `viewRef.current` 를 `previousViewRef.current` 에 캡쳐 (단, articleDetail → articleDetail 이동(추천 아티클 등)에서는 최초 진입 view 유지)
  - `onPop` 분기 추가: `view==='articleDetail' && previousView 가 articles/articleDetail 이 아니면` 그 view 로 `setView` 후 ref reset
- 일반화 효과로 이메일링뿐 아니라 커리큘럼 등 다른 진입 view 에서도 articleDetail 뒤로가기 시 해당 view 로 복귀
- frontend `npm run build` 통과 (5.20s)

### 후속 — 외부 진입 흐름의 뒤로가기 동선 보정
- 요약문 → ✉ → 이메일링(저자 자동 선택) 흐름에서 뒤로가기가 저자 목록에 한 번 머무는 동작을 제거
- `Dashboard.jsx`
  - `cameFromArticleDetailRef` 추가. `openEmailingForAuthor` 호출 시 true 설정
  - `onPop` 분기: `view==='emailing' && cameFromArticleDetailRef.current` 이면 `setView('articleDetail')` 로 복원
- `EmailingView.jsx`
  - `externalAuthorNumbRef` 추가. `initialAuthorNumb` 자동 선택 시 해당 author_numb 보관
  - 상세 진입 useEffect: `externalAuthorNumbRef.current === selectedAuthor.author_numb` 동안에는 자체 `pushState` 와 popstate listener 등록을 skip + `emailingDetailRef`도 false 유지 (Dashboard onPop 위임)
  - `handleAuthorClick`: 다른 저자 번호로 호출되면 `externalAuthorNumbRef.current = null` 로 reset → 이후 일반 동작 (자체 history push) 복귀
- 결과 동작
  - 요약문 → ✉ → 이메일링(저자 자동 선택) → 뒤로가기 1번 → 요약문 복귀
  - 메뉴에서 직접 이메일링 진입 / EmailingView 내에서 저자 클릭 → 기존 그대로 (저자 목록 → 뒤로가기 → 아티클 목록)
- frontend `npm run build` 통과 (5.07s)

---

## 2026-05-19 - Codex (권한 노출 점검 후 안정화)

### 변경
- 실제 DB 스키마 확인: `users.user_role` enum에 `c/m/j/a` 반영, `users.user_invite_code varchar(14) UNIQUE` 반영 확인.
- `GET /api/users/{user_id}` 매니저 조회 범위 축소
  - admin(`a`)은 기존처럼 전체 활성 회원 조회 가능.
  - manager(`m`)는 같은 회사 학습자(`j`)만 조회 가능.
  - 다른 회사/다른 매니저/관리자 row는 404로 숨김 처리하여 `user_invite_code` 노출 차단.
- `PATCH /api/curricula/{cur_id}` admin 수정 권한 보강
  - manager는 기존처럼 본인이 만든 커리큘럼만 수정.
  - admin은 전체 활성 커리큘럼 수정 가능.
  - consumer/learner는 404.
- 잘못된 위치에 남아 있던 루트 `package.json`, `package-lock.json` 제거.
  - 프론트 의존성 기준은 `client/package.json` / `client/package-lock.json`로 단일화.

### 검증
- `python -m compileall -q app` 통과
- `npm run build` 통과 (기존 대형 청크 경고만 유지)

---

## 2026-05-19 - Codex (역할별 프론트 진입 정리)

### 변경
- Dashboard에서 역할 플래그 정리
  - `canUseCurriculum`: `j/m/a`
  - `canCreateCurriculum`: `m/a`
- 일반회원(`c`)은 커리큘럼 메뉴와 히어로 플로팅 CTA를 숨김.
- 저장된 세션 view가 `curriculum`이어도 현재 역할이 접근 불가하면 `articles`로 되돌림.
- 커리큘럼 화면 렌더링도 `canUseCurriculum` 조건을 한 번 더 통과하게 정리.
- 매니저 초대코드 복사 버튼에 성공 피드백 추가
  - 복사 후 버튼 배경 변경
  - `복사 완료` 텍스트 표시

### 검증
- `npm run build` 통과 (기존 대형 청크 경고만 유지)
- `python -m compileall -q app` 통과

---

## 2026-05-19 - Codex (가입/초대코드 API 시나리오 검증)

### 검증 방식
- FastAPI `TestClient` + 실제 로컬 DB 연결로 발표용 가입/권한 흐름을 호출.
- 테스트 데이터 prefix: `codex_api_check_20260519`
- 검증 후 테스트 계정/커리큘럼 데이터 삭제 완료.

### 결과
- admin 로그인 성공.
- 일반 가입 시 `c` 역할 생성 확인.
- admin `PATCH /api/users/{id}`로 `c -> m` 승급 시 `user_invite_code` 자동 발급 확인.
- 초대코드 가입 시 `j` 역할 생성 및 매니저 회사명 상속 확인.
- manager가 다른 manager를 `GET /api/users/{id}`로 조회하면 404 확인 (`user_invite_code` 노출 차단).
- manager가 같은 회사 learner를 조회하면 200 확인.
- manager 커리큘럼 생성 성공.
- admin이 manager 생성 커리큘럼을 `PATCH /api/curricula/{id}`로 수정 가능 확인.

---

## 2026-05-18 - Claude (DOMPurify sanitize 도입 — 저장형 XSS 방어)

### 배경
- Codex 점검 #2 — 학습자/매니저 HTML 입력이 `dangerouslySetInnerHTML`로 그대로 렌더링되어 저장형 XSS 위험
- TipTap 전환 가능성과 무관하게 필요한 작업이라 우선 처리 (에디터 교체해도 헬퍼는 그대로 재사용)

### 작업
- 의존성: `dompurify ^3.4.4` 추가 (`client/package.json`)
- 헬퍼: `client/src/lib/sanitize.js` 신설 — `sanitizeHtml(html)` 단일 진입점
- 적용 위치 4곳 (모든 `dangerouslySetInnerHTML` 호출처):
  - `CurriculumView.jsx`: 매니저 화면의 학습자 제출 본문 / 매니저 시뮬레이션 모달의 양식 가이드
  - `LearnerCurriculumView.jsx`: 학습자 본인 제출 본문 / 양식 가이드

### 검증
- frontend `npm run build`: pass (5.33s)

### 비고
- 헬퍼 한 군데에서 전체 sanitize 정책 제어 — 추후 에디터 교체(TipTap 등) 시에도 동일 헬퍼 그대로 사용 가능
- DOMPurify 기본 정책으로 `<script>`, `on*` 핸들러, `javascript:` URL 등 제거

---

## 2026-05-18 - Claude (Codex 점검 후속 버그/검증/UX 묶음 수정)

### 배경
- Codex로 코드 점검 진행 후 발견된 이슈와 추가 검토 항목 중 작고 영향이 큰 것 4건을 한 사이클에 일괄 처리

### 수정 항목
- **`curriculum.py` PDF 다운로드** (Codex 점검 시 자동 수정분): `pdf.output()` 무인자 호출 → `pdf.output(dest="S")` + `latin-1` 인코딩. fpdf 1.7.2의 stdout `UnicodeEncodeError` 회피
- **`CurriculumView.jsx` 다운로드 아이콘** (Codex 점검 시 자동 수정분): `src="./download_img.png"` 문자열 경로 → `src={curri_nulll}` Vite import 자산 reference. 빌드 자산 해싱 정상화
- **`schemas/task_submission.py` `task_score` 검증**: `Field(default=None, ge=0, le=100)` 추가. 잘못된 값 들어오면 DB CHECK 오류/500 대신 422 Validation Error로 응답
- **`LearnerCurriculumView.jsx` jodit config `useMemo` 안정화**: `buildJoditConfig(fullscreen)`가 매 렌더 새 객체 생성 → `JODIT_CONFIG_BASE` 모듈 상수 + `useMemo`로 reference 안정화. fullscreen 토글 시 jodit이 reload되며 작성 중 내용이 onBlur 전에 손실되는 위험 제거
- **`task_submission.py` `_strip_html` 헬퍼**: `_submission_type_from_content` / `upload_attachment`에서 JoditEditor의 빈 상태(`<p><br></p>` 등)를 `has_text=True`로 잘못 판단하던 문제 수정. `<태그>` 제거 + `&nbsp;` 등 공백 엔티티 정규화 후 길이로 판단

### 검증
- backend `compileall`: pass
- frontend `npm run build`: pass (5.26s, 청크 크기 경고는 기존 라이브러리 무게로 본 작업 무관)

### 풀 받음
- `origin/dev`: `d282e85 전체적인 레이아웃 소규모 수정` (Header/Dashboard/theme.css/search_icon — 우리 변경분과 충돌 없음)
- `theme.css`의 universal reset(`* { padding: 0 }`)은 변경되지 않아 학습자 컨텍스트 CSS 처방은 그대로 유효

### 다음 사이클 후보 (Codex 점검 + 추가 검토 잔여)
- **Codex #2**: DOMPurify sanitize 도입 (XSS 방어)
- **Codex #3**: 첨부 업로드/삭제 원자성 보장 (DB-파일시스템 보상 트랜잭션)
- **C**: MIME spoofing 방어 (python-magic 도입)
- **H**: 한글 파일명 sanitize 패턴 개선
- **G**: `handleAttachmentDownload`/`formatAttachmentSize` 헬퍼 추출 (lib/attachments.js)
- **D/E/F**: 재제출 첨부 비대칭 / `task_resubmit_requested` 컬럼 중복 / 매니저 첨부 권한 정책 결정 후 처리
- **Codex #5**: Alembic 마이그레이션 도입 (장기)

---

## 2026-05-18 - Codex (과제 첨부파일 별도 테이블 전환)

### 배경
- 사용자 제공 SQL 기준으로 `task_submissions` 확장 컬럼과 `task_submission_attachments` 테이블을 백엔드 모델/스키마/라우터에 반영
- 직전 구현은 첨부 메타를 `task_submitted_content.attachments` JSON에 저장했으나, DB 정규화 구조로 이전 필요

### 변경
- `TaskSubmission` 모델에 `task_submission_type`, `task_score`, `task_resubmit_requested` 컬럼 추가
- `TaskSubmissionAttachment` 모델 추가: `file_original_name`, `file_storage_key`, `file_mime_type`, `file_size_bytes`, `file_sha256`, `file_uploaded_at`, `file_deleted_at`
- 첨부 업로드/다운로드/삭제 라우터를 JSON 메타 방식에서 `task_submission_attachments` 테이블 조회/삽입/soft delete 방식으로 변경
- 프론트 호환을 위해 API 응답의 `task_submitted_content.attachments`에는 기존 `filename/stored_name/size/mime` 형태를 계속 병합해서 내려줌
- 피드백 저장 시 `resubmit_requested` 상태와 `task_resubmit_requested` Y/N 값을 동기화하고 `task_score` 필드를 받을 수 있게 확장
- 기존 DB 적용용 SQL `docs/task_submission_schema_migration_2026_05_18.sql` 추가 (`create_all`은 기존 테이블 컬럼을 자동 변경하지 않음)

### 검증
- `git diff --check`: pass
- backend `compileall`: pass
- FastAPI app import: pass
- frontend `npm run build`: pass (기존 큰 청크 경고만 있음)

### 참고
- 제공 SQL의 `task_submissions` CREATE TABLE에는 `task_submission_type` 줄과 `task_resubmit_requested` 줄 뒤 쉼표가 필요함

---

## 2026-05-18 - Claude (Jodit Editor 깨짐 검증 + iframe 모드 적용)

### 배경
- 매니저가 templateModal/submissionModal에서 JoditEditor로 양식 작성 시 리스트(ul/ol) 마커가 안 보이는 문제
- 표/색상/이미지 등 다른 옵션도 깨지는지 종합 검증 필요

### 검증 방식
- `client/src/components/JoditDemo.jsx` 임시 검증 페이지 신설 (`?demo=jodit` query로 진입)
- 좌: JoditEditor 입력 / 우: Default + 학습자 컨텍스트(`curriculumPageContainer`) + Raw HTML 미리보기 3개
- 종합 샘플 HTML(표/색상/리스트/이미지/폰트/링크/인용문/줄바꿈) 일괄 주입 버튼

### 진단
- 원인: `client/src/styles/theme.css` 3-9줄의 universal reset `* { padding: 0 }`이 ul/ol의 기본 `padding-left`를 0으로 만들어 마커가 컨테이너 밖으로 밀려 안 보임
- 미리보기 영역(`dangerouslySetInnerHTML`)은 inline style이 박혀 살아남지만, 에디터 입력 영역은 페이지 CSS 직접 영향

### 처방
- JoditEditor config에 `iframe: true` 추가 → 에디터 본문을 iframe으로 격리해 외부 페이지 CSS reset 차단
- `CurriculumView.jsx`의 templateModal(L580), submissionModal(L623) 두 JoditEditor 호출부 모두 적용

### 검증 결과 (사용자 시각 확인)
- ✅ 리스트(불릿/번호) 마커 정상 출력
- ✅ 표/색상/하이라이트/폰트/링크/인용문/코드 모두 의도대로 출력
- ⚠️ 외부 이미지 placeholder(`via.placeholder.com`)는 서비스 가용성 문제로 안 뜸 (jodit/CSS 문제 아님)

### 결정 사항 (다음 작업 영향)
- 이미지 입력 방식: **양식(매니저→학습자) = Paste→base64 inline**, **제출(학습자→매니저) = 첨부파일 분리**
- 양식은 jodit 기본 paste 동작에 즉시 가능, 제출 첨부파일은 별도 인프라 필요

### 정리
- JoditDemo 검증 페이지 (JoditDemo.jsx, JoditDemo.css, main.jsx의 `?demo=jodit` 분기) 모두 제거

---

## 2026-05-18 - Claude (과제 양식 배포 + 학습자 제출 재설계 + 첨부파일 + UX 개선)

### 배경
- 위 Jodit 검증 항목에서 결정한 이미지 정책(양식=paste base64, 제출=첨부파일)을 실제 구현
- 매니저 `saveTemplate`이 alert만 하던 더미 → 실제 PATCH로 학습자에게 양식 전달
- 학습자 측 plain textarea → JoditEditor + 양식 가이드 + 첨부파일 통합 모달

### 백엔드 (`server/app/routers/task_submission.py`)
- `POST /api/task-submissions/{id}/attachments` — UploadFile, 본인 제출에만, 한 파일 최대 20MB
- `GET /api/task-submissions/{id}/attachments/{stored_name}` — 인증/권한 가드 + `FileResponse`
- `DELETE /api/task-submissions/{id}/attachments/{stored_name}` — 본인 첨부만
- 저장: `server/uploads/task_attachments/{submission_id}/{uuid_원본}`. 파일명 sanitize + path traversal 차단(메타와 매칭된 stored_name만 다운로드)
- 메타는 `task_submitted_content` JSON 안 `attachments` 배열(filename/stored_name/size/mime/uploaded_at)

### `.gitignore`
- `server/uploads/` 추가 (사용자 업로드 파일이 git에 들어가지 않도록)

### 매니저 프론트 (`CurriculumView.jsx`)
- `saveTemplate`: alert → `PATCH /api/curricula/{cur_id}`로 `cur_week_plan.assignments[i].template_content` 갱신 (저장 중 disabled)
- 매니저 피드백 화면에 학습자 첨부 다운로드 링크 + 크기 표시 (axios `responseType: blob`로 인증 헤더 자동 동봉)

### 학습자 프론트 (`LearnerCurriculumView.jsx`)
- 제출 모달 재설계: 양식 가이드(`dangerouslySetInnerHTML`) + JoditEditor(`iframe: true` + `popup.selection` 비활성) + 첨부 영역
- 본인 제출 내역: HTML 렌더 + 첨부 다운로드 링크
- 첨부 처리: 메모리에 `File[]` 보관 → 본문 POST → 받은 submission_id로 첨부 차례로 업로드 → 일부 실패 시 alert
- **전체화면(fullscreen) 토글**: 96vw × 94vh, 에디터 높이 350→600 자동 확대 (매니저 templateModal과 동일 패턴)
- **움찔임 완화**: `toolbarSticky: false`, `popup: { selection: [] }`로 텍스트 선택 시 popup 안 뜨게

### CSS (`Curriculum.css`)
- 학습자 컨텍스트 HTML 렌더링 영역(`learnerSubmitTemplateContent` / `learnerWeekSubmissionBody` / `managerSubmissionContentBody`)에 `ul/ol/table/h/p` 기본 spacing 처방 — `theme.css`의 `* { padding: 0 }` 영향 차단
- 학습자 제출 모달 디자인(`learnerSubmitModal*` + `.fullscreen`) + JoditEditor wrapper popup z-index 격리

### 검증
- backend `compileall`: pass
- frontend `npm run build`: pass (5.59s, 청크 크기 경고는 기존 jodit/html2pdf 무게로 본 작업 무관)

### 알려진 제한 / 다음 작업
- 본문에 `dangerouslySetInnerHTML` 사용 — 같은 회사 내부 가정. 추후 DOMPurify sanitize 도입 권장
- 첨부 업로드 일부 실패 시 본문은 제출되지만 실패 파일 alert (재시도 UI는 추후)
- **DB 스키마 확장**(`task_submission_type`/`task_score`/`task_resubmit_requested` 컬럼, `task_submission_attachments` 테이블 + `authors`/`article_authors_mapping`/`user_activities` 신설)이 사용자 측 SQL로 정의됨. 다음 사이클에서 SQLAlchemy 모델/스키마/엔드포인트를 그 스키마로 마이그레이션 예정 (현재 JSON 안 attachments 배열을 별도 테이블로 이전)

---

## 2026-05-18 - Codex + Claude (라우터 에러 메시지 한글화)

### 배경
- 백엔드 `HTTPException(detail=...)`의 영문 메시지가 프론트 `alert()`로 그대로 노출됨
- 첫 Codex CLI 위임 시범도 겸함

### 작업 분담
- **Codex**: `server/app/routers/{chatbot, author, curriculum, article, user}.py` 5개 파일의 `detail` 영문 → 한글 (총 31개)
- **Claude**: 톤 가이드 작성, 위임 프롬프트 작성, `compileall`/`git diff` 검증, `.gitattributes` 신설, CLAUDE.md/devlog 정리

### 톤 통일 규칙
- `"X not found"` → `"X을(를) 찾을 수 없습니다"`
- `"Not found"` (권한 숨김용) → `"찾을 수 없습니다"` (짧게 유지)
- `"Only Y can ..."` → `"...은 Y만 ...할 수 있습니다"`
- 그 외는 자연스러운 존댓말 한국어로

### 협업 패턴 (처음 시도)
- chatbot/author/curriculum/article은 foreground로 한 파일씩 위임 → 검증 사이클 짧게 유지
- user.py(가장 큰 11개)는 background 위임 + Claude는 그 동안 devlog/.gitattributes/CLAUDE.md 작업 병행
- CLAUDE.md "Codex / Claude 하이브리드 협업 규칙" 섹션에 foreground/background 선택 기준과 위임 시 역할 명시 룰 추가

### 발견 사항
- PowerShell 5.1 콘솔 출력 인코딩이 CP949라서 UTF-8 파일의 한글이 콘솔에서 깨져 보임. 파일 자체는 정상 (Read 도구로 검증). Codex 프롬프트에 "PowerShell 콘솔 깨짐 무시" 안내 필요
- Codex가 신규 라인을 LF로 저장 → git autocrlf 경고. `.gitattributes`(`* text=auto`)로 해결

### 다음
- 프론트(`alert()` 호출부)에서 백엔드 detail을 그대로 노출하는지 점검 — 한글화 효과가 실제 UX에 반영됐는지 확인 필요

---

## 2026-05-18 - Claude (Codex CLI 협업 환경 셋업)

### 배경
- 토큰/비용 절감과 단순 반복 작업 위임을 위해 Codex CLI를 보조 작업자로 도입
- 메모리에 남은 이전 Codex 세션은 다른 환경 기록이었고, 로컬에는 CLI 미설치 상태였음

### 작업
- `npm install -g @openai/codex`로 OpenAI Codex CLI 0.130.0 설치 (`C:\Users\smhrd\AppData\Roaming\npm\codex.ps1`)
- `CLAUDE.md`에 "Codex / Claude 하이브리드 협업 규칙" 섹션 추가
  - devlog 허브 원칙, 작업 단위 작게 쪼개기, 같은 파일 동시 작업 금지, Codex 결과도 devlog 한 줄
  - Codex CLI 호출 예시(`codex exec -s read-only/...`)도 함께 명시
- 함께 진행한 부수 작업
  - 풀: 원격 dev → 로컬 dev fast-forward (`e526642..f894df2`)
  - 풀 직후 잘못된 위치에 깔린 npm 산출물 정리: 루트 `package.json/lock`, `server/package.json/lock` 삭제, `client/package.json`에 `jodit-react ^5.3.21` 추가 후 `npm install`
  - `README.md` 현행화: 라우터 목록(`ai_output` 제거, `author` 추가), 핵심 테이블(`authors`, `user_activity` 추가), 주요 기능(`/signup/bulk`, 마스터 대시보드, PDF 보고서 등) 반영 및 권한 정책 표 신설

### 결정
- 협업 흐름은 "Codex는 좁은 단위 위임, Claude는 큰 흐름/조정/리뷰" 역할 분담
- `task_submissions` 구조 검토 결과는 별도 결정 없이 사용자에게 의견만 전달(다른 팀원 진행 중)

### 다음
- 실제 협업 사이클을 한 번 돌려보면서 마찰점 발견 시 CLAUDE.md 규칙 보완

---

## 2026-05-15 - Claude (인라인 스타일 정리 + chart.js 등록 통합 리팩토링)

### 배경
- CLAUDE.md에 명문화된 "JSX inline style 금지" 컨벤션 위반 사례 중 가장 시급한 곳 정리
- 단계 4(PDF 보고서)에서 새로 추가된 `ReportTemplate.jsx`가 컨벤션 명문화 이후 작성됐음에도 9개의 inline style 포함
- `MasterDashboard.jsx` + `ReportTemplate.jsx` 두 곳에서 `ChartJS.register(...)` 중복 호출

### 작업
- `client/src/styles/ReportTemplate.css`
  - 표 컬럼 width/정렬용 클래스 추가: `.reportColW8`, `.reportColW15`, `.reportColW20`, `.reportAlignRight`
- `client/src/components/ReportTemplate.jsx`
  - 카테고리 TOP 5 / 인기 아티클 TOP 5 두 표의 inline style 9개 → 클래스 조합으로 전부 교체
  - 컬럼별 width와 textAlign을 클래스로 표현, 코드 중복 감소
- `client/src/styles/Curriculum.css`
  - 학습자 페이지 hint/error 클래스 4종 추가: `.learnerInlineHint`, `.learnerInlineError`, `.learnerInlineMuted`, `.learnerSubmitError`
- `client/src/components/LearnerCurriculumView.jsx`
  - 정적 inline style 5개 → 새 클래스로 교체
  - 진행률 바의 동적 `width: ${progress}%` 2개는 CLAUDE.md 예외 규정(props/state 기반 동적값)대로 inline 유지
- `client/src/lib/chart.js` 신설
  - chart.js 전역 register를 모듈 1곳으로 통합 (side-effect import)
  - 등록 컴포넌트: ArcElement, CategoryScale, LinearScale, PointElement, LineElement, Filler, Tooltip, Legend
- `client/src/components/MasterDashboard.jsx`
  - chart.js 직접 import + register 제거 → `import '../lib/chart'` 한 줄로 대체
- `client/src/components/ReportTemplate.jsx`
  - 동일하게 `lib/chart` side-effect import만 유지, 자체 register 제거

### 결정
- 동적 inline style(`learnerProgressFill`의 width)은 CLAUDE.md "props/state 기반 동적값 예외 허용" 규정대로 그대로 둠. CSS 변수 + style 속성 패턴은 React에서 가장 단순한 방법.
- chart.js register는 side-effect import로 충분. `lib/chart.js`를 import한 모든 모듈은 자동으로 등록된 차트 요소를 공유. 명시적 함수 export는 불필요하다고 판단.
- 컬럼 width 클래스를 `.reportColW8/W15/W20`처럼 명시적 이름으로 둠. nth-child 셀렉터보다 가독성 우선.

### 통계
- 프로젝트 전체 inline style: 49개 → **37개** (정적 12개 제거)
- ReportTemplate inline style: 9개 → 0개
- LearnerCurriculumView inline style: 7개 → 2개 (동적만 유지)
- chart.js register 호출 위치: 2곳 → 1곳

### 검증
- `cd client && npm run build` 통과 (3.35s, 메인 448KB / CSS 82KB)
- 동적 progress 바 / PDF 보고서 / 마스터 페이지 차트 모두 동작 유지

### 다음 / TODO
- 남은 inline style 37개 (Dashboard 13 / CurriculumView 12 / Header 3 / 기타) — 발표 후 클린업 단계에서 정리
- `MasterDashboard.jsx` 추가 분리 (시계열/도넛/통계 카드 등) — 우선순위 낮음

---

## 2026-05-15 - Codex (마스터 페이지 단계 4 — 주간/월간 PDF 보고서)

### 배경
- 마스터 페이지 고도화 1~3단계에서 만든 시계열/통계 데이터를 운영 보고서로 내려받는 단계 4 작업
- 관리자 화면에서 최근 7일/30일 기준 운영 현황을 PDF로 저장할 수 있도록 구현

### PDF 보고서 다운로드
- `client/src/components/MasterDashboard.jsx`
  - `html2pdf.js` 기반 PDF 다운로드 로직 추가
  - PDF 버튼 클릭 시점에 `html2pdf.js`를 동적 import하도록 변경해 초기 번들 크기 증가 완화
  - 헤더에 `주간 PDF`, `월간 PDF` 버튼 추가
  - 주간은 최근 7일, 월간은 최근 30일 기준으로 보고서 데이터 구성
  - 가입자 시계열, 조회수 시계열, 회원 목록 데이터를 보고서 생성 시점에 다시 조회
  - PDF 생성 중 중복 클릭을 막기 위한 `reportGenerating` 상태 추가
  - 캡처용 보고서 DOM은 offscreen 영역에 렌더링

### 보고서 템플릿
- `client/src/components/ReportTemplate.jsx` 신규 추가
  - A4 기준 PDF 캡처용 리포트 템플릿 구현
  - 기간 정보, 핵심 지표, 조회/가입 추이, 카테고리 통계, 인기 아티클, 회원 현황 포함
  - `forwardRef`로 `html2pdf` 캡처 대상 연결
- `client/src/styles/ReportTemplate.css` 신규 추가
  - PDF 출력용 흰 배경/인쇄 친화 스타일 정의
  - 페이지 단위 레이아웃과 page-break 제어

### 마스터 대시보드 리팩토링
- `client/src/components/master/MasterMemberPanel.jsx` 신규 추가
  - 회원관리 패널의 검색/필터/정렬 UI와 회원 목록 렌더링 분리
- `client/src/components/master/MasterMemberDetailModal.jsx` 신규 추가
  - 회원 상세 모달, 역할 변경, 탈퇴/복구 확인 다이얼로그 렌더링 분리
- `client/src/components/MasterDashboard.jsx`
  - 회원관리 관련 대형 JSX 블록을 하위 컴포넌트로 분리
  - 데이터 로딩/상태 변경 로직은 부모에 유지해 동작 변경 최소화

### 스타일
- `client/src/styles/MasterDashboard.css`
  - 보고서 다운로드 버튼 스타일 추가
  - `masterReportOffscreen` 캡처 영역 스타일 추가
- `.gitignore`
  - `fpdf`가 NanumGothic 폰트 등록 시 생성하는 `server/resources/fonts/*.pkl` 캐시 파일 제외

### 검증
- 원격 `dev` 최신 변경 pull 후 자동 병합 완료
  - `client/src/styles/MasterDashboard.css` 자동 병합, 충돌 없음
- 프론트엔드 빌드 통과
  - `npm run build`

---

## 2026-05-15 - Claude (마스터 페이지 단계 1~3 — 시계열 차트 / 회원 정렬 / 회원 상세 + 운영 액션)

### 배경
- 마스터 페이지 고도화 로드맵 4단계 중 1~3단계 완료
- "전사 모니터링 + 운영" 정체성 강화. 4단계(주간/월간 보고서)에서 같은 집계 API를 재사용할 수 있도록 백엔드 시계열 API 설계

### 단계 1: 시계열 차트
- 백엔드
  - `schemas/article.py` — `TimelinePoint`, `TimelineResponse` 신규 (공용 시계열 응답)
  - `GET /api/articles/stats/views-timeline?days=N` — `user_activities` 기반 일별 조회 이벤트 (admin 전용)
  - `GET /api/task-submissions/stats/timeline?days=N` — 일별 과제 제출 수 (admin 전용, 현재 미사용이나 매니저 위젯 재사용 대비 유지)
  - `GET /api/users/stats/signups-timeline?days=N` — 일별 신규 가입자 (admin 전용)
  - 모든 시계열 API는 데이터 없는 날도 0으로 채워 응답 (프론트 보간 부담 제거)
- 프론트 `MasterDashboard.jsx`
  - chart.js `Line` 컴포넌트 도입 (CategoryScale/LinearScale/PointElement/LineElement/Filler 등록)
  - "최근 활동 추이" 섹션 신설 — 좌: 조회수 라인(블루), 우: 신규 가입자 라인(초록)
  - 7일/14일/30일 기간 토글 (기본 14일)
  - 다크 톤 옵션 (tooltip, 격자, 축 라벨 모두 마스터 페이지 톤 통일)
  - 총합 뱃지 ("총 N회/명")
- 결정: 처음 후보였던 "과제 제출 추이"는 admin 입장에서 "그래서 뭐?"가 약하다는 판단. 가입자 추이가 admin 정체성(플랫폼 성장 모니터링)과 더 잘 맞음. 제출 관련 위젯은 향후 매니저 화면에서 본인 책임 영역으로 노출 예정.

### 단계 2: 회원 정렬
- `MasterDashboard.jsx` 클라이언트 측 정렬 추가
- 옵션 5종: 최신 가입순(기본) / 오래된 가입순 / 이름 ㄱ→ㅎ / 이름 ㅎ→ㄱ / 역할별(a→m→j→탈퇴)
- 검색·역할 필터·정렬 모두 클라이언트에서 처리 (현 데이터량 50명 기준 충분)

### 단계 3: 회원 상세 모달 + 운영 액션
- 백엔드
  - `schemas/user.py` — `UserUpdate`(user_role / is_deleted), `UserActivitySummary` 추가
  - `GET /api/users/{user_id}/activity-summary` — 회원 1명의 활동 5종 카운트 (만든·배정·제출·받은피드백·작성피드백)
  - `PATCH /api/users/{user_id}` — 역할 변경 + 강제 탈퇴/복구 (admin 전용)
  - 안전장치 4종:
    - 본인 액션 차단 (자기 자신은 변경 불가)
    - 마지막 admin 강등 차단
    - 마지막 admin 탈퇴 차단
    - soft delete (`user_deleted_at` 설정, 즉시 영구삭제 안 함)
- 프론트
  - 회원 행 클릭 → 회원 상세 모달
  - 모달: 기본 정보 + 활동 요약 5칸 그리드 + 역할 토글 3개 + 강제 탈퇴/복구 버튼
  - 확인 다이얼로그 (탈퇴는 빨간 위험 버튼, 복구는 블루)
  - 본인일 경우 액션 영역 잠금 + 안내 메시지

### 결정 / 의미
- "회원 상세 = 조회만"으로 시작했으나, 발표 임팩트 + 실무 정합성을 위해 **조회 + 액션(역할 변경, 강제 탈퇴/복구)** 까지 묶어 단계 3을 운영툴 완성형으로 마무리
- 법적·실무 검토 결과: B2B 학습 플랫폼에서 admin의 직원 계정 관리는 인사권의 일부로 정당. soft delete로 데이터 보존 + 안전장치 4종으로 사고 방지
- 차트 색: 조회수 블루(`#4a8fd0`), 가입자 초록(`#5cf0a8`, 성장 의미), 도넛은 기존 8색 팔레트 그대로

### 코드 컨벤션 추가
- `CLAUDE.md` — JSX inline style 금지 규정 명문화
  - 디자인 수정 작업이 분리돼 있어 스타일은 별도 CSS 파일에만 작성
  - 단, props/state 기반 동적 값(`width: ${pct}%` 등)은 예외 허용
- 기존 코드의 inline style 84곳은 일괄 정리하지 않음 (발표 임박, 충돌 위험). 앞으로 새 작업부터 적용

### 검증
- `cd server && .\venv\Scripts\python.exe -m compileall -q app` 통과
- TestClient로 라우트 등록 확인:
  - `/api/articles/stats/views-timeline`
  - `/api/task-submissions/stats/timeline`
  - `/api/users/stats/signups-timeline`
  - `/api/users/{user_id}/activity-summary`
  - `/api/users/{user_id}` (PATCH)
- `cd client && npm run build` 통과

### 다음 / TODO
- 매니저 화면에 본인 책임 영역 위젯 ("응답 대기 N건" 등) — 사용자 결정 시 진행
- inline style 일괄 정리 (발표 후 클린업 작업)

---

## 2026-05-15 - Codex (아티클 요약문 원문 링크 및 썸네일 표시 개선)

### 아티클 요약문 원문 링크
- `client/src/components/ArticleDetailView.jsx`
  - 요약문 페이지의 `원문 아티클 보기` 버튼에서 하드코딩된 외부 URL 제거
  - `displayArticle.article_source_url` 값을 사용해 실제 아티클 원문 URL로 이동하도록 변경
  - 원문 URL이 없는 아티클에서는 버튼을 렌더링하지 않도록 조건부 처리

### 상세 썸네일 표시 방식 조정
- `client/src/styles/ArticleDetailView.css`
  - 상세 페이지 썸네일 영역을 `aspect-ratio: 4 / 3` 기반으로 조정
  - 썸네일 최대 높이를 `600px`로 설정
  - `object-fit: cover`는 유지하고 `object-position: top center`를 적용해 위쪽 기준으로 크롭

### 검증
- 프론트엔드 빌드 통과
  - `npm run build`

---

## 2026-05-14 - Codex (대시보드 UX 안정화 + 아티클 카드 미리보기)

### 대시보드/헤더 UI 정리
- `client/src/components/Dashboard.jsx`, `client/src/styles/Dashboard.css`
  - 아티클 카드 hover 시 카드 자체가 움직이며 커서 경계에서 떨리던 문제 수정
  - 고정된 `articleCardShell` wrapper를 추가하고 내부 카드만 `translateY` 되도록 변경
  - 첫 번째 와이드 카드 레이아웃 규칙도 wrapper 기준으로 조정
- `client/src/components/HeroBanner.jsx`
  - 플로팅 CTA의 `핵심 기능` 라벨 제거
- `client/src/components/Header.jsx`
  - 햄버거 버튼 옆 프로필 원(`avatarCircle`) 제거

### 커리큘럼 화면 뒤로가기/로그아웃 상태 보정
- `client/src/components/Dashboard.jsx`
  - 학습자 커리큘럼 상세 화면의 브라우저 뒤로가기를 전역 대시보드 복귀 로직이 가로채지 않도록 `curriculumDetailRef` 추가
- `client/src/components/LearnerCurriculumView.jsx`
  - 학습자 커리큘럼 상세 진입 시 브라우저 히스토리에 상세 상태를 추가
  - 상세 화면에서 뒤로가기를 누르면 메인 대시보드가 아니라 커리큘럼 목록으로 복귀
- `client/src/App.jsx`
  - 로그아웃, 자동 로그아웃, 로그인 시 `dash:view`, `dash:articleId` 세션 값을 초기화
  - 매니저가 커리큘럼 관리에서 로그아웃한 뒤 재로그인 시 커리큘럼 화면이 그대로 복원되던 문제 수정

### 아티클 카드 미리보기/정렬
- `server/app/schemas/article.py`
  - `ArticleResponse.article_preview_summary_title` 필드 추가
- `server/app/routers/article.py`
  - 최신 `ai_summaries.summary_text.card_news[0]`에서 미리보기 텍스트 추출
  - 우선순위: `detailed_summary` 앞 160자 → `core_message` → `card_title`
  - `/api/articles`, `/api/articles/popular`, `/api/articles/{article_id}`, 조회수 증가 응답에 미리보기 필드 포함
  - 기본 아티클 목록 정렬을 `article_published_date desc`, `article_created_at desc`, `article_id desc`로 변경
- `client/src/components/Dashboard.jsx`, `client/src/styles/Dashboard.css`
  - 각 카테고리 섹션의 첫 번째 와이드 카드에만 요약 미리보기 표시
  - 와이드 카드 미리보기는 최대 3줄 clamp로 표시

### 검증
- 백엔드 컴파일 통과
  - `python -m compileall -q app`
- 프론트엔드 빌드 통과
  - `npm run build`
- 실제 API 응답 확인
  - `/api/articles?limit=10` 발행일 최신순 정렬 확인
  - `/api/articles?limit=3` 미리보기 텍스트 응답 확인

---

## 2026-05-14 - Codex (학습자 커리큘럼 제출/피드백 흐름 추가)

### 학습자 전용 커리큘럼 화면 추가
- `client/src/components/LearnerCurriculumView.jsx` 신규 추가
  - 학습자(`user_role === 'j'`)가 본인에게 배정된 커리큘럼 목록만 확인
  - 커리큘럼별 주차 수, 제출 주차 수, 진행률 바 표시
  - 상세 화면에서 주차별 학습 목표/실습 과제/추천 자료/체크리스트/예상 시간을 아코디언으로 확인
  - 주차별 과제 제출 모달 추가
  - 본인 제출 내용, 제출 시각, 매니저 피드백, 재제출 요청 상태 표시
- `client/src/components/Dashboard.jsx`
  - 커리큘럼 메뉴 진입 시 학습자 역할은 `LearnerCurriculumView`, 매니저/관리자는 기존 `CurriculumView`로 분기

### 매니저 커리큘럼 관리 기능 확장
- `client/src/components/CurriculumView.jsx`
  - 커리큘럼 생성 확정 단계에서 같은 회사 학습자를 선택해 즉시 배정 가능
  - 커리큘럼 상세 화면에 배정 학습자 목록/배정 변경 모달 추가
  - 선택된 커리큘럼의 제출 과제 목록 조회
  - 제출 과제별 학습자명, 주차, 제출 시각, 제출 내용, 상태 표시
  - 매니저 피드백 저장 및 재제출 요청 버튼 추가

### 백엔드 API 추가
- `server/app/routers/user.py`
  - `GET /api/users/learners` 추가
  - 매니저는 본인과 같은 회사의 활성 학습자만 조회
  - 관리자는 전체 활성 학습자 조회
  - 학습자 역할은 404로 차단
- `server/app/routers/curriculum.py`
  - 커리큘럼 생성/수정 시 배정 학습자 ID를 서버에서 재검증
  - 매니저는 같은 회사 활성 학습자만 배정 가능
  - 관리자는 전체 활성 학습자 배정 가능
- `server/app/routers/task_submission.py`
  - `GET /api/task-submissions/by-curriculum/{cur_id}` 추가
  - 매니저/관리자가 커리큘럼별 제출 과제와 학습자 정보를 함께 조회
  - 매니저는 본인이 만든 커리큘럼만 접근 가능
  - 과제 제출은 학습자 역할만 가능하며, 배정된 활성 커리큘럼과 실제 주차인지 검증
- `server/app/schemas/task_submission.py`
  - 제출 정보에 `learner_name`, `learner_email`을 포함하는 `TaskSubmissionWithLearnerResponse` 추가

### 스타일
- `client/src/styles/Curriculum.css`
  - 학습자 커리큘럼 카드/상세/주차 스텝퍼/제출 상태/피드백 영역 스타일 추가
  - 매니저 학습자 배정 UI, 제출 과제 목록, 피드백 작성 영역 스타일 추가

### 검증
- 프론트엔드 빌드 통과
  - `npm run build`
- 백엔드 컴파일 통과
  - `python -m compileall -q app`

### 한계 / 다음 개선 후보
- 학습자 제출은 현재 텍스트 본문 중심이며 파일 첨부는 미지원
- 매니저 피드백 작성 후 목록은 즉시 갱신되지만, 토스트/알림 UX는 아직 없음
- `LearnerCurriculumView`와 `CurriculumView`에 날짜 포맷/주차 정규화 helper가 중복되어 추후 공통 유틸로 분리 가능

---

## 2026-05-14 - Claude (저자 이메일링 기능 — API + 화면 + Gmail SMTP 발송)

### 배경
- 새로 분리된 `authors` / `article_authors_mapping` 테이블을 활용한 저자 이메일링 기능 구현
- 화면(EmailingView)은 기존에 더미 데이터로 골격만 있었음 → 실제 API 연결 + 발송 로직 + 인터랙션 보강
- DB 적재: authors 40명, mapping 26건 (이전 작업에서 완료)

### 백엔드
- `server/app/core/config.py` — SMTP 설정 5개 추가 (`smtp_host`, `smtp_port`, `smtp_user`, `smtp_password`, `smtp_from_name`)
- `server/.env.example` — Gmail SMTP 섹션 추가 (host/port/user/password/from_name, port 기본 465)
- `server/app/services/email_service.py` 신설 — `smtplib.SMTP_SSL` 기반 발송 유틸. `EmailNotConfiguredError` 예외 정의
- `server/app/schemas/author.py` 신설 — `AuthorListItem`, `AuthorListResponse`, `AuthorDetailResponse`, `AuthorArticleSummary`, `EmailSendRequest`, `EmailSendResponse`
- `server/app/routers/author.py` 신설
  - `GET /api/authors` — 저자 전체 + 카테고리/아티클 수 집계
  - `GET /api/authors/{author_numb}` — 저자 상세 + 작성 아티클 목록 (발행일 내림차순)
  - `POST /api/authors/{author_numb}/email` — Gmail SMTP 발송. 이메일 없는 저자는 400, SMTP 미설정 503
- `server/app/main.py` — author router import + `include_router`

### 프론트
- `client/src/components/EmailingView.jsx` 전면 재작성
  - `DUMMY_AUTHORS` 제거 → 실제 API 호출 (`/authors`, `/authors/{numb}`)
  - 카드: `author_from`(소속) + `author_email`/아티클 수 + 카테고리 태그 상위 3개
  - 상세: 저자가 작성한 아티클 카드 그리드, 썸네일 `<img>` 포함, 카드 클릭 시 아티클 상세로 이동
  - 모달: 제목 / 답장받을 이메일(선택, 비우면 본인 user_email) / 내용 → `POST .../email`
  - 발송 중 비활성화, 성공/실패 메시지, 이메일 없는 저자는 작성 버튼 비활성화
- `client/src/components/Dashboard.jsx`
  - `emailingDetailRef` (useRef) 추가
  - popstate 핸들러 분기: ref가 true면 early return (EmailingView가 자체 처리하도록 양보)
  - `<EmailingView>`에 `onOpenArticle={openArticleDetail}`, `emailingDetailRef={emailingDetailRef}` 전달
- `client/src/components/EmailingView.jsx`
  - `selectedAuthor` 변화에 따라 ref 동기화
  - 상세 진입 시 `history.pushState`, 자체 popstate 핸들러로 `setSelectedAuthor(null)`
  - 결과: 상세에서 뒤로가기 → 목록 복귀 (대시보드로 튕기지 않음)
- `client/src/styles/EmailingView.css` — `emailingHint`, `emailingError` 클래스 추가

### 결정
- **From은 항상 `SMTP_USER`** (Gmail SMTP가 인증 계정 외 발신 차단). 사용자가 입력한 "답장받을 이메일"은 **Reply-To 헤더**로 처리 → 답장이 폼 입력 주소로 가도록
- 폼 비우면 백엔드가 자동으로 `current_user.user_email`을 Reply-To에 사용
- 발송 권한 체크 없음 — 사용자 요청에 따라 인증된 모든 역할 사용 가능
- 발송 로그 DB 저장 안 함 — 발표 범위 최소화 (서버 로그로 충분)
- 26/53 매핑 누락분은 데이터 측 이슈로 분리 — 메일 발송 자체는 author_email 보유 저자에 한정되므로 기능적으로 무해

### 검증
- `compileall -q app` 통과 + `import app.main` 통과
- TestClient로 author 라우트 3개 등록 확인
- `email_service.send_email`로 본인→본인 직접 발송 테스트 성공 (Gmail SMTP 465 SSL)
- `cd client && npm run build` 통과 (105 modules)
- 사용자 브라우저에서 실제 발송 흐름 확인 (서버 재시작 후 .env 새 값 반영됨)

### 안내
- `.env.example`에 SMTP 5개 항목 추가 — 팀원도 `.env`에 동일 5개 추가 필요 (또는 발송 기능 안 쓰면 비워둬도 OK)
- pydantic-settings는 import 시점에 `.env`를 1회만 읽으므로 SMTP 설정 변경 후엔 서버 재시작 필요 (uvicorn `--reload`는 .py만 감지)

### 다음 / TODO
- 발송 이력 페이지 (선택) — 누구에게 무엇을 보냈는지
- 매핑 누락 26건 보강 — 콤마 다중 저자, 미등록 저자 등 데이터 정리
- 첨부파일 / HTML 본문 지원 (지금은 plain text)

---

## 2026-05-14 - Claude (settings .env 경로를 cwd 독립적으로 변경)

### 배경
- `server/scripts/ingest_summaries.py`를 repo root에서 실행하면 `Settings`가 `openai_api_key / db_password / secret_key` missing 에러
- 원인: `app/core/config.py`의 `env_file=".env"`가 **상대경로**라 cwd 기준으로 `.env`를 찾는데, `.env`는 `server/`에만 존재 → root cwd에선 못 찾음
- 정상 서버 실행(`cd server && uvicorn ...`)은 cwd가 server라 우연히 동작했지만, 스크립트·테스트 도구는 깨졌었음

### 작업
- `server/app/core/config.py`
  - `env_file` 경로를 `Path(__file__).resolve().parent.parent.parent / ".env"`로 변경 (서버 루트 `server/.env` 절대경로)

### 결정
- pydantic-settings의 `env_file`이 상대경로일 때 cwd 의존적이라는 게 명확한 함정 — 어디서든 동일 동작하도록 절대경로화
- 정상 서버 실행 경로는 영향 없음 (오히려 동일하게 안전해짐)

### 검증
- repo root에서 `from app.core.config import settings` → openai_api_key / db_password 정상 로드 확인
- `cd server && compileall -q app` 통과, `import app.main` 통과 (첫 시도에 MySQL 일시 네트워크 이슈가 있었지만 우리 변경과 무관, 재시도 즉시 통과)

---

## 2026-05-14 - Claude (DB 변경 동기화 — Author 모델 추가 + ai_output 잔존 제거)

### 배경
- 팀 DB 변경 (`05.14 CREATE문 수정 버전.sql`) 적용됨
  - `authors` 테이블 신설 (저자 메일링 기능 대비, articles에서 저자 정보 분리)
  - `article_authors_mapping` 매핑 테이블 신설 (Article ↔ Author N:M)
  - `articles.article_author_email` 컬럼 삭제 (authors로 이관)
  - `articles.article_source` ENUM에 'AI' 추가
  - `user_activities` 로그 테이블 신설
- 코드는 위 변경에 부분적으로만 동기화돼 있었고, 잔존 파일(ai_output 라우터·스키마)이 존재하지 않는 컬럼 참조 중

### 작업
- 신규 모델
  - `server/app/models/author.py` 신설 — `Author` 클래스 (`author_numb`, `author_name`, `author_from`, `author_email`)
  - 같은 파일에 `article_authors_mapping` secondary `Table` 정의 (article_id ↔ author_numb 복합 PK, ON DELETE CASCADE)
- `server/app/models/article.py`
  - `authors` relationship 추가 (`secondary="article_authors_mapping"`, back_populates)
  - DB CREATE문(NOT NULL) 기준으로 nullable 정정: `article_author`, `article_published_date`, `article_category`, `article_view_count`, `article_source_url`, `article_created_at`, `article_updated_at`
  - 타입 hint도 `Mapped[str]` 등으로 정리
- `server/app/models/__init__.py` — `Author`, `article_authors_mapping` 등록
- 잔존 제거
  - `server/app/routers/ai_output.py` **삭제** (DB의 `ai_summaries` 4개 컬럼 vs 라우터가 참조하던 user_id/result_json/image_url/framework_type/user_input/generated_content/is_saved 불일치, 프론트도 미사용)
  - `server/app/schemas/ai_output.py` **삭제**
  - `server/app/main.py` — `ai_output` import + `include_router(ai_output.router)` 제거
  - `server/app/schemas/__init__.py` — `AiSummaryCreate/Response/Update` import + __all__ 항목 제거
  - `server/scripts/ingest_pdfs.py`
    - 삭제된 `chunk_count` 컬럼 참조 제거
    - 미구현 `POST /api/rag/query` 호출하는 `query_rag` / `print_rag_result` + `DEFAULT_RAG_QUESTIONS` + main의 RAG 테스트 루프 제거
    - 더 이상 사용 안 하는 `import time` 정리

### 결정
- `article_authors_mapping`은 추가 컬럼 없는 순수 매핑 테이블이라 SQLAlchemy `secondary=Table()` 패턴 채택 (별도 Association 모델 클래스 X)
- relationship의 secondary는 문자열 `"article_authors_mapping"`로 지정 → 순환 import 회피
- ai_output 라우터는 정리 옵션 (DB 4개 컬럼에 맞춰 CRUD 재작성) 대신 라우터·스키마 자체 삭제 선택 — 프론트가 안 쓰고 `/api/articles/{id}/summary`로 대체 가능, 가장 깔끔
- `articles.article_author` 컬럼은 DB에 그대로 남아있어서 유지 (호환성·기존 데이터). 저자 메일링 기능 구현 시 매핑 테이블을 정식 소스로 쓰면 됨

### 검증
- `cd server && .\venv\Scripts\python.exe -m compileall -q app scripts` 통과
- `import app.main` 통과
- TestClient로 라우터 경로 enumerate — `ai-output` 흔적 없음, 총 33개 라우트 정상
- DB 직접 조회로 SQL 적용 상태 확인: `authors` 40행, `article_authors_mapping` 26행, `articles`에서 `article_author_email` 컬럼 삭제 확인 완료

### 다음 / TODO
- `article_authors_mapping`이 53건 중 26건만 매핑됨 — 데이터 마이그레이션 누락 (콤마 다중 저자, 미등록 저자, 이메일 불일치) → 메일링 기능 구현 시 누락분 처리 방침 결정
- Author 관련 스키마(`AuthorResponse`) + 라우터는 메일링 기능 구현 시 별도 추가
- `GET /api/articles` 응답에 `authors` 포함 여부 — 프론트 화면 설계에 맞춰 결정

---

## 2026-05-14 - Claude (마스터 페이지 고도화 — 도넛 차트 / 인기 아티클 / 학습 활동 통계 / 회원 검색 / 디자인 리뉴얼)

### 배경
- 마스터 페이지가 더미 → DB 연결까지는 됐지만 시각화·기능·디자인이 빈약 (수동 막대 그래프, 단조로운 카드, 라이트 박스가 다크 본문과 어색하게 분리)
- 학습 플랫폼인데 정작 "학습 활동" 통계(커리큘럼·과제)가 없어 사용자 통계만 보여줌
- 회원관리 패널이 검색·필터 없이 50명 일렬 나열

### 백엔드
- `server/app/schemas/curriculum.py` — `CurriculumStatsResponse` 신설 (`total_curricula`, `active_learners`, `total_submissions`)
- `server/app/routers/curriculum.py`
  - `GET /api/curricula/stats` 신규 (admin `a` 전용, 권한 없으면 404로 숨김)
  - 정적 경로 `/stats`를 동적 `/{cur_id}`보다 위에 등록 (CLAUDE.md 규칙)
  - `active_learners`는 active 커리큘럼들의 `cur_assigned_learner_ids` JSON을 Python `set`으로 합쳐 unique 카운트
  - `total_submissions`은 `task_submissions` 전체 row 수

### 프론트 (MasterDashboard.jsx)
- 도넛 차트 도입 (`chart.js` + `react-chartjs-2`, 의존성은 이미 설치돼 있어 추가 없음)
  - 카테고리별 조회수 TOP 5를 막대 → 도넛으로 교체
  - 다크 톤 옵션: legend 흰색, tooltip 다크 글래스, cutout 65%, 보더 다크 처리
- 인기 아티클 TOP 5 섹션 신설
  - `/api/articles/popular?limit=5` 호출, 카드 5열 그리드
  - 순위 그라데이션 배지, 썸네일 + 카테고리 태그 + 제목(2줄 clamp) + 👁 조회수
- 학습 활동 현황 통계 카드 3장 추가
  - 총 커리큘럼 수 / 진행 중 학습자 수 / 누적 과제 제출 수
- 회원 검색·필터 컨트롤
  - 검색창: 이름·이메일·회사 어디든 부분 일치 (대소문자 무시)
  - 역할 필터: 전체 / 관리자 / 매니저 / 학습자 / 탈퇴
  - 결과 카운트 표시 (`X / Y명`)
  - 클라이언트 측 필터 (이미 받아온 50명에 적용, 추가 API 호출 없음)
- 만족도 영역: "☆☆☆☆☆" 정체불명 헤딩 → 정상 섹션 타이틀로, 박스 700px → 200px 점선 placeholder

### 디자인 리뉴얼 (MasterDashboard.css 전면 재작성)
- 색상 토큰 도입 (`:root` 변수: `--m-surface`, `--m-accent-grad`, `--m-text-dim` 등)
- 컨테이너: 단색 → 블루·퍼플 radial 글로우 + 깊은 다크 (`#0a0e14`)
- 헤더: 라이트 회색 → 다크 글래스 (`backdrop-filter: blur(16px)`) + sticky
- 로고: 검정 단색 → 그라데이션 텍스트
- 회원관리 버튼: 텍스트 → 글래스 버튼
- 섹션 타이틀: 가운데 → 좌측 정렬 + 좌측 그라데이션 액센트 바
- 통계 카드: 흰 보더 평면 → 다크 글래스, hover 시 상단 빛 line + lift + 보더 글로우
- 차트 박스: 라이트 회색 → 다크 글래스로 통일
- 회원관리 패널: 라이트(`#F4F4F4`) → 다크 글래스 (`rgba(15,20,28,0.92)` + blur 24px), 1141px → `min(720px, 92vw)`
- 회원 행·상태 뱃지·검색/필터 input 모두 다크 글래스로 통일
- 로그아웃 버튼: 빨간 텍스트 → 빨간 글래스 버튼

### 결정
- 통계 API는 자원별 분리 (`/users/stats`, `/articles/stats/by-category`)와 일관성 맞춰 `/curricula/stats`로 분리
- 회원 검색은 백엔드가 아닌 클라이언트 필터링 — 현재 데이터량(50명)에 추가 API 호출 비용이 더 비효율
- chart.js를 도입한 이유는 `package.json`에 이미 설치돼 있어 의존성 변화 없음
- 디자인은 "한 영역만 손대면 톤이 더 안 맞을 것 같다"는 판단으로 CSS 전체 재작성

### 검증
- `cd server && .\venv\Scripts\python.exe -m compileall -q app` 통과
- `import app.main` 통과
- `cd client && npm run build` 통과 (105 modules, 1.21s, CSS 53KB / JS 381KB)
- 사용자 브라우저에서 admin 로그인 후 통계·도넛·인기 아티클·검색/필터 모두 정상 표시 확인

### 다음 / TODO
- 시계열 차트 (일별·월별 가입자 추이, 조회수 추이) — 백엔드 집계 API 필요
- 회원 정렬 (가입일·이름·역할 토글)
- 회원 상세 모달 (선택 회원의 커리큘럼·과제 이력)
- 만족도/의견 수집 테이블 + API + 입력 폼

---

## 2026-05-14 - Claude (아티클 목록 정렬 기준 통일 — 발행일자 최신순)

### 배경
- 메인 대시보드 카테고리별 상위 5개 카드 / 카테고리 페이지 둘 다 `GET /api/articles`를 공유하지만 정렬 기준이 `article_created_at`(DB 등록 시각)이라 실제 발행일과 어긋남
- 사용자 입장에서는 "최신 아티클"이 발행일 기준이어야 직관적

### 작업
- `server/app/routers/article.py` (`list_articles`)
  - `order_by(Article.article_created_at.desc())` → `order_by(Article.article_published_date.desc(), Article.article_created_at.desc())`
  - 1순위 발행일자, 2순위 등록일자(tie-breaker)
  - MySQL DESC에서 NULL은 자동으로 맨 뒤 → 발행일 누락 아티클은 자연스럽게 뒤로 밀림

### 결정
- 메인/카테고리 모두 같은 `/articles` API를 쓰기 때문에 백엔드 한 곳만 수정 → 양쪽 통일
- `/popular`(조회수순), `/categories`(이름순), `/stats/by-category`는 의미가 달라 손대지 않음
- tie-breaker로 `article_created_at`을 둔 이유: 같은 발행일이라도 가장 늦게 등록된 것이 일반적으로 더 최신 시점에 큐레이션된 아티클이라는 판단

### 검증
- `cd server && .\venv\Scripts\python.exe -m compileall -q app` 통과
- 메인 대시보드 / 카테고리 페이지 발행일 정렬 확인은 사용자 측에서 진행

---

## 2026-05-14 - Claude (HeroBanner 슬라이드 클릭 시 아티클 상세 이동)

### 배경
- 메인 상단 배너에 "AI 자동화 위험을 줄이기 위한 새로운 HRD 전략" / "DBR과 함께 학습하는 조직 소개" 두 슬라이드가 정적 데이터로만 표시되고 있었음
- 배너 문구와 실제 아티클(DB의 article_id 28, 42)이 분리돼 있어 사용자가 배너를 보고도 아티클 본문으로 진입할 경로가 없음

### 작업
- `client/src/components/HeroBanner.jsx`
  - `SLIDES` 각 항목에 `articleId` 필드 추가 (1번 → 28, 2번 → 42)
  - `onOpenArticle` prop 추가
  - `bannerText` 영역에 `onClick` 핸들러 + `cursor: pointer` + `role="button"` 부여 → 텍스트 영역만 클릭 가능 (좌우 화살표·점 인디케이터와 이벤트 분리)
- `client/src/components/Dashboard.jsx`
  - `<HeroBanner>`에 `onOpenArticle={openArticleDetail}` 전달
  - 기존 `openArticleDetail`이 이미 `POST /articles/{id}/view`까지 처리하므로 별도 핸들러 추가 불필요

### 결정
- 클릭 영역 후보 (A) 텍스트 영역만 / (B) 배너 전체 중 **A 채택**
  - 좌우 화살표·인디케이터와의 이벤트 충돌 방지
  - stopPropagation 없이도 안전하게 동작
- 슬라이드↔아티클 매핑은 하드코딩
  - 발표용/데모용이라 동적 로드 불필요
  - DB의 `article_title`을 키워드로 검색해서 ID 확정 (28, 42)

### 검증
- `cd client && npm run build` 통과 (101 modules, 928ms)
- 브라우저 직접 클릭 테스트는 사용자 측에서 진행

---

## 2026-05-14 - Claude (CLAUDE.md — Pull 전 체크리스트 섹션 추가)

### 배경
- 기존 CLAUDE.md에는 "커밋 전 체크리스트"만 있고 pull 전 충돌 가능성 점검 절차는 정의돼 있지 않았음
- 로컬 수정 중인 파일이 원격 변경과 겹쳐 충돌이 발생하는 경우를 사전에 막을 가이드 부재

### 작업
- `CLAUDE.md` — "커밋 전 체크리스트" 섹션 바로 위에 "Pull 전 체크리스트" 7단계 추가
  - `git status` → `git fetch` → `git log HEAD..origin/<branch> --oneline` → `git diff --stat` → 겹침 여부 확인 → `git pull` → pull 이후 `.env.example` / `requirements.txt` / `package.json` 변경 동기화

### 결정
- 별도 문서가 아닌 CLAUDE.md에 통합 — 기존 "커밋 전 체크리스트"와 짝을 이루도록 인접 배치

---

## 2026-05-13 - Claude (새로고침 시 view 복원 — sessionStorage)

### 배경
- SPA 라 F5 누르면 React state 초기화 → `view` 가 항상 기본값 `'articles'` 로 돌아가 메인으로 가버림
- 학습자가 아티클 상세 / 커리큘럼 / 이메일링 화면 보다가 새로고침하면 답답함

### 작업
- `client/src/components/Dashboard.jsx`
  - 마운트 시 sessionStorage 읽어서 view 복원하는 `useEffect` 추가
    - `dash:view === 'articleDetail'` + `dash:articleId` 있으면 `GET /api/articles/{id}` 로 다시 fetch 해서 상세 화면 진입
    - 404 등 catch 시 키 정리 후 기본 흐름
    - `curriculum` / `emailing` 은 단순 `setView` 만
  - view / selectedArticle.article_id 변경 시 sessionStorage 에 영속화하는 `useEffect` 추가
  - `resetDashboard` 는 그대로. 로고 클릭 시 view='articles' 로 가면 persist useEffect 가 자동으로 `dash:articleId` 제거 + `dash:view='articles'` 로 동기화

### 결정
- 후보 3가지 (sessionStorage / react-router-dom / 그대로) 중 sessionStorage 채택
  - 코드 변경 최소 + 현재 popstate/history 흐름과 자연스럽게 맞물림
  - 다른 팀원 작업 영역 (App/Header/Dashboard 등) 과 충돌 위험 적음
  - URL 공유는 현재 학습 시나리오의 핵심이 아님
- 키 prefix 는 `dash:` — Dashboard 컴포넌트 영역만 관리. user_id 별 분리는 안 함 (sessionStorage 가 탭 단위라 실용적 충돌 거의 없음)
- 로그아웃 시 sessionStorage 정리는 별도로 안 함 — 탭 닫으면 자동 정리되고, 같은 탭에서 재로그인 시 같은 view 복원되어도 무해

### 검증
- `cd client && npm run build` 통과
- 브라우저 시나리오:
  - 아티클 상세 → F5 → 같은 상세 화면 복원
  - 커리큘럼/이메일링 → F5 → 같은 메뉴 유지
  - 메인 articles → F5 → 그대로
  - 로고 클릭 → 메인 + sessionStorage 자동 동기화 확인

### 한계 / TODO
- URL 이 바뀌지 않으므로 북마크/링크 공유 불가능. 추후 외부 공유 시나리오가 생기면 `react-router-dom` 도입 재검토
- 탭 닫으면 사라짐 (localStorage 가 아니라 sessionStorage 선택) — 의도된 동작

---

## 2026-05-13 - Claude (마스터 페이지 DB 연결)

### 배경
- 마스터 페이지(`MasterDashboard`)가 통계 카드/회원 목록/카테고리 차트 자리까지 전부 더미 데이터로 표시 중
- 매핑 가능한 항목부터 실제 DB 데이터로 연결 (산업군/만족도는 DB 스키마 부재로 보류)

### 백엔드 신규 API (모두 admin `a` 전용, 권한 없으면 404 로 숨김)
- `GET /api/users/stats` — `total_users`, `monthly_signups`, `top_company`
  - `monthly_signups` 은 UTC 기준 이번 달 1일 이후 created_at
  - `top_company` 는 빈 문자열 제외하고 가장 많은 user_company
- `GET /api/users?page=&limit=` — 전체 회원 목록 (페이지네이션, soft delete 포함해서 반환)
  - 라우터 순서: `/me` `/stats` `""` 정적 경로 → `/{user_id}` 동적 경로 순으로 정렬
- `GET /api/articles/stats/by-category` — 카테고리별 `total_views` + `article_count`
  - `func.coalesce(sum(article_view_count), 0)` 로 NULL 안전 처리
  - `article_category IS NOT NULL` 만 대상

### 스키마
- `schemas/user.py` — `UserListResponse`, `UserStatsResponse` 신설
- `schemas/article.py` — `CategoryStatItem`, `CategoryStatsResponse` 신설

### 프론트 (`client/src/components/MasterDashboard.jsx`)
- `DUMMY_STATS`, `DUMMY_MEMBERS` 제거
- 마운트 시 `GET /users/stats` + `GET /articles/stats/by-category` 호출, 회원 패널 열릴 때 `GET /users` 호출 (lazy)
- 상단 통계 카드 3개에 실제 값 매핑 (총수/이번 달 신규/최다 회사)
- 아티클 조회수 영역:
  - TOP 5 카테고리: 막대그래프 + 조회수 표시 (`total_views / sum * 100` 비율)
  - 전체 카테고리: 아티클 수 리스트
- 회원관리 패널:
  - `user_name`, `user_email`, `user_company`, `user_created_at(YYYY.MM.DD)` 표시
  - 상태는 `user_role` 기반 라벨링 (`a`→관리자, `m`→매니저, `j`→학습자), 탈퇴(`user_deleted_at IS NOT NULL`) 만 빨간색 warning
- 만족도 영역은 DB 모델 부재로 자리만 유지 ("추후 추가 예정" 텍스트로 변경)
- `MasterDashboard.css` 에 `masterCategoryList`, `masterCategoryBar(Fill)`, `masterChartEmpty`, `masterError`, `masterLoading` 스타일 추가

### 결정 / 의미 변경
- 더미의 "가장 많은 산업군" → "가장 많은 회사" (DB 에 industry 컬럼 없어서 user_company 로 대체)
- 더미의 "정상/경고" 상태 → role 라벨 + 탈퇴 여부 (status 컬럼 없음, 경고 개념은 일단 제외)
- 도넛 차트 → 막대 + 텍스트 리스트 (정식 차트 라이브러리 도입 별건)
- 만족도 / 의견 수집은 별도 테이블 + API 설계 필요해서 이번 작업 범위 밖

### 검증
- 백엔드: `compileall -q app` + `import app.main` 통과
- 백엔드 API 응답 (admin JWT 로 TestClient):
  - `/api/users/stats` → 200, `{total_users: 33, monthly_signups: 33, top_company: "삼성전자"}`
  - `/api/users?limit=5` → 200, 회원 5명 정상 응답
  - `/api/articles/stats/by-category` → 200, 마케팅 51회 / 경영전략 7회 등 8개 카테고리
- 프론트: `npm run build` 통과
- 사용자 브라우저에서 admin 계정(`admin01@test.com`) 로 로그인 후 화면 확인 완료

### 다음 / TODO
- `users` 테이블에 `industry` 컬럼 추가 검토 (정식 산업군 표시)
- 도넛 차트 라이브러리 도입 (recharts 또는 chart.js)
- 만족도/의견 수집 테이블 + API 설계
- 회원 목록 페이지네이션 UI (현재는 limit=50 으로 단일 페이지)

---

## 2026-05-13 - Claude (헤더 로고 클릭 시 대시보드 초기화)

### 배경
- 학습자/매니저가 카테고리 탭이나 검색으로 화면을 좁힌 뒤 "처음으로" 돌아갈 명확한 진입점이 없었음
- 기존 `LANDFACTORY` 로고 클릭은 일부만 reset 했음 (view 전환 + 검색어 input 일부 클리어만, 카테고리/스크롤/selectedArticle은 누락)

### 작업
- `client/src/components/Dashboard.jsx`
  - `resetDashboard()` 함수 신규 — view='articles', selectedArticle=null, selectedCategory=null, searchQuery='', sections=originalSections, smooth scroll to top
  - Header 에 `onReset={resetDashboard}` prop 전달
- `client/src/components/Header.jsx`
  - props 에 `onReset` 추가
  - `LANDFACTORY` 로고 클릭 핸들러를 `onReset()` 호출로 단일화 (기존 `onViewChange`/`onSearch('')` 흐름은 resetDashboard 가 더 폭넓게 처리)
  - 로고에 `cursor: pointer` 명시

### 결정
- 진입점 후보로 `HeroBanner` 배너 영역 onClick 도 검토했으나, 스크롤 내리면 화면에서 사라져서 도달성이 낮음. 사용자도 "로고를 의미했다"고 확인. HeroBanner 변경은 원복
- 로고 클릭이 articleDetail/curriculum 등 다른 view 에서도 보이므로, 그 경우 메인으로 복귀시키기 위해 setView('articles') + setSelectedArticle(null) 도 reset 범위에 포함

### 검증
- `cd client && npm run build` 통과
- 브라우저 시나리오 확인:
  - 카테고리 탭 선택 + 스크롤 내림 → 로고 클릭 → 전체 탭 + 스크롤 최상단 복귀
  - 검색 결과 보던 중 로고 클릭 → 원본 7개 카테고리 섹션 복원
  - 콘솔 진단 로그로 scrollY 103 → 0 이동 확인 (그 후 로그 제거)

---

## 2026-05-13 - Codex (아티클 상세 응답 최적화)

### 작업
- `ArticleDetailView` 진입 시 중복으로 호출하던 `GET /api/articles/{article_id}` 제거.
- 카드 클릭 시 `POST /api/articles/{article_id}/view` 응답으로 받은 최신 Article 데이터를 상세 화면에 그대로 사용.
- 대시보드 카드 썸네일과 상세 히어로 이미지에 `loading="lazy"` 적용.

### 검증
- `cd client && npm run build` 통과

---

## 2026-05-13 - Codex (카테고리 탭 전체 표시 조정)

### 작업
- 대시보드 아티클 그룹 생성 시 카테고리별 원본 목록을 5개로 자르지 않고 전체 보관하도록 변경.
- 전체 탭에서는 기존 대시보드 밀도 유지를 위해 카테고리별 5개만 표시.
- 특정 카테고리 탭 선택 시 해당 카테고리의 전체 아티클을 표시.

### 검증
- `cd client && npm run build` 통과

---

## 2026-05-13 - Codex (아티클 조회수 API 분리)

### 작업
- `articles.article_view_count` DB 컬럼 존재 확인
  - `int`, nullable, default `0`
  - 현재 전체 53건, NULL 0건, 당시 min/max 모두 0으로 확인
- 기존 `GET /api/articles/{article_id}` 상세 조회에서 조회수 증가까지 처리하던 구조를 분리
  - 신규 `POST /api/articles/{article_id}/view` 추가: 조회수 1 증가 후 최신 Article 응답 반환
  - 기존 `GET /api/articles/{article_id}`는 순수 상세 조회만 수행
- `client/src/components/Dashboard.jsx`
  - 아티클 카드 클릭 시 `POST /articles/{id}/view` 호출 후 상세 화면으로 이동
- `client/src/components/ArticleDetailView.jsx`
  - 상세 화면에서 최신 아티클 데이터를 조회해 표시
  - 상세 메타 영역에 `조회 N` 표시 추가

### 결정
- React 개발 모드 `StrictMode`에서 `useEffect`가 두 번 실행되면 GET 상세 조회 기반 조회수 증가가 +2로 누적될 수 있어, 조회수 증가는 명시적 이벤트 API로 분리.

### 검증
- `cd server && .\venv\Scripts\python.exe -m compileall -q app` 통과
- `import app.main` 통과
- `cd client && npm run build` 통과

---

## 2026-05-13 - Codex (미구현 API 시연 범위 메모)

### 보류 API
- `/api/ai-outputs/*`는 AI 결과물 저장/관리 확장용 라우터로, 현재 아티클 요약문 조회 흐름(`GET /api/articles/{article_id}/summary`)에서는 사용하지 않음. 현재 `ai_summaries` 모델 스키마와 라우터/스키마가 맞지 않으므로 기능 구현 전까지 시연 범위에서 제외.
- `POST /api/rag/query`는 질문형 RAG 응답용 라우터로, 현재 프론트/커리큘럼 생성 흐름에서는 직접 호출하지 않음. `rag_service.query_rag` 미구현 상태이므로 기능 구현 전까지 시연 범위에서 제외.
- 과제 제출/챗봇 관련 검증 보완은 해당 화면/기능 구현 시점에 처리.

---
## 2026-05-13 - Claude (DB 컬럼명 동기화)

### DB 변경 (팀원 작업)
- `curriculum.cur_ai_prompt_input` (TEXT) → `cur_learning_detail_goal` (JSON), 코멘트 "세부 학습 목표"
- `chatbot_messages.role` → `talker` (ENUM 값 `user`/`assistant` 동일, 코멘트 "발화 주체")

### 코드 동기화
- `cur_ai_prompt_input` → `cur_learning_detail_goal` (5곳)
  - `server/app/models/curriculum.py` — 컬럼명 + 타입 `Text → JSON`. Python 측 타입은 일단 `str | None` 유지 (저장 시 JSON-string 으로 직렬화됨)
  - `server/app/schemas/curriculum.py` — Create/Update/Response 3개 모두
  - `server/app/routers/curriculum.py` — `create_curriculum` 의 모델 생성자 인자
  - `client/src/components/CurriculumView.jsx` — 저장 payload 필드명
- `role` → `talker` (3곳, 프론트 영향 없음)
  - `server/app/models/chatbot.py`
  - `server/app/schemas/chatbot.py` — `ChatbotMessageCreate.talker`, `ChatbotMessageResponse.talker` (타입 alias 이름 `ChatbotRole`은 그대로 둠 — 값은 동일)
  - `server/app/routers/chatbot.py` — `create_message` 의 모델 생성자 인자

### 검증
- `cd server && .\venv\Scripts\python.exe -m compileall -q app` 통과
- `import app.main` 통과
- `cd client && npm run build` 통과 (100 modules, 847ms)

### 보류 (TODO)
- `cur_learning_detail_goal` JSON 컬럼을 실제로 활용할 구조 (list[str] vs dict 등) — 프론트 폼 설계할 때 결정
- 현재는 string 그대로 JSON-string 으로 저장됨

---

## 2026-05-13 - Claude (백엔드 정합성 점검 + 잔재 정리)

### 점검
- 작업 로그 + 현 코드 정합성 전수 점검
- 발견된 큰 이슈 (당장 수정 안 함, 사용 시점에 같이 손보기로 결정)
  - `POST /api/rag/query` — `rag_service.query_rag` 함수 부재 (라우터에서 호출하지만 서비스에 없음)
  - `/api/ai-outputs/*` 4종 — `AiSummary` 모델 컬럼(`output_id`, `article_id`, `summary_text`, `created_at`)과 라우터/스키마가 참조하는 컬럼(`user_id`, `result_json`, `image_url`, `framework_type`, `user_input`, `generated_content`, `is_saved`) 불일치
  - `article_author_email` — devlog는 JSON 컬럼, 실제 모델은 `String(200)` (DB 마이그레이션 영향 있어 보류)

### 수정 (가벼운 정리 3건)
- `server/app/schemas/ai_output.py` — `AiSummaryResponse`의 `is_saved`/`created_at` 중복 필드 제거
- `server/app/models/article.py` — `AiSummary` top-level import 제거 (TYPE_CHECKING만 유지), 미사용 `JSON` import 정리
- 삭제된 `article_chunk_count` 컬럼 참조 제거
  - `server/app/routers/article.py` — `article.article_chunk_count = chunk_count` 대입 + 뒤따르는 commit/refresh 제거 (벡터스토어 ingest 호출은 유지)
  - `server/app/schemas/article.py` — `ArticleResponse.article_chunk_count` 필드 제거

### 검증
- `cd server && .\venv\Scripts\python.exe -m compileall -q app` 통과
- `import app.main` 통과
- 프론트(`client/`)에 `article_chunk_count` 사용처 없음 확인

### 참고
- `server/scripts/ingest_pdfs.py`는 `article['chunk_count']`와 `/api/rag/query`를 호출하는 부분이 남아 있어 그대로 돌리면 깨짐. 스크립트는 운영 코드가 아니라 보류
- RAG/ai_outputs 라우터는 등록 상태 유지 (Swagger에 노출). 발표/시연 일정 가까워지면 `main.py`에서 임시 주석 처리 고려

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
| 모델 | `users`, `articles`, `curriculum`, `ai_summaries`, `task_submissions`, `chatbot_sessions`, `chatbot_messages` |
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

---

## 2026-05-07 - chanhui (Dashboard 아티클 연동 + 인증/네비 폴리싱)

### 작업
- Dashboard 아티클 목록 실연결
  - `client/src/components/Dashboard.jsx`: `DASHBOARD_DATA` 하드코딩 제거. `GET /api/articles?limit=100` 한 번 호출 → 카테고리별 그룹화, 글 많은 순 정렬, 각 5개 노출. 로딩/에러/빈 상태 처리. 카드 표시 필드 매핑(`article_title`, `article_source`, `article_category`, `article_published_date`)
  - `client/src/components/ArticleDetailView.jsx`: 필드 이름을 실제 API 응답에 맞춰 변경(`article_title` 등). 메타 라인(출처/저자/발행/카테고리) 추가
- 401 자동 로그아웃
  - `client/src/lib/api.js`: 401 응답 시 `auth:logout` 커스텀 이벤트 발행
  - `client/src/App.jsx`: 이벤트 수신 시 `setUser(null) + setScreen('intro')`로 Intro 복귀
- 브라우저 뒤로가기 처리
  - `client/src/components/Dashboard.jsx`: `view` 변경마다 `history.pushState` + popstate 리스너. 메인 articles에서 back 시 재push로 chrome 종료 방지, 서브뷰(articleDetail/curriculum/emailing)에서 back 시 articles로 복귀
  - ArticleDetailView 내부 "← 뒤로가기" 버튼도 `window.history.back()` 호출하도록 통일
- published_date 빈 값일 때 카드 메타의 dot 숨김

### 검증
- 백엔드 articles 테이블 `article_chunk_count` 컬럼 누락 발견 (어제 마이그레이션 누락분) → `ALTER TABLE articles ADD COLUMN article_chunk_count INT NULL DEFAULT 0;` 적용 후 정상화
- 브라우저(Vite 5173, FastAPI 8000) 시나리오:
  - Dashboard에 7개 카테고리 섹션 정상 노출 (마케팅 12, 경영 9, AI 4, 리더십 4, HRD 3, 조직 3, 인문 2)
  - 카드 클릭 → ArticleDetailView 진입, 메타 정상 표시
  - 카드 진입 후 브라우저 back → 목록 복귀
  - 메인 articles에서 브라우저 back → 페이지 유지(chrome 종료 방지)

### 참고
- 메인 articles에서 back을 매우 빠르게 연타하면 React StrictMode 더블 mount + Chrome의 동일 state push 병합 영향으로 드물게 빠져나갈 수 있음. 정식 라우팅이 필요하면 `react-router-dom` 도입 권장
- Insights 데이터(`/api/articles/{id}/insights`)는 인덱싱이 비어 있어 상세 화면 본문/시각화 연결은 보류
- 회원가입 화면은 디자인/정책 갭 (회사 + 디자이너가 만든 직원 다건 등록 vs 백엔드 학습자 1명 셀프 가입)으로 보류, 멘토링 후 방향 결정 예정

---

## 2026-05-11 - chanhui (아티클 조회수 + 인기 엔드포인트 + 뒤로가기 안정화 + 로그인 폼)

### 작업
- 아티클 조회수 기능
  - DB `articles` 테이블에 `article_view_count INT NULL DEFAULT 0` 컬럼 추가 (수동 ALTER)
  - `server/app/models/article.py`, `server/app/schemas/article.py`에 `article_view_count` 필드 추가
  - `GET /api/articles/{id}` 호출 시 `update(...).values(article_view_count=Article.article_view_count + 1)`로 atomic 증가, `db.refresh()`로 메모리 객체 갱신 후 반환
- 인기 아티클 엔드포인트
  - `GET /api/articles/popular?limit=N` 신설 (`limit` 기본 10, 최대 50)
  - `article_view_count` 내림차순, 동점 시 `article_created_at` 내림차순
  - 라우터 순서: `/{article_id}` 위에 선언 (정적 경로 우선 규칙)
  - 인증 필요, 별도 역할 제한 없음
- 메인 대시보드 뒤로가기 안정화 (`client/src/components/Dashboard.jsx`)
  - popstate 리스너를 mount-only로 분리, view는 `useRef`로 추적해 stale closure 회피
  - `pushState` 상태에 `t: Date.now()` 박아 Chrome의 동일 state push 병합 회피
  - 초기 mount 시 push 2개로 React StrictMode 더블 mount 흡수
  - 서브뷰(articleDetail/curriculum/emailing) 진입 시 별도 useEffect에서 push
  - `ArticleDetailView` "← 뒤로가기" 버튼은 `window.history.back()`로 통일
- 로그인 폼 정리 (`client/src/components/Intro.jsx`)
  - input들을 `<form onSubmit>`으로 감싸 'Password field is not contained in a form' DOM 경고 해결
  - 엔터 키로 로그인 가능
  - `autoComplete` 속성으로 자동 채움 신호 정리 (email은 `off`, password는 `new-password`)
  - 등록 버튼 `type="button"` 명시해 폼 submit 충돌 방지

### 검증
- 백엔드 `python -m compileall -q app` 통과
- 브라우저(Vite 5173, FastAPI 8000) 시나리오:
  - `GET /api/articles/{id}` 반복 호출 시 응답의 `article_view_count` 1씩 증가
  - `GET /api/articles/popular`이 view_count 내림차순으로 정렬된 N개 반환
  - 메인 articles에서 브라우저 back 여러 번 → 페이지 유지(chrome 종료 방지)
  - 상세→back, 메뉴→back 등 서브뷰 흐름 정상
  - 엔터 키 로그인 동작

### 참고
- 디자이너가 push한 `Dashboard.jsx`의 `onBack` 변경(직접 `setView`)을 다시 `window.history.back()`로 통일 — popstate handler와 in-app back 동작 일치 위함. 디자이너가 또 풀해서 손대면 깨질 수 있어 사전 공지 필요
- 로그인 폼의 `autoComplete="new-password"`는 브라우저 자동 채움 신호 표준값. Chrome의 비밀번호 관리자에 저장된 항목 dropdown은 별도 (Chrome 설정에서 직접 삭제하거나 시크릿 모드 사용)
- `article_view_count` 컬럼은 어제 발견한 `article_chunk_count` 누락 케이스와 함께 마이그레이션 누락 패턴. 향후 새 컬럼 추가 시 ALTER와 모델/스키마를 한 번에 묶는 워크플로 권장
- 마스터 페이지의 "많이 본 아티클" UI는 미구현. `/popular` 엔드포인트만 준비된 상태

---

## 2026-05-11 - Codex (AI 커리큘럼 생성 API + 프론트 저장 흐름 연결)

### 작업
- AI 커리큘럼 생성 백엔드 서비스 추가
  - `server/app/services/curriculum_service.py` 신규 생성
  - 기존 `ai/curr.py`의 핵심 프롬프트/LLM 호출 흐름을 백엔드 서비스용으로 재구성
  - 입력값(과정명/직무/산업/기간/학습목표/필수내용)을 받아 주차별 `cur_week_plan` JSON 리스트로 반환
  - LLM 응답의 markdown code fence 제거 후 JSON 파싱
- 커리큘럼 생성 스키마 추가
  - `server/app/schemas/curriculum.py`
  - `CurriculumGenerateRequest`, `CurriculumGenerateResponse` 추가
- 커리큘럼 생성 API 추가
  - `server/app/routers/curriculum.py`
  - `POST /api/curricula/generate` 추가
  - manager/admin(`m`, `a`)만 호출 가능
  - 자동 저장하지 않고 AI 생성 결과만 반환
  - AI 호출/파싱 실패 시 502 응답으로 변환
- 프론트 커리큘럼 생성 흐름 연결
  - `client/src/components/CurriculumView.jsx`
  - 기존 `DUMMY_PREVIEW` 제거
  - 생성 모달에 과정명/직무/산업/기간/학습목표/필수내용 입력 폼 추가
  - `POST /api/curricula/generate` 호출 후 실제 AI 결과를 미리보기 모달에 표시
  - 미리보기에서 `생성` 클릭 시 `POST /api/curricula`로 DB 저장
  - 저장 후 목록을 다시 불러오고 방금 생성한 커리큘럼 선택
  - 생성/저장 로딩 상태와 에러 메시지 처리 추가
- 프론트 스타일 보강
  - `client/src/styles/Curriculum.css`
  - 생성 폼, 입력 필드, 생성 버튼, 에러 문구 스타일 추가
  - 미리보기 모달이 긴 주차 계획도 표시할 수 있도록 최대 높이/스크롤 처리

### 기존 대비 변경점
- 기존에는 커리큘럼 목록 조회(`GET /api/curricula`)와 상세 표시만 연결되어 있었음
- 생성 모달은 채팅 UI 형태의 더미 미리보기(`DUMMY_PREVIEW`)만 표시했음
- 이제는 실제 AI 생성 API를 호출하고, 사용자가 검토한 뒤 DB에 저장하는 흐름까지 연결됨
- `ai/curr.py`를 서버에서 직접 import하지 않고, 백엔드 책임 범위에 맞게 `server/app/services/curriculum_service.py`로 분리 구현함

### 검증
- 백엔드 컴파일 확인
  - `server/venv/Scripts/python.exe -m compileall -q server/app` 통과
- 백엔드 서비스 import 확인
  - `from app.services.curriculum_service import generate_week_plan` OK
- 실제 API 호출 확인
  - Python `requests`로 `POST /api/curricula/generate` 호출
  - 한글 입력/응답 정상
  - `cur_week_plan`이 `week`, `theme`, `tasks` 구조로 정상 반환됨
- 프론트 빌드 확인
  - `npm run build` 통과
- Git 점검
  - `git fetch origin` 후 `dev`와 `origin/dev` 동일
  - 충돌 마커 없음
  - `git diff --check` 치명 오류 없음
  - Windows 줄바꿈 경고만 확인됨

### 주의
- `POST /api/curricula/generate`는 DB에 저장하지 않음. 저장은 미리보기 모달의 `생성` 버튼에서 `POST /api/curricula`로 수행
- PowerShell 5에서 한글 JSON 요청/응답이 깨질 수 있어 API 테스트는 Swagger 또는 Python `requests` 권장
- 현재 생성 결과 검증은 기본 JSON 파싱 중심. 추후 `cur_duration_weeks`와 실제 반환 주차 개수 일치 검증을 추가하면 더 안전함
- `required_content`는 현재 저장 시 `cur_ai_prompt_input`에 보존

---

## 2026-05-11 - Claude (아티클 썸네일 표시 + DB 스키마 모델 동기화)

### 배경
- 요약문 작성 파이프라인에서 DB 스키마 3건 변경됨 (팀원 작업)
  - `articles.article_author_email` JSON 컬럼 추가
  - `ai_outputs.user_id` FK NULL 허용으로 변경 (요약문 추가 시 user_id 없이 INSERT 가능하도록)
  - `ai_outputs.summary_text` Text → JSON 타입 변경 (요약문이 JSON 구조)
- `ai/thumbnails/*.png` 30개 파일도 함께 들어옴 (이름 규칙: `{title}_{author}_{category}.png`)
- DB 변경에 모델 코드가 동기화되지 않은 상태였고, 썸네일을 article 카드에 노출하는 인프라도 없었음

### DB 추가 변경 (이번 작업에서 결정)
- `articles.article_thumbnail_filename VARCHAR(512) NULL` 컬럼 추가
  - 처음에는 `{title}_{author}_{category}.png` 조합으로 프론트가 직접 파일명 만들 계획이었으나, DB 카테고리(짧음, 예: `AI`, `경영`)와 PNG 카테고리(길게 LLM 생성, 예: `인재 관리 및 조직 개발`)의 분류 체계 자체가 달라 매칭률 0
  - 매칭 키를 데이터로 명시하기 위해 PNG 파일명을 article 행이 직접 보유하는 구조로 변경

### 모델 코드 동기화
- `server/app/models/article.py`
  - `article_author_email JSON` 추가
  - `article_thumbnail_filename VARCHAR(512)` 추가
- `server/app/models/ai_output.py`
  - `user_id` `nullable=True`, `Mapped[int | None]`로 변경
  - `summary_text` Text → JSON, `Mapped[dict | list | None]`로 변경
  - `user` 관계도 `Mapped["User | None"]`

### 썸네일 인프라
- `server/app/services/thumbnail_service.py` 신규
  - `THUMBNAIL_DIR = Path(__file__).resolve().parents[3] / "ai" / "thumbnails"` (절대경로 안전)
  - `get_thumbnail_url(article)` — `article.article_thumbnail_filename` 값을 디스크에서 검사 후 URL 인코딩하여 반환
- `server/app/main.py`
  - `StaticFiles`로 `/api/thumbnails` mount (디렉토리 존재 시에만)
- `server/app/schemas/article.py`
  - `ArticleResponse.article_thumbnail_url: str | None` 추가 (derived field)
- `server/app/routers/article.py`
  - `_to_response(article)` helper 추가, list/get/popular/create 4개 라우터에서 일관 사용
- `client/src/components/Dashboard.jsx`
  - 카드 `cardTop`에 `{item.article_thumbnail_url && <img ... />}` 조건부 렌더링
  - CSS는 기존 `.cardTop img { width:100%; height:100% }` 그대로 활용

### 매핑 작업
- PNG 30개와 DB 38개 article을 자동 매칭 분석 (제목 유사도 + author 매칭)
- 1차: AUTO 3건 + AMBIGUOUS 중 title 100% 일치 1건 = 4건 UPDATE
- 2차: 실제 화면 검증 후 확실도가 높은 12건 추가 UPDATE, 총 16건 유효 매핑
- 3차: 중복 테스트 산출물로 보이는 후보 중 article당 대표 썸네일 1개만 선택하는 정책으로 4건 추가/정정, 총 **20건** 유효 매핑
- `2089`는 DB에 ASCII 쌍따옴표(`"`)로 들어가 파일 존재 체크가 실패했으므로 실제 디스크 파일명의 곡선 따옴표(`“”`) 기준으로 수정
- `2080`은 후보 파일명 2개가 붙은 잘못된 문자열이 들어가 있었으므로 대표 1개(`고객 신뢰를 위한 투명성 전략...`)로 정정
- 현재 `article_thumbnail_filename` 채워진 20건 모두 디스크 파일 존재 + `article_thumbnail_url` 정상 생성 확인
  - `2078` — 에이전트 기반 상거래의 신뢰 구축 전략
  - `2079` — AI와 여행 산업의 혁신적 변화
  - `2080` — 고객 신뢰를 위한 투명성 전략
  - `2081` — AI 에이전트 관리의 혁신적 접근
  - `2082` — AI 음성 시스템의 신뢰성과 충실도 관리
  - `2083` — 유행을 읽는 눈 두쫀쿠 사례로 본 소비자 욕망의 번역
  - `2084` — 데이터 기반 조직으로의 전환
  - `2087` — SMART 업무 설계 모델
  - `2088` — 긍정적 리뷰에 대한 효과적인 응답 전략
  - `2089` — 신입 사원 반존대
  - `2090` — The Art of Misspelling
  - `2091` — Understanding Customer Grief in Brand Relationships
  - `2092` — 전쟁이 상수가 된다면
  - `2094` — 예측 불가능한 전쟁의 시대, 공급망 덮친 리걸 리스크
  - `2095` — 중동발 에너지 위기와 ESG 전략 재편
  - `2096` — 우크라이나 전쟁 이후 글로벌 물류 공급망의 진화 가능성
  - `2097` — 협업의 구조적 전환을 통한 효과적인 프로젝트 관리
  - `2098` — 절망의 온도 맞추기 대중문화 흥행의 비밀
  - `2099` — AI 시대 게으른 사람들의 천국

### 발견 (요약문 JSON 구조)
- 현재 `ai_outputs`에 요약문 1건(output_id=1212) 존재
- top-level keys: `metadata`, `card_news`(4장), `ojt_conclusion`, `theme_analysis`
- raw `text(...)` SQL로 가져오면 string으로 오지만 ORM(`db.query(AiOutput)`)으로 가져오면 dict (PyMySQL/SQLAlchemy 정상 동작, 이중 인코딩 아님)

### 검증
- `python -m compileall -q app` 통과
- `npm run build` 통과 (98 modules, 844ms)
- helper 단위 테스트: 컬럼 채워짐 → URL 인코딩 정상, 컬럼 None → None, 디스크 파일 없음 → None
- 화면 검증: 매핑된 카드에 PNG 정상 표시 확인
- 백엔드 응답 검증: `_to_response(article)` 기준 `article_thumbnail_url` 생성 row 20건 확인

### 보류
- 남은 미매핑 PNG 10건: 같은 글의 reframe인지, DB INSERT 누락인지 수동 검토 필요
  - `고객 신뢰 구축...`, `해상 초크 포인트...`, `컨버터블 리더십...`은 대표 썸네일을 이미 다른 후보로 선택했으므로 보류
  - 조직/협업/리더십 계열 PNG는 `2073`, `2068`, `2093` 후보가 섞여 있어 원문 확인 필요
  - 성과관리/AI 학습 계열 PNG는 대응 article이 불명확해 보류
- 나머지 articles 18건은 아직 `article_thumbnail_filename` NULL
- 요약문 상세 UI 미구현 (JSON 구조 확정됐으니 다음 단계로 진행 가능): `GET /api/articles/{id}/summary` + 카드뉴스 4장 + ojt_conclusion + theme_analysis 렌더링

### 주의
- `articles.article_thumbnail_filename`에 UNIQUE 제약은 안 걸음. 같은 PNG가 두 article에 매핑되지 않도록 애플리케이션이 책임
- DB 컬럼만 채우고 PNG 파일이 디스크에 없으면 `get_thumbnail_url`이 None 반환 (404 안 떨어지고 카드 fallback)
- `/api/thumbnails`는 mount 시점이 startup이라 변경 후 uvicorn 재시작 필요 (`--reload`로는 안 잡힘)
---

## 2026-05-11 - Codex (요약문 상세 표시 + 썸네일/요약문 매핑 정리)

### 작업
- 아티클 상세 요약문 API/UI 연결
  - `GET /api/articles/{article_id}/summary` 추가
  - 같은 article에 summary가 여러 개 있으면 `created_at DESC, output_id DESC` 기준 최신 1건 반환
  - 요약문이 없으면 404 반환
  - `ArticleSummaryResponse` 추가
  - `AiOutputResponse.user_id`를 nullable로, `summary_text`를 `dict | list | None`으로 스키마 정리
- 프론트 상세 화면 요약문 렌더링
  - `ArticleDetailView.jsx`에서 상세 진입 시 summary API 호출
  - `metadata`, `theme_analysis`, `card_news`, `ojt_conclusion` 표시
  - 상세 썸네일 hero 영역과 요약 카드 스타일 추가
- 썸네일/요약문 매핑 DB 정리
  - `2073`의 `article_thumbnail_filename`에 PNG 3개가 이어붙은 오염값 확인 후 `NULL` 처리
  - `2085`의 잘못된 썸네일(`조직 AI팀...`) `NULL` 처리
  - `2086`의 잘못된 썸네일/summary(`지정학적 리스크...`) 연결 해제
  - `2085`에 잘못 연결된 summary 2건(`조직 AI팀...`) 연결 해제
  - `2089`는 올바른 summary `1214`만 남기고 잘못 최신으로 잡히던 `1237` 연결 해제
  - `2097`은 잘못 연결된 성과관리 summary 2건과 협업 썸네일 연결 해제

### 검증
- `server/venv/Scripts/python.exe -m compileall -q server/app` 통과
- `client` `npm run build` 통과
- ORM 기준 `summary_text`가 `dict`로 로드됨 확인
- `thumbnail_service.get_thumbnail_url()` 기준 유효 썸네일 20건 확인 후 오매핑 정리 진행
- 정리 후 주요 확인
  - `2086` summary/thumbnail 없음
  - `2085` summary/thumbnail 없음
  - `2089` summary 1건 + thumbnail 정상
  - `2097` summary/thumbnail 없음

### 현재 데이터 기준
- articles 총 38건
- summary가 연결된 article 21건
- 유효 thumbnail article 20건
- 남은 중복 summary article
  - `2073`: 3건 (`컨버터블 리더십`, `협업의 구조적 전환`, `휘발되는 소통`)
  - `2080`: 2건 (`고객 신뢰 구축`, `고객 신뢰를 위한 투명성 전략`)
  - `2096`: 2건 (`우크라이나 전쟁 이후 글로벌 물류`, `해상 초크 포인트`)
- `article_chunk_count`는 현재 전체 38건이 0이라 RAG 원문 인덱싱은 아직 별도 작업 필요

### 주의
- DB 데이터 정리는 Git 커밋에 포함되지 않음. 공유 DB 기준으로 직접 정리된 상태
- 중복 summary는 삭제하지 않고 보존. 상세 화면은 최신 1개만 표시하는 정책
- 명확히 다른 글로 판단된 summary는 `article_id = NULL`로 분리해 추후 올바른 article이 생기면 재연결 가능
- 썸네일/summary 추가 매핑은 자동 처리하지 말고 화면/원문 기준으로 확인 후 진행

---

## 2026-05-11 - Claude (회원가입 일괄 등록 — 매니저+학습자 한 번에)

### 배경
- 기존 회원가입 정책: `j`만 자유 가입, `m`/`a`는 DB 직접 변경
- 신규 정책 결정 (MVP/발표용): 비로그인 Signup 화면에서 **회사명 + 매니저 1명 + 학습자 N명을 한 번에 등록**
- 기존 [Signup.jsx](client/src/components/Signup.jsx)는 깡통 UI (state 미연결, `handleJobChange` 미정의 함수 호출 등) → 통째로 재작성

### DB 변경 (팀원이 ALTER)
- `users.user_company VARCHAR(100) NOT NULL` 추가 (`user_name` 뒤)
- DEFAULT 없는 NOT NULL이라 MySQL이 기존 31개 행을 `''`로 자동 채움 (데이터 손실 0)

### 백엔드
- `server/app/models/user.py`
  - `User.user_company: Mapped[str]` 추가 (`String(100), nullable=False, default=""`)
- `server/app/schemas/user.py`
  - `UserCreate.company: str | None = None` 추가 (단일 가입 호환)
  - `UserResponse.user_company` 노출
  - 신규 `BulkSignupEmployee`, `BulkSignupRequest`, `BulkSignupResponse`
- `server/app/routers/user.py`
  - 신규 `POST /api/users/signup/bulk`
    - 사전 검증: request 내 이메일 중복, DB 기존 이메일 충돌
    - 첫 번째 직원 → `user_role="m"`, 나머지 → `"j"` 강제
    - `body.company` 전원에게 동일 부여
    - 트랜잭션: `db.commit()` 실패 시 전체 롤백 후 friendly 메시지로 변환
  - 기존 `POST /api/users/signup`은 호환성 위해 유지 (UI 미사용)
    - `user_company` 컬럼 채우도록 `body.company or ""` 처리

### 프론트
- `client/src/components/Signup.jsx` 깡통 → 동작 구현
  - state 4개 (`company`, `employees`, `error`, `loading`) + 카드 add/remove/updateField helper
  - 클라이언트 검증: 회사명/이름/이메일/비번 빈 값, 직원 간 이메일 중복
  - `POST /users/signup/bulk` 호출, 성공 시 `onComplete()`로 Intro 복귀
  - 에러 메시지는 백엔드 `detail` 그대로 표시
  - 직무는 자유 텍스트 입력 (기존 select 옵션 1개 하드코딩이라 사실상 기능 부재)
  - 첫 카드 라벨 "EMPLOYEE #01 · 매니저", 이후 "· 학습자"
  - `handleJobChange`/`handleRoleChange` 등 미정의 함수 호출 제거

### 검증
- `python -m compileall -q app` 통과
- `npm run build` 통과 (100 modules, 963ms)
- `app.routers.user`에 `/api/users/signup/bulk` POST 라우트 등록 확인

### 알아둘 점 (운영 시 주의)
- **인증 없음**: 누구나 매니저 가입 가능. MVP/시연용 정책이며 보안 강화는 V2 (admin 사전 등록 / 초대 코드 / 이메일 도메인 화이트리스트 등)
- **회사명 중복/오타 검증 없음**: "삼성전자" vs "삼정전자"가 별개 회사로 처리됨. 운영 시 admin이 데이터 정리
- **두 번째 가입 흐름 미구현**: 같은 매니저가 직원 5명 추가 등록하고 싶으면? V1에선 다시 Signup 화면 진입 → 같은 매니저 이메일이라 중복으로 거절됨. V2에서 매니저 로그인 후 Dashboard 내부 메뉴로 추가 흐름 필요
- **직무 자유 텍스트 입력**: 기존 select 옵션 1개("marketing_sales") 하드코딩이라 사실상 의미 없어서 자유 입력으로 교체. 향후 직무 표준 분류 필요해지면 select로 회귀
- **기존 31개 user 행의 `user_company`는 모두 `''`**: 운영 시작 후 admin이 정리할 항목
- **부분 실패 정책**: all-or-nothing 트랜잭션. 하나 실패 시 전체 롤백 → 사용자가 입력값 수정 후 재시도
- **기존 `POST /api/users/signup`은 UI 미사용**이지만 호환성 위해 살아 있음. 외부에서 호출하면 단일 `j` 가입 가능 (학습자 셀프 가입 백업 경로). 정책 강제하려면 다음 작업에서 제거 또는 인증 추가

### CLAUDE.md 동기 갱신
- 권한 정책 섹션의 운영 규칙 항목 갱신
  - 기존: "POST /api/users/signup은 j만 자유 가입"
  - 변경: "POST /api/users/signup/bulk으로 일괄 등록, 단일 `/signup`은 호환성 백업"
## 2026-05-12 - Codex (커리큘럼 추천 아티클 매핑 + 삭제 테이블 정리)

### 커리큘럼 생성 고도화
- `server/app/services/curriculum_service.py`
  - `ai/curr.py` 방식과 동일하게 사용자 입력(과정명/직무/산업/학습목표/필수내용)에서 키워드를 추출
  - `ai/summary/*.json`을 순회하며 단순 `in` 매칭으로 관련 사내 아티클 요약문 수집
  - 수집된 요약문을 LLM 프롬프트의 `[참고 자료]` 컨텍스트로 주입
  - LLM이 각 주차별로 `recommended_articles`를 생성하도록 프롬프트 확장
  - 응답 후처리에서 실제 매칭된 파일명만 남기도록 필터링해 filename 환각 방지
- `server/app/schemas/curriculum.py`
  - `RecommendedArticle`, `WeekPlanItem` 스키마 추가
  - 생성 응답의 `cur_week_plan`을 단순 dict 리스트에서 구조화된 주차 계획 리스트로 변경
- `client/src/components/CurriculumView.jsx`
  - 커리큘럼 미리보기/확정 화면에 학습목표, 성공기준, 추천 아티클 수, 예상 시간 표시 추가

### 모델 설정
- 서버 설정 기본값과 예시 환경변수는 `AI_MODEL=gpt-5.4-mini` 기준으로 확인
- 로컬 실행용 `server/.env`, `server/.env.test`에도 `AI_MODEL=gpt-5.4-mini` 적용
  - 해당 env 파일은 git 추적 대상이 아니므로 커밋에는 포함되지 않음

### 삭제된 `output_article_refs` 테이블 정리
- DB에서 `output_article_refs` 테이블 삭제 후 백엔드 ORM 참조 제거
- 삭제/수정 파일
  - `server/app/models/output_article_ref.py` 삭제
  - `server/app/models/ai_summaries.py`의 `output_refs` relationship 제거
  - `server/app/models/article.py`의 `output_refs` relationship 제거
  - `server/app/models/__init__.py`에서 `OutputArticleRef` import/export 제거

### 삭제된 `task_submissions.task_framework_type` 컬럼 정리
- 프레임워크 기능을 사용하지 않는 방향으로 정리되면서 DB 컬럼 삭제에 맞춰 백엔드 참조 제거
- 수정 파일
  - `server/app/models/task_submission.py`에서 `task_framework_type` 컬럼 제거
  - `server/app/schemas/task_submission.py`에서 생성/응답 스키마 필드 제거
  - `server/app/routers/task_submission.py`에서 제출 생성 시 `task_framework_type` 할당 제거

### 검증
- `retrieve_articles_context()` 단독 검증
  - `ai/summary` 존재 확인
  - 마케팅 온보딩 샘플 기준 5개 요약 파일 매칭
- 실제 `/api/curricula/generate` 호출 검증
  - 4주 커리큘럼 생성 성공
  - `theme`, `learning_objective`, `tasks`, `recommended_articles`, `success_criteria`, `estimated_hours` 포함 확인
  - 추천 아티클 filename이 실제 매칭 파일 안에서만 유지되는 것 확인
- 프론트엔드 빌드 통과
  - `npm run build`
- 백엔드 컴파일 통과
  - `python -m compileall -q app`
- `output_article_refs`, `OutputArticleRef`, `output_refs` 서버 코드 검색 결과 없음
- `task_framework_type` 서버/클라이언트 코드 검색 결과 없음

### 한계 / 다음 개선 후보
- 현재 아티클 검색은 단순 키워드 `in` 매칭이라 의미 유사 검색은 불가
- 광범위 키워드가 잡히면 같은 아티클이 여러 주차에 반복 추천될 수 있음
- V2에서는 아티클 본문/요약문을 ChromaDB에 인덱싱한 임베딩 RAG로 교체하는 것이 적합

---

## 2026-05-13 - Codex (DB 삭제 컬럼 추가 정리)

### 삭제된 `users` 직무/산업/연차 컬럼 정리
- DB에서 아래 컬럼이 삭제된 상태에 맞춰 백엔드와 가입 화면 참조 제거
  - `users.user_job_title`
  - `users.user_industry`
  - `users.user_work_years`
- 수정 파일
  - `server/app/models/user.py`에서 컬럼 제거
  - `server/app/schemas/user.py`에서 생성/응답 스키마 필드 제거
  - `server/app/routers/user.py`에서 회원 생성 시 해당 필드 할당 제거
  - `client/src/components/Signup.jsx`에서 직무 입력값과 `job_title` payload 제거

### 삭제된 `ai_summaries.model_used` 컬럼 정리
- `server/app/models/ai_summaries.py`에서 `model_used` 컬럼 제거
- `server/app/schemas/ai_output.py`에서 생성/응답 스키마의 `model_used` 필드 제거

### 문서 동기화
- `CLAUDE.md`, `README.md`, `docs/devlog.md`의 현재 핵심 테이블 목록에서 삭제된 `output_article_refs` 제거
- 현재 ORM 기준 AI 요약 테이블명을 `ai_summaries`로 표기

### 검증
- 현재 코드/현재 문서 기준 삭제 컬럼 잔여 참조 없음
  - `user_job_title`, `user_industry`, `user_work_years`, `job_title`, `work_years`, `model_used`, `output_article_refs`, `task_framework_type`
- 백엔드 컴파일 통과
  - `python -m compileall -q app`
- 프론트엔드 빌드 통과
  - `npm run build`

---

## 2026-05-19 - Claude (회원가입 폼 단일화 + CSS 분리 + 권한 정책 `c` 추가)

### 배경
- 기존 회원가입 흐름: 비로그인 페이지에서 회사 + 매니저 1명 + 학습자 N명 일괄 등록(`POST /signup/bulk`)
- 새 정책: DBR 일반 구독자(`c`) / OJT 결제로 승급한 매니저(`m`) / 매니저 초대로 가입한 학습자(`j`) / 관리자(`a`) 4단계 체계로 전환
- 가입 페이지는 단일 폼(이메일/비번/이름/회사(선택)/초대코드(선택))으로 일원화

### DB 변경 (사용자 직접 ALTER)
- `users.user_role` ENUM에 `'c'` 추가, `NOT NULL DEFAULT 'c'`
- `users.user_invite_code VARCHAR(14) NULL UNIQUE` 컬럼 추가 (매니저 회사 초대 코드용)

### 프론트 변경
- `client/src/components/Signup.jsx` 단일 가입 폼으로 재작성
  - 기존 `employees[]` 배열 + 카드 add/remove 흐름 전체 제거
  - 필드: 이름 / 이메일 / 비밀번호 / 비밀번호 확인 / 회사(선택, "회사 없음" 체크박스) / 초대 코드(선택)
  - `<form onSubmit>` 으로 감싸 Enter 키 제출 지원
  - 모든 inline style 제거 (CLAUDE.md 컨벤션 준수)
  - `autoComplete` 속성 추가 (`name`, `email`, `new-password`, `organization`)
  - 검증: 이름/이메일 빈 값, 이메일 형식, 비번 8자 이상, 비번 일치
  - `loading` 중 모든 입력 disabled
  - submit은 stub — `console.log` + alert로 동작 확인만, 백엔드 호출 없음
    - payload 구조는 향후 백엔드와 맞출 형태로 준비: `{ name, email, password, company, invite_code }`

### 스타일 정리
- `client/src/styles/Signup.css` 신규 생성
  - Signup 전용 스타일 분리 (nav-signup, signup-wrapper, signup-form, signup-section, signup-field, signup-checkbox, signup-error, signup-submit-bar 등)
  - 죽은 코드(progress bar, employee-card, card-grid, add-btn)는 옮기지 않고 폐기
- `client/src/styles/theme.css` 정리
  - `SCREEN 2 : SIGNUP` 블록 (구 388~675줄) 통째로 제거 → 382줄로 축소

### 문서 변경
- `CLAUDE.md` 권한 정책 섹션 업데이트
  - 역할 표: `c`(일반) 추가 → 4개 역할 체계
  - 운영 규칙 재작성: 단일 `/signup` 가입 흐름, 매니저 승급 + 초대 코드 발급 정책, 챗봇 정책 명시
  - 회사 초대 코드 구현 결정 사항 명시
    - 저장 위치: `users.user_invite_code` 컬럼 (A안)
    - 코드 형식: Crockford Base32 12자 + 하이픈 3-3-3 그룹 (총 14자), 예: `9F3K-PXQ7-M2NJ`
    - 생성/검증은 백엔드 전용, `secrets` 모듈 사용
  - 폐기 정책 섹션 추가: `/signup/bulk` UI 미사용

### 검증
- `npm run build` 통과 (571 modules, 4.70s)
- 백엔드 코드 변경 없음 (이번 사이클은 프론트 + 문서만)

### 다음 사이클 예정 작업
1. CSV(15,257개 회사 데이터) 점검 → 정제 → `client/public/companies.json` 생성 → Signup 자동완성 연결
2. 백엔드 회원가입 라우터 정비
   - `/signup` 단일 엔드포인트에 `invite_code` 파라미터 추가
   - 초대 코드 검증 로직 (코드 → 매니저 → 회사 상속)
   - `invite_code_service.py` 신설 (생성/검증 유틸)
3. 회사 초대 코드 발급 라우터 (매니저 승급 시뮬레이션 + 재발급)
4. 라우터 권한 매트릭스 점검 — 현재 라우터들은 `c` 역할을 모르므로 일반회원 차단 로직 누락 가능성

### 주의 / 보류
- 회사 dropdown 자동완성은 V2 (현재 자유 텍스트 input 유지)
- `POST /api/users/signup/bulk` 엔드포인트는 백엔드에 남아 있으나 UI에서 호출 안 함 (제거 또는 admin 격리는 다음 정리 사이클)
- `user_role` `c` 추가에 따른 기존 라우터 권한 체크 영향 점검 미완료
- 매니저 등업/결제 시뮬레이션 흐름(admin이 DB 직접 변경) 별도 시나리오 정리 필요
- 회사 초대 코드 재발급 1회 제한 추적용 `user_invite_code_reissued_at` 컬럼은 아직 DB에 추가 안 됨 (재발급 기능 구현 사이클에서 같이 ALTER)

---

## 2026-05-19 - Claude (tiptap 의존성 누락 보강)

### 배경
- `ce8fea3` 커밋(`커리큘럼 페이지에서 과제제출(학습자)버튼 일단 분리...`)에서 `@tiptap/*` import가 도입됐으나 `client/package.json`에는 추가되지 않음
- 결과적으로 다른 팀원이 풀 받은 후 `npm install`만으로는 빌드 실패하는 상태 (dev 브랜치 빌드 깨짐)
- 로컬에는 본인이 별도 `npm install`로 설치돼 있어 빌드 가능했지만 origin에 반영되지 않음

### 변경
- `client/package.json` / `client/package-lock.json` 동기화
- 로컬에 실제 설치된 버전(`^3.23.4`) 기준으로 dependency 추가
  - `@tiptap/core`, `@tiptap/react`, `@tiptap/pm`, `@tiptap/starter-kit`
  - `@tiptap/extension-color`, `extension-highlight`, `extension-image`, `extension-link`
  - `@tiptap/extension-table`, `extension-table-cell`, `extension-table-header`, `extension-table-row`
  - `@tiptap/extension-text-align`, `extension-text-style`, `extension-underline`

### 주의
- jodit-react(^5.3.21)는 일단 그대로 둠 — 완전 교체 작업 확인 후 정리 필요
- 사용처 4개 파일 (`CurriculumView.jsx`, `LearnerCurriculumView.jsx`, `sanitize.js`, `Curriculum.css`) 코드는 이미 origin/dev에 반영되어 있으므로 이번 커밋은 의존성 동기화만

---

## 2026-05-19 - Claude (회사 자동완성: CSV 점검 + JSON 변환 + Signup dropdown 연결)

### 배경
- 회원가입 폼에서 회사명 입력 시 "삼성/samsung" 등의 표기 불일치 방지를 위해 자동완성 도입
- 외부 입수 CSV(15,256개 기업, 기업명/리뷰개수/산업군/2차 산업군) 활용
- 발표 일정 고려해 정적 JSON 번들 방식(A안) 채택. DB 변경 없음.

### CSV 점검 결과
- 인코딩: UTF-8 with BOM
- 행수: 15,256 (헤더 제외)
- 컬럼: `기업명`, `리뷰개수`, `산업군`, `2차 산업군`
- 길이: 최대 39자, 평균 8.4자 (`user_company VARCHAR(100)` 충분)
- 중복(이름 완전 일치): 50건 (0.3%, 산업군 다른 동음이의 회사 포함)
- `(주)` 접두 7,107건 / 접미 6,079건 / `주식회사` 또는 `(주)` 포함 13,244건 (전체 87%)
- 공백 이상 / 빈 값: 0건
- 특수문자 이상: 2건 (`​포루스기획`, `한·아프리카재단`)

### 신규 파일
- `scripts/convert_companies.py` — CSV → JSON 변환 스크립트
  - 정규화: `(주)` 접두/접미, `주식회사` 접두/접미, ZWSP(`​`), 공백 제거 + 소문자 → `search` 필드
  - 중복 처리: `(name, industry)` 조합 기준 첫 번째만 유지
  - 정렬: `reviews` 내림차순 (인기 회사 상위)
- `client/public/companies.json` — 변환 결과
  - 15,223 entries (중복 33건 제거)
  - 파일 크기 약 1,985KB (gzip 후 ~400KB 추정)
  - 구조: `{ name, search, industry, sub, reviews }`

### 프론트 변경
- `client/src/components/Signup.jsx`
  - 마운트 시 `/companies.json` fetch (1회)
  - 회사 input focus + 매칭 결과 있을 때만 dropdown 표시
  - JS 정규화 함수 — Python 변환 스크립트와 동일 로직
  - `startsWith` 매칭으로 최대 20개 표시
  - 옵션 선택 시 원본 회사명(예: `(주)하나투어`)을 input에 채움
  - 매칭 안 되어도 자유 텍스트로 그대로 입력 가능
  - fetch 실패 시 silent fallback (자동완성만 비활성, 폼 동작은 유지)
- `client/src/styles/Signup.css`
  - `.signup-company-field` (relative wrapper)
  - `.signup-company-dropdown` (absolute, max-height 240px, scroll, shadow)
  - `.signup-company-option` + hover, 회사명 + 산업군 메타 표시

### 운영 관점
- `data/companies_raw.csv` 원본은 gitignored (`data/`) — 사용자 로컬에만 보관
- `data/_check.py` 1회성 점검 스크립트도 gitignored
- `client/public/companies.json`은 git 추적 → 팀원이 풀 받으면 자동 적용 (별도 명령 불필요)
- CSV 갱신 시: 원본 가진 사람이 `python scripts/convert_companies.py` 1회 실행 → 새 JSON을 커밋

### 검증
- `python scripts/convert_companies.py` 실행 정상 (15,256 → 15,223, dup 33 skip)
- `npm run build` 통과 (571 modules, 4.52s)
- 입력 동작 시뮬레이션 (코드 리뷰 차원):
  - "삼" → 삼성전자(주) 등 상위
  - "(주)하" / "하나" 모두 (주)하나투어 매칭 (정규화)
  - 쿠팡 → 쿠팡(주) 매칭

### 보류 / 다음 사이클
- 자동완성 UI 키보드 ↑↓ 네비게이션, 강조 표시는 V2
- 백엔드 가입 라우터 정비(`/signup`에 `invite_code` 파라미터 처리) — 다음 사이클
- 회사 초대 코드 생성/검증 백엔드 유틸 (`secrets` + Crockford Base32) — 다음 사이클
- 라우터 권한 매트릭스 점검 (`c` 역할 영향) — 다음 사이클

---

## 2026-05-19 - Claude (백엔드 가입 라우터 정비 + 초대 코드 유틸 + 라우터 권한 매트릭스)

### 배경
- 회원가입 정상화 후속: 백엔드 `/signup` 단일 라우터를 새 정책(c/j/m/a 4단계)에 맞게 재작성
- 초대 코드 생성/정규화/검증 유틸 신설
- 사전 점검에서 `c` 역할 추가로 권한 정책 위반 가능성 있는 라우터 6개 발견 → 같이 차단

### 라우터 권한 점검 결과 (사이클 A)
- **그룹 1 (c 허용, OK)**: article 전체 GET, author 전체 GET + POST `/email` (저자 이메일링 — 일반회원 핵심 기능)
- **그룹 2 (c 차단 필요)**:
  - `rag.POST /query` — 일반회원 RAG 사용 차단
  - `curriculum.GET ""`, `GET /{id}`, `PATCH /{id}` — `_scope_curriculum_query`에 c 명시 차단 추가
  - `task_submission.GET /my` — j만 허용으로 명시 차단
- **그룹 3 (점검 부산물 — 인증 자체 누락)**:
  - `curriculum.POST /download/txt`, `POST /download/pdf` — **인증 의존성 누락 발견**. m/a 권한 추가
- **그룹 4 (이미 명시 차단됨, OK)**: chatbot 전부, curriculum POST/generate/stats, task_submission POST/PATCH feedback/by-curriculum, user 통계/관리 라우터

### 정책 결정 (사용자 확인 완료)
- `user.GET /{id}`: m/a만 허용 (j도 차단). 본인 조회는 `/me` 사용
- curriculum `/download/*`: 인증 + m/a 권한 추가

### 신규 / 변경
- `server/app/services/invite_code_service.py` 신설
  - `generate_invite_code()` — Crockford Base32 12자 + 하이픈 3-3-3 그룹 (14자)
  - `normalize_code(value)` — 대소문자/하이픈/공백/ZWSP 흡수해 표준 14자 형식 반환 (잘못된 형식이면 빈 문자열)
  - `is_valid_format(value)` — 표준 14자 형식 검사
  - `generate_unique_invite_code(db, max_attempts=8)` — DB UNIQUE 충돌 시 재시도
  - `find_manager_by_code(db, code)` — 코드로 매니저(`m`, 활성) 행 매칭
  - 알파벳: `0-9` + `A-Z` 중 `I, L, O, U` 제외 (32자)
- `server/app/models/user.py`
  - `user_role` Enum에 `c` 추가 (`c, m, j, a`), `default='c'` + `server_default='c'`
  - `user_invite_code: Mapped[str | None] = mapped_column(String(14), nullable=True, unique=True)` 추가
- `server/app/schemas/user.py`
  - `UserRole` Literal에 `c` 추가
  - `UserCreate.invite_code: str | None = None` 필드 추가
- `server/app/routers/user.py`
  - `POST /signup` 재작성
    - `invite_code` 있음 → `find_manager_by_code` 검증 → 매니저 회사 상속 + `j`
    - 없음 → 사용자 입력 회사 그대로 + `c`
    - 이메일은 `.strip().lower()`로 정규화 후 저장 (대소문자 비대칭 해소)
    - 이름 `.strip()`
  - `GET /{user_id}` m/a 전용 (정책 결정에 따라 j 차단)
- `server/app/routers/rag.py`
  - `POST /query` — `user_role`이 `j/m/a`가 아니면 404 (c 차단)
- `server/app/routers/curriculum.py`
  - `_scope_curriculum_query`에 c/기타 역할 빈 쿼리(`filter(False)`) 분기 추가
  - `POST /download/txt`, `POST /download/pdf` — 인증 의존성 추가 + m/a 권한 체크
- `server/app/routers/task_submission.py`
  - `GET /my` — `j`만 허용 (c/m/a 모두 404)
- `client/src/components/Signup.jsx`
  - stub → 실제 `POST /api/users/signup` 호출로 교체
  - 성공 시 `onComplete()`, 실패 시 백엔드 `detail` 메시지 표시

### 검증
- `python -m compileall -q app` 통과
- `npm run build` 통과 (571 modules, 4.53s)
- `invite_code_service` 단위 동작 (CLI):
  - 생성 5건 모두 14자 + `is_valid_format=True`
  - 입력 변형(소문자/공백/하이픈 변형, ZWSP 포함, 길이 오류, I 포함) 정규화 결과 기대대로

### 보류 / 다음 사이클 후보
- 매니저 승급 + 초대 코드 발급 라우터 (예: `POST /api/users/me/invite-code/issue` 또는 admin 페이지에서 시뮬레이션)
- `user_invite_code_reissued_at` 컬럼 추가 + 1회 재발급 로직
- `POST /api/users/signup/bulk` 엔드포인트 폐기 (현재 미사용 상태로 잔존)
- `task_submission.GET /{id}` 등 `_can_access_submission`에서 c가 False라 안전하지만 명시 차단 미적용 — 의도 명확화 위해 후속 정리 후보

### 주의
- 기존 `j` 가입 시점에 회사명 빈 문자열로 저장되던 데이터는 그대로. 새 정책으로 가입하는 `j`는 매니저 회사명 상속됨
- `user_invite_code` 컬럼은 DB에 ALTER 완료 상태였고 이번 사이클에서 ORM 모델만 동기화

---

## 2026-05-19 - Claude (사이클 D/E/F: bulk 폐기 + 매니저 코드 발급 + 회사 dropdown UX V2)

### 사이클 D — `/signup/bulk` 엔드포인트 폐기
- 단일 `/signup`(`invite_code` 기반) 정책으로 일원화됐으므로 bulk 흐름 완전 제거
- `server/app/routers/user.py`에서 `signup_bulk` 함수 + import 제거
- `server/app/schemas/user.py`에서 `BulkSignupEmployee`, `BulkSignupRequest`, `BulkSignupResponse` 제거
- `CLAUDE.md` 폐기 정책 섹션 — "엔드포인트 잔존" → "제거됨"으로 수정
- `README.md` 회원가입 소개 — 일괄 등록 표현 제거, 단일 `/signup` 흐름으로 갱신
- 정적/grep 검색에서 `BulkSignup` / `signup_bulk` / `signup/bulk` 잔재 없음 확인

### 사이클 E — 매니저 승급 시 자동 코드 발급 + 본인 조회 + 대시보드 표시
- 백엔드
  - `server/app/schemas/user.py` — `UserResponse`에 `user_invite_code: str | None = None` 노출
  - `server/app/routers/user.py PATCH /{user_id}` — Role 갱신 후 분기:
    - `user_role == 'm'`이고 코드 없으면 → `invite_code_service.generate_unique_invite_code(db)`로 자동 발급
    - `user_role != 'm'`이고 코드 있으면 → `None`으로 회수 (강등 시 회사 외 노출 방지)
  - admin 시뮬레이션 흐름: `PATCH /api/users/{user_id}` body에 `user_role: "m"` → 코드 자동 발급 + 응답에 포함
- 프론트
  - `client/src/components/Dashboard.jsx` — `user_role === 'm' && user_invite_code` 조건으로 상단 안내 박스 표시 (모든 뷰에서 보임)
  - 코드 + "복사" 버튼 (`navigator.clipboard.writeText`)
  - `client/src/styles/Dashboard.css` — `.managerInviteNotice*` 스타일 추가
- 재발급 1회 제한 추적 컬럼(`user_invite_code_reissued_at`) 및 `POST /me/invite-code/reissue` 라우터는 V2로 보류 (사용자 결정 옵션 c)

### 사이클 F — 회사 dropdown UX V2 (키보드 네비)
- `client/src/components/Signup.jsx`
  - state `highlightedIndex` 추가, dropdown DOM 참조 `dropdownRef`
  - 매칭 결과 갱신 시 `highlightedIndex`를 0으로 초기화 (결과 없으면 -1)
  - 강조된 옵션을 `scrollIntoView({block: 'nearest'})`로 스크롤 영역 안에 유지
  - `handleCompanyKeyDown` 핸들러:
    - `ArrowDown` / `ArrowUp` — 순환 이동
    - `Enter` — 강조 항목 선택 (`preventDefault`로 form submit 차단)
    - `Escape` — dropdown 닫기 (입력값 유지)
    - dropdown 닫혀 있을 때 `ArrowDown` — 열기
  - `onMouseEnter`로 마우스 hover와 키보드 강조 통일
  - `aria-autocomplete`, `aria-expanded`, `aria-activedescendant`, `aria-selected` 등 ARIA 속성 추가
- `client/src/styles/Signup.css` — `.signup-company-option.is-highlighted` 추가 (hover와 동일 스타일)

### 검증
- `python -m compileall -q app` 통과
- `npm run build` 통과 (4.95s)
- 동작 시나리오 (사용자 보고 정리됨):
  - 일반 회원 가입(c): 회사 선택 + 자동완성 + 키보드 ↑↓/Enter/Esc 동작
  - 학습자 가입(j): 초대 코드 입력 → 매니저 회사 상속
  - 매니저 승급(admin PATCH): 코드 자동 발급, Dashboard 상단 박스 + 복사 버튼 표시

### 결정 사항 / 미결
- 회사 이름 `(주)` 처리: 현재 **검색만 정규화, 표시/저장은 원본 유지**로 둠. (a) 표시/저장도 정규화 / (c) 그대로 — 사용자 결정 보류
- 사이클 G (이메일 인증): 진행 중단. 정책 결정 필요 (전체 구현 / 시뮬레이션만 / 미구현 중 택1)

### 다음 작업
- 이후 작업은 Codex CLI로 위임 예정 (토큰 절약 목적, [[feedback-codex-collab]] 룰 적용)
- 같은 파일 충돌 주의: `Signup.jsx`, `Dashboard.jsx`, `routers/user.py` 등은 이번 사이클에서 만진 파일이라 Codex가 동시 작업 시 위험

---
## 2026-05-27 - Cloudflare R2 첨부파일 저장소 도입

### 변경
- `server/app/services/attachment_storage.py` 추가
  - R2 설정이 모두 있으면 `put_object` / `get_object` / `delete_object` 사용
  - R2에 객체가 없을 때 기존 로컬 저장소(`server/uploads/task_attachments`) fallback 조회 유지
- `server/app/routers/task_submission.py`
  - 첨부 업로드를 로컬 `write_bytes` 대신 storage service 경유로 변경
  - 첨부 다운로드를 `FileResponse` 대신 `StreamingResponse`로 변경
  - 첨부 삭제를 DB soft delete 후 storage delete best-effort 방식으로 변경
  - 한글 파일명 다운로드를 위해 `Content-Disposition`에 `filename*` 추가
- `server/app/core/config.py`
  - `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`, `R2_ENDPOINT_URL` 설정 추가
- `server/requirements.txt`
  - `boto3` 추가

### 검증
- `boto3` 서버 venv 설치 완료
- R2 env 값 존재 확인 완료
- `config.py`, `attachment_storage.py`, `task_submission.py` syntax compile 통과
- R2 `head_bucket` 실제 연결 테스트는 현재 `R2_ENDPOINT_URL` 값이 Cloudflare Account ID 형식이 아니라 실패
  - endpoint는 `https://<ACCOUNT_ID>.r2.cloudflarestorage.com` 형태 필요

---

## 2026-05-27 - 1순위 고도화: 로그 정리 / 첨부 선검증 / 알림 강조

### 변경
- 루트 `package.json`, `package-lock.json` 삭제 상태는 의도된 정리로 유지
- 서버 디버그 `print()` 정리
  - RAG 검색/쿼리 변환/아티클 검색/AI 생성 실패 로그를 `logging` 기반으로 변경
  - 기본 실행 콘솔에 검색어와 벡터 거리 로그가 무조건 노출되지 않도록 개선
- 첨부파일 프론트 선검증 추가
  - 서버 whitelist와 맞춰 문서/이미지/압축 확장자만 선택 가능하도록 검증
  - 20MB 초과, 빈 파일, 허용되지 않은 확장자는 제출 전에 사용자에게 안내
- 알림 딥링크 시각 강조 추가
  - 과제 제출 알림 클릭으로 열린 제출물 항목에 일시적인 highlight 애니메이션 적용
  - 매니저가 이동 후 어떤 제출물이 자동 선택됐는지 바로 확인 가능

### 검증
- `server\.venv` 경로 오입력 후 재실행: `server\venv` 기준 compile 통과
- `server\venv\Scripts\python.exe -m compileall -q app` 통과
- `server\venv\Scripts\python.exe -c "from app.main import app; print(len(app.routes))"` 통과, route 59개 유지
- `client`에서 `npm run build` 통과

---

## 2026-05-27 - 알림 딥링크 / 운영 설정 정리 / AI 산출물 추적 해제

### 변경
- 알림 클릭 흐름 개선
  - `NotificationBell`에서 `dashboard:{view}:{id}` 링크의 view/id를 함께 파싱하도록 변경
  - 알림의 `notif_ref_type`, `notif_ref_id`를 `Dashboard`로 전달
  - 매니저가 과제 제출 알림을 클릭하면 해당 커리큘럼 선택 후 학습자 제출물 화면으로 이동하고, 대상 제출물을 자동 선택
- 운영 설정 정리
  - `.env.example`에 R2 설정값 6개와 `CORS_ORIGINS` 예시 추가
  - `config.py`에 `cors_origins`, `rag_distance_threshold`, `article_search_distance_threshold` 설정 추가
  - `main.py` CORS 허용 origin을 환경변수 기반으로 변경
  - RAG/아티클 검색 distance threshold를 하드코딩에서 settings 참조로 변경
- 첨부파일 업로드 제한 보강
  - 문서/이미지/압축 파일 중심의 확장자 whitelist 추가
  - `.html`, `.js`, `.svg`, `.jar`, `.vbs`, `.ps1` 등 매니저 환경 노출 위험이 있는 형식 차단
- AI 생성 산출물 git 정리
  - `ai/curriculum_output/`, `ai/summary/`, `ai/thumbnails/`를 `.gitignore`에 추가
  - `git rm --cached -r`로 git 추적만 해제하고 로컬 파일은 유지

### 검증
- `server\venv\Scripts\python.exe -m compileall -q app` 통과
- `server\venv\Scripts\python.exe -c "from app.main import app; print(len(app.routes))"` 통과, route 59개 유지
- `client`에서 `npm run build` 통과

### 주의
- `ai/` 산출물은 로컬에는 남아 있지만, 다음 커밋 이후 git 추적 대상에서 제외됨
- 기존에 워크트리에 떠 있던 `deliverables/*`, 루트 `package*.json` 삭제 상태는 이번 작업에서 건드리지 않음

---
