CREATE TABLE subscriptions (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    tenant_id BIGINT UNSIGNED NOT NULL,
    plan_id BIGINT UNSIGNED NOT NULL,
    status ENUM('ACTIVE', 'PAST_DUE', 'CANCELLED', 'TRIAL') DEFAULT 'TRIAL',
    trial_ends_at DATETIME NULL,
    current_period_start DATE NULL,
    current_period_end DATE NULL,
    cancelled_at DATETIME NULL,
    external_id VARCHAR(255) NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_subscriptions_tenant (tenant_id),
    INDEX idx_subscriptions_status (status)
);
