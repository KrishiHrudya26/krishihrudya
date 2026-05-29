"""
borewell_intelligence/calculations.py

Qd/Qr computed from actual_borewell_depth (dynamic_depth) and cycle_static_depth
stored in chart_power_analytics — no AP-ratio approximation needed.

Water depth per reading derived from PHP formula:
  - motor_start_va → cycle_static_depth (how much aquifer recovered this cycle)
  - apparent_power → dynamic_depth (where water is right now within cycle)
"""
import hashlib
import math
import random
import statistics
import warnings
from collections import defaultdict
from datetime import datetime, timedelta, date
from typing import Optional


PIPE_DIAMETER_MM   = 50
PIPE_C             = 120
PUMP_EFFICIENCY    = 0.60
DISCHARGE_HEAD_FT  = 33.0
GRAVITY            = 9.81
SWL_RATIO          = 0.35
MAX_VALID_REST_MIN = 360
PIPE_VOLUME_FT     = 0.5986

HP_DEPTH_MAP: dict[float, float] = {
    5.0:  300.0, 6.0:  300.0, 7.0:  400.0, 7.5:  400.0, 8.0:  400.0,
    10.0: 600.0, 12.5: 800.0, 15.0: 900.0, 17.5: 1100.0, 20.0: 1300.0,
}

HP_TTS_RANGE: dict[float, tuple] = {
    5.0:  (25, 27), 6.0:  (25, 28), 7.0:  (26, 29), 7.5:  (26, 29),
    8.0:  (27, 30), 10.0: (28, 32), 12.5: (30, 34), 15.0: (32, 36),
    17.5: (34, 38), 20.0: (36, 40),
}

GEO_BOUNDS = {
    "borewell_depth_ft":     (300,   1300),
    "motor_depth_ft":        (100,   1250),
    "swl_ft":                (20,    450),
    "usable_col_m":          (1,     80),
    "motor_hp":              (0.5,   20.0),
    "lpm":                   (3,     300),
    "qd_m_hr":               (0.05,  15.0),
    "qr_m_hr":               (0.02,  15.0),
    "ratio_qr_qd":           (0.0,   1.0),
    "session_duration_min":  (2,     300),
    "avg_daily_runtime_min": (10,    720),
    "total_daily_yield_l":   (200,   200000),
    "apparent_power_kw":     (0.2,   18.0),
}


def get_depth_for_hp(hp: float) -> float:
    if hp in HP_DEPTH_MAP:
        return HP_DEPTH_MAP[hp]
    return HP_DEPTH_MAP[min(HP_DEPTH_MAP.keys(), key=lambda k: abs(k - hp))]


def generate_tts_for_hp(hp: float, uid: str = "") -> float:
    seed    = int(hashlib.md5(uid.encode()).hexdigest()[:8], 16) if uid else 42
    rng     = random.Random(seed)
    closest = min(HP_TTS_RANGE.keys(), key=lambda k: abs(k - hp))
    lo, hi  = HP_TTS_RANGE[closest]
    return round(rng.uniform(lo, hi), 1)


def borewell_lpm_rated(hp: float, depth: float) -> float:
    if hp <= 0 or depth <= 0:
        return 0.0
    pl_ft        = depth - 100.0
    pl_m         = pl_ft / 3.281
    static_tdh_m = (pl_ft + 33.0) / 3.281
    try:
        q1_m3s = ((hp * 746 * 0.60 * 60) / (9.81 * static_tdh_m)) / 60000.0
        hf_m   = (10.67 * pl_m * (q1_m3s ** 1.852)) / ((120.0 ** 1.852) * (0.05 ** 4.87))
        tdh_m  = (pl_ft + (hf_m * 3.281) + 33.0) / 3.281
        return round((hp * 746 * 0.60 * 60) / (9.81 * tdh_m), 2)
    except Exception:
        return 0.0


def compute_static_depth_tts(time_to_surface_s: float, rated_lpm: float) -> float:
    if time_to_surface_s <= 0 or rated_lpm <= 0:
        return 0.0
    return round((time_to_surface_s * rated_lpm) / (60.0 * PIPE_VOLUME_FT), 2)


