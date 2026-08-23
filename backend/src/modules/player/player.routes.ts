import { Router, Request, Response } from 'express';
import { query, queryOne, execute } from '../../services/query';
import { authenticate } from '../../middleware/auth.middleware';
import { requireRole } from '../../middleware/permission.middleware';
import { RowDataPacket } from 'mysql2';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { config } from '../../config';

const router = Router();

// ─── POST /api/v1/player/register ───────────────────────────────
// Device self-registration with registration token
router.post('/player/register', async (req: Request, res: Response) => {
  try {
    const { device_uuid, name, registration_token, os, player_version, resolution_width, resolution_height, orientation } = req.body;

    if (!device_uuid || !registration_token) {
      res.status(400).json({ error: 'device_uuid and registration_token are required' });
      return;
    }

    // Find tenant by registration token
    const tenant = await queryOne<RowDataPacket>(
      'SELECT id, max_devices FROM tenants WHERE registration_token = ? AND status = ?',
      [registration_token, 'ACTIVE']
    );

    if (!tenant) {
      res.status(401).json({ error: 'Invalid registration token' });
      return;
    }

    const tenantId = tenant.id;

    // Check device limit
    const deviceCount = await queryOne<RowDataPacket>(
      'SELECT COUNT(*) AS count FROM devices WHERE tenant_id = ?',
      [tenantId]
    );
    if ((deviceCount?.count ?? 0) >= tenant.max_devices) {
      res.status(403).json({ error: 'Device limit reached for this tenant' });
      return;
    }

    // Check if device already registered
    const existing = await queryOne(
      'SELECT id FROM devices WHERE device_uuid = ?',
      [device_uuid]
    );

    if (existing) {
      // Update existing device
      await execute(
        `UPDATE devices SET
          name = COALESCE(?, name),
          os = COALESCE(?, os),
          player_version = COALESCE(?, player_version),
          resolution_width = COALESCE(?, resolution_width),
          resolution_height = COALESCE(?, resolution_height),
          orientation = COALESCE(?, orientation),
          status = 'ONLINE',
          last_seen_at = NOW()
         WHERE device_uuid = ?`,
        [name, os, player_version, resolution_width, resolution_height, orientation, device_uuid]
      );

      const device = await queryOne(
        'SELECT id, device_uuid, name, token_hash, status FROM devices WHERE device_uuid = ?',
        [device_uuid]
      );

      res.json({ device, message: 'Device updated' });
      return;
    }

    // Generate device token
    const deviceToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(deviceToken).digest('hex');

    const result = await execute(
      `INSERT INTO devices (tenant_id, device_uuid, name, token_hash, os, player_version, resolution_width, resolution_height, orientation, status, last_seen_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'ONLINE', NOW())`,
      [tenantId, device_uuid, name || `Device ${device_uuid.slice(0, 8)}`, tokenHash, os || null, player_version || null, resolution_width || null, resolution_height || null, orientation || 'LANDSCAPE']
    );

    const device = await queryOne(
      'SELECT id, device_uuid, name, token_hash, status FROM devices WHERE id = ?',
      [result.insertId]
    );

    res.status(201).json({
      device,
      device_token: deviceToken, // Send this ONCE — client must store it
      message: 'Device registered. Store device_token securely.'
    });
  } catch (err) {
    console.error('Player register error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── POST /api/v1/player/auth ───────────────────────────────────
// Device authentication with device_token
router.post('/player/auth', async (req: Request, res: Response) => {
  try {
    const { device_uuid, device_token } = req.body;

    if (!device_uuid || !device_token) {
      res.status(400).json({ error: 'device_uuid and device_token are required' });
      return;
    }

    const tokenHash = crypto.createHash('sha256').update(device_token).digest('hex');

    const device = await queryOne<RowDataPacket>(
      'SELECT id, device_uuid, name, tenant_id, status FROM devices WHERE device_uuid = ? AND token_hash = ?',
      [device_uuid, tokenHash]
    );

    if (!device) {
      res.status(401).json({ error: 'Invalid device credentials' });
      return;
    }

    if (device.status === 'DISABLED') {
      res.status(403).json({ error: 'Device is disabled' });
      return;
    }

    // Generate a session JWT for the player
    const sessionToken = jwt.sign(
      { deviceId: device.id, deviceUuid: device.device_uuid, tenantId: device.tenant_id, type: 'device' },
      config.jwt.secret,
      { expiresIn: '24h' }
    );

    res.json({
      session_token: sessionToken,
      device: {
        id: device.id,
        device_uuid: device.device_uuid,
        name: device.name,
      }
    });
  } catch (err) {
    console.error('Player auth error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── POST /api/v1/player/heartbeat ──────────────────────────────
router.post('/player/heartbeat', authenticate, async (req: Request, res: Response) => {
  try {
    const tenantId = req.user!.tenantId;
    const deviceId = (req.user as any).deviceId;
    const { cpu_usage, memory_usage, disk_usage, network_status, player_version, current_playlist_id, current_media_id, screen_width, screen_height } = req.body;

    if (!deviceId) {
      res.status(401).json({ error: 'Device authentication required' });
      return;
    }

    // Update device last_seen
    await execute(
      `UPDATE devices SET
        last_seen_at = NOW(),
        status = 'ONLINE',
        player_version = COALESCE(?, player_version),
        current_manifest_version = COALESCE(current_manifest_version, 0)
       WHERE id = ? AND tenant_id = ?`,
      [player_version, deviceId, tenantId]
    );

    // Record heartbeat
    await execute(
      `INSERT INTO device_heartbeats (tenant_id, device_id, cpu_usage, memory_usage, disk_usage, network_status, player_version, current_playlist_id, current_media_id, screen_width, screen_height)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [tenantId, deviceId, cpu_usage || null, memory_usage || null, disk_usage || null, network_status || 'OK', player_version || null, current_playlist_id || null, current_media_id || null, screen_width || null, screen_height || null]
    );

    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  } catch (err) {
    console.error('Player heartbeat error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── POST /api/v1/player/manifest ───────────────────────────────
// Player polls for current content to display
router.post('/player/manifest', authenticate, async (req: Request, res: Response) => {
  try {
    const tenantId = req.user!.tenantId;
    const deviceId = (req.user as any).deviceId;

    if (!deviceId) {
      res.status(401).json({ error: 'Device authentication required' });
      return;
    }

    const now = new Date();
    const currentDay = now.toLocaleDateString('en-US', { weekday: 'long' }).toUpperCase(); // e.g. "MONDAY"
    const currentTime = now.toTimeString().slice(0, 5); // "HH:MM"

    // Find active schedules that target this device
    const schedules = await query<RowDataPacket[]>(
      `SELECT s.*, sp.playlist_id
       FROM schedules s
       LEFT JOIN schedule_targets st ON st.schedule_id = s.id AND st.tenant_id = s.tenant_id
       LEFT JOIN playlists sp ON s.playlist_id = sp.id
       WHERE s.tenant_id = ?
         AND s.is_active = TRUE
         AND s.start_date <= CURDATE()
         AND (s.end_date IS NULL OR s.end_date >= CURDATE())
         AND (s.start_time IS NULL OR s.start_time <= ?)
         AND (s.end_time IS NULL OR s.end_time >= ?)
         AND (s.days_of_week IS NULL OR FIND_IN_SET(?, s.days_of_week) > 0)
         AND (st.target_id = ? OR st.target_id IN (
           SELECT dg.id FROM device_groups dg
           JOIN devices d ON d.group_id = dg.id
           WHERE d.id = ?
         ))
       ORDER BY s.priority DESC
       LIMIT 1`,
      [tenantId, currentTime, currentTime, currentDay, deviceId, deviceId]
    );

    if (schedules.length === 0) {
      // No active schedule — try default playlist
      const defaultPlaylist = await queryOne<RowDataPacket>(
        `SELECT p.id, p.loop_playback
         FROM playlists p
         WHERE p.tenant_id = ?
         ORDER BY p.created_at ASC LIMIT 1`,
        [tenantId]
      );

      if (!defaultPlaylist) {
        res.json({ manifest_version: Date.now(), items: [], loop: false, message: 'No content available' });
        return;
      }

      const items = await query<RowDataPacket[]>(
        `SELECT pi.*, m.original_name, m.mime_type, m.storage_key, m.duration_seconds AS media_duration
         FROM playlist_items pi
         LEFT JOIN media m ON pi.media_id = m.id
         WHERE pi.playlist_id = ? AND pi.tenant_id = ?
         ORDER BY pi.sort_order ASC`,
        [defaultPlaylist.id, tenantId]
      );

      res.json({
        manifest_version: Date.now(),
        playlist_id: defaultPlaylist.id,
        loop: defaultPlaylist.loop_playback,
        items: items.map(i => ({
          item_id: i.id,
          media_url: `/api/v1/media/file/${i.media_id}`,
          mime_type: i.mime_type,
          duration_seconds: i.duration_seconds || i.media_duration || 10,
          transition: i.transition,
        })),
      });
      return;
    }

    const schedule = schedules[0];
    const playlistId = schedule.playlist_id || schedule.playlist_id;

    if (!playlistId) {
      res.json({ manifest_version: Date.now(), items: [], loop: false });
      return;
    }

    const playlist = await queryOne<RowDataPacket>(
      'SELECT id, loop_playback FROM playlists WHERE id = ? AND tenant_id = ?',
      [playlistId, tenantId]
    );

    const items = await query<RowDataPacket[]>(
      `SELECT pi.*, m.original_name, m.mime_type, m.storage_key, m.duration_seconds AS media_duration
       FROM playlist_items pi
       LEFT JOIN media m ON pi.media_id = m.id
       WHERE pi.playlist_id = ? AND pi.tenant_id = ?
       ORDER BY pi.sort_order ASC`,
      [playlistId, tenantId]
    );

    res.json({
      manifest_version: Date.now(),
      schedule_id: schedule.id,
      playlist_id: playlistId,
      loop: playlist?.loop_playback ?? true,
      items: items.map(i => ({
        item_id: i.id,
        media_url: `/api/v1/media/file/${i.media_id}`,
        mime_type: i.mime_type,
        duration_seconds: i.duration_seconds || i.media_duration || 10,
        transition: i.transition,
      })),
    });
  } catch (err) {
    console.error('Player manifest error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── POST /api/v1/player/playback ───────────────────────────────
// Player reports playback events
router.post('/player/playback', authenticate, async (req: Request, res: Response) => {
  try {
    const tenantId = req.user!.tenantId;
    const deviceId = (req.user as any).deviceId;
    const { playlist_id, media_id, action, started_at, ended_at, duration_ms, error_message } = req.body;

    if (!deviceId) {
      res.status(401).json({ error: 'Device authentication required' });
      return;
    }

    const validActions = ['START', 'END', 'SKIP', 'ERROR'];
    if (!action || !validActions.includes(action)) {
      res.status(400).json({ error: `action must be one of: ${validActions.join(', ')}` });
      return;
    }

    await execute(
      `INSERT INTO playback_logs (tenant_id, device_id, playlist_id, media_id, log_action, started_at, ended_at, duration_ms, error_message)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [tenantId, deviceId, playlist_id || null, media_id || null, action, started_at || null, ended_at || null, duration_ms || null, error_message || null]
    );

    res.json({ status: 'logged' });
  } catch (err) {
    console.error('Player playback log error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── POST /api/v1/player/screenshot ─────────────────────────────
// Player uploads screenshot
router.post('/player/screenshot', authenticate, async (req: Request, res: Response) => {
  try {
    const tenantId = req.user!.tenantId;
    const deviceId = (req.user as any).deviceId;
    const { storage_key, width, height, file_size } = req.body;

    if (!deviceId) {
      res.status(401).json({ error: 'Device authentication required' });
      return;
    }

    await execute(
      `INSERT INTO screenshots (tenant_id, device_id, storage_key, width, height, file_size)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [tenantId, deviceId, storage_key || 'pending', width || null, height || null, file_size || null]
    );

    res.json({ status: 'captured' });
  } catch (err) {
    console.error('Player screenshot error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── POST /api/v1/player/command-result ─────────────────────────
// Player reports command execution result
router.post('/player/command-result', authenticate, async (req: Request, res: Response) => {
  try {
    const tenantId = req.user!.tenantId;
    const deviceId = (req.user as any).deviceId;
    const { command_id, status, result } = req.body;

    if (!deviceId) {
      res.status(401).json({ error: 'Device authentication required' });
      return;
    }

    if (!command_id) {
      res.status(400).json({ error: 'command_id is required' });
      return;
    }

    // Update command status
    await execute(
      `UPDATE device_commands SET
        status = ?,
        result = ?,
        executed_at = NOW()
       WHERE id = ? AND device_id = ? AND tenant_id = ?`,
      [status || 'COMPLETED', result || null, command_id, deviceId, tenantId]
    );

    res.json({ status: 'updated' });
  } catch (err) {
    console.error('Player command result error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── GET /api/v1/player/commands ────────────────────────────────
// Player polls for pending commands
router.get('/player/commands', authenticate, async (req: Request, res: Response) => {
  try {
    const tenantId = req.user!.tenantId;
    const deviceId = (req.user as any).deviceId;

    if (!deviceId) {
      res.status(401).json({ error: 'Device authentication required' });
      return;
    }

    const commands = await query<RowDataPacket[]>(
      `SELECT id, command_type, payload, created_at
       FROM device_commands
       WHERE device_id = ? AND tenant_id = ? AND status = 'PENDING'
       ORDER BY created_at ASC`,
      [deviceId, tenantId]
    );

    // Mark as sent
    if (commands.length > 0) {
      const ids = commands.map(c => c.id);
      await execute(
        `UPDATE device_commands SET status = 'SENT' WHERE id IN (${ids.map(() => '?').join(',')})`,
        ids
      );
    }

    res.json({ commands });
  } catch (err) {
    console.error('Player commands poll error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
