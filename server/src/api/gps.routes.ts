/**
 * GPS Routes
 * Endpoints for GPS data access and webhook ingestion
 */

import { Router, Request, Response } from 'express';
import { GpsSourceAdapter } from '../gps/adapters/gps-source.adapter';
import { normalize, normalizeBatch } from '../gps/normalizer';
import { GpsPosition } from '../gps/dto/gps-position.dto';

export function createGpsRoutes(options: {
  gpsAdapter: GpsSourceAdapter;
}): Router {
  const router = Router();
  const { gpsAdapter } = options;

  /**
   * GET /gps/latest — Current positions from adapter (for testing/debugging)
   */
  router.get('/latest', async (_req: Request, res: Response) => {
    try {
      const rawPositions = await gpsAdapter.getLatestPositions();
      const positions = normalizeBatch(rawPositions);

      res.json({
        count: positions.length,
        positions: positions.map(p => ({
          imei: p.deviceImei,
          latitude: p.latitude,
          longitude: p.longitude,
          speed: p.speed,
          direction: p.direction,
          route: p.routeCode,
          driver: p.driverDocument,
          gpsTimestamp: new Date(p.gpsTimestamp).toISOString(),
          tripStart: new Date(p.tripStartTimestamp).toISOString(),
          plate: p.plate,
        })),
        fetchedAt: new Date().toISOString(),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      res.status(500).json({ error: `Failed to fetch GPS positions: ${message}` });
    }
  });

  /**
   * POST /gps/webhook — Receive GPS position via webhook
   *
   * This endpoint is for future extensibility when GPS system can push
   * instead of the forwarder pulling.
   *
   * Expected payload:
   * {
   *   "imei": "435654321239569",
   *   "latitude": -12.228012,
   *   "longitude": -76.931337,
   *   "speed": 77.5,
   *   "timestamp": 1757119795000,
   *   "route": "1180",
   *   "direction": "VUELTA",
   *   "driver": "12345678",
   *   "tripStart": 1757097480000
   * }
   */
  router.post('/webhook', (req: Request, res: Response) => {
    try {
      const payload = req.body;

      // Validate required fields
      if (!payload.imei || !payload.latitude || !payload.longitude || !payload.timestamp) {
        res.status(400).json({
          error: 'Missing required fields: imei, latitude, longitude, timestamp',
          received: payload,
        });
        return;
      }

      // Normalize the webhook payload to internal format
      const normalizedPosition: GpsPosition = {
        deviceImei: String(payload.imei),
        latitude: parseFloat(payload.latitude),
        longitude: parseFloat(payload.longitude),
        speed: parseFloat(payload.speed ?? 0),
        gpsTimestamp: typeof payload.timestamp === 'number'
          ? payload.timestamp
          : Date.now(),
        routeCode: payload.route ?? '',
        direction: (payload.direction ?? 'IDA') as 'IDA' | 'VUELTA',
        driverDocument: payload.driver ?? '',
        tripStartTimestamp: payload.tripStart ?? payload.timestamp,
        plate: payload.plate ?? '',
      };

      console.log(`[GPS Webhook] Received position for IMEI ${normalizedPosition.deviceImei}`);

      // Return immediately - processing is async
      // In a full implementation, this would queue the position for processing
      res.status(202).json({
        accepted: true,
        message: 'Position received and queued for processing',
        imei: normalizedPosition.deviceImei,
        timestamp: new Date(normalizedPosition.gpsTimestamp).toISOString(),
        queuedAt: new Date().toISOString(),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      res.status(500).json({ error: `Failed to process webhook payload: ${message}` });
    }
  });

  return router;
}