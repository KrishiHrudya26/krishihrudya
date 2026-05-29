from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import Optional
from pydantic import BaseModel
from app.database import get_db
from app.models.role import Role, RolePermission
from app.services.auth_service import get_current_user

router = APIRouter(prefix="/permissions", tags=["Permissions"])
bearer = HTTPBearer()

ALL_PERMISSIONS = [
    "dashboard_access","reports_view","reports_export","reports_query",
    "users_add","users_edit","users_delete","roles_add","roles_edit","roles_delete",
    "customers_add","customers_edit","customers_delete","access_tokens_assign",
    "role_permissions_assign","devices_assign","devices_edit","devices_delete",
    "hierarchy_view","hierarchy_manage","farms_manage","settings_basic","settings_advanced",
    "analytics_access","motor_control","event_logs_view","products_add",
    "categories_manage","products_test_status","meta_tables_manage",
    "dealer_manage","commission_approve","audit_logs_view","notifications_manage",
    "sim_manage","services_manage","services_view","orders_manage",
    "content_manage","installations_manage","installations_view",
]

PERMISSION_LABELS = {
    "dashboard_access":       "Dashboard Access",
    "reports_view":           "View Reports",
    "reports_export":         "Export Reports",
    "reports_query":          "Query Reports",
    "users_add":              "Add Users",
    "users_edit":             "Edit Users",
    "users_delete":           "Delete Users",
    "roles_add":              "Add Roles",
    "roles_edit":             "Edit Roles",
    "roles_delete":           "Delete Roles",
    "customers_add":          "Add Customers",
    "customers_edit":         "Edit Customers",
    "customers_delete":       "Delete Customers",
    "access_tokens_assign":   "Assign Access Tokens",
    "role_permissions_assign":"Assign Role Permissions",
    "devices_assign":         "Assign Devices",
    "devices_edit":           "Edit Devices",
    "devices_delete":         "Delete Devices",
    "hierarchy_view":         "View Hierarchy",
    "hierarchy_manage":       "Manage Hierarchy",
    "farms_manage":           "Manage Farms",
    "settings_basic":         "Basic Settings",
    "settings_advanced":      "Advanced Settings",
    "analytics_access":       "Analytics Access",
    "motor_control":          "Motor Control",
    "event_logs_view":        "View Event Logs",
    "products_add":           "Add Products",
    "categories_manage":      "Manage Categories",
    "products_test_status":   "Product Test Status",
    "meta_tables_manage":     "Manage Meta Tables",
    "dealer_manage":          "Manage Dealers",
    "commission_approve":     "Approve Commissions",
    "audit_logs_view":        "View Audit Logs",
    "notifications_manage":   "Manage Notifications",
    "sim_manage":             "Manage SIM Database",
    "services_manage":        "Manage Services",
    "services_view":          "View Services",
    "orders_manage":          "Manage Orders",
    "content_manage":         "Manage Content",
    "installations_manage":   "Manage Installations",
    "installations_view":     "View Installations",
}

PERMISSION_GROUPS = {
    "Platform":     ["dashboard_access","audit_logs_view","notifications_manage"],
    "Reports":      ["reports_view","reports_export","reports_query"],
    "Users":        ["users_add","users_edit","users_delete"],
    "Roles":        ["roles_add","roles_edit","roles_delete","role_permissions_assign"],
    "Customers":    ["customers_add","customers_edit","customers_delete","access_tokens_assign"],
    "Hierarchy":    ["hierarchy_view","hierarchy_manage"],
    "Devices":      ["devices_assign","devices_edit","devices_delete","motor_control","settings_basic","settings_advanced"],
    "Farms":        ["farms_manage","installations_manage","installations_view"],
    "Analytics":    ["analytics_access","event_logs_view"],
    "Products":     ["products_add","categories_manage","products_test_status","meta_tables_manage","orders_manage"],
    "Dealers":      ["dealer_manage","commission_approve"],
    "Services":     ["services_manage","services_view"],
    "SIM":          ["sim_manage"],
    "Content":      ["content_manage"],
}


