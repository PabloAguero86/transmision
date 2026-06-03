/**
 * Transmission Repository
 * Persists transmission attempts to the database
 * 
 * NOTE: DDL (CREATE TABLE) must be run manually by the user.
 * This module only handles INSERT operations.
 */

import mysql, { Pool, ResultSetHeader } from 'mysql2/promise';
import { AtuResponse } from '../atu/ws-client';

export type TransmissionStatus = 
  | 'pending'
  | 'normalized'
  | 'validation_failed'
  | 'pending_send'
  | 'sent'
  | 'accepted_by_atu'
  | 'rejected_by_atu'
  | 'token_error'
  | 'websocket_error'
  | 'expired'
  | 'skipped'
  | 'retry_pending';

export interface TransmissionRecord {
  id?: number;
  imei: string;
  license_plate: string;
  route_id: string;
  driver_id: string;
  direction_id: number;
  latitude: number;
  longitude: number;
  speed: number;
  ts: number;
  tsinitialtrip: number;
  identifier: string;
  payload_json: string;
  status: TransmissionStatus;
  validation_error?: string;
  atu_response_code?: string;
  atu_response_message?: string;
  latency_ms?: number;
  retry_count: number;
  created_at?: Date;
}

export interface TransmissionStats {
  total: number;
  accepted: number;
  rejected: number;
  failed: number;
}

export class TransmissionRepository {
  private pool: Pool;
  private routeId: string;
  private vehicleImeis: string[];

  constructor(mysqlPool: Pool, routeId: string = '', vehicleImeis: string[] = []) {
    this.pool = mysqlPool;
    this.routeId = routeId;
    this.vehicleImeis = vehicleImeis;
  }

  private routeFilter(): { clause: string; params: any[] } {
    if (!this.routeId) return { clause: '', params: [] };
    return { clause: ' AND route_id = ?', params: [this.routeId] };
  }

  private imeiFilter(prefix: string = 'AND'): { clause: string; params: any[] } {
    if (this.vehicleImeis.length === 0) return { clause: '', params: [] };
    const placeholders = this.vehicleImeis.map(() => '?').join(',');
    return { clause: ` ${prefix} imei IN (${placeholders})`, params: [...this.vehicleImeis] };
  }

