CREATE TABLE subscription_plans (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    slug VARCHAR(100) NOT NULL,
    description TEXT NULL,
    price_cents BIGINT UNSIGNED NOT NULL DEFAULT 0,
    currency VARCHAR(3) DEFAULT 'USD',
    billing_interval ENUM('monthly', 'yearly') DEFAULT 'monthly',
    max_devices INT UNSIGNED DEFAULT 5,
    max_storage_mb INT UNSIGNED DEFAULT 1024,
    max_users INT UNSIGNED DEFAULT 5,
    features JSON NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_plans_slug (slug)
);
