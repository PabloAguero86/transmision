/**
 * Reports Routes
 * Endpoints for transmission reports and analytics
 */

import { Router, Request, Response } from 'express';
import { TransmissionRepository } from '../transmissions/repository';
import { GpsSourceAdapter } from '../gps/adapters/gps-source.adapter';

export function createReportsRoutes(options: {
  repository: TransmissionRepository;
  gpsAdapter: GpsSourceAdapter;
}): Router {
  const router = Router();
  const { repository, gpsAdapter } = options;

  /**
   * GET /reports/atu-transmissions — Transmission report by day
   */
  router.get('/atu-transmissions', async (_req: Request, res: Response) => {
    try {
      const query = _req.query as { days?: string };
      const days = parseInt(query.days ?? '7', 10);

      const rows = await repository.getTransmissionCountsByDay(days);

      // Organize by day
      const report: Record<string, any> = {};
      for (const row of rows as any[]) {
        const day = row.day instanceof Date
          ? row.day.toISOString().split('T')[0]
          : String(row.day);

        if (!report[day]) {
          report[day] = {
            date: day,
            accepted: 0,
            rejected: 0,
            expired: 0,
            failed: 0,
            total: 0,
          };
        }

        // Update counts based on status
        const status = row.status as string;
        if (status === 'accepted_by_atu') {
          report[day].accepted = row.count;
        } else if (status === 'rejected_by_atu') {
          report[day].rejected = row.count;
        } else if (status === 'expired') {
          report[day].expired = row.count;
        } else if (['websocket_error', 'validation_failed'].includes(status)) {
          report[day].failed += row.count;
        }

        report[day].total += row.count;
      }

      // Convert to array sorted by date descending
      const reportArray = Object.values(report).sort((a: any, b: any) =>
        b.date.localeCompare(a.date)
      );

      res.json({
        report: reportArray,
        days,
        generatedAt: new Date().toISOString(),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      res.status(500).json({ error: `Failed to generate ATU transmission report: ${message}` });
    }
  });

  /**
   * GET /reports/atu-errors — Errors grouped by type and code
   */
  router.get('/atu-errors', async (_req: Request, res: Response) => {
    try {
      const rows = await repository.getErrorCountsByCode();

      res.json({
        errors: rows,
        totalErrors: (rows as any[]).reduce((sum: number, r: any) => sum + r.count, 0),
        generatedAt: new Date().toISOString(),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      res.status(500).json({ error: `Failed to generate ATU errors report: ${message}` });
    }
  });

  /**
   * GET /reports/vehicles-without-transmission — Vehicles with gap > 20 seconds
   */
  router.get('/vehicles-without-transmission', async (_req: Request, res: Response) => {
    try {
      const query = _req.query as { thresholdSeconds?: string };
      const thresholdSeconds = parseInt(query.thresholdSeconds ?? '20', 10);
      const cutoff = Date.now() - thresholdSeconds * 1000;

      // Get all IMEIs with their last successful transmission
      const lastTransmissions = await repository.getLastSuccessfulTransmissionByImei();

      // Get current positions from GPS source to cross-reference
      let currentPositions: Set<string> = new Set();
      try {
        const positions = await gpsAdapter.getLatestPositions();
        currentPositions = new Set(positions.map(p => p.imei));
      } catch {
        // GPS adapter might not be available
      }

      // Find vehicles with gaps
      const vehiclesWithoutRecentTransmission: Array<{
        imei: string;
        lastTransmissionAt: string | null;
        gapSeconds: number | null;
        hasActivePosition: boolean;
      }> = [];

      for (const [imei, lastSuccess] of lastTransmissions.entries()) {
        const gapMs = Date.now() - lastSuccess.getTime();
        const gapSeconds = gapMs / 1000;

        if (gapSeconds > thresholdSeconds) {
          vehiclesWithoutRecentTransmission.push({
            imei,
            lastTransmissionAt: lastSuccess.toISOString(),
            gapSeconds: Math.round(gapSeconds),
            hasActivePosition: currentPositions.has(imei),
          });
        }
      }

      // Sort by gap descending
      vehiclesWithoutRecentTransmission.sort((a, b) =>
        (b.gapSeconds ?? 0) - (a.gapSeconds ?? 0)
      );

      res.json({
        vehicles: vehiclesWithoutRecentTransmission,
        count: vehiclesWithoutRecentTransmission.length,
        thresholdSeconds,
        generatedAt: new Date().toISOString(),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      res.status(500).json({ error: `Failed to generate vehicles without transmission report: ${message}` });
    }
  });

  /**
   * GET /reports/summary — Summary statistics for panel
   */
  router.get('/summary', async (_req: Request, res: Response) => {
    try {
      // Get overall stats
      const stats = await repository.getStats();

      // Get today's counts
      const todayRows = await repository.getTransmissionCountsByDay(1);
      const todayData = todayRows as any[];

      // Get error breakdown
      const errorRows = await repository.getErrorCountsByCode();

      // Get vehicle count (unique IMEIs)
      const lastTransmissions = await repository.getLastSuccessfulTransmissionByImei();
      const activeVehiclesCount = lastTransmissions.size;

      // Get recent activity (last 5 minutes)
      const fiveMinAgo = Date.now() - 5 * 60 * 1000;
      const recentRows = await repository.getRecent(100);
      const recentActivity = (recentRows as any[]).filter(r =>
        r.created_at && new Date(r.created_at).getTime() > fiveMinAgo
      );

      res.json({
        overview: {
          totalTransmissions: stats.total,
          accepted: stats.accepted,
          rejected: stats.rejected,
          failed: stats.failed,
          activeVehicles: activeVehiclesCount,
          acceptanceRate: stats.total > 0
            ? Math.round((stats.accepted / stats.total) * 100)
            : 0,
        },
        today: todayData.length > 0 ? {
          total: todayData.reduce((sum: number, r: any) => sum + r.count, 0),
          accepted: todayData.find((r: any) => r.status === 'accepted_by_atu')?.count ?? 0,
          rejected: todayData.find((r: any) => r.status === 'rejected_by_atu')?.count ?? 0,
        } : { total: 0, accepted: 0, rejected: 0 },
        recentActivity: {
          count: recentActivity.length,
          lastTransmissionAt: recentActivity.length > 0
            ? recentActivity[0].created_at
            : null,
        },
        topErrors: (errorRows as any[]).slice(0, 5),
        generatedAt: new Date().toISOString(),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      res.status(500).json({ error: `Failed to generate summary report: ${message}` });
    }
  });

  return router;
}