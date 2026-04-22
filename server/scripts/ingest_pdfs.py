from __future__ import annotations

import argparse
import json
import sys
import time
from dataclasses import dataclass
from datetime import date
from pathlib import Path
from typing import Any
from urllib import error, parse, request

import fitz


DEFAULT_RAG_QUESTIONS = [
    "신입사원이 B2B 마케팅을 시작할 때 알아야 할 핵심 전략은?",
    "OKR을 처음 도입하는 팀에서 주의할 점은?",
    "고객 이탈을 줄이기 위한 프레임워크를 추천해줘",
]
MIN_TEXT_LENGTH = 200


@dataclass
class Counters:
    total: int = 0
    success: int = 0
    skipped: int = 0
    failed: int = 0


def repo_root() -> Path:
    return Path(__file__).resolve().parents[2]


def resolve_pdf_dir(raw_dir: str) -> Path:
    candidate = Path(raw_dir)
    if candidate.is_absolute():
        return candidate

    cwd_candidate = Path.cwd() / candidate
    if cwd_candidate.exists():
        return cwd_candidate.resolve()

    return (repo_root() / raw_dir).resolve()


def ensure_pdf_dir(raw_dir: str) -> Path:
    pdf_dir = resolve_pdf_dir(raw_dir)
    pdf_dir.mkdir(parents=True, exist_ok=True)
    return pdf_dir


def api_request(
    method: str,
    url: str,
    payload: dict[str, Any] | None = None,
    token: str | None = None,
) -> dict[str, Any]:
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"

    body = None
    if payload is not None:
        body = json.dumps(payload).encode("utf-8")

    req = request.Request(url, data=body, headers=headers, method=method.upper())
    try:
        with request.urlopen(req, timeout=120) as resp:
            data = resp.read().decode("utf-8")
            return json.loads(data) if data else {}
    except error.HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"HTTP {exc.code}: {detail}") from exc
    except error.URLError as exc:
        raise RuntimeError(f"API 연결 실패: {exc.reason}") from exc


def login(base_url: str, email: str, password: str) -> str:
    response = api_request(
        "POST",
        f"{base_url}/api/users/login",
        {"email": email, "password": password},
    )
    token = response.get("access_token")
    if not token:
        raise RuntimeError("로그인 응답에서 access_token을 받지 못했습니다")
    return token


def list_existing_titles(base_url: str, token: str, title: str) -> set[str]:
    query = parse.urlencode({"keyword": title, "page": 1, "limit": 100})
    response = api_request(
        "GET",
        f"{base_url}/api/articles?{query}",
        token=token,
    )
    articles = response.get("articles", [])
    return {article.get("title", "") for article in articles}


def extract_text_from_pdf(pdf_path: Path) -> str:
    texts: list[str] = []
    with fitz.open(pdf_path) as doc:
        for page in doc:
            page_text = page.get_text("text").strip()
            if page_text:
                texts.append(page_text)
    return "\n\n".join(texts).strip()


def create_article_payload(title: str, content: str) -> dict[str, Any]:
    return {
        "title": title,
        "author": "DBR",
        "published_date": date.today().isoformat(),
        "category": "경영전략",
        "industry_tags": ["general"],
        "summary": None,
        "source_url": None,
        "content": content,
    }


def ingest_pdf(base_url: str, token: str, pdf_path: Path) -> tuple[str, str]:
    title = pdf_path.stem
    existing_titles = list_existing_titles(base_url, token, title)
    if title in existing_titles:
        return "skip", "이미 등록됨"

    text = extract_text_from_pdf(pdf_path)
    if len(text) < MIN_TEXT_LENGTH:
        return "fail", f"텍스트가 비어 있거나 너무 짧음 ({len(text)}자)"

    article = api_request(
        "POST",
        f"{base_url}/api/articles",
        payload=create_article_payload(title, text),
        token=token,
    )
    return "ok", f"article_id={article['article_id']} chunk_count={article['chunk_count']}"


def query_rag(base_url: str, token: str, question: str) -> dict[str, Any]:
    started = time.perf_counter()
    response = api_request(
        "POST",
        f"{base_url}/api/rag/query",
        payload={"question": question},
        token=token,
    )
    elapsed = time.perf_counter() - started
    return {
        "question": question,
        "answer": response.get("answer", ""),
        "sources": response.get("sources", []),
        "elapsed": elapsed,
    }


def print_rag_result(result: dict[str, Any]) -> None:
    print("\n[RAG TEST]")
    print(f"질문: {result['question']}")
    print(f"응답 시간: {result['elapsed']:.2f}초")
    print(f"답변: {result['answer']}")
    print(f"참조 아티클: {result['sources']}")
    if "관련 아티클을 찾을 수 없습니다" in result["answer"]:
        print("안내: 인덱싱된 PDF 내용과 질문 주제가 잘 맞지 않을 수 있습니다.")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="PDF를 아티클/RAG 인덱스로 등록합니다.")
    parser.add_argument("--dir", default="data/articles/", help="PDF 폴더 경로")
    parser.add_argument("--email", required=True, help="로그인 이메일")
    parser.add_argument("--password", required=True, help="로그인 비밀번호")
    parser.add_argument("--base-url", default="http://localhost:8000", help="API 기본 주소")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    pdf_dir = ensure_pdf_dir(args.dir)
    pdf_files = sorted(pdf_dir.glob("*.pdf"))

    if not pdf_files:
        print("data/articles/ 폴더에 DBR PDF 파일을 넣은 후 다시 실행하세요")
        return 0

    try:
        token = login(args.base_url, args.email, args.password)
    except Exception as exc:
        print(f"[FAIL] 로그인 실패 - {exc}")
        return 1

    counters = Counters(total=len(pdf_files))
    for pdf_path in pdf_files:
        try:
            status, message = ingest_pdf(args.base_url, token, pdf_path)
            if status == "ok":
                counters.success += 1
                print(f"[OK] {pdf_path.name} - {message}")
            elif status == "skip":
                counters.skipped += 1
                print(f"[SKIP] {pdf_path.name} - {message}")
            else:
                counters.failed += 1
                print(f"[FAIL] {pdf_path.name} - {message}")
        except Exception as exc:
            counters.failed += 1
            print(f"[FAIL] {pdf_path.name} - {exc}")

    print("\n[SUMMARY]")
    print(f"총 파일 수: {counters.total}")
    print(f"성공 수: {counters.success}")
    print(f"스킵 수: {counters.skipped}")
    print(f"실패 수: {counters.failed}")

    for question in DEFAULT_RAG_QUESTIONS:
        try:
            result = query_rag(args.base_url, token, question)
            print_rag_result(result)
        except Exception as exc:
            print("\n[RAG TEST]")
            print(f"질문: {question}")
            print(f"실패: {exc}")

    return 0 if counters.failed == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
