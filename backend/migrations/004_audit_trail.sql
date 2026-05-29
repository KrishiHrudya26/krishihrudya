-- ============================================================
-- Audit Trail Migration — KrishiHrudya
-- Run on kh_business database
-- ============================================================

-- Add new required columns
ALTER TABLE audit_trail
  ADD COLUMN IF NOT EXISTS device_uid       VARCHAR(50),
  ADD COLUMN IF NOT EXISTS action_category  VARCHAR(20),   -- 'command' or 'setting_change'
  ADD COLUMN IF NOT EXISTS command_name     VARCHAR(100),  -- e.g. 'Motor ON', 'Valve Open'
  ADD COLUMN IF NOT EXISTS setting_name     VARCHAR(100);  -- e.g. 'overload_limit'

-- Indexes for fast filtering
CREATE INDEX IF NOT EXISTS idx_audit_user       ON audit_trail(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_device     ON audit_trail(device_uid);
CREATE INDEX IF NOT EXISTS idx_audit_created    ON audit_trail(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_category   ON audit_trail(action_category);
CREATE INDEX IF NOT EXISTS idx_audit_customer   ON audit_trail(customer_id);
