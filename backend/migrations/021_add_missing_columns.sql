-- Add missing columns for MinIO integration and player API

-- Media: cache presigned URL to avoid regenerating on every list
ALTER TABLE media ADD COLUMN file_url_cache TEXT NULL AFTER storage_key;

-- Device heartbeats: additional fields from player API
ALTER TABLE device_heartbeats ADD COLUMN network_status VARCHAR(20) DEFAULT 'OK' AFTER disk_usage;
ALTER TABLE device_heartbeats ADD COLUMN current_playlist_id BIGINT UNSIGNED NULL AFTER player_version;
ALTER TABLE device_heartbeats ADD COLUMN current_media_id BIGINT UNSIGNED NULL AFTER current_playlist_id;
ALTER TABLE device_heartbeats ADD COLUMN screen_width INT UNSIGNED NULL AFTER current_media_id;
ALTER TABLE device_heartbeats ADD COLUMN screen_height INT UNSIGNED NULL AFTER screen_width;
