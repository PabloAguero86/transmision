/**
 * Normalized GPS Position DTO — internal model after processing
 * All fields normalized and typed for ATU payload mapping
 */
export interface GpsPosition {
  deviceImei: string;         // 15 alnum chars
  plate: string;              // 1-7 chars alnum + dash
  latitude: number;          // -90 to 90
  longitude: number;         // -180 to 180
  speed: number;             // km/h, 0 to 999.99
  gpsTimestamp: number;       // UTC ms
  routeCode: string;          // 1-10 alnum chars
  direction: 'IDA' | 'VUELTA';
  driverDocument: string;     // 1-20 alnum chars
  tripStartTimestamp: number; // UTC ms
}
