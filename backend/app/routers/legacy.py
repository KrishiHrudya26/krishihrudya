import json
from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from app.database import get_db, get_legacy_db
from app.services.auth_service import get_current_user
from app.utils.redis_client import get_redis

router = APIRouter(prefix="/legacy", tags=["Legacy"])
bearer = HTTPBearer()

CACHE_TTL = 600  # 10 minutes


@router.get("/uids")
async def get_legacy_uids(
    credentials: HTTPAuthorizationCredentials = Depends(bearer),
    db: AsyncSession = Depends(get_db),
    legacy_db: AsyncSession = Depends(get_legacy_db),
):
    await get_current_user(credentials.credentials, db)

    cache_key = "legacy:uids"
    try:
        async with get_redis() as r:
            cached = await r.get(cache_key)
            if cached:
                return {"uids": json.loads(cached)}
    except Exception:
        pass

    try:
        result = await legacy_db.execute(
            text("SELECT uid FROM products WHERE test_status = 2 AND status = 1")
        )
        uids = [row[0] for row in result.fetchall()]
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Legacy DB error: {str(e)}")

    try:
        async with get_redis() as r:
            await r.setex(cache_key, CACHE_TTL, json.dumps(uids))
    except Exception:
        pass

    return {"uids": uids}


@router.get("/farms")
async def get_legacy_farms(
    credentials: HTTPAuthorizationCredentials = Depends(bearer),
    db: AsyncSession = Depends(get_db),
    legacy_db: AsyncSession = Depends(get_legacy_db),
):
    await get_current_user(credentials.credentials, db)

    cache_key = "legacy:farms"
    try:
        async with get_redis() as r:
            cached = await r.get(cache_key)
            if cached:
                return {"farms": json.loads(cached)}
    except Exception:
        pass

    try:
        result = await legacy_db.execute(
            text("SELECT farm_name FROM farms")
        )
        farms = [row[0] for row in result.fetchall()]
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Legacy DB error: {str(e)}")

    try:
        async with get_redis() as r:
            await r.setex(cache_key, CACHE_TTL, json.dumps(farms))
    except Exception:
        pass

    return {"farms": farms}