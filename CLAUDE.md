# landfactory

DBR 아티클 기반 RAG 멘토링 플랫폼

## 프로젝트 구조

```text
landfactory/
├── client/          # React (Vite) 프론트엔드
├── server/          # FastAPI 백엔드
│   ├── app/
│   │   ├── main.py
│   │   ├── core/config.py   # pydantic-settings 환경변수 관리
│   │   ├── routers/         # API 엔드포인트
│   │   ├── models/          # SQLAlchemy ORM 모델
│   │   ├── schemas/         # Pydantic 요청/응답 스키마
│   │   └── services/        # 비즈니스 로직
│   ├── requirements.txt
│   ├── .env
│   └── chroma_db/           # ChromaDB 로컬 저장소 (gitignore)
├── ai/              # AI 관련 실험/보조 코드
├── data/            # 로컬 데이터 (gitignore)
├── docs/            # 작업 로그 및 문서
└── docker/          # Docker 설정
```

## 기술 스택

- Frontend: React (Vite), Chart.js, react-wordcloud, html2pdf.js
- Backend: FastAPI (Python 3.11+), SQLAlchemy, PyMySQL
- AI/ML: LangChain, ChromaDB, OpenAI API
- DB: MySQL
- Infra: Docker, GitHub

## 현재 운영 기준

- DB는 현재 학원 제공 MySQL 계정을 사용 중 (`server/.env` 참고)
- 벡터 DB는 ChromaDB 사용, `server/chroma_db/`에 저장
- GitHub 레포: `https://github.com/MunDongHyun/Rand_Factory_-`
- 상세 작업 내역과 테스트 결과는 `docs/devlog.md`에 기록

## 개발 환경 설정

```bash
# 백엔드
cd server
python -m venv venv
venv/Scripts/activate      # Windows
pip install -r requirements.txt
cp .env.example .env
uvicorn app.main:app --reload

# 프론트엔드
cd client
npm install
npm run dev
```

## 작업 원칙

- Python 코드는 `snake_case`를 사용
- API 라우터는 `app/routers/`에 기능별로 분리
- 환경변수는 `app/core/config.py`의 `settings` 객체를 통해서만 접근
- 새 API 추가 시 `schemas / routers / services / main.py 등록`까지 함께 확인
- 정적 경로(`/me`, `/categories` 등)는 동적 경로(`/{user_id}`, `/{id}`)보다 먼저 선언
- 가변적인 진행 상황, 테스트 결과, 남은 일은 `docs/devlog.md`에 기록

## 주의사항

- `.env`는 절대 커밋하지 않음
- `venv/`, `server/chroma_db/`, 로컬 테스트 산출물은 커밋하지 않음
- mentor 목록은 `is_verified=True`인 계정만 노출됨
- 포인트 잔액은 `points` 테이블의 최신 레코드 `balance` 기준
- `bcrypt==4.0.1` 유지 (`passlib 1.7.4` 호환성)
- 테스트 시 `user_id` 하드코딩 금지, 가능하면 `/api/users/me`로 현재 사용자 확인

## 브랜치 전략

- `main`: 발표/배포용 최종 코드
- `dev`: 개발 메인 브랜치
- 큰 작업 전에는 현재 브랜치와 변경 파일 상태를 먼저 확인

## 커밋 컨벤션

- `feat:` 기능 추가
- `fix:` 버그 수정
- `docs:` 문서 수정
- `refactor:` 리팩터링
- `style:` 코드 스타일 변경
- `chore:` 설정, 빌드, 기타 유지보수

## 커밋 전 점검 체크리스트

1. `git status`로 변경 파일 확인
2. `.env`, `venv`, `server/chroma_db` 등 비커밋 대상 포함 여부 확인
3. `server/app/main.py` 라우터 import / `include_router(...)` 누락 확인
4. `schemas / services / routers` 세트 누락 확인
5. `cd server && .\venv\Scripts\python.exe -m compileall -q app`
6. 로그인 및 오늘 추가한 핵심 API 최소 1회 테스트
7. `docs/devlog.md` 최신화
8. 비밀값, 로컬 테스트 데이터, 불필요한 산출물 포함 여부 최종 확인
