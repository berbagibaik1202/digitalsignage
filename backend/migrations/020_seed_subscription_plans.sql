-- Default subscription plans
INSERT IGNORE INTO subscription_plans (name, slug, description, price_cents, currency, billing_interval, max_devices, max_storage_mb, max_users, features) VALUES
('Free', 'free', 'Perfect for getting started with digital signage', 0, 'USD', 'monthly', 3, 512, 2, '{"basic_playback": true, "email_support": true}'),
('Pro', 'pro', 'For growing businesses with multiple displays', 2999, 'USD', 'monthly', 20, 10240, 10, '{"basic_playback": true, "advanced_scheduling": true, "email_support": true, "priority_support": true}'),
('Enterprise', 'enterprise', 'Unlimited power for large-scale deployments', 9999, 'USD', 'monthly', 100, 102400, 50, '{"basic_playback": true, "advanced_scheduling": true, "api_access": true, "priority_support": true, "custom_branding": true, "dedicated_support": true}');
