import { Router, Request, Response } from 'express';
import bcrypt from 'bcrypt';
import { query, queryOne, execute, paginatedQuery } from '../../services/query';
import { authenticate } from '../../middleware/auth.middleware';
import { requireRole } from '../../middleware/permission.middleware';
import { RowDataPacket } from 'mysql2';
import crypto from 'crypto';

const router = Router();

interface TenantRow extends RowDataPacket {
  id: number;
  name: string;
  slug: string;
  contact_email: string | null;
  max_devices: number;
  max_storage_mb: number;
  registration_token: string | null;
  status: string;
  created_at: Date;
  updated_at: Date;
}

// ─── GET /api/v1/admin/overview ─────────────────────────────────
router.get('/admin/overview', authenticate, requireRole('super_admin'), async (req: Request, res: Response) => {
  try {
    const tenantCount = await queryOne<RowDataPacket>('SELECT COUNT(*) AS total FROM tenants');
    const userCount = await queryOne<RowDataPacket>('SELECT COUNT(*) AS total FROM users');
    const deviceCount = await queryOne<RowDataPacket>(`SELECT COUNT(*) AS total, COUNT(CASE WHEN status = 'ONLINE' THEN 1 END) AS online FROM devices`);
    const mediaCount = await queryOne<RowDataPacket>('SELECT COUNT(*) AS total, COALESCE(SUM(file_size), 0) AS total_size FROM media');
    const subCount = await queryOne<RowDataPacket>(`SELECT COUNT(*) AS total, COUNT(CASE WHEN status = 'ACTIVE' THEN 1 END) AS active FROM subscriptions`);

    const tenantsByStatus = await query<RowDataPacket[]>('SELECT status, COUNT(*) AS count FROM tenants GROUP BY status');
    const recentTenants = await query<RowDataPacket[]>(
      `SELECT DATE(created_at) AS date, COUNT(*) AS count FROM tenants WHERE created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY) GROUP BY DATE(created_at) ORDER BY date`
    );

    res.json({
      tenants: { total: tenantCount?.total ?? 0, by_status: tenantsByStatus, recent: recentTenants },
      users: { total: userCount?.total ?? 0 },
      devices: { total: deviceCount?.total ?? 0, online: deviceCount?.online ?? 0 },
      media: { total: mediaCount?.total ?? 0, total_size: mediaCount?.total_size ?? 0 },
      subscriptions: { total: subCount?.total ?? 0, active: subCount?.active ?? 0 },
    });
  } catch (err) {
    console.error('Admin overview error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── GET /api/v1/admin/tenants ──────────────────────────────────
router.get('/admin/tenants', authenticate, requireRole('super_admin'), async (req: Request, res: Response) => {
  try {
    const page = Number(req.query.page) || 1;
    const limit = Math.min(Number(req.query.limit) || 20, 100);
    const search = (req.query.search as string) || '';
    const status = (req.query.status as string) || '';

    let whereClause = 'WHERE 1=1';
    const params: unknown[] = [];

    if (search) {
      whereClause += ' AND (t.name LIKE ? OR t.slug LIKE ? OR t.contact_email LIKE ?)';
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }
    if (status) {
      whereClause += ' AND t.status = ?';
      params.push(status);
    }

    // Simple query first - avoid issues with missing columns
    const result = await paginatedQuery<TenantRow>(
      `SELECT t.id, t.name, t.slug, t.contact_email, t.max_devices, t.max_storage_mb,
        t.status, t.created_at, t.updated_at,
        (SELECT COUNT(*) FROM users u WHERE u.tenant_id = t.id) AS user_count,
        (SELECT COUNT(*) FROM devices d WHERE d.tenant_id = t.id) AS device_count,
        (SELECT COUNT(*) FROM devices d WHERE d.tenant_id = t.id AND d.status = 'ONLINE') AS online_device_count
       FROM tenants t
       ${whereClause}
       ORDER BY t.created_at DESC`,
      `SELECT COUNT(*) AS total FROM tenants t ${whereClause}`,
      params,
      page,
      limit
    );

    // Try to add registration_token if column exists
    try {
      const tokens = await query<RowDataPacket[]>(
        'SELECT id, registration_token FROM tenants WHERE registration_token IS NOT NULL'
      );
      const tokenMap = new Map(tokens.map((t: any) => [t.id, t.registration_token]));
      if (result.data) {
        result.data = result.data.map((t: any) => ({
          ...t,
          registration_token: tokenMap.get(t.id) || null,
        }));
      }
    } catch {
      // registration_token column might not exist yet - ignore
    }

    res.json(result);
  } catch (err) {
    console.error('Admin list tenants error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── GET /api/v1/admin/tenants/:id ──────────────────────────────
router.get('/admin/tenants/:id', authenticate, requireRole('super_admin'), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const tenant = await queryOne<TenantRow>('SELECT * FROM tenants WHERE id = ?', [id]);
    if (!tenant) {
      res.status(404).json({ error: 'Tenant not found' });
      return;
    }

    const stats = await queryOne<RowDataPacket>(
      `SELECT
        (SELECT COUNT(*) FROM users WHERE tenant_id = ?) AS user_count,
        (SELECT COUNT(*) FROM devices WHERE tenant_id = ?) AS device_count,
        (SELECT COUNT(*) FROM media WHERE tenant_id = ?) AS media_count,
        (SELECT COUNT(*) FROM playlists WHERE tenant_id = ?) AS playlist_count,
        (SELECT COUNT(*) FROM schedules WHERE tenant_id = ?) AS schedule_count,
        (SELECT COUNT(*) FROM layouts WHERE tenant_id = ?) AS layout_count`,
      [id, id, id, id, id, id]
    );

    const users = await query<RowDataPacket[]>(
      'SELECT id, email, full_name, role, status, created_at FROM users WHERE tenant_id = ? ORDER BY created_at DESC LIMIT 10',
      [id]
    );

    res.json({ tenant, stats, users });
  } catch (err) {
    console.error('Admin get tenant error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── POST /api/v1/admin/tenants ─────────────────────────────────
router.post('/admin/tenants', authenticate, requireRole('super_admin'), async (req: Request, res: Response) => {
  try {
    const { name, slug, contact_email, max_devices, max_storage_mb } = req.body;

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
      res.status(409).json({ error: 'Slug already exists' });
      return;
    }

    // Generate registration token
    const registrationToken = crypto.randomBytes(32).toString('hex');

    // Try to insert with registration_token column
    let result;
    try {
      result = await execute(
        `INSERT INTO tenants (name, slug, contact_email, max_devices, max_storage_mb, registration_token)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [name, slug, contact_email || null, max_devices || 5, max_storage_mb || 1024, registrationToken]
      );
    } catch (insertErr: any) {
      // If registration_token column doesn't exist, insert without it
      if (insertErr.message?.includes('registration_token')) {
        result = await execute(
          `INSERT INTO tenants (name, slug, contact_email, max_devices, max_storage_mb)
           VALUES (?, ?, ?, ?, ?)`,
          [name, slug, contact_email || null, max_devices || 5, max_storage_mb || 1024]
        );
      } else {
        throw insertErr;
      }
    }

    const tenantId = result.insertId;
    const tenant = await queryOne<TenantRow>('SELECT * FROM tenants WHERE id = ?', [tenantId]);

    // Create tenant admin user
    const adminEmail = contact_email || `admin@${slug}.com`;
    const adminPassword = 'password123'; // Default password, user should change
    const passwordHash = await bcrypt.hash(adminPassword, 10);

    await execute(
      `INSERT INTO users (tenant_id, email, password_hash, full_name, role, status)
       VALUES (?, ?, ?, ?, 'admin', 'ACTIVE')`,
      [tenantId, adminEmail, passwordHash, `${name} Admin`]
    );

    res.status(201).json({
      tenant,
      registration_token: registrationToken,
      admin_user: {
        email: adminEmail,
        password: adminPassword,
      },
    });
  } catch (err) {
    console.error('Admin create tenant error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── PUT /api/v1/admin/tenants/:id ──────────────────────────────
router.put('/admin/tenants/:id', authenticate, requireRole('super_admin'), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name, slug, contact_email, max_devices, max_storage_mb, status } = req.body;

    const existing = await queryOne('SELECT id FROM tenants WHERE id = ?', [id]);
    if (!existing) {
      res.status(404).json({ error: 'Tenant not found' });
      return;
    }

    await execute(
      `UPDATE tenants SET
        name = COALESCE(?, name),
        slug = COALESCE(?, slug),
        contact_email = COALESCE(?, contact_email),
        max_devices = COALESCE(?, max_devices),
        max_storage_mb = COALESCE(?, max_storage_mb),
        status = COALESCE(?, status)
       WHERE id = ?`,
      [name, slug, contact_email, max_devices, max_storage_mb, status, id]
    );

    const tenant = await queryOne<TenantRow>('SELECT * FROM tenants WHERE id = ?', [id]);
    res.json({ tenant });
  } catch (err) {
    console.error('Admin update tenant error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── DELETE /api/v1/admin/tenants/:id ───────────────────────────
router.delete('/admin/tenants/:id', authenticate, requireRole('super_admin'), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const existing = await queryOne('SELECT id FROM tenants WHERE id = ?', [id]);
    if (!existing) {
      res.status(404).json({ error: 'Tenant not found' });
      return;
    }

    await execute("UPDATE tenants SET status = 'INACTIVE' WHERE id = ?", [id]);
    res.json({ message: 'Tenant deactivated' });
  } catch (err) {
    console.error('Admin delete tenant error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── POST /api/v1/admin/tenants/:id/regenerate-token ────────────
router.post('/admin/tenants/:id/regenerate-token', authenticate, requireRole('super_admin'), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const existing = await queryOne('SELECT id FROM tenants WHERE id = ?', [id]);
    if (!existing) {
      res.status(404).json({ error: 'Tenant not found' });
      return;
    }

    const newToken = crypto.randomBytes(32).toString('hex');
    await execute('UPDATE tenants SET registration_token = ? WHERE id = ?', [newToken, id]);

    res.json({ registration_token: newToken });
  } catch (err) {
    console.error('Admin regenerate token error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
