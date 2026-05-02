"""
Valve Worker — KrishiHrudya
Listens for status from valve devices and dispatches queued commands.

Topics:
  Subscribe: +STATUS   → receive valve state + battery from device
  Publish:   +COMMAND  → send open/close commands to device

Message formats:
  Status  (device → server): <<1.3.75>>  (valve=1, battery=3.75V)
  Command (server → device): <<1>>       (open) or <<0>> (close)
"""

import os
import sys
import time
import uuid
import logging
import paho.mqtt.client as mqtt
import psycopg
from datetime import datetime

# ── Logging ───────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [VALVE] %(levelname)s %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S'
)
log = logging.getLogger(__name__)

# ── Config ────────────────────────────────────────────────
BROKER_HOST = "127.0.0.1"
BROKER_PORT = 1883
CLIENT_ID   = f"kh_valve_worker_{uuid.uuid4().hex[:8]}"

DB_URL = os.getenv(
    "DATABASE_URL",
    "postgresql://khuser:KHdb@26@localhost:5432/kh_business"
).replace("postgresql+psycopg://", "postgresql://")

# ── DB helpers ────────────────────────────────────────────
def get_conn():
    return psycopg.connect(DB_URL)

def save_device_status(uid: str, valve: int, battery: float, raw: str, lora_string: str = None):
    """Store status received from device into valve_commands table."""
    try:
        with get_conn() as conn:
            with conn.cursor() as cur:
                cur.execute("""
                    INSERT INTO valve_commands (
                        cmd_id, device_uid, command_string, command_type,
                        pin_number, state, status, lora_string, created_at
                    ) VALUES (%s, %s, %s, 'device_status', 0, %s, 'acknowledged', %s, now())
                """, (str(uuid.uuid4()), uid, raw, valve, lora_string))
            conn.commit()
        log.info(f"[DB] Status saved — UID:{uid} valve:{valve} battery:{battery}V lora:{lora_string}")
    except Exception as e:
        log.error(f"[DB] Failed to save status: {e}")


def get_pending_command(uid: str):
    """Fetch oldest pending command for this device."""
    try:
        with get_conn() as conn:
            with conn.cursor() as cur:
                cur.execute("""
                    SELECT cmd_id, command_string
                    FROM valve_commands
                    WHERE device_uid = %s AND status = 'pending'
                    ORDER BY created_at ASC
                    LIMIT 1
                """, (uid,))
                row = cur.fetchone()
                return row  # (cmd_id, command_string) or None
    except Exception as e:
        log.error(f"[DB] Failed to fetch command: {e}")
        return None

def mark_command_sent(cmd_id: str):
    """Mark command as sent after publishing to MQTT."""
    try:
        with get_conn() as conn:
            with conn.cursor() as cur:
                cur.execute("""
                    UPDATE valve_commands
                    SET status = 'sent', sent_at = now()
                    WHERE cmd_id = %s
                """, (cmd_id,))
            conn.commit()
        log.info(f"[DB] Command marked sent — {cmd_id}")
    except Exception as e:
        log.error(f"[DB] Failed to mark sent: {e}")

def mark_command_acknowledged(uid: str):
    """Mark latest sent command as acknowledged when device confirms."""
    try:
        with get_conn() as conn:
            with conn.cursor() as cur:
                cur.execute("""
                    UPDATE valve_commands
                    SET status = 'acknowledged', acknowledged_at = now()
                    WHERE device_uid = %s
                    AND status = 'sent'
                    AND created_at = (
                        SELECT MAX(created_at) FROM valve_commands
                        WHERE device_uid = %s AND status = 'sent'
                    )
                """, (uid, uid))
            conn.commit()
        log.info(f"[DB] Command acknowledged — UID:{uid}")
    except Exception as e:
        log.error(f"[DB] Failed to acknowledge: {e}")

# ── Parse device status message ───────────────────────────
def parse_status(payload: str):
    """
    Parse <<1.3.75>> → (valve=1, battery=3.75)
    Parse <<0.3.72>> → (valve=0, battery=3.72)
    """
    import re
    match = re.search(r'<<([\d.]+)>>', payload)
    if not match:
        return None, None
    parts = match.group(1).split('.')
    if len(parts) < 2:
        return None, None
    try:
        valve = int(parts[0])
        if len(parts) >= 3:
            battery = float(f"{parts[1]}.{parts[2]}")
        else:
            battery = float(parts[1])
        return valve, battery
    except Exception:
        return None, None

# ── MQTT Callbacks ────────────────────────────────────────
mqtt_client = None

def on_connect(client, userdata, flags, rc):
    if rc == 0:
        log.info(f"[MQTT] Connected to broker {BROKER_HOST}:{BROKER_PORT}")
        # Subscribe to all valve status topics
        client.subscribe("#", qos=1)
        log.info("[MQTT] Subscribed to all topics (#)")
      
    else:
        log.error(f"[MQTT] Connection failed — rc={rc}")

def on_disconnect(client, userdata, rc):
    log.warning(f"[MQTT] Disconnected rc={rc} — will reconnect")

