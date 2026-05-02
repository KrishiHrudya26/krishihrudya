from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from typing import Optional
from app.database import get_db, get_sensor_db
from app.services.auth_service import get_current_user
from app.models.role import RolePermission
from sqlalchemy import select

router = APIRouter(prefix="/analytics", tags=["Analytics"])
bearer  = HTTPBearer()


async def get_user(token: str, db: AsyncSession):
    user = await get_current_user(token, db)
    result = await db.execute(select(RolePermission).where(RolePermission.role_id == user.role_id))
    perms = result.scalar_one_or_none()
    if not perms or perms.analytics_access != 1:
        raise HTTPException(status_code=403, detail="Permission denied")
    return user


@router.get("/devices")
async def get_devices(
    credentials: HTTPAuthorizationCredentials = Depends(bearer),
    db: AsyncSession = Depends(get_db),
    sensor_db: AsyncSession = Depends(get_sensor_db),
):
    """Get list of devices available to this user for analytics."""
    user = await get_user(credentials.credentials, db)
    is_admin = getattr(user, 'bypass_org_scope', False)

    if is_admin:
        result = await db.execute(text("""
            SELECT DISTINCT CAST(i.product_uid AS TEXT) as uid,
                   i.pump_name, f.farm_name, c.cust_name
            FROM installations i
            JOIN farms f ON f.farm_id = i.farm_id
            LEFT JOIN customers c ON c.cust_id = f.customer_id
            WHERE i.product_uid IS NOT NULL
            ORDER BY uid
            LIMIT 100
        """))
    else:
        result = await db.execute(text("""
            SELECT DISTINCT CAST(i.product_uid AS TEXT) as uid,
                   i.pump_name, f.farm_name, c.cust_name
            FROM installations i
            JOIN farms f ON f.farm_id = i.farm_id
            LEFT JOIN customers c ON c.cust_id = f.customer_id
            WHERE CAST(f.user_id AS TEXT) = :uid
            AND i.product_uid IS NOT NULL
            ORDER BY uid
        """), {"uid": str(user.user_id)})

    rows = result.mappings().all()

    # Also get simulated devices from sensor DB
    sim_result = await sensor_db.execute(text("""
        SELECT DISTINCT CAST(uid AS TEXT) as uid, pump_name
        FROM starter_data
        ORDER BY uid
        LIMIT 50
    """))
    sim_rows = sim_result.mappings().all()

    # Merge — real devices first, then simulated
    devices = []
    seen = set()
    for r in rows:
        uid = r["uid"]
        if uid and uid not in seen:
            seen.add(uid)
            devices.append({
                "uid":       uid,
                "pump_name": r["pump_name"] or f"Pump {uid[-4:]}",
                "farm_name": r["farm_name"],
                "customer":  r["cust_name"],
            })
    for r in sim_rows:
        uid = r["uid"]
        if uid and uid not in seen:
            seen.add(uid)
            devices.append({
                "uid":       uid,
                "pump_name": r["pump_name"] or f"Sim Pump {uid[-4:]}",
                "farm_name": "Simulated",
                "customer":  "Simulator",
            })

    return {"devices": devices}


