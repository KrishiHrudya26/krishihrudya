import uuid
from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update
from datetime import datetime, timezone

from app.database import get_db
from app.schemas.auth import (
    LoginRequest, RefreshRequest, LogoutRequest,
    ForgotPasswordRequest, VerifyOtpRequest,
    ResetPasswordRequest, ChangePasswordRequest,
)
from app.services import auth_service
from app.services.otp_service import create_and_store_otp, verify_otp
from app.services.email_service import send_otp_email
from app.utils.hashing import verify_password, hash_password
from app.utils.jwt import decode_token
from app.config import settings
from app.schemas.auth import RegisterRequest, SetPasswordRequest
from app.models.hierarchy import HierarchyNode
from app.models.user import User, Customer
from app.models.role import Role

router = APIRouter(prefix="/auth", tags=["Auth"])
bearer = HTTPBearer()


@router.post("/login")
async def login(body: LoginRequest, db: AsyncSession = Depends(get_db)):
    return await auth_service.login(body.identifier, body.password, db)


@router.post("/logout")
async def logout(body: LogoutRequest):
    await auth_service.logout(body.refresh_token)
    return {"message": "Logged out successfully"}


@router.post("/refresh")
async def refresh(body: RefreshRequest):
    return await auth_service.refresh_access_token(body.refresh_token)


@router.post("/forgot-password")
async def forgot_password(body: ForgotPasswordRequest, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(User).where(
            (User.email == body.identifier) | (User.phone == body.identifier)
        )
    )
    user = result.scalar_one_or_none()
    if not user:
        return {"message": "If that account exists, an OTP has been sent"}

    otp = await create_and_store_otp(body.identifier, "password_reset")

    if user.email and body.identifier == user.email:
        await send_otp_email(user.email, otp, "password_reset")
    else:
        from app.services.sms_service import send_otp_sms
        await send_otp_sms(body.identifier, otp)

    return {"message": "If that account exists, an OTP has been sent"}


@router.post("/verify-otp")
async def verify_otp_route(body: VerifyOtpRequest):
    valid = await verify_otp(body.identifier, body.otp, body.purpose)
    if not valid:
        raise HTTPException(status_code=400, detail="Invalid or expired OTP")
    return {"message": "OTP verified"}


@router.post("/reset-password")
async def reset_password(body: ResetPasswordRequest, db: AsyncSession = Depends(get_db)):
    valid = await verify_otp(body.identifier, body.otp, "password_reset")
    if not valid:
        raise HTTPException(status_code=400, detail="Invalid or expired OTP")

    result = await db.execute(
        select(User).where(
            (User.email == body.identifier) | (User.phone == body.identifier)
        )
    )
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    user.password_hash = hash_password(body.new_password)
    await db.commit()
    return {"message": "Password reset successfully"}


@router.post("/change-password")
async def change_password(
    body: ChangePasswordRequest,
    credentials: HTTPAuthorizationCredentials = Depends(bearer),
    db: AsyncSession = Depends(get_db),
):
    user = await auth_service.get_current_user(credentials.credentials, db)
    if not verify_password(body.current_password, user.password_hash or ""):
        raise HTTPException(status_code=400, detail="Current password is incorrect")
    user.password_hash = hash_password(body.new_password)
    await db.commit()
    return {"message": "Password changed successfully"}


@router.get("/me")
async def me(
    credentials: HTTPAuthorizationCredentials = Depends(bearer),
    db: AsyncSession = Depends(get_db),
):
    user = await auth_service.get_current_user(credentials.credentials, db)
    return await auth_service.login.__wrapped__ if False else {"user_id": str(user.user_id), "status": user.status}


@router.post("/register")
async def register(body: RegisterRequest, db: AsyncSession = Depends(get_db)):
    # Validate customer code
    cust_result = await db.execute(
        select(Customer).where(
            Customer.customer_id == body.customer_code,
            Customer.is_active == True,
        )
    )
    customer = cust_result.scalar_one_or_none()
    if not customer:
        raise HTTPException(status_code=404, detail="Invalid customer code")

    # Check email/phone not already taken
    if body.email:
        existing = await db.execute(select(User).where(User.email == body.email))
        if existing.scalar_one_or_none():
            raise HTTPException(status_code=400, detail="Email already registered")

    if body.phone:
        existing = await db.execute(select(User).where(User.phone == body.phone))
        if existing.scalar_one_or_none():
            raise HTTPException(status_code=400, detail="Phone already registered")

    if not body.email and not body.phone:
        raise HTTPException(status_code=400, detail="Email or phone is required")

    # Create pending user
    user = User(
        user_id=uuid.uuid4(),
        full_name=body.full_name,
        email=body.email,
        phone=body.phone,
        customer_id=customer.cust_id,
        role_id=body.role_id,
        hierarchy_node_id=body.hierarchy_node_id,
        status="pending",
        verify_method=body.verify_via,
    )
    db.add(user)
    await db.commit()

    # Send OTP
    identifier = body.email if body.verify_via == "email" else body.phone
    otp = await create_and_store_otp(identifier, "registration")

    if body.verify_via == "email" and body.email:
        await send_otp_email(body.email, otp, "registration")
    else:
        from app.services.sms_service import send_otp_sms
        await send_otp_sms(body.phone, otp)

    return {"message": "OTP sent for verification", "user_id": str(user.user_id)}


@router.post("/set-password")
async def set_password(body: SetPasswordRequest, db: AsyncSession = Depends(get_db)):
    # Verify OTP
    valid = await verify_otp(body.identifier, body.otp, "registration")
    if not valid:
        raise HTTPException(status_code=400, detail="Invalid or expired OTP")

    # Find user
    result = await db.execute(
        select(User).where(
            (User.email == body.identifier) | (User.phone == body.identifier)
        )
    )
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # Set password and activate
    user.password_hash = hash_password(body.password)
    user.status = "active"
    if user.email == body.identifier:
        user.email_verified = True
    else:
        user.phone_verified = True

    await db.commit()
    return {"message": "Account created successfully. You can now login."}
