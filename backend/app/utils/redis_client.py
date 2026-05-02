import redis.asyncio as aioredis
from app.config import settings

def get_redis():
    return aioredis.from_url(
        settings.REDIS_URL,
        decode_responses=True,
        encoding="utf-8",
    )

async def blacklist_token(token: str, expire_seconds: int):
    async with get_redis() as r:
        await r.setex(f"blacklist:{token}", expire_seconds, "1")

async def is_token_blacklisted(token: str) -> bool:
    async with get_redis() as r:
        val = await r.get(f"blacklist:{token}")
        return val is not None

async def store_otp(identifier: str, otp: str, purpose: str, expire_seconds: int):
    async with get_redis() as r:
        await r.setex(f"otp:{purpose}:{identifier}", expire_seconds, otp)

async def get_otp(identifier: str, purpose: str) -> str | None:
    async with get_redis() as r:
        return await r.get(f"otp:{purpose}:{identifier}")

async def delete_otp(identifier: str, purpose: str):
    async with get_redis() as r:
        await r.delete(f"otp:{purpose}:{identifier}")
