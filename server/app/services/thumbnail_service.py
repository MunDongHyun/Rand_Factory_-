"""아티클 썸네일 URL 생성.

`articles.article_thumbnail_filename` 값을 그대로 사용해
`ai/thumbnails/{filename}` 디스크 파일과 매칭한다.
"""

from pathlib import Path
from urllib.parse import quote

from app.models.article import Article

# server/app/services/thumbnail_service.py → parents[3] = 프로젝트 루트
THUMBNAIL_DIR = Path(__file__).resolve().parents[3] / "ai" / "thumbnails"
URL_PREFIX = "/api/thumbnails"


def get_thumbnail_url(article: Article) -> str | None:
    """DB에 매핑된 파일이 디스크에 있으면 URL, 없으면 None."""
    filename = article.article_thumbnail_filename
    if not filename:
        return None
    if not (THUMBNAIL_DIR / filename).exists():
        return None
    return f"{URL_PREFIX}/{quote(filename)}"
