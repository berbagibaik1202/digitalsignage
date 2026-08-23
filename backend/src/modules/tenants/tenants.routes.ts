import { Router, Request, Response } from 'express';
import { query, queryOne, execute, paginatedQuery } from '../../services/query';
import { authenticate } from '../../middleware/auth.middleware';
import { requireRole } from '../../middleware/permission.middleware';
import { RowDataPacket } from 'mysql2';

const router = Router();

interface TenantRow extends RowDataPacket {
  id: number;
  name: string;
  slug: string;
  logo_url: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  address: string | null;
  timezone: string;
  status: string;
  max_devices: number;
  max_storage_mb: number;
  created_at: Date;
  updated_at: Date;
}

// ─── GET /api/v1/tenants ────────────────────────────────────────
router.get('/tenants', authenticate, requireRole('super_admin'), async (req: Request, res: Response) => {
  try {
    const page = Number(req.query.page) || 1;
    const limit = Math.min(Number(req.query.limit) || 20, 100);
    const search = (req.query.search as string) || '';

    const whereClause = search ? 'WHERE name LIKE ? OR slug LIKE ?' : '';
    const params = search ? [`%${search}%`, `%${search}%`] : [];

    const result = await paginatedQuery<TenantRow>(
      `SELECT * FROM tenants ${whereClause} ORDER BY created_at DESC`,
      `SELECT COUNT(*) AS total FROM tenants ${whereClause}`,
      params,
      page,
      limit
    );

    res.json(result);
  } catch (err) {
    console.error('List tenants error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── GET /api/v1/tenants/:id ────────────────────────────────────
router.get('/tenants/:id', authenticate, requireRole('super_admin', 'admin'), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const user = req.user!;

    // Non-super-admins can only see their own tenant
    if (user.role !== 'super_admin' && user.tenantId !== Number(id)) {
      res.status(403).json({ error: 'Access denied' });
      return;
    }

    const tenant = await queryOne<TenantRow>(
      'SELECT * FROM tenants WHERE id = ?',
      [id]
    );

    if (!tenant) {
      res.status(404).json({ error: 'Tenant not found' });
      return;
    }

    res.json({ tenant });
  } catch (err) {
    console.error('Get tenant error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── POST /api/v1/tenants ───────────────────────────────────────
router.post('/tenants', authenticate, requireRole('super_admin'), async (req: Request, res: Response) => {
  try {
    const { name, slug, contact_email, contact_phone, address, timezone } = req.body;

    if (!name || !slug) {
      res.status(400).json({ error: 'name and slug are required' });
      return;
    }

    // Validate slug format
    if (!/^[a-z0-9-]+$/.test(slug)) {
      res.status(400).json({ error: 'slug must be lowercase alphanumeric with hyphens' });
      return;
    }

    const existing = await queryOne('SELECT id FROM tenants WHERE slug = ?', [slug]);
    if (existing) {
      res.status(409).json({ error: 'Slug already taken' });
      return;
    }

    const result = await execute(
      `INSERT INTO tenants (name, slug, contact_email, contact_phone, address, timezone)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [name, slug, contact_email || null, contact_phone || null, address || null, timezone || 'UTC']
    );

    const tenant = await queryOne<TenantRow>('SELECT * FROM tenants WHERE id = ?', [result.insertId]);

    res.status(201).json({ tenant });
  } catch (err) {
    console.error('Create tenant error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── PUT /api/v1/tenants/:id ────────────────────────────────────
router.put('/tenants/:id', authenticate, requireRole('super_admin', 'admin'), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const user = req.user!;

    if (user.role !== 'super_admin' && user.tenantId !== Number(id)) {
      res.status(403).json({ error: 'Access denied' });
      return;
    }

    const { name, contact_email, contact_phone, address, timezone, status, max_devices, max_storage_mb } = req.body;

    const existing = await queryOne('SELECT id FROM tenants WHERE id = ?', [id]);
    if (!existing) {
      res.status(404).json({ error: 'Tenant not found' });
      return;
    }

    await execute(
      `UPDATE tenants SET
        name = COALESCE(?, name),
        contact_email = COALESCE(?, contact_email),
        contact_phone = COALESCE(?, contact_phone),
        address = COALESCE(?, address),
        timezone = COALESCE(?, timezone),
        status = COALESCE(?, status),
        max_devices = COALESCE(?, max_devices),
        max_storage_mb = COALESCE(?, max_storage_mb)
       WHERE id = ?`,
      [name, contact_email, contact_phone, address, timezone, status, max_devices, max_storage_mb, id]
    );

    const tenant = await queryOne<TenantRow>('SELECT * FROM tenants WHERE id = ?', [id]);
    res.json({ tenant });
  } catch (err) {
    console.error('Update tenant error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── DELETE /api/v1/tenants/:id ─────────────────────────────────
router.delete('/tenants/:id', authenticate, requireRole('super_admin'), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const existing = await queryOne('SELECT id FROM tenants WHERE id = ?', [id]);
    if (!existing) {
      res.status(404).json({ error: 'Tenant not found' });
      return;
    }

    // Soft delete: set status to CANCELLED
    await execute("UPDATE tenants SET status = 'CANCELLED' WHERE id = ?", [id]);

    res.json({ message: 'Tenant cancelled' });
  } catch (err) {
    console.error('Delete tenant error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
