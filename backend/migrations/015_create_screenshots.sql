CREATE TABLE screenshots (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    tenant_id BIGINT UNSIGNED NOT NULL,
    device_id BIGINT UNSIGNED NOT NULL,
    storage_key VARCHAR(500) NOT NULL,
    width INT NULL,
    height INT NULL,
    file_size BIGINT UNSIGNED NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_screenshots_device (device_id),
    INDEX idx_screenshots_tenant (tenant_id),
    INDEX idx_screenshots_created (created_at)
);
