import { Router, Request, Response } from 'express';
import bcrypt from 'bcrypt';
import { query, queryOne, execute, paginatedQuery } from '../../services/query';
import { authenticate } from '../../middleware/auth.middleware';
import { requireRole } from '../../middleware/permission.middleware';
import { RowDataPacket } from 'mysql2';

const router = Router();

interface UserRow extends RowDataPacket {
  id: number;
  tenant_id: number;
  email: string;
  full_name: string;
  role: string;
  avatar_url: string | null;
  is_active: boolean;
  last_login_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

// ─── GET /api/v1/users ──────────────────────────────────────────
router.get('/users', authenticate, requireRole('super_admin', 'admin'), async (req: Request, res: Response) => {
  try {
    const page = Number(req.query.page) || 1;
    const limit = Math.min(Number(req.query.limit) || 20, 100);
    const search = (req.query.search as string) || '';
    const tenantId = req.user!.tenantId;

    const whereClause = 'WHERE tenant_id = ?' + (search ? ' AND (email LIKE ? OR full_name LIKE ?)' : '');
    const params: unknown[] = [tenantId];
    if (search) {
      params.push(`%${search}%`, `%${search}%`);
    }

    const result = await paginatedQuery<UserRow>(
      `SELECT id, tenant_id, email, full_name, role, avatar_url, is_active, last_login_at, created_at, updated_at
       FROM users ${whereClause}
       ORDER BY created_at DESC`,
      `SELECT COUNT(*) AS total FROM users ${whereClause}`,
      params,
      page,
      limit
    );

    res.json(result);
  } catch (err) {
    console.error('List users error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── GET /api/v1/users/:id ──────────────────────────────────────
router.get('/users/:id', authenticate, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const user = req.user!;

    // Users can view themselves; admins can view anyone in their tenant
    if (user.role !== 'super_admin' && user.role !== 'admin' && user.id !== Number(id)) {
      res.status(403).json({ error: 'Access denied' });
      return;
    }

    const target = await queryOne<UserRow>(
      `SELECT id, tenant_id, email, full_name, role, avatar_url, is_active, last_login_at, created_at, updated_at
       FROM users WHERE id = ? AND tenant_id = ?`,
      [id, user.tenantId]
    );

    if (!target) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    res.json({ user: target });
  } catch (err) {
    console.error('Get user error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── POST /api/v1/users ─────────────────────────────────────────
router.post('/users', authenticate, requireRole('super_admin', 'admin'), async (req: Request, res: Response) => {
  try {
    const { email, password, full_name, role } = req.body;
    const tenantId = req.user!.tenantId;

    if (!email || !password || !full_name) {
      res.status(400).json({ error: 'email, password, and full_name are required' });
      return;
    }

    const existing = await queryOne('SELECT id FROM users WHERE email = ?', [email]);
    if (existing) {
      res.status(409).json({ error: 'Email already registered' });
      return;
    }

    // Only admins can create admin users
    if (role === 'super_admin' && req.user!.role !== 'super_admin') {
      res.status(403).json({ error: 'Cannot create super_admin users' });
      return;
    }

    const password_hash = await bcrypt.hash(password, 12);
    const userRole = role || 'viewer';

    const result = await execute(
      `INSERT INTO users (tenant_id, email, password_hash, full_name, role)
       VALUES (?, ?, ?, ?, ?)`,
      [tenantId, email, password_hash, full_name, userRole]
    );

    const newUser = await queryOne<UserRow>(
      `SELECT id, tenant_id, email, full_name, role, avatar_url, is_active, created_at, updated_at
       FROM users WHERE id = ?`,
      [result.insertId]
    );

    res.status(201).json({ user: newUser });
  } catch (err) {
    console.error('Create user error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── PUT /api/v1/users/:id ──────────────────────────────────────
router.put('/users/:id', authenticate, requireRole('super_admin', 'admin'), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const tenantId = req.user!.tenantId;
    const { full_name, role, is_active, avatar_url } = req.body;

    const existing = await queryOne<UserRow>(
      'SELECT id FROM users WHERE id = ? AND tenant_id = ?',
      [id, tenantId]
    );

    if (!existing) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    await execute(
      `UPDATE users SET
        full_name = COALESCE(?, full_name),
        role = COALESCE(?, role),
        is_active = COALESCE(?, is_active),
        avatar_url = COALESCE(?, avatar_url)
       WHERE id = ? AND tenant_id = ?`,
      [full_name, role, is_active, avatar_url, id, tenantId]
    );

    const user = await queryOne<UserRow>(
      `SELECT id, tenant_id, email, full_name, role, avatar_url, is_active, created_at, updated_at
       FROM users WHERE id = ?`,
      [id]
    );

    res.json({ user });
  } catch (err) {
    console.error('Update user error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── DELETE /api/v1/users/:id ───────────────────────────────────
router.delete('/users/:id', authenticate, requireRole('super_admin', 'admin'), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const tenantId = req.user!.tenantId;

    // Prevent self-deletion
    if (req.user!.id === Number(id)) {
      res.status(400).json({ error: 'Cannot delete your own account' });
      return;
    }

    const existing = await queryOne(
      'SELECT id FROM users WHERE id = ? AND tenant_id = ?',
      [id, tenantId]
    );

    if (!existing) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    // Soft delete
    await execute('UPDATE users SET is_active = FALSE WHERE id = ? AND tenant_id = ?', [id, tenantId]);

    res.json({ message: 'User deactivated' });
  } catch (err) {
    console.error('Delete user error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── PUT /api/v1/users/:id/password ─────────────────────────────
router.put('/users/:id/password', authenticate, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { current_password, new_password } = req.body;
    const user = req.user!;

    // Users can change their own password; admins can change anyone's
    if (user.id !== Number(id) && user.role !== 'admin' && user.role !== 'super_admin') {
      res.status(403).json({ error: 'Access denied' });
      return;
    }

    if (!new_password || new_password.length < 8) {
      res.status(400).json({ error: 'new_password must be at least 8 characters' });
      return;
    }

    const target = await queryOne<UserRow>(
      'SELECT id, password_hash FROM users WHERE id = ? AND tenant_id = ?',
      [id, user.tenantId]
    );

    if (!target) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    // If changing own password, verify current password
    if (user.id === Number(id)) {
      if (!current_password) {
        res.status(400).json({ error: 'current_password is required' });
        return;
      }
      const valid = await bcrypt.compare(current_password, target.password_hash);
      if (!valid) {
        res.status(401).json({ error: 'Current password is incorrect' });
        return;
      }
    }

    const password_hash = await bcrypt.hash(new_password, 12);
    await execute('UPDATE users SET password_hash = ? WHERE id = ?', [password_hash, id]);

    res.json({ message: 'Password updated' });
  } catch (err) {
    console.error('Change password error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
