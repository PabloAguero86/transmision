/**
 * ATU GPS Forwarder — ATU-Specific Helpers
 */

import { config } from './env';

export const DIRECTION_MAP = {
  IDA: 0,
  VUELTA: 1,
  REGRESO: 1,
} as const;

export type Direction = 0 | 1;

export function buildAtuWsUrl(): string {
  return `${config.ws.endpoint}?token=${config.ws.token}`;
}

export function maskToken(token: string): string {
  if (token.length <= 4) return '****';
  return '****' + token.slice(-4);
}

export function isExpired(timestamp: number): boolean {
  const maxAgeMs = config.position.maxAgeMinutes * 60 * 1000;
  return Date.now() - timestamp > maxAgeMs;
}

const lastUpdate: Map<string, number> = new Map();

export function isWithin20s(imei: string): boolean {
  const last = lastUpdate.get(imei);
  if (!last) return true;
  return Date.now() - last < config.ws.maxUpdateIntervalSeconds * 1000;
}

export function recordUpdate(imei: string): void {
  lastUpdate.set(imei, Date.now());
}

export function getDirection(directionStr: string): Direction {
  const normalized = directionStr.toUpperCase();
  return DIRECTION_MAP[normalized as keyof typeof DIRECTION_MAP] ?? 0;
}
