# 개발 로그

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
