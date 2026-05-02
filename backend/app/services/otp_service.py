import random
import string
import logging
from app.utils.redis_client import store_otp, get_otp, delete_otp
from app.config import settings

def generate_otp(length: int = 6) -> str:
    return ''.join(random.choices(string.digits, k=length))

async def create_and_store_otp(identifier: str, purpose: str) -> str:
    otp = generate_otp()
    await store_otp(identifier, otp, purpose, settings.OTP_EXPIRE_MINUTES * 60)
    logging.warning(f"OTP for {identifier} ({purpose}): {otp}")
    return otp

async def verify_otp(identifier: str, otp: str, purpose: str) -> bool:
    stored = await get_otp(identifier, purpose)
    logging.warning(f"Stored OTP: {stored}")
    logging.warning(f"Provided OTP: {otp}")

    if isinstance(stored, bytes):
        stored = stored.decode()
    if stored == otp:
        return True
    return False
