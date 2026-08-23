CREATE TABLE schedule_targets (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    tenant_id BIGINT UNSIGNED NOT NULL,
    schedule_id BIGINT UNSIGNED NOT NULL,
    target_type ENUM('DEVICE', 'GROUP') NOT NULL,
    target_id BIGINT UNSIGNED NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_schedule_targets_schedule (schedule_id),
    INDEX idx_schedule_targets_tenant (tenant_id)
);
