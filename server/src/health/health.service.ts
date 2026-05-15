/**
 * Health Service
 * Provides health check data for all system components
 */

import { Pool } from 'mysql2/promise';
import { AtuWsClient } from '../atu/ws-client';
import { GpsSourceAdapter } from '../gps/adapters/gps-source.adapter';

export interface ComponentHealth {
  status: 'up' | 'down' | 'unknown';
  message?: string;
  lastCheck?: string;
  lastError?: string;
}

export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  components: {
    gpsSource: ComponentHealth;
    atuWebsocket: ComponentHealth;
    database: ComponentHealth;
  };
}

export class HealthService {
  private pool: Pool;
  private wsClient: AtuWsClient;
  private gpsAdapter: GpsSourceAdapter;

  // Track last check times and errors
  private lastGpsSourceCheck: string | undefined;
  private lastGpsSourceError: string | undefined;
  private lastDatabaseCheck: string | undefined;
  private lastDatabaseError: string | undefined;

  constructor(options: {
    pool: Pool;
    wsClient: AtuWsClient;
    gpsAdapter: GpsSourceAdapter;
  }) {
    this.pool = options.pool;
    this.wsClient = options.wsClient;
    this.gpsAdapter = options.gpsAdapter;
  }

  /**
   * Check GPS source connectivity
   */
  async checkGpsSource(): Promise<ComponentHealth> {
    try {
      const probe = this.gpsAdapter.checkConnection
        ? await this.gpsAdapter.checkConnection()
        : { ok: true, message: 'GPS source adapter does not implement a lightweight health probe' };

      this.lastGpsSourceCheck = new Date().toISOString();
      this.lastGpsSourceError = probe.ok ? undefined : probe.message;

      if (!probe.ok) {
        return {
          status: 'down',
          message: probe.message ?? 'GPS source connectivity check failed',
          lastCheck: this.lastGpsSourceCheck,
          lastError: probe.message,
        };
      }

      return {
        status: 'up',
        message: probe.message ?? 'GPS source connectivity check passed',
        lastCheck: this.lastGpsSourceCheck,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.lastGpsSourceCheck = new Date().toISOString();
      this.lastGpsSourceError = message;
      return {
        status: 'down',
        message: `GPS source error: ${message}`,
        lastCheck: this.lastGpsSourceCheck,
        lastError: message,
      };
    }
  }

  /**
   * Check ATU WebSocket client status
   */
  checkAtuWebsocket(): ComponentHealth {
    const info = this.wsClient.getDiagnostics();

    if (info.isConnected) {
      return {
        status: 'up',
        message: 'WebSocket conectado a ATU',
        lastCheck: new Date().toISOString(),
      };
    }

    const parts: string[] = ['WebSocket desconectado'];
    if (info.reconnectAttempts > 0) parts.push(`(${info.reconnectAttempts} reintentos)`);
    if (info.lastCloseCode !== null) parts.push(`código de cierre: ${info.lastCloseCode}`);
    if (info.lastError) parts.push(`error: ${info.lastError}`);

    return {
      status: 'down',
      message: parts.join(' — '),
      lastCheck: new Date().toISOString(),
      lastError: [
        `Endpoint: ${info.wsUrl}`,
        `Estado WS: ${['CONECTANDO', 'ABIERTO', 'CERRANDO', 'CERRADO'][info.wsReadyState] ?? 'N/A'}`,
        `Reintentos: ${info.reconnectAttempts}`,
        info.lastCloseCode !== null ? `Close code: ${info.lastCloseCode} (${info.lastCloseReason || 'sin razón'})` : null,
        info.lastError ? `Último error: ${info.lastError}` : null,
      ].filter(Boolean).join(' | '),
    };
  }

  /**
   * Check database connection pool status
   */
  async checkDatabase(): Promise<ComponentHealth> {
    try {
      const [rows] = await this.pool.execute<any[]>('SELECT 1 AS result');
      this.lastDatabaseCheck = new Date().toISOString();
      this.lastDatabaseError = undefined;

      // Get pool stats
      const poolInfo = this.pool;
      const connectionLimit = (poolInfo as any).pool?._connectionLimit ?? 'unknown';
      const idleCount = (poolInfo as any).pool?._freeConnections?.length ?? 'unknown';

      return {
        status: 'up',
        message: `Database connected (pool: idle=${idleCount}, limit=${connectionLimit})`,
        lastCheck: this.lastDatabaseCheck,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.lastDatabaseError = message;
      return {
        status: 'down',
        message: `Database error: ${message}`,
        lastCheck: new Date().toISOString(),
        lastError: message,
      };
    }
  }

  /**
   * Get overall health status aggregating all components
   */
  async getOverallHealth(): Promise<HealthStatus> {
    const [gpsSource, atuWebsocket, database] = await Promise.all([
      this.checkGpsSource(),
      Promise.resolve(this.checkAtuWebsocket()), // sync check
      this.checkDatabase(),
    ]);

    // Determine overall status
    const componentStatuses = [gpsSource.status, atuWebsocket.status, database.status];

    let overallStatus: 'healthy' | 'degraded' | 'unhealthy';

    if (componentStatuses.every(s => s === 'up')) {
      overallStatus = 'healthy';
    } else if (componentStatuses.every(s => s === 'down')) {
      overallStatus = 'unhealthy';
    } else {
      overallStatus = 'degraded';
    }

    return {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      components: {
        gpsSource,
        atuWebsocket,
        database,
      },
    };
  }
}
