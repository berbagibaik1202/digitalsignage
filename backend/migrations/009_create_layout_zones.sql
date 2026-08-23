CREATE TABLE layout_zones (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    tenant_id BIGINT UNSIGNED NOT NULL,
    layout_id BIGINT UNSIGNED NOT NULL,
    name VARCHAR(100) NOT NULL,
    zone_type ENUM('MEDIA', 'CLOCK', 'WEATHER', 'TEXT', 'RSS', 'WEB') DEFAULT 'MEDIA',
    x INT NOT NULL DEFAULT 0,
    y INT NOT NULL DEFAULT 0,
    width INT NOT NULL DEFAULT 1920,
    height INT NOT NULL DEFAULT 1080,
    z_index INT DEFAULT 0,
    config JSON NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_layout_zones_layout (layout_id),
    INDEX idx_layout_zones_tenant (tenant_id)
);
