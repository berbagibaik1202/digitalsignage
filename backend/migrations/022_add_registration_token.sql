-- Add registration_token column to tenants for device registration

ALTER TABLE tenants ADD COLUMN registration_token VARCHAR(64) NULL AFTER max_storage_mb;

-- Generate registration tokens for existing tenants
UPDATE tenants SET registration_token = CONCAT(
  SUBSTRING(MD5(RAND()), 1, 8), '-',
  SUBSTRING(MD5(RAND()), 1, 4), '-',
  SUBSTRING(MD5(RAND()), 1, 4), '-',
  SUBSTRING(MD5(RAND()), 1, 4), '-',
  SUBSTRING(MD5(RAND()), 1, 12)
) WHERE registration_token IS NULL;

-- Add unique index
ALTER TABLE tenants ADD UNIQUE KEY uq_tenants_registration_token (registration_token);
