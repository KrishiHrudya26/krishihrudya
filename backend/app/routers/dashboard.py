from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from app.database import get_db, get_sensor_db
from app.services.auth_service import get_current_user
from app.models.role import RolePermission
from sqlalchemy import select

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])
bearer = HTTPBearer()


async def get_user_and_perms(token: str, db: AsyncSession):
    user = await get_current_user(token, db)
    result = await db.execute(select(RolePermission).where(RolePermission.role_id == user.role_id))
    perms = result.scalar_one_or_none()
    return user, perms


@router.get("/products")
async def product_statistics(
    credentials: HTTPAuthorizationCredentials = Depends(bearer),
    db: AsyncSession = Depends(get_db),
):
    user, perms = await get_user_and_perms(credentials.credentials, db)
    if not perms or perms.dashboard_access != 1:
        raise HTTPException(status_code=403, detail="Permission denied")

    total = await db.execute(text("SELECT COUNT(*) FROM products"))
    total_count = total.scalar()
    active = await db.execute(text("SELECT COUNT(*) FROM products WHERE status = 'active'"))
    inactive = await db.execute(text("SELECT COUNT(*) FROM products WHERE status = 'inactive' OR status IS NULL OR status NOT IN ('active')"))
    assigned = await db.execute(text("""
        SELECT COUNT(DISTINCT p.product_id) FROM products p
        INNER JOIN installations i ON CAST(i.uid AS TEXT) = CAST(p.uid AS TEXT)
    """))
    assigned_count = assigned.scalar()
    unassigned_count = total_count - assigned_count
    test_passed = await db.execute(text("SELECT COUNT(*) FROM products WHERE test_status = 'passed'"))
    test_failed = await db.execute(text("SELECT COUNT(*) FROM products WHERE test_status = 'failed'"))
    test_pending = await db.execute(text("SELECT COUNT(*) FROM products WHERE test_status = 'pending' OR test_status IS NULL"))
    total_installs = await db.execute(text("SELECT COUNT(*) FROM installations"))
    today_installs = await db.execute(text("SELECT COUNT(*) FROM installations WHERE installation_date >= CURRENT_DATE"))
    week_installs = await db.execute(text("SELECT COUNT(*) FROM installations WHERE installation_date >= CURRENT_DATE - INTERVAL '7 days'"))

    return {
        "products": {"total": total_count, "active": active.scalar(), "inactive": inactive.scalar(), "assigned": assigned_count, "unassigned": unassigned_count},
        "test_status": {"passed": test_passed.scalar(), "failed": test_failed.scalar(), "pending": test_pending.scalar()},
        "installations": {"total": total_installs.scalar(), "today": today_installs.scalar(), "week": week_installs.scalar()}
    }


