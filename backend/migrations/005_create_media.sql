CREATE TABLE media (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    tenant_id BIGINT UNSIGNED NOT NULL,
    filename VARCHAR(255) NOT NULL,
    original_name VARCHAR(255) NOT NULL,
    mime_type VARCHAR(100) NOT NULL,
    file_size BIGINT UNSIGNED NOT NULL,
    storage_key VARCHAR(500) NOT NULL,
    duration_seconds DECIMAL(10, 2) NULL,
    width INT NULL,
    height INT NULL,
    thumbnail_key VARCHAR(500) NULL,
    status ENUM('UPLOADING', 'PROCESSING', 'READY', 'FAILED') DEFAULT 'UPLOADING',
    uploaded_by BIGINT UNSIGNED NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_media_tenant (tenant_id),
    INDEX idx_media_status (status)
);
