import uuid
import os
import shutil
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from typing import Optional
from pydantic import BaseModel
from app.database import get_db
from app.services.auth_service import get_current_user

router = APIRouter(prefix="/installations", tags=["Installations"])
bearer = HTTPBearer()

UPLOAD_DIR = "/var/www/krishihrudya/uploads/installations"
BASE_URL   = "/uploads/installations"
ALLOWED    = {"image/jpeg", "image/jpg", "image/png"}
MAX_SIZE   = 10 * 1024 * 1024  # 10MB

PHOTO_FIELDS = ["imei", "running_amps", "installation", "flowmeter"]


async def get_user_perms(token: str, db: AsyncSession):
    user = await get_current_user(token, db)
    result = await db.execute(
        text("SELECT * FROM role_permissions WHERE role_id = :rid"),
        {"rid": str(user.role_id)}
    )
    perms = result.mappings().first()
    return user, perms


# ── Upload single photo ───────────────────────────────────

@router.post("/upload-photo")
async def upload_photo(
    photo_type: str = Form(...),   # imei | running_amps | installation | flowmeter
    uid:        str = Form(...),   # device UID (last 4 used in filename)
    lat:        Optional[float] = Form(None),
    lng:        Optional[float] = Form(None),
    file:       UploadFile = File(...),
    credentials: HTTPAuthorizationCredentials = Depends(bearer),
    db:          AsyncSession = Depends(get_db),
):
    user, perms = await get_user_perms(credentials.credentials, db)
    if not perms or (perms.installations_manage != 1 and perms.installations_view != 1):
        raise HTTPException(status_code=403, detail="Permission denied")

    if photo_type not in PHOTO_FIELDS:
        raise HTTPException(status_code=400, detail=f"Invalid photo_type. Must be one of: {PHOTO_FIELDS}")

    # Validate file type
    if file.content_type not in ALLOWED:
        raise HTTPException(status_code=400, detail="Only JPG and PNG images are allowed")

    # Read and validate file size
    content = await file.read()
    if len(content) > MAX_SIZE:
        raise HTTPException(status_code=400, detail="File size must be under 10MB")

    # Generate filename: last4ofUID_phototype_timestamp.jpg
    uid_suffix = uid[-4:] if len(uid) >= 4 else uid
    timestamp  = datetime.utcnow().strftime("%Y%m%d%H%M%S")
    ext        = "jpg" if "jpeg" in file.content_type else "png"
    filename   = f"{uid_suffix}_{photo_type}_{timestamp}.{ext}"
    filepath   = os.path.join(UPLOAD_DIR, filename)

    # Save file
    os.makedirs(UPLOAD_DIR, exist_ok=True)
    with open(filepath, "wb") as f:
        f.write(content)

    url = f"{BASE_URL}/{filename}"

    return {
        "url":        url,
        "filename":   filename,
        "photo_type": photo_type,
        "lat":        lat,
        "lng":        lng,
        "uploaded_at": datetime.utcnow().isoformat(),
    }


# ── Create installation detail (draft or submit) ──────────

class InstallationCreate(BaseModel):
    uid:                str
    installation_id:    Optional[str]   = None
    farm_id:            Optional[str]   = None
    rr_number:          Optional[str]   = None
    borewell_depth:     Optional[float] = None
    motor_hp:           Optional[int]   = None
    address:            Optional[str]   = None
    waterman_name:      Optional[str]   = None
    waterman_phone:     Optional[str]   = None
    flow_meter_present: Optional[bool]  = False
    latitude:           Optional[float] = None
    longitude:          Optional[float] = None
    status:             str             = "draft"  # draft or submitted

    # Photos — URL + GPS
    photo_imei:             Optional[str]   = None
    photo_imei_lat:         Optional[float] = None
    photo_imei_lng:         Optional[float] = None
    photo_imei_at:          Optional[str]   = None

    photo_running_amps:     Optional[str]   = None
    photo_running_amps_lat: Optional[float] = None
    photo_running_amps_lng: Optional[float] = None
    photo_running_amps_at:  Optional[str]   = None

    photo_installation:     Optional[str]   = None
    photo_installation_lat: Optional[float] = None
    photo_installation_lng: Optional[float] = None
    photo_installation_at:  Optional[str]   = None

    photo_flowmeter:        Optional[str]   = None
    photo_flowmeter_lat:    Optional[float] = None
    photo_flowmeter_lng:    Optional[float] = None
    photo_flowmeter_at:     Optional[str]   = None


