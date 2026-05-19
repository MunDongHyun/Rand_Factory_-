from fastapi import APIRouter, Depends, HTTPException

from app.core.security import get_current_user
from app.models.user import User
from app.schemas.rag import RagQuery, RagResponse
from app.services import rag_service

router = APIRouter(prefix="/api/rag", tags=["rag"])


@router.post("/query", response_model=RagResponse)
def query_rag(
    body: RagQuery,
    current_user: User = Depends(get_current_user),
):
    if current_user.user_role not in {"j", "m", "a"}:
        raise HTTPException(status_code=404, detail="찾을 수 없습니다")
    result = rag_service.query_rag(question=body.question, k=body.k)
    return RagResponse(answer=result["answer"], sources=result["sources"])
