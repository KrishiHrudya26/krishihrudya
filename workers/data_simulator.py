"""
KrishiHrudya Data Simulator — respects motor commands from DB
"""
import sys, time, uuid, random, logging, psycopg
from datetime import datetime, timezone

logging.basicConfig(level=logging.INFO, format='%(asctime)s [SIM] %(levelname)s %(message)s', datefmt='%Y-%m-%d %H:%M:%S')
log = logging.getLogger(__name__)

BUSINESS_DB = "postgresql://khuser:KHdb%4026@localhost:5432/kh_business"
SENSOR_DB   = "postgresql://khuser:KHdb%4026@localhost:5432/kh_sensors"
device_states = {}
# Track last known command per UID: None=no command, True=on, False=off
device_commands = {}

def init_device_state(uid, farm_id=None, user_id=None, pump_name=None):
    return {
        "uid": uid, "motor_state": random.choice([0,1]), "power_avail": 1,
        "device_state": random.randint(1,5), "total_run_time": random.uniform(0,500),
        "heart_beat": 0,
        "voltage1": random.uniform(390,415), "voltage2": random.uniform(390,415), "voltage3": random.uniform(390,415),
        "current1": random.uniform(2,15), "current2": random.uniform(2,15), "current3": random.uniform(2,15),
        "signal": random.randint(60,95),
        "farm_id": farm_id, "user_id": user_id, "pump_name": pump_name or f"Pump_{uid[-4:]}",
    }

def get_pending_command(uid):
    """Check kh_sensors for any pending motor command for this UID."""
    try:
        with psycopg.connect(SENSOR_DB) as conn:
            with conn.cursor() as cur:
                # Check starter_data for command_issued field
                cur.execute("""
                    SELECT command_issued FROM starter_data
                    WHERE uid = %s ORDER BY captured_date DESC LIMIT 1
                """, (uid,))
                row = cur.fetchone()
                if row and row[0] is not None:
                    return int(row[0])  # 1=on, 0=off, 2=pending
    except Exception as e:
        log.warning(f"[SIM] Could not fetch command for {uid}: {e}")
    return None

def check_valve_command(uid):
    """Check kh_business valve_commands for latest motor command."""
    try:
        with psycopg.connect(BUSINESS_DB) as conn:
            with conn.cursor() as cur:
                cur.execute("""
                    SELECT command, created_at FROM valve_commands
                    WHERE uid = %s AND command IN ('on','off')
                    ORDER BY created_at DESC LIMIT 1
                """, (uid,))
                row = cur.fetchone()
                if row:
                    return row[0]  # 'on' or 'off'
    except Exception:
        pass
    return None

def evolve_device_state(state, forced_motor=None):
    # If a command was issued, respect it
    if forced_motor is not None:
        state["motor_state"] = 1 if forced_motor == 'on' else 0
    elif random.random() < 0.1:
        state["motor_state"] = 1 - state["motor_state"]

    state["power_avail"] = 0 if random.random() < 0.05 else 1

    if state["motor_state"] == 1 and state["power_avail"] == 1:
        state["device_state"] = 1
        state["total_run_time"] += 0.5
    elif state["power_avail"] == 0:
        state["device_state"] = 6
    else:
        t = random.random()
        state["device_state"] = 7 if t < 0.02 else 8 if t < 0.04 else 9 if t < 0.05 else 2

    state["voltage1"] = max(350, min(440, state["voltage1"] + random.uniform(-2,2)))
    state["voltage2"] = max(350, min(440, state["voltage2"] + random.uniform(-2,2)))
    state["voltage3"] = max(350, min(440, state["voltage3"] + random.uniform(-2,2)))

    if state["motor_state"] == 1:
        state["current1"] = max(2, min(20, state["current1"] + random.uniform(-0.5,0.5)))
        state["current2"] = max(2, min(20, state["current2"] + random.uniform(-0.5,0.5)))
        state["current3"] = max(2, min(20, state["current3"] + random.uniform(-0.5,0.5)))
    else:
        state["current1"] = random.uniform(0, 0.5)
        state["current2"] = random.uniform(0, 0.5)
        state["current3"] = random.uniform(0, 0.5)

    state["signal"] = max(40, min(99, state["signal"] + random.randint(-2,2)))
    state["heart_beat"] = (state["heart_beat"] + 1) % 65535
    return state

