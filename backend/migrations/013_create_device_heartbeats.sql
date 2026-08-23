CREATE TABLE device_heartbeats (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    tenant_id BIGINT UNSIGNED NOT NULL,
    device_id BIGINT UNSIGNED NOT NULL,
    cpu_usage DECIMAL(5, 2) NULL,
    memory_usage DECIMAL(5, 2) NULL,
    disk_usage DECIMAL(5, 2) NULL,
    network_latency_ms INT UNSIGNED NULL,
    player_version VARCHAR(50) NULL,
    current_manifest_version BIGINT NULL,
    extra JSON NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_heartbeats_device (device_id),
    INDEX idx_heartbeats_tenant (tenant_id),
    INDEX idx_heartbeats_created (created_at)
);
