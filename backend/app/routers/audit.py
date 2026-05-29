from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from typing import Optional
from datetime import datetime, timedelta
from app.database import get_db
from app.models.role import RolePermission
from app.services.auth_service import get_current_user
import csv
import io

router = APIRouter(prefix="/audit", tags=["Audit Logs"])
bearer = HTTPBearer()


async def require_admin(token: str, db: AsyncSession):
    user = await get_current_user(token, db)
    result = await db.execute(
        text("SELECT * FROM role_permissions WHERE role_id = :rid"),
        {"rid": str(user.role_id)}
    )
    perms = result.mappings().first()
    if not user.bypass_org_scope:
        raise HTTPException(status_code=403, detail="Audit logs are restricted to internal team only")
    return user, perms


@router.get("")
async def list_audit_logs(
    user_id:         Optional[str] = None,
    customer_id:     Optional[str] = None,
    device_uid:      Optional[str] = None,
    action_category: Optional[str] = None,   # command / setting_change
    status:          Optional[str] = None,   # success / failed
    date_from:       Optional[str] = None,
    date_to:         Optional[str] = None,
    search:          Optional[str] = None,
    page:            int = 1,
    limit:           int = 50,
    credentials:     HTTPAuthorizationCredentials = Depends(bearer),
    db:              AsyncSession = Depends(get_db),
):
    current_user, _ = await require_admin(credentials.credentials, db)

    # Default: last 90 days on frontend, backend has everything
    if not date_from:
        date_from = (datetime.utcnow() - timedelta(days=90)).strftime("%Y-%m-%d")
    if not date_to:
        date_to = (datetime.utcnow() + timedelta(days=1)).strftime("%Y-%m-%d")

    conditions = [
        "a.created_at >= :date_from",
        "a.created_at <= :date_to",
    ]
    params: dict = {"date_from": date_from, "date_to": date_to}

    if user_id:
        conditions.append("a.user_id = :user_id")
        params["user_id"] = user_id
    if customer_id:
        conditions.append("a.customer_id = :customer_id")
        params["customer_id"] = customer_id
    if device_uid:
        conditions.append("a.device_uid ILIKE :device_uid")
        params["device_uid"] = f"%{device_uid}%"
    if action_category:
        conditions.append("a.action_category = :action_category")
        params["action_category"] = action_category
    if status:
        conditions.append("a.status = :status")
        params["status"] = status
    if search:
        conditions.append("""(
            a.action ILIKE :search OR
            a.command_name ILIKE :search OR
            a.setting_name ILIKE :search OR
            u.full_name ILIKE :search OR
            a.device_uid ILIKE :search
        )""")
        params["search"] = f"%{search}%"

    where = " AND ".join(conditions)

    # Total count
    count_result = await db.execute(
        text(f"SELECT COUNT(*) FROM audit_trail a LEFT JOIN users u ON u.user_id = a.user_id WHERE {where}"),
        params
    )
    total = count_result.scalar()

    params["limit"]  = limit
    params["offset"] = (page - 1) * limit

    result = await db.execute(
        text(f"""
            SELECT
                a.audit_id, a.action, a.action_category,
                a.resource_type, a.resource_id, a.device_uid,
                a.command_name, a.setting_name,
                a.old_value, a.new_value,
                a.status, a.failure_reason,
                a.ip_address, a.created_at,
                u.full_name as user_name,
                c.cust_name as customer_name,
                c.customer_id as customer_code
            FROM audit_trail a
            LEFT JOIN users u ON u.user_id = a.user_id
            LEFT JOIN customers c ON c.cust_id = a.customer_id
            WHERE {where}
            ORDER BY a.created_at DESC
            LIMIT :limit OFFSET :offset
        """),
        params
    )
    rows = result.mappings().all()

    def fmt(r):
        return {
            "audit_id":        str(r["audit_id"]),
            "action":          r["action"],
            "action_category": r["action_category"],
            "resource_type":   r["resource_type"],
            "resource_id":     str(r["resource_id"]) if r["resource_id"] else None,
            "device_uid":      r["device_uid"],
            "command_name":    r["command_name"],
            "setting_name":    r["setting_name"],
            "old_value":       r["old_value"],
            "new_value":       r["new_value"],
            "status":          r["status"],
            "failure_reason":  r["failure_reason"],
            "ip_address":      r["ip_address"],
            "created_at":      str(r["created_at"]) if r["created_at"] else None,
            "user_name":       r["user_name"],
            "customer_name":   r["customer_name"],
            "customer_code":   r["customer_code"],
        }

    return {
        "total":  total,
        "page":   page,
        "limit":  limit,
        "logs":   [fmt(r) for r in rows],
    }


