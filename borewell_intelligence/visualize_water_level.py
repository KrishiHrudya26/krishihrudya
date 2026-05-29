"""
visualize_water_level.py
========================
Run locally to visualize water level trend for a single UID.
Fetches from kh_legacy_clone MySQL, computes depth using PHP formula,
plots the water level trend graph.

Usage:
  python visualize_water_level.py --uid 865357062791148
  python visualize_water_level.py --uid 865357062791148 --since 2026-01-01
  python visualize_water_level.py --uid 865357062791148 --days 90

Requirements:
  pip install aiomysql matplotlib asyncio
"""

import argparse
import asyncio
import sys
import os
from datetime import datetime, timedelta
from collections import defaultdict

import aiomysql
import matplotlib.pyplot as plt
import matplotlib.dates as mdates
from matplotlib.patches import Patch
from matplotlib.lines import Line2D

# ── Add calculations path ─────────────────────────────────────────────────────
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
from calculations import (
    get_depth_for_hp, borewell_lpm_rated, generate_tts_for_hp,
    compute_static_depth_tts, derive_water_depth, detect_cycles,
    compute_water_level_series_from_db, compute_water_level_series,
    SWL_RATIO,
)

# ── MySQL config — change password ────────────────────────────────────────────
MYSQL_CONFIG = {
    "host":     "localhost",
    "port":     3306,
    "user":     "root",
    "password": "iora7479",   # ← change this
    "charset":  "utf8mb4",
    "autocommit": True,
}


async def fetch_borewell_info(pool, uid: str) -> dict:
    async with pool.acquire() as conn:
        async with conn.cursor(aiomysql.DictCursor) as cur:
            await cur.execute("""
                SELECT b.motor_hp, b.borewell_depth, b.full_static_depth,
                       f.farm_name
                FROM kh_legacy_clone.borewell b
                LEFT JOIN kh_legacy_clone.installations i ON i.uid = b.uid
                LEFT JOIN kh_legacy_clone.farms f ON f.id = i.farm_id
                WHERE b.uid = %s LIMIT 1
            """, (uid,))
            return await cur.fetchone() or {}


async def fetch_ap_rows(pool, uid: str, since: str) -> list:
    """Read from kh_legacy_temp — original timestamps intact."""
    async with pool.acquire() as conn:
        async with conn.cursor(aiomysql.DictCursor) as cur:
            await cur.execute("""
                SELECT id, apparent_power,
                       voltage1, voltage2, voltage3,
                       current1, current2, current3,
                       actual_borewell_depth,
                       created_at
                FROM kh_legacy_temp.chart_power_analytics
                WHERE uid = %s AND created_at >= %s
                  AND apparent_power IS NOT NULL
                  AND apparent_power != ''
                  AND CAST(apparent_power AS UNSIGNED) > 0
                ORDER BY created_at ASC
            """, (uid, since))
            rows = list(await cur.fetchall())

        # Also fetch computed depth values from kh_legacy_clone if available
        async with conn.cursor(aiomysql.DictCursor) as cur:
            await cur.execute("""
                SELECT id, actual_borewell_depth, cycle_static_depth
                FROM kh_legacy_clone.chart_power_analytics
                WHERE uid = %s AND original_created_at >= %s
                  AND actual_borewell_depth IS NOT NULL
                ORDER BY original_created_at ASC
            """, (uid, since))
            clone_rows = {r["id"]: r for r in await cur.fetchall()}

        # Merge computed depths into temp rows
        for r in rows:
            if r["id"] in clone_rows:
                r["actual_borewell_depth"] = clone_rows[r["id"]]["actual_borewell_depth"]
                r["cycle_static_depth"]    = clone_rows[r["id"]]["cycle_static_depth"]
            else:
                r["cycle_static_depth"] = None

        return rows


async def fetch_peak_va(pool, uid: str) -> int:
    async with pool.acquire() as conn:
        async with conn.cursor(aiomysql.DictCursor) as cur:
            await cur.execute("""
                SELECT peak_motor_va FROM kh_legacy_clone.starter_statistics
                WHERE uid = %s LIMIT 1
            """, (uid,))
            row = await cur.fetchone()
            return int(row["peak_motor_va"] or 0) if row and row.get("peak_motor_va") else 0