# ── NEW: PHP formula translated to Python ─────────────────────────────────────
def derive_water_depth(
    apparent_power: float,
    motor_start_va: float,
    peak_motor_va: float,
    motor_hp: float,
    borewell_depth: float,
    full_static_depth: float,
    v_avg: float,
    phase_imbalance: float,
) -> float:
    """
    Derives current water depth in feet from electrical readings.
    Translated directly from PHP deriveWaterDepth().

    apparent_power   : live VA this reading
    motor_start_va   : VA at motor start this cycle
    peak_motor_va    : best ever motor_start_va for this device
    motor_hp         : nameplate HP
    borewell_depth   : total borewell depth in feet
    full_static_depth: full recovery reference depth (depth × SWL_RATIO if unknown)
    v_avg            : average of 3 phase voltages
    phase_imbalance  : phase current imbalance % (0-100)
    """
    pump_depth_ft = borewell_depth - 100.0
    rated_amps    = (motor_hp * 746.0) / (1.7321 * v_avg * 0.84 * 0.83) if v_avg > 0 else 0
    dry_run_va    = rated_amps * 0.31 * v_avg if v_avg > 0 else motor_hp * 80 * 0.31

    # ── STEP A: Cycle-specific static depth ───────────────────────────────────
    va_range = float(peak_motor_va) - dry_run_va

    if va_range > 0:
        recovery_ratio = (float(motor_start_va) - dry_run_va) / va_range
        recovery_ratio = max(0.0, min(1.0, recovery_ratio))
    else:
        recovery_ratio = 1.0

    cycle_static_depth = pump_depth_ft - (pump_depth_ft - full_static_depth) * recovery_ratio
    cycle_static_depth = max(full_static_depth, min(pump_depth_ft - 10.0, cycle_static_depth))

    # ── STEP B: Guard conditions ──────────────────────────────────────────────
    if apparent_power <= dry_run_va:
        return round(pump_depth_ft, 2), round(cycle_static_depth, 2)

    if motor_start_va <= dry_run_va:
        return round(cycle_static_depth, 2), round(cycle_static_depth, 2)

    # ── STEP C: Drawdown interpolation ───────────────────────────────────────
    va_window  = float(motor_start_va) - dry_run_va
    work_ratio = (apparent_power - dry_run_va) / va_window
    work_ratio = max(0.0, min(1.0, work_ratio))

    # Phase imbalance correction
    if phase_imbalance > 8.0:
        penalty    = min(0.12, (phase_imbalance - 8.0) / 100.0 * 0.6)
        work_ratio = min(1.0, work_ratio + penalty)

    available_column = pump_depth_ft - cycle_static_depth
    current_depth    = cycle_static_depth + (available_column * (1.0 - work_ratio))
    current_depth    = max(cycle_static_depth, min(pump_depth_ft, current_depth))

    return round(current_depth, 2), round(cycle_static_depth, 2)


def detect_cycles(power_rows: list, gap_minutes: float = 15.0) -> list[dict]:
    """
    Detect pump cycles from chart_power_analytics rows.
    A new cycle starts when gap between consecutive readings > gap_minutes.

    Returns list of cycles, each with:
      { 'rows': [...], 'start': datetime, 'end': datetime }
    """
    if not power_rows:
        return []

    sorted_rows = sorted(power_rows, key=lambda r: r["created_at"])
    cycles      = []
    current     = [sorted_rows[0]]

    for row in sorted_rows[1:]:
        gap = (row["created_at"] - current[-1]["created_at"]).total_seconds() / 60.0
        if gap > gap_minutes:
            cycles.append({
                "rows":  current,
                "start": current[0]["created_at"],
                "end":   current[-1]["created_at"],
            })
            current = [row]
        else:
            current.append(row)

    if current:
        cycles.append({
            "rows":  current,
            "start": current[0]["created_at"],
            "end":   current[-1]["created_at"],
        })

    return cycles


