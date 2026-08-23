import { Request, Response, NextFunction } from 'express';

/**
 * Extracts tenant_id from the authenticated user.
 * Must be used after the authenticate middleware.
 * 
 * In multi-tenant mode, every database query should be scoped
 * to this tenant_id to ensure data isolation.
 */
export function extractTenant(req: Request, res: Response, next: NextFunction): void {
  if (!req.user) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }

  // tenant_id is attached by auth middleware from JWT
  // Downstream services use req.user.tenantId to scope queries
  next();
}
