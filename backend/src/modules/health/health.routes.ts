import { Router, Request, Response } from 'express';
import { db } from '../../database/mysql';

const router = Router();

router.get('/health', async (_req: Request, res: Response) => {
  let conn;
  try {
    conn = await db.getConnection();
    await conn.ping();
    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      database: 'connected',
    });
  } catch (err) {
    res.status(503).json({
      status: 'error',
      timestamp: new Date().toISOString(),
      database: 'disconnected',
    });
  } finally {
    if (conn) conn.release();
  }
});

export default router;
