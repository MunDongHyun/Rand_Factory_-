from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Iterator

from botocore.exceptions import BotoCoreError, ClientError

from app.core.config import settings


class AttachmentStorageError(Exception):
    """Raised when the configured attachment storage cannot complete an operation."""


class AttachmentNotFoundError(AttachmentStorageError):
    """Raised when an attachment object does not exist in storage."""


@dataclass(frozen=True)
class StoredAttachment:
    body: Iterator[bytes]
    content_type: str
    content_length: int | None = None


ATTACHMENT_ROOT = Path(__file__).resolve().parents[2] / "uploads" / "task_attachments"
UPLOADS_ROOT = Path(__file__).resolve().parents[2] / "uploads"


def _object_key(submission_id: int, stored_name: str) -> str:
    return f"task_attachments/{submission_id}/{stored_name}"


def _safe_object_key(key: str) -> str:
    normalized = Path(key.replace("\\", "/"))
    if not key or normalized.is_absolute() or any(part in {"", ".", ".."} for part in normalized.parts):
        raise AttachmentStorageError("Invalid object key")
    return normalized.as_posix()


def _local_object_path(key: str) -> Path:
    safe_key = _safe_object_key(key)
    uploads_root = UPLOADS_ROOT.resolve()
    target_path = (uploads_root / safe_key).resolve()
    try:
        target_path.relative_to(uploads_root)
    except ValueError as exc:
        raise AttachmentStorageError("Invalid object key") from exc
    return target_path


def save_object(key: str, contents: bytes, content_type: str) -> None:
    """범용 객체 저장. key는 R2 / 로컬 양쪽에서 동일한 상대 경로.

    R2 설정이 모두 있으면 R2에, 아니면 server/uploads/{key} 로컬 저장.
    호출처는 실패 시 AttachmentStorageError 잡아서 best-effort 처리 가능.
    """
    safe_key = _safe_object_key(key)

    if _r2_enabled():
        try:
            _r2_client().put_object(
                Bucket=settings.r2_bucket_name,
                Key=safe_key,
                Body=contents,
                ContentType=content_type,
            )
            return
        except (BotoCoreError, ClientError) as exc:
            raise AttachmentStorageError("R2 object upload failed") from exc

    target_path = _local_object_path(safe_key)
    try:
        target_path.parent.mkdir(parents=True, exist_ok=True)
        target_path.write_bytes(contents)
    except OSError as exc:
        raise AttachmentStorageError("Local object upload failed") from exc


def open_object(key: str, fallback_content_type: str) -> StoredAttachment:
    """범용 객체 다운로드. R2 우선, NoSuchKey면 로컬 fallback."""
    safe_key = _safe_object_key(key)

    if _r2_enabled():
        try:
            obj = _r2_client().get_object(Bucket=settings.r2_bucket_name, Key=safe_key)
            return StoredAttachment(
                body=obj["Body"].iter_chunks(),
                content_type=obj.get("ContentType") or fallback_content_type,
                content_length=obj.get("ContentLength"),
            )
        except ClientError as exc:
            code = exc.response.get("Error", {}).get("Code")
            if code not in {"NoSuchKey", "404", "NotFound"}:
                raise AttachmentStorageError("R2 object download failed") from exc
        except BotoCoreError as exc:
            raise AttachmentStorageError("R2 object download failed") from exc

    file_path = _local_object_path(safe_key)
    if not file_path.is_file():
        raise AttachmentNotFoundError("Object file does not exist")

    def stream_file() -> Iterator[bytes]:
        with file_path.open("rb") as f:
            while chunk := f.read(1024 * 1024):
                yield chunk

    return StoredAttachment(
        body=stream_file(),
        content_type=fallback_content_type,
        content_length=file_path.stat().st_size,
    )


def _local_path(submission_id: int, stored_name: str) -> Path:
    return ATTACHMENT_ROOT / str(submission_id) / stored_name


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


def save_attachment(submission_id: int, stored_name: str, contents: bytes, content_type: str) -> None:
    if _r2_enabled():
        try:
            _r2_client().put_object(
                Bucket=settings.r2_bucket_name,
                Key=_object_key(submission_id, stored_name),
                Body=contents,
                ContentType=content_type,
            )
            return
        except (BotoCoreError, ClientError) as exc:
            raise AttachmentStorageError("R2 attachment upload failed") from exc

    target_path = _local_path(submission_id, stored_name)
    try:
        target_path.parent.mkdir(parents=True, exist_ok=True)
        target_path.write_bytes(contents)
    except OSError as exc:
        raise AttachmentStorageError("Local attachment upload failed") from exc


def open_attachment(submission_id: int, stored_name: str, fallback_content_type: str) -> StoredAttachment:
    if _r2_enabled():
        try:
            obj = _r2_client().get_object(
                Bucket=settings.r2_bucket_name,
                Key=_object_key(submission_id, stored_name),
            )
            return StoredAttachment(
                body=obj["Body"].iter_chunks(),
                content_type=obj.get("ContentType") or fallback_content_type,
                content_length=obj.get("ContentLength"),
            )
        except ClientError as exc:
            code = exc.response.get("Error", {}).get("Code")
            if code not in {"NoSuchKey", "404", "NotFound"}:
                raise AttachmentStorageError("R2 attachment download failed") from exc
        except BotoCoreError as exc:
            raise AttachmentStorageError("R2 attachment download failed") from exc

    file_path = _local_path(submission_id, stored_name)
    if not file_path.is_file():
        raise AttachmentNotFoundError("Attachment file does not exist")

    def stream_file() -> Iterator[bytes]:
        with file_path.open("rb") as f:
            while chunk := f.read(1024 * 1024):
                yield chunk

    return StoredAttachment(
        body=stream_file(),
        content_type=fallback_content_type,
        content_length=file_path.stat().st_size,
    )


def delete_attachment(submission_id: int, stored_name: str) -> None:
    if _r2_enabled():
        try:
            _r2_client().delete_object(
                Bucket=settings.r2_bucket_name,
                Key=_object_key(submission_id, stored_name),
            )
        except (BotoCoreError, ClientError):
            pass

    file_path = _local_path(submission_id, stored_name)
    if file_path.is_file():
        try:
            file_path.unlink()
        except OSError:
            pass
