import uuid
from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, text
from typing import Optional, List
from pydantic import BaseModel
from datetime import datetime
from app.database import get_db
from app.models.user import User, Customer
from app.models.role import RolePermission
from app.services.auth_service import get_current_user

router = APIRouter(prefix="/services", tags=["Services"])
bearer = HTTPBearer()

ISSUE_CATEGORIES = [
    "Overload Trip",
    "Underload Trip",
    "Dry Run Trip",
    "SIM / Connectivity Problem",
    "Phase Reversal Error",
    "Voltage / Phase Error",
    "Physical Damage",
    "Panel / MCB / Fuse Issue",
    "Auto/Manual Mode Problem",
    "Other",
]

STATUSES_FIELD_VISIT = [
    "open", "assigned", "in_progress", "resolved", "closed", "rejected"
]

STATUSES_BRING_TO_OFFICE = [
    "open", "waiting_for_device", "device_received", "repaired", "closed", "rejected"
]

STATE_CODES = {
    "01": "Jammu And Kashmir", "02": "Himachal Pradesh", "03": "Punjab",
    "04": "Chandigarh", "05": "Uttarakhand", "06": "Haryana", "07": "Delhi",
    "08": "Rajasthan", "09": "Uttar Pradesh", "10": "Bihar", "11": "Sikkim",
    "12": "Arunachal Pradesh", "13": "Nagaland", "14": "Manipur", "15": "Mizoram",
    "16": "Tripura", "17": "Meghalaya", "18": "Assam", "19": "West Bengal",
    "20": "Jharkhand", "21": "Orissa", "22": "Chhattisgarh", "23": "Madhya Pradesh",
    "24": "Gujarat", "26": "Dadra And Nagar Haveli", "27": "Maharashtra",
    "29": "Karnataka", "30": "Goa", "31": "Lakshadweep", "32": "Kerala",
    "33": "Tamil Nadu", "34": "Puducherry", "35": "Andaman And Nicobar",
    "36": "Telangana", "37": "Andhra Pradesh", "38": "Ladakh",
    "97": "Other Territory", "99": "Other Country",
}

CUST_TYPE_CODES = {
    "b2c": "C", "b2g": "G", "b2b": "B",
    "internal": "I", "collaborator": "L", "demo": "D", "dealer": "R",
}


async def generate_ticket_number(customer_id_str: str, cust_type: str, db: AsyncSession) -> str:
    state_code = customer_id_str[1:3] if len(customer_id_str) >= 3 else "00"
    type_code  = CUST_TYPE_CODES.get(cust_type, "X")
    year       = str(datetime.now().year)[2:]
    prefix     = f"KS{state_code}{type_code}{year}"

    result = await db.execute(
        text("""
            SELECT ticket_number FROM service
            WHERE ticket_number LIKE :prefix
            ORDER BY ticket_number DESC
            LIMIT 1
        """),
        {"prefix": f"{prefix}%"}
    )
    last = result.scalar_one_or_none()
    if last:
        seq = int(last[-5:]) + 1
    else:
        seq = 1
    return f"{prefix}{seq:05d}"


async def get_user_and_perms(token: str, db: AsyncSession):
    user = await get_current_user(token, db)
    result = await db.execute(
        select(RolePermission).where(RolePermission.role_id == user.role_id)
    )
    perms = result.scalar_one_or_none()
    return user, perms


class SopChecklist(BaseModel):
    panel_board_checked:    bool = False
    three_phase_verified:   bool = False
    fuse_mcb_checked:       bool = False
    video_recorded:         bool = False
    photos_taken:           bool = False
    person_will_be_present: bool = False


class TicketCreate(BaseModel):
    uid:              str
    farm_id:          Optional[str] = None
    issue_category:   str
    service_mode:     Optional[int] = None
    priority:         str = "medium"
    description:      str
    sop_checklist:    SopChecklist
    photo_evidence:   List[str]
    contact_person:   str
    contact_number:   str
    location_lat:     Optional[float] = None
    location_lng:     Optional[float] = None
    in_warranty_period: bool = False


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


@router.get("/categories")
async def get_categories():
    return {"categories": ISSUE_CATEGORIES}