def clean_ap_series(ap_values: list, iqr_multiplier: float = 2.5) -> list:
    valid = [float(v) for v in ap_values if v is not None and float(v) > 0]
    if len(valid) < 4:
        return valid
    sorted_v = sorted(valid)
    n  = len(sorted_v)
    q1 = sorted_v[n // 4]
    q3 = sorted_v[(3 * n) // 4]
    iqr = q3 - q1
    if iqr == 0:
        return valid
    lo = q1 - iqr_multiplier * iqr
    hi = q3 + iqr_multiplier * iqr
    cleaned = [v for v in valid if lo <= v <= hi]
    if len(cleaned) < len(valid):
        warnings.warn(
            f"clean_ap_series: removed {len(valid)-len(cleaned)} spike(s) "
            f"outside IQR fence [{lo:.1f}, {hi:.1f}] W.",
            RuntimeWarning,
        )
    return cleaned


# ── Qd/Qr from actual_borewell_depth and cycle_static_depth ──────────────────
def compute_qd_qr_from_depth(
    power_rows: list,
    gap_minutes: float = 15.0,
    max_valid_rest_min: float = MAX_VALID_REST_MIN,
) -> dict:
    """
    Compute Qd and Qr from actual stored depth values.

    power_rows: list of dicts with keys:
      actual_borewell_depth, cycle_static_depth, created_at

    Qd = (depth_end_session - cycle_static_depth) / session_hours
    Qr = (cycle_static_depth_next - cycle_static_depth_prev_end) / rest_hours
         → how fast water recovered between sessions
    Qr capped at Qd (hard rock physical constraint)
    """
    empty = {
        "qd_m_hr": 0.0, "qr_m_hr": 0.0, "ratio_qr_qd": 0.0,
        "data_quality": {"days_with_qd": 0, "days_with_qr": 0,
                         "cycles_found": 0},
    }

    valid_rows = [
        r for r in power_rows
        if r.get("actual_borewell_depth") and r.get("cycle_static_depth")
        and float(r["actual_borewell_depth"] or 0) > 0
        and float(r["cycle_static_depth"] or 0) > 0
    ]

    if not valid_rows:
        return empty

    cycles = detect_cycles(valid_rows, gap_minutes)
    if not cycles:
        return empty

    qd_by_day: dict = {}
    qr_by_day: dict = {}

    for i, cycle in enumerate(cycles):
        rows     = cycle["rows"]
        duration = (cycle["end"] - cycle["start"]).total_seconds() / 3600.0
        if duration < (3 / 60) or len(rows) < 2:
            continue

        cycle_static = float(rows[0]["cycle_static_depth"])
        depth_end    = float(rows[-1]["actual_borewell_depth"])

        # Qd — drawdown during this session
        drawdown_ft = max(0.0, depth_end - cycle_static)
        drawdown_m  = drawdown_ft / 3.281
        qd          = drawdown_m / duration if duration > 0 else 0

        lo, hi = GEO_BOUNDS["qd_m_hr"]
        if lo <= qd <= hi:
            qd_by_day.setdefault(cycle["start"].date(), []).append(round(qd, 3))

        # Qr — recovery between this cycle and next
        if i + 1 < len(cycles):
            next_cycle   = cycles[i + 1]
            rest_hr      = (next_cycle["start"] - cycle["end"]).total_seconds() / 3600.0

            if 0 < rest_hr <= (max_valid_rest_min / 60.0):
                # How much did water recover? Compare end depth vs next cycle start depth
                depth_end_this  = float(rows[-1]["actual_borewell_depth"])
                depth_start_next= float(next_cycle["rows"][0]["cycle_static_depth"])

                recovery_ft = max(0.0, depth_end_this - depth_start_next)
                recovery_m  = recovery_ft / 3.281
                qr          = recovery_m / rest_hr if rest_hr > 0 else 0

                lo, hi = GEO_BOUNDS["qr_m_hr"]
                if lo <= qr <= hi:
                    qr_by_day.setdefault(cycle["start"].date(), []).append(round(qr, 3))

    daily_qd = [statistics.median(v) for v in qd_by_day.values()]
    daily_qr = [statistics.median(v) for v in qr_by_day.values()]
    avg_qd   = round(statistics.median(daily_qd), 3) if daily_qd else 0.0
    avg_qr   = round(statistics.median(daily_qr), 3) if daily_qr else 0.0
    avg_qr   = min(avg_qr, avg_qd)  # Qr never > Qd in hard rock

    return {
        "qd_m_hr":     avg_qd,
        "qr_m_hr":     avg_qr,
        "ratio_qr_qd": round(avg_qr / avg_qd, 2) if avg_qd > 0 else 0.0,
        "data_quality": {
            "days_with_qd": len(daily_qd),
            "days_with_qr": len(daily_qr),
            "cycles_found": len(cycles),
        },
    }


# ── Keep old compute_qd_qr as fallback when no depth data available ───────────
def compute_qd_qr(sessions_unused: list, power_rows: list,
                  swl_ref_ft: float, motor_depth_ft: float,
                  ap_end_window_min: float = 5.0,
                  max_valid_rest_min: float = MAX_VALID_REST_MIN,
                  motor_hp: float = 12.5) -> dict:
    """Legacy AP-ratio based Qd/Qr — used as fallback only."""
    tdh_ref_ft = (motor_depth_ft - swl_ref_ft) + DISCHARGE_HEAD_FT
    empty = {
        "qd_m_hr": 0.0, "qr_m_hr": 0.0, "ratio_qr_qd": 0.0,
        "data_quality": {"days_with_qd": 0, "days_with_qr": 0,
                         "ap_readings_used": 0, "ap_sessions_found": 0},
    }
    if not power_rows:
        return empty

    all_ap_w = sorted([
        float(r["apparent_power"]) for r in power_rows
        if r.get("apparent_power") and float(r["apparent_power"]) > 0
    ])
    if not all_ap_w:
        return empty

    global_ref_w = all_ap_w[max(0, int(len(all_ap_w) * 0.95) - 1)]
    cycles       = detect_cycles(power_rows, gap_minutes=15.0)

    qd_by_day: dict = {}
    qr_by_day: dict = {}

    for i, cycle in enumerate(cycles):
        rdgs        = [(r["created_at"], float(r["apparent_power"]))
                       for r in cycle["rows"] if r.get("apparent_power")]
        if len(rdgs) < 3:
            continue
        duration_hr = (cycle["end"] - cycle["start"]).total_seconds() / 3600.0
        if duration_hr < (3 / 60):
            continue

        cutoff     = max(1, int(len(rdgs) * 0.20))
        ap_start_w = sum(ap for _, ap in rdgs[:cutoff]) / cutoff
        window_ts  = cycle["end"] - timedelta(minutes=ap_end_window_min)
        end_rdgs   = [(ts, ap) for ts, ap in rdgs if ts >= window_ts] or rdgs[-2:]
        ap_end_w   = sum(ap for _, ap in end_rdgs) / len(end_rdgs)

        if ap_start_w <= 0:
            continue

        ap_ratio    = ap_end_w / ap_start_w
        drawdown_ft = tdh_ref_ft * (1.0 - ap_ratio)
        drawdown_m  = max(0.0, drawdown_ft / 3.281)
        qd          = drawdown_m / duration_hr if duration_hr > 0 else 0

        lo, hi = GEO_BOUNDS["qd_m_hr"]
        if lo <= qd <= hi:
            qd_by_day.setdefault(cycle["start"].date(), []).append(round(qd, 3))

        if i + 1 < len(cycles):
            next_cycle = cycles[i + 1]
            rest_hr    = (next_cycle["start"] - cycle["end"]).total_seconds() / 3600.0
            if rest_hr <= 0 or rest_hr > (max_valid_rest_min / 60.0):
                continue

            tail_count      = max(1, int(len(rdgs) * 0.15))
            ap_end_prev_w   = sum(ap for _, ap in rdgs[-tail_count:]) / tail_count
            next_rdgs       = [(r["created_at"], float(r["apparent_power"]))
                               for r in next_cycle["rows"] if r.get("apparent_power")]
            head_count      = max(1, int(len(next_rdgs) * 0.20))
            ap_start_curr_w = sum(ap for _, ap in next_rdgs[:head_count]) / head_count

            if global_ref_w <= 0 or ap_end_prev_w <= 0 or ap_start_curr_w <= 0:
                continue

            dd_end_prev   = tdh_ref_ft * max(0.0, 1.0 - ap_end_prev_w   / global_ref_w)
            dd_start_curr = tdh_ref_ft * max(0.0, 1.0 - ap_start_curr_w / global_ref_w)
            recovery_m    = max(0.0, (dd_end_prev - dd_start_curr) / 3.281)
            qr            = recovery_m / rest_hr if rest_hr > 0 else 0

            lo, hi = GEO_BOUNDS["qr_m_hr"]
            if lo <= qr <= hi:
                qr_by_day.setdefault(cycle["start"].date(), []).append(round(qr, 3))

    daily_qd = [statistics.median(v) for v in qd_by_day.values()]
    daily_qr = [statistics.median(v) for v in qr_by_day.values()]
    avg_qd   = round(statistics.median(daily_qd), 3) if daily_qd else 0.0
    avg_qr   = round(statistics.median(daily_qr), 3) if daily_qr else 0.0
    avg_qr   = min(avg_qr, avg_qd)

    return {
        "qd_m_hr":     avg_qd,
        "qr_m_hr":     avg_qr,
        "ratio_qr_qd": round(avg_qr / avg_qd, 2) if avg_qd > 0 else 0.0,
        "data_quality": {
            "days_with_qd":      len(daily_qd),
            "days_with_qr":      len(daily_qr),
            "ap_readings_used":  len(all_ap_w),
            "ap_sessions_found": len(cycles),
        },
    }


# ── Water level series from stored depth values ───────────────────────────────
def compute_water_level_series_from_db(power_rows: list) -> list:
    """
    Build water level trend from actual_borewell_depth and cycle_static_depth
    stored in chart_power_analytics.

    Returns daily aggregated series with:
      date, avg_depth_ft, max_depth_ft, min_depth_ft, static_depth_ft
    """
    daily: dict[str, dict] = defaultdict(lambda: {
        "depths": [], "static_depths": []
    })

    for r in power_rows:
        depth  = r.get("actual_borewell_depth")
        static = r.get("cycle_static_depth")
        ts     = r.get("created_at")

        if not depth or not ts:
            continue
        try:
            depth_val = float(depth)
        except (ValueError, TypeError):
            continue
        if depth_val <= 0:
            continue

        day = ts.strftime("%Y-%m-%d") if isinstance(ts, datetime) else str(ts)[:10]
        daily[day]["depths"].append(depth_val)

        if static:
            try:
                daily[day]["static_depths"].append(float(static))
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


# ── Fallback: estimate water level from AP when no depth data in DB ───────────
def compute_water_level_series(power_rows: list, motor_hp: float,
                                static_depth: float, depth: float) -> list:
    """
    Fallback estimator using AP ratios.
    Used only when actual_borewell_depth not yet backfilled in DB.
    """
    rated_lpm = borewell_lpm_rated(motor_hp, depth)
    pump_depth = depth - 100.0
    max_va     = motor_hp * 730.0
    dry_run_va = max_va * 0.35

    daily: dict[str, list[float]] = defaultdict(list)
    for r in power_rows:
        raw = r.get("apparent_power")
        if not raw:
            continue
        ap_va = float(raw)
        if ap_va <= 0:
            continue

        if ap_va >= max_va:
            work_ratio = 1.0
        elif ap_va <= dry_run_va:
            work_ratio = 0.0
        else:
            work_ratio = (ap_va - dry_run_va) / (max_va - dry_run_va)

        current_depth = static_depth + (pump_depth - static_depth) * (1.0 - work_ratio)
        current_depth = round(max(static_depth, min(pump_depth, current_depth)), 2)

        day = r["created_at"].strftime("%Y-%m-%d")
        daily[day].append(current_depth)

    series = []
    for day in sorted(daily.keys()):
        depths = daily[day]
        series.append({
            "date":            day,
            "avg_depth_ft":    round(sum(depths) / len(depths), 1),
            "max_depth_ft":    round(max(depths), 1),
            "min_depth_ft":    round(min(depths), 1),
            "static_depth_ft": round(static_depth, 1),
        })
    return series


# ── Health score ──────────────────────────────────────────────────────────────
def compute_health_score(
    sessions: list, qd_m_hr: float, qr_m_hr: float, ratio_qr_qd: float,
    avg_apparent_power_kw: float, motor_hp: float, dry_run_trips: int,
    power_fail_trips: int, avg_daily_runtime_min: float, usable_col_m: float,
    estimated_lpm: float, total_days_in_range: int,
) -> dict:
    if not motor_hp or motor_hp <= 0:
        raise ValueError(f"motor_hp must be positive. Got: {motor_hp}")
    theoretical_kw = motor_hp * 0.746
    motor_eff_pct  = min(100.0, (avg_apparent_power_kw / theoretical_kw) * 100
                         ) if theoretical_kw > 0 else 0.0
    safe_pump_min  = (round(((usable_col_m * 0.70) / qd_m_hr) * 60)
                      if qd_m_hr > 0 else max(30, round(avg_daily_runtime_min / 3)))
    recovery_min   = (round(((usable_col_m * 0.70) / qr_m_hr) * 60)
                      if qr_m_hr > 0 else max(45, round(avg_daily_runtime_min / 2)))
    if   ratio_qr_qd >= 1.0:  depletion_risk = 0.0
    elif ratio_qr_qd >= 0.70: depletion_risk = 20.0
    elif ratio_qr_qd >= 0.50: depletion_risk = 45.0
    elif ratio_qr_qd >= 0.30: depletion_risk = 70.0
    else:                      depletion_risk = 90.0
    depletion_risk   = min(100.0, depletion_risk + dry_run_trips * 5)
    recharge_score   = min(100.0, ratio_qr_qd * 100.0)
    efficiency_score = min(100.0, motor_eff_pct)
    stability_score  = max(0.0, 100.0 - min(40, dry_run_trips * 8 + power_fail_trips * 3))
    runtime_score    = max(0.0, 100.0 - max(0.0, avg_daily_runtime_min - 480.0) / 6.0)
    health_score = round(min(100.0, max(0.0,
        recharge_score * 0.35 + stability_score * 0.25 +
        efficiency_score * 0.20 + runtime_score * 0.20
    )), 1)
    rating = ("A" if health_score >= 85 else "B" if health_score >= 70 else
              "C" if health_score >= 55 else "D" if health_score >= 40 else "F")
    return {
        "health_score": health_score, "health_rating": rating,
        "motor_efficiency_pct": round(motor_eff_pct, 1),
        "depletion_risk_pct":   round(depletion_risk, 1),
        "safe_pump_min":        max(20, min(120, safe_pump_min)),
        "recovery_min":         max(20, min(480, recovery_min)),
        "avg_session_dur_min":  round(
            sum(s["duration_min"] for s in sessions) / len(sessions), 1
        ) if sessions else 0.0,
    }


# ── Schedule ──────────────────────────────────────────────────────────────────
def compute_schedule(
    qd_m_hr: float, qr_m_hr: float, usable_col_m: float, estimated_lpm: float,
    safe_pump_min: int, recovery_min: int, borewell_depth_ft: float, motor_hp: float,
    lpcd: float = 108.0, schedule_start: str = "05:30",
) -> dict:
    safe_pump_min = max(20, min(120, safe_pump_min))
    recovery_min  = max(safe_pump_min, min(480, recovery_min))
    cycle_min     = safe_pump_min + recovery_min
    max_sessions     = int(1440 / cycle_min) if cycle_min > 0 else 3
    sessions_per_day = max(1, min(5, max_sessions - 1) if max_sessions > 2 else max_sessions)
    yield_per_session = round(estimated_lpm * safe_pump_min) if estimated_lpm > 0 else 0
    total_daily_yield = yield_per_session * sessions_per_day
    people_served     = int(total_daily_yield / lpcd) if lpcd > 0 else 0
    purposes  = ["Morning peak demand","Mid-morning supply","Afternoon supply",
                 "Evening peak demand","Night reserve"]
    schedule  = []
    h0, m0    = map(int, schedule_start.split(":"))
    cur_start = h0 * 60 + m0
    for i in range(sessions_per_day):
        end_min  = cur_start + safe_pump_min
        rest_min = end_min + recovery_min
        schedule.append({
            "session":    i + 1,
            "start":      f"{(cur_start//60)%24:02d}:{cur_start%60:02d}",
            "pump_until": f"{(end_min//60)%24:02d}:{end_min%60:02d}",
            "rest_until": f"{(rest_min//60)%24:02d}:{rest_min%60:02d}",
            "yield_l":    yield_per_session,
            "purpose":    purposes[i] if i < len(purposes) else "Additional supply",
        })
        cur_start = rest_min
    return {
        "safe_pump_min": safe_pump_min, "recovery_min": recovery_min,
        "sessions_per_day": sessions_per_day,
        "yield_per_session_l": yield_per_session,
        "total_daily_yield_l": total_daily_yield,
        "people_served": people_served, "lpcd_used": lpcd,
        "session_schedule": schedule,
        "dynamic_rules": [
            {"condition":"Water level too low at session start", "action":"Reduce session by 20 min","severity":"amber"},
            {"condition":"Motor power drops >25% mid-session",   "action":"Stop pump immediately",   "severity":"red"},
            {"condition":"Motor power drops >35% — dry run risk","action":"Hard stop + 2 hr cooldown","severity":"red"},
            {"condition":"Dry run trip detected",                "action":"Stop + 2 hr cooldown",    "severity":"red"},
            {"condition":"Power failure during session",         "action":"Resume after 30 min",      "severity":"amber"},
            {"condition":"Recharge ratio drops below 0.50",      "action":"Reduce to 2 sessions/day", "severity":"red"},
            {"condition":"Daily yield drops >25%",               "action":"Schedule maintenance check","severity":"amber"},
        ],
        "qd_m_hr": qd_m_hr, "qr_m_hr": qr_m_hr,
    }


# ── Session parser (for dry_run/power_fail trip counts only) ─────────────────
def parse_sessions(events: list) -> list:
    sorted_events = sorted(events, key=lambda e: e["created_at"])
    sessions, current_start = [], None
    for ev in sorted_events:
        msg = ev.get("message", "") or ""
        ts  = ev["created_at"]
        if "Motor started" in msg:
            current_start = ts
        elif "Motor stopped" in msg and current_start is not None:
            duration = max(0.0, (ts - current_start).total_seconds() / 60.0)
            if   "POWER FAILURE"  in msg:                     reason = "power_failure"
            elif "UNDERLOAD" in msg or "DRYRUN" in msg \
                             or "DRY RUN" in msg:             reason = "dry_run"
            elif "REMOTE COMMAND" in msg:                     reason = "remote_stop"
            elif "MANUAL"         in msg:                     reason = "manual_stop"
            elif "AUTO"           in msg:                     reason = "auto_stop"
            else:                                             reason = "unknown"
            sessions.append({"start": current_start, "end": ts,
                              "duration_min": round(duration, 1), "stop_reason": reason})
            current_start = None
    return sessions


def compute_rest_periods(sessions: list,
                         max_valid_rest_min: float = MAX_VALID_REST_MIN) -> list:
    rests = []
    for i in range(1, len(sessions)):
        gap = (sessions[i]["start"] - sessions[i-1]["end"]).total_seconds() / 60.0
        if 0 < gap <= max_valid_rest_min:
            rests.append(round(gap, 1))
    return rests
