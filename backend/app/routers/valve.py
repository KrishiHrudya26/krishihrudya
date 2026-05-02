import uuid
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.responses import PlainTextResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from pydantic import BaseModel
from typing import Optional
from app.database import get_db
from app.services.auth_service import get_current_user

router = APIRouter(prefix="/valve", tags=["Valve"])
bearer  = HTTPBearer()


# ── Schemas ───────────────────────────────────────────────
class ValveCommand(BaseModel):
    device_uid:   str
    command_type: str                  # "raw" or "structured"
    raw_command:  Optional[str] = None # e.g. <<2,17,1,>>
    pin_number:   Optional[int] = None
    address:      Optional[int] = None
    state:        Optional[int] = None # 1=open 0=close


def build_command_string(pin: int, address: int, state: int) -> str:
    return f"<<{pin},{address},{state},>>"


def parse_command_string(cmd: str):
    """Parse <<pin,address,state,>> into parts"""
    try:
        inner = cmd.strip('<>').strip(',')
        parts = [p.strip() for p in inner.split(',') if p.strip()]
        return (
            int(parts[0]) if len(parts) > 0 else None,
            int(parts[1]) if len(parts) > 1 else None,
            int(parts[2]) if len(parts) > 2 else None,
        )
    except Exception:
        return None, None, None


# ── 1. Queue a command (from dashboard / MIT App POST) ────
@router.post("/command")
async def queue_valve_command(
    body: ValveCommand,
    credentials: HTTPAuthorizationCredentials = Depends(bearer),
    db: AsyncSession = Depends(get_db),
):
    """
    Dashboard or MIT App queues a command.
    ESP8266 in STA mode will pick it up on next poll.
    """
    user = await get_current_user(credentials.credentials, db)

    if body.command_type == "raw" and body.raw_command:
        command_string = body.raw_command
        pin, address, state = parse_command_string(command_string)
    else:
        if body.pin_number is None or body.state is None:
            raise HTTPException(status_code=400, detail="pin_number and state required")
        pin            = body.pin_number
        address        = body.address or 0
        state          = body.state
        command_string = build_command_string(pin, address, state)

    cmd_id = str(uuid.uuid4())
    await db.execute(
        text("""
            INSERT INTO valve_commands (
                cmd_id, device_uid, command_string, command_type,
                pin_number, address, state, sent_by,
                status, created_at
            ) VALUES (
                :cmd_id, :device_uid, :command_string, :command_type,
                :pin_number, :address, :state, :sent_by,
                'pending', now()
            )
        """),
        {
            "cmd_id":         cmd_id,
            "device_uid":     body.device_uid,
            "command_string": command_string,
            "command_type":   body.command_type,
            "pin_number":     pin,
            "address":        address,
            "state":          state,
            "sent_by":        str(user.user_id),
        }
    )
    await db.commit()

    return {
        "message":        "Command queued — device will pick up on next poll",
        "cmd_id":         cmd_id,
        "command_string": command_string,
        "device_uid":     body.device_uid,
        "status":         "pending",
    }


# ── 2. ESP8266 polls this via HTTP GET ────────────────────
@router.get("/poll/{device_uid}", response_class=PlainTextResponse)
async def poll_command(
    device_uid: str,
    db: AsyncSession = Depends(get_db),
):
    """
    ESP8266 in STA mode calls this URL via pingURL().
    Main MCU sends: http://187.127.139.240/api/valve/poll/DEVICE_UID

    Returns:
      - The pending command string e.g. <<2,17,1,>>
      - Or NONE if nothing pending

    After returning, marks command as 'sent'.
    """
    result = await db.execute(
        text("""
            SELECT cmd_id, command_string
            FROM valve_commands
            WHERE device_uid = :uid
            AND status = 'pending'
            ORDER BY created_at ASC
            LIMIT 1
        """),
        {"uid": device_uid}
    )
    row = result.mappings().first()

    if not row:
        return "NONE"

    # Mark as sent
    await db.execute(
        text("""
            UPDATE valve_commands
            SET status = 'sent', sent_at = now()
            WHERE cmd_id = :cmd_id
        """),
        {"cmd_id": str(row["cmd_id"])}
    )
    await db.commit()

    return row["command_string"]


