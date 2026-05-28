from __future__ import annotations

import argparse
import re
import sys
import unicodedata
from difflib import SequenceMatcher
from pathlib import Path

SERVER_ROOT = Path(__file__).resolve().parents[1]
if str(SERVER_ROOT) not in sys.path:
    sys.path.insert(0, str(SERVER_ROOT))

from app.core.database import SessionLocal
from app.models.article import Article
from app.services.attachment_storage import AttachmentStorageError, save_object


PDF_DIR = Path(__file__).resolve().parents[2] / "data" / "articles"
AUTO_MATCH_THRESHOLD = 0.88

MANUAL_FILENAME_TO_ARTICLE_ID = {
    "까다로운 고객 만난 영업사원 적극-유연 대응할 때 서비스 혁신-최호진.pdf": 18,
    "흥행의 비밀 1600만 관객 매출 1위 영화 '왕과 사는 남자'.pdf": 11,
    "'최고효율' 아닌 '최다 대안' 가져야 북미 등 병렬 생산 역량 절실.pdf": 5,
}


def normalize(text: str) -> str:
    value = unicodedata.normalize("NFKC", text or "").lower()
    value = re.sub(r"^hbr[_\s-]+", "", value)
    value = re.sub(r"[-–—]\s*[^-–—,]+(?:,[^-–—]+)*$", "", value)
    value = re.sub(r"[\"'“”‘’`.,!?·:;()\[\]{}<>]", "", value)
    return re.sub(r"\s+", "", value)


def similarity(left: str, right: str) -> float:
    return SequenceMatcher(None, normalize(left), normalize(right)).ratio()


def find_match(pdf_path: Path, articles: list[Article]) -> tuple[str, float, Article | None]:
    manual_id = MANUAL_FILENAME_TO_ARTICLE_ID.get(pdf_path.name)
    if manual_id is not None:
        article = next((item for item in articles if item.article_id == manual_id), None)
        return "manual", 1.0, article

    if not articles:
        return "miss", 0.0, None

    score, article = max(
        ((similarity(pdf_path.stem, item.article_title), item) for item in articles),
        key=lambda item: item[0],
    )
    if score >= AUTO_MATCH_THRESHOLD:
        return "auto", score, article
    return "miss", score, article


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Upload local article source PDFs to object storage.")
    parser.add_argument("--dir", default=str(PDF_DIR), help="Directory containing article PDFs")
    parser.add_argument("--apply", action="store_true", help="Actually upload and update DB")
    parser.add_argument("--overwrite", action="store_true", help="Overwrite existing article_pdf_key values")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    pdf_dir = Path(args.dir).resolve()
    pdf_files = sorted(pdf_dir.glob("*.pdf"))
    if not pdf_files:
        print(f"No PDF files found: {pdf_dir}")
        return 1

    counters = {"matched": 0, "uploaded": 0, "skipped": 0, "miss": 0, "failed": 0}

    with SessionLocal() as db:
        articles = db.query(Article).order_by(Article.article_id).all()
        used_article_ids: set[int] = set()

        for pdf_path in pdf_files:
            mode, score, article = find_match(pdf_path, articles)
            if article is None or mode == "miss":
                counters["miss"] += 1
                best = f"{article.article_id} {article.article_title}" if article else "none"
                print(f"[MISS] {pdf_path.name} score={score:.3f} best={best}")
                continue

            if article.article_id in used_article_ids:
                counters["failed"] += 1
                print(f"[FAIL] duplicate match article_id={article.article_id}: {pdf_path.name}")
                continue
            used_article_ids.add(article.article_id)
            counters["matched"] += 1

            key = f"articles/{article.article_id}/source.pdf"
            if article.article_pdf_key and not args.overwrite:
                counters["skipped"] += 1
                print(f"[SKIP] article_id={article.article_id} already has key={article.article_pdf_key}")
                continue

            print(f"[MATCH:{mode}] {pdf_path.name} -> article_id={article.article_id} score={score:.3f}")
            if not args.apply:
                continue

            contents = pdf_path.read_bytes()
            if not contents.startswith(b"%PDF-"):
                counters["failed"] += 1
                print(f"[FAIL] not a PDF by magic byte: {pdf_path.name}")
                continue

            try:
                save_object(key, contents, "application/pdf")
            except AttachmentStorageError as exc:
                counters["failed"] += 1
                print(f"[FAIL] upload failed article_id={article.article_id}: {exc}")
                continue

            article.article_pdf_key = key
            counters["uploaded"] += 1
            print(f"[OK] uploaded article_id={article.article_id} key={key}")

        if args.apply:
            db.commit()

    print("\n[SUMMARY]")
    for name, value in counters.items():
        print(f"{name}: {value}")
    print(f"mode: {'apply' if args.apply else 'dry-run'}")
    return 0 if counters["failed"] == 0 and counters["miss"] == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
