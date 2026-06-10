from datetime import datetime, timezone

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status

from app.core.security import get_current_user
from app.models.user import User
from app.services.attachment_storage import AttachmentStorageError, save_object

router = APIRouter(prefix="/api/reports", tags=["reports"])

REPORT_MAX_BYTES = 30 * 1024 * 1024  # 한 리포트당 30MB
_ALLOWED_KINDS = {"weekly", "monthly"}


@router.post("/upload", status_code=status.HTTP_204_NO_CONTENT)
async def upload_report(
    kind: str = Query(..., description="weekly | monthly"),
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
):
    """관리자가 프론트(html2pdf)에서 생성한 운영 리포트 PDF를 R2(또는 로컬)에 보관.

    저장 경로: reports/{kind}/{user_id}/{YYYYMMDDTHHMMSS}.pdf
    """
    if current_user.user_role != "a":
        raise HTTPException(status_code=403, detail="관리자만 리포트를 업로드할 수 있습니다")
    if kind not in _ALLOWED_KINDS:
        raise HTTPException(status_code=400, detail="kind는 weekly 또는 monthly 만 허용됩니다")

    contents = await file.read()
    if not contents:
        raise HTTPException(status_code=400, detail="빈 파일은 업로드할 수 없습니다")
    if len(contents) > REPORT_MAX_BYTES:
        raise HTTPException(status_code=413, detail="파일이 너무 큽니다 (최대 30MB)")
    if not contents.startswith(b"%PDF-"):
        raise HTTPException(status_code=415, detail="PDF 형식만 업로드할 수 있습니다")

    ts = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%S")
    key = f"reports/{kind}/{current_user.user_id}/{ts}.pdf"
    try:
        save_object(key, contents, "application/pdf")
    except AttachmentStorageError as exc:
        raise HTTPException(status_code=500, detail="리포트를 저장하지 못했습니다") from exc