@router.get("/export")
async def export_audit_logs(
    user_id:         Optional[str] = None,
    customer_id:     Optional[str] = None,
    device_uid:      Optional[str] = None,
    action_category: Optional[str] = None,
    status:          Optional[str] = None,
    date_from:       Optional[str] = None,
    date_to:         Optional[str] = None,
    credentials:     HTTPAuthorizationCredentials = Depends(bearer),
    db:              AsyncSession = Depends(get_db),
):
    """Export audit logs as CSV — same filters as list endpoint."""
    current_user, _ = await require_admin(credentials.credentials, db)

    if not date_from:
        date_from = (datetime.utcnow() - timedelta(days=90)).strftime("%Y-%m-%d")
    if not date_to:
        date_to = (datetime.utcnow() + timedelta(days=1)).strftime("%Y-%m-%d")

    conditions = ["a.created_at >= :date_from", "a.created_at <= :date_to"]
    params: dict = {"date_from": date_from, "date_to": date_to}

    if user_id:
        conditions.append("a.user_id = :user_id"); params["user_id"] = user_id
    if customer_id:
        conditions.append("a.customer_id = :customer_id"); params["customer_id"] = customer_id
    if device_uid:
        conditions.append("a.device_uid ILIKE :device_uid"); params["device_uid"] = f"%{device_uid}%"
    if action_category:
        conditions.append("a.action_category = :action_category"); params["action_category"] = action_category
    if status:
        conditions.append("a.status = :status"); params["status"] = status

    where = " AND ".join(conditions)

    result = await db.execute(
        text(f"""
            SELECT
                a.created_at, u.full_name as user_name,
                c.customer_id as customer_code, c.cust_name as customer_name,
                a.device_uid, a.action_category, a.action,
                a.command_name, a.setting_name,
                a.old_value, a.new_value,
                a.status, a.failure_reason, a.ip_address
            FROM audit_trail a
            LEFT JOIN users u ON u.user_id = a.user_id
            LEFT JOIN customers c ON c.cust_id = a.customer_id
            WHERE {where}
            ORDER BY a.created_at DESC
            LIMIT 10000
        """),
        params
    )
    rows = result.mappings().all()

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "Timestamp", "User", "Customer ID", "Customer Name",
        "Device UID", "Category", "Action",
        "Command", "Setting", "Old Value", "New Value",
        "Status", "Failure Reason", "IP Address"
    ])
    for r in rows:
        writer.writerow([
            r["created_at"], r["user_name"], r["customer_code"], r["customer_name"],
            r["device_uid"], r["action_category"], r["action"],
            r["command_name"], r["setting_name"], r["old_value"], r["new_value"],
            r["status"], r["failure_reason"], r["ip_address"]
        ])

    output.seek(0)
    filename = f"audit_logs_{date_from}_to_{date_to}.csv"
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )


@router.get("/users-list")
async def get_users_for_filter(
    credentials: HTTPAuthorizationCredentials = Depends(bearer),
    db:          AsyncSession = Depends(get_db),
):
    """Return list of users for the filter dropdown."""
    await require_admin(credentials.credentials, db)
    result = await db.execute(
        text("""
            SELECT DISTINCT u.user_id, u.full_name, c.customer_id, c.cust_name
            FROM audit_trail a
            JOIN users u ON u.user_id = a.user_id
            LEFT JOIN customers c ON c.cust_id = a.customer_id
            ORDER BY u.full_name
            LIMIT 200
        """)
    )
    rows = result.mappings().all()
    return {
        "users": [
            {
                "user_id":       str(r["user_id"]),
                "full_name":     r["full_name"],
                "customer_id":   r["customer_id"],
                "customer_name": r["cust_name"],
            }
            for r in rows
        ]
    }
