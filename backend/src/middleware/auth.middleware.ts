import { Request, Response, NextFunction } from 'express';
import { config } from '../config';
import jwt from 'jsonwebtoken';

// Extend Express Request
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: number;
        tenantId: number;
        email: string;
        role: string;
      };
    }
  }
}

export interface JwtPayload {
  id: number;
  tenantId: number;
  email: string;
  role: string;
}

export function authenticate(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing or invalid authorization header' });
    return;
  }

  const token = authHeader.substring(7);

  try {
    const decoded = jwt.verify(token, config.jwt.secret) as JwtPayload;
    req.user = decoded;
    next();
  } catch (err) {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}
