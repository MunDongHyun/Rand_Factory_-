from fastapi import APIRouter

router = APIRouter(prefix="/health", tags=["health"])


@router.get("")
async def health_check():
    """서버 상태 확인 엔드포인트 — Docker healthcheck 및 모니터링용"""
    return {"status": "ok", "service": "landfactory-api"}
