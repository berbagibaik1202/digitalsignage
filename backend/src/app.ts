import express from 'express';
import cors from 'cors';
import healthRoutes from './modules/health/health.routes';
import authRoutes from './modules/auth/auth.routes';
import tenantRoutes from './modules/tenants/tenants.routes';
import userRoutes from './modules/users/users.routes';
import deviceRoutes from './modules/devices/devices.routes';
import deviceGroupRoutes from './modules/devices/device-groups.routes';
import mediaRoutes from './modules/media/media.routes';
import playlistRoutes from './modules/playlists/playlists.routes';
import scheduleRoutes from './modules/schedules/schedules.routes';
import layoutRoutes from './modules/layouts/layouts.routes';
import subscriptionRoutes from './modules/subscriptions/subscriptions.routes';
import monitoringRoutes from './modules/monitoring/monitoring.routes';
import playerRoutes from './modules/player/player.routes';
import adminRoutes from './modules/admin/admin.routes';
import commandRoutes from './modules/commands/commands.routes';
import tenantDashboardRoutes from './modules/tenant-dashboard/tenant-dashboard.routes';
import { auditLog } from './middleware/audit.middleware';

const app = express();

// Global middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(auditLog);

// API routes — all under /api/v1
app.use('/api/v1', healthRoutes);
app.use('/api/v1', authRoutes);
app.use('/api/v1', tenantRoutes);
app.use('/api/v1', userRoutes);
app.use('/api/v1', deviceRoutes);
app.use('/api/v1', deviceGroupRoutes);
app.use('/api/v1', mediaRoutes);
app.use('/api/v1', playlistRoutes);
app.use('/api/v1', scheduleRoutes);
app.use('/api/v1', layoutRoutes);
app.use('/api/v1', subscriptionRoutes);
app.use('/api/v1', monitoringRoutes);
app.use('/api/v1', playerRoutes);
app.use('/api/v1', adminRoutes);
app.use('/api/v1', commandRoutes);
app.use('/api/v1', tenantDashboardRoutes);

// 404 handler
app.use((_req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Global error handler
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

export default app;
