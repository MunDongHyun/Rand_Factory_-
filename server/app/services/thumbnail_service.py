from urllib.parse import quote

from app.core.config import settings
from app.models.article import Article


def get_thumbnail_url(article: Article) -> str | None:
    filename = article.article_thumbnail_filename
    if not filename:
        return None
    base = settings.backend_url.rstrip("/") if settings.backend_url else ""
    return f"{base}/api/thumbnails/{quote(filename)}"
