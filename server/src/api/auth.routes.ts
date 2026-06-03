import { Router, Request, Response } from 'express';
import { nanoid } from 'nanoid';
import { config } from '../config/env';

const VALID_USERNAME = config.auth.username;
const VALID_PASSWORD = config.auth.password;

const activeTokens = new Set<string>();

export function createAuthRoutes(): Router {
  const router = Router();

  router.get('/brand', (_req: Request, res: Response) => {
    res.json({
      brand: config.auth.brand,
      company: config.auth.company,
    });
  });

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
      user: { username, brand: config.auth.brand, company: config.auth.company },
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

    res.json({ valid: true, user: { username: VALID_USERNAME, brand: config.auth.brand, company: config.auth.company } });
  });

  return router;
}

export { activeTokens };