import uuid
from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from typing import Optional
from pydantic import BaseModel
from app.database import get_db
from app.models.user import User, Customer
from app.models.role import Role, RolePermission
from app.models.hierarchy import HierarchyNode
from app.services.auth_service import get_current_user
from app.utils.hashing import hash_password

router = APIRouter(prefix="/users", tags=["Users"])
bearer = HTTPBearer()


async def require_permission(perm: str, token: str, db: AsyncSession):
    user = await get_current_user(token, db)
    result = await db.execute(select(RolePermission).where(RolePermission.role_id == user.role_id))
    perms = result.scalar_one_or_none()
    if not perms or getattr(perms, perm, 0) != 1:
        raise HTTPException(status_code=403, detail="Permission denied")
    return user


class UserUpdate(BaseModel):
    full_name:         Optional[str] = None
    role_id:           Optional[str] = None
    hierarchy_node_id: Optional[str] = None
    status:            Optional[str] = None

class ResetPasswordBody(BaseModel):
    new_password: str


@router.get("")
async def list_users(
    search:      Optional[str]  = None,
    customer_id: Optional[str]  = None,
    role_id:     Optional[str]  = None,
    status:      Optional[str]  = None,
    page:        int = 1,
    limit:       int = 20,
    credentials: HTTPAuthorizationCredentials = Depends(bearer),
    db:          AsyncSession = Depends(get_db),
):
    current_user = await require_permission("users_add", credentials.credentials, db)

    query = select(User)

    # Non-master-admin users can only see users in their own customer
    result = await db.execute(select(RolePermission).where(RolePermission.role_id == current_user.role_id))
    perms = result.scalar_one_or_none()
    if not current_user.bypass_org_scope:
        query = query.where(User.customer_id == current_user.customer_id)

    if search:
        query = query.where(
            User.full_name.ilike(f"%{search}%") |
            User.email.ilike(f"%{search}%") |
            User.phone.ilike(f"%{search}%")
        )
    if customer_id:
        query = query.where(User.customer_id == customer_id)
    if role_id:
        query = query.where(User.role_id == role_id)
    if status:
        query = query.where(User.status == status)

    count_result = await db.execute(select(func.count()).select_from(query.subquery()))
    total = count_result.scalar()

    query = query.order_by(User.created_at.desc()).offset((page - 1) * limit).limit(limit)
    result = await db.execute(query)
    users = result.scalars().all()

    # Load roles and customers for display
    role_ids = list({u.role_id for u in users})
    cust_ids = list({u.customer_id for u in users})

    roles_map = {}
    if role_ids:
        r = await db.execute(select(Role).where(Role.role_id.in_(role_ids)))
        for role in r.scalars().all():
            roles_map[role.role_id] = role

    custs_map = {}
    if cust_ids:
        c = await db.execute(select(Customer).where(Customer.cust_id.in_(cust_ids)))
        for cust in c.scalars().all():
            custs_map[cust.cust_id] = cust

    return {
        "total": total,
        "page":  page,
        "limit": limit,
        "users": [
            {
                "user_id":       str(u.user_id),
                "full_name":     u.full_name,
                "email":         u.email,
                "phone":         u.phone,
                "status":        u.status,
                "email_verified":u.email_verified,
                "phone_verified":u.phone_verified,
                "last_login_at": str(u.last_login_at) if u.last_login_at else None,
                "created_at":    str(u.created_at),
                "role":          {"role_id": str(roles_map[u.role_id].role_id), "name": roles_map[u.role_id].name, "slug": roles_map[u.role_id].slug} if u.role_id in roles_map else None,
                "customer":      {"cust_id": str(custs_map[u.customer_id].cust_id), "cust_name": custs_map[u.customer_id].cust_name, "customer_id": custs_map[u.customer_id].customer_id} if u.customer_id in custs_map else None,
            }
            for u in users
        ]
    }


@router.get("/{user_id}")
async def get_user(
    user_id:     str,
    credentials: HTTPAuthorizationCredentials = Depends(bearer),
    db:          AsyncSession = Depends(get_db),
):
    await require_permission("users_add", credentials.credentials, db)

    result = await db.execute(select(User).where(User.user_id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

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
        "bypass_org_scope":  user.bypass_org_scope,
        "last_login_at":     str(user.last_login_at) if user.last_login_at else None,
        "created_at":        str(user.created_at),
        "role":              {"role_id": str(role.role_id), "name": role.name, "slug": role.slug} if role else None,
        "customer":          {"cust_id": str(customer.cust_id), "cust_name": customer.cust_name, "customer_id": customer.customer_id} if customer else None,
        "hierarchy_node":    {"node_id": str(node.node_id), "name": node.name} if node else None,
    }


@router.put("/{user_id}")
async def update_user(
    user_id:     str,
    body:        UserUpdate,
    credentials: HTTPAuthorizationCredentials = Depends(bearer),
    db:          AsyncSession = Depends(get_db),
):
    await require_permission("users_edit", credentials.credentials, db)

    result = await db.execute(select(User).where(User.user_id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if body.full_name:         user.full_name         = body.full_name
    if body.role_id:           user.role_id           = body.role_id
    if body.hierarchy_node_id: user.hierarchy_node_id = body.hierarchy_node_id
    if body.status:            user.status            = body.status

    await db.commit()
    return {"message": "User updated successfully"}


@router.delete("/{user_id}")
async def deactivate_user(
    user_id:     str,
    credentials: HTTPAuthorizationCredentials = Depends(bearer),
    db:          AsyncSession = Depends(get_db),
):
    await require_permission("users_delete", credentials.credentials, db)

    result = await db.execute(select(User).where(User.user_id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    user.status = "inactive"
    await db.commit()
    return {"message": "User deactivated"}


@router.post("/{user_id}/reset-password")
async def admin_reset_password(
    user_id:     str,
    body:        ResetPasswordBody,
    credentials: HTTPAuthorizationCredentials = Depends(bearer),
    db:          AsyncSession = Depends(get_db),
):
    await require_permission("users_edit", credentials.credentials, db)

    result = await db.execute(select(User).where(User.user_id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if len(body.new_password) < 8:
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters")

    user.password_hash = hash_password(body.new_password)
    await db.commit()
    return {"message": "Password reset successfully"}