@router.post("")
async def create_installation(
    body: InstallationCreate,
    credentials: HTTPAuthorizationCredentials = Depends(bearer),
    db:          AsyncSession = Depends(get_db),
):
    user, perms = await get_user_perms(credentials.credentials, db)
    if not perms or perms.installations_manage != 1:
        raise HTTPException(status_code=403, detail="Permission denied")

    detail_id = str(uuid.uuid4())

    await db.execute(
        text("""
            INSERT INTO installation_details (
                detail_id, installation_id, uid, farm_id,
                rr_number, borewell_depth, motor_hp, address,
                waterman_name, waterman_phone, flow_meter_present,
                latitude, longitude,
                photo_imei, photo_imei_lat, photo_imei_lng, photo_imei_at,
                photo_running_amps, photo_running_amps_lat, photo_running_amps_lng, photo_running_amps_at,
                photo_installation, photo_installation_lat, photo_installation_lng, photo_installation_at,
                photo_flowmeter, photo_flowmeter_lat, photo_flowmeter_lng, photo_flowmeter_at,
                submitted_by, status, created_at, updated_at
            ) VALUES (
                :detail_id, :installation_id, :uid, :farm_id,
                :rr_number, :borewell_depth, :motor_hp, :address,
                :waterman_name, :waterman_phone, :flow_meter_present,
                :latitude, :longitude,
                :photo_imei, :photo_imei_lat, :photo_imei_lng, :photo_imei_at,
                :photo_running_amps, :photo_running_amps_lat, :photo_running_amps_lng, :photo_running_amps_at,
                :photo_installation, :photo_installation_lat, :photo_installation_lng, :photo_installation_at,
                :photo_flowmeter, :photo_flowmeter_lat, :photo_flowmeter_lng, :photo_flowmeter_at,
                :submitted_by, :status, now(), now()
            )
        """),
        {
            "detail_id":             detail_id,
            "installation_id":       body.installation_id,
            "uid":                   body.uid,
            "farm_id":               body.farm_id,
            "rr_number":             body.rr_number,
            "borewell_depth":        body.borewell_depth,
            "motor_hp":              body.motor_hp,
            "address":               body.address,
            "waterman_name":         body.waterman_name,
            "waterman_phone":        body.waterman_phone,
            "flow_meter_present":    body.flow_meter_present,
            "latitude":              body.latitude,
            "longitude":             body.longitude,
            "photo_imei":            body.photo_imei,
            "photo_imei_lat":        body.photo_imei_lat,
            "photo_imei_lng":        body.photo_imei_lng,
            "photo_imei_at":         body.photo_imei_at,
            "photo_running_amps":    body.photo_running_amps,
            "photo_running_amps_lat":body.photo_running_amps_lat,
            "photo_running_amps_lng":body.photo_running_amps_lng,
            "photo_running_amps_at": body.photo_running_amps_at,
            "photo_installation":    body.photo_installation,
            "photo_installation_lat":body.photo_installation_lat,
            "photo_installation_lng":body.photo_installation_lng,
            "photo_installation_at": body.photo_installation_at,
            "photo_flowmeter":       body.photo_flowmeter,
            "photo_flowmeter_lat":   body.photo_flowmeter_lat,
            "photo_flowmeter_lng":   body.photo_flowmeter_lng,
            "photo_flowmeter_at":    body.photo_flowmeter_at,
            "submitted_by":          str(user.user_id),
            "status":                body.status,
        }
    )
    await db.commit()
    return {"message": "Installation saved", "detail_id": detail_id, "status": body.status}


# ── List installations ────────────────────────────────────

