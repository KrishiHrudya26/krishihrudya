"""
KrishiHrudya Data Simulator
Generates realistic device telemetry for starter_data (kh_sensors)
using real farms and users from kh_business.
Runs every 30 seconds per device.
"""

import os
import sys
import time
import uuid
import random
import logging
import psycopg
from datetime import datetime
from datetime import timezone


logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [SIM] %(levelname)s %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S'
)
log = logging.getLogger(__name__)

# ── DB Config ─────────────────────────────────────────────
BUSINESS_DB = "postgresql://khuser:KHdb%4026@localhost:5432/kh_business"
SENSOR_DB   = "postgresql://khuser:KHdb%4026@localhost:5432/kh_sensors"

# ── Simulated device UIDs (15-digit) ──────────────────────
# Mix of real assigned + simulated
SIMULATED_UIDS = [
    "865357062789704",   # existing test device
    "179186036047872",   # valve test device
    "123456789012345",
    "987654321098765",
    "456789012345678",
    "234567890123456",
    "678901234567890",
    "345678901234567",
    "890123456789012",
    "567890123456789",
]

# ── Device state machine ──────────────────────────────────
# Simulates realistic state transitions per device
device_states = {}

def init_device_state(uid):
    """Initialize per-device simulation state."""
    return {
        "uid":           uid,
        "motor_state":   random.choice([0, 1]),
        "power_avail":   1,
        "device_state":  random.randint(1, 5),
        "total_run_time":random.uniform(0, 500),
        "heart_beat":    0,
        "voltage1":      random.uniform(390, 415),
        "voltage2":      random.uniform(390, 415),
        "voltage3":      random.uniform(390, 415),
        "current1":      random.uniform(2, 15),
        "current2":      random.uniform(2, 15),
        "current3":      random.uniform(2, 15),
        "signal":        random.randint(60, 95),
        "trip_count":    0,
        "farm_id":       None,
        "user_id":       None,
        "pump_name":     None,
    }

def evolve_device_state(state):
    """Simulate realistic state changes each cycle."""
    uid = state["uid"]

    # Occasionally toggle motor
    if random.random() < 0.1:  # 10% chance each cycle
        state["motor_state"] = 1 - state["motor_state"]

    # Power fluctuations
    if random.random() < 0.05:
        state["power_avail"] = 1 - state["power_avail"]
    else:
        state["power_avail"] = 1

    # Device state logic
    if state["motor_state"] == 1 and state["power_avail"] == 1:
        state["device_state"] = 1  # running
        state["total_run_time"] += 0.5
    elif state["power_avail"] == 0:
        state["device_state"] = 6  # no power
    else:
        # Occasional trips for realism
        trip = random.random()
        if trip < 0.02:
            state["device_state"] = 7   # overload trip
        elif trip < 0.04:
            state["device_state"] = 8   # underload trip
        elif trip < 0.05:
            state["device_state"] = 9   # dry run trip
        else:
            state["device_state"] = 2   # stopped

    # Voltage drift ±5V
    state["voltage1"] += random.uniform(-2, 2)
    state["voltage2"] += random.uniform(-2, 2)
    state["voltage3"] += random.uniform(-2, 2)
    state["voltage1"] = max(350, min(440, state["voltage1"]))
    state["voltage2"] = max(350, min(440, state["voltage2"]))
    state["voltage3"] = max(350, min(440, state["voltage3"]))

    # Current based on motor state
    if state["motor_state"] == 1:
        state["current1"] += random.uniform(-0.5, 0.5)
        state["current2"] += random.uniform(-0.5, 0.5)
        state["current3"] += random.uniform(-0.5, 0.5)
        state["current1"] = max(2, min(20, state["current1"]))
        state["current2"] = max(2, min(20, state["current2"]))
        state["current3"] = max(2, min(20, state["current3"]))
    else:
        state["current1"] = random.uniform(0, 0.5)
        state["current2"] = random.uniform(0, 0.5)
        state["current3"] = random.uniform(0, 0.5)

    # Signal strength drift
    state["signal"] += random.randint(-2, 2)
    state["signal"] = max(40, min(99, state["signal"]))

    # Heartbeat increments
    state["heart_beat"] = (state["heart_beat"] + 1) % 65535

    return state

# ── Get real farms + users from kh_business ──────────────
def get_farms():
    try:
        with psycopg.connect(BUSINESS_DB) as conn:
            with conn.cursor() as cur:
                cur.execute("""
                    SELECT f.farm_id, f.user_id, f.farm_name,
                           i.pump_name, i.product_uid
                    FROM farms f
                    LEFT JOIN installations i ON i.farm_id = f.farm_id
                    WHERE f.farm_id IS NOT NULL
                    LIMIT 50
                """)
                rows = cur.fetchall()
        log.info(f"[BUSINESS DB] Found {len(rows)} farm/installation records")
        return rows
    except Exception as e:
        log.error(f"[BUSINESS DB] Error: {e}")
        return []