@router.get("/power")
async def get_power_analytics(
    uid:        str,
    range_days: int = Query(default=1, description="1=today, 7=week, 30=month, 0=custom"),
    start_date: Optional[str] = Query(default=None, description="YYYY-MM-DD"),
    end_date:   Optional[str] = Query(default=None, description="YYYY-MM-DD"),
    credentials: HTTPAuthorizationCredentials = Depends(bearer),
    db: AsyncSession = Depends(get_db),
    sensor_db: AsyncSession = Depends(get_sensor_db),
):
    await get_user(credentials.credentials, db)
    from datetime import datetime, timedelta

    if range_days == 0 and start_date and end_date:
        start = datetime.strptime(start_date, "%Y-%m-%d")
        end   = datetime.strptime(end_date,   "%Y-%m-%d")
        diff  = (end - start).days + 1  # inclusive

        end_exclusive = (end + timedelta(days=1)).date()
        time_filter   = f"captured_date >= '{start.date()}' AND captured_date < '{end_exclusive}'"

        if diff <= 1:
            group_expr = "date_trunc('hour', captured_date)"
            limit      = 24
            ts_format  = "%H:%M"
        elif diff <= 7:
            group_expr = "date_trunc('hour', captured_date)"
            limit      = diff * 24
            ts_format  = "%d/%m %H:%M"
        elif diff <= 31:
            group_expr = "date_trunc('day', captured_date)"
            limit      = diff
            ts_format  = "%d/%m"
        else:
            group_expr = "date_trunc('week', captured_date)"
            limit      = (diff // 7) + 1
            ts_format  = "%d/%m"

    elif range_days == 7:
        time_filter = "captured_date >= NOW() - INTERVAL '7 days'"
        group_expr  = "date_trunc('day', captured_date)"
        limit       = 7
        ts_format   = "%d/%m"

    elif range_days == 30:
        time_filter = "captured_date >= NOW() - INTERVAL '30 days'"
        group_expr  = "date_trunc('day', captured_date)"
        limit       = 30
        ts_format   = "%d/%m"

    else:  # Today
        time_filter = "captured_date >= NOW() - INTERVAL '1 day'"
        group_expr  = "date_trunc('hour', captured_date)"
        limit       = 24
        ts_format   = "%H:%M"

    result = await sensor_db.execute(text(f"""
        SELECT
            {group_expr}                        AS ts,
            AVG(voltage1)                       AS v1,
            AVG(voltage2)                       AS v2,
            AVG(voltage3)                       AS v3,
            AVG(current1)                       AS i1,
            AVG(current2)                       AS i2,
            AVG(current3)                       AS i3,
            SUM(
                (voltage1 * current1 +
                 voltage2 * current2 +
                 voltage3 * current3) / 1000.0
            )                                   AS apparent_power,
            AVG(signal_strength)                AS signal,
            COUNT(*)                            AS reading_count
        FROM starter_data
        WHERE CAST(uid AS TEXT) = :uid
        AND {time_filter}
        AND voltage1 IS NOT NULL
        GROUP BY {group_expr}
        ORDER BY ts ASC
        LIMIT :limit
    """), {"uid": uid, "limit": limit})

    rows = result.mappings().all()

    if not rows:
        return {"uid": uid, "range_days": range_days, "points": 0,
                "summary": {"avg_voltage_v": 0, "avg_current_a": 0, "avg_power_kva": 0, "max_power_kva": 0},
                "voltage": [], "current": [], "apparent_power": []}

    voltage_data        = []
    current_data        = []
    apparent_power_data = []

    for r in rows:
        ts = r["ts"].strftime(ts_format) if r["ts"] else ""
        voltage_data.append({"time": ts, "V1": round(float(r["v1"] or 0), 1), "V2": round(float(r["v2"] or 0), 1), "V3": round(float(r["v3"] or 0), 1)})
        current_data.append({"time": ts, "I1": round(float(r["i1"] or 0), 2), "I2": round(float(r["i2"] or 0), 2), "I3": round(float(r["i3"] or 0), 2)})
        apparent_power_data.append({"time": ts, "kVA": round(float(r["apparent_power"] or 0), 3)})

    all_v = [r for r in rows if r["v1"]]
    all_i = [r for r in rows if r["i1"]]

    avg_voltage = round(sum((float(r["v1"]) + float(r["v2"]) + float(r["v3"])) / 3 for r in all_v) / len(all_v), 1) if all_v else 0
    avg_current = round(sum((float(r["i1"]) + float(r["i2"]) + float(r["i3"])) / 3 for r in all_i) / len(all_i), 1) if all_i else 0
    max_power   = round(max(float(r["apparent_power"] or 0) for r in rows), 3) if rows else 0
    avg_power   = round(sum(float(r["apparent_power"] or 0) for r in rows) / len(rows), 3) if rows else 0

    return {
        "uid": uid, "range_days": range_days, "points": len(rows),
        "summary": {"avg_voltage_v": avg_voltage, "avg_current_a": avg_current, "avg_power_kva": avg_power, "max_power_kva": max_power},
        "voltage": voltage_data, "current": current_data, "apparent_power": apparent_power_data,
    }


@router.get("/water")
async def get_water_analytics(
    uid:        str,
    range_days: int = Query(default=1, description="1=today, 7=week, 30=month, 0=custom"),
    start_date: Optional[str] = Query(default=None, description="YYYY-MM-DD"),
    end_date:   Optional[str] = Query(default=None, description="YYYY-MM-DD"),
    credentials: HTTPAuthorizationCredentials = Depends(bearer),
    db: AsyncSession = Depends(get_db),
    sensor_db: AsyncSession = Depends(get_sensor_db),
):
    await get_user(credentials.credentials, db)
    from datetime import datetime, timedelta

    if range_days == 0 and start_date and end_date:
        start = datetime.strptime(start_date, "%Y-%m-%d")
        end   = datetime.strptime(end_date,   "%Y-%m-%d")
        diff  = (end - start).days + 1
        end_exclusive = (end + timedelta(days=1)).date()
        time_filter_stat = f"created_at >= '{start.date()}' AND created_at < '{end_exclusive}'"
        time_filter_data = f"captured_date >= '{start.date()}' AND captured_date < '{end_exclusive}'"
        if diff <= 1:
            group_stat = "date_trunc('hour', created_at)"
            group_data = "date_trunc('hour', captured_date)"
            limit      = 24
            ts_format  = "%H:%M"
        elif diff <= 7:
            group_stat = "date_trunc('hour', created_at)"
            group_data = "date_trunc('hour', captured_date)"
            limit      = diff * 24
            ts_format  = "%d/%m %H:%M"
        elif diff <= 31:
            group_stat = "date_trunc('day', created_at)"
            group_data = "date_trunc('day', captured_date)"
            limit      = diff
            ts_format  = "%d/%m"
        else:
            group_stat = "date_trunc('week', created_at)"
            group_data = "date_trunc('week', captured_date)"
            limit      = (diff // 7) + 1
            ts_format  = "%d/%m"
    elif range_days == 7:
        time_filter_stat = "created_at >= NOW() - INTERVAL '7 days'"
        time_filter_data = "captured_date >= NOW() - INTERVAL '7 days'"
        group_stat = "date_trunc('day', created_at)"
        group_data = "date_trunc('day', captured_date)"
        limit      = 7
        ts_format  = "%d/%m"
    elif range_days == 30:
        time_filter_stat = "created_at >= NOW() - INTERVAL '30 days'"
        time_filter_data = "captured_date >= NOW() - INTERVAL '30 days'"
        group_stat = "date_trunc('day', created_at)"
        group_data = "date_trunc('day', captured_date)"
        limit      = 30
        ts_format  = "%d/%m"
    else:  # Today
        time_filter_stat = "created_at >= NOW() - INTERVAL '1 day'"
        time_filter_data = "captured_date >= NOW() - INTERVAL '1 day'"
        group_stat = "date_trunc('hour', created_at)"
        group_data = "date_trunc('hour', captured_date)"
        limit      = 24
        ts_format  = "%H:%M"

    # Query starter_statistics for yield, utilization, water level
    stat_result = await sensor_db.execute(text(f"""
        SELECT
            {group_stat}                                        AS ts,
            SUM(day_water_yield)                               AS water_yield,
            AVG(actual_water_level_in_feet)                    AS water_level,
            AVG(
                CASE
                    WHEN total_power_available_time_for_the_day > 0
                    THEN (total_run_time_for_the_day::float /
                          total_power_available_time_for_the_day::float) * 100
                    ELSE 0
                END
            )                                                  AS utilization
        FROM starter_statistics
        WHERE CAST(uid AS TEXT) = :uid
        AND {time_filter_stat}
        GROUP BY {group_stat}
        ORDER BY ts ASC
        LIMIT :limit
    """), {"uid": uid, "limit": limit})
    stat_rows = stat_result.mappings().all()

    # Query starter_data for time_to_surface
    surf_result = await sensor_db.execute(text(f"""
        SELECT
            {group_data}                AS ts,
            AVG(time_to_surface)        AS time_to_surface
        FROM starter_data
        WHERE CAST(uid AS TEXT) = :uid
        AND {time_filter_data}
        AND time_to_surface IS NOT NULL
        GROUP BY {group_data}
        ORDER BY ts ASC
        LIMIT :limit
    """), {"uid": uid, "limit": limit})
    surf_rows = surf_result.mappings().all()

    # Build surface map for merging
    surf_map = {}
    for r in surf_rows:
        if r["ts"]:
            key = r["ts"].strftime(ts_format)
            surf_map[key] = round(float(r["time_to_surface"] or 0), 1)

    if not stat_rows:
        return {"uid": uid, "range_days": range_days, "points": 0,
                "summary": {"total_yield_liters": 0, "avg_utilization_pct": 0, "avg_water_level_ft": 0, "avg_time_to_surface_s": 0},
                "water_yield": [], "utilization": [], "water_level": [], "time_to_surface": []}

    water_yield_data  = []
    utilization_data  = []
    water_level_data  = []
    time_surface_data = []

    for r in stat_rows:
        ts = r["ts"].strftime(ts_format) if r["ts"] else ""
        water_yield_data.append({"time": ts, "Liters": round(float(r["water_yield"] or 0), 1)})
        utilization_data.append({"time": ts, "Utilization": round(float(r["utilization"] or 0), 1)})
        water_level_data.append({"time": ts, "Feet": round(float(r["water_level"] or 0), 1)})
        time_surface_data.append({"time": ts, "Seconds": surf_map.get(ts, 0)})

    # Summary
    total_yield   = round(sum(float(r["water_yield"]  or 0) for r in stat_rows), 1)
    avg_util      = round(sum(float(r["utilization"]  or 0) for r in stat_rows) / len(stat_rows), 1)
    avg_level     = round(sum(float(r["water_level"]  or 0) for r in stat_rows) / len(stat_rows), 1)
    avg_surface   = round(sum(v for v in surf_map.values()) / len(surf_map), 1) if surf_map else 0

    return {
        "uid": uid, "range_days": range_days, "points": len(stat_rows),
        "summary": {
            "total_yield_liters":    total_yield,
            "avg_utilization_pct":   avg_util,
            "avg_water_level_ft":    avg_level,
            "avg_time_to_surface_s": avg_surface,
        },
        "water_yield":    water_yield_data,
        "utilization":    utilization_data,
        "water_level":    water_level_data,
        "time_to_surface": time_surface_data,
    }