# ── 3. ESP8266 reports back after executing ───────────────
@router.get("/report", response_class=PlainTextResponse)
async def esp_report(
    uid:   str = Query(...),
    state: int = Query(...),
    pin:   int = Query(default=0),
    db:    AsyncSession = Depends(get_db),
):
    """
    After MCU executes command, it sends report URL via Serial.
    ESP8266 calls: GET /api/valve/report?uid=DEVICE_UID&state=1&pin=2

    Returns plain text so ESP8266 Serial.println() shows it clearly.
    """
    # Acknowledge latest sent command for this device
    await db.execute(
        text("""
            UPDATE valve_commands
            SET status = 'acknowledged', acknowledged_at = now()
            WHERE device_uid = :uid
            AND status = 'sent'
            AND created_at = (
                SELECT MAX(created_at) FROM valve_commands
                WHERE device_uid = :uid AND status = 'sent'
            )
        """),
        {"uid": uid}
    )

    # Log the device report
    await db.execute(
        text("""
            INSERT INTO valve_commands (
                cmd_id, device_uid, command_string, command_type,
                pin_number, state, status, created_at
            ) VALUES (
                :cmd_id, :uid, :cmd_str, 'device_report',
                :pin, :state, 'acknowledged', now()
            )
        """),
        {
            "cmd_id":  str(uuid.uuid4()),
            "uid":     uid,
            "cmd_str": f"DEVICE_REPORT:pin={pin},state={state}",
            "pin":     pin,
            "state":   state,
        }
    )
    await db.commit()

    valve_label = "OPEN" if state == 1 else "CLOSED"
    return f"ACK:pin={pin},state={state},valve={valve_label}"


# ── 4. Dashboard / MIT App fetches latest state ───────────
@router.get("/latest/{device_uid}")
async def get_latest(
    device_uid: str,
    credentials: HTTPAuthorizationCredentials = Depends(bearer),
    db: AsyncSession = Depends(get_db),
):
    """
    Dashboard or MIT App polls this to see current valve state.
    GET /api/valve/latest/DEVICE_UID
    """
    await get_current_user(credentials.credentials, db)

    result = await db.execute(
        text("""
            SELECT cmd_id, command_string, command_type,
                   pin_number, state, status,
                   created_at, acknowledged_at
            FROM valve_commands
            WHERE device_uid = :uid
            AND command_type != 'device_report'
            ORDER BY created_at DESC
            LIMIT 1
        """),
        {"uid": device_uid}
    )
    row = result.mappings().first()

    if not row:
        return {"device_uid": device_uid, "state": None, "valve": "UNKNOWN", "status": "no_commands"}

    return {
        "device_uid":      device_uid,
        "command_string":  row["command_string"],
        "state":           row["state"],
        "pin_number":      row["pin_number"],
        "status":          row["status"],
        "valve":           "OPEN" if row["state"] == 1 else "CLOSED",
        "sent_at":         str(row["created_at"]),
        "acknowledged_at": str(row["acknowledged_at"]) if row["acknowledged_at"] else None,
    }


# ── 5. Full command history ───────────────────────────────
@router.get("/logs/{device_uid}")
async def get_logs(
    device_uid: str,
    limit:      int = 20,
    credentials: HTTPAuthorizationCredentials = Depends(bearer),
    db: AsyncSession = Depends(get_db),
):
    await get_current_user(credentials.credentials, db)

    result = await db.execute(
        text("""
            SELECT cmd_id, command_string, command_type,
                   pin_number, state, status,
                   created_at, acknowledged_at
            FROM valve_commands
            WHERE device_uid = :uid
            ORDER BY created_at DESC
            LIMIT :limit
        """),
        {"uid": device_uid, "limit": limit}
    )
    rows = result.mappings().all()
    return {
        "device_uid": device_uid,
        "total":      len(rows),
        "logs": [
            {
                "cmd_id":         str(r["cmd_id"]),
                "command_string": r["command_string"],
                "command_type":   r["command_type"],
                "pin_number":     r["pin_number"],
                "state":          r["state"],
                "valve":          "OPEN" if r["state"] == 1 else "CLOSED",
                "status":         r["status"],
                "created_at":     str(r["created_at"]),
                "acknowledged_at":str(r["acknowledged_at"]) if r["acknowledged_at"] else None,
            }
            for r in rows
        ]
    }


@router.get("/device-status")
async def device_status_report(
    uid:     str = Query(...),
    valve:   int = Query(...),
    battery: float = Query(default=0.0),
    db:      AsyncSession = Depends(get_db),
):
    """
    ESP device calls this on boot and state change.
    GET /valve/device-status?uid=123456789012345&valve=1&battery=3.75
    Stores in DB and returns plain text ACK.
    """
    await db.execute(
        text("""
            INSERT INTO valve_commands (
                cmd_id, device_uid, command_string, command_type,
                pin_number, state, status, created_at
            ) VALUES (
                :cmd_id, :uid, :cmd_str, 'device_status',
                0, :valve, 'acknowledged', now()
            )
        """),
        {
            "cmd_id":  str(uuid.uuid4()),
            "uid":     uid,
            "cmd_str": f"<<{valve}.{battery}>>",
            "valve":   valve,
        }
    )
    await db.commit()
    return PlainTextResponse(f"ACK:uid={uid},valve={valve},battery={battery}")