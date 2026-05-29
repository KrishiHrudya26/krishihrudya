"""
/var/www/krishihrudya/backend/app/routers/borewell.py

Uses same depth calculation logic as bw_cron.py:
  - derive_water_depth() per reading using motor_start_va + peak_motor_va
  - compute_qd_qr_from_depth() for Qd/Qr from actual depth values
  - compute_water_level_series_from_db() for water level trend graph
  - Falls back to AP-ratio method if no depth data available
"""
import json
import os
from datetime import datetime, timedelta

import aiomysql
from fastapi import APIRouter, HTTPException
from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker

import sys
from dotenv import load_dotenv
load_dotenv("/var/www/krishihrudya/backend/.env")
sys.path.append("/var/www/krishihrudya/borewell_intelligence")
from calculations import (
    derive_water_depth, detect_cycles, get_depth_for_hp,
    borewell_lpm_rated, compute_qd_qr_from_depth, compute_qd_qr,
    compute_water_level_series_from_db, compute_water_level_series,
    compute_health_score, compute_schedule, parse_sessions,
    compute_rest_periods, clean_ap_series, SWL_RATIO,
)

router = APIRouter(prefix="/borewell", tags=["Borewell Intelligence"])

LEGACY_CFG = {
    "host":     os.getenv("LEGACY_DB_HOST", "69.62.81.58"),
    "port":     int(os.getenv("LEGACY_DB_PORT", "3306")),
    "db":       os.getenv("LEGACY_DB_NAME",  "khprojectscp_khprojectsdb_25"),
    "user":     os.getenv("LEGACY_DB_USER",  "khprojectscp_khreadonly"),
    "password": os.getenv("LEGACY_DB_PASSWORD", ""),
}

async def get_legacy_conn():
    return await aiomysql.connect(**LEGACY_CFG, charset="utf8mb4", autocommit=True)

BI_DB_URL = (
    f"postgresql+asyncpg://"
    f"{os.getenv('DB_USER','khuser')}:{os.getenv('DB_PASSWORD','KHdb%4026')}"
    f"@localhost:5432/borewell_intelligence"
)
bi_engine = create_async_engine(BI_DB_URL, echo=False)
BiSession  = sessionmaker(bi_engine, class_=AsyncSession, expire_on_commit=False)

CYCLE_GAP_MIN = 15.0


def _has_depth_data(rows: list) -> bool:
    return any(
        r.get("actual_borewell_depth") and
        float(r.get("actual_borewell_depth") or 0) > 0
        for r in rows
    )


def _compute_depth_on_fly(ap_rows: list, motor_hp: float,
                           full_static_depth: float) -> list:
    """
    Compute actual_borewell_depth and cycle_static_depth on-the-fly
    using same logic as bw_cron.py — for UIDs not yet processed by cron.
    """
    depth_ft     = get_depth_for_hp(motor_hp)
    min_credible = int(motor_hp * 80)
    peak_va      = 0
    cycles       = detect_cycles(ap_rows, gap_minutes=CYCLE_GAP_MIN)
    enriched     = []

    for cycle in cycles:
        rows = cycle["rows"]
        motor_start_va = 0
        for r in rows:
            try:
                ap_val = int(float(r["apparent_power"] or 0))
            except (ValueError, TypeError):
                continue
            if ap_val >= min_credible:
                motor_start_va = ap_val
                break
        if motor_start_va == 0 and rows:
            try:
                motor_start_va = int(float(rows[0]["apparent_power"] or 0))
            except (ValueError, TypeError):
                motor_start_va = 0
        if motor_start_va > peak_va:
            peak_va = motor_start_va
        effective_peak = peak_va if peak_va >= min_credible else motor_start_va

        for r in rows:
            try:
                ap_val = float(r["apparent_power"] or 0)
            except (ValueError, TypeError):
                continue
            if ap_val <= 0:
                continue
            try:
                v1 = float(r.get("voltage1") or 0)
                v2 = float(r.get("voltage2") or 0)
                v3 = float(r.get("voltage3") or 0)
                v_avg = (v1+v2+v3)/3.0 if (v1+v2+v3) > 0 else 230.0
            except (ValueError, TypeError):
                v_avg = 230.0
            try:
                i1 = float(r.get("current1") or 0)
                i2 = float(r.get("current2") or 0)
                i3 = float(r.get("current3") or 0)
                i_avg = (i1+i2+i3)/3.0
                phase_imbalance = (
                    max(abs(i1-i_avg), abs(i2-i_avg), abs(i3-i_avg)) / i_avg * 100.0
                    if i_avg > 0 else 0.0
                )
            except (ValueError, TypeError):
                phase_imbalance = 0.0

            dynamic_depth, cycle_static = derive_water_depth(
                apparent_power=ap_val, motor_start_va=motor_start_va,
                peak_motor_va=effective_peak, motor_hp=motor_hp,
                borewell_depth=depth_ft, full_static_depth=full_static_depth,
                v_avg=v_avg, phase_imbalance=phase_imbalance,
            )
            enriched.append({
                **r,
                "actual_borewell_depth": str(round(dynamic_depth, 1)),
                "cycle_static_depth":    round(cycle_static, 2),
            })
    return enriched