def compute_depth_series(ap_rows: list, motor_hp: float,
                          full_static_depth: float, peak_motor_va_stored: int) -> list:
    """
    Compute dynamic_depth and cycle_static_depth for each row
    using the PHP formula (derive_water_depth).
    Returns enriched rows with computed depth values.
    """
    depth_ft      = get_depth_for_hp(motor_hp)
    min_credible  = int(motor_hp * 80)
    peak_motor_va = peak_motor_va_stored

    cycles  = detect_cycles(ap_rows, gap_minutes=15.0)
    results = []

    for cycle in cycles:
        rows = cycle["rows"]

        # motor_start_va = first credible AP in this cycle
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

            # Phase voltages
            try:
                v1 = float(r.get("voltage1") or 0)
                v2 = float(r.get("voltage2") or 0)
                v3 = float(r.get("voltage3") or 0)
                v_avg = (v1 + v2 + v3) / 3.0 if (v1 + v2 + v3) > 0 else 230.0
            except (ValueError, TypeError):
                v_avg = 230.0

            # Phase imbalance
            try:
                i1 = float(r.get("current1") or 0)
                i2 = float(r.get("current2") or 0)
                i3 = float(r.get("current3") or 0)
                i_avg = (i1 + i2 + i3) / 3.0
                if i_avg > 0:
                    i_max_dev = max(abs(i1-i_avg), abs(i2-i_avg), abs(i3-i_avg))
                    phase_imbalance = (i_max_dev / i_avg) * 100.0
                else:
                    phase_imbalance = 0.0
            except (ValueError, TypeError):
                phase_imbalance = 0.0

            dynamic_depth, cycle_static = derive_water_depth(
                apparent_power    = ap_val,
                motor_start_va    = motor_start_va,
                peak_motor_va     = effective_peak,
                motor_hp          = motor_hp,
                borewell_depth    = depth_ft,
                full_static_depth = full_static_depth,
                v_avg             = v_avg,
                phase_imbalance   = phase_imbalance,
            )

            results.append({
                "created_at":           r["created_at"],
                "apparent_power":       ap_val,
                "actual_borewell_depth": str(round(dynamic_depth, 1)),
                "cycle_static_depth":   round(cycle_static, 2),
                "motor_start_va":       motor_start_va,
                "peak_motor_va":        peak_motor_va,
            })

    return results


def aggregate_daily(enriched_rows: list) -> list:
    """Aggregate per-reading depths into daily series."""
    daily = defaultdict(lambda: {"depths": [], "static_depths": []})

    for r in enriched_rows:
        ts = r["created_at"]
        day = ts.strftime("%Y-%m-%d") if isinstance(ts, datetime) else str(ts)[:10]
        try:
            d = float(r["actual_borewell_depth"] or 0)
            if d > 0:
                daily[day]["depths"].append(d)
        except (ValueError, TypeError):
            pass
        try:
            s = float(r["cycle_static_depth"] or 0)
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
            ) if d["static_depths"] else None,
        })
    return series


