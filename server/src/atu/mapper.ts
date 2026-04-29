/**
 * ATU Payload Mapper
 * Builds the exact ATU JSON payload from normalized GpsPosition
 */

import { nanoid } from 'nanoid';
import { GpsPosition } from '../gps/dto/gps-position.dto';

const ALPHANUMERIC =
  '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';

function generateIdentifier(length: number = 20): string {
  return nanoid(length)
    .split('')
    .map((char) => ALPHANUMERIC[char.charCodeAt(0) % ALPHANUMERIC.length])
    .join('');
}

function cleanString(value: string): string {
  return value.trim();
}

/**
 * ATU Payload — the 11-field JSON sent to ATU WebSocket
 */
export interface AtuPayload {
  imei: string;            // string, 15 alphanum
  latitude: number;        // decimal
  longitude: number;       // decimal
  route_id: string;        // 1-10 alphanum
  ts: number;             // Unix ms
  license_plate: string;   // 1-7 chars
  speed: number;           // 0 to 999.99
  direction_id: 0 | 1;    // 0=IDA, 1=VUELTA
  driver_id: string;       // 1-20 alphanum
  tsinitialtrip: number;   // Unix ms, <= ts
  identifier: string;      // 1-50 alphanum, auto-generated
}

/**
 * Build an ATU payload from a normalized GPS position
 * @param position - Normalized GPS position
 * @param identifier - Optional identifier (auto-generated if not provided)
 * @returns ATU payload ready to be sent
 */
export function buildAtuPayload(
  position: GpsPosition,
  identifier?: string
): AtuPayload {
  return {
    imei: cleanString(position.deviceImei),
    latitude: position.latitude,
    longitude: position.longitude,
    route_id: cleanString(position.routeCode),
    ts: position.gpsTimestamp,
    license_plate: cleanString(position.plate),
    speed: position.speed,
    direction_id: position.direction === 'IDA' ? 0 : 1,
    driver_id: cleanString(position.driverDocument),
    tsinitialtrip: position.tripStartTimestamp,
    identifier: identifier ? cleanString(identifier) : generateIdentifier(20),
  };
}
