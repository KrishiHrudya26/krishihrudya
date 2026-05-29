from fastapi import APIRouter, Depends, Query, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text, select
from typing import Optional
from app.database import get_db, get_sensor_db
from app.services.auth_service import get_current_user
from app.models.role import RolePermission

router = APIRouter(prefix="/event-logs", tags=["Event Logs"])
bearer = HTTPBearer()

async def check_perm(token: str, db: AsyncSession):
    user = await get_current_user(token, db)
    result = await db.execute(select(RolePermission).where(RolePermission.role_id == user.role_id))
    perms = result.scalar_one_or_none()
    if not perms or perms.event_logs_view != 1:
        raise HTTPException(status_code=403, detail="Permission denied")
    return user

def fmt_runtime(secs):
    if not secs: return None
    secs = int(secs)
    h, m = divmod(secs, 3600)
    m, s = divmod(m, 60)
    if h: return f"{h}h {m}m"
    if m: return f"{m}m {s}s"
    return f"{s}s"


@router.get("")
async def get_event_logs(
    uid:        Optional[str] = Query(default=None),
    range_days: int           = Query(default=1),
    start_date: Optional[str] = Query(default=None),
    end_date:   Optional[str] = Query(default=None),
    category:   Optional[str] = Query(default=None),
    page:       int           = Query(default=1, ge=1),
    page_size:  int           = Query(default=50, le=200),
    credentials: HTTPAuthorizationCredentials = Depends(bearer),
    db:          AsyncSession = Depends(get_db),
    sensor_db:   AsyncSession = Depends(get_sensor_db),
):
    await check_perm(credentials.credentials, db)
    from datetime import datetime, timedelta

    if range_days == 0 and start_date and end_date:
        end_dt = datetime.strptime(end_date, "%Y-%m-%d") + timedelta(days=1)
        time_filter = f"e.created_at >= '{start_date}' AND e.created_at < '{end_dt.date()}'"
    elif range_days == 7:
        time_filter = "e.created_at >= NOW() - INTERVAL '7 days'"
    elif range_days == 30:
        time_filter = "e.created_at >= NOW() - INTERVAL '30 days'"
    else:
        time_filter = "e.created_at >= NOW() - INTERVAL '1 day'"

    uid_filter = "AND CAST(e.uid AS TEXT) = :uid" if uid else ""
    cat_filter = "AND e.event_category = :category" if category else ""
    offset     = (page - 1) * page_size

    params = {}
    if uid:      params["uid"]      = uid
    if category: params["category"] = category

    if uid:
        cust_result = await db.execute(text("""
            SELECT c.cust_id, c.cust_name, f.farm_name, f.address,
                   i.pump_name, i.ward_number
            FROM installations i
            JOIN farms f ON f.farm_id = i.farm_id
            JOIN customers c ON c.cust_id = f.customer_id
            WHERE i.product_uid = :uid OR i.uid = :uid
            LIMIT 1
        """), {"uid": uid})
        cust_row = cust_result.mappings().first()
        cust_map = None
    else:
        cust_result = await db.execute(text("""
            SELECT DISTINCT i.product_uid AS uid,
                   c.cust_name, c.cust_id,
                   f.farm_name, f.address,
                   i.pump_name, i.ward_number
            FROM installations i
            JOIN farms f ON f.farm_id = i.farm_id
            JOIN customers c ON c.cust_id = f.customer_id
            WHERE i.product_uid IS NOT NULL
        """))
        cust_map = {r["uid"]: dict(r) for r in cust_result.mappings().all()}
        cust_row = None

    count_result = await sensor_db.execute(text(f"""
        SELECT COUNT(*) FROM event_logs e
        WHERE 1=1 {uid_filter} AND {time_filter} {cat_filter}
    """), params)
    total = count_result.scalar() or 0

    result = await sensor_db.execute(text(f"""
        SELECT e.event_id, CAST(e.uid AS TEXT) AS uid,
               e.event_category, e.message, e.mode,
               e.run_time, e.water_yield, e.total_run,
               e.voltage1, e.voltage2, e.voltage3,
               e.current1, e.current2, e.current3,
               e.location, e.signal,
               e.last_service, e.action,
               e.ticket_id, e.issue, e.priority,
               e.raised_by, e.resolution, e.closed_by, e.duration,
               e.farm_id, e.created_at
        FROM event_logs e
        WHERE 1=1 {uid_filter} AND {time_filter} {cat_filter}
        ORDER BY e.created_at DESC
        LIMIT :limit OFFSET :offset
    """), {**params, "limit": page_size, "offset": offset})
    rows = result.mappings().all()

    summary_result = await sensor_db.execute(text(f"""
        SELECT event_category, COUNT(*) AS cnt
        FROM event_logs e
        WHERE 1=1 {uid_filter} AND {time_filter}
        GROUP BY event_category ORDER BY cnt DESC
    """), params)
    summary = [{"category": r["event_category"], "count": r["cnt"]}
               for r in summary_result.mappings().all()]

    def resolve(row_uid):
        if cust_row:
            return {
                "cust_name":   cust_row["cust_name"],
                "cust_id":     str(cust_row["cust_id"]),
                "farm_name":   cust_row["farm_name"],
                "address":     cust_row["address"],
                "pump_name":   cust_row["pump_name"],
                "ward_number": cust_row["ward_number"],
            }
        if cust_map:
            r = cust_map.get(row_uid, {})
            return {
                "cust_name":   r.get("cust_name"),
                "cust_id":     str(r["cust_id"]) if r.get("cust_id") else None,
                "farm_name":   r.get("farm_name"),
                "address":     r.get("address"),
                "pump_name":   r.get("pump_name"),
                "ward_number": r.get("ward_number"),
            }
        return {}

    MOTOR_CATS  = {"motor_start", "motor_stop"}
    FAULT_CATS  = {"power_failure", "voltage_fault", "overload_trip",
                   "underload_trip", "dry_run_trip", "phase_failure"}
    POWER_CATS  = {"power_lost", "power_resumed"}
    MAINT_CATS  = {"maintenance_due", "repeated_fault"}
    TICKET_CATS = {"ticket_raised", "ticket_resolved"}

    logs = []
    for r in rows:
        cat  = r["event_category"] or "info"
        info = resolve(r["uid"])
        logs.append({
            "event_id":       r["event_id"],
            "uid":            r["uid"],
            "event_category": cat,
            "message":        r["message"] or "",
            "mode":           r["mode"],
            "run_time":       fmt_runtime(r["run_time"]),
            "water_yield":    round(float(r["water_yield"]), 1) if r["water_yield"] else None,
            "total_run":      fmt_runtime(r["total_run"]),
            "voltage1":       r["voltage1"],
            "voltage2":       r["voltage2"],
            "voltage3":       r["voltage3"],
            "current1":       r["current1"],
            "current2":       r["current2"],
            "current3":       r["current3"],
            "location":       r["location"],
            "signal":         r["signal"],
            "last_service":   r["last_service"],
            "action":         r["action"],
            "ticket_id":      r["ticket_id"],
            "issue":          r["issue"],
            "priority":       r["priority"],
            "raised_by":      r["raised_by"],
            "resolution":     r["resolution"],
            "closed_by":      r["closed_by"],
            "duration":       r["duration"],
            "customer":       info,
            "created_at":     r["created_at"].isoformat() if r["created_at"] else None,
            "category_group": (
                "motor"       if cat in MOTOR_CATS  else
                "fault"       if cat in FAULT_CATS  else
                "power"       if cat in POWER_CATS  else
                "maintenance" if cat in MAINT_CATS  else
                "ticket"      if cat in TICKET_CATS else
                "other"
            ),
        })

    return {
        "total":     total,
        "page":      page,
        "page_size": page_size,
        "pages":     max(1, -(-total // page_size)),
        "summary":   summary,
        "logs":      logs,
    }


@router.get("/categories")
async def get_categories(
    credentials: HTTPAuthorizationCredentials = Depends(bearer),
    db:          AsyncSession = Depends(get_db),
    sensor_db:   AsyncSession = Depends(get_sensor_db),
):
    await check_perm(credentials.credentials, db)
    result = await sensor_db.execute(text("""
        SELECT DISTINCT event_category FROM event_logs
        WHERE event_category IS NOT NULL
        ORDER BY event_category
    """))
    return {"categories": [r["event_category"] for r in result.mappings().all()]}
