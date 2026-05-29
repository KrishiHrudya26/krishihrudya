"""
bw_cron.py — Borewell Intelligence Cron Job (Server Version)
=============================================================
Architecture:
  READ  AP rows, borewell, stats, events, runtime → legacy DB (69.62.81.58) readonly
  WRITE actual_borewell_depth, cycle_static_depth,
        motor_start_va, peak_motor_va,
        cycle_static_depth_ft                     → legacy DB (69.62.81.58) write user
  WRITE health + schedule cache                   → borewell_intelligence (PostgreSQL VPS)
  WRITE cron log                                  → borewell_intelligence (PostgreSQL VPS)

Usage:
  python bw_cron.py --batch 10 --offset 0    # first 10 UIDs
  python bw_cron.py --batch 10 --offset 10   # next 10 UIDs
  python bw_cron.py --uid 865357062791148     # single UID
  python bw_cron.py --all-viz                 # with graphs (local only)
"""

import argparse
import json
import os
import sys
import time
import traceback
from collections import defaultdict
from datetime import datetime, timedelta

import aiomysql
import asyncio
import asyncpg

sys.path.append("/var/www/krishihrudya/borewell_intelligence")
from calculations import (
    derive_water_depth, detect_cycles, get_depth_for_hp,
    borewell_lpm_rated, compute_qd_qr_from_depth, compute_qd_qr,
    compute_health_score, compute_schedule, parse_sessions,
    compute_rest_periods, clean_ap_series, SWL_RATIO,
)

# ── Config ────────────────────────────────────────────────────────────────────
LEGACY_HOST      = "69.62.81.58"
LEGACY_PORT      = 3306
LEGACY_DB        = "khprojectscp_khprojectsdb_25"

# Read-only user — for fetching data
LEGACY_READ_USER = "khprojectscp_khreadonly"
LEGACY_READ_PASS = "Superadmin@26@"

# Write user — for updating computed columns
LEGACY_WRITE_USER = "khprojectscp_khwrite"
LEGACY_WRITE_PASS = "Elephant$2808"   # ← fill in your password

PG_DSN = (
    f"postgresql://{os.getenv('DB_USER','khuser')}:"
    f"{os.getenv('DB_PASSWORD','KHdb%4026')}"
    f"@localhost:5432/borewell_intelligence"
)

CYCLE_GAP_MIN = 15.0
SAVE_DIR      = os.path.expanduser("~/Downloads/borewell_graphs")


# ── MySQL pools ───────────────────────────────────────────────────────────────
async def get_read_pool():
    return await aiomysql.create_pool(
        host=LEGACY_HOST, port=LEGACY_PORT, db=LEGACY_DB,
        user=LEGACY_READ_USER, password=LEGACY_READ_PASS,
        charset="utf8mb4", autocommit=True,
        minsize=1, maxsize=5,
    )

async def get_write_pool():
    return await aiomysql.create_pool(
        host=LEGACY_HOST, port=LEGACY_PORT, db=LEGACY_DB,
        user=LEGACY_WRITE_USER, password=LEGACY_WRITE_PASS,
        charset="utf8mb4", autocommit=False,
        minsize=1, maxsize=3,
    )


# ── Fetch real ward UIDs ──────────────────────────────────────────────────────
async def fetch_all_uids(read_pool) -> list:
    async with read_pool.acquire() as conn:
        async with conn.cursor(aiomysql.DictCursor) as cur:
            await cur.execute("""
                SELECT DISTINCT
                    CAST(i.uid AS CHAR) AS uid,
                    b.motor_hp,
                    b.borewell_depth,
                    f.farm_name
                FROM installations i
                INNER JOIN farms f ON f.id = i.farm_id
                LEFT JOIN borewell b ON b.uid = i.uid
                WHERE f.farm_name NOT LIKE '%My Farm%'
                  AND f.farm_name NOT LIKE '%Test%'
                  AND f.farm_name NOT LIKE '%test%'
                  AND EXISTS (
                      SELECT 1 FROM chart_power_analytics cpa
                      WHERE cpa.uid = i.uid
                        AND cpa.apparent_power IS NOT NULL
                        AND cpa.apparent_power != ''
                        AND CAST(cpa.apparent_power AS UNSIGNED) > 0
                      LIMIT 1
                  )
                ORDER BY uid ASC
            """)
            return list(await cur.fetchall())