@router.get("")
async def list_tickets(
    status:      Optional[str] = None,
    category:    Optional[str] = None,
    service_mode: Optional[int] = None,
    priority:    Optional[str] = None,
    customer_id: Optional[str] = None,
    page:        int = 1,
    limit:       int = 20,
    credentials: HTTPAuthorizationCredentials = Depends(bearer),
    db:          AsyncSession = Depends(get_db),
):
    user, perms = await get_user_and_perms(credentials.credentials, db)

    conditions = ["1=1"]
    params: dict = {}

    if not user.bypass_org_scope:
        conditions.append("s.user_id = :user_id")
        params["user_id"] = str(user.user_id)
    elif customer_id:
        conditions.append("s.customer_id = :customer_id")
        params["customer_id"] = customer_id

    if status:
        conditions.append("s.status = :status")
        params["status"] = status
    if category:
        conditions.append("s.issue_category = :category")
        params["category"] = category
    if service_mode:
        conditions.append("s.service_mode = :service_mode")
        params["service_mode"] = service_mode
    if priority:
        conditions.append("s.priority = :priority")
        params["priority"] = priority

    where = " AND ".join(conditions)

    count_result = await db.execute(
        text(f"SELECT COUNT(*) FROM service s WHERE {where}"), params
    )
    total = count_result.scalar()

    params["limit"]  = limit
    params["offset"] = (page - 1) * limit

    result = await db.execute(
        text(f"""
            SELECT
                s.ticket_id, s.ticket_number, s.uid, s.farm_id,
                s.issue_category, s.service_mode, s.priority,
                s.status, s.description, s.contact_person, s.contact_number,
                s.photo_evidence, s.sop_checklist,
                s.in_warranty_period, s.assigned_dealer_id,
                s.device_received_at, s.device_returned_at,
                s.device_condition_in, s.device_condition_out,
                s.resolution_notes, s.ticket_notes,
                s.location_lat, s.location_lng,
                s.requested_date, s.resolved_date, s.created_at,
                u.full_name as raised_by_name,
                c.cust_name as customer_name, c.customer_id as customer_code,
                f.farm_name
            FROM service s
            LEFT JOIN users u ON u.user_id = s.user_id
            LEFT JOIN customers c ON c.cust_id = s.customer_id
            LEFT JOIN farms f ON f.farm_id = s.farm_id
            WHERE {where}
            ORDER BY s.created_at DESC
            LIMIT :limit OFFSET :offset
        """),
        params
    )
    rows = result.mappings().all()

    def fmt(row):
        return {
            "ticket_id":           str(row["ticket_id"]),
            "ticket_number":       row["ticket_number"],
            "uid":                 str(row["uid"]) if row["uid"] else None,
            "farm_id":             str(row["farm_id"]) if row["farm_id"] else None,
            "farm_name":           row["farm_name"],
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
            "customer_name":       row["customer_name"],
            "customer_code":       row["customer_code"],
        }

    return {
        "total":   total,
        "page":    page,
        "limit":   limit,
        "tickets": [fmt(r) for r in rows],
    }


