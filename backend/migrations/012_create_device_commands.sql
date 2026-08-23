CREATE TABLE device_commands (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    tenant_id BIGINT UNSIGNED NOT NULL,
    device_id BIGINT UNSIGNED NOT NULL,
    command_type ENUM('REBOOT', 'SHUTDOWN', 'UPDATE', 'RELOAD', 'SCREENSHOT', 'CUSTOM') NOT NULL,
    payload JSON NULL,
    status ENUM('PENDING', 'SENT', 'ACKNOWLEDGED', 'COMPLETED', 'FAILED') DEFAULT 'PENDING',
    result TEXT NULL,
    issued_by BIGINT UNSIGNED NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    executed_at DATETIME NULL,
    INDEX idx_device_commands_device (device_id),
    INDEX idx_device_commands_tenant (tenant_id),
    INDEX idx_device_commands_status (status)
);
