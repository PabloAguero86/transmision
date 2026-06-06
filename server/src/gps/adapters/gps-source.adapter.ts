/**
 * GPS Source Adapter Interface
 * Abstracts the source of GPS data (MySQL, mock, etc.)
 */
import { GpsRawRow } from '../dto/gps-raw-row.dto';

export interface GpsSourceAdapter {
  /**
   * Fetch the latest GPS positions from the source
   * @returns Array of raw GPS rows
   */
  getLatestPositions(): Promise<GpsRawRow[]>;

  /**
   * Lightweight connectivity check for health probes
   * Should avoid expensive business queries when possible
   */
  checkConnection?(): Promise<{ ok: boolean; message?: string }>;

  /**
   * Resolve the set of active IMEIs that should be shown in the dashboard.
   * Implementations should mirror the same filter applied by getLatestPositions.
   */
  resolveVehicleImeis?(): Promise<string[]>;
}
