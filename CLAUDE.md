# landfactory

DBR 아티클 기반 RAG 멘토링 플랫폼

## 프로젝트 구조

```
landfactory/
├── client/          # React (Vite) 프론트엔드
├── server/          # FastAPI 백엔드 (담당: 백엔드)
│   ├── app/
│   │   ├── main.py
│   │   ├── core/config.py   # pydantic-settings 환경변수 관리
│   │   ├── routers/         # API 엔드포인트
│   │   ├── models/          # SQLAlchemy ORM 모델
│   │   └── schemas/         # Pydantic 요청/응답 스키마
│   ├── requirements.txt
│   └── .env                 # gitignore 처리 (절대 커밋 금지)
├── ai/              # LangChain RAG 파이프라인
├── data/            # gitignore 처리
├── docs/
└── docker/
```

## 기술 스택

- Frontend: React (Vite), Chart.js, react-wordcloud, html2pdf.js
- Backend: FastAPI (Python 3.11+), SQLAlchemy, PyMySQL
- AI/ML: LangChain, FAISS 또는 ChromaDB, OpenAI API
- DB: MySQL
- Infra: Docker, GitHub

## 팀 구성 및 역할

- PM/Modeling: 기획, AI 모델링
- DB: MySQL 설계 및 관리
- Frontend: React 개발
- Backend: FastAPI 개발 (현재 사용자)

## 개발 환경 설정

```bash
# 백엔드
cd server
python -m venv venv
venv/Scripts/activate      # Windows
pip install -r requirements.txt
cp .env.example .env       # .env 값 채우기
uvicorn app.main:app --reload

# 프론트엔드
cd client
npm install
npm run dev
```

## 환경변수 (.env)

`server/.env.example` 참고. 실제 `.env`는 절대 커밋하지 않는다.

## 현재 상태

- DB는 학원에서 제공 예정 (테스트 DB 계정 사용)
- 벡터 DB: FAISS vs ChromaDB 미확정 (ai/rag/pipeline.py에 Chroma 기본 골격)
- GitHub 레포: 팀장 배포 대기 중

## 코드 컨벤션

- Python: snake_case
- API 라우터는 `app/routers/`에 기능별로 분리
- 환경변수는 `app/core/config.py`의 `settings` 객체를 통해서만 접근

## 브랜치 전략

- `main` — 발표용 최종 코드 (직접 push 금지, dev에서 머지만)
- `dev` — 개발 메인 브랜치
- `feature/기능명` — 각자 작업 브랜치 (예: feature/rag-pipeline)

## 커밋 컨벤션

- `feat:` 새 기능
- `fix:` 버그 수정
- `docs:` 문서 수정
- `refactor:` 리팩토링
- `style:` 코드 포맷팅
- `chore:` 설정, 빌드 관련