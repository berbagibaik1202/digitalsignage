import { Router, Request, Response } from 'express';
import { query, queryOne, execute, paginatedQuery } from '../../services/query';
import { authenticate } from '../../middleware/auth.middleware';
import { requireRole } from '../../middleware/permission.middleware';
import { RowDataPacket } from 'mysql2';

const router = Router();

interface PlaybackLogRow extends RowDataPacket {
  id: number;
  tenant_id: number;
  device_id: number;
  playlist_id: number | null;
  media_id: number | null;
  log_action: string;
  started_at: string | null;
  ended_at: string | null;
  duration_ms: number | null;
  error_message: string | null;
  created_at: Date;
  device_name?: string;
  media_name?: string;
  playlist_name?: string;
}

interface ScreenshotRow extends RowDataPacket {
  id: number;
  tenant_id: number;
  device_id: number;
  storage_key: string;
  width: number | null;
  height: number | null;
  file_size: number | null;
  created_at: Date;
  device_name?: string;
}

interface DeviceStatsRow extends RowDataPacket {
  total: number;
  online: number;
  degraded: number;
  offline: number;
  avg_heartbeat_age_minutes: number | null;
}

// ─── GET /api/v1/monitoring/playback-logs ───────────────────────
router.get('/monitoring/playback-logs', authenticate, requireRole('super_admin', 'admin', 'editor', 'viewer'), async (req: Request, res: Response) => {
  try {
    const page = Number(req.query.page) || 1;
    const limit = Math.min(Number(req.query.limit) || 50, 200);
    const tenantId = req.user!.tenantId;
    const deviceId = req.query.device_id as string;
    const action = req.query.action as string;
    const startDate = req.query.start_date as string;
    const endDate = req.query.end_date as string;

    let whereClause = 'WHERE pl.tenant_id = ?';
    const params: unknown[] = [tenantId];

    if (deviceId) {
      whereClause += ' AND pl.device_id = ?';
      params.push(deviceId);
    }
    if (action) {
      whereClause += ' AND pl.log_action = ?';
      params.push(action);
    }
    if (startDate) {
      whereClause += ' AND pl.created_at >= ?';
      params.push(startDate);
    }
    if (endDate) {
      whereClause += ' AND pl.created_at <= ?';
      params.push(endDate);
    }

    const result = await paginatedQuery<PlaybackLogRow>(
      `SELECT pl.*, d.name AS device_name, m.original_name AS media_name, p.name AS playlist_name
       FROM playback_logs pl
       LEFT JOIN devices d ON pl.device_id = d.id
       LEFT JOIN media m ON pl.media_id = m.id
       LEFT JOIN playlists p ON pl.playlist_id = p.id
       ${whereClause}
       ORDER BY pl.created_at DESC`,
      `SELECT COUNT(*) AS total FROM playback_logs pl ${whereClause}`,
      params,
      page,
      limit
    );

    res.json(result);
  } catch (err) {
    console.error('List playback logs error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── GET /api/v1/monitoring/screenshots ─────────────────────────
router.get('/monitoring/screenshots', authenticate, requireRole('super_admin', 'admin', 'editor', 'viewer'), async (req: Request, res: Response) => {
  try {
    const page = Number(req.query.page) || 1;
    const limit = Math.min(Number(req.query.limit) || 20, 100);
    const tenantId = req.user!.tenantId;
    const deviceId = req.query.device_id as string;

    let whereClause = 'WHERE sc.tenant_id = ?';
    const params: unknown[] = [tenantId];

    if (deviceId) {
      whereClause += ' AND sc.device_id = ?';
      params.push(deviceId);
    }

    const result = await paginatedQuery<ScreenshotRow>(
      `SELECT sc.*, d.name AS device_name
       FROM screenshots sc
       LEFT JOIN devices d ON sc.device_id = d.id
       ${whereClause}
       ORDER BY sc.created_at DESC`,
      `SELECT COUNT(*) AS total FROM screenshots sc ${whereClause}`,
      params,
      page,
      limit
    );

    res.json(result);
  } catch (err) {
    console.error('List screenshots error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── GET /api/v1/monitoring/device-stats ────────────────────────
router.get('/monitoring/device-stats', authenticate, requireRole('super_admin', 'admin', 'editor', 'viewer'), async (req: Request, res: Response) => {
  try {
    const tenantId = req.user!.tenantId;

    const stats = await queryOne<DeviceStatsRow>(
      `SELECT
        COUNT(*) AS total,
        COUNT(CASE WHEN status = 'ONLINE' THEN 1 END) AS online,
        COUNT(CASE WHEN status = 'DEGRADED' THEN 1 END) AS degraded,
        COUNT(CASE WHEN status = 'OFFLINE' THEN 1 END) AS offline,
        (SELECT ROUND(AVG(TIMESTAMPDIFF(MINUTE, last_seen_at, NOW())), 1)
         FROM devices WHERE tenant_id = ? AND last_seen_at IS NOT NULL) AS avg_heartbeat_age_minutes
       FROM devices WHERE tenant_id = ?`,
      [tenantId, tenantId]
    );

    res.json({ stats });
  } catch (err) {
    console.error('Device stats error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── GET /api/v1/monitoring/dashboard-stats ─────────────────────
router.get('/monitoring/dashboard-stats', authenticate, async (req: Request, res: Response) => {
  try {
    const tenantId = req.user!.tenantId;

    const deviceStats = await queryOne<RowDataPacket>(
      `SELECT
        COUNT(*) AS total,
        COUNT(CASE WHEN status = 'ONLINE' THEN 1 END) AS online
       FROM devices WHERE tenant_id = ?`,
      [tenantId]
    );

    const mediaStats = await queryOne<RowDataPacket>(
      'SELECT COUNT(*) AS total, COALESCE(SUM(file_size), 0) AS total_size FROM media WHERE tenant_id = ?',
      [tenantId]
    );

    const playlistStats = await queryOne<RowDataPacket>(
      'SELECT COUNT(*) AS total FROM playlists WHERE tenant_id = ?',
      [tenantId]
    );

    const scheduleStats = await queryOne<RowDataPacket>(
      'SELECT COUNT(*) AS total FROM schedules WHERE tenant_id = ? AND is_active = TRUE',
      [tenantId]
    );

    const userStats = await queryOne<RowDataPacket>(
      'SELECT COUNT(*) AS total FROM users WHERE tenant_id = ? AND is_active = TRUE',
      [tenantId]
    );

    res.json({
      // safe — queryOne returns null only when no rows, but these are aggregations
      devices: { total: deviceStats?.total ?? 0, online: deviceStats?.online ?? 0 },
      media: { total: mediaStats?.total ?? 0, total_size: mediaStats?.total_size ?? 0 },
      playlists: { total: playlistStats?.total ?? 0 },
      schedules: { total: scheduleStats?.total ?? 0 },
      users: { total: userStats?.total ?? 0 },
    });
  } catch (err) {
    console.error('Dashboard stats error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── GET /api/v1/monitoring/audit-logs ──────────────────────────
router.get('/monitoring/audit-logs', authenticate, requireRole('super_admin', 'admin'), async (req: Request, res: Response) => {
  try {
    const page = Number(req.query.page) || 1;
    const limit = Math.min(Number(req.query.limit) || 50, 200);
    const tenantId = req.user!.tenantId;

    const result = await paginatedQuery<RowDataPacket>(
      `SELECT al.*, u.email AS user_email
       FROM audit_logs al
       LEFT JOIN users u ON al.user_id = u.id
       WHERE al.tenant_id = ?
       ORDER BY al.created_at DESC`,
      `SELECT COUNT(*) AS total FROM audit_logs al WHERE al.tenant_id = ?`,
      [tenantId],
      page,
      limit
    );

    res.json(result);
  } catch (err) {
    console.error('Audit logs error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── DELETE /api/v1/monitoring/screenshots/:id ──────────────────
router.delete('/monitoring/screenshots/:id', authenticate, requireRole('super_admin', 'admin'), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const tenantId = req.user!.tenantId;

    const existing = await queryOne(
      'SELECT id FROM screenshots WHERE id = ? AND tenant_id = ?',
      [id, tenantId]
    );
    if (!existing) {
      res.status(404).json({ error: 'Screenshot not found' });
      return;
    }

    await execute('DELETE FROM screenshots WHERE id = ? AND tenant_id = ?', [id, tenantId]);
    res.json({ message: 'Screenshot deleted' });
  } catch (err) {
    console.error('Delete screenshot error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
