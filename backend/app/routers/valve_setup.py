import socket
import asyncio
from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from pydantic import BaseModel
from typing import Optional
from app.database import get_db
from app.services.auth_service import get_current_user

router = APIRouter(prefix="/valve-setup", tags=["Valve Setup"])
bearer = HTTPBearer()

ESP_UDP_IP   = "192.168.33.1"
ESP_UDP_PORT = 9090
UDP_TIMEOUT  = 3

class RegisterBody(BaseModel):
    uid: str

class CredentialsBody(BaseModel):
    uid:      str
    ssid:     str
    password: str

def send_udp_to_esp(ssid: str, password: str) -> bool:
    message = f"StationSSID{ssid}!StationPW{password}"
    payload = message.encode("utf-8")
    try:
        sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        sock.settimeout(UDP_TIMEOUT)
        sock.sendto(payload, (ESP_UDP_IP, ESP_UDP_PORT))
        sock.close()
        return True
    except Exception as e:
        print(f"[valve-setup] UDP send error: {e}")
        return False

# ── 1. Register UID on QR scan ───────────────────────────
@router.post("/register")
async def register_device(
    body: RegisterBody,
    db: AsyncSession = Depends(get_db),
):
    uid = body.uid.strip()
    if not uid:
        raise HTTPException(status_code=400, detail="uid is required")
    await db.execute(
        text("""
            INSERT INTO valve_devices (uid, created_at)
            VALUES (:uid, NOW())
            ON CONFLICT (uid) DO NOTHING
        """),
        {"uid": uid},
    )
    await db.commit()
    return {"ok": True, "uid": uid}

# ── 2. Send UDP + save to DB ─────────────────────────────
@router.post("/credentials")
async def send_credentials(
    body: CredentialsBody,
    db: AsyncSession = Depends(get_db),
):
    uid      = body.uid.strip()
    ssid     = body.ssid.strip()
    password = body.password.strip()
    if not all([uid, ssid, password]):
        raise HTTPException(status_code=400, detail="uid, ssid, password required")

    result = await db.execute(
        text("SELECT id FROM valve_devices WHERE uid = :uid"),
        {"uid": uid},
    )
    if not result.mappings().first():
        raise HTTPException(status_code=404, detail="Device UID not found.")

    # Send UDP from backend (fallback — APK sends directly)
    udp_sent = await asyncio.get_event_loop().run_in_executor(
        None, send_udp_to_esp, ssid, password
    )

    # Save to DB regardless of UDP result
    await db.execute(
        text("""
            UPDATE valve_devices
            SET ssid = :ssid,
                udp_sent = :udp_sent,
                udp_sent_at = NOW(),
                wifi_status = 'pending',
                mqtt_connected = FALSE
            WHERE uid = :uid
        """),
        {"uid": uid, "ssid": ssid, "udp_sent": udp_sent},
    )
    await db.commit()

    return {
        "ok":       True,
        "uid":      uid,
        "udp_sent": udp_sent,
        "message":  "UDP sent to ESP." if udp_sent else "UDP failed",
    }

# ── 3. ESP status polling ─────────────────────────────────
@router.get("/status/{uid}")
async def get_status(
    uid: str,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        text("""
            SELECT uid, ssid, udp_sent, udp_sent_at,
                   wifi_status, ip_address, mqtt_connected
            FROM valve_devices WHERE uid = :uid
        """),
        {"uid": uid},
    )
    row = result.mappings().first()
    if not row:
        raise HTTPException(status_code=404, detail="Device not found")
    return dict(row)

# ── 4. ESP confirms WiFi connected (called by ESP firmware)
@router.post("/confirm/{uid}")
async def esp_confirm(
    uid: str,
    ip_address: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
):
    await db.execute(
        text("""
            UPDATE valve_devices
            SET wifi_status = 'connected',
                ip_address = :ip,
                mqtt_connected = TRUE
            WHERE uid = :uid
        """),
        {"uid": uid, "ip": ip_address},
    )
    await db.commit()
    return {"ok": True, "message": f"{uid} confirmed connected"}
# ── Save credentials to DB only (called from APK after native UDP) ─
@router.post("/save-credentials")
async def save_credentials_only(
    body: CredentialsBody,
    db: AsyncSession = Depends(get_db),
):
    uid  = body.uid.strip()
    ssid = body.ssid.strip()
    if not uid:
        raise HTTPException(status_code=400, detail="uid required")
    await db.execute(
        text("""
            INSERT INTO valve_devices (uid, ssid, udp_sent, udp_sent_at, wifi_status, created_at)
            VALUES (:uid, :ssid, TRUE, NOW(), 'pending', NOW())
            ON CONFLICT (uid) DO UPDATE SET
                ssid        = :ssid,
                udp_sent    = TRUE,
                udp_sent_at = NOW(),
                wifi_status = 'pending'
        """),
        {"uid": uid, "ssid": ssid},
    )
    await db.commit()
    return {"ok": True}
# ── 5. List all valve devices ─────────────────────────────
@router.get("/devices")
async def list_devices(
    credentials: HTTPAuthorizationCredentials = Depends(bearer),
    db: AsyncSession = Depends(get_db),
):
    await get_current_user(credentials.credentials, db)
    result = await db.execute(
        text("""
            SELECT uid, ssid, udp_sent, udp_sent_at,
                   wifi_status, ip_address, mqtt_connected, created_at
            FROM valve_devices ORDER BY created_at DESC
        """)
    )
    rows = result.mappings().all()
    return {"total": len(rows), "devices": [dict(r) for r in rows]}
