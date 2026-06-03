/**
 * ATU Status & Control Routes
 * Endpoints for ATU transmission status and configuration
 */

import { Router, Request, Response } from 'express';
import { TransmissionService } from '../transmissions/transmission-service';
import { TransmissionScheduler } from '../atu/scheduler';
import { maskToken } from '../config/atu.config';
import { config } from '../config/env';
import { TransmissionRepository } from '../transmissions/repository';

interface AtuStatusResponse {
  transmissionActive: boolean;
  mode: 'testing' | 'production';
  vehiclesActive: number;
  totalTransmissions: number;
  acceptedCount: number;
  rejectedCount: number;
  lastAtuResponse: {
    code: string;
    identifier: string;
    timestamp: string;
  } | null;
  lastTransmissionAt: string | null;
  websocketConnected: boolean;
}

export function createAtuRoutes(options: {
  transmissionService: TransmissionService;
  repository: TransmissionRepository;
  scheduler: TransmissionScheduler;
  wsClient: any;
}): Router {
  const router = Router();
  const { transmissionService, repository, scheduler, wsClient } = options;

  /**
   * GET /atu/status — Get transmission status
   */
  router.get('/status', async (_req: Request, res: Response) => {
    try {
      const stats = await transmissionService.getStats();
      const recent = await transmissionService.getRecentTransmissions(1);
      const lastTransmission = recent.length > 0 ? recent[0] : null;
      const vehiclesActive = await repository.countActiveVehiclesWithin(
        config.ws.maxUpdateIntervalSeconds
      );

      // Get last ATU response from latest transmission
      let lastAtuResponse: { code: string; identifier: string; timestamp: string } | null = null;
      if (lastTransmission?.atu_response_code) {
        lastAtuResponse = {
          code: lastTransmission.atu_response_code,
          identifier: lastTransmission.identifier,
          timestamp: lastTransmission.created_at?.toISOString() ?? new Date().toISOString(),
        };
      }

      const response: AtuStatusResponse = {
        transmissionActive: scheduler.isRunning(),
        mode: config.env,
        vehiclesActive,
        totalTransmissions: stats.total,
        acceptedCount: stats.accepted,
        rejectedCount: stats.rejected,
        lastAtuResponse,
        lastTransmissionAt: lastTransmission?.created_at?.toISOString() ?? null,
        websocketConnected: wsClient.isConnected(),
      };

      res.json(response);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      res.status(500).json({ error: `Failed to get ATU status: ${message}` });
    }
  });

  /**
   * POST /atu/start — Start transmission scheduler
   */
  router.post('/start', (_req: Request, res: Response) => {
    try {
      scheduler.start();
      transmissionService.start();
      res.json({ success: true, message: 'Transmission scheduler started' });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      res.status(500).json({ error: `Failed to start scheduler: ${message}` });
    }
  });

  /**
   * POST /atu/stop — Stop transmission scheduler
   */
  router.post('/stop', (_req: Request, res: Response) => {
    try {
      scheduler.stop();
      transmissionService.stop();
      res.json({ success: true, message: 'Transmission scheduler stopped' });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      res.status(500).json({ error: `Failed to stop scheduler: ${message}` });
    }
  });

  /**
   * GET /atu/config — Get current ATU config (masked token)
   */
  router.get('/config', (_req: Request, res: Response) => {
    try {
      const response = {
        endpoint: config.ws.endpoint,
        token: maskToken(config.ws.token),
        maxUpdateIntervalSeconds: config.ws.maxUpdateIntervalSeconds,
        maxRetries: config.ws.maxRetries,
        reconnectSeconds: config.ws.reconnectSeconds,
        position: {
          maxAgeMinutes: config.position.maxAgeMinutes,
        },
        gps: {
          sourceType: config.gps.sourceType,
          pollIntervalMs: config.gps.pollIntervalMs,
          speedUnit: config.gps.speedUnit,
        },
        route: {
          id: config.route.id,
          atuRouteCode: config.route.atuRouteCode,
        },
        dryRun: config.dryRun,
        env: config.env,
      };

      res.json(response);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      res.status(500).json({ error: `Failed to get ATU config: ${message}` });
    }
  });

  /**
   * POST /atu/config — Update ATU config
   */
  router.post('/config', (req: Request, res: Response) => {
    try {
      const {
        token,
        endpoint,
        dryRun,
      } = req.body;

      // Build update message (actual config update would require restart or dynamic reload)
      const updates: string[] = [];
      if (token !== undefined) updates.push('token');
      if (endpoint !== undefined) updates.push('endpoint');
      if (dryRun !== undefined) updates.push('dryRun');

      if (updates.length > 0) {
        console.log(`[ATU Routes] Config update requested for: ${updates.join(', ')}`);
        console.log('[ATU Routes] Update is acknowledge-only; runtime config is not mutated here');
      }

      res.json({
        success: true,
        message: `Config update acknowledged: ${updates.join(', ') || 'none'}. This endpoint does not persist or apply runtime changes; restart/manual config update required.`,
        updatedFields: updates,
        applied: false,
        persisted: false,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      res.status(500).json({ error: `Failed to update ATU config: ${message}` });
    }
  });

  return router;
}