@router.post("")
async def create_ticket(
    body: TicketCreate,
    credentials: HTTPAuthorizationCredentials = Depends(bearer),
    db:          AsyncSession = Depends(get_db),
):
    user, perms = await get_user_and_perms(credentials.credentials, db)

    checklist = body.sop_checklist
    sop_fields = [
        checklist.panel_board_checked,
        checklist.three_phase_verified,
        checklist.fuse_mcb_checked,
        checklist.video_recorded,
        checklist.photos_taken,
        checklist.person_will_be_present,
    ]
    if not all(sop_fields):
        raise HTTPException(
            status_code=400,
            detail="All SOP checklist items must be completed before raising a ticket."
        )

    if not body.photo_evidence or len(body.photo_evidence) == 0:
        raise HTTPException(
            status_code=400,
            detail="At least one photo or video evidence URL is required."
        )

    cust_result = await db.execute(
        text("SELECT customer_id, cust_type FROM customers WHERE cust_id = :cid"),
        {"cid": str(user.customer_id)}
    )
    customer = cust_result.mappings().first()
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")

    ticket_number = await generate_ticket_number(
        customer["customer_id"], customer["cust_type"], db
    )
    ticket_id = str(uuid.uuid4())
    initial_status = "open"

    ticket_notes = [{
        "timestamp": datetime.utcnow().isoformat(),
        "by":        user.full_name,
        "action":    "Ticket raised",
        "note":      f"Service request created. Mode: {'Field Visit' if body.service_mode == 1 else 'Bring to Office'}. Priority: {body.priority}."
    }]

    import json
    await db.execute(
        text("""
            INSERT INTO service (
                ticket_id, ticket_number, user_id, customer_id, farm_id, uid,
                issue_category, service_mode, priority, status,
                description, sop_checklist, photo_evidence,
                contact_person, contact_number,
                in_warranty_period, location_lat, location_lng,
                ticket_notes, requested_date, created_at, updated_at
            ) VALUES (
                :ticket_id, :ticket_number, :user_id, :customer_id, :farm_id, :uid,
                :issue_category, :service_mode, :priority, :status,
                :description, :sop_checklist, :photo_evidence,
                :contact_person, :contact_number,
                :in_warranty_period, :location_lat, :location_lng,
                :ticket_notes, now(), now(), now()
            )
        """),
        {
            "ticket_id":         ticket_id,
            "ticket_number":     ticket_number,
            "user_id":           str(user.user_id),
            "customer_id":       str(user.customer_id),
            "farm_id":           body.farm_id,
            "uid":               body.uid,
            "issue_category":    body.issue_category,
            "service_mode":      body.service_mode,
            "priority":          body.priority,
            "status":            initial_status,
            "description":       body.description,
            "sop_checklist":     json.dumps(checklist.model_dump()),
            "photo_evidence":    json.dumps(body.photo_evidence),
            "contact_person":    body.contact_person,
            "contact_number":    body.contact_number,
            "in_warranty_period": body.in_warranty_period,
            "location_lat":      body.location_lat,
            "location_lng":      body.location_lng,
            "ticket_notes":      json.dumps(ticket_notes),
        }
    )
    await db.commit()

    return {
        "message":       "Service ticket raised successfully",
        "ticket_id":     ticket_id,
        "ticket_number": ticket_number,
    }


@router.get("/nearby-dealers")
async def get_nearby_dealers(
    lat: float,
    lng: float,
    radius_km: float = 20.0,
    credentials: HTTPAuthorizationCredentials = Depends(bearer),
    db:          AsyncSession = Depends(get_db),
):
    await get_user_and_perms(credentials.credentials, db)

    result = await db.execute(
        text("""
            SELECT
                d.dealer_id, d.dealer_code, d.dealer_type,
                d.company_name, d.region, d.is_active,
                u.full_name, u.phone, u.email,
                i.installation_id,
                (
                    6371 * acos(
                        cos(radians(:lat)) * cos(radians(ss.latitude::float)) *
                        cos(radians(ss.longitude::float) - radians(:lng)) +
                        sin(radians(:lat)) * sin(radians(ss.latitude::float))
                    )
                ) AS distance_km
            FROM dealers d
            JOIN users u ON u.user_id = d.user_id
            LEFT JOIN installations i ON i.user_id = d.user_id
            LEFT JOIN starter_settings ss ON ss.user_id = d.user_id
            WHERE d.is_active = true
            AND ss.latitude IS NOT NULL
            AND ss.longitude IS NOT NULL
            HAVING (
                6371 * acos(
                    cos(radians(:lat)) * cos(radians(ss.latitude::float)) *
                    cos(radians(ss.longitude::float) - radians(:lng)) +
                    sin(radians(:lat)) * sin(radians(ss.latitude::float))
                )
            ) <= :radius_km
            ORDER BY distance_km ASC
            LIMIT 10
        """),
        {"lat": lat, "lng": lng, "radius_km": radius_km}
    )
    rows = result.mappings().all()

    if not rows:
        fallback = await db.execute(
            text("""
                SELECT d.dealer_id, d.dealer_code, d.dealer_type,
                       d.company_name, d.region, d.is_active,
                       u.full_name, u.phone, u.email,
                       NULL as distance_km
                FROM dealers d
                JOIN users u ON u.user_id = d.user_id
                WHERE d.is_active = true
                ORDER BY d.created_at DESC
                LIMIT 10
            """)
        )
        rows = fallback.mappings().all()

    return {
        "dealers": [
            {
                "dealer_id":    str(r["dealer_id"]),
                "dealer_code":  r["dealer_code"],
                "dealer_type":  r["dealer_type"],
                "company_name": r["company_name"],
                "region":       r["region"],
                "full_name":    r["full_name"],
                "phone":        r["phone"],
                "email":        r["email"],
                "distance_km":  round(float(r["distance_km"]), 1) if r["distance_km"] else None,
            }
            for r in rows
        ]
    }