# ── 1. Wards ──────────────────────────────────────────────────────────────────
@router.get("/wards")
async def get_wards():
    conn = await get_legacy_conn()
    try:
        async with conn.cursor(aiomysql.DictCursor) as cur:
            await cur.execute("""
                SELECT id, farm_name FROM farms
                WHERE farm_name NOT LIKE '%My Farm%'
                  AND farm_name NOT LIKE '%Test%'
                  AND farm_name NOT LIKE '%test%'
                ORDER BY farm_name ASC
            """)
            rows = await cur.fetchall()
        return {"wards": rows}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        conn.close()


# ── 2. UIDs ───────────────────────────────────────────────────────────────────
@router.get("/uids/{farm_id}")
async def get_uids(farm_id: int):
    conn = await get_legacy_conn()
    try:
        async with conn.cursor(aiomysql.DictCursor) as cur:
            await cur.execute("""
                SELECT CAST(i.uid AS CHAR) AS uid, i.installation_date,
                       b.motor_hp, b.borewell_depth, b.latitude, b.longitude
                FROM installations i
                LEFT JOIN borewell b ON b.uid = i.uid
                WHERE i.farm_id = %s
                ORDER BY i.uid ASC
            """, (farm_id,))
            rows = await cur.fetchall()
        return {"uids": rows}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        conn.close()


