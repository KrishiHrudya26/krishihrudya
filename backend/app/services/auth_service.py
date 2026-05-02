from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from fastapi import HTTPException, status
from datetime import datetime, timezone

from app.models.user import User, Customer
from app.models.role import Role, RolePermission
from app.utils.hashing import verify_password, hash_password
from app.utils.jwt import create_access_token, create_refresh_token, decode_token
from app.utils.redis_client import blacklist_token, is_token_blacklisted
from app.schemas.auth import TokenResponse, UserInfo
from app.config import settings


def _permissions_dict(perms: RolePermission) -> dict:
    if not perms:
        return {}
    skip = {"id", "role_id", "created_at", "updated_at", "role"}
    return {
        col: getattr(perms, col)
        for col in RolePermission.__table__.columns.keys()
        if col not in skip
    }


async def login(identifier: str, password: str, db: AsyncSession):
    # Find user by email or phone
    result = await db.execute(
        select(User).where(
            (User.email == identifier) | (User.phone == identifier)
        )
    )
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(status_code=401, detail="Invalid credentials")

    if not user.password_hash:
        raise HTTPException(status_code=401, detail="Password not set. Please complete registration.")

    if not verify_password(password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid credentials")

    if user.status != "active":
        raise HTTPException(status_code=403, detail=f"Account is {user.status}. Contact support.")

    # Load role and permissions
    role_result = await db.execute(select(Role).where(Role.role_id == user.role_id))
    role = role_result.scalar_one_or_none()

    perms_result = await db.execute(
        select(RolePermission).where(RolePermission.role_id == user.role_id)
    )
    perms = perms_result.scalar_one_or_none()

    # Load customer
    cust_result = await db.execute(
        select(Customer).where(Customer.cust_id == user.customer_id)
    )
    customer = cust_result.scalar_one_or_none()

    # Update last login
    user.last_login_at = datetime.now(timezone.utc)
    await db.commit()

    # Create tokens
    token_data = {"sub": str(user.user_id), "role": role.slug if role else ""}
    access_token  = create_access_token(token_data)
    refresh_token = create_refresh_token(token_data)

    user_info = UserInfo(
        user_id=user.user_id,
        full_name=user.full_name,
        email=user.email,
        phone=user.phone,
        role_slug=role.slug if role else "",
        role_name=role.name if role else "",
        customer_id=user.customer_id,
        customer_name=customer.cust_name if customer else "",
        customer_type=customer.cust_type if customer else "",
        is_kh_internal=role.is_kh_internal if role else False,
        bypass_org_scope=user.bypass_org_scope,
        permissions=_permissions_dict(perms),
    )

    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer",
        "user": user_info,
    }


async def logout(refresh_token: str):
    payload = decode_token(refresh_token)
    if payload:
        exp = payload.get("exp", 0)
        now = int(datetime.now(timezone.utc).timestamp())
        ttl = max(exp - now, 1)
        await blacklist_token(refresh_token, ttl)


async def refresh_access_token(refresh_token: str):
    if await is_token_blacklisted(refresh_token):
        raise HTTPException(status_code=401, detail="Token has been revoked")

    payload = decode_token(refresh_token)
    if not payload or payload.get("type") != "refresh":
        raise HTTPException(status_code=401, detail="Invalid refresh token")

    new_access = create_access_token({"sub": payload["sub"], "role": payload.get("role", "")})
    return {"access_token": new_access, "token_type": "bearer"}


async def get_current_user(token: str, db: AsyncSession) -> User:
    if await is_token_blacklisted(token):
        raise HTTPException(status_code=401, detail="Token revoked")

    payload = decode_token(token)
    if not payload or payload.get("type") != "access":
        raise HTTPException(status_code=401, detail="Invalid token")

    result = await db.execute(
        select(User).where(User.user_id == payload["sub"])
    )
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user