# ── Fetch AP rows ─────────────────────────────────────────────────────────────
async def fetch_ap_rows(read_pool, uid: str, since: str) -> list:
    async with read_pool.acquire() as conn:
        async with conn.cursor(aiomysql.DictCursor) as cur:
            await cur.execute("""
                SELECT id, uid, apparent_power,
                       voltage1, voltage2, voltage3,
                       current1, current2, current3,
                       actual_borewell_depth,
                       created_at
                FROM chart_power_analytics
                WHERE uid = %s
                  AND created_at >= %s
                  AND apparent_power IS NOT NULL
                  AND apparent_power != ''
                  AND CAST(apparent_power AS UNSIGNED) > 0
                ORDER BY created_at ASC
            """, (uid, since))
            return list(await cur.fetchall())


# ── Fetch peak_motor_va ───────────────────────────────────────────────────────
async def fetch_peak_va(read_pool, uid: str) -> int:
    async with read_pool.acquire() as conn:
        async with conn.cursor(aiomysql.DictCursor) as cur:
            await cur.execute("""
                SELECT peak_motor_va FROM starter_statistics
                WHERE uid = %s LIMIT 1
            """, (uid,))
            row = await cur.fetchone()
            return int(row["peak_motor_va"] or 0) if row and row.get("peak_motor_va") else 0


# ── Fetch event logs ──────────────────────────────────────────────────────────
async def fetch_event_rows(read_pool, uid: str, since: str) -> list:
    async with read_pool.acquire() as conn:
        async with conn.cursor(aiomysql.DictCursor) as cur:
            await cur.execute("""
                SELECT message, created_at FROM event_logs
                WHERE uid = %s AND created_at >= %s
                  AND (message LIKE '%%Motor started%%'
                    OR message LIKE '%%Motor stopped%%')
                ORDER BY created_at ASC
            """, (uid, since))
            return list(await cur.fetchall())


# ── Fetch runtime rows ────────────────────────────────────────────────────────
async def fetch_runtime_rows(read_pool, uid: str, since: str) -> list:
    async with read_pool.acquire() as conn:
        async with conn.cursor(aiomysql.DictCursor) as cur:
            await cur.execute("""
                SELECT total_runtime, water_yield, created_at
                FROM chart_utilization
                WHERE uid = %s AND created_at >= %s
                ORDER BY created_at ASC
            """, (uid, since))
            return list(await cur.fetchall())


# ── Auto-detect date range ────────────────────────────────────────────────────
async def fetch_uid_date_range(read_pool, uid: str):
    async with read_pool.acquire() as conn:
        async with conn.cursor() as cur:
            await cur.execute("""
                SELECT MIN(created_at), MAX(created_at)
                FROM chart_power_analytics
                WHERE uid = %s
                  AND apparent_power IS NOT NULL
                  AND apparent_power != ''
                  AND CAST(apparent_power AS UNSIGNED) > 0
            """, (uid,))
            row = await cur.fetchone()
            if not row or not row[0]:
                return None
            return str(row[0])[:10], str(row[1])[:10]


