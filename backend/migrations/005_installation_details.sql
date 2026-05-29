-- ============================================================
-- Installation Details Migration — KrishiHrudya
-- Run on kh_business database
-- ============================================================

-- 1. Create installation_details table
CREATE TABLE IF NOT EXISTS installation_details (
    detail_id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    installation_id     UUID REFERENCES installations(installation_id) ON DELETE SET NULL,
    uid                 VARCHAR(50),
    farm_id             UUID,
    rr_number           VARCHAR(100),
    borewell_depth      NUMERIC(8,2),
    motor_hp            INTEGER,
    address             TEXT,
    waterman_name       VARCHAR(100),
    waterman_phone      VARCHAR(20),
    flow_meter_present  BOOLEAN DEFAULT false,

    -- Photo: IMEI on device
    photo_imei          VARCHAR(500),
    photo_imei_lat      NUMERIC(10,8),
    photo_imei_lng      NUMERIC(11,8),
    photo_imei_at       TIMESTAMP,

    -- Photo: Running amps
    photo_running_amps      VARCHAR(500),
    photo_running_amps_lat  NUMERIC(10,8),
    photo_running_amps_lng  NUMERIC(11,8),
    photo_running_amps_at   TIMESTAMP,

    -- Photo: Device installation
    photo_installation      VARCHAR(500),
    photo_installation_lat  NUMERIC(10,8),
    photo_installation_lng  NUMERIC(11,8),
    photo_installation_at   TIMESTAMP,

    -- Photo: Flowmeter
    photo_flowmeter         VARCHAR(500),
    photo_flowmeter_lat     NUMERIC(10,8),
    photo_flowmeter_lng     NUMERIC(11,8),
    photo_flowmeter_at      TIMESTAMP,

    submitted_by        UUID,
    status              VARCHAR(20) DEFAULT 'draft',
    created_at          TIMESTAMP DEFAULT now(),
    updated_at          TIMESTAMP DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_instdetail_uid    ON installation_details(uid);
CREATE INDEX IF NOT EXISTS idx_instdetail_status ON installation_details(status);
CREATE INDEX IF NOT EXISTS idx_instdetail_by     ON installation_details(submitted_by);

-- 2. Add uploads directory path column if not exists
-- (files stored at /var/www/krishihrudya/uploads/installations/)

-- 3. Add new permission column
ALTER TABLE role_permissions
    ADD COLUMN IF NOT EXISTS installations_view SMALLINT DEFAULT 0;

-- 4. Create uploads directory (run manually on VPS):
-- mkdir -p /var/www/krishihrudya/uploads/installations
-- chmod 755 /var/www/krishihrudya/uploads/installations
-- chown www-data:www-data /var/www/krishihrudya/uploads/installations
