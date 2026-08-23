import { Router, Request, Response } from 'express';
import { query, queryOne, execute } from '../../services/query';
import { authenticate } from '../../middleware/auth.middleware';
import { requireRole } from '../../middleware/permission.middleware';
import { RowDataPacket } from 'mysql2';

const router = Router();

interface GroupRow extends RowDataPacket {
  id: number;
  tenant_id: number;
  name: string;
  description: string | null;
  created_at: Date;
  updated_at: Date;
}

// ─── GET /api/v1/device-groups ──────────────────────────────────
router.get('/device-groups', authenticate, requireRole('super_admin', 'admin', 'editor'), async (req: Request, res: Response) => {
  try {
    const tenantId = req.user!.tenantId;

    const groups = await query<GroupRow[]>(
      `SELECT dg.*,
        (SELECT COUNT(*) FROM devices d WHERE d.group_id = dg.id) AS device_count
       FROM device_groups dg
       WHERE dg.tenant_id = ?
       ORDER BY dg.name ASC`,
      [tenantId]
    );

    res.json({ groups });
  } catch (err) {
    console.error('List device groups error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── GET /api/v1/device-groups/:id ──────────────────────────────
router.get('/device-groups/:id', authenticate, requireRole('super_admin', 'admin', 'editor'), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const tenantId = req.user!.tenantId;

    const group = await queryOne<GroupRow>(
      'SELECT * FROM device_groups WHERE id = ? AND tenant_id = ?',
      [id, tenantId]
    );

    if (!group) {
      res.status(404).json({ error: 'Device group not found' });
      return;
    }

    const devices = await query(
      'SELECT id, device_uuid, name, status, last_seen_at FROM devices WHERE group_id = ? AND tenant_id = ? ORDER BY name',
      [id, tenantId]
    );

    res.json({ group, devices });
  } catch (err) {
    console.error('Get device group error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── POST /api/v1/device-groups ─────────────────────────────────
router.post('/device-groups', authenticate, requireRole('super_admin', 'admin'), async (req: Request, res: Response) => {
  try {
    const { name, description } = req.body;
    const tenantId = req.user!.tenantId;

    if (!name) {
      res.status(400).json({ error: 'name is required' });
      return;
    }

    const result = await execute(
      'INSERT INTO device_groups (tenant_id, name, description) VALUES (?, ?, ?)',
      [tenantId, name, description || null]
    );

    const group = await queryOne<GroupRow>(
      'SELECT * FROM device_groups WHERE id = ?',
      [result.insertId]
    );

    res.status(201).json({ group });
  } catch (err) {
    console.error('Create device group error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── PUT /api/v1/device-groups/:id ──────────────────────────────
router.put('/device-groups/:id', authenticate, requireRole('super_admin', 'admin'), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const tenantId = req.user!.tenantId;
    const { name, description } = req.body;

    const existing = await queryOne(
      'SELECT id FROM device_groups WHERE id = ? AND tenant_id = ?',
      [id, tenantId]
    );

    if (!existing) {
      res.status(404).json({ error: 'Device group not found' });
      return;
    }

    await execute(
      `UPDATE device_groups SET
        name = COALESCE(?, name),
        description = COALESCE(?, description)
       WHERE id = ? AND tenant_id = ?`,
      [name, description, id, tenantId]
    );

    const group = await queryOne<GroupRow>(
      'SELECT * FROM device_groups WHERE id = ?',
      [id]
    );

    res.json({ group });
  } catch (err) {
    console.error('Update device group error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── DELETE /api/v1/device-groups/:id ───────────────────────────
router.delete('/device-groups/:id', authenticate, requireRole('super_admin', 'admin'), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const tenantId = req.user!.tenantId;

    const existing = await queryOne(
      'SELECT id FROM device_groups WHERE id = ? AND tenant_id = ?',
      [id, tenantId]
    );

    if (!existing) {
      res.status(404).json({ error: 'Device group not found' });
      return;
    }

    // Unlink devices from this group
    await execute('UPDATE devices SET group_id = NULL WHERE group_id = ? AND tenant_id = ?', [id, tenantId]);
    await execute('DELETE FROM device_groups WHERE id = ? AND tenant_id = ?', [id, tenantId]);

    res.json({ message: 'Device group deleted' });
  } catch (err) {
    console.error('Delete device group error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
