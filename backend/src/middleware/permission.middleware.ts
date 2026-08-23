import { Request, Response, NextFunction } from 'express';

type Role = 'super_admin' | 'admin' | 'editor' | 'viewer' | 'device';

/**
 * Role-based access control middleware.
 * Must be used after the authenticate middleware.
 * 
 * Usage:
 *   router.get('/admin-only', authenticate, requireRole('admin'), handler)
 *   router.get('/any-editor', authenticate, requireRole('admin', 'editor'), handler)
 */
export function requireRole(...allowedRoles: Role[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    if (!allowedRoles.includes(req.user.role as Role)) {
      res.status(403).json({ error: 'Insufficient permissions' });
      return;
    }

    next();
  };
}
