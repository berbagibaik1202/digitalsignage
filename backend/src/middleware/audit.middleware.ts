import { Request, Response, NextFunction } from 'express';
import { execute } from '../services/query';

// Map of route patterns to human-readable action names
const ACTION_MAP: Record<string, string> = {
  'POST /api/v1/auth/register': 'USER_REGISTER',
  'POST /api/v1/auth/login': 'USER_LOGIN',
  'POST /api/v1/auth/refresh': 'TOKEN_REFRESH',
  'POST /api/v1/tenants': 'TENANT_CREATE',
  'PUT /api/v1/tenants': 'TENANT_UPDATE',
  'DELETE /api/v1/tenants': 'TENANT_DELETE',
  'POST /api/v1/users': 'USER_CREATE',
  'PUT /api/v1/users': 'USER_UPDATE',
  'DELETE /api/v1/users': 'USER_DELETE',
  'POST /api/v1/devices/register': 'DEVICE_REGISTER',
  'POST /api/v1/devices/heartbeat': 'DEVICE_HEARTBEAT',
  'PUT /api/v1/devices': 'DEVICE_UPDATE',
  'DELETE /api/v1/devices': 'DEVICE_DELETE',
  'POST /api/v1/devices': 'DEVICE_COMMAND_SEND',
  'POST /api/v1/media/upload': 'MEDIA_UPLOAD',
  'DELETE /api/v1/media': 'MEDIA_DELETE',
  'POST /api/v1/playlists': 'PLAYLIST_CREATE',
  'PUT /api/v1/playlists': 'PLAYLIST_UPDATE',
  'DELETE /api/v1/playlists': 'PLAYLIST_DELETE',
  'POST /api/v1/schedules': 'SCHEDULE_CREATE',
  'PUT /api/v1/schedules': 'SCHEDULE_UPDATE',
  'DELETE /api/v1/schedules': 'SCHEDULE_DELETE',
  'POST /api/v1/layouts': 'LAYOUT_CREATE',
  'PUT /api/v1/layouts': 'LAYOUT_UPDATE',
  'DELETE /api/v1/layouts': 'LAYOUT_DELETE',
  'POST /api/v1/subscriptions': 'SUBSCRIPTION_CREATE',
  'PUT /api/v1/subscriptions': 'SUBSCRIPTION_UPDATE',
  'DELETE /api/v1/subscriptions': 'SUBSCRIPTION_DELETE',
  'POST /api/v1/admin/tenants': 'ADMIN_TENANT_CREATE',
  'PUT /api/v1/admin/tenants': 'ADMIN_TENANT_UPDATE',
  'DELETE /api/v1/admin/tenants': 'ADMIN_TENANT_DELETE',
  'POST /api/v1/commands': 'COMMAND_SEND',
  'DELETE /api/v1/commands': 'COMMAND_DELETE',
};

function getAction(method: string, path: string): string | null {
  // Match routes that start with /api/v1
  const normalizedPath = path.replace(/\/api\/v1/, '').split('?')[0];

  for (const [pattern, action] of Object.entries(ACTION_MAP)) {
    const [pMethod, pPath] = pattern.replace('/api/v1', '').split(' ');
    if (method === pMethod && normalizedPath.startsWith(pPath)) {
      return action;
    }
  }

  return null;
}

export function auditLog(req: Request, _res: Response, next: NextFunction): void {
  const method = req.method;

  // Only log write operations
  if (method !== 'POST' && method !== 'PUT' && method !== 'DELETE') {
    next();
    return;
  }

  const action = getAction(method, req.originalUrl);
  if (!action) {
    next();
    return;
  }

  const tenantId = req.user?.tenantId || null;
  const userId = req.user?.id || null;
  const ipAddress = req.ip || req.socket.remoteAddress || null;
  const userAgent = req.headers['user-agent'] || null;

  // Extract resource info from URL
  const resourceId = extractResourceId(req);

  // Log asynchronously — don't block the request
  execute(
    `INSERT INTO audit_logs (tenant_id, user_id, log_action, entity_type, entity_id, ip_address, user_agent)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      tenantId,
      userId,
      action,
      extractResourceType(req.originalUrl),
      resourceId,
      ipAddress,
      userAgent,
    ]
  ).catch((err) => {
    console.error('Audit log failed:', err);
  });

  next();
}

function extractResourceType(path: string): string {
  const parts = path.split('/').filter(Boolean);
  // Find the resource after 'v1'
  const v1Index = parts.indexOf('v1');
  if (v1Index >= 0 && parts[v1Index + 1]) {
    return parts[v1Index + 1].replace(/-/g, '_');
  }
  return 'unknown';
}

function extractResourceId(req: Request): string | null {
  // Try to extract ID from params
  if (req.params.id) return String(req.params.id);

  // Try to extract from body
  if (req.body?.id) return String(req.body.id);

  // Try from inserted ID (will be set after response)
  return null;
}
