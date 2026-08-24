import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import bcrypt from 'bcrypt';
import { query, queryOne, execute, paginatedQuery } from '../../services/query';
import { authenticate } from '../../middleware/auth.middleware';
import { requireRole } from '../../middleware/permission.middleware';
import { RowDataPacket } from 'mysql2';
import { broadcastDeviceStatus, broadcastCommand } from '../../realtime/websocket';

const router = Router();

interface DeviceRow extends RowDataPacket {
  id: number;
  tenant_id: number;
  device_uuid: string;
  name: string;
  token_hash: string | null;
  group_id: number | null;
  location: string | null;
  orientation: string;
  resolution_width: number | null;
  resolution_height: number | null;
  os: string | null;
  player_version: string | null;
  status: string;
  last_seen_at: Date | null;
  last_sync_at: Date | null;
  current_manifest_version: number;
  created_at: Date;
  updated_at: Date;
}

// ─── POST /api/v1/devices/register ──────────────────────────────
// Device self-registration (called by player during initial setup)
router.post('/devices/register', async (req: Request, res: Response) => {
  try {
    const { device_uuid, name, token, os, player_version } = req.body;

    if (!device_uuid || !token) {
      res.status(400).json({ error: 'device_uuid and token are required' });
      return;
    }

    // The token here is a pre-shared secret that maps to a tenant
    // In production, this would be an invite/provisioning flow
    // For now, we expect a tenant_id in the body for simplicity
    const { tenant_id } = req.body;
    if (!tenant_id) {
      res.status(400).json({ error: 'tenant_id is required' });
      return;
    }

    // Check if device already registered
    const existing = await queryOne<DeviceRow>(
      'SELECT id FROM devices WHERE device_uuid = ?',
      [device_uuid]
    );

    if (existing) {
      // Re-registration: update info
      const token_hash = await bcrypt.hash(token, 10);
      await execute(
        `UPDATE devices SET
          token_hash = ?,
          os = COALESCE(?, os),
          player_version = COALESCE(?, player_version),
          status = 'OFFLINE'
         WHERE device_uuid = ?`,
        [token_hash, os || null, player_version || null, device_uuid]
      );

      const device = await queryOne<DeviceRow>(
        'SELECT * FROM devices WHERE device_uuid = ?',
        [device_uuid]
      );
      res.json({ device, re_registered: true });
      return;
    }

    // Check tenant device limit
    const tenant = await queryOne<RowDataPacket>(
      'SELECT max_devices FROM tenants WHERE id = ?',
      [tenant_id]
    );
    if (!tenant) {
      res.status(400).json({ error: 'Invalid tenant' });
      return;
    }

    const deviceCount = await queryOne<RowDataPacket>(
      'SELECT COUNT(*) AS cnt FROM devices WHERE tenant_id = ?',
      [tenant_id]
    );
    if ((deviceCount as any).cnt >= (tenant as any).max_devices) {
      res.status(400).json({ error: 'Tenant device limit reached' });
      return;
    }

    const token_hash = await bcrypt.hash(token, 10);

    const result = await execute(
      `INSERT INTO devices (tenant_id, device_uuid, name, token_hash, os, player_version, status)
       VALUES (?, ?, ?, ?, ?, ?, 'OFFLINE')`,
      [tenant_id, device_uuid, name || `Device ${device_uuid.slice(0, 8)}`, token_hash, os || null, player_version || null]
    );

    const device = await queryOne<DeviceRow>(
      'SELECT * FROM devices WHERE id = ?',
      [result.insertId]
    );

    res.status(201).json({ device, re_registered: false });
  } catch (err) {
    console.error('Register device error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── POST /api/v1/devices/heartbeat ─────────────────────────────
// Device heartbeat (called periodically by player)
router.post('/devices/heartbeat', async (req: Request, res: Response) => {
  try {
    const { device_uuid, token, cpu_usage, memory_usage, disk_usage, network_latency_ms, player_version, current_manifest_version } = req.body;

    if (!device_uuid || !token) {
      res.status(400).json({ error: 'device_uuid and token are required' });
      return;
    }

    const device = await queryOne<DeviceRow>(
      'SELECT * FROM devices WHERE device_uuid = ?',
      [device_uuid]
    );

    if (!device) {
      res.status(404).json({ error: 'Device not found' });
      return;
    }

    // Verify token
    if (device.token_hash) {
      const valid = await bcrypt.compare(token, device.token_hash);
      if (!valid) {
        res.status(401).json({ error: 'Invalid device token' });
        return;
      }
    }

    // Update device status
    await execute(
      `UPDATE devices SET
        status = 'ONLINE',
        last_seen_at = NOW(),
        player_version = COALESCE(?, player_version),
        current_manifest_version = COALESCE(?, current_manifest_version)
       WHERE id = ?`,
      [player_version || null, current_manifest_version ?? null, device.id]
    );

    // Record heartbeat
    await execute(
      `INSERT INTO device_heartbeats
        (tenant_id, device_id, cpu_usage, memory_usage, disk_usage, network_latency_ms, player_version, current_manifest_version)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        device.tenant_id,
        device.id,
        cpu_usage ?? null,
        memory_usage ?? null,
        disk_usage ?? null,
        network_latency_ms ?? null,
        player_version || null,
        current_manifest_version ?? null,
      ]
    );

    // Broadcast status change via WebSocket
    broadcastDeviceStatus(device.tenant_id, device.device_uuid, 'ONLINE', {
      cpu_usage: cpu_usage ?? null,
      memory_usage: memory_usage ?? null,
      disk_usage: disk_usage ?? null,
    });

    res.json({ status: 'ok' });
  } catch (err) {
    console.error('Heartbeat error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── GET /api/v1/devices ────────────────────────────────────────
router.get('/devices', authenticate, requireRole('super_admin', 'admin', 'editor'), async (req: Request, res: Response) => {
  try {
    const page = Number(req.query.page) || 1;
    const limit = Math.min(Number(req.query.limit) || 20, 100);
    const search = (req.query.search as string) || '';
    const status = (req.query.status as string) || '';
    const groupId = req.query.group_id ? Number(req.query.group_id) : null;
    const tenantId = req.user!.tenantId;

    let whereClause = 'WHERE d.tenant_id = ?';
    const params: unknown[] = [tenantId];

    if (search) {
      whereClause += ' AND (d.name LIKE ? OR d.device_uuid LIKE ? OR d.location LIKE ?)';
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }
    if (status) {
      whereClause += ' AND d.status = ?';
      params.push(status);
    }
    if (groupId) {
      whereClause += ' AND d.group_id = ?';
      params.push(groupId);
    }

    const result = await paginatedQuery<DeviceRow>(
      `SELECT d.*, dg.name AS group_name
       FROM devices d
       LEFT JOIN device_groups dg ON d.group_id = dg.id
       ${whereClause}
       ORDER BY d.last_seen_at DESC, d.created_at DESC`,
      `SELECT COUNT(*) AS total FROM devices d ${whereClause}`,
      params,
      page,
      limit
    );

    res.json(result);
  } catch (err) {
    console.error('List devices error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── GET /api/v1/devices/:id ────────────────────────────────────
router.get('/devices/:id', authenticate, requireRole('super_admin', 'admin', 'editor'), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const tenantId = req.user!.tenantId;

    const device = await queryOne<DeviceRow>(
      `SELECT d.*, dg.name AS group_name
       FROM devices d
       LEFT JOIN device_groups dg ON d.group_id = dg.id
       WHERE d.id = ? AND d.tenant_id = ?`,
      [id, tenantId]
    );

    if (!device) {
      res.status(404).json({ error: 'Device not found' });
      return;
    }

    res.json({ device });
  } catch (err) {
    console.error('Get device error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── PUT /api/v1/devices/:id ────────────────────────────────────
router.put('/devices/:id', authenticate, requireRole('super_admin', 'admin'), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const tenantId = req.user!.tenantId;
    const { name, location, orientation, group_id, resolution_width, resolution_height } = req.body;

    const existing = await queryOne(
      'SELECT id FROM devices WHERE id = ? AND tenant_id = ?',
      [id, tenantId]
    );

    if (!existing) {
      res.status(404).json({ error: 'Device not found' });
      return;
    }

    if (group_id !== undefined && group_id !== null && !await queryOne(
      'SELECT id FROM device_groups WHERE id = ? AND tenant_id = ?',
      [group_id, tenantId]
    )) {
      res.status(400).json({ error: 'Invalid device group' });
      return;
    }

    await execute(
      `UPDATE devices SET
        name = COALESCE(?, name),
        location = COALESCE(?, location),
        orientation = COALESCE(?, orientation),
        group_id = IF(?, ?, group_id),
        resolution_width = COALESCE(?, resolution_width),
        resolution_height = COALESCE(?, resolution_height)
       WHERE id = ? AND tenant_id = ?`,
      [name, location, orientation, group_id !== undefined, group_id ?? null, resolution_width, resolution_height, id, tenantId]
    );

    const device = await queryOne<DeviceRow>(
      `SELECT d.*, dg.name AS group_name
       FROM devices d
       LEFT JOIN device_groups dg ON d.group_id = dg.id
       WHERE d.id = ?`,
      [id]
    );

    res.json({ device });
  } catch (err) {
    console.error('Update device error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── DELETE /api/v1/devices/:id ─────────────────────────────────
router.delete('/devices/:id', authenticate, requireRole('super_admin', 'admin'), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const tenantId = req.user!.tenantId;

    const existing = await queryOne(
      'SELECT id FROM devices WHERE id = ? AND tenant_id = ?',
      [id, tenantId]
    );

    if (!existing) {
      res.status(404).json({ error: 'Device not found' });
      return;
    }

    await execute('DELETE FROM devices WHERE id = ? AND tenant_id = ?', [id, tenantId]);

    res.json({ message: 'Device deleted' });
  } catch (err) {
    console.error('Delete device error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── POST /api/v1/devices/:id/command ───────────────────────────
// Send a command to a device
router.post('/devices/:id/command', authenticate, requireRole('super_admin', 'admin'), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const tenantId = req.user!.tenantId;
    const { command_type, payload } = req.body;

    const validCommands = ['REBOOT', 'SHUTDOWN', 'UPDATE', 'RELOAD', 'SCREENSHOT', 'CUSTOM'];
    if (!command_type || !validCommands.includes(command_type)) {
      res.status(400).json({ error: `command_type must be one of: ${validCommands.join(', ')}` });
      return;
    }

    const device = await queryOne(
      'SELECT id FROM devices WHERE id = ? AND tenant_id = ?',
      [id, tenantId]
    );

    if (!device) {
      res.status(404).json({ error: 'Device not found' });
      return;
    }

    const result = await execute(
      `INSERT INTO device_commands (tenant_id, device_id, command_type, payload, issued_by)
       VALUES (?, ?, ?, ?, ?)`,
      [tenantId, id, command_type, payload ? JSON.stringify(payload) : null, req.user!.id]
    );

    // Push command via WebSocket
    broadcastCommand(Number(id), {
      command_id: result.insertId,
      command_type,
      payload: payload || null,
    });

    const command = await queryOne(
      'SELECT * FROM device_commands WHERE id = ?',
      [result.insertId]
    );

    res.status(201).json({ command });
  } catch (err) {
    console.error('Send command error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── GET /api/v1/devices/:id/heartbeats ─────────────────────────
router.get('/devices/:id/heartbeats', authenticate, requireRole('super_admin', 'admin', 'editor'), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const tenantId = req.user!.tenantId;
    const limit = Math.min(Number(req.query.limit) || 50, 200);

    const device = await queryOne(
      'SELECT id FROM devices WHERE id = ? AND tenant_id = ?',
      [id, tenantId]
    );

    if (!device) {
      res.status(404).json({ error: 'Device not found' });
      return;
    }

    const heartbeats = await query(
      `SELECT * FROM device_heartbeats
       WHERE device_id = ?
       ORDER BY created_at DESC
       LIMIT ?`,
      [id, limit]
    );

    res.json({ heartbeats });
  } catch (err) {
    console.error('Get heartbeats error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
