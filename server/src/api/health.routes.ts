/**
 * Health Routes
 * Express routes for health endpoints
 */

import { Router, Request, Response } from 'express';
import { HealthService } from '../health/health.service';
import { maskToken } from '../config/atu.config';
import { config } from '../config/env';

export function createHealthRoutes(healthService: HealthService): Router {
  const router = Router();

  /**
   * GET /health — Overall health status
   */
  router.get('/', async (_req: Request, res: Response) => {
    try {
      const health = await healthService.getOverallHealth();
      res.json(health);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      res.status(500).json({
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        error: message,
      });
    }
  });

  /**
   * GET /health/gps-source — GPS source health
   */
  router.get('/gps-source', async (_req: Request, res: Response) => {
    try {
      const health = await healthService.checkGpsSource();
      res.json(health);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      res.status(500).json({
        status: 'down',
        error: message,
      });
    }
  });

  /**
   * GET /health/atu-websocket — ATU WebSocket client health
   */
  router.get('/atu-websocket', async (_req: Request, res: Response) => {
    try {
      const health = await healthService.checkAtuWebsocket();
      // Add masked token info to the response
      const maskedToken = maskToken(config.ws.token);
      res.json({
        ...health,
        token: maskedToken,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      res.status(500).json({
        status: 'down',
        error: message,
      });
    }
  });

  /**
   * GET /health/database — Database connection pool health
   */
  router.get('/database', async (_req: Request, res: Response) => {
    try {
      const health = await healthService.checkDatabase();
      res.json(health);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      res.status(500).json({
        status: 'down',
        error: message,
      });
    }
  });

  return router;
}