async def require_permission(perm: str, token: str, db: AsyncSession):
    user = await get_current_user(token, db)
    result = await db.execute(select(RolePermission).where(RolePermission.role_id == user.role_id))
    perms = result.scalar_one_or_none()
    if not perms or getattr(perms, perm, 0) != 1:
        raise HTTPException(status_code=403, detail="Permission denied")
    return user


class PermissionUpdate(BaseModel):
    permissions: dict  # {permission_name: 0 or 1}


@router.get("/roles")
async def list_roles(
    credentials: HTTPAuthorizationCredentials = Depends(bearer),
    db:          AsyncSession = Depends(get_db),
):
    await require_permission("role_permissions_assign", credentials.credentials, db)

    result = await db.execute(select(Role).order_by(Role.hierarchy_level))
    roles = result.scalars().all()

    roles_list = []
    for role in roles:
        perm_result = await db.execute(
            select(RolePermission).where(RolePermission.role_id == role.role_id)
        )
        perms = perm_result.scalar_one_or_none()
        perm_dict = {}
        if perms:
            for p in ALL_PERMISSIONS:
                perm_dict[p] = getattr(perms, p, 0)

        roles_list.append({
            "role_id":         str(role.role_id),
            "name":            role.name,
            "slug":            role.slug,
            "customer_type":   role.customer_type,
            "is_kh_internal":  role.is_kh_internal,
            "hierarchy_level": role.hierarchy_level,
            "permissions":     perm_dict,
        })

    return {
        "roles":             roles_list,
        "all_permissions":   ALL_PERMISSIONS,
        "permission_labels": PERMISSION_LABELS,
        "permission_groups": PERMISSION_GROUPS,
    }


@router.get("/roles/{role_id}")
async def get_role_permissions(
    role_id:     str,
    credentials: HTTPAuthorizationCredentials = Depends(bearer),
    db:          AsyncSession = Depends(get_db),
):
    await require_permission("role_permissions_assign", credentials.credentials, db)

    role_result = await db.execute(select(Role).where(Role.role_id == role_id))
    role = role_result.scalar_one_or_none()
    if not role:
        raise HTTPException(status_code=404, detail="Role not found")

    perm_result = await db.execute(
        select(RolePermission).where(RolePermission.role_id == role_id)
    )
    perms = perm_result.scalar_one_or_none()

    perm_dict = {p: getattr(perms, p, 0) if perms else 0 for p in ALL_PERMISSIONS}

    return {
        "role_id":         str(role.role_id),
        "name":            role.name,
        "slug":            role.slug,
        "is_kh_internal":  role.is_kh_internal,
        "hierarchy_level": role.hierarchy_level,
        "permissions":     perm_dict,
        "permission_labels": PERMISSION_LABELS,
        "permission_groups": PERMISSION_GROUPS,
    }


@router.put("/roles/{role_id}")
async def update_role_permissions(
    role_id:     str,
    body:        PermissionUpdate,
    credentials: HTTPAuthorizationCredentials = Depends(bearer),
    db:          AsyncSession = Depends(get_db),
):
    current_user = await require_permission("role_permissions_assign", credentials.credentials, db)

    # Get current user's own permissions to prevent privilege escalation
    my_perms_result = await db.execute(
        select(RolePermission).where(RolePermission.role_id == current_user.role_id)
    )
    my_perms = my_perms_result.scalar_one_or_none()

    perm_result = await db.execute(
        select(RolePermission).where(RolePermission.role_id == role_id)
    )
    perms = perm_result.scalar_one_or_none()
    if not perms:
        raise HTTPException(status_code=404, detail="Role permissions not found")

    for perm_name, value in body.permissions.items():
        if perm_name not in ALL_PERMISSIONS:
            continue
        # Cannot assign a permission you don't have yourself
        if my_perms and getattr(my_perms, perm_name, 0) == 0 and value == 1:
            continue
        setattr(perms, perm_name, int(value))

    await db.commit()
    return {"message": "Permissions updated successfully"}