CREATE TABLE playlist_items (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    tenant_id BIGINT UNSIGNED NOT NULL,
    playlist_id BIGINT UNSIGNED NOT NULL,
    media_id BIGINT UNSIGNED NOT NULL,
    sort_order INT UNSIGNED NOT NULL DEFAULT 0,
    duration_seconds DECIMAL(10, 2) NULL,
    transition VARCHAR(50) DEFAULT 'none',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_playlist_items_playlist (playlist_id),
    INDEX idx_playlist_items_tenant (tenant_id)
);