@router.get("/{ticket_id}")
async def get_ticket(
    ticket_id:   str,
    credentials: HTTPAuthorizationCredentials = Depends(bearer),
    db:          AsyncSession = Depends(get_db),
):
    user, perms = await get_user_and_perms(credentials.credentials, db)

    result = await db.execute(
        text("""
            SELECT
                s.*,
                u.full_name as raised_by_name,
                c.cust_name as customer_name, c.customer_id as customer_code,
                f.farm_name,
                d.dealer_code, du.full_name as dealer_name, du.phone as dealer_phone
            FROM service s
            LEFT JOIN users u  ON u.user_id   = s.user_id
            LEFT JOIN customers c ON c.cust_id = s.customer_id
            LEFT JOIN farms f  ON f.farm_id   = s.farm_id
            LEFT JOIN dealers d ON d.dealer_id = s.assigned_dealer_id
            LEFT JOIN users du ON du.user_id   = d.user_id
            WHERE s.ticket_id = :tid
        """),
        {"tid": ticket_id}
    )
    row = result.mappings().first()
    if not row:
        raise HTTPException(status_code=404, detail="Ticket not found")

    if not user.bypass_org_scope and str(row["user_id"]) != str(user.user_id):
        raise HTTPException(status_code=403, detail="Access denied")

    return {
        "ticket_id":           str(row["ticket_id"]),
        "ticket_number":       row["ticket_number"],
        "uid":                 str(row["uid"]) if row["uid"] else None,
        "farm_id":             str(row["farm_id"]) if row["farm_id"] else None,
        "farm_name":           row["farm_name"],
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
        "dealer_code":         row["dealer_code"],
        "dealer_name":         row["dealer_name"],
        "dealer_phone":        row["dealer_phone"],
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
        "customer_name":       row["customer_name"],
        "customer_code":       row["customer_code"],
    }


@router.put("/{ticket_id}")
async def update_ticket(
    ticket_id:   str,
    body:        TicketStatusUpdate,
    credentials: HTTPAuthorizationCredentials = Depends(bearer),
    db:          AsyncSession = Depends(get_db),
):
    user, perms = await get_user_and_perms(credentials.credentials, db)

    if not user.bypass_org_scope:
        if not perms or perms.services_manage != 1:
            raise HTTPException(status_code=403, detail="Permission denied")

    result = await db.execute(
        text("SELECT * FROM service WHERE ticket_id = :tid"),
        {"tid": ticket_id}
    )
    ticket = result.mappings().first()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")

    import json

    existing_notes = ticket["ticket_notes"] or []
    if isinstance(existing_notes, str):
        existing_notes = json.loads(existing_notes)

    new_note = {
        "timestamp": datetime.utcnow().isoformat(),
        "by":        user.full_name,
        "action":    f"Status changed to {body.status}" + (
            f" — Mode set to {'Field Visit' if body.service_mode == 1 else 'Bring to Office'}"
            if body.service_mode else ""
        ),
        "note":      body.note or "",
    }
    existing_notes.append(new_note)

    updates = {
        "status":       body.status,
        "ticket_notes": json.dumps(existing_notes),
        "updated_at":   datetime.utcnow().isoformat(),
    }

    if body.service_mode is not None:
        updates["service_mode"] = body.service_mode
    if body.resolution_notes:
        updates["resolution_notes"] = body.resolution_notes
    if body.assigned_dealer_id:
        updates["assigned_dealer_id"] = body.assigned_dealer_id
    if body.device_received_at:
        updates["device_received_at"] = body.device_received_at
    if body.device_returned_at:
        updates["device_returned_at"]  = body.device_returned_at
        updates["resolved_date"]       = body.device_returned_at
    if body.device_condition_in:
        updates["device_condition_in"] = body.device_condition_in
    if body.device_condition_out:
        updates["device_condition_out"] = body.device_condition_out

    if body.status in ["resolved", "closed"] and not ticket["resolved_date"]:
        updates["resolved_date"] = datetime.utcnow().isoformat()

    set_clause = ", ".join([f"{k} = :{k}" for k in updates.keys()])
    updates["ticket_id"] = ticket_id

    await db.execute(
        text(f"UPDATE service SET {set_clause} WHERE ticket_id = :ticket_id"),
        updates
    )
    await db.commit()

    return {"message": "Ticket updated successfully"}
