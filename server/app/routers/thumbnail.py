from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse

from app.services.thumbnail_storage import (
    ThumbnailNotFoundError,
    ThumbnailStorageError,
    open_thumbnail,
)


router = APIRouter(prefix="/api/thumbnails", tags=["thumbnails"])


@router.get("/{filename:path}")
def get_thumbnail(filename: str):
    try:
        thumbnail = open_thumbnail(filename)
    except ThumbnailNotFoundError:
        raise HTTPException(status_code=404, detail="Thumbnail not found") from None
    except ThumbnailStorageError:
        raise HTTPException(status_code=500, detail="Thumbnail storage error") from None

    headers = {}
    if thumbnail.content_length is not None:
        headers["Content-Length"] = str(thumbnail.content_length)

    return StreamingResponse(
        thumbnail.body,
        media_type=thumbnail.content_type,
        headers=headers,
    )
