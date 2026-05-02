import resend
from app.config import settings

resend.api_key = settings.RESEND_API_KEY

async def send_otp_email(to_email: str, otp: str, purpose: str):
    subject_map = {
        "password_reset": "KrishiHrudya — Password Reset OTP",
        "registration":   "KrishiHrudya — Verify Your Email",
    }
    try:
        resend.Emails.send({
            "from": "KrishiHrudya <no-reply@krishihrudya.com>",
            "to": [to_email],
            "subject": subject_map.get(purpose, "KrishiHrudya OTP"),
            "html": f"""
                <div style="font-family:sans-serif;max-width:480px;margin:auto">
                  <h2 style="color:#106f30">KrishiHrudya</h2>
                  <p>Your OTP is:</p>
                  <h1 style="letter-spacing:8px;color:#106f30">{otp}</h1>
                  <p>Valid for 10 minutes. Do not share this with anyone.</p>
                </div>
            """,
        })
    except Exception as e:
        print(f"Email error: {e}")