@router.get("")
async def list_installations(
    status:      Optional[str] = None,
    uid:         Optional[str] = None,
    page:        int = 1,
    limit:       int = 20,
    credentials: HTTPAuthorizationCredentials = Depends(bearer),
    db:          AsyncSession = Depends(get_db),
):
    user, perms = await get_user_perms(credentials.credentials, db)
    if not perms or (perms.installations_manage != 1 and perms.installations_view != 1):
        raise HTTPException(status_code=403, detail="Permission denied")

    conditions = ["1=1"]
    params: dict = {}

    # Field team sees only their own records
    if not user.bypass_org_scope:
        conditions.append("d.submitted_by = :user_id")
        params["user_id"] = str(user.user_id)

    if status:
        conditions.append("d.status = :status")
        params["status"] = status
    if uid:
        conditions.append("d.uid ILIKE :uid")
        params["uid"] = f"%{uid}%"

    where = " AND ".join(conditions)

    count_res = await db.execute(
        text(f"SELECT COUNT(*) FROM installation_details d WHERE {where}"), params
    )
    total = count_res.scalar()

    params["limit"]  = limit
    params["offset"] = (page - 1) * limit

    result = await db.execute(
        text(f"""
            SELECT
                d.*,
                u.full_name as submitted_by_name
            FROM installation_details d
            LEFT JOIN users u ON u.user_id = d.submitted_by
            WHERE {where}
            ORDER BY d.created_at DESC
            LIMIT :limit OFFSET :offset
        """),
        params
    )
    rows = result.mappings().all()

    def fmt(r):
        return {
            "detail_id":             str(r["detail_id"]),
            "installation_id":       str(r["installation_id"]) if r["installation_id"] else None,
            "uid":                   r["uid"],
            "farm_id":               str(r["farm_id"]) if r["farm_id"] else None,
            "rr_number":             r["rr_number"],
            "borewell_depth":        float(r["borewell_depth"]) if r["borewell_depth"] else None,
            "motor_hp":              r["motor_hp"],
            "address":               r["address"],
            "waterman_name":         r["waterman_name"],
            "waterman_phone":        r["waterman_phone"],
            "flow_meter_present":    r["flow_meter_present"],
            "photo_imei":            r["photo_imei"],
            "photo_imei_lat":        float(r["photo_imei_lat"]) if r["photo_imei_lat"] else None,
            "photo_imei_lng":        float(r["photo_imei_lng"]) if r["photo_imei_lng"] else None,
            "photo_imei_at":         str(r["photo_imei_at"]) if r["photo_imei_at"] else None,
            "photo_running_amps":    r["photo_running_amps"],
            "photo_running_amps_lat":float(r["photo_running_amps_lat"]) if r["photo_running_amps_lat"] else None,
            "photo_running_amps_lng":float(r["photo_running_amps_lng"]) if r["photo_running_amps_lng"] else None,
            "photo_running_amps_at": str(r["photo_running_amps_at"]) if r["photo_running_amps_at"] else None,
            "photo_installation":    r["photo_installation"],
            "photo_installation_lat":float(r["photo_installation_lat"]) if r["photo_installation_lat"] else None,
            "photo_installation_lng":float(r["photo_installation_lng"]) if r["photo_installation_lng"] else None,
            "photo_installation_at": str(r["photo_installation_at"]) if r["photo_installation_at"] else None,
            "photo_flowmeter":       r["photo_flowmeter"],
            "photo_flowmeter_lat":   float(r["photo_flowmeter_lat"]) if r["photo_flowmeter_lat"] else None,
            "photo_flowmeter_lng":   float(r["photo_flowmeter_lng"]) if r["photo_flowmeter_lng"] else None,
            "photo_flowmeter_at":    str(r["photo_flowmeter_at"]) if r["photo_flowmeter_at"] else None,
            "submitted_by":          str(r["submitted_by"]) if r["submitted_by"] else None,
            "submitted_by_name":     r["submitted_by_name"],
            "status":                r["status"],
            "created_at":            str(r["created_at"]) if r["created_at"] else None,
            "updated_at":            str(r["updated_at"]) if r["updated_at"] else None,
        }

    return {"total": total, "page": page, "limit": limit, "records": [fmt(r) for r in rows]}


# ── Get single installation detail ───────────────────────

