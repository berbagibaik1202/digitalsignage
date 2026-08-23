import { Server as HttpServer } from 'http';
import { Server, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { queryOne } from '../services/query';
import { RowDataPacket } from 'mysql2';

interface DeviceStatusRow extends RowDataPacket {
  id: number;
  tenant_id: number;
  device_uuid: string;
  name: string;
  status: string;
  last_seen_at: Date | null;
}

let io: Server;

export function initWebSocket(httpServer: HttpServer): Server {
  io = new Server(httpServer, {
    cors: {
      origin: process.env.FRONTEND_URL || 'http://localhost:5173',
      credentials: true,
    },
    path: '/ws',
  });

  // Auth middleware for socket connections
  io.use(async (socket: Socket, next) => {
    try {
      const token = socket.handshake.auth?.token || socket.handshake.query?.token;
      if (!token || typeof token !== 'string') {
        next(new Error('Authentication required'));
        return;
      }

      const decoded = jwt.verify(token, config.jwt.secret) as { userId: number; tenantId: number };

      // Verify user exists and is active
      const user = await queryOne<RowDataPacket>(
        'SELECT id, tenant_id, email, full_name, role FROM users WHERE id = ? AND tenant_id = ? AND status = ?',
        [decoded.userId, decoded.tenantId, 'ACTIVE']
      );

      if (!user) {
        next(new Error('User not found'));
        return;
      }

      (socket as any).user = {
        id: user.id,
        tenantId: user.tenant_id,
        email: user.email,
        fullName: user.full_name,
        role: user.role,
      };

      next();
    } catch {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', (socket: Socket) => {
    const user = (socket as any).user;

    // Auto-join tenant room
    const room = `tenant:${user.tenantId}`;
    socket.join(room);

    console.log(`[WS] User ${user.email} connected (room: ${room})`);

    // Handle join specific device room
    socket.on('subscribe:device', async (deviceUuid: string) => {
      const device = await queryOne<DeviceStatusRow>(
        'SELECT * FROM devices WHERE device_uuid = ? AND tenant_id = ?',
        [deviceUuid, user.tenantId]
      );
      if (device) {
        socket.join(`device:${device.id}`);
        console.log(`[WS] User ${user.email} subscribed to device ${deviceUuid}`);
      }
    });

    // Handle unsubscribe from device room
    socket.on('unsubscribe:device', () => {
      socket.rooms.forEach((roomName) => {
        if (roomName.startsWith('device:')) {
          socket.leave(roomName);
        }
      });
    });

    socket.on('disconnect', (reason) => {
      console.log(`[WS] User ${user.email} disconnected: ${reason}`);
    });
  });

  return io;
}

export function getIO(): Server {
  if (!io) throw new Error('Socket.IO not initialized');
  return io;
}

// Helper: Broadcast device status change to tenant
export function broadcastDeviceStatus(tenantId: number, deviceUuid: string, status: string, extra?: Record<string, unknown>) {
  if (!io) return;
  io.to(`tenant:${tenantId}`).emit('device:status', {
    device_uuid: deviceUuid,
    status,
    timestamp: new Date().toISOString(),
    ...extra,
  });
}

// Helper: Broadcast new command to device
export function broadcastCommand(deviceId: number, command: Record<string, unknown>) {
  if (!io) return;
  io.to(`device:${deviceId}`).emit('command:received', command);
}

// Helper: Broadcast playback log to dashboard
export function broadcastPlaybackLog(tenantId: number, log: Record<string, unknown>) {
  if (!io) return;
  io.to(`tenant:${tenantId}`).emit('playback:log', log);
}
