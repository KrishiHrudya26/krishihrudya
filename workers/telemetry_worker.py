"""
KrishiHrudya — Telemetry Worker
Subscribes to MQTT telemetry topic and writes to TimescaleDB.
"""

import json
import asyncio
import signal
import logging
from datetime import datetime, timezone
import paho.mqtt.client as mqtt
import psycopg
from app.config import settings

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [WORKER] %(levelname)s %(message)s"
)
log = logging.getLogger(__name__)

BROKER      = "127.0.0.1"
PORT        = 1883
TOPIC       = "$share/workers/kh/devices/+/telemetry"
CLIENT_ID   = "kh-telemetry-worker-01"

DB_URL = settings.TIMESCALE_URL.replace(
    "postgresql+psycopg://", "postgresql://"
)


def get_db_conn():
    return psycopg.connect(DB_URL)


def write_telemetry(payload: dict):
    try:
        conn = get_db_conn()
        with conn.cursor() as cur:
            cur.execute("""
                INSERT INTO starter_data (
                    sd_id, uid, user_id, farm_id,
                    pump_name,
                    voltage1, voltage2, voltage3,
                    current1, current2, current3,
                    power_available, motor_state, device_state,
                    total_run_time, heart_beat, device_mode,
                    signal_strength, firmware_version, imsi,
                    command_issued_by, command_issued,
                    captured_date, created_at, status
                ) VALUES (
                    gen_random_uuid(),
                    %(uid)s, %(user_id)s, %(farm_id)s,
                    %(pump_name)s,
                    %(voltage1)s, %(voltage2)s, %(voltage3)s,
                    %(current1)s, %(current2)s, %(current3)s,
                    %(power_available)s, %(motor_state)s, %(device_state)s,
                    %(total_run_time)s, %(heart_beat)s, %(device_mode)s,
                    %(signal_strength)s, %(firmware_version)s, %(imsi)s,
                    %(command_issued_by)s, %(command_issued)s,
                    %(captured_date)s, now(), 'active'
                )
            """, {
                "uid":               payload.get("uid"),
                "user_id":           payload.get("user_id"),
                "farm_id":           payload.get("farm_id"),
                "pump_name":         payload.get("pump_name"),
                "voltage1":          payload.get("voltage1"),
                "voltage2":          payload.get("voltage2"),
                "voltage3":          payload.get("voltage3"),
                "current1":          payload.get("current1"),
                "current2":          payload.get("current2"),
                "current3":          payload.get("current3"),
                "power_available":   payload.get("power_available"),
                "motor_state":       payload.get("motor_state"),
                "device_state":      payload.get("device_state"),
                "total_run_time":    payload.get("total_run_time"),
                "heart_beat":        payload.get("heart_beat"),
                "device_mode":       payload.get("device_mode"),
                "signal_strength":   payload.get("signal_strength"),
                "firmware_version":  payload.get("firmware_version"),
                "imsi":              payload.get("imsi"),
                "command_issued_by": payload.get("command_issued_by"),
                "command_issued":    payload.get("command_issued"),
                "captured_date":     payload.get("captured_date", datetime.now(timezone.utc).isoformat()),
            })
            conn.commit()
        conn.close()
        log.info(f"✅ Written to starter_data — uid={payload.get('uid')}")
    except Exception as e:
        log.error(f"❌ DB write error: {e}")


def on_connect(client, userdata, flags, rc, props=None):
    if rc == 0:
        log.info(f"Connected to EMQX — subscribing to {TOPIC}")
        client.subscribe(TOPIC, qos=1)
    else:
        log.error(f"Connection failed: rc={rc}")


def on_message(client, userdata, msg):
    try:
        payload = json.loads(msg.payload.decode())
        log.info(f"📩 Received from {msg.topic} — uid={payload.get('uid')}")
        write_telemetry(payload)
    except json.JSONDecodeError:
        log.error(f"Invalid JSON on {msg.topic}: {msg.payload}")
    except Exception as e:
        log.error(f"Message handling error: {e}")


def on_disconnect(client, userdata, rc, props=None):
    log.warning(f"Disconnected from EMQX — rc={rc}")


def run():
    client = mqtt.Client(
        client_id=CLIENT_ID,
        protocol=mqtt.MQTTv311,
        callback_api_version=mqtt.CallbackAPIVersion.VERSION2,
    )
    client.on_connect    = on_connect
    client.on_message    = on_message
    client.on_disconnect = on_disconnect

    def shutdown(sig, frame):
        log.info("Shutting down worker...")
        client.disconnect()
        client.loop_stop()

    signal.signal(signal.SIGTERM, shutdown)
    signal.signal(signal.SIGINT,  shutdown)

    log.info(f"Starting telemetry worker — connecting to {BROKER}:{PORT}")
    client.connect(BROKER, PORT, keepalive=60)
    client.loop_forever()


if __name__ == "__main__":
    run()