@router.get("/{detail_id}")
async def get_installation(
    detail_id:   str,
    credentials: HTTPAuthorizationCredentials = Depends(bearer),
    db:          AsyncSession = Depends(get_db),
):
    user, perms = await get_user_perms(credentials.credentials, db)
    if not perms or (perms.installations_manage != 1 and perms.installations_view != 1):
        raise HTTPException(status_code=403, detail="Permission denied")

    result = await db.execute(
        text("""
            SELECT d.*, u.full_name as submitted_by_name
            FROM installation_details d
            LEFT JOIN users u ON u.user_id = d.submitted_by
            WHERE d.detail_id = :did
        """),
        {"did": detail_id}
    )
    row = result.mappings().first()
    if not row:
        raise HTTPException(status_code=404, detail="Record not found")

    # Field team can only view their own
    if not user.bypass_org_scope and str(row["submitted_by"]) != str(user.user_id):
        raise HTTPException(status_code=403, detail="Access denied")

    return {
        "detail_id":             str(row["detail_id"]),
        "installation_id":       str(row["installation_id"]) if row["installation_id"] else None,
        "uid":                   row["uid"],
        "farm_id":               str(row["farm_id"]) if row["farm_id"] else None,
        "rr_number":             row["rr_number"],
        "borewell_depth":        float(row["borewell_depth"]) if row["borewell_depth"] else None,
        "motor_hp":              row["motor_hp"],
        "address":               row["address"],
        "waterman_name":         row["waterman_name"],
        "waterman_phone":        row["waterman_phone"],
        "flow_meter_present":    row["flow_meter_present"],
        "photo_imei":            row["photo_imei"],
        "photo_imei_lat":        float(row["photo_imei_lat"]) if row["photo_imei_lat"] else None,
        "photo_imei_lng":        float(row["photo_imei_lng"]) if row["photo_imei_lng"] else None,
        "photo_imei_at":         str(row["photo_imei_at"]) if row["photo_imei_at"] else None,
        "photo_running_amps":    row["photo_running_amps"],
        "photo_running_amps_lat":float(row["photo_running_amps_lat"]) if row["photo_running_amps_lat"] else None,
        "photo_running_amps_lng":float(row["photo_running_amps_lng"]) if row["photo_running_amps_lng"] else None,
        "photo_running_amps_at": str(row["photo_running_amps_at"]) if row["photo_running_amps_at"] else None,
        "photo_installation":    row["photo_installation"],
        "photo_installation_lat":float(row["photo_installation_lat"]) if row["photo_installation_lat"] else None,
        "photo_installation_lng":float(row["photo_installation_lng"]) if row["photo_installation_lng"] else None,
        "photo_installation_at": str(row["photo_installation_at"]) if row["photo_installation_at"] else None,
        "photo_flowmeter":       row["photo_flowmeter"],
        "photo_flowmeter_lat":   float(row["photo_flowmeter_lat"]) if row["photo_flowmeter_lat"] else None,
        "photo_flowmeter_lng":   float(row["photo_flowmeter_lng"]) if row["photo_flowmeter_lng"] else None,
        "photo_flowmeter_at":    str(row["photo_flowmeter_at"]) if row["photo_flowmeter_at"] else None,
        "submitted_by":          str(row["submitted_by"]) if row["submitted_by"] else None,
        "submitted_by_name":     row["submitted_by_name"],
        "status":                row["status"],
        "created_at":            str(row["created_at"]) if row["created_at"] else None,
        "updated_at":            str(row["updated_at"]) if row["updated_at"] else None,
    }


# ── Update installation (add missed photos / verify) ─────

class InstallationUpdate(BaseModel):
    rr_number:          Optional[str]   = None
    borewell_depth:     Optional[float] = None
    motor_hp:           Optional[int]   = None
    address:            Optional[str]   = None
    waterman_name:      Optional[str]   = None
    waterman_phone:     Optional[str]   = None
    flow_meter_present: Optional[bool]  = None
    latitude:           Optional[float] = None
    longitude:          Optional[float] = None
    status:             Optional[str]   = None

    photo_imei:             Optional[str]   = None
    photo_imei_lat:         Optional[float] = None
    photo_imei_lng:         Optional[float] = None
    photo_imei_at:          Optional[str]   = None

    photo_running_amps:     Optional[str]   = None
    photo_running_amps_lat: Optional[float] = None
    photo_running_amps_lng: Optional[float] = None
    photo_running_amps_at:  Optional[str]   = None

    photo_installation:     Optional[str]   = None
    photo_installation_lat: Optional[float] = None
    photo_installation_lng: Optional[float] = None
    photo_installation_at:  Optional[str]   = None

    photo_flowmeter:        Optional[str]   = None
    photo_flowmeter_lat:    Optional[float] = None
    photo_flowmeter_lng:    Optional[float] = None
    photo_flowmeter_at:     Optional[str]   = None


@router.put("/{detail_id}")
async def update_installation(
    detail_id:   str,
    body:        InstallationUpdate,
    credentials: HTTPAuthorizationCredentials = Depends(bearer),
    db:          AsyncSession = Depends(get_db),
):
    user, perms = await get_user_perms(credentials.credentials, db)
    if not perms or perms.installations_manage != 1:
        raise HTTPException(status_code=403, detail="Permission denied")

    # Only internal team can verify
    if body.status == "verified" and not user.bypass_org_scope:
        raise HTTPException(status_code=403, detail="Only KH internal team can verify installations")

    updates = {k: v for k, v in body.model_dump().items() if v is not None}
    if not updates:
        return {"message": "No changes to apply"}

    updates["updated_at"] = datetime.utcnow().isoformat()
    set_clause = ", ".join([f"{k} = :{k}" for k in updates.keys()])
    updates["detail_id"] = detail_id

    await db.execute(
        text(f"UPDATE installation_details SET {set_clause} WHERE detail_id = :detail_id"),
        updates
    )
    await db.commit()
    return {"message": "Installation updated successfully"}
