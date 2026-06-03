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
   * Resolve vehicle IDs to their corresponding IMEIs
   * Used for dashboard filtering when GPS_VEHICLE_IDS is configured
   */
  resolveVehicleImeis?(vehicleIds: string[]): Promise<string[]>;
}
