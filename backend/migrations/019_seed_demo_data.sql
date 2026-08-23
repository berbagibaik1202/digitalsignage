-- Seed data: Demo tenant + super admin user
-- Password: password123

INSERT INTO tenants (name, slug, contact_email, max_devices, max_storage_mb)
VALUES ('Demo Tenant', 'demo', 'admin@demo.com', 100, 10240);

INSERT INTO users (tenant_id, email, password_hash, full_name, role)
VALUES (1, 'admin@demo.com', '$2b$12$r1xMZXvwylQLJB.ktUOWp.PHDP.ohBZSuIQG0OQjUv22hC3vi84EC', 'Admin', 'super_admin');
