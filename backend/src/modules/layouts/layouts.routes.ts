import { Router, Request, Response } from 'express';
import { query, queryOne, execute, paginatedQuery } from '../../services/query';
import { authenticate } from '../../middleware/auth.middleware';
import { requireRole } from '../../middleware/permission.middleware';
import { RowDataPacket } from 'mysql2';

const router = Router();

interface LayoutRow extends RowDataPacket {
  id: number;
  tenant_id: number;
  name: string;
  description: string | null;
  width: number;
  height: number;
  background_color: string;
  created_at: Date;
  updated_at: Date;
}

interface LayoutZoneRow extends RowDataPacket {
  id: number;
  tenant_id: number;
  layout_id: number;
  name: string;
  zone_type: string;
  x: number;
  y: number;
  width: number;
  height: number;
  z_index: number;
  config: any;
  created_at: Date;
  updated_at: Date;
}

// ─── GET /api/v1/layouts ────────────────────────────────────────
router.get('/layouts', authenticate, requireRole('super_admin', 'admin', 'editor', 'viewer'), async (req: Request, res: Response) => {
  try {
    const page = Number(req.query.page) || 1;
    const limit = Math.min(Number(req.query.limit) || 20, 100);
    const search = (req.query.search as string) || '';
    const tenantId = req.user!.tenantId;

    let whereClause = 'WHERE l.tenant_id = ?';
    const params: unknown[] = [tenantId];

    if (search) {
      whereClause += ' AND (l.name LIKE ? OR l.description LIKE ?)';
      params.push(`%${search}%`, `%${search}%`);
    }

    const result = await paginatedQuery<LayoutRow>(
      `SELECT l.*,
        (SELECT COUNT(*) FROM layout_zones lz WHERE lz.layout_id = l.id) AS zone_count
       FROM layouts l
       ${whereClause}
       ORDER BY l.created_at DESC`,
      `SELECT COUNT(*) AS total FROM layouts l ${whereClause}`,
      params,
      page,
      limit
    );

    res.json(result);
  } catch (err) {
    console.error('List layouts error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── GET /api/v1/layouts/:id ────────────────────────────────────
router.get('/layouts/:id', authenticate, requireRole('super_admin', 'admin', 'editor', 'viewer'), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const tenantId = req.user!.tenantId;

    const layout = await queryOne<LayoutRow>(
      'SELECT * FROM layouts WHERE id = ? AND tenant_id = ?',
      [id, tenantId]
    );

    if (!layout) {
      res.status(404).json({ error: 'Layout not found' });
      return;
    }

    const zones = await query<LayoutZoneRow[]>(
      'SELECT * FROM layout_zones WHERE layout_id = ? AND tenant_id = ? ORDER BY z_index ASC',
      [id, tenantId]
    );

    res.json({ layout, zones });
  } catch (err) {
    console.error('Get layout error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── POST /api/v1/layouts ───────────────────────────────────────
router.post('/layouts', authenticate, requireRole('super_admin', 'admin', 'editor'), async (req: Request, res: Response) => {
  try {
    const { name, description, width, height, background_color } = req.body;
    const tenantId = req.user!.tenantId;

    if (!name) {
      res.status(400).json({ error: 'name is required' });
      return;
    }

    const result = await execute(
      'INSERT INTO layouts (tenant_id, name, description, width, height, background_color) VALUES (?, ?, ?, ?, ?, ?)',
      [tenantId, name, description || null, width || 1920, height || 1080, background_color || '#000000']
    );

    const layout = await queryOne<LayoutRow>(
      'SELECT * FROM layouts WHERE id = ?',
      [result.insertId]
    );

    res.status(201).json({ layout });
  } catch (err) {
    console.error('Create layout error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── PUT /api/v1/layouts/:id ────────────────────────────────────
router.put('/layouts/:id', authenticate, requireRole('super_admin', 'admin', 'editor'), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const tenantId = req.user!.tenantId;
    const { name, description, width, height, background_color } = req.body;

    const existing = await queryOne(
      'SELECT id FROM layouts WHERE id = ? AND tenant_id = ?',
      [id, tenantId]
    );

    if (!existing) {
      res.status(404).json({ error: 'Layout not found' });
      return;
    }

    await execute(
      `UPDATE layouts SET
        name = COALESCE(?, name),
        description = COALESCE(?, description),
        width = COALESCE(?, width),
        height = COALESCE(?, height),
        background_color = COALESCE(?, background_color)
       WHERE id = ? AND tenant_id = ?`,
      [name, description, width, height, background_color, id, tenantId]
    );

    const layout = await queryOne<LayoutRow>(
      'SELECT * FROM layouts WHERE id = ?',
      [id]
    );

    res.json({ layout });
  } catch (err) {
    console.error('Update layout error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── DELETE /api/v1/layouts/:id ─────────────────────────────────
router.delete('/layouts/:id', authenticate, requireRole('super_admin', 'admin', 'editor'), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const tenantId = req.user!.tenantId;

    const existing = await queryOne(
      'SELECT id FROM layouts WHERE id = ? AND tenant_id = ?',
      [id, tenantId]
    );

    if (!existing) {
      res.status(404).json({ error: 'Layout not found' });
      return;
    }

    await execute('DELETE FROM layout_zones WHERE layout_id = ? AND tenant_id = ?', [id, tenantId]);
    await execute('DELETE FROM layouts WHERE id = ? AND tenant_id = ?', [id, tenantId]);

    res.json({ message: 'Layout deleted' });
  } catch (err) {
    console.error('Delete layout error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── POST /api/v1/layouts/:id/zones ─────────────────────────────
router.post('/layouts/:id/zones', authenticate, requireRole('super_admin', 'admin', 'editor'), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const tenantId = req.user!.tenantId;
    const { name, zone_type, x, y, width, height, z_index, config } = req.body;

    if (!name) {
      res.status(400).json({ error: 'name is required' });
      return;
    }

    const layout = await queryOne(
      'SELECT id FROM layouts WHERE id = ? AND tenant_id = ?',
      [id, tenantId]
    );
    if (!layout) {
      res.status(404).json({ error: 'Layout not found' });
      return;
    }

    const result = await execute(
      `INSERT INTO layout_zones (tenant_id, layout_id, name, zone_type, x, y, width, height, z_index, config)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        tenantId, id, name,
        zone_type || 'MEDIA',
        x || 0, y || 0,
        width || 1920, height || 1080,
        z_index || 0,
        config ? JSON.stringify(config) : null
      ]
    );

    const zone = await queryOne<LayoutZoneRow>(
      'SELECT * FROM layout_zones WHERE id = ?',
      [result.insertId]
    );

    res.status(201).json({ zone });
  } catch (err) {
    console.error('Create layout zone error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── PUT /api/v1/layouts/:layoutId/zones/:zoneId ────────────────
router.put('/layouts/:layoutId/zones/:zoneId', authenticate, requireRole('super_admin', 'admin', 'editor'), async (req: Request, res: Response) => {
  try {
    const { layoutId, zoneId } = req.params;
    const tenantId = req.user!.tenantId;
    const { name, zone_type, x, y, width, height, z_index, config } = req.body;

    const existing = await queryOne(
      'SELECT id FROM layout_zones WHERE id = ? AND layout_id = ? AND tenant_id = ?',
      [zoneId, layoutId, tenantId]
    );

    if (!existing) {
      res.status(404).json({ error: 'Zone not found' });
      return;
    }

    await execute(
      `UPDATE layout_zones SET
        name = COALESCE(?, name),
        zone_type = COALESCE(?, zone_type),
        x = COALESCE(?, x),
        y = COALESCE(?, y),
        width = COALESCE(?, width),
        height = COALESCE(?, height),
        z_index = COALESCE(?, z_index),
        config = COALESCE(?, config)
       WHERE id = ? AND layout_id = ? AND tenant_id = ?`,
      [name, zone_type, x, y, width, height, z_index, config ? JSON.stringify(config) : null, zoneId, layoutId, tenantId]
    );

    const zone = await queryOne<LayoutZoneRow>(
      'SELECT * FROM layout_zones WHERE id = ?',
      [zoneId]
    );

    res.json({ zone });
  } catch (err) {
    console.error('Update layout zone error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── DELETE /api/v1/layouts/:layoutId/zones/:zoneId ─────────────
router.delete('/layouts/:layoutId/zones/:zoneId', authenticate, requireRole('super_admin', 'admin', 'editor'), async (req: Request, res: Response) => {
  try {
    const { layoutId, zoneId } = req.params;
    const tenantId = req.user!.tenantId;

    const existing = await queryOne(
      'SELECT id FROM layout_zones WHERE id = ? AND layout_id = ? AND tenant_id = ?',
      [zoneId, layoutId, tenantId]
    );

    if (!existing) {
      res.status(404).json({ error: 'Zone not found' });
      return;
    }

    await execute('DELETE FROM layout_zones WHERE id = ? AND tenant_id = ?', [zoneId, tenantId]);

    res.json({ message: 'Zone deleted' });
  } catch (err) {
    console.error('Delete layout zone error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
