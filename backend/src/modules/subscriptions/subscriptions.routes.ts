import { Router, Request, Response } from 'express';
import { query, queryOne, execute, paginatedQuery } from '../../services/query';
import { authenticate } from '../../middleware/auth.middleware';
import { requireRole } from '../../middleware/permission.middleware';
import { RowDataPacket } from 'mysql2';

const router = Router();

interface PlanRow extends RowDataPacket {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  price_cents: number;
  currency: string;
  billing_interval: string;
  max_devices: number;
  max_storage_mb: number;
  max_users: number;
  features: any;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

interface SubscriptionRow extends RowDataPacket {
  id: number;
  tenant_id: number;
  plan_id: number;
  status: string;
  trial_ends_at: string | null;
  current_period_start: string | null;
  current_period_end: string | null;
  cancelled_at: string | null;
  external_id: string | null;
  created_at: Date;
  updated_at: Date;
  plan_name?: string;
  tenant_name?: string;
}

// ─── GET /api/v1/subscription-plans ─────────────────────────────
router.get('/subscription-plans', authenticate, requireRole('super_admin'), async (req: Request, res: Response) => {
  try {
    const page = Number(req.query.page) || 1;
    const limit = Math.min(Number(req.query.limit) || 20, 100);
    const includeInactive = req.query.include_inactive === 'true';

    let whereClause = includeInactive ? '' : 'WHERE is_active = TRUE';

    const result = await paginatedQuery<PlanRow>(
      `SELECT * FROM subscription_plans ${whereClause} ORDER BY price_cents ASC`,
      `SELECT COUNT(*) AS total FROM subscription_plans ${whereClause}`,
      [],
      page,
      limit
    );

    res.json(result);
  } catch (err) {
    console.error('List plans error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── GET /api/v1/subscription-plans/:id ─────────────────────────
router.get('/subscription-plans/:id', authenticate, requireRole('super_admin'), async (req: Request, res: Response) => {
  try {
    const plan = await queryOne<PlanRow>('SELECT * FROM subscription_plans WHERE id = ?', [req.params.id]);
    if (!plan) {
      res.status(404).json({ error: 'Plan not found' });
      return;
    }
    res.json({ plan });
  } catch (err) {
    console.error('Get plan error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── POST /api/v1/subscription-plans ────────────────────────────
router.post('/subscription-plans', authenticate, requireRole('super_admin'), async (req: Request, res: Response) => {
  try {
    const { name, slug, description, price_cents, currency, billing_interval, max_devices, max_storage_mb, max_users, features } = req.body;

    if (!name || !slug) {
      res.status(400).json({ error: 'name and slug are required' });
      return;
    }

    // Check slug uniqueness
    const existing = await queryOne('SELECT id FROM subscription_plans WHERE slug = ?', [slug]);
    if (existing) {
      res.status(409).json({ error: 'Slug already exists' });
      return;
    }

    const result = await execute(
      `INSERT INTO subscription_plans (name, slug, description, price_cents, currency, billing_interval, max_devices, max_storage_mb, max_users, features)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        name, slug, description || null,
        price_cents || 0, currency || 'USD', billing_interval || 'monthly',
        max_devices || 5, max_storage_mb || 1024, max_users || 5,
        features ? JSON.stringify(features) : null
      ]
    );

    const plan = await queryOne<PlanRow>('SELECT * FROM subscription_plans WHERE id = ?', [result.insertId]);
    res.status(201).json({ plan });
  } catch (err) {
    console.error('Create plan error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── PUT /api/v1/subscription-plans/:id ─────────────────────────
router.put('/subscription-plans/:id', authenticate, requireRole('super_admin'), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name, slug, description, price_cents, currency, billing_interval, max_devices, max_storage_mb, max_users, features, is_active } = req.body;

    const existing = await queryOne('SELECT id FROM subscription_plans WHERE id = ?', [id]);
    if (!existing) {
      res.status(404).json({ error: 'Plan not found' });
      return;
    }

    await execute(
      `UPDATE subscription_plans SET
        name = COALESCE(?, name),
        slug = COALESCE(?, slug),
        description = COALESCE(?, description),
        price_cents = COALESCE(?, price_cents),
        currency = COALESCE(?, currency),
        billing_interval = COALESCE(?, billing_interval),
        max_devices = COALESCE(?, max_devices),
        max_storage_mb = COALESCE(?, max_storage_mb),
        max_users = COALESCE(?, max_users),
        features = COALESCE(?, features),
        is_active = COALESCE(?, is_active)
       WHERE id = ?`,
      [name, slug, description, price_cents, currency, billing_interval, max_devices, max_storage_mb, max_users, features ? JSON.stringify(features) : null, is_active, id]
    );

    const plan = await queryOne<PlanRow>('SELECT * FROM subscription_plans WHERE id = ?', [id]);
    res.json({ plan });
  } catch (err) {
    console.error('Update plan error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── DELETE /api/v1/subscription-plans/:id ──────────────────────
router.delete('/subscription-plans/:id', authenticate, requireRole('super_admin'), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const existing = await queryOne('SELECT id FROM subscription_plans WHERE id = ?', [id]);
    if (!existing) {
      res.status(404).json({ error: 'Plan not found' });
      return;
    }

    // Soft delete — deactivate
    await execute('UPDATE subscription_plans SET is_active = FALSE WHERE id = ?', [id]);
    res.json({ message: 'Plan deactivated' });
  } catch (err) {
    console.error('Delete plan error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── SUBSCRIPTIONS ──────────────────────────────────────────────

// GET /api/v1/subscriptions — list subscriptions for tenant
router.get('/subscriptions', authenticate, requireRole('super_admin', 'admin'), async (req: Request, res: Response) => {
  try {
    const page = Number(req.query.page) || 1;
    const limit = Math.min(Number(req.query.limit) || 20, 100);
    const tenantId = req.user!.tenantId;
    const isSuperAdmin = req.user!.role === 'super_admin';

    let whereClause = isSuperAdmin ? 'WHERE s.tenant_id = s.tenant_id' : 'WHERE s.tenant_id = ?';
    const params: unknown[] = isSuperAdmin ? [] : [tenantId];

    const result = await paginatedQuery<SubscriptionRow>(
      `SELECT s.*, sp.name AS plan_name, t.name AS tenant_name
       FROM subscriptions s
       LEFT JOIN subscription_plans sp ON s.plan_id = sp.id
       LEFT JOIN tenants t ON s.tenant_id = t.id
       ${whereClause}
       ORDER BY s.created_at DESC`,
      `SELECT COUNT(*) AS total FROM subscriptions s ${whereClause}`,
      params,
      page,
      limit
    );

    res.json(result);
  } catch (err) {
    console.error('List subscriptions error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/v1/subscriptions/current — get current subscription for tenant
router.get('/subscriptions/current', authenticate, requireRole('super_admin', 'admin', 'editor', 'viewer'), async (req: Request, res: Response) => {
  try {
    const tenantId = req.user!.tenantId;

    const sub = await queryOne<SubscriptionRow>(
      `SELECT s.*, sp.name AS plan_name, sp.price_cents, sp.max_devices, sp.max_storage_mb, sp.max_users
       FROM subscriptions s
       LEFT JOIN subscription_plans sp ON s.plan_id = sp.id
       WHERE s.tenant_id = ? AND s.status IN ('ACTIVE', 'TRIAL')
       ORDER BY s.created_at DESC LIMIT 1`,
      [tenantId]
    );

    res.json({ subscription: sub || null });
  } catch (err) {
    console.error('Get current subscription error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/v1/subscriptions — create subscription for tenant
router.post('/subscriptions', authenticate, requireRole('super_admin'), async (req: Request, res: Response) => {
  try {
    const { tenant_id, plan_id, status, trial_ends_at, current_period_start, current_period_end } = req.body;

    if (!tenant_id || !plan_id) {
      res.status(400).json({ error: 'tenant_id and plan_id are required' });
      return;
    }

    const tenant = await queryOne('SELECT id FROM tenants WHERE id = ?', [tenant_id]);
    if (!tenant) {
      res.status(404).json({ error: 'Tenant not found' });
      return;
    }

    const plan = await queryOne('SELECT id FROM subscription_plans WHERE id = ?', [plan_id]);
    if (!plan) {
      res.status(404).json({ error: 'Plan not found' });
      return;
    }

    const result = await execute(
      `INSERT INTO subscriptions (tenant_id, plan_id, status, trial_ends_at, current_period_start, current_period_end)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [tenant_id, plan_id, status || 'TRIAL', trial_ends_at || null, current_period_start || null, current_period_end || null]
    );

    const sub = await queryOne<SubscriptionRow>(
      `SELECT s.*, sp.name AS plan_name FROM subscriptions s LEFT JOIN subscription_plans sp ON s.plan_id = sp.id WHERE s.id = ?`,
      [result.insertId]
    );

    res.status(201).json({ subscription: sub });
  } catch (err) {
    console.error('Create subscription error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/v1/subscriptions/:id — update subscription
router.put('/subscriptions/:id', authenticate, requireRole('super_admin'), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { plan_id, status, trial_ends_at, current_period_start, current_period_end, cancelled_at } = req.body;

    const existing = await queryOne('SELECT id FROM subscriptions WHERE id = ?', [id]);
    if (!existing) {
      res.status(404).json({ error: 'Subscription not found' });
      return;
    }

    await execute(
      `UPDATE subscriptions SET
        plan_id = COALESCE(?, plan_id),
        status = COALESCE(?, status),
        trial_ends_at = COALESCE(?, trial_ends_at),
        current_period_start = COALESCE(?, current_period_start),
        current_period_end = COALESCE(?, current_period_end),
        cancelled_at = COALESCE(?, cancelled_at)
       WHERE id = ?`,
      [plan_id, status, trial_ends_at, current_period_start, current_period_end, cancelled_at, id]
    );

    const sub = await queryOne<SubscriptionRow>(
      `SELECT s.*, sp.name AS plan_name FROM subscriptions s LEFT JOIN subscription_plans sp ON s.plan_id = sp.id WHERE s.id = ?`,
      [id]
    );

    res.json({ subscription: sub });
  } catch (err) {
    console.error('Update subscription error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
