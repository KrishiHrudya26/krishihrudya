import uuid
import json
import logging
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, text
from typing import Optional, List
from pydantic import BaseModel
from app.database import get_db
from app.models.role import RolePermission
from app.services.auth_service import get_current_user
from app.database import get_legacy_db
from app.utils.redis_client import get_redis
from app.database import get_legacy_db
from pydantic import BaseModel, field_validator

CACHE_TTL = 600


router = APIRouter(prefix="/portal", tags=["Customer Portal"])

ISSUE_CATEGORIES = [
    "Overload Trip", "Underload Trip", "Dry Run Trip",
    "SIM / Connectivity Problem", "Phase Reversal Error",
    "Voltage / Phase Error", "Physical Damage",
    "Panel / MCB / Fuse Issue", "Auto/Manual Mode Problem", "Other",
]

CUST_TYPE_CODES = {
    "b2c": "C", "b2g": "G", "b2b": "B",
    "internal": "I", "collaborator": "L", "demo": "D", "dealer": "R",
}


async def get_portal_user(token: str, db: AsyncSession):
    from app.utils.jwt import decode_token
    payload = decode_token(token)
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid token")

    user_id = payload.get("sub")

    # Check portal_users first
    result = await db.execute(
    text("SELECT portal_user_id, full_name, phone, ticket_view_permission FROM portal_users WHERE portal_user_id::text = :uid"),
        {"uid": user_id}
    )
    portal_user = result.mappings().first()

    if portal_user:
        class PortalUser:
            def __init__(self, row):
                self.user_id          = row["portal_user_id"]
                self.full_name        = row["full_name"]
                self.phone            = row["phone"]
                self.bypass_org_scope = bool(row.get("ticket_view_permission", 0))
                self.customer_id      = None
                self.role_id          = None
                self.is_admin         = bool(row.get("ticket_view_permission", 0))
        return PortalUser(portal_user)
    # Fall back to main users for admins
    user = await get_current_user(token, db)
    user.is_admin = bool(user.bypass_org_scope)
    return user


def _is_admin(user) -> bool:
    return getattr(user, 'bypass_org_scope', False) or getattr(user, 'is_admin', False)


async def generate_portal_ticket_number(db: AsyncSession) -> str:
    year = str(datetime.now().year)[2:]
    result = await db.execute(text("""
        SELECT ticket_number FROM portal_tickets
        WHERE ticket_number LIKE :prefix
        ORDER BY ticket_number DESC LIMIT 1
    """), {"prefix": f"KSWEB{year}%"})
    last = result.scalar_one_or_none()
    seq = int(last[-5:]) + 1 if last else 1
    return f"KSWEB{year}{seq:05d}"


class SopChecklist(BaseModel):
    panel_board_checked:    bool = False
    three_phase_verified:   bool = False
    fuse_mcb_checked:       bool = False
    video_recorded:         bool = False
    photos_taken:           bool = False
    person_will_be_present: bool = False


class TicketCreate(BaseModel):
    uid:               Optional[str]   = None
    farm_id:           Optional[str]   = None
    issue_category:    str
    service_mode:      Optional[int]   = None
    priority:          str             = "medium"
    description:       str
    sop_checklist:     SopChecklist
    photo_evidence:    List[str]
    contact_person:    str
    contact_number:    str
    location_lat:      Optional[float] = None
    location_lng:      Optional[float] = None
    in_warranty_period: bool           = False


class TicketStatusUpdate(BaseModel):
    status:               str
    service_mode:         Optional[int] = None
    resolution_notes:     Optional[str] = None
    assigned_dealer_id:   Optional[str] = None
    device_received_at:   Optional[str] = None
    device_returned_at:   Optional[str] = None
    device_condition_in:  Optional[str] = None
    device_condition_out: Optional[str] = None
    note:                 Optional[str] = None

from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
bearer = HTTPBearer()


@router.get("/categories")
async def get_categories():
    return {"categories": ISSUE_CATEGORIES}


@router.get("/wards")
async def get_wards(
    credentials: HTTPAuthorizationCredentials = Depends(bearer),
    db:          AsyncSession = Depends(get_db),
    legacy_db:   AsyncSession = Depends(get_legacy_db),
):
    await get_portal_user(credentials.credentials, db)

    cache_key = "legacy:farms"
    try:
        async with get_redis() as r:
            cached = await r.get(cache_key)
            if cached:
                return {"wards": json.loads(cached)}
    except Exception:
        pass

    result = await legacy_db.execute(
        text("SELECT farm_name FROM farms ORDER BY farm_name")
    )
    wards = [{"farm_name": row[0]} for row in result.fetchall()]

    try:
        async with get_redis() as r:
            await r.setex(cache_key, CACHE_TTL, json.dumps(wards))
    except Exception:
        pass

    return {"wards": wards}


