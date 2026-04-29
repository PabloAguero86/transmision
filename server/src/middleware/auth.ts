/**
 * Authentication Middleware
 * Verifies Bearer token against active tokens
 */

import { Request, Response, NextFunction } from 'express';
import { activeTokens } from '../api/auth.routes';

export function authMiddleware(req: Request, res: Response, next: NextFunction): void {
  // Allow health checks and auth routes without token
  if (req.path === '/health' || req.path.startsWith('/health/')) {
    next();
    return;
  }
  if (req.path === '/auth' || req.path.startsWith('/auth/')) {
    next();
    return;
  }

  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Unauthorized — missing or invalid token' });
    return;
  }

  const token = authHeader.slice(7);

  if (!activeTokens.has(token)) {
    res.status(401).json({ error: 'Unauthorized — invalid token' });
    return;
  }

  next();
}
