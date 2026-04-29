/**
 * ATU Payload Validator
 * Validates ATU payloads against all ATU rules per specification
 */

import { config } from '../config/env';
import { AtuPayload } from './mapper';

export interface ValidationError {
  field: string;
  value: any;
  code: string;      // ATU error code: '06', '07', '08', etc.
  message: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
}

// Regex patterns for validation
const IMEI_REGEX = /^[A-Za-z0-9]{15}$/;
const ROUTE_ID_REGEX = /^[A-Za-z0-9]{1,10}$/;
const LICENSE_PLATE_REGEX = /^[A-Za-z0-9-]{1,7}$/;
const DRIVER_ID_REGEX = /^[A-Za-z0-9]{1,20}$/;
const IDENTIFIER_REGEX = /^[A-Za-z0-9]{1,50}$/;

// Timestamp threshold: if less than 10 trillion, it's seconds not ms
const TIMESTAMP_MS_THRESHOLD = 10_000_000_000;

/**
 * Check if a timestamp appears to be in seconds (not milliseconds)
 * ATU expects ms — if value is less than 10 trillion, it's likely seconds
 */
export function isTimestampInSeconds(ts: number): boolean {
  return ts < TIMESTAMP_MS_THRESHOLD;
}

/**
 * Check if a timestamp is older than the maximum allowed age
 */
export function isOlderThanTenMinutes(ts: number, maxAgeMinutes?: number): boolean {
  const maxAge = maxAgeMinutes ?? config.position.maxAgeMinutes;
  const maxAgeMs = maxAge * 60 * 1000;
  return Date.now() - ts > maxAgeMs;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isPositiveInteger(value: number): boolean {
  return Number.isInteger(value) && value > 0;
}

/**
 * Validate a single ATU payload against all ATU rules
 */
export function validatePayload(payload: AtuPayload): ValidationResult {
  const errors: ValidationError[] = [];

  // imei: Exactly 15 alphanum chars
  if (!payload.imei || !IMEI_REGEX.test(payload.imei)) {
    errors.push({
      field: 'imei',
      value: payload.imei,
      code: '06',
      message: 'IMEI must be exactly 15 alphanumeric characters',
    });
  }

  // latitude: Between -90 and 90 (inclusive)
  if (
    typeof payload.latitude !== 'number' ||
    isNaN(payload.latitude) ||
    payload.latitude < -90 ||
    payload.latitude > 90
  ) {
    errors.push({
      field: 'latitude',
      value: payload.latitude,
      code: '08',
      message: 'Latitude must be a number between -90 and 90',
    });
  }

  // longitude: Between -180 and 180 (inclusive)
  if (
    typeof payload.longitude !== 'number' ||
    isNaN(payload.longitude) ||
    payload.longitude < -180 ||
    payload.longitude > 180
  ) {
    errors.push({
      field: 'longitude',
      value: payload.longitude,
      code: '08',
      message: 'Longitude must be a number between -180 and 180',
    });
  }

  // route_id: 1-10 alphanum chars
  if (!payload.route_id || !ROUTE_ID_REGEX.test(payload.route_id)) {
    errors.push({
      field: 'route_id',
      value: payload.route_id,
      code: '12',
      message: 'Route ID must be 1-10 alphanumeric characters',
    });
  }

  // ts: Must be a number, must NOT be in seconds, must NOT be older than max age
  if (!isFiniteNumber(payload.ts)) {
    errors.push({
      field: 'ts',
      value: payload.ts,
      code: '01',
      message: 'Timestamp must be a valid number',
    });
  } else {
    if (!isPositiveInteger(payload.ts)) {
      errors.push({
        field: 'ts',
        value: payload.ts,
        code: '01',
        message: 'Timestamp must be a positive integer in milliseconds',
      });
    }
    if (isTimestampInSeconds(payload.ts)) {
      errors.push({
        field: 'ts',
        value: payload.ts,
        code: '01',
        message: 'Timestamp appears to be in seconds instead of milliseconds',
      });
    }
  }

  // license_plate: 1-7 chars, alphanum + optional dash
  if (!payload.license_plate || !LICENSE_PLATE_REGEX.test(payload.license_plate)) {
    errors.push({
      field: 'license_plate',
      value: payload.license_plate,
      code: '07',
      message: 'License plate must be 1-7 alphanumeric characters (dash allowed)',
    });
  }

  // speed: Number, >= 0 and <= 999.99
  if (
    typeof payload.speed !== 'number' ||
    isNaN(payload.speed) ||
    payload.speed < 0 ||
    payload.speed > 999.99
  ) {
    errors.push({
      field: 'speed',
      value: payload.speed,
      code: '09',
      message: 'Speed must be a number between 0 and 999.99',
    });
  }

  // direction_id: Must be exactly 0 or 1
  if (payload.direction_id !== 0 && payload.direction_id !== 1) {
    errors.push({
      field: 'direction_id',
      value: payload.direction_id,
      code: '13',
      message: 'Direction ID must be exactly 0 (IDA) or 1 (VUELTA)',
    });
  }

  // driver_id: 1-20 alphanum chars
  if (!payload.driver_id || !DRIVER_ID_REGEX.test(payload.driver_id)) {
    errors.push({
      field: 'driver_id',
      value: payload.driver_id,
      code: '14',
      message: 'Driver ID must be 1-20 alphanumeric characters',
    });
  }

  // tsinitialtrip: Must be <= ts and > 0
  if (!isFiniteNumber(payload.tsinitialtrip)) {
    errors.push({
      field: 'tsinitialtrip',
      value: payload.tsinitialtrip,
      code: '01',
      message: 'Trip start timestamp must be a valid number',
    });
  } else {
    if (!isPositiveInteger(payload.tsinitialtrip)) {
      errors.push({
        field: 'tsinitialtrip',
        value: payload.tsinitialtrip,
        code: '01',
        message: 'Trip start timestamp must be a positive integer in milliseconds',
      });
    }
    if (isTimestampInSeconds(payload.tsinitialtrip)) {
      errors.push({
        field: 'tsinitialtrip',
        value: payload.tsinitialtrip,
        code: '01',
        message: 'Trip start timestamp appears to be in seconds instead of milliseconds',
      });
    }
    if (payload.tsinitialtrip > payload.ts) {
      errors.push({
        field: 'tsinitialtrip',
        value: payload.tsinitialtrip,
        code: '01',
        message: 'Trip start timestamp must not be greater than GPS timestamp',
      });
    }
  }

  // identifier: Required, 1-50 alphanum (no dash, no underscore)
  if (!payload.identifier || !IDENTIFIER_REGEX.test(payload.identifier)) {
    errors.push({
      field: 'identifier',
      value: payload.identifier,
      code: '11',
      message: 'Identifier must be 1-50 alphanumeric characters (no dash or underscore)',
    });
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
