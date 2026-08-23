import { Router, Request, Response } from 'express';
import bcrypt from 'bcrypt';
import { query, queryOne, execute, paginatedQuery } from '../../services/query';
import { authenticate } from '../../middleware/auth.middleware';
import { requireRole } from '../../middleware/permission.middleware';
import { RowDataPacket } from 'mysql2';
import crypto from 'crypto';

const router = Router();

// ─── GET /api/v1/tenant/dashboard ──────────────────────────────
// Tenant admin dashboard stats (limited to own tenant)
router.get('/tenant/dashboard', authenticate, requireRole('admin', 'editor', 'viewer'), async (req: Request, res: Response) => {
  try {
    const tenantId = req.user!.tenantId;

    if (!tenantId) {
      res.status(404).json({ error: 'User tidak memiliki tenant' });
      return;
    }

    const userCount = await queryOne<RowDataPacket>(
      'SELECT COUNT(*) AS total FROM users WHERE tenant_id = ?',
      [tenantId]
    );

    const deviceCount = await queryOne<RowDataPacket>(
      `SELECT COUNT(*) AS total, COUNT(CASE WHEN status = 'ONLINE' THEN 1 END) AS online FROM devices WHERE tenant_id = ?`,
      [tenantId]
    );

    const mediaCount = await queryOne<RowDataPacket>(
      'SELECT COUNT(*) AS total, COALESCE(SUM(file_size), 0) AS total_size FROM media WHERE tenant_id = ?',
      [tenantId]
    );

    const playlistCount = await queryOne<RowDataPacket>(
      'SELECT COUNT(*) AS total FROM playlists WHERE tenant_id = ?',
      [tenantId]
    );

    const scheduleCount = await queryOne<RowDataPacket>(
      'SELECT COUNT(*) AS total FROM schedules WHERE tenant_id = ?',
      [tenantId]
    );

    res.json({
      users: { total: userCount?.total ?? 0 },
      devices: { total: deviceCount?.total ?? 0, online: deviceCount?.online ?? 0 },
      media: { total: mediaCount?.total ?? 0, total_size: mediaCount?.total_size ?? 0 },
      playlists: { total: playlistCount?.total ?? 0 },
      schedules: { total: scheduleCount?.total ?? 0 },
    });
  } catch (err) {
    console.error('Tenant dashboard error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── GET /api/v1/tenant/users ──────────────────────────────────
// List users for current tenant
router.get('/tenant/users', authenticate, requireRole('admin'), async (req: Request, res: Response) => {
  try {
    const tenantId = req.user!.tenantId;
    const page = Number(req.query.page) || 1;
    const limit = Math.min(Number(req.query.limit) || 20, 100);

    const result = await paginatedQuery<RowDataPacket>(
      `SELECT id, email, full_name, role, status, created_at, last_login_at
       FROM users WHERE tenant_id = ?
       ORDER BY created_at DESC`,
      `SELECT COUNT(*) AS total FROM users WHERE tenant_id = ?`,
      [tenantId],
      page,
      limit
    );

    res.json(result);
  } catch (err) {
    console.error('Tenant list users error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── POST /api/v1/tenant/users ─────────────────────────────────
// Create user for current tenant
router.post('/tenant/users', authenticate, requireRole('admin'), async (req: Request, res: Response) => {
  try {
    const tenantId = req.user!.tenantId;
    const { email, password, full_name, role } = req.body;

    if (!email || !password || !full_name) {
      res.status(400).json({ error: 'email, password, and full_name are required' });
      return;
    }

    // Check email uniqueness
    const existing = await queryOne('SELECT id FROM users WHERE email = ?', [email]);
    if (existing) {
      res.status(409).json({ error: 'Email sudah terdaftar' });
      return;
    }

    // Only admin can create admin/editor, not super_admin
    const allowedRoles = ['admin', 'editor', 'viewer'];
    const userRole = allowedRoles.includes(role) ? role : 'viewer';

    const passwordHash = await bcrypt.hash(password, 10);

    const result = await execute(
      `INSERT INTO users (tenant_id, email, password_hash, full_name, role, status)
       VALUES (?, ?, ?, ?, ?, 'ACTIVE')`,
      [tenantId, email, passwordHash, full_name, userRole]
    );

    const user = await queryOne(
      'SELECT id, email, full_name, role, status, created_at FROM users WHERE id = ?',
      [result.insertId]
    );

    res.status(201).json({ user });
  } catch (err) {
    console.error('Tenant create user error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── DELETE /api/v1/tenant/users/:id ───────────────────────────
// Deactivate user in current tenant
router.delete('/tenant/users/:id', authenticate, requireRole('admin'), async (req: Request, res: Response) => {
  try {
    const tenantId = req.user!.tenantId;
    const { id } = req.params;

    // Can't delete yourself
    if (Number(id) === req.user!.id) {
      res.status(400).json({ error: 'Tidak bisa menonaktifkan akun sendiri' });
      return;
    }

    const existing = await queryOne(
      'SELECT id FROM users WHERE id = ? AND tenant_id = ?',
      [id, tenantId]
    );

    if (!existing) {
      res.status(404).json({ error: 'User tidak ditemukan' });
      return;
    }

    await execute('UPDATE users SET status = \'INACTIVE\' WHERE id = ? AND tenant_id = ?', [id, tenantId]);
    res.json({ message: 'User berhasil dinonaktifkan' });
  } catch (err) {
    console.error('Tenant delete user error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── GET /api/v1/tenant/devices ─────────────────────────────────
// List devices for current tenant
router.get('/tenant/devices', authenticate, requireRole('admin', 'editor'), async (req: Request, res: Response) => {
  try {
    const tenantId = req.user!.tenantId;
    const page = Number(req.query.page) || 1;
    const limit = Math.min(Number(req.query.limit) || 20, 100);

    const result = await paginatedQuery<RowDataPacket>(
      `SELECT id, device_uuid, name, status, location, last_seen_at, player_version, created_at
       FROM devices WHERE tenant_id = ?
       ORDER BY last_seen_at DESC, created_at DESC`,
      `SELECT COUNT(*) AS total FROM devices WHERE tenant_id = ?`,
      [tenantId],
      page,
      limit
    );

    res.json(result);
  } catch (err) {
    console.error('Tenant list devices error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── GET /api/v1/tenant/token ───────────────────────────────────
// Get registration token for current tenant
router.get('/tenant/token', authenticate, requireRole('admin'), async (req: Request, res: Response) => {
  try {
    const tenantId = req.user!.tenantId;

    const tenant = await queryOne<RowDataPacket>(
      'SELECT id, name, registration_token FROM tenants WHERE id = ?',
      [tenantId]
    );

    if (!tenant) {
      res.status(404).json({ error: 'Tenant tidak ditemukan' });
      return;
    }

    res.json({ tenant });
  } catch (err) {
    console.error('Tenant get token error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── POST /api/v1/tenant/devices/:id/command ────────────────────
// Send command to device in current tenant
router.post('/tenant/devices/:id/command', authenticate, requireRole('admin'), async (req: Request, res: Response) => {
  try {
    const tenantId = req.user!.tenantId;
    const { id } = req.params;
    const { command_type } = req.body;

    const validCommands = ['RELOAD', 'SCREENSHOT', 'REBOOT'];
    if (!command_type || !validCommands.includes(command_type)) {
      res.status(400).json({ error: `command_type must be one of: ${validCommands.join(', ')}` });
      return;
    }

    const device = await queryOne(
      'SELECT id FROM devices WHERE id = ? AND tenant_id = ?',
      [id, tenantId]
    );

    if (!device) {
      res.status(404).json({ error: 'Device tidak ditemukan' });
      return;
    }

    const result = await execute(
      `INSERT INTO device_commands (tenant_id, device_id, command_type, issued_by)
       VALUES (?, ?, ?, ?)`,
      [tenantId, id, command_type, req.user!.id]
    );

    const command = await queryOne(
      'SELECT * FROM device_commands WHERE id = ?',
      [result.insertId]
    );

    res.status(201).json({ command });
  } catch (err) {
    console.error('Tenant send command error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
