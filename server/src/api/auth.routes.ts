/**
 * Auth Routes — Hardcoded login for ATU Panel
 * Username: soldeoro, Password: soldeoro
 */

import { Router, Request, Response } from 'express';
import { nanoid } from 'nanoid';

const VALID_USERNAME = 'soldeoro';
const VALID_PASSWORD = 'soldeoro';

// Simple in-memory token store (resets on server restart)
const activeTokens = new Set<string>();

export function createAuthRoutes(): Router {
  const router = Router();

  router.post('/login', (req: Request, res: Response) => {
    const { username, password } = req.body;

    if (!username || !password) {
      res.status(400).json({ error: 'Username and password are required' });
      return;
    }

    if (username !== VALID_USERNAME || password !== VALID_PASSWORD) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    const token = nanoid(32);
    activeTokens.add(token);

    console.log(`[Auth] User '${username}' logged in successfully`);

    res.json({
      success: true,
      token,
      user: { username },
    });
  });

  router.post('/logout', (req: Request, res: Response) => {
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.slice(7);
      activeTokens.delete(token);
    }
    res.json({ success: true });
  });

  router.get('/verify', (req: Request, res: Response) => {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      res.status(401).json({ error: 'Missing token' });
      return;
    }

    const token = authHeader.slice(7);
    if (!activeTokens.has(token)) {
      res.status(401).json({ error: 'Invalid token' });
      return;
    }

    res.json({ valid: true, user: { username: VALID_USERNAME } });
  });

  return router;
}

export { activeTokens };
