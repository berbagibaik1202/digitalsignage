import { Router, Request, Response } from 'express';
import { query, queryOne, execute, paginatedQuery } from '../../services/query';
import { authenticate } from '../../middleware/auth.middleware';
import { requireRole } from '../../middleware/permission.middleware';
import { RowDataPacket } from 'mysql2';

const router = Router();

interface CommandRow extends RowDataPacket {
  id: number;
  tenant_id: number;
  device_id: number;
  command_type: string;
  payload: any;
  status: string;
  result: string | null;
  issued_by: number | null;
  created_at: Date;
  executed_at: string | null;
  device_name?: string;
  device_uuid?: string;
  issued_by_email?: string;
}

// ─── GET /api/v1/commands ───────────────────────────────────────
router.get('/commands', authenticate, requireRole('super_admin', 'admin', 'editor'), async (req: Request, res: Response) => {
  try {
    const page = Number(req.query.page) || 1;
    const limit = Math.min(Number(req.query.limit) || 50, 200);
    const tenantId = req.user!.tenantId;
    const status = (req.query.status as string) || '';
    const deviceId = (req.query.device_id as string) || '';
    const commandType = (req.query.command_type as string) || '';

    let whereClause = 'WHERE dc.tenant_id = ?';
    const params: unknown[] = [tenantId];

    if (status) {
      whereClause += ' AND dc.status = ?';
      params.push(status);
    }
    if (deviceId) {
      whereClause += ' AND dc.device_id = ?';
      params.push(deviceId);
    }
    if (commandType) {
      whereClause += ' AND dc.command_type = ?';
      params.push(commandType);
    }

    const result = await paginatedQuery<CommandRow>(
      `SELECT dc.*, d.name AS device_name, d.device_uuid, u.email AS issued_by_email
       FROM device_commands dc
       LEFT JOIN devices d ON dc.device_id = d.id
       LEFT JOIN users u ON dc.issued_by = u.id
       ${whereClause}
       ORDER BY dc.created_at DESC`,
      `SELECT COUNT(*) AS total FROM device_commands dc ${whereClause}`,
      params,
      page,
      limit
    );

    res.json(result);
  } catch (err) {
    console.error('List commands error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── GET /api/v1/commands/stats ─────────────────────────────────
router.get('/commands/stats', authenticate, requireRole('super_admin', 'admin', 'editor'), async (req: Request, res: Response) => {
  try {
    const tenantId = req.user!.tenantId;

    const stats = await queryOne<RowDataPacket>(
      `SELECT
        COUNT(*) AS total,
        COUNT(CASE WHEN status = 'PENDING' THEN 1 END) AS pending,
        COUNT(CASE WHEN status = 'SENT' THEN 1 END) AS sent,
        COUNT(CASE WHEN status = 'ACKNOWLEDGED' THEN 1 END) AS acknowledged,
        COUNT(CASE WHEN status = 'COMPLETED' THEN 1 END) AS completed,
        COUNT(CASE WHEN status = 'FAILED' THEN 1 END) AS failed
       FROM device_commands WHERE tenant_id = ?`,
      [tenantId]
    );

    res.json({ stats });
  } catch (err) {
    console.error('Command stats error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── POST /api/v1/commands ──────────────────────────────────────
// Create command for a device
router.post('/commands', authenticate, requireRole('super_admin', 'admin', 'editor'), async (req: Request, res: Response) => {
  try {
    const { device_id, command_type, payload } = req.body;
    const tenantId = req.user!.tenantId;

    if (!device_id || !command_type) {
      res.status(400).json({ error: 'device_id and command_type are required' });
      return;
    }

    const validTypes = ['REBOOT', 'SHUTDOWN', 'UPDATE', 'RELOAD', 'SCREENSHOT', 'CUSTOM'];
    if (!validTypes.includes(command_type)) {
      res.status(400).json({ error: `command_type must be one of: ${validTypes.join(', ')}` });
      return;
    }

    const device = await queryOne(
      'SELECT id FROM devices WHERE id = ? AND tenant_id = ?',
      [device_id, tenantId]
    );
    if (!device) {
      res.status(404).json({ error: 'Device not found' });
      return;
    }

    const result = await execute(
      `INSERT INTO device_commands (tenant_id, device_id, command_type, payload, issued_by)
       VALUES (?, ?, ?, ?, ?)`,
      [tenantId, device_id, command_type, payload ? JSON.stringify(payload) : null, req.user!.id]
    );

    const command = await queryOne<CommandRow>(
      `SELECT dc.*, d.name AS device_name
       FROM device_commands dc LEFT JOIN devices d ON dc.device_id = d.id
       WHERE dc.id = ?`,
      [result.insertId]
    );

    res.status(201).json({ command });
  } catch (err) {
    console.error('Create command error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── POST /api/v1/commands/broadcast ────────────────────────────
// Send command to all devices in a group
router.post('/commands/broadcast', authenticate, requireRole('super_admin', 'admin', 'editor'), async (req: Request, res: Response) => {
  try {
    const { group_id, device_ids, command_type, payload } = req.body;
    const tenantId = req.user!.tenantId;

    if (!command_type) {
      res.status(400).json({ error: 'command_type is required' });
      return;
    }

    const validTypes = ['REBOOT', 'SHUTDOWN', 'UPDATE', 'RELOAD', 'SCREENSHOT', 'CUSTOM'];
    if (!validTypes.includes(command_type)) {
      res.status(400).json({ error: `command_type must be one of: ${validTypes.join(', ')}` });
      return;
    }

    let targetDeviceIds: number[] = [];

    if (group_id) {
      const devices = await query<RowDataPacket[]>(
        'SELECT id FROM devices WHERE group_id = ? AND tenant_id = ?',
        [group_id, tenantId]
      );
      targetDeviceIds = devices.map((d: any) => d.id);
    } else if (Array.isArray(device_ids)) {
      targetDeviceIds = device_ids;
    } else {
      res.status(400).json({ error: 'group_id or device_ids array is required' });
      return;
    }

    if (targetDeviceIds.length === 0) {
      res.status(404).json({ error: 'No devices found' });
      return;
    }

    let created = 0;
    for (const deviceId of targetDeviceIds) {
      await execute(
        `INSERT INTO device_commands (tenant_id, device_id, command_type, payload, issued_by)
         VALUES (?, ?, ?, ?, ?)`,
        [tenantId, deviceId, command_type, payload ? JSON.stringify(payload) : null, req.user!.id]
      );
      created++;
    }

    res.status(201).json({ message: `Command sent to ${created} device(s)`, count: created });
  } catch (err) {
    console.error('Broadcast command error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── DELETE /api/v1/commands/:id ────────────────────────────────
// Cancel/delete a pending command
router.delete('/commands/:id', authenticate, requireRole('super_admin', 'admin', 'editor'), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const tenantId = req.user!.tenantId;

    const command = await queryOne(
      'SELECT id, status FROM device_commands WHERE id = ? AND tenant_id = ?',
      [id, tenantId]
    );

    if (!command) {
      res.status(404).json({ error: 'Command not found' });
      return;
    }

    if ((command as any).status !== 'PENDING') {
      res.status(400).json({ error: 'Only PENDING commands can be deleted' });
      return;
    }

    await execute('DELETE FROM device_commands WHERE id = ? AND tenant_id = ?', [id, tenantId]);
    res.json({ message: 'Command deleted' });
  } catch (err) {
    console.error('Delete command error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
