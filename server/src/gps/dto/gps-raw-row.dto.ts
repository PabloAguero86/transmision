/**
 * GPS Raw Row DTO — direct representation of MySQL query result
 * Fields match the exact column aliases from the production query
 */
export interface GpsRawRow {
  imei: string;
  latitude: number;
  longitude: number;
  route_id: string;
  ts: number;
  license_plate: string;
  speed: number;
  direction_id: number;
  driver_id: string;
  tsinitialtrip: number;
}