@router.get("/customer")
async def customer_statistics(
    credentials: HTTPAuthorizationCredentials = Depends(bearer),
    db: AsyncSession = Depends(get_db),
    sensor_db: AsyncSession = Depends(get_sensor_db),
):
    user, perms = await get_user_and_perms(credentials.credentials, db)
    if not perms or perms.dashboard_access != 1:
        raise HTTPException(status_code=403, detail="Permission denied")

    is_admin = getattr(user, 'bypass_org_scope', False)
    user_filter = "" if is_admin else f"WHERE user_id = '{user.user_id}'"

    farms_result = await db.execute(text(f"SELECT COUNT(*) FROM farms {user_filter}"))
    total_farms = farms_result.scalar()

    devices_result = await db.execute(text(f"SELECT COUNT(*) FROM borewell {user_filter}"))
    total_devices = devices_result.scalar()

    uid_result = await db.execute(text(f"SELECT CAST(uid AS TEXT) as uid FROM borewell {user_filter}"))
    uids = [r["uid"] for r in uid_result.mappings().all()]

    if not uids:
        return _empty_stats(total_farms, total_devices)

    uid_list = ",".join([f"'{u}'" for u in uids])

    latest_result = await sensor_db.execute(text(f"""
        SELECT DISTINCT ON (uid)
            uid, motor_state, power_available, device_state,
            total_run_time, signal_strength, device_mode, captured_date
        FROM starter_data
        WHERE uid IN ({uid_list})
        ORDER BY uid, captured_date DESC
    """))
    latest_rows = latest_result.mappings().all()

    stats_result = await sensor_db.execute(text(f"""
        SELECT DISTINCT ON (uid)
            uid, total_run_time_for_the_day, total_power_available_time_for_the_day,
            day_water_yield, total_on_off_cycles, total_overload_trips,
            total_underload_trips, last_sync_time
        FROM starter_statistics
        WHERE uid IN ({uid_list})
        ORDER BY uid, created_at DESC
    """))
    stats_map = {r["uid"]: r for r in stats_result.mappings().all()}

    settings_result = await sensor_db.execute(text(f"SELECT uid, auto_manual FROM starter_settings WHERE uid IN ({uid_list})"))
    settings_map = {r["uid"]: r for r in settings_result.mappings().all()}

    # OEE data
    farm_id_result = await db.execute(text(f"""
        SELECT CAST(farm_id AS TEXT) FROM farms
        WHERE CAST(user_id AS TEXT) = '{str(user.user_id)}'
    """))
    farm_ids = [r[0] for r in farm_id_result.fetchall()]

    oee_rows = []
    if farm_ids:
        farm_ids_str = ",".join([f"'{f}'" for f in farm_ids])
        try:
            oee_result = await sensor_db.execute(text(f"""
                SELECT
                    CAST(farm_id AS TEXT) as farm_id,
                    AVG(availability_ratio) as availability,
                    AVG(power_usage_efficiency) as performance,
                    AVG(water_efficiency_ratio) as quality,
                    SUM(overload_trip_count) as overload_trips,
                    SUM(underload_trip_count) as underload_trips,
                    SUM(dry_run_trip_count) as dry_run_trips,
                    SUM(unexpected_shutdowns) as shutdowns
                FROM oee
                WHERE CAST(farm_id AS TEXT) IN ({farm_ids_str})
                GROUP BY farm_id
            """))
            oee_rows = oee_result.mappings().all()
        except Exception as e:
            print(f"OEE query error: {e}")
            oee_rows = []

    # Compute aggregates
    running = stopped = overload = underload = idle = 0
    active_devices = inactive_devices = 0
    power_available_time = run_time = 0.0
    auto_count = manual_count = 0
    total_cycles = 0
    overload_trips = underload_trips = dry_run_trips = phase_faults = 0
    avg_runtimes = []
    fault_count = 0
    signal_scores = []

    now_threshold = 30 * 60

    for row in latest_rows:
        if row["captured_date"]:
            from datetime import datetime, timezone
            last = row["captured_date"]
            if hasattr(last, 'tzinfo') and last.tzinfo:
                diff = (datetime.now(timezone.utc) - last).total_seconds()
            else:
                diff = (datetime.utcnow() - last).total_seconds()
            if diff < now_threshold:
                active_devices += 1
            else:
                inactive_devices += 1
        else:
            inactive_devices += 1

        uid = row["uid"]
        motor = row["motor_state"]
        power = row["power_available"]
        state = row["device_state"]

        if motor:
            running += 1
        elif state in [7]:
            overload += 1
            fault_count += 1
        elif state in [8]:
            underload += 1
            fault_count += 1
        elif power:
            stopped += 1
        else:
            idle += 1

        if row["signal_strength"]:
            signal_scores.append(float(row["signal_strength"]))

        s = settings_map.get(uid)
        if s:
            if s["auto_manual"]:
                auto_count += 1
            else:
                manual_count += 1

        st = stats_map.get(uid)
        if st:
            run_time             += float(st["total_run_time_for_the_day"] or 0)
            power_available_time += float(st["total_power_available_time_for_the_day"] or 0)
            total_cycles         += int(st["total_on_off_cycles"] or 0)
            overload_trips       += int(st["total_overload_trips"] or 0)
            underload_trips      += int(st["total_underload_trips"] or 0)
            rt = float(st["total_run_time_for_the_day"] or 0)
            if rt > 0:
                avg_runtimes.append(rt)

    idle_time = max(0, power_available_time - run_time)
    total_mode = auto_count + manual_count
    auto_pct   = round(auto_count / total_mode * 100, 1) if total_mode else 0
    manual_pct = round(manual_count / total_mode * 100, 1) if total_mode else 0

    oee_avg = availability_avg = quality_avg = performance_avg = None
    if oee_rows:
        avail_list = [float(r["availability"] or 0) for r in oee_rows if r["availability"]]
        perf_list  = [float(r["performance"]   or 0) for r in oee_rows if r["performance"]]
        qual_list  = [float(r["quality"]        or 0) for r in oee_rows if r["quality"]]
        availability_avg = round(sum(avail_list) / len(avail_list), 1) if avail_list else None
        performance_avg  = round(sum(perf_list)  / len(perf_list),  1) if perf_list  else None
        quality_avg      = round(sum(qual_list)  / len(qual_list),  1) if qual_list  else None
        oee_avg = round(((availability_avg or 0) + (performance_avg or 0) + (quality_avg or 0)) / 3, 1) if avail_list else None

    total_d = len(latest_rows)
    good     = total_d - fault_count
    critical = fault_count
    avg_signal  = round(sum(signal_scores) / len(signal_scores), 1) if signal_scores else None
    reliability = round((good / total_d) * 100, 1) if total_d else None
    avg_run     = round(sum(avg_runtimes) / len(avg_runtimes), 1) if avg_runtimes else 0

    return {
        "farms":        {"total_farms": total_farms, "total_devices": total_devices, "active_devices": active_devices, "inactive_devices": inactive_devices},
        "device_state": {"running": running, "stopped": stopped, "overload": overload, "underload": underload, "idle": idle},
        "power":        {"available_time_minutes": round(power_available_time, 1), "run_time_minutes": round(run_time, 1), "idle_time_minutes": round(idle_time, 1)},
        "mode":         {"auto_count": auto_count, "manual_count": manual_count, "auto_pct": auto_pct, "manual_pct": manual_pct},
        "performance":  {"oee_score": oee_avg, "quality": quality_avg, "availability": availability_avg, "performance": performance_avg},
        "device_health":{"good": good, "warning": 0, "critical": critical, "fault_count": fault_count, "reliability_score": reliability, "avg_signal": avg_signal},
        "alerts":       {"overload_trips": overload_trips, "underload_trips": underload_trips, "dry_run_trips": dry_run_trips, "phase_faults": phase_faults},
        "usage":        {"total_on_off_cycles": total_cycles, "avg_run_time_minutes": avg_run, "rest_time_minutes": round(idle_time, 1)},
    }


def _empty_stats(total_farms, total_devices):
    return {
        "farms":        {"total_farms": total_farms, "total_devices": total_devices, "active_devices": 0, "inactive_devices": 0},
        "device_state": {"running": 0, "stopped": 0, "overload": 0, "underload": 0, "idle": 0},
        "power":        {"available_time_minutes": 0, "run_time_minutes": 0, "idle_time_minutes": 0},
        "mode":         {"auto_count": 0, "manual_count": 0, "auto_pct": 0, "manual_pct": 0},
        "performance":  {"oee_score": None, "quality": None, "availability": None, "performance": None},
        "device_health":{"good": 0, "warning": 0, "critical": 0, "fault_count": 0, "reliability_score": None, "avg_signal": None},
        "alerts":       {"overload_trips": 0, "underload_trips": 0, "dry_run_trips": 0, "phase_faults": 0},
        "usage":        {"total_on_off_cycles": 0, "avg_run_time_minutes": 0, "rest_time_minutes": 0},
    }
