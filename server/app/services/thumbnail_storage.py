from __future__ import annotations

import mimetypes
from dataclasses import dataclass
from pathlib import Path
from typing import Iterator

from botocore.exceptions import BotoCoreError, ClientError

from app.core.config import settings


class ThumbnailStorageError(Exception):
    """Raised when thumbnail storage cannot complete an operation."""


class ThumbnailNotFoundError(ThumbnailStorageError):
    """Raised when a thumbnail object does not exist in storage."""


@dataclass(frozen=True)
class StoredThumbnail:
    body: Iterator[bytes]
    content_type: str
    content_length: int | None = None


THUMBNAIL_DIR = Path(__file__).resolve().parents[3] / "ai" / "thumbnails"
THUMBNAIL_PREFIX = "thumbnails"


def _validate_filename(filename: str) -> str:
    if not filename or filename in {".", ".."}:
        raise ThumbnailNotFoundError("Thumbnail file does not exist")
    if "/" in filename or "\\" in filename:
        raise ThumbnailNotFoundError("Thumbnail file does not exist")
    return filename


def _object_key(filename: str) -> str:
    return f"{THUMBNAIL_PREFIX}/{_validate_filename(filename)}"


def _local_path(filename: str) -> Path:
    return THUMBNAIL_DIR / _validate_filename(filename)


def _content_type(filename: str) -> str:
    return mimetypes.guess_type(filename)[0] or "application/octet-stream"


def _r2_enabled() -> bool:
    return all(
        [
            settings.r2_account_id,
            settings.r2_access_key_id,
            settings.r2_secret_access_key,
            settings.r2_bucket_name,
            settings.r2_endpoint_url,
        ]
    )


def _r2_client():
    import boto3

    return boto3.client(
        "s3",
        endpoint_url=settings.r2_endpoint_url,
        aws_access_key_id=settings.r2_access_key_id,
        aws_secret_access_key=settings.r2_secret_access_key,
        region_name=settings.r2_region,
    )


def upload_thumbnail(filename: str, contents: bytes, content_type: str | None = None) -> None:
    if not _r2_enabled():
        raise ThumbnailStorageError("R2 thumbnail storage is not configured")

    try:
        _r2_client().put_object(
            Bucket=settings.r2_bucket_name,
            Key=_object_key(filename),
            Body=contents,
            ContentType=content_type or _content_type(filename),
        )
    except (BotoCoreError, ClientError) as exc:
        raise ThumbnailStorageError("R2 thumbnail upload failed") from exc


def _open_local_thumbnail(filename: str) -> StoredThumbnail:
    file_path = _local_path(filename)
    if not file_path.is_file():
        raise ThumbnailNotFoundError("Thumbnail file does not exist")

    def stream_file() -> Iterator[bytes]:
        with file_path.open("rb") as f:
            while chunk := f.read(1024 * 1024):
                yield chunk

    return StoredThumbnail(
        body=stream_file(),
        content_type=_content_type(filename),
        content_length=file_path.stat().st_size,
    )


def open_thumbnail(filename: str) -> StoredThumbnail:
    if _r2_enabled():
        try:
            obj = _r2_client().get_object(
                Bucket=settings.r2_bucket_name,
                Key=_object_key(filename),
            )
            return StoredThumbnail(
                body=obj["Body"].iter_chunks(),
                content_type=obj.get("ContentType") or _content_type(filename),
                content_length=obj.get("ContentLength"),
            )
        except ClientError as exc:
            code = exc.response.get("Error", {}).get("Code")
            if code not in {"NoSuchKey", "404", "NotFound"}:
                try:
                    return _open_local_thumbnail(filename)
                except ThumbnailNotFoundError:
                    raise ThumbnailStorageError("R2 thumbnail download failed") from exc
        except BotoCoreError as exc:
            try:
                return _open_local_thumbnail(filename)
            except ThumbnailNotFoundError:
                raise ThumbnailStorageError("R2 thumbnail download failed") from exc

    return _open_local_thumbnail(filename)
