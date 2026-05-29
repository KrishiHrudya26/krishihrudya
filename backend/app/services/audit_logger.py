"""
audit_logger.py — shared utility for writing to audit_trail
Import and call `log_audit()` from any router after an action.
"""
import uuid
from datetime import datetime
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text


async def log_audit(
    db:               AsyncSession,
    user_id:          str,
    customer_id:      str,
    action:           str,           # human readable: "Motor ON", "overload_limit updated"
    action_category:  str,           # "command" or "setting_change"
    resource_type:    str,           # "device", "farm", "user", "installation"
    resource_id:      str,           # farm_id, uid, installation_id etc.
    device_uid:       str   = None,
    command_name:     str   = None,  # for commands: "Motor ON", "Motor OFF"
    setting_name:     str   = None,  # for settings: "overload_limit"
    old_value:        str   = None,
    new_value:        str   = None,
    status:           str   = "success",
    failure_reason:   str   = None,
    ip_address:       str   = None,
    user_agent:       str   = None,
):
    try:
        await db.execute(
            text("""
                INSERT INTO audit_trail (
                    audit_id, user_id, customer_id,
                    action, action_category, resource_type, resource_id,
                    device_uid, command_name, setting_name,
                    old_value, new_value,
                    status, failure_reason,
                    ip_address, user_agent,
                    created_at
                ) VALUES (
                    :audit_id, :user_id, :customer_id,
                    :action, :action_category, :resource_type, :resource_id,
                    :device_uid, :command_name, :setting_name,
                    :old_value, :new_value,
                    :status, :failure_reason,
                    :ip_address, :user_agent,
                    now()
                )
            """),
            {
                "audit_id":        str(uuid.uuid4()),
                "user_id":         str(user_id),
                "customer_id":     str(customer_id) if customer_id else None,
                "action":          action,
                "action_category": action_category,
                "resource_type":   resource_type,
                "resource_id":     str(resource_id),
                "device_uid":      str(device_uid) if device_uid else None,
                "command_name":    command_name,
                "setting_name":    setting_name,
                "old_value":       str(old_value) if old_value is not None else None,
                "new_value":       str(new_value) if new_value is not None else None,
                "status":          status,
                "failure_reason":  failure_reason,
                "ip_address":      ip_address,
                "user_agent":      user_agent,
            }
        )
        await db.commit()
    except Exception as e:
        # Never let audit logging break the main request
        print(f"[AUDIT LOG ERROR] {e}")