def get_uids_from_borewell():
    result = {}
    try:
        with psycopg.connect(BUSINESS_DB) as conn:
            with conn.cursor() as cur:
                cur.execute("""
                    SELECT b.uid, b.farm_id, f.user_id, b.borewell_name
                    FROM borewell b LEFT JOIN farms f ON b.farm_id = f.farm_id
                    WHERE b.uid IS NOT NULL ORDER BY b.created_at ASC
                """)
                for row in cur.fetchall():
                    uid = str(row[0]).strip()
                    result[uid] = {"farm_id": row[1], "user_id": row[2], "pump_name": row[3] or f"Pump_{uid[-4:]}"}
        log.info(f"[BUSINESS DB] {len(result)} UIDs from borewell")
    except Exception as e:
        log.error(f"[BUSINESS DB] {e}")
    return result

def get_uids_from_starter_data():
    result = {}
    try:
        with psycopg.connect(SENSOR_DB) as conn:
            with conn.cursor() as cur:
                cur.execute("""
                    SELECT DISTINCT ON (uid) uid, farm_id, user_id, pump_name
                    FROM starter_data WHERE uid IS NOT NULL
                    ORDER BY uid, captured_date DESC
                """)
                for row in cur.fetchall():
                    uid = str(row[0]).strip()
                    result[uid] = {"farm_id": row[1], "user_id": row[2], "pump_name": row[3] or f"Pump_{uid[-4:]}"}
        log.info(f"[SENSOR DB] {len(result)} UIDs from starter_data")
    except Exception as e:
        log.error(f"[SENSOR DB] {e}")
    return result

def ensure_settings(uid):
    try:
        with psycopg.connect(SENSOR_DB) as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT uid FROM starter_settings WHERE uid = %s", (uid,))
                if not cur.fetchone():
                    cur.execute("""
                        INSERT INTO starter_settings (uid, auto_manual, overload_limit, underload_limit, pump_flow_rate, created_at, updated_at)
                        VALUES (%s,%s,%s,%s,%s,%s,%s) ON CONFLICT (uid) DO NOTHING
                    """, (uid, True, round(random.uniform(15,25),2), round(random.uniform(1,5),2), round(random.uniform(100,300),2), datetime.now(timezone.utc), datetime.now(timezone.utc)))
                    conn.commit()
    except Exception as e:
        log.warning(f"[SIM] Settings failed {uid}: {e}")

def upsert_statistics(state):
    uid = state["uid"]
    now = datetime.now(timezone.utc)
    run_day = state["total_run_time"] % 1440
    run_week = state["total_run_time"] % 10080
    run_mon = state["total_run_time"]
    try:
        with psycopg.connect(SENSOR_DB) as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT uid FROM starter_statistics WHERE uid = %s", (uid,))
                if cur.fetchone():
                    cur.execute("""
                        UPDATE starter_statistics SET
                            total_run_time_for_the_day=%s, total_run_time_for_the_week=%s,
                            total_run_time_for_the_month=%s,
                            day_water_yield=%s, month_water_yield=%s,
                            total_on_off_cycles=total_on_off_cycles+%s,
                            total_overload_trips=total_overload_trips+%s,
                            total_underload_trips=total_underload_trips+%s,
                            last_sync_time=%s, updated_at=%s
                        WHERE uid=%s
                    """, (round(run_day,2), round(run_week,2), round(run_mon,2),
                          round(run_day*random.uniform(150,200),2), round(run_mon*random.uniform(150,200),2),
                          1 if random.random()<0.05 else 0,
                          1 if state["device_state"]==7 else 0,
                          1 if state["device_state"]==8 else 0,
                          now, now, uid))
                else:
                    cur.execute("""
                        INSERT INTO starter_statistics (uid, total_run_time_for_the_day, total_run_time_for_the_week, total_run_time_for_the_month, day_water_yield, month_water_yield, total_on_off_cycles, total_overload_trips, total_underload_trips, last_sync_time, created_at, updated_at)
                        VALUES (%s,%s,%s,%s,%s,%s,0,0,0,%s,%s,%s)
                    """, (uid, round(run_day,2), round(run_week,2), round(run_mon,2),
                          round(run_day*150,2), round(run_mon*150,2), now, now, now))
            conn.commit()
    except Exception as e:
        log.error(f"[SENSOR DB] Stats failed {uid}: {e}")