  /**
   * Save a new transmission record
   * @returns Insert ID
   */
  async save(record: TransmissionRecord): Promise<number> {
    const sql = `
      INSERT INTO atu_transmissions (
        imei, license_plate, route_id, driver_id, direction_id,
        latitude, longitude, speed, ts, tsinitialtrip,
        identifier, payload_json, status, validation_error,
        atu_response_code, atu_response_message, latency_ms, retry_count
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const values = [
      record.imei,
      record.license_plate,
      record.route_id,
      record.driver_id,
      record.direction_id,
      record.latitude,
      record.longitude,
      record.speed,
      record.ts,
      record.tsinitialtrip,
      record.identifier,
      record.payload_json,
      record.status,
      record.validation_error ?? null,
      record.atu_response_code ?? null,
      record.atu_response_message ?? null,
      record.latency_ms ?? null,
      record.retry_count,
    ];

    try {
      const [result] = await this.pool.execute<ResultSetHeader>(sql, values);
      return result.insertId;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to save transmission record: ${message}`);
    }
  }

  /**
   * Update transmission status with response info
   */
  async updateStatus(
    id: number,
    status: TransmissionStatus,
    response?: Partial<AtuResponse>,
    latency?: number
  ): Promise<void> {
    const sql = `
      UPDATE atu_transmissions 
      SET status = ?, 
          atu_response_code = COALESCE(?, atu_response_code),
          atu_response_message = COALESCE(?, atu_response_message),
          latency_ms = ?
      WHERE id = ?
    `;

    const values = [
      status,
      response?.codigo ?? null,
      response?.descrip ?? null,
      latency ?? null,
      id,
    ];

    try {
      await this.pool.execute(sql, values);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to update transmission status: ${message}`);
    }
  }

  /**
   * Get latest transmissions for an IMEI
   */
  async getLatestByImei(imei: string, limit: number = 10): Promise<TransmissionRecord[]> {
    const sql = `
      SELECT * FROM atu_transmissions 
      WHERE imei = ?
      ORDER BY created_at DESC
      LIMIT ?
    `;

    try {
      const [rows] = await this.pool.query(sql, [imei, limit]);
      return rows as unknown as TransmissionRecord[];
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to get transmissions by IMEI: ${message}`);
    }
  }

  /**
   * Get transmission by identifier
   */
  async getByIdentifier(identifier: string): Promise<TransmissionRecord | null> {
    const sql = `
      SELECT * FROM atu_transmissions 
      WHERE identifier = ?
      LIMIT 1
    `;

    try {
      const [rows] = await this.pool.execute(sql, [identifier]);
      const results = rows as unknown as TransmissionRecord[];
      return results.length > 0 ? results[0] : null;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to get transmission by identifier: ${message}`);
    }
  }

  /**
   * Get transmission statistics
   */
  async getStats(): Promise<TransmissionStats> {
    const { clause, params } = this.routeFilter();
    const { clause: imeiClause, params: imeiParams } = this.imeiFilter();
    const sql = `
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN status = 'accepted_by_atu' THEN 1 ELSE 0 END) as accepted,
        SUM(CASE WHEN status IN ('rejected_by_atu', 'token_error') THEN 1 ELSE 0 END) as rejected,
        SUM(CASE WHEN status IN ('websocket_error', 'validation_failed', 'expired') THEN 1 ELSE 0 END) as failed
      FROM atu_transmissions
      WHERE created_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR)${clause}${imeiClause}
    `;

    try {
      const [rows] = await this.pool.execute(sql, [...params, ...imeiParams]);
      const result = rows as any;
      return {
        total: result[0]?.total ?? 0,
        accepted: result[0]?.accepted ?? 0,
        rejected: result[0]?.rejected ?? 0,
        failed: result[0]?.failed ?? 0,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to get transmission stats: ${message}`);
    }
  }

  /**
   * Get recent transmissions (for API)
   */
  async getRecent(limit: number = 100): Promise<TransmissionRecord[]> {
    const conditions: string[] = [];
    const queryParams: any[] = [];

    if (this.routeId) {
      conditions.push('route_id = ?');
      queryParams.push(this.routeId);
    }
    if (this.vehicleImeis.length > 0) {
      const placeholders = this.vehicleImeis.map(() => '?').join(',');
      conditions.push(`imei IN (${placeholders})`);
      queryParams.push(...this.vehicleImeis);
    }

    const whereClause = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';
    const sql = `
      SELECT * FROM atu_transmissions 
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT ?
    `;

    try {
      const [rows] = await this.pool.query(sql, [...queryParams, limit]);
      return rows as unknown as TransmissionRecord[];
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to get recent transmissions: ${message}`);
    }
  }

  /**
   * Get transmissions with pagination
   */
  async getPaginated(options: {
    status?: TransmissionStatus;
    imei?: string;
    dateFrom?: string;
    dateTo?: string;
    limit: number;
    offset: number;
  }): Promise<{ records: TransmissionRecord[]; total: number }> {
    const { status, imei, dateFrom, dateTo, limit, offset } = options;

    const conditions: string[] = [];
    const params: any[] = [];

    if (this.routeId) {
      conditions.push('route_id = ?');
      params.push(this.routeId);
    }
    if (status) {
      conditions.push('status = ?');
      params.push(status);
    }
    if (imei) {
      conditions.push('imei = ?');
      params.push(imei);
    }
    if (this.vehicleImeis.length > 0) {
      const placeholders = this.vehicleImeis.map(() => '?').join(',');
      conditions.push(`imei IN (${placeholders})`);
      params.push(...this.vehicleImeis);
    }
    if (dateFrom) {
      conditions.push('created_at >= ?');
      params.push(dateFrom);
    }
    if (dateTo) {
      conditions.push('created_at <= ?');
      params.push(dateTo + ' 23:59:59');
    }

    const whereClause = conditions.length > 0 ? ' WHERE ' + conditions.join(' AND ') : '';

    const countSql = `SELECT COUNT(*) as total FROM atu_transmissions${whereClause}`;
    const dataSql = `SELECT * FROM atu_transmissions${whereClause} ORDER BY created_at DESC LIMIT ? OFFSET ?`;

    try {
      const [countRows] = await this.pool.query(countSql, params);
      const total = (countRows as any)[0]?.total ?? 0;

      const [rows] = await this.pool.query(dataSql, [...params, limit, offset]);
      return {
        records: rows as unknown as TransmissionRecord[],
        total,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to get paginated transmissions: ${message}`);
    }
  }

  /**
   * Get transmissions by status
   */
  async getByStatus(status: TransmissionStatus, limit: number = 100): Promise<TransmissionRecord[]> {
    const { clause, params } = this.routeFilter();
    const { clause: imeiClause, params: imeiParams } = this.imeiFilter();
    const sql = `
      SELECT * FROM atu_transmissions 
      WHERE status = ?${clause}${imeiClause}
      ORDER BY created_at DESC
      LIMIT ?
    `;

    try {
      const [rows] = await this.pool.query(sql, [status, ...params, ...imeiParams, limit]);
      return rows as unknown as TransmissionRecord[];
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to get transmissions by status: ${message}`);
    }
  }

  /**
   * Get transmission by ID
   */
  async getById(id: number): Promise<TransmissionRecord | null> {
    const sql = `
      SELECT * FROM atu_transmissions 
      WHERE id = ?
      LIMIT 1
    `;

    try {
      const [rows] = await this.pool.execute(sql, [id]);
      const results = rows as unknown as TransmissionRecord[];
      return results.length > 0 ? results[0] : null;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to get transmission by ID: ${message}`);
    }
  }

  /**
   * Get vehicles with successful transmission within threshold
   */
  async getVehiclesWithTransmissionWithin(withinSeconds: number = 20): Promise<string[]> {
    const { clause: imeiClause, params: imeiParams } = this.imeiFilter();
    const routeClause = this.routeId ? ' AND route_id = ?' : '';
    const sql = `
      SELECT DISTINCT imei FROM atu_transmissions 
      WHERE status = 'accepted_by_atu' 
        AND created_at >= FROM_UNIXTIME(?) / 1000${routeClause}${imeiClause}
      ORDER BY created_at DESC
    `;

    const cutoff = Date.now() - withinSeconds * 1000;
    const qp: any[] = [Math.floor(cutoff / 1000)];
    if (this.routeId) qp.push(this.routeId);
    qp.push(...imeiParams);

    try {
      const [rows] = await this.pool.query(sql, qp);
      return (rows as any[]).map((r: any) => r.imei);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to get vehicles with recent transmission: ${message}`);
    }
  }

  /**
   * Get distinct vehicles (IMEI + plate) from transmissions for filter dropdown
   */
  async getDistinctVehicles(): Promise<Array<{ imei: string; plate: string }>> {
    const conditions: string[] = [];
    const params: any[] = [];

    if (this.routeId) {
      conditions.push('route_id = ?');
      params.push(this.routeId);
    }
    if (this.vehicleImeis.length > 0) {
      const placeholders = this.vehicleImeis.map(() => '?').join(',');
      conditions.push(`imei IN (${placeholders})`);
      params.push(...this.vehicleImeis);
    }

    const whereClause = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';
    const sql = `
      SELECT imei, MAX(license_plate) as plate
      FROM atu_transmissions
      ${whereClause}
      GROUP BY imei
      ORDER BY plate ASC
    `;

    try {
      const [rows] = await this.pool.query(sql, params);
      return (rows as any[]).map((r: any) => ({
        imei: r.imei,
        plate: r.plate,
      }));
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to get distinct vehicles: ${message}`);
    }
  }

  /**
   * Get all unique IMEIs with their last transmission time
   */
  async getAllImeisWithLastTransmission(): Promise<Map<string, Date>> {
    const { clause, params } = this.routeFilter();
    const { clause: imeiClause, params: imeiParams } = this.imeiFilter();
    const sql = `
      SELECT imei, MAX(created_at) as last_transmission 
      FROM atu_transmissions 
      WHERE 1=1${clause}${imeiClause}
      GROUP BY imei
    `;

    try {
      const [rows] = await this.pool.execute(sql, [...params, ...imeiParams]);
      const map = new Map<string, Date>();
      for (const row of rows as any[]) {
        map.set(row.imei, row.last_transmission);
      }
      return map;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to get IMEIs with last transmission: ${message}`);
    }
  }

  /**
   * Get transmission counts by day and status (for reports)
   */
  async getTransmissionCountsByDay(days: number = 7): Promise<Record<string, any>> {
    const { clause, params } = this.routeFilter();
    const { clause: imeiClause, params: imeiParams } = this.imeiFilter();
    const sql = `
      SELECT 
        DATE(created_at) as day,
        status,
        COUNT(*) as count
      FROM atu_transmissions
      WHERE created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)${clause}${imeiClause}
      GROUP BY DATE(created_at), status
      ORDER BY day DESC, status
    `;

    try {
      const [rows] = await this.pool.query(sql, [days, ...params, ...imeiParams]);
      return rows;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to get transmission counts by day: ${message}`);
    }
  }

  /**
   * Get error counts grouped by ATU response code
   */
  async getErrorCountsByCode(): Promise<Record<string, any>> {
    const { clause, params } = this.routeFilter();
    const { clause: imeiClause, params: imeiParams } = this.imeiFilter();
    const sql = `
      SELECT 
        atu_response_code as code,
        COUNT(*) as count,
        atu_response_message as message
      FROM atu_transmissions
      WHERE atu_response_code IS NOT NULL
        AND atu_response_code != '00'
        AND status IN ('rejected_by_atu', 'token_error')${clause}${imeiClause}
      GROUP BY atu_response_code, atu_response_message
      ORDER BY count DESC
    `;

    try {
      const [rows] = await this.pool.execute(sql, [...params, ...imeiParams]);
      return rows;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to get error counts by code: ${message}`);
    }
  }

  /**
   * Get IMEIs with their latest successful transmission timestamp
   * Used to find vehicles without recent transmission
   */
  async getLastSuccessfulTransmissionByImei(): Promise<Map<string, Date>> {
    const { clause, params } = this.routeFilter();
    const { clause: imeiClause, params: imeiParams } = this.imeiFilter();
    const sql = `
      SELECT imei, MAX(created_at) as last_success
      FROM atu_transmissions
      WHERE status = 'accepted_by_atu'${clause}${imeiClause}
      GROUP BY imei
    `;

    try {
      const [rows] = await this.pool.execute(sql, [...params, ...imeiParams]);
      const map = new Map<string, Date>();
      for (const row of rows as any[]) {
        map.set(row.imei, row.last_success);
      }
      return map;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to get last successful transmission by IMEI: ${message}`);
    }
  }

  /**
   * Count unique IMEIs with any transmission activity within a recent window
   */
  async countActiveVehiclesWithin(seconds: number = 20): Promise<number> {
    const { clause, params } = this.routeFilter();
    const { clause: imeiClause, params: imeiParams } = this.imeiFilter();
    const sql = `
      SELECT COUNT(DISTINCT imei) as total
      FROM atu_transmissions
      WHERE created_at >= DATE_SUB(NOW(), INTERVAL ? SECOND)${clause}${imeiClause}
    `;

    try {
      const [rows] = await this.pool.query(sql, [seconds, ...params, ...imeiParams]);
      return Number((rows as any[])[0]?.total ?? 0);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to count active vehicles: ${message}`);
    }
  }
}
