/**
 * Alert Manager
 * Generates and stores system alerts
 */

import mysql, { Pool, ResultSetHeader, RowDataPacket } from 'mysql2/promise';

export type AlertSeverity = 'info' | 'warning' | 'critical';
export type AlertStatus = 'active' | 'resolved';

export interface Alert {
  severity: AlertSeverity;
  type: string;
  title: string;
  message: string;
  status?: AlertStatus; // Optional, defaults to 'active'
}

/**
 * Console alert fallback when MySQL is not available
 */
export function consoleAlert(alert: Omit<Alert, 'status'>): void {
  console.log(JSON.stringify({
    event: 'alert',
    severity: alert.severity,
    type: alert.type,
    title: alert.title,
    message: alert.message,
    timestamp: new Date().toISOString(),
  }));
}

export interface AtuResponse {
  codigo: string;
  identifier: string;
  timestamp: string;
  descrip?: string;
}

export class AlertManager {
  private pool: Pool | null = null;
  private useConsoleFallback = false;

  constructor(mysqlPool?: Pool) {
    if (mysqlPool) {
      this.pool = mysqlPool;
      this.useConsoleFallback = false;
    } else {
      this.useConsoleFallback = true;
    }
  }

  /**
   * Generate a new alert
   */
  async generate(alert: Omit<Alert, 'id' | 'created_at' | 'status'>): Promise<void> {
    const alertWithStatus: Alert = {
      ...alert,
      status: 'active',
    };

    if (this.useConsoleFallback) {
      consoleAlert(alertWithStatus);
      return;
    }

    const sql = `
      INSERT INTO atu_system_alerts (
        severity, type, title, message, status
      ) VALUES (?, ?, ?, ?, 'active')
    `;

    const values = [
      alert.severity,
      alert.type,
      alert.title,
      alert.message,
    ];

    try {
      await this.pool!.execute(sql, values);
      console.log(`[AlertManager] Generated alert: ${alert.type} (${alert.severity})`);
    } catch (error) {
      // Log to console if DB fails
      consoleAlert(alertWithStatus);
      console.error(`[AlertManager] Failed to save alert to DB: ${error}`);
    }
  }

  /**
   * Resolve alerts by type and optionally identifier
   */
  async resolve(type: string, identifier?: string): Promise<void> {
    if (this.useConsoleFallback) {
      console.log(`[AlertManager] Would resolve alert: ${type} ${identifier ? `(identifier: ${identifier})` : ''}`);
      return;
    }

    let sql: string;
    let values: any[];

    if (identifier) {
      // Resolve specific alert by identifier in message
      sql = `
        UPDATE atu_system_alerts 
        SET status = 'resolved', resolved_at = NOW()
        WHERE type = ? AND status = 'active' AND message LIKE ?
      `;
      values = [type, `%${identifier}%`];
    } else {
      // Resolve all alerts of this type
      sql = `
        UPDATE atu_system_alerts 
        SET status = 'resolved', resolved_at = NOW()
        WHERE type = ? AND status = 'active'
      `;
      values = [type];
    }

    try {
      const [result] = await this.pool!.execute<ResultSetHeader>(sql, values);
      if (result.affectedRows > 0) {
        console.log(`[AlertManager] Resolved ${result.affectedRows} alerts of type: ${type}`);
      }
    } catch (error) {
      console.error(`[AlertManager] Failed to resolve alerts: ${error}`);
    }
  }

  /**
   * Get all active alerts
   */
  async getActiveAlerts(): Promise<Alert[]> {
    if (this.useConsoleFallback) {
      console.log('[AlertManager] MySQL not available, returning empty array');
      return [];
    }

    const sql = `
      SELECT * FROM atu_system_alerts 
      WHERE status = 'active'
      ORDER BY created_at DESC
    `;

    try {
      const [rows] = await this.pool!.execute<RowDataPacket[]>(sql);
      return rows as unknown as Alert[];
    } catch (error) {
      console.error(`[AlertManager] Failed to get active alerts: ${error}`);
      return [];
    }
  }

  /**
   * Get alerts by severity
   */
  async getAlertsBySeverity(severity: AlertSeverity): Promise<Alert[]> {
    if (this.useConsoleFallback) {
      console.log('[AlertManager] MySQL not available, returning empty array');
      return [];
    }

    const sql = `
      SELECT * FROM atu_system_alerts 
      WHERE severity = ? AND status = 'active'
      ORDER BY created_at DESC
    `;

    try {
      const [rows] = await this.pool!.execute<RowDataPacket[]>(sql, [severity]);
      return rows as unknown as Alert[];
    } catch (error) {
      console.error(`[AlertManager] Failed to get alerts by severity: ${error}`);
      return [];
    }
  }

  /**
   * Check if MySQL is available
   */
  isAvailable(): boolean {
    return !this.useConsoleFallback;
  }
}

// Alert type constants
export const ALERT_TYPES = {
  VEHICLE_WITHOUT_UPDATE: 'vehicle_without_update_over_20_seconds',
  INVALID_TOKEN: 'invalid_token',
  WEBSOCKET_DISCONNECTED: 'websocket_disconnected',
  WEBSOCKET_RECONNECTING: 'websocket_reconnecting',
  VALIDATION_FAILED: 'validation_failed',
  TRANSMISSION_EXPIRED: 'transmission_expired',
  CONSECUTIVE_REJECTIONS: 'consecutive_rejections',
  GPS_SOURCE_ERROR: 'gps_source_error',
} as const;