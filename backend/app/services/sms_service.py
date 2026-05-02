import httpx
import logging
from app.config import settings

log = logging.getLogger(__name__)

async def send_otp_sms(phone: str, otp: str):
    clean_phone = phone.replace("+91", "").replace(" ", "").strip()

    if not settings.TWOFACTOR_API_KEY:
        log.warning(f"[SMS] 2Factor key not set — OTP for {phone}: {otp}")
        return

    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"https://2factor.in/API/V1/{settings.TWOFACTOR_API_KEY}/SMS/+91{clean_phone}/{otp}/KH-otp",
                timeout=10,
            )
            data = response.json()
            log.warning(f"[SMS] 2Factor response: {data}")
            if data.get("Status") == "Success":
                log.info(f"[SMS] OTP sent successfully to {clean_phone}")
            else:
                log.error(f"[SMS] Failed: {data}")
    except Exception as e:
        log.error(f"[SMS] Error: {e}")