import json
import uuid
from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, text
from typing import Optional
from pydantic import BaseModel
from app.database import get_db, get_sensor_db
from app.models.user import User
from app.models.role import RolePermission
from app.services.auth_service import get_current_user
import paho.mqtt.publish as publish
from typing import Optional
from app.services.audit_logger import log_audit

router = APIRouter(prefix="/farms", tags=["Farms"])
bearer = HTTPBearer()


async def get_user_with_perms(token: str, db: AsyncSession):
    user = await get_current_user(token, db)
    result = await db.execute(select(RolePermission).where(RolePermission.role_id == user.role_id))
    perms = result.scalar_one_or_none()
    return user, perms


# ── List farms for logged-in user ─────────────────────────
@router.get("")
async def list_farms(
    customer_id: Optional[str] = None,
    credentials: HTTPAuthorizationCredentials = Depends(bearer),
    db: AsyncSession = Depends(get_db),
):
    user, perms = await get_user_with_perms(credentials.credentials, db)

    if user.bypass_org_scope:
        if customer_id:
            result = await db.execute(
                text("SELECT * FROM farms WHERE customer_id = :cid ORDER BY created_at DESC"),
                {"cid": customer_id}
            )
        else:
            result = await db.execute(text("SELECT * FROM farms ORDER BY created_at DESC"))
    else:
        if customer_id:
            result = await db.execute(
                text("SELECT * FROM farms WHERE user_id = :uid AND customer_id = :cid ORDER BY created_at DESC"),
                {"uid": str(user.user_id), "cid": customer_id}
            )
        else:
            result = await db.execute(
                text("SELECT * FROM farms WHERE user_id = :uid ORDER BY created_at DESC"),
                {"uid": str(user.user_id)}
            )
    rows = result.mappings().all()

    farms = []
    for row in rows:
        farm_id = str(row["farm_id"])
        # Count devices (borewells)
        dev_result = await db.execute(
            text("SELECT COUNT(*) FROM borewell WHERE farm_id = :fid"),
            {"fid": farm_id}
        )
        device_count = dev_result.scalar()

        farms.append({
            "farm_id":      farm_id,
            "farm_name":    row["farm_name"],
            "user_id":      str(row["user_id"]),
            "latitude":     float(row["latitude"]) if row["latitude"] else None,
            "longitude":    float(row["longitude"]) if row["longitude"] else None,
            "created_at":   str(row["created_at"]),
            "device_count": device_count,
        })

    return {"farms": farms, "total": len(farms)}


# ── Get devices in a farm ─────────────────────────────────
@router.get("/{farm_id}/devices")
async def get_farm_devices(
    farm_id: str,
    credentials: HTTPAuthorizationCredentials = Depends(bearer),
    db: AsyncSession = Depends(get_db),
    sensor_db: AsyncSession = Depends(get_sensor_db),
):
    user, perms = await get_user_with_perms(credentials.credentials, db)

    # Get farm
    farm_result = await db.execute(
        text("SELECT * FROM farms WHERE farm_id = :fid"),
        {"fid": farm_id}
    )
    farm = farm_result.mappings().first()
    if not farm:
        raise HTTPException(status_code=404, detail="Farm not found")

    # Get borewells
    bore_result = await db.execute(
        text("SELECT * FROM borewell WHERE farm_id = :fid ORDER BY created_at ASC"),
        {"fid": farm_id}
    )
    borewells = bore_result.mappings().all()

    devices = []
    for bw in borewells:
        uid = str(bw["uid"])

        # Get latest sensor reading
        latest_result = await sensor_db.execute(
            text("""
                SELECT voltage1, voltage2, voltage3,
                       current1, current2, current3,
                       motor_state, power_available, device_state,
                       total_run_time, signal_strength, device_mode,
                       command_issued, captured_date
                FROM starter_data
                WHERE uid = :uid
                ORDER BY captured_date DESC
                LIMIT 1
            """),
            {"uid": uid}
        )
        latest = latest_result.mappings().first()

        # Get daily statistics
        stats_result = await sensor_db.execute(
            text("""
                SELECT day_water_yield, total_run_time_for_the_day,
                       last_sync_time
                FROM starter_statistics
                WHERE uid = :uid
                ORDER BY created_at DESC
                LIMIT 1
            """),
            {"uid": uid}
        )
        stats = stats_result.mappings().first()

        # Get settings (for auto/manual mode)
        settings_result = await sensor_db.execute(
            text("SELECT auto_manual FROM starter_settings WHERE uid = :uid"),
            {"uid": uid}
        )
        settings = settings_result.mappings().first()

        # Get installation info (pump name / address)
        install_result = await db.execute(
            text("""
                SELECT i.uid, p.product_name
                FROM installations i
                LEFT JOIN products p ON i.product_uid = p.uid
                WHERE i.uid = :uid
                LIMIT 1
            """),
            {"uid": uid}
        )
        install = install_result.mappings().first()

        devices.append({
            "bore_id":        str(bw["bore_id"]),
            "uid":            uid,
            "borewell_name":  bw["borewell_name"],
            "location":       bw["location"],
            "motor_hp":       bw["motor_hp"],
            "pump_stages":    bw["pump_stages"],
            "product_name":   install["product_name"] if install else None,
            # Live data
            "voltage1":       float(latest["voltage1"]) if latest and latest["voltage1"] else None,
            "voltage2":       float(latest["voltage2"]) if latest and latest["voltage2"] else None,
            "voltage3":       float(latest["voltage3"]) if latest and latest["voltage3"] else None,
            "current1":       float(latest["current1"]) if latest and latest["current1"] else None,
            "current2":       float(latest["current2"]) if latest and latest["current2"] else None,
            "current3":       float(latest["current3"]) if latest and latest["current3"] else None,
            "motor_state":    bool(latest["motor_state"]) if latest else None,
            "power_available":bool(latest["power_available"]) if latest else None,
            "device_state":   int(latest["device_state"]) if latest and latest["device_state"] is not None else None,
            "total_run_time": float(latest["total_run_time"]) if latest and latest["total_run_time"] else None,
            "signal_strength":float(latest["signal_strength"]) if latest and latest["signal_strength"] else None,
            "device_mode":    bool(latest["device_mode"]) if latest else None,
            "command_issued": int(latest["command_issued"]) if latest and latest["command_issued"] is not None else None,
            "last_captured":  str(latest["captured_date"]) if latest else None,
            # Stats
            "day_water_yield":        float(stats["day_water_yield"]) if stats and stats["day_water_yield"] else 0,
            "run_time_for_day":       float(stats["total_run_time_for_the_day"]) if stats and stats["total_run_time_for_the_day"] else 0,
            "last_sync_time":         str(stats["last_sync_time"]) if stats and stats["last_sync_time"] else None,
            # Mode
            "auto_manual":    bool(settings["auto_manual"]) if settings and settings["auto_manual"] is not None else None,
        })

    return {
        "farm_id":   farm_id,
        "farm_name": farm["farm_name"],
        "latitude":  float(farm["latitude"]) if farm["latitude"] else None,
        "longitude": float(farm["longitude"]) if farm["longitude"] else None,
        "created_at":str(farm["created_at"]),
        "devices":   devices,
    }


