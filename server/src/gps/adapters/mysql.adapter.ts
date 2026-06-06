/**
 * MySQL GPS Adapter
 * Connects to the GPS production database and fetches latest positions
 */

import mysql, { Pool, PoolConnection, RowDataPacket } from 'mysql2/promise';
import { config } from '../../config/env';
import { GpsSourceAdapter } from './gps-source.adapter';
import { GpsRawRow } from '../dto/gps-raw-row.dto';

const EXCLUDED_VEHICLE_IDS = [
  '000164',
  '000220',
  '000227',
  '000218',
  '000239',
  '000159',
  '000237',
  '000224',
] as const;

const buildExclusionClause = (alias: string): string =>
  EXCLUDED_VEHICLE_IDS.map(id => `${alias}.idvehiculo<>'${id}'`).join(' and ');

export class MySqlGpsAdapter implements GpsSourceAdapter {
  private pool: Pool;

  constructor(existingPool?: Pool) {
    if (existingPool) {
      this.pool = existingPool;
    } else {
      this.pool = mysql.createPool({
        host: config.mysql.host,
        port: config.mysql.port,
        user: config.mysql.user,
        password: config.mysql.password,
        database: config.mysql.database,
        waitForConnections: true,
        connectionLimit: 5,
        queueLimit: 0,
        enableKeepAlive: true,
        keepAliveInitialDelay: 0,
      });
    }
  }

  /**
   * Execute the production GPS query with dynamic ROUTE_ID injection
   * @returns Array of raw GPS rows from the database
   */
  async getLatestPositions(): Promise<GpsRawRow[]> {
    const ROUTE_ID = config.route.id;
    const ATU_ROUTE_CODE = config.route.atuRouteCode;

    const query = `
SELECT tlp.uniqueid AS imei,tlp.latitude AS latitude,tlp.longitude AS longitude,'${ATU_ROUTE_CODE}' AS route_id,

    TIMESTAMPDIFF(
        MICROSECOND,
        '1970-01-01 00:00:00.000000',
        CONVERT_TZ(tlp.servertime, '-05:00', '+00:00')
    ) DIV 1000 AS ts,

vh.placa AS license_plate,tlp.speed AS speed ,IF(vh.ac_sentido = 'A', 0, 1) AS direction_id,pr.n_documento AS driver_id,

    TIMESTAMPDIFF(
        MICROSECOND,
        '1970-01-01 00:00:00.000000',
        CONVERT_TZ(
            TIMESTAMP(vj.f_viaje, TIME(vj.h_salida)),
            '-05:00',
            '+00:00'
        )
    ) DIV 1000 AS tsinitialtrip

FROM tc_last_positions tlp, tblvehiculo vh, tblviaje vj, tbloperador op, tblpersona pr
WHERE vh.idgps=tlp.uniqueid AND vh.idruta='${ROUTE_ID}' AND vj.idviaje=vh.uv_idviaje AND vh.ac_estado=1 AND vh.eliminado=1 AND vh.estado=1 AND
vj.f_viaje= DATE( NOW()) and vj.idruta='${ROUTE_ID}' and
pr.idpersona=op.idpersona AND op.idoperador=vj.idconductor AND
(
	${buildExclusionClause('vh')}
)
    `;

    let connection: PoolConnection | null = null;

    try {
      connection = await this.pool.getConnection();
      const [rows] = await connection.execute<RowDataPacket[]>(query);

      return rows.map(row => ({
        imei: String(row.imei ?? ''),
        latitude: Number(row.latitude ?? 0),
        longitude: Number(row.longitude ?? 0),
        route_id: String(row.route_id ?? ''),
        ts: Number(row.ts ?? 0),
        license_plate: String(row.license_plate ?? ''),
        speed: Number(row.speed ?? 0),
        direction_id: Number(row.direction_id ?? 0),
        driver_id: String(row.driver_id ?? ''),
        tsinitialtrip: Number(row.tsinitialtrip ?? 0),
      }));
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`MySQL GPS query failed: ${message}`);
    } finally {
      if (connection) {
        connection.release();
      }
    }
  }

  /**
   * Lightweight health probe for the GPS source
   * Avoids running the full production extraction query
   */
  async checkConnection(): Promise<{ ok: boolean; message?: string }> {
    let connection: PoolConnection | null = null;

    try {
      connection = await this.pool.getConnection();
      await connection.query('SELECT 1 AS gps_source_ok');

      return {
        ok: true,
        message: 'GPS source database reachable',
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return {
        ok: false,
        message: `GPS source connectivity check failed: ${message}`,
      };
    } finally {
      connection?.release();
    }
  }

  /**
   * Resolve active IMEIs for the configured route, excluding blacklisted vehicles.
   * Used by the dashboard to mirror the transmission filter.
   */
  async resolveVehicleImeis(): Promise<string[]> {
    const ROUTE_ID = config.route.id;
    const sql = `
      SELECT DISTINCT idgps AS imei
      FROM tblvehiculo
      WHERE idruta = '${ROUTE_ID}'
        AND ac_estado = 1
        AND eliminado = 1
        AND estado = 1
        AND (
          ${buildExclusionClause('tblvehiculo')}
        )
    `;

    let connection: PoolConnection | null = null;

    try {
      connection = await this.pool.getConnection();
      const [rows] = await connection.execute<RowDataPacket[]>(sql);
      return rows.map(row => String(row.imei ?? ''));
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to resolve vehicle IMEIs: ${message}`);
    } finally {
      if (connection) {
        connection.release();
      }
    }
  }

  /**
   * Close the connection pool gracefully
   */
  async close(): Promise<void> {
    await this.pool.end();
  }
}
