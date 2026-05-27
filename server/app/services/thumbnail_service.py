from urllib.parse import quote

from app.models.article import Article


URL_PREFIX = "/api/thumbnails"


def get_thumbnail_url(article: Article) -> str | None:
    filename = article.article_thumbnail_filename
    if not filename:
        return None
    return f"{URL_PREFIX}/{quote(filename)}"
