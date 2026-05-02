import uuid
from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, text
from typing import Optional, List
from pydantic import BaseModel
from datetime import date, datetime
from app.database import get_db, get_sensor_db
from app.models.role import RolePermission
from app.services.auth_service import get_current_user

router = APIRouter(prefix="/assign", tags=["Assign"])
bearer = HTTPBearer()


async def require_perm(perm: str, token: str, db: AsyncSession):
    user = await get_current_user(token, db)
    result = await db.execute(select(RolePermission).where(RolePermission.role_id == user.role_id))
    perms = result.scalar_one_or_none()
    if not perms or getattr(perms, perm, 0) != 1:
        raise HTTPException(status_code=403, detail="Permission denied")
    return user


@router.get("/search-device")
async def search_device(
    q: str,
    credentials: HTTPAuthorizationCredentials = Depends(bearer),
    db: AsyncSession = Depends(get_db),
):
    await require_perm("devices_assign", credentials.credentials, db)

    if len(q) < 3:
        return {"results": []}

    try:
        result = await db.execute(
            text("""
                SELECT
                    p.uid,
                    p.product_name,
                    p.uid,
                    p.serial_number,
                    p.status,
                    i.installation_id,
                    i.farm_id,
                    f.farm_name,
                    c.cust_name,
                    c.customer_id as cust_code
                FROM products p
                LEFT JOIN installations i ON CAST(i.uid AS TEXT) = CAST(p.uid AS TEXT)
                LEFT JOIN farms f ON f.farm_id = i.farm_id
                LEFT JOIN customers c ON c.cust_id = f.customer_id
                WHERE
                    CAST(p.uid AS TEXT) ILIKE :q
                    OR CAST(p.serial_number AS TEXT) ILIKE :q
                    OR p.product_name ILIKE :q
                LIMIT 10
            """),
            {"q": f"%{q}%"}
        )
        rows = result.mappings().all()
        return {
            "results": [
                {
                    "product_uid":           str(r["uid"]),
                    "product_name":         r["product_name"],
                    "uid":                  r["uid"],
                    "serial_number":        r["serial_number"],
                    "status":               r["status"],
                    "is_assigned":          r["installation_id"] is not None,
                    "assigned_farm":        r["farm_name"],
                    "assigned_customer":    r["cust_name"],
                    "assigned_customer_id": r["cust_code"],
                }
                for r in rows
            ]
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Search failed: {str(e)}")


class FarmCreate(BaseModel):
    farm_name:         str
    customer_id:       Optional[str]   = None
    hierarchy_node_id: Optional[str]   = None
    address:           Optional[str]   = None
    latitude:          Optional[float] = None
    longitude:         Optional[float] = None
    assign_to_user_id: Optional[str]   = None


@router.post("/farm")
async def create_farm(
    body: FarmCreate,
    credentials: HTTPAuthorizationCredentials = Depends(bearer),
    db: AsyncSession = Depends(get_db),
):
    user = await require_perm("farms_manage", credentials.credentials, db)
    target_user_id = body.assign_to_user_id or str(user.user_id)
    farm_id = str(uuid.uuid4())

    await db.execute(
        text("""
            INSERT INTO farms (
                farm_id, farm_name, user_id, customer_id,
                hierarchy_node_id, address,
                latitude, longitude, created_at
            ) VALUES (
                :farm_id, :farm_name, :user_id, :customer_id,
                :hierarchy_node_id, :address,
                :latitude, :longitude, now()
            )
        """),
        {
            "farm_id":           farm_id,
            "farm_name":         body.farm_name,
            "user_id":           target_user_id,
            "customer_id":       body.customer_id,
            "hierarchy_node_id": body.hierarchy_node_id,
            "address":           body.address,
            "latitude":          body.latitude,
            "longitude":         body.longitude,
        }
    )
    await db.commit()
    return {"message": "Farm created successfully", "farm_id": farm_id}


class BasicSettings(BaseModel):
    auto_manual:           Optional[bool]  = True
    overload_limit:        Optional[float] = 45.0
    underload_limit:       Optional[float] = 0.0
    on_time_delay:         Optional[int]   = 30
    star_run_delay:        Optional[int]   = 10
    over_voltage_limit:    Optional[float] = 480.0
    under_voltage_limit:   Optional[float] = 250.0
    dry_run_timer:         Optional[int]   = 0
    pump_flow_rate:        Optional[float] = 175.0
    off_timer_mode:        Optional[bool]  = False
    cyclic_timer_mode:     Optional[bool]  = False
    spb_mode:              Optional[bool]  = False
    notification_status:   Optional[bool]  = False
    notification_interval: Optional[int]   = 15


class AdvancedSettings(BaseModel):
    calibration_factor1:           Optional[float] = 7.20
    calibration_factor2:           Optional[float] = 7.20
    calibration_factor3:           Optional[float] = 7.20
    oem_value:                     Optional[float] = 0.0
    water_sensor_type:             Optional[str]   = None
    time_to_surface_capture:       Optional[int]   = 1
    flow_meter_litres_per_pulse:   Optional[float] = 0.076
    flow_meter_enable_disable:     Optional[bool]  = False
    flow_meter_calibration_factor: Optional[float] = 0.32517
    api_token:                     Optional[str]   = None
    chat_id:                       Optional[str]   = None
    telegram_url:                  Optional[str]   = None
    borewell_depth:                Optional[float] = None
    motor_hp:                      Optional[int]   = None
    latitude:                      Optional[float] = None
    longitude:                     Optional[float] = None


class DeviceDetails(BaseModel):
    device_name:          Optional[str]  = None
    pump_address:         Optional[str]  = None
    reference_number:     Optional[str]  = None
    serial_number:        Optional[str]  = "0"
    flow_meter_installed: Optional[bool] = False
    identifier_code:      Optional[str]  = None


class DeviceAssign(BaseModel):
    uid:               str
    product_uid:       str
    farm_id:           str
    subscription_type: str = "1_year"
    subscription_start_date: Optional[str] = None
    installed_by:      Optional[str]   = None
    total_amount:      Optional[float] = None
    paid:              Optional[float] = None
    mode_of_payment:   Optional[str]   = None
    access_user_ids:   Optional[List[str]] = []
    device_details:    Optional[DeviceDetails] = None
    basic_settings:    Optional[BasicSettings] = None
    advanced_settings: Optional[AdvancedSettings] = None


@router.post("/device")
async def assign_device(
    body: DeviceAssign,
    credentials: HTTPAuthorizationCredentials = Depends(bearer),
    db: AsyncSession = Depends(get_db),
    sensor_db: AsyncSession = Depends(get_sensor_db),
):
    user = await require_perm("devices_assign", credentials.credentials, db)

    # Block re-assignment
    existing = await db.execute(
        text("SELECT installation_id FROM installations WHERE CAST(uid AS TEXT) = :uid LIMIT 1"),
        {"uid": body.uid}
    )
    if existing.mappings().first():
        raise HTTPException(
            status_code=409,
            detail=f"Device UID {body.uid} is already assigned. Unassign it first before reassigning."
        )

    farm_result = await db.execute(
        text("SELECT * FROM farms WHERE farm_id = :fid"),
        {"fid": body.farm_id}
    )
    farm = farm_result.mappings().first()
    if not farm:
        raise HTTPException(status_code=404, detail="Farm not found")

    farm_user_id = str(farm["user_id"])
    sub_start    = body.subscription_start_date or date.today().isoformat()
    sub_end      = None

    if body.subscription_type == "1_year":
        d = date.fromisoformat(sub_start)
        sub_end = str(d.replace(year=d.year + 1))

    balance = None
    if body.total_amount is not None and body.paid is not None:
        balance = body.total_amount - body.paid

    dd  = body.device_details   or DeviceDetails()
    bs  = body.basic_settings   or BasicSettings()
    adv = body.advanced_settings or AdvancedSettings()

    installation_id = str(uuid.uuid4())
    await db.execute(
        text("""
            INSERT INTO installations (
                installation_id, product_uid, user_id, farm_id, uid,
                installed_by, installation_date,
                subscription_type, subscription_start_date, subscription_end_date,
                total_amount, paid, balance, mode_of_payment,
                pump_address, rr_number, pump_name, serial_number,
                flow_meter_installed, created_at
            ) VALUES (
                :installation_id, :product_uid, :user_id, :farm_id, :uid,
                :installed_by, now(),
                :subscription_type, :subscription_start_date, :subscription_end_date,
                :total_amount, :paid, :balance, :mode_of_payment,
                :pump_address, :reference_number, :device_name, :serial_number,
                :flow_meter_installed, now()
            )
        """),
        {
            "installation_id":         installation_id,
            "product_uid":             body.uid,
            "user_id":                 farm_user_id,
            "farm_id":                 body.farm_id,
            "uid":                     body.uid,
            "installed_by":            body.installed_by or user.full_name,
            "subscription_type":       body.subscription_type,
            "subscription_start_date": sub_start,
            "subscription_end_date":   sub_end,
            "total_amount":            body.total_amount,
            "paid":                    body.paid,
            "balance":                 balance,
            "mode_of_payment":         body.mode_of_payment,
            "pump_address":            dd.pump_address,
            "reference_number":        dd.reference_number,
            "device_name":             dd.device_name,
            "serial_number":           dd.serial_number or "0",
            "flow_meter_installed":    dd.flow_meter_installed or False,
        }
    )

    bore_id = str(uuid.uuid4())
    await db.execute(
        text("""
            INSERT INTO borewell (
                bore_id, farm_id, user_id, uid,
                borewell_name, motor_hp, borewell_depth,
                location, created_at, updated_at
            ) VALUES (
                :bore_id, :farm_id, :user_id, :uid,
                :borewell_name, :motor_hp, :borewell_depth,
                :location, now(), now()
            )
        """),
        {
            "bore_id":       bore_id,
            "farm_id":       body.farm_id,
            "user_id":       farm_user_id,
            "uid":           body.uid,
            "borewell_name": dd.device_name or dd.pump_address or body.uid,
            "motor_hp":      adv.motor_hp,
            "borewell_depth":adv.borewell_depth,
            "location":      dd.pump_address,
        }
    )
    await db.commit()

    await sensor_db.execute(
        text("""
            INSERT INTO starter_settings (
                ss_id, user_id, farm_id, uid,
                auto_manual, overload_limit, underload_limit,
                on_time_delay, star_run_delay,
                over_voltage_limit, under_voltage_limit,
                dry_run_timer, pump_flow_rate,
                off_timer_mode, cyclic_timer_mode, spb_mode,
                notification_status, notification_interval,
                calibration_factor1, calibration_factor2, calibration_factor3,
                oem_value, water_sensor_type, time_to_surface_capture,
                flow_meter_litres_per_pulse, flow_meter_enable_disable,
                flow_meter_calibration_factor,
                api_token, chat_id, telegram_url,
                borewell_depth, motor_hp, latitude, longitude,
                status, created_at, updated_at
            ) VALUES (
                :ss_id, :user_id, :farm_id, :uid,
                :auto_manual, :overload_limit, :underload_limit,
                :on_time_delay, :star_run_delay,
                :over_voltage_limit, :under_voltage_limit,
                :dry_run_timer, :pump_flow_rate,
                :off_timer_mode, :cyclic_timer_mode, :spb_mode,
                :notification_status, :notification_interval,
                :calibration_factor1, :calibration_factor2, :calibration_factor3,
                :oem_value, :water_sensor_type, :time_to_surface_capture,
                :flow_meter_litres_per_pulse, :flow_meter_enable_disable,
                :flow_meter_calibration_factor,
                :api_token, :chat_id, :telegram_url,
                :borewell_depth, :motor_hp, :latitude, :longitude,
                'active', now(), now()
            )
            ON CONFLICT (uid) DO UPDATE SET
                auto_manual           = EXCLUDED.auto_manual,
                overload_limit        = EXCLUDED.overload_limit,
                underload_limit       = EXCLUDED.underload_limit,
                on_time_delay         = EXCLUDED.on_time_delay,
                star_run_delay        = EXCLUDED.star_run_delay,
                over_voltage_limit    = EXCLUDED.over_voltage_limit,
                under_voltage_limit   = EXCLUDED.under_voltage_limit,
                dry_run_timer         = EXCLUDED.dry_run_timer,
                pump_flow_rate        = EXCLUDED.pump_flow_rate,
                off_timer_mode        = EXCLUDED.off_timer_mode,
                cyclic_timer_mode     = EXCLUDED.cyclic_timer_mode,
                spb_mode              = EXCLUDED.spb_mode,
                notification_status   = EXCLUDED.notification_status,
                notification_interval = EXCLUDED.notification_interval,
                updated_at            = now()
        """),
        {
            "ss_id":                       str(uuid.uuid4()),
            "user_id":                     farm_user_id,
            "farm_id":                     body.farm_id,
            "uid":                         body.uid,
            "auto_manual":                 bs.auto_manual,
            "overload_limit":              bs.overload_limit,
            "underload_limit":             bs.underload_limit,
            "on_time_delay":               bs.on_time_delay,
            "star_run_delay":              bs.star_run_delay,
            "over_voltage_limit":          bs.over_voltage_limit,
            "under_voltage_limit":         bs.under_voltage_limit,
            "dry_run_timer":               bs.dry_run_timer,
            "pump_flow_rate":              bs.pump_flow_rate,
            "off_timer_mode":              bs.off_timer_mode,
            "cyclic_timer_mode":           bs.cyclic_timer_mode,
            "spb_mode":                    bs.spb_mode,
            "notification_status":         bs.notification_status,
            "notification_interval":       bs.notification_interval,
            "calibration_factor1":         adv.calibration_factor1,
            "calibration_factor2":         adv.calibration_factor2,
            "calibration_factor3":         adv.calibration_factor3,
            "oem_value":                   adv.oem_value,
            "water_sensor_type":           adv.water_sensor_type,
            "time_to_surface_capture":     adv.time_to_surface_capture,
            "flow_meter_litres_per_pulse": adv.flow_meter_litres_per_pulse,
            "flow_meter_enable_disable":   adv.flow_meter_enable_disable,
            "flow_meter_calibration_factor": adv.flow_meter_calibration_factor,
            "api_token":                   adv.api_token,
            "chat_id":                     adv.chat_id,
            "telegram_url":                adv.telegram_url,
            "borewell_depth":              adv.borewell_depth,
            "motor_hp":                    adv.motor_hp,
            "latitude":                    adv.latitude,
            "longitude":                   adv.longitude,
        }
    )
    await sensor_db.commit()

    return {
        "message":         "Device assigned successfully",
        "installation_id": installation_id,
        "bore_id":         bore_id,
    }


class BasicSettingsUpdate(BaseModel):
    auto_manual:           Optional[bool]  = None
    overload_limit:        Optional[float] = None
    underload_limit:       Optional[float] = None
    on_time_delay:         Optional[int]   = None
    star_run_delay:        Optional[int]   = None
    over_voltage_limit:    Optional[float] = None
    under_voltage_limit:   Optional[float] = None
    dry_run_timer:         Optional[int]   = None
    pump_flow_rate:        Optional[float] = None
    off_timer_mode:        Optional[bool]  = None
    cyclic_timer_mode:     Optional[bool]  = None
    spb_mode:              Optional[bool]  = None
    notification_status:   Optional[bool]  = None
    notification_interval: Optional[int]   = None


@router.put("/device/{uid}/settings/basic")
async def update_basic_settings(
    uid: str,
    body: BasicSettingsUpdate,
    credentials: HTTPAuthorizationCredentials = Depends(bearer),
    db: AsyncSession = Depends(get_db),
    sensor_db: AsyncSession = Depends(get_sensor_db),
):
    await require_perm("settings_basic", credentials.credentials, db)

    updates = {k: v for k, v in body.model_dump().items() if v is not None}
    if not updates:
        return {"message": "No changes to apply"}

    set_clause = ", ".join([f"{k} = :{k}" for k in updates.keys()])
    updates["uid"]        = uid
    updates["updated_at"] = datetime.utcnow()

    await sensor_db.execute(
        text(f"UPDATE starter_settings SET {set_clause}, updated_at = :updated_at WHERE uid = :uid"),
        updates
    )
    await sensor_db.commit()
    return {"message": "Settings updated successfully"}


@router.get("/users-list")
async def get_users_for_assignment(
    customer_id: Optional[str] = None,
    credentials: HTTPAuthorizationCredentials = Depends(bearer),
    db: AsyncSession = Depends(get_db),
):
    current_user = await require_perm("devices_assign", credentials.credentials, db)

    if current_user.bypass_org_scope or not current_user.hierarchy_node_id:
        query = """
            SELECT u.user_id, u.full_name, u.email, u.phone,
                   hl.level_order
            FROM users u
            LEFT JOIN hierarchy_nodes hn ON hn.node_id = u.hierarchy_node_id
            LEFT JOIN hierarchy_levels hl ON hl.level_id = hn.level_id
            WHERE u.status = 'active'
            AND (hl.level_order > 1 OR hl.level_order IS NULL)
        """
        params = {}
        if customer_id:
            query += " AND u.customer_id = :customer_id"
            params["customer_id"] = customer_id
        query += " ORDER BY hl.level_order, u.full_name LIMIT 200"
        result = await db.execute(text(query), params)

    else:
        node_level_result = await db.execute(
            text("""
                SELECT hl.level_order
                FROM hierarchy_nodes hn
                JOIN hierarchy_levels hl ON hl.level_id = hn.level_id
                WHERE hn.node_id = :node_id
            """),
            {"node_id": str(current_user.hierarchy_node_id)}
        )
        node_level = node_level_result.mappings().first()
        current_level_order = node_level["level_order"] if node_level else 1

        node_result = await db.execute(
            text("""
                WITH RECURSIVE branch AS (
                    SELECT node_id FROM hierarchy_nodes
                    WHERE node_id = :node_id
                    UNION ALL
                    SELECT hn.node_id FROM hierarchy_nodes hn
                    INNER JOIN branch b ON hn.parent_id = b.node_id
                )
                SELECT node_id FROM branch
            """),
            {"node_id": str(current_user.hierarchy_node_id)}
        )
        node_ids = [str(r["node_id"]) for r in node_result.mappings().all()]

        if not node_ids:
            return {"users": []}

        node_ids_str = ",".join([f"'{n}'" for n in node_ids])

        query = f"""
            SELECT u.user_id, u.full_name, u.email, u.phone,
                   hl.level_order
            FROM users u
            LEFT JOIN hierarchy_nodes hn ON hn.node_id = u.hierarchy_node_id
            LEFT JOIN hierarchy_levels hl ON hl.level_id = hn.level_id
            WHERE u.status = 'active'
            AND u.hierarchy_node_id IN ({node_ids_str})
            AND hl.level_order > :current_level
        """
        params = {"current_level": current_level_order}
        if customer_id:
            query += " AND u.customer_id = :customer_id"
            params["customer_id"] = customer_id
        query += " ORDER BY hl.level_order, u.full_name LIMIT 200"
        result = await db.execute(text(query), params)

    rows = result.mappings().all()
    return {
        "users": [
            {
                "user_id":   str(r["user_id"]),
                "full_name": r["full_name"],
                "email":     r["email"],
                "phone":     r["phone"],
            }
            for r in rows
        ]
    }