# ── Save water level figure (local only) ─────────────────────────────────────
def save_water_level_figure(
    enriched_rows: list, uid: str, motor_hp: float,
    depth_ft: float, full_static_depth: float,
    farm_name: str, save_dir: str,
) -> str | None:
    try:
        import matplotlib
        matplotlib.use("Agg")
        import matplotlib.pyplot as plt
        import matplotlib.dates as mdates
    except ImportError:
        return None

    daily = defaultdict(lambda: {"depths": [], "static_depths": []})
    for r in enriched_rows:
        ts = r.get("created_at")
        if not ts:
            continue
        day = ts.strftime("%Y-%m-%d") if isinstance(ts, datetime) else str(ts)[:10]
        try:
            d = float(r.get("actual_borewell_depth") or 0)
            if d > 0:
                daily[day]["depths"].append(d)
        except (ValueError, TypeError):
            pass
        try:
            s = float(r.get("cycle_static_depth") or 0)
            if s > 0:
                daily[day]["static_depths"].append(s)
        except (ValueError, TypeError):
            pass

    series = []
    for day in sorted(daily.keys()):
        d = daily[day]
        if not d["depths"]:
            continue
        series.append({
            "date":            day,
            "avg_depth_ft":    round(sum(d["depths"]) / len(d["depths"]), 1),
            "max_depth_ft":    round(max(d["depths"]), 1),
            "min_depth_ft":    round(min(d["depths"]), 1),
            "static_depth_ft": round(
                sum(d["static_depths"]) / len(d["static_depths"]), 1
            ) if d["static_depths"] else full_static_depth,
        })

    if not series or len(series) < 7:
        return None

    pump_depth_ft = depth_ft - 100.0
    safe_limit_ft = full_static_depth + (pump_depth_ft - full_static_depth) * 0.70

    dates    = [datetime.strptime(d["date"], "%Y-%m-%d") for d in series]
    avg_d    = [d["avg_depth_ft"]    for d in series]
    max_d    = [d["max_depth_ft"]    for d in series]
    min_d    = [d["min_depth_ft"]    for d in series]
    static_d = [d["static_depth_ft"] for d in series]

    x_idx      = list(range(len(series)))
    tick_every = max(1, len(x_idx) // 20)
    labels     = [d["date"][5:].replace("-", "/") for d in series]

    def get_segments(x_vals, y_vals, dates_list, gap_days=14):
        segs = []
        seg_x, seg_y = [x_vals[0]], [y_vals[0]]
        for i in range(1, len(x_vals)):
            if (dates_list[i] - dates_list[i-1]).days > gap_days:
                if len(seg_x) > 1:
                    segs.append((seg_x[:], seg_y[:]))
                seg_x, seg_y = [x_vals[i]], [y_vals[i]]
            else:
                seg_x.append(x_vals[i])
                seg_y.append(y_vals[i])
        if len(seg_x) > 1:
            segs.append((seg_x, seg_y))
        return segs

    fig, ax = plt.subplots(figsize=(14, 7))
    fig.patch.set_facecolor("#f9fafb")
    ax.set_facecolor("#ffffff")

    min_segs    = get_segments(x_idx, min_d,    dates)
    max_segs    = get_segments(x_idx, max_d,    dates)
    avg_segs    = get_segments(x_idx, avg_d,    dates)
    static_segs = get_segments(x_idx, static_d, dates)

    for si in range(min(len(min_segs), len(max_segs))):
        ax.fill_between(min_segs[si][0], min_segs[si][1], max_segs[si][1],
                        alpha=0.15, color="#f59e0b",
                        label="Daily range" if si == 0 else None)
    for si, (sx, sy) in enumerate(avg_segs):
        ax.plot(sx, sy, color="#f59e0b", linewidth=2.5, zorder=3,
                label="Avg water depth" if si == 0 else None)
    for si, (sx, sy) in enumerate(max_segs):
        ax.plot(sx, sy, color="#ef4444", linewidth=1.5, linestyle="--", zorder=3,
                label="Deepest (max draw)" if si == 0 else None)
    for si, (sx, sy) in enumerate(static_segs):
        ax.plot(sx, sy, color="#3b82f6", linewidth=1.5, linestyle=(0,(5,3)), zorder=3,
                label="Cycle static (SWL)" if si == 0 else None)

    ax.axhline(y=full_static_depth, color="#2563eb", linewidth=1,   linestyle="--", alpha=0.6, label=f"Full SWL ({full_static_depth:.0f} ft)")
    ax.axhline(y=safe_limit_ft,     color="#dc2626", linewidth=1.5, linestyle="--", alpha=0.8, label=f"Safe limit ({safe_limit_ft:.0f} ft)")
    ax.axhline(y=pump_depth_ft,     color="#374151", linewidth=1,   linestyle=":",  alpha=0.5, label=f"Motor ({pump_depth_ft:.0f} ft)")
    ax.axhspan(safe_limit_ft, pump_depth_ft + 20, alpha=0.06, color="#dc2626", label="Danger zone")

    ax.invert_yaxis()
    ax.set_ylim(pump_depth_ft + 30, 0)
    ax.set_xticks(x_idx[::tick_every])
    ax.set_xticklabels(labels[::tick_every], rotation=45, ha="right", fontsize=9)
    ax.yaxis.set_major_formatter(plt.FuncFormatter(lambda v, _: f"{abs(v):.0f} ft"))
    ax.tick_params(axis="y", labelsize=9)
    ax.set_xlabel("Date", fontsize=10, color="#6b7280")
    ax.set_ylabel("Depth below surface (ft)", fontsize=10, color="#6b7280")

    title = f"Water Level — UID {uid} ({farm_name})\n{motor_hp} HP · {depth_ft:.0f} ft · SWL {full_static_depth:.0f} ft"
    ax.set_title(title, fontsize=11, fontweight="bold", color="#111827", pad=12)
    ax.grid(axis="y", linestyle="--", alpha=0.3, color="#d1d5db")
    ax.grid(axis="x", linestyle=":",  alpha=0.2, color="#d1d5db")
    ax.spines["top"].set_visible(False)
    ax.spines["right"].set_visible(False)
    ax.legend(loc="lower left", fontsize=8, framealpha=0.9,
              facecolor="white", edgecolor="#e5e7eb")

    all_avg = [d["avg_depth_ft"] for d in series]
    stats_text = (
        f"Period: {series[0]['date']} → {series[-1]['date']}\n"
        f"Days: {len(series)}\n"
        f"Avg: {sum(all_avg)/len(all_avg):.1f} ft\n"
        f"Deepest: {max(d['max_depth_ft'] for d in series):.1f} ft\n"
        f"Shallowest: {min(d['min_depth_ft'] for d in series):.1f} ft"
    )
    ax.text(0.02, 0.97, stats_text, transform=ax.transAxes, fontsize=8,
            verticalalignment="top",
            bbox=dict(boxstyle="round,pad=0.5", facecolor="white",
                      edgecolor="#e5e7eb", alpha=0.9))

    plt.tight_layout()
    os.makedirs(save_dir, exist_ok=True)
    filepath = os.path.join(save_dir, f"water_level_{uid}.png")
    plt.savefig(filepath, dpi=150, bbox_inches="tight", facecolor=fig.get_facecolor())
    plt.close(fig)
    return filepath


# ── Process single UID ────────────────────────────────────────────────────────
async def process_uid(
    read_pool, write_pool, pg_conn,
    uid: str, motor_hp: float,
    borewell_depth_db, full_static_depth_db, farm_name: str,
    since: str, log: dict, save_viz: bool = False,
) -> None:

    uid_str      = str(uid)
    motor_hp     = float(motor_hp or 12.5)
    depth_ft     = get_depth_for_hp(motor_hp)
    rated_lpm    = borewell_lpm_rated(motor_hp, depth_ft)
    min_credible = int(motor_hp * 80)

    if full_static_depth_db and float(full_static_depth_db) > 0:
        full_static_depth = float(full_static_depth_db)
    else:
        full_static_depth = round(depth_ft * SWL_RATIO, 1)

    # ── Fetch AP rows ─────────────────────────────────────────────────────────
    ap_rows = await fetch_ap_rows(read_pool, uid_str, since)
    if not ap_rows:
        return

    log["rows_read"] += len(ap_rows)
    log["db_read_mb"] += (len(ap_rows) * 200) / (1024 * 1024)

    peak_motor_va = await fetch_peak_va(read_pool, uid_str)
    cycles        = detect_cycles(ap_rows, gap_minutes=CYCLE_GAP_MIN)
    updates       = []
    enriched_rows = []

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

        if motor_start_va > peak_motor_va:
            peak_motor_va = motor_start_va

        effective_peak = peak_motor_va if peak_motor_va >= min_credible else motor_start_va

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
                phase_imbalance = (max(abs(i1-i_avg),abs(i2-i_avg),abs(i3-i_avg))/i_avg*100.0
                                   if i_avg > 0 else 0.0)
            except (ValueError, TypeError):
                phase_imbalance = 0.0

            dynamic_depth, cycle_static = derive_water_depth(
                apparent_power=ap_val, motor_start_va=motor_start_va,
                peak_motor_va=effective_peak, motor_hp=motor_hp,
                borewell_depth=depth_ft, full_static_depth=full_static_depth,
                v_avg=v_avg, phase_imbalance=phase_imbalance,
            )

            # Only update actual_borewell_depth and cycle_static_depth
            # Never touch created_at
            updates.append((
                str(round(dynamic_depth, 1)),  # actual_borewell_depth
                round(cycle_static, 2),         # cycle_static_depth
                r["id"],                        # WHERE id = ...
            ))

            if save_viz:
                enriched_rows.append({
                    "created_at":            r["created_at"],
                    "actual_borewell_depth": str(round(dynamic_depth, 1)),
                    "cycle_static_depth":    round(cycle_static, 2),
                })

    # ── Write to legacy DB — only depth columns, never created_at ─────────────
    if updates:
        async with write_pool.acquire() as conn:
            async with conn.cursor() as cur:
                await cur.executemany("""
                    UPDATE chart_power_analytics
                    SET actual_borewell_depth = %s,
                        cycle_static_depth    = %s,
                        created_at            = created_at
                    WHERE id = %s
                """, updates)
                await conn.commit()

        log["rows_written"] += len(updates)
        log["db_write_mb"]  += (len(updates) * 50) / (1024 * 1024)

    # ── Write starter_statistics ──────────────────────────────────────────────
    latest_static = updates[-1][1] if updates else None
    latest_motor_start = cycles[-1]["rows"][0].get("apparent_power", 0) if cycles else 0

    async with write_pool.acquire() as conn:
        async with conn.cursor() as cur:
            await cur.execute("""
                UPDATE starter_statistics
                SET motor_start_va        = %s,
                    peak_motor_va         = %s,
                    cycle_static_depth_ft = %s
                WHERE uid = %s
            """, (latest_motor_start, peak_motor_va, latest_static, uid_str))
            await conn.commit()

    # ── Health metrics (last 3 months) ────────────────────────────────────────
    three_months_ago = (datetime.now() - timedelta(days=90)).strftime("%Y-%m-%d")
    depth_rows_3mo   = [r for r in ap_rows if r.get("created_at") and
                        r["created_at"] >= datetime.strptime(three_months_ago, "%Y-%m-%d")]

    for i, upd in enumerate(updates):
        if i < len(depth_rows_3mo):
            depth_rows_3mo[i]["actual_borewell_depth"] = upd[0]
            depth_rows_3mo[i]["cycle_static_depth"]    = upd[1]

    has_depth = any(float(r.get("actual_borewell_depth") or 0) > 0 for r in depth_rows_3mo)

    if has_depth:
        aquifer = compute_qd_qr_from_depth(depth_rows_3mo, CYCLE_GAP_MIN)
    else:
        swl_ref_ft     = round(depth_ft * SWL_RATIO)
        motor_depth_ft = depth_ft - 100.0
        aquifer = compute_qd_qr([], ap_rows, swl_ref_ft, motor_depth_ft, motor_hp=motor_hp)

    qd_m_hr     = aquifer["qd_m_hr"]
    qr_m_hr     = aquifer["qr_m_hr"]
    ratio_qr_qd = aquifer["ratio_qr_qd"]

    motor_depth_ft = depth_ft - 100.0
    usable_col_ft  = motor_depth_ft - full_static_depth
    usable_col_m   = round(usable_col_ft / 3.281, 1)
    safe_draw_m    = round(usable_col_m * 0.70, 1)

    power_vals_kw = [float(r["apparent_power"])/1000.0 for r in depth_rows_3mo
                     if r.get("apparent_power") and float(r.get("apparent_power") or 0) > 0]
    clean_kw      = clean_ap_series(power_vals_kw)
    avg_ap_kw     = round(sum(clean_kw)/len(clean_kw), 3) if clean_kw else 0.0
    sorted_kw     = sorted(clean_kw)
    peak_ap_kw    = round(sorted_kw[max(0, int(len(sorted_kw)*0.95)-1)], 3) if sorted_kw else 0.0

    runtime_rows      = await fetch_runtime_rows(read_pool, uid_str, three_months_ago)
    runtime_vals      = [float(r["total_runtime"]) for r in runtime_rows
                         if r.get("total_runtime") and float(r["total_runtime"]) > 0]
    avg_daily_runtime = round(sum(runtime_vals)/len(runtime_vals), 1) if runtime_vals else 0.0
    total_runtime     = round(sum(runtime_vals), 1)
    days_with_data    = len(runtime_vals)
    total_yield       = round(avg_daily_runtime * rated_lpm * days_with_data)

    event_rows       = await fetch_event_rows(read_pool, uid_str, three_months_ago)
    sessions         = parse_sessions(event_rows)
    rest_periods     = compute_rest_periods(sessions)
    dry_run_trips    = sum(1 for s in sessions if s["stop_reason"] == "dry_run")
    power_fail_trips = sum(1 for s in sessions if s["stop_reason"] == "power_failure")
    avg_session_min  = (sum(s["duration_min"] for s in sessions)/len(sessions) if sessions else 0.0)
    avg_rest_min     = (sum(rest_periods)/len(rest_periods) if rest_periods else avg_session_min*1.5)

    if qd_m_hr == 0 and safe_draw_m > 0:
        proxy_min = max(avg_session_min if avg_session_min > 0
                        else avg_daily_runtime/3 if avg_daily_runtime > 0 else 60.0, 5.0)
        qd_m_hr   = round(safe_draw_m/(proxy_min/60.0), 2)
    if qr_m_hr == 0 and qd_m_hr > 0:
        qr_m_hr = round(safe_draw_m/(max(avg_rest_min if avg_rest_min > 0 else 90.0, 5.0)/60.0), 2)
    qr_m_hr = min(qr_m_hr, qd_m_hr)
    if qd_m_hr > 0:
        ratio_qr_qd = round(qr_m_hr/qd_m_hr, 2)

    safe_pump_min = (max(20, min(120, round((safe_draw_m/qd_m_hr)*60))) if qd_m_hr > 0
                     else max(20, min(120, round(avg_session_min or 60))))
    recovery_min  = (max(safe_pump_min, min(480, round((safe_draw_m/qr_m_hr)*60))) if qr_m_hr > 0
                     else safe_pump_min*2)

    health = compute_health_score(
        sessions=sessions, qd_m_hr=qd_m_hr, qr_m_hr=qr_m_hr,
        ratio_qr_qd=ratio_qr_qd, avg_apparent_power_kw=avg_ap_kw,
        motor_hp=motor_hp, dry_run_trips=dry_run_trips,
        power_fail_trips=power_fail_trips, avg_daily_runtime_min=avg_daily_runtime,
        usable_col_m=usable_col_m, estimated_lpm=rated_lpm,
        total_days_in_range=max(1, days_with_data),
    )

    all_dates = [r["created_at"] for r in list(depth_rows_3mo)+list(runtime_rows)
                 if r.get("created_at")]
    data_from = min(all_dates) if all_dates else None
    data_to   = max(all_dates) if all_dates else None

    await pg_conn.execute("""
        INSERT INTO bw_health_cache (
            uid, farm_id, ward_name, motor_hp, borewell_depth, latitude, longitude,
            avg_apparent_power_w, max_apparent_power_w, avg_daily_runtime_min,
            total_runtime_min, total_sessions, avg_session_dur_min, avg_rest_dur_min,
            on_off_cycles, dry_run_trips, power_fail_trips, total_water_yield_l,
            health_score, health_rating, recharge_ratio, motor_efficiency_pct,
            depletion_risk_pct, estimated_lpm, data_from, data_to, computed_at
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27)
        ON CONFLICT (uid) DO UPDATE SET
            avg_apparent_power_w=EXCLUDED.avg_apparent_power_w,
            max_apparent_power_w=EXCLUDED.max_apparent_power_w,
            avg_daily_runtime_min=EXCLUDED.avg_daily_runtime_min,
            total_sessions=EXCLUDED.total_sessions,
            health_score=EXCLUDED.health_score,
            health_rating=EXCLUDED.health_rating,
            recharge_ratio=EXCLUDED.recharge_ratio,
            motor_efficiency_pct=EXCLUDED.motor_efficiency_pct,
            depletion_risk_pct=EXCLUDED.depletion_risk_pct,
            estimated_lpm=EXCLUDED.estimated_lpm,
            computed_at=EXCLUDED.computed_at
    """,
        uid_str, 0, farm_name, motor_hp, depth_ft, 0.0, 0.0,
        avg_ap_kw, peak_ap_kw, avg_daily_runtime, total_runtime,
        len(sessions), health["avg_session_dur_min"], avg_rest_min,
        len(sessions), dry_run_trips, power_fail_trips, float(total_yield),
        health["health_score"], health["health_rating"], ratio_qr_qd,
        health["motor_efficiency_pct"], health["depletion_risk_pct"], rated_lpm,
        data_from, data_to, datetime.now(),
    )

    sched = compute_schedule(
        qd_m_hr=qd_m_hr, qr_m_hr=qr_m_hr, usable_col_m=usable_col_m,
        estimated_lpm=rated_lpm, safe_pump_min=safe_pump_min, recovery_min=recovery_min,
        borewell_depth_ft=depth_ft, motor_hp=motor_hp, lpcd=108.0,
    )

    await pg_conn.execute("""
        INSERT INTO bw_schedule_cache (
            uid, farm_id, motor_hp, borewell_depth, safe_pump_min, recovery_min,
            sessions_per_day, yield_per_session_l, total_daily_yield_l, people_served,
            session_schedule, dynamic_rules, computed_at
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
        ON CONFLICT (uid) DO UPDATE SET
            safe_pump_min=EXCLUDED.safe_pump_min,
            sessions_per_day=EXCLUDED.sessions_per_day,
            total_daily_yield_l=EXCLUDED.total_daily_yield_l,
            people_served=EXCLUDED.people_served,
            session_schedule=EXCLUDED.session_schedule,
            computed_at=EXCLUDED.computed_at
    """,
        uid_str, 0, motor_hp, depth_ft,
        sched["safe_pump_min"], sched["recovery_min"], sched["sessions_per_day"],
        float(sched["yield_per_session_l"]), float(sched["total_daily_yield_l"]),
        sched["people_served"], json.dumps(sched["session_schedule"]),
        json.dumps(sched["dynamic_rules"]), datetime.now(),
    )

    log["cache_updates"] += 2

    if save_viz and enriched_rows:
        filepath = save_water_level_figure(
            enriched_rows, uid_str, motor_hp, depth_ft,
            full_static_depth, farm_name, SAVE_DIR,
        )
        if filepath:
            log["viz_saved"] = log.get("viz_saved", 0) + 1
            print(f"\n    📊 Graph saved: {filepath}")


# ── Main ──────────────────────────────────────────────────────────────────────
async def main(args):
    print(f"\n{'='*60}")
    print(f"  BW Cron Job — {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"  DB: {LEGACY_HOST}/{LEGACY_DB}")
    if args.batch:
        print(f"  Batch: {args.batch} UIDs from offset {args.offset}")
    print(f"{'='*60}\n")

    job_start  = time.time()
    read_pool  = await get_read_pool()
    write_pool = await get_write_pool()
    pg_conn    = await asyncpg.connect(PG_DSN)

    log_id = await pg_conn.fetchval("""
        INSERT INTO bw_cron_log (run_at, status)
        VALUES ($1, 'running') RETURNING id
    """, datetime.now())

    log = {
        "uids_processed": 0, "rows_read": 0, "rows_written": 0,
        "cache_updates": 0, "db_read_mb": 0.0, "db_write_mb": 0.0,
        "errors": 0, "error_log": [], "viz_saved": 0,
    }

    try:
        all_uids = await fetch_all_uids(read_pool)

        if args.uid:
            uids = [u for u in all_uids if str(u["uid"]) == str(args.uid)]
            if not uids:
                print(f"UID {args.uid} not found.")
                return
        elif args.batch:
            offset = args.offset or 0
            uids   = all_uids[offset: offset + args.batch]
            print(f"Total UIDs available: {len(all_uids)}")
            print(f"Processing UIDs {offset+1} to {offset+len(uids)}\n")
        else:
            uids = all_uids

        print(f"Processing {len(uids)} UIDs.\n")

        for i, uid_row in enumerate(uids):
            uid       = str(uid_row["uid"])
            hp        = uid_row.get("motor_hp")
            depth     = uid_row.get("borewell_depth")
            fsd       = None
            farm_name = uid_row.get("farm_name") or ""

            try:
                hp_val = float(hp or 12.5)
            except (ValueError, TypeError):
                hp_val = 12.5

            date_range = await fetch_uid_date_range(read_pool, uid)
            if not date_range:
                print(f"[{i+1}/{len(uids)}] UID {uid} — no AP data, skipping.")
                continue

            since_date = args.since or date_range[0]
            print(f"[{i+1}/{len(uids)}] UID {uid} — {hp_val} HP — {farm_name} — {since_date} to {date_range[1]}", end=" ... ")

            try:
                await process_uid(
                    read_pool, write_pool, pg_conn,
                    uid, hp_val, depth, fsd, farm_name,
                    since=since_date, log=log, save_viz=args.all_viz,
                )
                log["uids_processed"] += 1
                print("✓")
            except Exception as e:
                log["errors"] += 1
                log["error_log"].append(f"UID {uid}: {str(e)}")
                print(f"✗ ERROR: {e}")
                if args.verbose:
                    traceback.print_exc()

        duration = round(time.time() - job_start, 2)
        await pg_conn.execute("""
            UPDATE bw_cron_log SET
                duration_sec=$1, uids_processed=$2, rows_read=$3,
                rows_written=$4, cache_updates=$5, db_read_mb=$6,
                db_write_mb=$7, errors=$8, error_log=$9, status=$10
            WHERE id=$11
        """,
            duration, log["uids_processed"], log["rows_read"],
            log["rows_written"], log["cache_updates"],
            round(log["db_read_mb"], 3), round(log["db_write_mb"], 3),
            log["errors"], "\n".join(log["error_log"]) or None,
            "completed" if log["errors"] == 0 else "completed_with_errors",
            log_id,
        )

        print(f"\n{'='*60}")
        print(f"  Done in {duration}s")
        print(f"  UIDs processed : {log['uids_processed']}")
        print(f"  Rows read      : {log['rows_read']}")
        print(f"  Rows written   : {log['rows_written']}")
        print(f"  Cache updates  : {log['cache_updates']}")
        print(f"  Graphs saved   : {log['viz_saved']}")
        print(f"  DB read        : {log['db_read_mb']:.2f} MB")
        print(f"  DB write       : {log['db_write_mb']:.2f} MB")
        print(f"  Errors         : {log['errors']}")
        if args.batch and args.offset is not None:
            next_offset = (args.offset or 0) + args.batch
            print(f"\n  Next batch: --batch {args.batch} --offset {next_offset}")
        print(f"{'='*60}\n")

    except Exception as e:
        duration = round(time.time() - job_start, 2)
        await pg_conn.execute("""
            UPDATE bw_cron_log SET duration_sec=$1, status='failed', error_log=$2
            WHERE id=$3
        """, duration, str(e), log_id)
        print(f"\nFATAL ERROR: {e}")
        traceback.print_exc()

    finally:
        read_pool.close()
        await read_pool.wait_closed()
        write_pool.close()
        await write_pool.wait_closed()
        await pg_conn.close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Borewell Intelligence Cron Job")
    parser.add_argument("--uid",     type=str,  help="Process single UID only")
    parser.add_argument("--since",   type=str,  help="Override start date YYYY-MM-DD")
    parser.add_argument("--batch",   type=int,  help="Number of UIDs to process per run")
    parser.add_argument("--offset",  type=int,  default=0, help="Start from this UID index")
    parser.add_argument("--verbose", action="store_true", help="Show full tracebacks")
    parser.add_argument("--all-viz", action="store_true", help="Save water level graphs (local only)")
    args = parser.parse_args()
    asyncio.run(main(args))