@router.get("/uids")
async def get_legacy_uids_for_portal(
    credentials: HTTPAuthorizationCredentials = Depends(bearer),
    db:          AsyncSession = Depends(get_db),
    legacy_db:   AsyncSession = Depends(get_legacy_db),
):
    await get_portal_user(credentials.credentials, db)

    cache_key = "legacy:uids"
    try:
        async with get_redis() as r:
            cached = await r.get(cache_key)
            if cached:
                return {"uids": json.loads(cached)}
    except Exception:
        pass

    try:
        result = await legacy_db.execute(
            text("SELECT uid FROM products WHERE test_status = 2 AND status = 1")
        )
        uids = [row[0] for row in result.fetchall()]
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Legacy DB error: {str(e)}")

    try:
        async with get_redis() as r:
            await r.setex(cache_key, CACHE_TTL, json.dumps(uids))
    except Exception:
        pass

    return {"uids": uids}


@router.get("/tickets")
async def list_tickets(
    my:           bool          = Query(False),
    status:       Optional[str] = None,
    category:     Optional[str] = None,
    service_mode: Optional[int] = None,
    priority:     Optional[str] = None,
    page:         int           = 1,
    limit:        int           = 20,
    credentials:  HTTPAuthorizationCredentials = Depends(bearer),
    db:           AsyncSession  = Depends(get_db),
):
    user  = await get_portal_user(credentials.credentials, db)
    admin = _is_admin(user)

    conditions = ["1=1"]
    params: dict = {}

    if not admin:
        conditions.append("pt.portal_user_id::text = :user_id")
        params["user_id"] = str(user.user_id)

    if status:       conditions.append("pt.status = :status");             params["status"]       = status
    if category:     conditions.append("pt.issue_category = :category");   params["category"]     = category
    if service_mode: conditions.append("pt.service_mode = :service_mode"); params["service_mode"] = service_mode
    if priority:     conditions.append("pt.priority = :priority");         params["priority"]     = priority

    where = " AND ".join(conditions)

    count_result = await db.execute(
        text(f"SELECT COUNT(*) FROM portal_tickets pt WHERE {where}"), params
    )
    total = count_result.scalar()

    params["limit"]  = limit
    params["offset"] = (page - 1) * limit

    result = await db.execute(text(f"""
        SELECT
            pt.ticket_id, pt.ticket_number, pt.uid,
            pt.issue_category, pt.service_mode, pt.priority,
            pt.status, pt.description, pt.contact_person, pt.contact_number,
            pt.photo_evidence, pt.sop_checklist,
            pt.in_warranty_period, pt.assigned_dealer_id,
            pt.device_received_at, pt.device_returned_at,
            pt.device_condition_in, pt.device_condition_out,
            pt.resolution_notes, pt.ticket_notes,
            pt.location_lat, pt.location_lng,
            pt.requested_date, pt.resolved_date, pt.created_at,
            pu.full_name as raised_by_name,
            f.farm_name, f.ward_number
        FROM portal_tickets pt
        LEFT JOIN portal_users pu ON pu.portal_user_id = pt.portal_user_id
        LEFT JOIN farms f ON f.farm_id = pt.farm_id
        WHERE {where}
        ORDER BY pt.created_at DESC
        LIMIT :limit OFFSET :offset
    """), params)
    rows = result.mappings().all()

    def fmt(row):
        return {
            "ticket_id":           str(row["ticket_id"]),
            "ticket_number":       row["ticket_number"],
            "uid":                 str(row["uid"]) if row["uid"] else None,
            "farm_name":           row["farm_name"],
            "ward_number":         row["ward_number"],
            "issue_category":      row["issue_category"],
            "service_mode":        row["service_mode"],
            "priority":            row["priority"],
            "status":              row["status"],
            "description":         row["description"],
            "contact_person":      row["contact_person"],
            "contact_number":      row["contact_number"],
            "photo_evidence":      row["photo_evidence"] or [],
            "sop_checklist":       row["sop_checklist"] or {},
            "in_warranty_period":  row["in_warranty_period"],
            "assigned_dealer_id":  str(row["assigned_dealer_id"]) if row["assigned_dealer_id"] else None,
            "device_received_at":  str(row["device_received_at"]) if row["device_received_at"] else None,
            "device_returned_at":  str(row["device_returned_at"]) if row["device_returned_at"] else None,
            "device_condition_in": row["device_condition_in"],
            "device_condition_out":row["device_condition_out"],
            "resolution_notes":    row["resolution_notes"],
            "ticket_notes":        row["ticket_notes"] or [],
            "location_lat":        float(row["location_lat"]) if row["location_lat"] else None,
            "location_lng":        float(row["location_lng"]) if row["location_lng"] else None,
            "requested_date":      str(row["requested_date"]) if row["requested_date"] else None,
            "resolved_date":       str(row["resolved_date"]) if row["resolved_date"] else None,
            "created_at":          str(row["created_at"]) if row["created_at"] else None,
            "raised_by_name":      row["raised_by_name"],
            "customer_name":       None,
            "customer_code":       None,
        }

    return {"total": total, "page": page, "limit": limit, "tickets": [fmt(r) for r in rows]}