def insert_telemetry(state):
    uid = state["uid"]
    now = datetime.now(timezone.utc)
    try:
        with psycopg.connect(SENSOR_DB) as conn:
            with conn.cursor() as cur:
                cur.execute("""
                    INSERT INTO starter_data (
                        sd_id, user_id, farm_id, uid, slno, pump_name,
                        voltage1, voltage2, voltage3, current1, current2, current3,
                        power_available, motor_state, device_state, total_run_time,
                        client_command_reset, heart_beat, device_mode,
                        calibration_factor1, calibration_factor2, calibration_factor3,
                        time_to_surface, signal_strength, spb_mode, wiring_mode,
                        motor_on_mode, motor_off_mode, firmware_version, imsi,
                        first_device, command_issued_by, command_issued,
                        captured_date, created_at, updated_at, status
                    ) VALUES (
                        %s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,
                        %s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s
                    )
                """, (
                    str(uuid.uuid4()),
                    str(state["user_id"]) if state["user_id"] else None,
                    str(state["farm_id"]) if state["farm_id"] else None,
                    uid, str(uuid.uuid4()), state["pump_name"],
                    round(state["voltage1"],2), round(state["voltage2"],2), round(state["voltage3"],2),
                    round(state["current1"],3), round(state["current2"],3), round(state["current3"],3),
                    bool(state["power_avail"]), bool(state["motor_state"]), state["device_state"],
                    round(state["total_run_time"],2), False, state["heart_beat"], True,
                    7.20, 7.20, 7.20, round(random.uniform(1,30),2), round(state["signal"],2),
                    False, 1, state["motor_state"], 1-state["motor_state"],
                    "v1.0.0", f"4040{uid[-6:]}",
                    False, "simulator", 0,
                    now, now, now, "active"
                ))
            conn.commit()
        log.info(f"[SIM] UID:{uid[-6:]} V:{round(state['voltage1'],1)}V I:{round(state['current1'],2)}A Motor:{'ON' if state['motor_state']==1 else 'OFF'} Signal:{state['signal']}dB")
    except Exception as e:
        log.error(f"[SENSOR DB] Insert failed {uid}: {e}")

def main():
    log.info("=== KrishiHrudya Data Simulator Starting ===")
    borewell_uids = get_uids_from_borewell()
    starter_uids  = get_uids_from_starter_data()
    uid_map = {**starter_uids, **borewell_uids}

    if not uid_map:
        log.error("[SIM] No UIDs found. Exiting.")
        sys.exit(1)

    for uid, meta in uid_map.items():
        device_states[uid] = init_device_state(uid=uid, farm_id=meta["farm_id"], user_id=meta["user_id"], pump_name=meta["pump_name"])
        device_commands[uid] = None
        ensure_settings(uid)

    all_uids = list(uid_map.keys())
    log.info(f"[SIM] Simulating {len(all_uids)} UIDs every 30s")
    for uid in all_uids:
        log.info(f"  -> {uid}  ({uid_map[uid]['pump_name']})")

    cycle = 0
    while True:
        cycle += 1
        log.info(f"--- Cycle {cycle} ({len(all_uids)} devices) ---")
        for uid in all_uids:
            # Check for pending motor command from API
            cmd = check_valve_command(uid)
            if cmd != device_commands.get(uid):
                if cmd:
                    log.info(f"[SIM] UID:{uid[-6:]} — applying command: {cmd}")
                device_commands[uid] = cmd
            device_states[uid] = evolve_device_state(device_states[uid], forced_motor=device_commands.get(uid))
            insert_telemetry(device_states[uid])
            upsert_statistics(device_states[uid])
        log.info(f"[SIM] Cycle {cycle} done — next in 30s")
        time.sleep(30)

if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        log.info("[SIM] Stopped.")