def plot_water_level(series: list, uid: str, motor_hp: float,
                      depth_ft: float, full_static_depth: float,
                      farm_name: str = ""):
    """Plot the water level trend — inverted Y axis (deeper = lower on chart)."""
    if not series:
        print("No data to plot.")
        return

    dates    = [datetime.strptime(d["date"], "%Y-%m-%d") for d in series]
    avg_d    = [d["avg_depth_ft"]    for d in series]
    max_d    = [d["max_depth_ft"]    for d in series]
    min_d    = [d["min_depth_ft"]    for d in series]
    static_d = [d["static_depth_ft"] if d["static_depth_ft"] else full_static_depth
                for d in series]

    pump_depth_ft = depth_ft - 100.0
    safe_limit_ft = full_static_depth + (pump_depth_ft - full_static_depth) * 0.70

    fig, ax = plt.subplots(figsize=(14, 7))
    fig.patch.set_facecolor("#f9fafb")
    ax.set_facecolor("#ffffff")

    # ── Fill between min and max ──────────────────────────────────────────────
    ax.fill_between(dates, min_d, max_d, alpha=0.15, color="#f59e0b", label="Daily range")

    # ── Average depth line ────────────────────────────────────────────────────
    ax.plot(dates, avg_d, color="#f59e0b", linewidth=2.5,
            label="Avg water depth", zorder=3)

    # ── Max depth (deepest) ───────────────────────────────────────────────────
    ax.plot(dates, max_d, color="#ef4444", linewidth=1.5,
            linestyle="--", label="Deepest (max draw)", zorder=3)

    # ── Cycle static depth ────────────────────────────────────────────────────
    ax.plot(dates, static_d, color="#3b82f6", linewidth=1.5,
            linestyle=(0, (5, 3)), label="Cycle static (SWL)", zorder=3)

    # ── Reference lines ───────────────────────────────────────────────────────
    ax.axhline(y=full_static_depth, color="#2563eb", linewidth=1,
               linestyle="--", alpha=0.6, label=f"Full SWL ({full_static_depth:.0f} ft)")
    ax.axhline(y=safe_limit_ft, color="#dc2626", linewidth=1.5,
               linestyle="--", alpha=0.8, label=f"Safe limit ({safe_limit_ft:.0f} ft)")
    ax.axhline(y=pump_depth_ft, color="#374151", linewidth=1,
               linestyle=":", alpha=0.5, label=f"Motor position ({pump_depth_ft:.0f} ft)")

    # ── Shade danger zone ─────────────────────────────────────────────────────
    ax.axhspan(safe_limit_ft, pump_depth_ft + 20,
               alpha=0.06, color="#dc2626", label="Danger zone")

    # ── Invert Y axis (deeper = lower) ───────────────────────────────────────
    ax.invert_yaxis()
    ax.set_ylim(pump_depth_ft + 30, 0)

    # ── Formatting ────────────────────────────────────────────────────────────
    ax.xaxis.set_major_formatter(mdates.DateFormatter("%d/%m"))
    ax.xaxis.set_major_locator(mdates.WeekdayLocator(interval=1))
    plt.xticks(rotation=45, ha="right", fontsize=9)
    ax.yaxis.set_major_formatter(plt.FuncFormatter(lambda v, _: f"{abs(v):.0f} ft"))
    ax.tick_params(axis="y", labelsize=9)

    ax.set_xlabel("Date", fontsize=10, color="#6b7280")
    ax.set_ylabel("Depth below surface (ft)", fontsize=10, color="#6b7280")

    title = f"Water Level Trend — UID {uid}"
    if farm_name:
        title += f" ({farm_name})"
    title += f"\n{motor_hp} HP · {depth_ft:.0f} ft borewell · SWL {full_static_depth:.0f} ft"
    ax.set_title(title, fontsize=12, fontweight="bold", color="#111827", pad=15)

    ax.grid(axis="y", linestyle="--", alpha=0.3, color="#d1d5db")
    ax.grid(axis="x", linestyle=":", alpha=0.2, color="#d1d5db")
    ax.spines["top"].set_visible(False)
    ax.spines["right"].set_visible(False)

    ax.legend(loc="lower left", fontsize=8, framealpha=0.9,
              facecolor="white", edgecolor="#e5e7eb")

    # ── Stats box ─────────────────────────────────────────────────────────────
    if series:
        all_avg = [d["avg_depth_ft"] for d in series]
        stats_text = (
            f"Period: {series[0]['date']} → {series[-1]['date']}\n"
            f"Days: {len(series)}\n"
            f"Avg depth: {sum(all_avg)/len(all_avg):.1f} ft\n"
            f"Deepest: {max(d['max_depth_ft'] for d in series):.1f} ft\n"
            f"Shallowest: {min(d['min_depth_ft'] for d in series):.1f} ft"
        )
        ax.text(0.02, 0.97, stats_text,
                transform=ax.transAxes, fontsize=8,
                verticalalignment="top",
                bbox=dict(boxstyle="round,pad=0.5", facecolor="white",
                          edgecolor="#e5e7eb", alpha=0.9))

    plt.tight_layout()
    filename = f"water_level_{uid}.png"
    plt.savefig(filename, dpi=150, bbox_inches="tight",
                facecolor=fig.get_facecolor())
    print(f"\n✓ Chart saved: {filename}")
    plt.show()