# ── Get single device full detail (motor control panel) ───
@router.get("/{farm_id}/devices/{uid}")
async def get_device_detail(
    farm_id: str,
    uid: str,
    credentials: HTTPAuthorizationCredentials = Depends(bearer),
    db: AsyncSession = Depends(get_db),
    sensor_db: AsyncSession = Depends(get_sensor_db),
):
    user, perms = await get_user_with_perms(credentials.credentials, db)

    # Borewell info
    bore_result = await db.execute(
        text("SELECT * FROM borewell WHERE uid = :uid AND farm_id = :fid"),
        {"uid": uid, "fid": farm_id}
    )
    bw = bore_result.mappings().first()
    if not bw:
        raise HTTPException(status_code=404, detail="Device not found")

    # Installation info
    install_result = await db.execute(
        text("""
            SELECT i.*, p.product_name
            FROM installations i
            LEFT JOIN products p ON i.product_uid = p.uid
            WHERE i.uid = :uid
            LIMIT 1
        """),
        {"uid": uid}
    )
    install = install_result.mappings().first()

    # Latest sensor data
    latest_result = await sensor_db.execute(
        text("""
            SELECT * FROM starter_data
            WHERE uid = :uid
            ORDER BY captured_date DESC
            LIMIT 1
        """),
        {"uid": uid}
    )
    latest = latest_result.mappings().first()

    # Statistics
    stats_result = await sensor_db.execute(
        text("""
            SELECT * FROM starter_statistics
            WHERE uid = :uid
            ORDER BY created_at DESC
            LIMIT 1
        """),
        {"uid": uid}
    )
    stats = stats_result.mappings().first()

    # Settings
    settings_result = await sensor_db.execute(
        text("SELECT * FROM starter_settings WHERE uid = :uid"),
        {"uid": uid}
    )
    settings = settings_result.mappings().first()

    def safe_float(val):
        try: return float(val) if val is not None else None
        except: return None

    def safe_bool(val):
        return bool(val) if val is not None else None

    def safe_int(val):
        try: return int(val) if val is not None else None
        except: return None

    return {
        "bore_id":      str(bw["bore_id"]),
        "uid":          uid,
        "borewell_name":bw["borewell_name"],
        "location":     bw["location"],
        "motor_hp":     bw["motor_hp"],
        "pump_stages":  bw["pump_stages"],
        "borewell_depth":   safe_float(bw["borewell_depth"]),
        "borewell_diameter":safe_float(bw["borewell_diameter"]),
        "product_name": install["product_name"] if install else None,
        "installed_by": install["installed_by"] if install else None,
        # Live readings
        "voltage1":      safe_float(latest["voltage1"]) if latest else None,
        "voltage2":      safe_float(latest["voltage2"]) if latest else None,
        "voltage3":      safe_float(latest["voltage3"]) if latest else None,
        "current1":      safe_float(latest["current1"]) if latest else None,
        "current2":      safe_float(latest["current2"]) if latest else None,
        "current3":      safe_float(latest["current3"]) if latest else None,
        "motor_state":   safe_bool(latest["motor_state"]) if latest else None,
        "power_available":safe_bool(latest["power_available"]) if latest else None,
        "device_state":  safe_int(latest["device_state"]) if latest else None,
        "total_run_time":safe_float(latest["total_run_time"]) if latest else None,
        "signal_strength":safe_float(latest["signal_strength"]) if latest else None,
        "device_mode":   safe_bool(latest["device_mode"]) if latest else None,
        "command_issued":safe_int(latest["command_issued"]) if latest else None,
        "last_captured": str(latest["captured_date"]) if latest else None,
        # Statistics
        "day_water_yield":         safe_float(stats["day_water_yield"]) if stats else None,
        "month_water_yield":       safe_float(stats["month_water_yield"]) if stats else None,
        "run_time_for_day":        safe_float(stats["total_run_time_for_the_day"]) if stats else None,
        "run_time_for_week":       safe_float(stats["total_run_time_for_the_week"]) if stats else None,
        "run_time_for_month":      safe_float(stats["total_run_time_for_the_month"]) if stats else None,
        "total_on_off_cycles":     safe_int(stats["total_on_off_cycles"]) if stats else None,
        "total_overload_trips":    safe_int(stats["total_overload_trips"]) if stats else None,
        "total_underload_trips":   safe_int(stats["total_underload_trips"]) if stats else None,
        "last_sync_time":          str(stats["last_sync_time"]) if stats and stats["last_sync_time"] else None,
        # Settings
        "auto_manual":     safe_bool(settings["auto_manual"]) if settings else None,
        "overload_limit":  safe_float(settings["overload_limit"]) if settings else None,
        "underload_limit": safe_float(settings["underload_limit"]) if settings else None,
        "pump_flow_rate":  safe_float(settings["pump_flow_rate"]) if settings else None,
    }


