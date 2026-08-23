import { Router, Request, Response } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { config } from '../../config';
import { query, queryOne, execute } from '../../services/query';
import { authenticate, JwtPayload } from '../../middleware/auth.middleware';
import { RowDataPacket } from 'mysql2';

const router = Router();

interface UserRow extends RowDataPacket {
  id: number;
  tenant_id: number;
  email: string;
  password_hash: string;
  full_name: string;
  role: string;
  is_active: boolean;
}

// ─── POST /api/v1/auth/register ─────────────────────────────────
router.post('/auth/register', async (req: Request, res: Response) => {
  try {
    const { email, password, full_name, tenant_id } = req.body;

    if (!email || !password || !full_name || !tenant_id) {
      res.status(400).json({ error: 'email, password, full_name, and tenant_id are required' });
      return;
    }

    // Check if user already exists
    const existing = await queryOne<UserRow>(
      'SELECT id FROM users WHERE email = ?',
      [email]
    );
    if (existing) {
      res.status(409).json({ error: 'Email already registered' });
      return;
    }

    // Verify tenant exists and is active
    const tenant = await queryOne(
      "SELECT id FROM tenants WHERE id = ? AND status = 'ACTIVE'",
      [tenant_id]
    );
    if (!tenant) {
      res.status(400).json({ error: 'Invalid or inactive tenant' });
      return;
    }

    // Check tenant user limit
    const tenantRow = await queryOne<RowDataPacket>(
      'SELECT max_users FROM tenants WHERE id = ?',
      [tenant_id]
    );
    const userCount = await queryOne<RowDataPacket>(
      'SELECT COUNT(*) AS cnt FROM users WHERE tenant_id = ?',
      [tenant_id]
    );
    if (userCount && (userCount as any).cnt >= (tenantRow as any).max_users) {
      res.status(400).json({ error: 'Tenant user limit reached' });
      return;
    }

    const password_hash = await bcrypt.hash(password, 12);

    const result = await execute(
      `INSERT INTO users (tenant_id, email, password_hash, full_name, role)
       VALUES (?, ?, ?, ?, 'viewer')`,
      [tenant_id, email, password_hash, full_name]
    );

    const userId = result.insertId;

    const tokenPayload: JwtPayload = {
      id: userId,
      tenantId: tenant_id,
      email,
      role: 'viewer',
    };

    const access_token = jwt.sign(tokenPayload, config.jwt.secret, {
      expiresIn: config.jwt.expiresIn as any,
    });

    const refresh_token = jwt.sign(
      { ...tokenPayload, type: 'refresh' },
      config.jwt.secret,
      { expiresIn: '30d' }
    );

    res.status(201).json({
      user: { id: userId, email, full_name, role: 'viewer', tenant_id },
      access_token,
      refresh_token,
    });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── POST /api/v1/auth/login ────────────────────────────────────
router.post('/auth/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      res.status(400).json({ error: 'email and password are required' });
      return;
    }

    const user = await queryOne<UserRow>(
      'SELECT * FROM users WHERE email = ? AND is_active = TRUE',
      [email]
    );

    if (!user) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    const validPassword = await bcrypt.compare(password, user.password_hash);
    if (!validPassword) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    // Update last_login_at
    await execute('UPDATE users SET last_login_at = NOW() WHERE id = ?', [user.id]);

    const tokenPayload: JwtPayload = {
      id: user.id,
      tenantId: user.tenant_id,
      email: user.email,
      role: user.role,
    };

    const access_token = jwt.sign(tokenPayload, config.jwt.secret, {
      expiresIn: config.jwt.expiresIn as any,
    });

    const refresh_token = jwt.sign(
      { ...tokenPayload, type: 'refresh' },
      config.jwt.secret,
      { expiresIn: '30d' }
    );

    res.json({
      user: {
        id: user.id,
        email: user.email,
        full_name: user.full_name,
        role: user.role,
        tenant_id: user.tenant_id,
      },
      access_token,
      refresh_token,
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── POST /api/v1/auth/refresh ──────────────────────────────────
router.post('/auth/refresh', async (req: Request, res: Response) => {
  try {
    const { refresh_token } = req.body;

    if (!refresh_token) {
      res.status(400).json({ error: 'refresh_token is required' });
      return;
    }

    let decoded: JwtPayload & { type?: string };
    try {
      decoded = jwt.verify(refresh_token, config.jwt.secret) as JwtPayload & {
        type?: string;
      };
    } catch {
      res.status(401).json({ error: 'Invalid or expired refresh token' });
      return;
    }

    if (decoded.type !== 'refresh') {
      res.status(401).json({ error: 'Invalid token type' });
      return;
    }

    // Verify user still exists and is active
    const user = await queryOne<UserRow>(
      'SELECT id, tenant_id, email, role, is_active FROM users WHERE id = ?',
      [decoded.id]
    );

    if (!user || !user.is_active) {
      res.status(401).json({ error: 'User not found or deactivated' });
      return;
    }

    const tokenPayload: JwtPayload = {
      id: user.id,
      tenantId: user.tenant_id,
      email: user.email,
      role: user.role,
    };

    const newAccessToken = jwt.sign(tokenPayload, config.jwt.secret, {
      expiresIn: config.jwt.expiresIn as any,
    });

    const newRefreshToken = jwt.sign(
      { ...tokenPayload, type: 'refresh' },
      config.jwt.secret,
      { expiresIn: '30d' }
    );

    res.json({
      access_token: newAccessToken,
      refresh_token: newRefreshToken,
    });
  } catch (err) {
    console.error('Refresh error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── GET /api/v1/auth/me ────────────────────────────────────────
router.get('/auth/me', authenticate, async (req: Request, res: Response) => {
  try {
    const user = await queryOne<UserRow>(
      'SELECT id, tenant_id, email, full_name, role, avatar_url, created_at FROM users WHERE id = ?',
      [req.user!.id]
    );

    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    res.json({ user });
  } catch (err) {
    console.error('Me error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