# ── 3. Pump name ──────────────────────────────────────────────────────────────
@router.get("/pump-name/{uid}")
async def get_pump_name(uid: str):
    conn = await get_legacy_conn()
    try:
        async with conn.cursor(aiomysql.DictCursor) as cur:
            await cur.execute(
                "SELECT pump_name FROM starter_data WHERE uid = %s "
                "ORDER BY captured_date DESC LIMIT 1", (uid,)
            )
            row = await cur.fetchone()
        return {"pump_name": row["pump_name"] if row and row["pump_name"] else "—"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        conn.close()


# ── 4. Health ─────────────────────────────────────────────────────────────────
@router.get("/health/{uid}")
async def get_health(uid: str, farm_id: int):
    three_months_ago = (datetime.now() - timedelta(days=90)).strftime("%Y-%m-%d")

    # Fetch AP rows first — needed for depth computation and water level series
    conn = await get_legacy_conn()
    try:
        async with conn.cursor(aiomysql.DictCursor) as cur:
            await cur.execute("""
                SELECT id, apparent_power,
                       voltage1, voltage2, voltage3,
                       current1, current2, current3,
                       actual_borewell_depth, cycle_static_depth,
                       created_at
                FROM chart_power_analytics
                WHERE uid = %s AND created_at >= %s
                  AND apparent_power IS NOT NULL AND apparent_power != ''
                ORDER BY created_at ASC
            """, (uid, three_months_ago))
            power_rows = list(await cur.fetchall())
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Legacy DB error: {str(e)}")
    finally:
        conn.close()

    # Check cache
    async with BiSession() as sess:
        result = await sess.execute(
            text("SELECT * FROM bw_health_cache WHERE uid = :uid"), {"uid": uid}
        )
        cached = result.mappings().first()
        if cached:
            cached_data = dict(cached)
            # Still compute fresh water level series
            motor_hp          = float(cached_data.get("motor_hp") or 12.5)
            depth_ft          = get_depth_for_hp(motor_hp)
            full_static_depth = round(depth_ft * SWL_RATIO, 1)

            if _has_depth_data(power_rows):
                water_level_series = compute_water_level_series_from_db(power_rows)
            else:
                enriched = _compute_depth_on_fly(power_rows, motor_hp, full_static_depth)
                water_level_series = compute_water_level_series_from_db(enriched) if enriched else []

            cached_data["water_level_series"] = water_level_series
            cached_data["static_depth_ft"]    = full_static_depth
            cached_data["borewell_depth"]      = depth_ft
            cached_data["motor_depth_ft"]      = round(depth_ft - 100.0, 1)
            cached_data["usable_col_m"]        = round((depth_ft - 100.0 - full_static_depth) / 3.281, 1)
            cached_data["safe_draw_m"]         = round(cached_data["usable_col_m"] * 0.70, 1)
            cached_data["rated_lpm"]           = round(borewell_lpm_rated(motor_hp, depth_ft), 1)
            return {"source": "cache", "data": cached_data}

    # Fresh compute
    conn = await get_legacy_conn()
    try:
        async with conn.cursor(aiomysql.DictCursor) as cur:
            await cur.execute(
                "SELECT motor_hp, borewell_depth, latitude, longitude, farm_id "
                "FROM borewell WHERE uid = %s LIMIT 1", (uid,)
            )
            bw = await cur.fetchone() or {}

            await cur.execute(
                "SELECT farm_name FROM farms WHERE id = %s LIMIT 1",
                (bw.get("farm_id", farm_id),)
            )
            farm_row  = await cur.fetchone() or {}
            ward_name = farm_row.get("farm_name", "")

            await cur.execute("""
                SELECT total_runtime, water_yield, created_at
                FROM chart_utilization
                WHERE uid = %s AND created_at >= %s ORDER BY created_at ASC
            """, (uid, three_months_ago))
            runtime_rows = list(await cur.fetchall())

            await cur.execute("""
                SELECT message, created_at FROM event_logs
                WHERE uid = %s AND created_at >= %s
                  AND (message LIKE '%%Motor started%%' OR message LIKE '%%Motor stopped%%')
                ORDER BY created_at ASC
            """, (uid, three_months_ago))
            event_rows = list(await cur.fetchall())

            await cur.execute("""
                SELECT total_on_off_cycles, total_overload_trips, total_underload_trips
                FROM starter_statistics WHERE uid = %s
                ORDER BY created_at DESC LIMIT 1
            """, (uid,))
            stats_row = await cur.fetchone() or {}

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Legacy DB error: {str(e)}")
    finally:
        conn.close()

    # Geometry
    motor_hp          = float(bw.get("motor_hp") or 12.5)
    depth_ft          = get_depth_for_hp(motor_hp)
    motor_depth_ft    = depth_ft - 100.0
    rated_lpm         = borewell_lpm_rated(motor_hp, depth_ft)
    full_static_depth = round(depth_ft * SWL_RATIO, 1)
    usable_col_ft     = motor_depth_ft - full_static_depth
    usable_col_m      = round(usable_col_ft / 3.281, 1)
    safe_draw_m       = round(usable_col_m * 0.70, 1)
    latitude          = float(bw.get("latitude") or 0)
    longitude         = float(bw.get("longitude") or 0)

    # If cron has already computed depths, use them — else compute on-the-fly
    if _has_depth_data(power_rows):
        depth_rows = power_rows
    else:
        depth_rows = _compute_depth_on_fly(power_rows, motor_hp, full_static_depth)

    # Water level series
    water_level_series = compute_water_level_series_from_db(depth_rows) if depth_rows else []

    # Qd/Qr from depth data
    if depth_rows:
        aquifer = compute_qd_qr_from_depth(depth_rows, CYCLE_GAP_MIN)
    else:
        swl_ref_ft = round(full_static_depth)
        aquifer    = compute_qd_qr([], power_rows, swl_ref_ft, motor_depth_ft, motor_hp=motor_hp)

    qd_m_hr     = aquifer["qd_m_hr"]
    qr_m_hr     = aquifer["qr_m_hr"]
    ratio_qr_qd = aquifer["ratio_qr_qd"]

    # AP stats (in kW)
    power_vals_kw = [float(r["apparent_power"]) / 1000.0
                     for r in power_rows if r.get("apparent_power")
                     and float(r.get("apparent_power") or 0) > 0]
    clean_kw  = clean_ap_series(power_vals_kw)
    avg_ap_kw = round(sum(clean_kw)/len(clean_kw), 3) if clean_kw else 0.0
    sorted_kw = sorted(clean_kw)
    peak_ap_kw = round(sorted_kw[max(0, int(len(sorted_kw)*0.95)-1)], 3) if sorted_kw else 0.0

    # Runtime
    runtime_vals      = [float(r["total_runtime"]) for r in runtime_rows
                         if r.get("total_runtime") and float(r["total_runtime"]) > 0]
    avg_daily_runtime = round(sum(runtime_vals)/len(runtime_vals), 1) if runtime_vals else 0.0
    total_runtime     = round(sum(runtime_vals), 1)
    days_with_data    = len(runtime_vals)
    total_yield       = round(avg_daily_runtime * rated_lpm * days_with_data)

    # Sessions
    sessions         = parse_sessions(event_rows)
    rest_periods     = compute_rest_periods(sessions)
    on_off_cycles    = len(sessions)
    dry_run_trips    = sum(1 for s in sessions if s["stop_reason"] == "dry_run")
    power_fail_trips = sum(1 for s in sessions if s["stop_reason"] == "power_failure")
    avg_session_min  = (sum(s["duration_min"] for s in sessions)/len(sessions)
                        if sessions else 0.0)
    avg_rest_min     = (sum(rest_periods)/len(rest_periods)
                        if rest_periods else avg_session_min * 1.5)

    # Qd/Qr fallbacks
    if qd_m_hr == 0 and safe_draw_m > 0:
        proxy_min = max(avg_session_min if avg_session_min > 0
                        else avg_daily_runtime/3 if avg_daily_runtime > 0 else 60.0, 5.0)
        qd_m_hr   = round(safe_draw_m/(proxy_min/60.0), 2)
    if qr_m_hr == 0 and qd_m_hr > 0:
        qr_m_hr = round(safe_draw_m/(max(avg_rest_min if avg_rest_min > 0 else 90.0, 5.0)/60.0), 2)
    qr_m_hr = min(qr_m_hr, qd_m_hr)
    if qd_m_hr > 0:
        ratio_qr_qd = round(qr_m_hr/qd_m_hr, 2)

    # Schedule params
    safe_pump_min = (max(20, min(120, round((safe_draw_m/qd_m_hr)*60))) if qd_m_hr > 0
                     else max(20, min(120, round(avg_session_min or 60))))
    recovery_min  = (max(safe_pump_min, min(480, round((safe_draw_m/qr_m_hr)*60))) if qr_m_hr > 0
                     else safe_pump_min * 2)

    # Health score
    health = compute_health_score(
        sessions=sessions, qd_m_hr=qd_m_hr, qr_m_hr=qr_m_hr,
        ratio_qr_qd=ratio_qr_qd, avg_apparent_power_kw=avg_ap_kw,
        motor_hp=motor_hp, dry_run_trips=dry_run_trips,
        power_fail_trips=power_fail_trips,
        avg_daily_runtime_min=avg_daily_runtime, usable_col_m=usable_col_m,
        estimated_lpm=rated_lpm, total_days_in_range=max(1, days_with_data),
    )

    # Stats
    total_on_off_cycles   = int(stats_row.get("total_on_off_cycles")   or 0)
    total_overload_trips  = int(stats_row.get("total_overload_trips")  or 0)
    total_underload_trips = int(stats_row.get("total_underload_trips") or 0)

    # Dates
    all_dates = [r["created_at"] for r in list(power_rows)+list(runtime_rows)
                 if r.get("created_at")]
    data_from = min(all_dates) if all_dates else None
    data_to   = max(all_dates) if all_dates else None

    def to_dt(v):
        if v is None: return None
        return v if isinstance(v, datetime) else datetime.fromisoformat(str(v))

    payload = {
        "uid": uid, "farm_id": farm_id, "ward_name": ward_name,
        "motor_hp": motor_hp, "borewell_depth": depth_ft,
        "motor_depth_ft": round(motor_depth_ft, 1),
        "static_depth_ft": full_static_depth,
        "swl_ref_ft": round(full_static_depth),
        "rated_lpm": round(rated_lpm, 1),
        "usable_col_ft": round(usable_col_ft, 1),
        "usable_col_m": usable_col_m,
        "safe_draw_m": safe_draw_m,
        "latitude": latitude, "longitude": longitude,
        "avg_apparent_power_w":  avg_ap_kw,
        "max_apparent_power_w":  peak_ap_kw,
        "avg_daily_runtime_min": avg_daily_runtime,
        "total_runtime_min":     total_runtime,
        "days_with_data":        days_with_data,
        "total_sessions":        on_off_cycles,
        "avg_session_dur_min":   health["avg_session_dur_min"],
        "avg_rest_dur_min":      avg_rest_min,
        "on_off_cycles":         on_off_cycles,
        "dry_run_trips":         dry_run_trips,
        "power_fail_trips":      power_fail_trips,
        "total_water_yield_l":   total_yield,
        "total_on_off_cycles":   total_on_off_cycles,
        "total_overload_trips":  total_overload_trips,
        "total_underload_trips": total_underload_trips,
        "qd_m_hr": qd_m_hr, "qr_m_hr": qr_m_hr, "ratio_qr_qd": ratio_qr_qd,
        "safe_pump_min": safe_pump_min, "recovery_min": recovery_min,
        "health_score":         health["health_score"],
        "health_rating":        health["health_rating"],
        "recharge_ratio":       ratio_qr_qd,
        "motor_efficiency_pct": health["motor_efficiency_pct"],
        "depletion_risk_pct":   health["depletion_risk_pct"],
        "estimated_lpm":        rated_lpm,
        "water_level_series":   water_level_series,
        "data_from":  to_dt(data_from),
        "data_to":    to_dt(data_to),
        "computed_at": datetime.now(),
    }

    # Cache scalar fields
    async with BiSession() as sess:
        await sess.execute(text("""
            INSERT INTO bw_health_cache (
                uid, farm_id, ward_name, motor_hp, borewell_depth, latitude, longitude,
                avg_apparent_power_w, max_apparent_power_w, avg_daily_runtime_min,
                total_runtime_min, total_sessions, avg_session_dur_min, avg_rest_dur_min,
                on_off_cycles, dry_run_trips, power_fail_trips, total_water_yield_l,
                health_score, health_rating, recharge_ratio, motor_efficiency_pct,
                depletion_risk_pct, estimated_lpm, data_from, data_to, computed_at
            ) VALUES (
                :uid, :farm_id, :ward_name, :motor_hp, :borewell_depth, :latitude, :longitude,
                :avg_apparent_power_w, :max_apparent_power_w, :avg_daily_runtime_min,
                :total_runtime_min, :total_sessions, :avg_session_dur_min, :avg_rest_dur_min,
                :on_off_cycles, :dry_run_trips, :power_fail_trips, :total_water_yield_l,
                :health_score, :health_rating, :recharge_ratio, :motor_efficiency_pct,
                :depletion_risk_pct, :estimated_lpm, :data_from, :data_to, :computed_at
            )
            ON CONFLICT (uid) DO UPDATE SET
                avg_apparent_power_w  = EXCLUDED.avg_apparent_power_w,
                max_apparent_power_w  = EXCLUDED.max_apparent_power_w,
                avg_daily_runtime_min = EXCLUDED.avg_daily_runtime_min,
                total_sessions        = EXCLUDED.total_sessions,
                health_score          = EXCLUDED.health_score,
                health_rating         = EXCLUDED.health_rating,
                recharge_ratio        = EXCLUDED.recharge_ratio,
                motor_efficiency_pct  = EXCLUDED.motor_efficiency_pct,
                depletion_risk_pct    = EXCLUDED.depletion_risk_pct,
                estimated_lpm         = EXCLUDED.estimated_lpm,
                computed_at           = EXCLUDED.computed_at
        """), {**payload, "data_from": payload["data_from"],
               "data_to": payload["data_to"],
               "computed_at": payload["computed_at"]})
        await sess.commit()

    payload["data_from"]   = str(payload["data_from"])   if payload["data_from"]   else None
    payload["data_to"]     = str(payload["data_to"])     if payload["data_to"]     else None
    payload["computed_at"] = str(payload["computed_at"])
    return {"source": "computed", "data": payload}


# ── 5. Schedule ───────────────────────────────────────────────────────────────
@router.get("/schedule/{uid}")
async def get_schedule(uid: str, farm_id: int):
    async with BiSession() as sess:
        result = await sess.execute(
            text("SELECT * FROM bw_schedule_cache WHERE uid = :uid"), {"uid": uid}
        )
        cached = result.mappings().first()
        if cached:
            row = dict(cached)
            row["session_schedule"] = json.loads(row["session_schedule"] or "[]")
            row["dynamic_rules"]    = json.loads(row["dynamic_rules"]    or "[]")

            # Enrich with geometry
            motor_hp       = float(row.get("motor_hp") or 12.5)
            depth_ft       = get_depth_for_hp(motor_hp)
            motor_depth_ft = depth_ft - 100.0
            static_ft      = round(depth_ft * SWL_RATIO, 1)
            usable_col_m   = round((motor_depth_ft - static_ft) / 3.281, 1)
            safe_draw_m    = round(usable_col_m * 0.70, 1)
            spm  = float(row.get("safe_pump_min") or 60)
            rmin = float(row.get("recovery_min")  or 120)
            qd   = round(safe_draw_m/(spm/60), 2)  if spm  > 0 and safe_draw_m > 0 else 0
            qr   = round(safe_draw_m/(rmin/60), 2) if rmin > 0 and safe_draw_m > 0 else 0

            hres = await sess.execute(
                text("SELECT ward_name FROM bw_health_cache WHERE uid = :uid"), {"uid": uid}
            )
            hrow = hres.mappings().first()
            row.update({
                "borewell_depth": depth_ft, "usable_col_m": usable_col_m,
                "safe_draw_m": safe_draw_m, "qd_m_hr": qd, "qr_m_hr": qr,
                "ratio_qr_qd": round(qr/qd, 2) if qd > 0 else 0,
                "ward_name": hrow["ward_name"] if hrow else "",
            })
            return {"source": "cache", "data": row}

    health_resp = await get_health(uid=uid, farm_id=farm_id)
    h = health_resp["data"]

    sched = compute_schedule(
        qd_m_hr=h["qd_m_hr"], qr_m_hr=h["qr_m_hr"],
        usable_col_m=h["usable_col_m"], estimated_lpm=h["rated_lpm"],
        safe_pump_min=h["safe_pump_min"], recovery_min=h["recovery_min"],
        borewell_depth_ft=h["borewell_depth"], motor_hp=h["motor_hp"], lpcd=108.0,
    )

    payload = {
        "uid": uid, "farm_id": farm_id, "ward_name": h.get("ward_name", ""),
        "motor_hp": h["motor_hp"], "borewell_depth": h["borewell_depth"],
        "usable_col_m": h["usable_col_m"], "safe_draw_m": h["safe_draw_m"],
        "qd_m_hr": h["qd_m_hr"], "qr_m_hr": h["qr_m_hr"],
        "ratio_qr_qd": h["ratio_qr_qd"],
        "safe_pump_min": sched["safe_pump_min"], "recovery_min": sched["recovery_min"],
        "sessions_per_day": sched["sessions_per_day"],
        "yield_per_session_l": sched["yield_per_session_l"],
        "total_daily_yield_l": sched["total_daily_yield_l"],
        "people_served": sched["people_served"],
        "session_schedule": sched["session_schedule"],
        "dynamic_rules": sched["dynamic_rules"],
        "computed_at": datetime.now(),
    }

    async with BiSession() as sess:
        await sess.execute(text("""
            INSERT INTO bw_schedule_cache (
                uid, farm_id, motor_hp, borewell_depth, safe_pump_min, recovery_min,
                sessions_per_day, yield_per_session_l, total_daily_yield_l, people_served,
                session_schedule, dynamic_rules, computed_at
            ) VALUES (
                :uid, :farm_id, :motor_hp, :borewell_depth, :safe_pump_min, :recovery_min,
                :sessions_per_day, :yield_per_session_l, :total_daily_yield_l, :people_served,
                :session_schedule_json, :dynamic_rules_json, :computed_at
            )
            ON CONFLICT (uid) DO UPDATE SET
                safe_pump_min=EXCLUDED.safe_pump_min,
                sessions_per_day=EXCLUDED.sessions_per_day,
                total_daily_yield_l=EXCLUDED.total_daily_yield_l,
                people_served=EXCLUDED.people_served,
                session_schedule=EXCLUDED.session_schedule,
                computed_at=EXCLUDED.computed_at
        """), {
            **payload,
            "session_schedule_json": json.dumps(sched["session_schedule"]),
            "dynamic_rules_json":    json.dumps(sched["dynamic_rules"]),
            "computed_at":           datetime.now(),
        })
        await sess.commit()

    payload["computed_at"] = str(payload["computed_at"])
    return {"source": "computed", "data": payload}