# ── Send motor command via MQTT ───────────────────────────
class MotorCommand(BaseModel):
    command: str  # "on" or "off"

@router.post("/{farm_id}/devices/{uid}/command")
async def send_motor_command(
    farm_id: str,
    uid: str,
    body: MotorCommand,
    credentials: HTTPAuthorizationCredentials = Depends(bearer),
    db: AsyncSession = Depends(get_db),
):
    user, perms = await get_user_with_perms(credentials.credentials, db)

    if not perms or perms.motor_control != 1:
        raise HTTPException(status_code=403, detail="Motor control permission required")

    if body.command not in ["on", "off"]:
        raise HTTPException(status_code=400, detail="Command must be 'on' or 'off'")

    topic = f"kh/devices/{uid}/command"
    payload = json.dumps({
        "motor_command": body.command == "on",
        "command_by":    user.full_name,
        "uid":           uid,
    })

    
    # Write command to DB so simulator picks it up immediately
    try:
        import psycopg as _pg
        with _pg.connect("postgresql://khuser:KHdb%4026@localhost:5432/kh_business") as _conn:
            with _conn.cursor() as _cur:
                _cur.execute(
                    "INSERT INTO valve_commands (uid, command, command_by, created_at) VALUES (%s,%s,%s,NOW())",
                    (uid, body.command, user.full_name)
                )
            _conn.commit()
    except Exception as _e:
        pass  # MQTT still sent, DB write is best-effort

    try:
        publish.single(
            topic,
            payload=payload,
            hostname="127.0.0.1",
            port=1883,
            qos=1,
        )
        # ── Audit log — success ──
        await log_audit(
            db             = db,
            user_id        = str(user.user_id),
            customer_id    = str(user.customer_id),
            action         = f"Motor {'ON' if body.command == 'on' else 'OFF'} command sent",
            action_category= "command",
            resource_type  = "device",
            resource_id    = uid,
            device_uid     = uid,
            command_name   = f"Motor {'ON' if body.command == 'on' else 'OFF'}",
            new_value      = body.command,
            status         = "success",
        )
    except Exception as e:
        # ── Audit log — failure ──
        await log_audit(
            db             = db,
            user_id        = str(user.user_id),
            customer_id    = str(user.customer_id),
            action         = f"Motor {'ON' if body.command == 'on' else 'OFF'} command failed",
            action_category= "command",
            resource_type  = "device",
            resource_id    = uid,
            device_uid     = uid,
            command_name   = f"Motor {'ON' if body.command == 'on' else 'OFF'}",
            new_value      = body.command,
            status         = "failed",
            failure_reason = str(e),
        )
        raise HTTPException(status_code=500, detail=f"MQTT publish failed: {str(e)}")

    return {
        "message": f"Motor {'started' if body.command == 'on' else 'stopped'} successfully",
        "uid":     uid,
        "command": body.command,
    }