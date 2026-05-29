-- ============================================================
-- Services Table Migration — KrishiHrudya
-- Run on kh_business database
-- ============================================================

ALTER TABLE service
  ADD COLUMN IF NOT EXISTS ticket_number      VARCHAR(20)  UNIQUE,
  ADD COLUMN IF NOT EXISTS issue_category     VARCHAR(50),
  ADD COLUMN IF NOT EXISTS priority           VARCHAR(20)  DEFAULT 'medium',
  ADD COLUMN IF NOT EXISTS service_mode       INTEGER      DEFAULT 1,
  ADD COLUMN IF NOT EXISTS sop_checklist      JSONB        DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS photo_evidence     JSONB        DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS contact_person     VARCHAR(100),
  ADD COLUMN IF NOT EXISTS contact_number     VARCHAR(20),
  ADD COLUMN IF NOT EXISTS resolution_notes   TEXT,
  ADD COLUMN IF NOT EXISTS assigned_dealer_id UUID,
  ADD COLUMN IF NOT EXISTS device_received_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS device_returned_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS device_condition_in  TEXT,
  ADD COLUMN IF NOT EXISTS device_condition_out TEXT,
  ADD COLUMN IF NOT EXISTS ticket_notes       JSONB        DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS location_lat       NUMERIC(10,8),
  ADD COLUMN IF NOT EXISTS location_lng       NUMERIC(11,8),
  ADD COLUMN IF NOT EXISTS customer_id        UUID,
  ADD COLUMN IF NOT EXISTS created_at         TIMESTAMP    DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at         TIMESTAMP    DEFAULT now();

-- Index for fast lookup by customer and status
CREATE INDEX IF NOT EXISTS idx_service_customer  ON service(customer_id);
CREATE INDEX IF NOT EXISTS idx_service_status    ON service(status);
CREATE INDEX IF NOT EXISTS idx_service_ticket_no ON service(ticket_number);