async def main(args):
    uid   = args.uid
    days  = args.days or 90
    since = args.since or (datetime.now() - timedelta(days=days)).strftime("%Y-%m-%d")

    print(f"\n{'='*55}")
    print(f"  Water Level Visualizer — UID {uid}")
    print(f"  From: {since}")
    print(f"{'='*55}\n")

    pool = await aiomysql.create_pool(**MYSQL_CONFIG, minsize=1, maxsize=3)

    try:
        # Fetch borewell info
        bw = await fetch_borewell_info(pool, uid)
        if not bw:
            print(f"✗ No borewell record found for UID {uid}")
            return

        motor_hp   = float(bw.get("motor_hp") or 12.5)
        depth_ft   = get_depth_for_hp(motor_hp)
        farm_name  = bw.get("farm_name") or ""
        rated_lpm  = borewell_lpm_rated(motor_hp, depth_ft)

        # Full static depth
        fsd = bw.get("full_static_depth")
        if fsd and float(fsd) > 0:
            full_static_depth = float(fsd)
            print(f"  SWL source   : DB (full_static_depth = {full_static_depth} ft)")
        else:
            full_static_depth = round(depth_ft * SWL_RATIO, 1)
            print(f"  SWL source   : SWL_RATIO fallback ({full_static_depth} ft)")

        print(f"  Motor HP     : {motor_hp} HP")
        print(f"  Depth        : {depth_ft} ft")
        print(f"  Rated LPM    : {rated_lpm} L/min")
        print(f"  Farm         : {farm_name}")

        # Fetch AP rows
        print(f"\n  Fetching AP rows from {since}...")
        ap_rows = await fetch_ap_rows(pool, uid, since)
        print(f"  AP rows found: {len(ap_rows)}")

        if not ap_rows:
            print("✗ No AP data found. Check UID or date range.")
            return

        # Check if actual_borewell_depth already filled
        has_stored = any(
            r.get("actual_borewell_depth") and
            float(r.get("actual_borewell_depth") or 0) > 0
            for r in ap_rows
        )

        if has_stored:
            print("  Depth source : actual_borewell_depth from DB (cron already ran)")
            series = compute_water_level_series_from_db(ap_rows)
        else:
            print("  Depth source : computing now using PHP formula...")
            peak_va = await fetch_peak_va(pool, uid)
            print(f"  Peak motor VA: {peak_va}")
            enriched = compute_depth_series(ap_rows, motor_hp, full_static_depth, peak_va)
            print(f"  Enriched rows: {len(enriched)}")
            series = aggregate_daily(enriched)

        print(f"  Daily points : {len(series)}")

        if not series:
            print("✗ No depth series generated. Check AP data quality.")
            return

        # Print sample
        print(f"\n  Sample (last 5 days):")
        print(f"  {'Date':<12} {'Avg ft':>8} {'Max ft':>8} {'Min ft':>8} {'Static ft':>10}")
        print(f"  {'-'*50}")
        for d in series[-5:]:
            print(f"  {d['date']:<12} {d['avg_depth_ft']:>8.1f} "
                  f"{d['max_depth_ft']:>8.1f} {d['min_depth_ft']:>8.1f} "
                  f"{str(d['static_depth_ft'] or '—'):>10}")

        # Plot
        print(f"\n  Plotting...")
        plot_water_level(series, uid, motor_hp, depth_ft,
                         full_static_depth, farm_name)

    finally:
        pool.close()
        await pool.wait_closed()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Water Level Trend Visualizer")
    parser.add_argument("--uid",   required=True, type=str, help="Device UID")
    parser.add_argument("--since", type=str, help="Start date YYYY-MM-DD")
    parser.add_argument("--days",  type=int, help="Days back from today (default 90)")
    args = parser.parse_args()
    asyncio.run(main(args))
ENDOFFILE

