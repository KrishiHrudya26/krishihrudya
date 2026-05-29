-- Add latitude/longitude to installation_details
ALTER TABLE installation_details
  ADD COLUMN IF NOT EXISTS latitude  NUMERIC(10,8),
  ADD COLUMN IF NOT EXISTS longitude NUMERIC(11,8);
