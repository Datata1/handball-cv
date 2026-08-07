from fastapi import APIRouter

from backend.routes import matches

router = APIRouter(prefix="/api/v1", tags=["api"])
router.include_router(matches.router)
