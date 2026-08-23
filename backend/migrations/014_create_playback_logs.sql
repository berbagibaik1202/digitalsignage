CREATE TABLE playback_logs (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    tenant_id BIGINT UNSIGNED NOT NULL,
    device_id BIGINT UNSIGNED NOT NULL,
    playlist_id BIGINT UNSIGNED NULL,
    media_id BIGINT UNSIGNED NULL,
    log_action ENUM('START', 'END', 'SKIP', 'ERROR') NOT NULL,
    started_at DATETIME NULL,
    ended_at DATETIME NULL,
    duration_ms INT UNSIGNED NULL,
    error_message TEXT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_playback_logs_device (device_id),
    INDEX idx_playback_logs_tenant (tenant_id),
    INDEX idx_playback_logs_created (created_at)
);