@router.get("/tickets/{ticket_id}")
async def get_ticket(
    ticket_id:   str,
    credentials: HTTPAuthorizationCredentials = Depends(bearer),
    db:          AsyncSession = Depends(get_db),
):
    user  = await get_portal_user(credentials.credentials, db)
    admin = _is_admin(user)

    result = await db.execute(text("""
        SELECT pt.*, pu.full_name as raised_by_name,
               f.farm_name, f.ward_number
        FROM portal_tickets pt
        LEFT JOIN portal_users pu ON pu.portal_user_id = pt.portal_user_id
        LEFT JOIN farms f ON f.farm_id = pt.farm_id
        WHERE pt.ticket_id = :tid
    """), {"tid": ticket_id})
    row = result.mappings().first()

    if not row:
        raise HTTPException(status_code=404, detail="Ticket not found")
    if not admin and str(row["portal_user_id"]) != str(user.user_id):
        raise HTTPException(status_code=403, detail="Access denied")

    return {
        "ticket_id":           str(row["ticket_id"]),
        "ticket_number":       row["ticket_number"],
        "uid":                 str(row["uid"]) if row["uid"] else None,
        "farm_name":           row["farm_name"],
        "ward_number":         row["ward_number"],
        "issue_category":      row["issue_category"],
        "service_mode":        row["service_mode"],
        "priority":            row["priority"],
        "status":              row["status"],
        "description":         row["description"],
        "contact_person":      row["contact_person"],
        "contact_number":      row["contact_number"],
        "photo_evidence":      row["photo_evidence"] or [],
        "sop_checklist":       row["sop_checklist"] or {},
        "in_warranty_period":  row["in_warranty_period"],
        "resolution_notes":    row["resolution_notes"],
        "ticket_notes":        row["ticket_notes"] or [],
        "assigned_dealer_id":  str(row["assigned_dealer_id"]) if row["assigned_dealer_id"] else None,
        "dealer_name":         None,
        "dealer_code":         None,
        "dealer_phone":        None,
        "device_received_at":  str(row["device_received_at"]) if row["device_received_at"] else None,
        "device_returned_at":  str(row["device_returned_at"]) if row["device_returned_at"] else None,
        "device_condition_in": row["device_condition_in"],
        "device_condition_out":row["device_condition_out"],
        "location_lat":        float(row["location_lat"]) if row["location_lat"] else None,
        "location_lng":        float(row["location_lng"]) if row["location_lng"] else None,
        "requested_date":      str(row["requested_date"]) if row["requested_date"] else None,
        "resolved_date":       str(row["resolved_date"]) if row["resolved_date"] else None,
        "created_at":          str(row["created_at"]) if row["created_at"] else None,
        "raised_by_name":      row["raised_by_name"],
        "customer_name":       None,
        "customer_code":       None,
    }



