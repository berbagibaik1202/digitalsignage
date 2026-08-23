import { Router, Request, Response } from 'express';
import { query, queryOne, execute, paginatedQuery } from '../../services/query';
import { authenticate } from '../../middleware/auth.middleware';
import { requireRole } from '../../middleware/permission.middleware';
import { RowDataPacket } from 'mysql2';

const router = Router();

interface ScheduleRow extends RowDataPacket {
  id: number;
  tenant_id: number;
  name: string;
  description: string | null;
  playlist_id: number | null;
  layout_id: number | null;
  start_date: string;
  end_date: string | null;
  start_time: string | null;
  end_time: string | null;
  days_of_week: string | null;
  priority: number;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

interface ScheduleTargetRow extends RowDataPacket {
  id: number;
  tenant_id: number;
  schedule_id: number;
  target_type: string;
  target_id: number;
  created_at: Date;
  // Joined
  target_name?: string;
}

// ─── GET /api/v1/schedules ──────────────────────────────────────
router.get('/schedules', authenticate, requireRole('super_admin', 'admin', 'editor', 'viewer'), async (req: Request, res: Response) => {
  try {
    const page = Number(req.query.page) || 1;
    const limit = Math.min(Number(req.query.limit) || 20, 100);
    const search = (req.query.search as string) || '';
    const tenantId = req.user!.tenantId;

    let whereClause = 'WHERE s.tenant_id = ?';
    const params: unknown[] = [tenantId];

    if (search) {
      whereClause += ' AND (s.name LIKE ? OR s.description LIKE ?)';
      params.push(`%${search}%`, `%${search}%`);
    }

    const result = await paginatedQuery<ScheduleRow>(
      `SELECT s.*,
        p.name AS playlist_name,
        l.name AS layout_name
       FROM schedules s
       LEFT JOIN playlists p ON s.playlist_id = p.id
       LEFT JOIN layouts l ON s.layout_id = l.id
       ${whereClause}
       ORDER BY s.priority DESC, s.created_at DESC`,
      `SELECT COUNT(*) AS total FROM schedules s ${whereClause}`,
      params,
      page,
      limit
    );

    res.json(result);
  } catch (err) {
    console.error('List schedules error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── GET /api/v1/schedules/:id ──────────────────────────────────
router.get('/schedules/:id', authenticate, requireRole('super_admin', 'admin', 'editor', 'viewer'), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const tenantId = req.user!.tenantId;

    const schedule = await queryOne<ScheduleRow>(
      `SELECT s.*, p.name AS playlist_name, l.name AS layout_name
       FROM schedules s
       LEFT JOIN playlists p ON s.playlist_id = p.id
       LEFT JOIN layouts l ON s.layout_id = l.id
       WHERE s.id = ? AND s.tenant_id = ?`,
      [id, tenantId]
    );

    if (!schedule) {
      res.status(404).json({ error: 'Schedule not found' });
      return;
    }

    // Get targets
    const targets = await query<ScheduleTargetRow[]>(
      `SELECT st.*,
        CASE
          WHEN st.target_type = 'DEVICE' THEN d.name
          WHEN st.target_type = 'GROUP' THEN dg.name
        END AS target_name
       FROM schedule_targets st
       LEFT JOIN devices d ON st.target_type = 'DEVICE' AND st.target_id = d.id
       LEFT JOIN device_groups dg ON st.target_type = 'GROUP' AND st.target_id = dg.id
       WHERE st.schedule_id = ? AND st.tenant_id = ?`,
      [id, tenantId]
    );

    res.json({ schedule, targets });
  } catch (err) {
    console.error('Get schedule error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── POST /api/v1/schedules ─────────────────────────────────────
router.post('/schedules', authenticate, requireRole('super_admin', 'admin', 'editor'), async (req: Request, res: Response) => {
  try {
    const {
      name, description, playlist_id, layout_id,
      start_date, end_date, start_time, end_time,
      days_of_week, priority, targets
    } = req.body;
    const tenantId = req.user!.tenantId;

    if (!name || !start_date) {
      res.status(400).json({ error: 'name and start_date are required' });
      return;
    }

    const result = await execute(
      `INSERT INTO schedules
        (tenant_id, name, description, playlist_id, layout_id, start_date, end_date, start_time, end_time, days_of_week, priority)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        tenantId, name, description || null,
        playlist_id || null, layout_id || null,
        start_date, end_date || null,
        start_time || null, end_time || null,
        days_of_week || null, priority || 0
      ]
    );

    const scheduleId = result.insertId;

    // Add targets if provided
    if (Array.isArray(targets)) {
      for (const t of targets) {
        if (t.target_type && t.target_id) {
          await execute(
            'INSERT INTO schedule_targets (tenant_id, schedule_id, target_type, target_id) VALUES (?, ?, ?, ?)',
            [tenantId, scheduleId, t.target_type, t.target_id]
          );
        }
      }
    }

    const schedule = await queryOne<ScheduleRow>(
      'SELECT * FROM schedules WHERE id = ?',
      [scheduleId]
    );

    res.status(201).json({ schedule });
  } catch (err) {
    console.error('Create schedule error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── PUT /api/v1/schedules/:id ──────────────────────────────────
router.put('/schedules/:id', authenticate, requireRole('super_admin', 'admin', 'editor'), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const tenantId = req.user!.tenantId;
    const {
      name, description, playlist_id, layout_id,
      start_date, end_date, start_time, end_time,
      days_of_week, priority, is_active, targets
    } = req.body;

    const existing = await queryOne(
      'SELECT id FROM schedules WHERE id = ? AND tenant_id = ?',
      [id, tenantId]
    );

    if (!existing) {
      res.status(404).json({ error: 'Schedule not found' });
      return;
    }

    await execute(
      `UPDATE schedules SET
        name = COALESCE(?, name),
        description = COALESCE(?, description),
        playlist_id = COALESCE(?, playlist_id),
        layout_id = COALESCE(?, layout_id),
        start_date = COALESCE(?, start_date),
        end_date = COALESCE(?, end_date),
        start_time = COALESCE(?, start_time),
        end_time = COALESCE(?, end_time),
        days_of_week = COALESCE(?, days_of_week),
        priority = COALESCE(?, priority),
        is_active = COALESCE(?, is_active)
       WHERE id = ? AND tenant_id = ?`,
      [name, description, playlist_id, layout_id, start_date, end_date, start_time, end_time, days_of_week, priority, is_active, id, tenantId]
    );

    // Update targets if provided
    if (Array.isArray(targets)) {
      await execute('DELETE FROM schedule_targets WHERE schedule_id = ? AND tenant_id = ?', [id, tenantId]);
      for (const t of targets) {
        if (t.target_type && t.target_id) {
          await execute(
            'INSERT INTO schedule_targets (tenant_id, schedule_id, target_type, target_id) VALUES (?, ?, ?, ?)',
            [tenantId, id, t.target_type, t.target_id]
          );
        }
      }
    }

    const schedule = await queryOne<ScheduleRow>(
      'SELECT * FROM schedules WHERE id = ?',
      [id]
    );

    res.json({ schedule });
  } catch (err) {
    console.error('Update schedule error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── DELETE /api/v1/schedules/:id ───────────────────────────────
router.delete('/schedules/:id', authenticate, requireRole('super_admin', 'admin', 'editor'), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const tenantId = req.user!.tenantId;

    const existing = await queryOne(
      'SELECT id FROM schedules WHERE id = ? AND tenant_id = ?',
      [id, tenantId]
    );

    if (!existing) {
      res.status(404).json({ error: 'Schedule not found' });
      return;
    }

    await execute('DELETE FROM schedule_targets WHERE schedule_id = ? AND tenant_id = ?', [id, tenantId]);
    await execute('DELETE FROM schedules WHERE id = ? AND tenant_id = ?', [id, tenantId]);

    res.json({ message: 'Schedule deleted' });
  } catch (err) {
    console.error('Delete schedule error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