# ── Insert telemetry into kh_sensors ─────────────────────
def insert_telemetry(state):
    uid      = state["uid"]
    farm_id  = state.get("farm_id")
    user_id  = state.get("user_id")
    pump_name= state.get("pump_name") or f"Pump_{uid[-4:]}"
    from datetime import timezone
    now      = datetime.now(timezone.utc)

    try:
        with psycopg.connect(SENSOR_DB) as conn:
            with conn.cursor() as cur:
                cur.execute("""
                    INSERT INTO starter_data (
                        sd_id, user_id, farm_id, uid,
                        slno, pump_name,
                        voltage1, voltage2, voltage3,
                        current1, current2, current3,
                        power_available, motor_state, device_state,
                        total_run_time, client_command_reset,
                        heart_beat, device_mode,
                        calibration_factor1, calibration_factor2, calibration_factor3,
                        time_to_surface, signal_strength,
                        spb_mode, wiring_mode, motor_on_mode, motor_off_mode,
                        firmware_version, imsi,
                        first_device, command_issued_by, command_issued,
                        captured_date, created_at, updated_at, status
                    ) VALUES (
                        %s, %s, %s, %s,
                        %s, %s,
                        %s, %s, %s,
                        %s, %s, %s,
                        %s, %s, %s,
                        %s, %s,
                        %s, %s,
                        %s, %s, %s,
                        %s, %s,
                        %s, %s, %s, %s,
                        %s, %s,
                        %s, %s, %s,
                        %s, %s, %s, %s
                    )
                """, (
                    str(uuid.uuid4()),                    # sd_id
                    str(user_id) if user_id else None,    # user_id
                    str(farm_id) if farm_id else None,    # farm_id
                    uid,                                  # uid
                    str(uuid.uuid4()),                    # slno (uuid)
                    pump_name,                            # pump_name
                    round(state["voltage1"], 2),          # voltage1
                    round(state["voltage2"], 2),          # voltage2
                    round(state["voltage3"], 2),          # voltage3
                    round(state["current1"], 3),          # current1
                    round(state["current2"], 3),          # current2
                    round(state["current3"], 3),          # current3
                    bool(state["power_avail"]),           # power_available (boolean)
                    bool(state["motor_state"]),           # motor_state (boolean)
                    state["device_state"],                # device_state (integer)
                    round(state["total_run_time"], 2),    # total_run_time
                    False,                                # client_command_reset (boolean)
                    state["heart_beat"],                  # heart_beat (integer)
                    True,                                 # device_mode (boolean: True=auto)
                    7.20,                                 # calibration_factor1
                    7.20,                                 # calibration_factor2
                    7.20,                                 # calibration_factor3
                    round(random.uniform(1, 30), 2),      # time_to_surface
                    round(state["signal"], 2),            # signal_strength
                    False,                                # spb_mode (boolean)
                    1,                                    # wiring_mode (integer)
                    state["motor_state"],                 # motor_on_mode (integer)
                    1 - state["motor_state"],             # motor_off_mode (integer)
                    "v1.0.0",                             # firmware_version
                    f"4040{uid[-6:]}",                    # imsi
                    False,                                # first_device (boolean)
                    "simulator",                          # command_issued_by
                    0,                                    # command_issued (integer)
                    now,                                  # captured_date
                    now,                                  # created_at
                    now,                                  # updated_at
                    "active"                              # status
                ))
            conn.commit()

        motor_label = "🟢 RUNNING" if state["motor_state"] == 1 else "🔴 STOPPED"
        log.info(
            f"[SIM] UID:{uid[-6:]} "
            f"V:{round(state['voltage1'],1)}V "
            f"I:{round(state['current1'],2)}A "
            f"State:{state['device_state']} "
            f"Motor:{motor_label} "
            f"Signal:{state['signal']}dB"
        )
    except Exception as e:
        log.error(f"[SENSOR DB] Insert failed for UID:{uid} — {e}")

# ── Main simulator loop ───────────────────────────────────
def main():
    log.info("=== KrishiHrudya Data Simulator Starting ===")
    log.info(f"Simulating {len(SIMULATED_UIDS)} devices")

    # Initialize all device states
    for uid in SIMULATED_UIDS:
        device_states[uid] = init_device_state(uid)

    # Fetch real farm data and assign to devices
    farms = get_farms()
    if farms:
        for i, uid in enumerate(SIMULATED_UIDS):
            if farms:
                farm = farms[i % len(farms)]
                device_states[uid]["farm_id"]  = farm[0]
                device_states[uid]["user_id"]  = farm[1]
                device_states[uid]["pump_name"]= farm[3] or f"Sim Pump {i+1}"
        log.info("[SIM] Farm data assigned to devices")
    else:
        log.warning("[SIM] No farm data found — inserting without farm/user links")

    cycle = 0
    INTERVAL = 30  # seconds between inserts

    log.info(f"[SIM] Inserting data every {INTERVAL} seconds...")
    log.info("[SIM] Press Ctrl+C to stop")

    while True:
        cycle += 1
        log.info(f"─── Cycle {cycle} ───────────────────────────────")

        for uid in SIMULATED_UIDS:
            # Evolve state
            device_states[uid] = evolve_device_state(device_states[uid])
            # Insert to DB
            insert_telemetry(device_states[uid])

        log.info(f"[SIM] Cycle {cycle} complete — next in {INTERVAL}s")
        time.sleep(INTERVAL)

if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        log.info("Simulator stopped.")
