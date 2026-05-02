from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, text
from typing import Optional
from pydantic import BaseModel
from app.database import get_db
from app.models.user import User, Customer
from app.models.role import Role
from app.models.hierarchy import HierarchyNode
from app.services.auth_service import get_current_user
from app.utils.hashing import hash_password, verify_password

router = APIRouter(prefix="/profile", tags=["Profile"])
bearer = HTTPBearer()


@router.get("")
async def get_profile(
    credentials: HTTPAuthorizationCredentials = Depends(bearer),
    db: AsyncSession = Depends(get_db),
):
    user = await get_current_user(credentials.credentials, db)

    role = None
    if user.role_id:
        r = await db.execute(select(Role).where(Role.role_id == user.role_id))
        role = r.scalar_one_or_none()

    customer = None
    if user.customer_id:
        c = await db.execute(select(Customer).where(Customer.cust_id == user.customer_id))
        customer = c.scalar_one_or_none()

    node = None
    if user.hierarchy_node_id:
        n = await db.execute(select(HierarchyNode).where(HierarchyNode.node_id == user.hierarchy_node_id))
        node = n.scalar_one_or_none()

    return {
        "user_id":           str(user.user_id),
        "full_name":         user.full_name,
        "email":             user.email,
        "phone":             user.phone,
        "status":            user.status,
        "email_verified":    user.email_verified,
        "phone_verified":    user.phone_verified,
        "address":           getattr(user, 'address', None),
        "latitude":          float(user.latitude) if getattr(user, 'latitude', None) else None,
        "longitude":         float(user.longitude) if getattr(user, 'longitude', None) else None,
        "farm_size":         getattr(user, 'farm_size', None),
        "crop_type":         getattr(user, 'crop_type', None),
        "crop_stage":        getattr(user, 'crop_stage', None),
        "profile_photo":     getattr(user, 'profile_photo', None),
        "created_at":        str(user.created_at),
        "last_login_at":     str(user.last_login_at) if user.last_login_at else None,
        "role":              {"role_id": str(role.role_id), "name": role.name, "slug": role.slug} if role else None,
        "customer":          {"cust_id": str(customer.cust_id), "cust_name": customer.cust_name, "customer_id": customer.customer_id, "cust_type": customer.cust_type} if customer else None,
        "hierarchy_node":    {"node_id": str(node.node_id), "name": node.name} if node else None,
    }


class ProfileUpdate(BaseModel):
    full_name:    Optional[str]   = None
    address:      Optional[str]   = None
    latitude:     Optional[float] = None
    longitude:    Optional[float] = None
    farm_size:    Optional[str]   = None
    crop_type:    Optional[str]   = None
    crop_stage:   Optional[str]   = None
    profile_photo:Optional[str]   = None


@router.put("")
async def update_profile(
    body: ProfileUpdate,
    credentials: HTTPAuthorizationCredentials = Depends(bearer),
    db: AsyncSession = Depends(get_db),
):
    user = await get_current_user(credentials.credentials, db)
    updates = body.model_dump(exclude_none=True)
    if not updates:
        return {"message": "No changes"}

    set_parts = ", ".join([f"{k} = :{k}" for k in updates.keys()])
    updates["user_id"] = str(user.user_id)
    await db.execute(
        text(f"UPDATE users SET {set_parts} WHERE user_id = :user_id"),
        updates
    )
    await db.commit()
    return {"message": "Profile updated successfully"}


class ChangePasswordBody(BaseModel):
    current_password: str
    new_password:     str


@router.post("/change-password")
async def change_password(
    body: ChangePasswordBody,
    credentials: HTTPAuthorizationCredentials = Depends(bearer),
    db: AsyncSession = Depends(get_db),
):
    user = await get_current_user(credentials.credentials, db)

    if not verify_password(body.current_password, user.password_hash):
        raise HTTPException(status_code=400, detail="Current password is incorrect")
    if len(body.new_password) < 8:
        raise HTTPException(status_code=400, detail="New password must be at least 8 characters")

    await db.execute(
        text("UPDATE users SET password_hash = :hash WHERE user_id = :uid"),
        {"hash": hash_password(body.new_password), "uid": str(user.user_id)}
    )
    await db.commit()
    return {"message": "Password changed successfully"}