def on_message(client, userdata, msg):
    topic   = msg.topic
    payload = msg.payload.decode('utf-8', errors='ignore').strip()
    log.info(f"[MQTT] Received — topic:{topic} payload:{payload}")

    if not topic.endswith("STATUS") and not topic.endswith("COMMAND"):
        # Treat anything else as a raw lora string — save it directly
        uid = topic  # use topic as uid if no match
        try:
            with get_conn() as conn:
                with conn.cursor() as cur:
                    cur.execute("""
                        INSERT INTO valve_commands (
                            cmd_id, device_uid, command_string, command_type,
                            pin_number, state, status, lora_string, created_at
                        ) VALUES (%s, %s, %s, 'lora_raw', 0, 0, 'received', %s, now())
                    """, (str(uuid.uuid4()), uid, payload, payload))
                conn.commit()
            log.info(f"[DB] Raw lora saved — topic:{topic} payload:{payload}")
        except Exception as e:
            log.error(f"[DB] Failed to save raw lora: {e}")
        return

    if topic.endswith("COMMAND"):
        # MIT App published a command — save lora string
        uid = topic[:-7]  # remove COMMAND
        if not uid or len(uid) != 15:
            log.warning(f"[MQTT] Invalid UID in COMMAND topic: {topic}")
            return
        log.info(f"[MIT APP] Command received — UID:{uid} lora:{payload}")
        try:
            with get_conn() as conn:
                with conn.cursor() as cur:
                    cur.execute("""
                        INSERT INTO valve_commands (
                            cmd_id, device_uid, command_string, command_type,
                            pin_number, state, status, lora_string, created_at
                        ) VALUES (%s, %s, %s, 'mit_app_command', 0, 0, 'received', %s, now())
                    """, (str(uuid.uuid4()), uid, payload, payload))
                conn.commit()
            log.info(f"[DB] MIT App command saved — UID:{uid}")
        except Exception as e:
            log.error(f"[DB] Failed to save MIT app command: {e}")
        return

    if topic.endswith("STATUS"):
        uid = topic[:-6]
        if not uid or not uid.isdigit() or len(uid) != 15:
            log.warning(f"[MQTT] Skipping non-valve topic: {topic}")
            return

        valve, battery = parse_status(payload)
        if valve is None:
            # Not standard format — save as lora string anyway
            log.info(f"[DEVICE] Raw lora from UID:{uid} — {payload}")
            save_device_status(uid, 0, 0.0, payload, lora_string=payload)
            return

        log.info(f"[DEVICE] UID:{uid} valve={'OPEN' if valve==1 else 'CLOSED'} battery:{battery}V")
        save_device_status(uid, valve, battery or 0.0, payload, lora_string=payload)
        mark_command_acknowledged(uid)

        pending = get_pending_command(uid)
        if pending:
            cmd_id, command_string = pending
            command_topic = f"{uid}COMMAND"
            client.publish(command_topic, command_string, qos=1)
            mark_command_sent(cmd_id)
            log.info(f"[MQTT] Published — topic:{command_topic} payload:{command_string}")


def on_publish(client, userdata, mid):
    log.info(f"[MQTT] Message published — mid:{mid}")

# ── Poll DB for pending commands and push them ─────────────
def push_pending_commands(client):
    """
    Periodically check DB for any pending commands and publish them.
    This handles cases where the device is already online but
    did not send a STATUS message to trigger command dispatch.
    """
    try:
        with get_conn() as conn:
            with conn.cursor() as cur:
                cur.execute("""
                    SELECT cmd_id, device_uid, command_string
                    FROM valve_commands
                    WHERE status = 'pending'
                    AND command_type != 'device_status'
                    ORDER BY created_at ASC
                    LIMIT 10
                """)
                rows = cur.fetchall()

        for cmd_id, uid, command_string in rows:
            topic = f"{uid}COMMAND"
            client.publish(topic, command_string, qos=1)
            mark_command_sent(str(cmd_id))
            log.info(f"[POLL] Dispatched — UID:{uid} cmd:{command_string}")

    except Exception as e:
        log.error(f"[POLL] Error pushing pending commands: {e}")

# ── Main ──────────────────────────────────────────────────
def main():
    global mqtt_client

    log.info("=== KrishiHrudya Valve Worker Starting ===")

    # Test DB connection
    try:
        with get_conn() as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT COUNT(*) FROM valve_commands")
                count = cur.fetchone()[0]
        log.info(f"[DB] Connected — {count} valve commands in DB")
    except Exception as e:
        log.error(f"[DB] Cannot connect: {e}")
        sys.exit(1)

    # Setup MQTT client
    mqtt_client = mqtt.Client(client_id=CLIENT_ID, protocol=mqtt.MQTTv311)
    mqtt_client.on_connect    = on_connect
    mqtt_client.on_disconnect = on_disconnect
    mqtt_client.on_message    = on_message
    mqtt_client.on_publish    = on_publish

    # Connect with retry
    while True:
        try:
            mqtt_client.connect(BROKER_HOST, BROKER_PORT, keepalive=60)
            break
        except Exception as e:
            log.error(f"[MQTT] Cannot connect: {e} — retry in 5s")
            time.sleep(5)

    mqtt_client.loop_start()
    log.info("[MQTT] Loop started")

    # Main loop — poll DB every 5 seconds for pending commands
    poll_interval = 5
    last_poll     = 0

    try:
        while True:
            now = time.time()
            if now - last_poll >= poll_interval:
                push_pending_commands(mqtt_client)
                last_poll = now
            time.sleep(1)
    except KeyboardInterrupt:
        log.info("Shutting down valve worker...")
        mqtt_client.loop_stop()
        mqtt_client.disconnect()

if __name__ == "__main__":
    main()