@router.post("/tickets")
async def create_ticket(
    body:        TicketCreate,
    credentials: HTTPAuthorizationCredentials = Depends(bearer),
    db:          AsyncSession = Depends(get_db),
):
    user = await get_portal_user(credentials.credentials, db)

    checklist = body.sop_checklist
    sop_fields = [
        checklist.panel_board_checked, checklist.three_phase_verified,
        checklist.fuse_mcb_checked, checklist.video_recorded,
        checklist.photos_taken, checklist.person_will_be_present,
    ]
    if not all(sop_fields):
        raise HTTPException(status_code=400, detail="All SOP checklist items must be completed.")
    if not body.photo_evidence:
        raise HTTPException(status_code=400, detail="At least one photo evidence URL is required.")

    ticket_number = await generate_portal_ticket_number(db)
    ticket_id     = str(uuid.uuid4())

    ticket_notes = [{
        "timestamp": datetime.utcnow().isoformat(),
        "by":        user.full_name,
        "action":    "Ticket raised",
        "note":      f"Service request created. Priority: {body.priority}."
    }]

    await db.execute(text("""
        INSERT INTO portal_tickets (
            ticket_id, ticket_number, portal_user_id, uid, farm_id,
            issue_category, service_mode, priority, status,
            description, sop_checklist, photo_evidence,
            contact_person, contact_number,
            in_warranty_period, location_lat, location_lng,
            ticket_notes, requested_date, created_at, updated_at
        ) VALUES (
            :ticket_id, :ticket_number, :portal_user_id, :uid, :farm_id,
            :issue_category, :service_mode, :priority, 'open',
            :description, :sop_checklist, :photo_evidence,
            :contact_person, :contact_number,
            :in_warranty_period, :location_lat, :location_lng,
            :ticket_notes, now(), now(), now()
        )
    """), {
        "ticket_id":          ticket_id,
        "ticket_number":      ticket_number,
        "portal_user_id":     str(user.user_id),
        "uid":                body.uid,
        "farm_id":            body.farm_id,
        "issue_category":     body.issue_category,
        "service_mode":       body.service_mode,
        "priority":           body.priority,
        "description":        body.description,
        "sop_checklist":      json.dumps(checklist.model_dump()),
        "photo_evidence":     json.dumps(body.photo_evidence),
        "contact_person":     body.contact_person,
        "contact_number":     body.contact_number,
        "in_warranty_period": body.in_warranty_period,
        "location_lat":       body.location_lat,
        "location_lng":       body.location_lng,
        "ticket_notes":       json.dumps(ticket_notes),
    })
    await db.commit()

    return {
        "message":       "Service ticket raised successfully",
        "ticket_id":     ticket_id,
        "ticket_number": ticket_number,
    }


@router.put("/tickets/{ticket_id}")
async def update_ticket(
    ticket_id:   str,
    body:        TicketStatusUpdate,
    credentials: HTTPAuthorizationCredentials = Depends(bearer),
    db:          AsyncSession = Depends(get_db),
):
    user = await get_portal_user(credentials.credentials, db)
    if not _is_admin(user):
        raise HTTPException(status_code=403, detail="Permission denied")

    result = await db.execute(
        text("SELECT * FROM portal_tickets WHERE ticket_id = :tid"), {"tid": ticket_id}
    )
    ticket = result.mappings().first()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")

    existing_notes = ticket["ticket_notes"] or []
    if isinstance(existing_notes, str):
        existing_notes = json.loads(existing_notes)

    existing_notes.append({
        "timestamp": datetime.utcnow().isoformat(),
        "by":        user.full_name,
        "action":    f"Status changed to {body.status}",
        "note":      body.note or "",
    })

    updates = {
        "status":       body.status,
        "ticket_notes": json.dumps(existing_notes),
        "updated_at":   datetime.utcnow().isoformat(),
    }

    if body.service_mode is not None:  updates["service_mode"]       = body.service_mode
    if body.resolution_notes:          updates["resolution_notes"]   = body.resolution_notes
    if body.assigned_dealer_id:        updates["assigned_dealer_id"] = body.assigned_dealer_id
    if body.device_received_at:        updates["device_received_at"] = body.device_received_at
    if body.device_returned_at:
        updates["device_returned_at"] = body.device_returned_at
        updates["resolved_date"]      = body.device_returned_at
    if body.device_condition_in:       updates["device_condition_in"]  = body.device_condition_in
    if body.device_condition_out:      updates["device_condition_out"] = body.device_condition_out
    if body.status in ["resolved", "closed"] and not ticket["resolved_date"]:
        updates["resolved_date"] = datetime.utcnow().isoformat()

    set_clause = ", ".join([f"{k} = :{k}" for k in updates.keys()])
    updates["ticket_id"] = ticket_id

    await db.execute(
        text(f"UPDATE portal_tickets SET {set_clause} WHERE ticket_id = :ticket_id"), updates
    )
    await db.commit()
    return {"message": "Ticket updated successfully"}
