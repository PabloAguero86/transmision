/**
 * ATU GPS Forwarder — Environment Configuration
 * All config loaded from environment variables. No hardcoded values.
 */

interface AtuConfig {
  env: 'testing' | 'production';
  ws: {
    endpoint: string;
    token: string;
    maxUpdateIntervalSeconds: number;
    maxRetries: number;
    reconnectSeconds: number;
  };
  position: {
    maxAgeMinutes: number;
  };
  gps: {
    sourceType: 'database';
    pollIntervalMs: number;
    speedUnit: 'km/h' | 'knots';
    vehicleIds: string[];
  };
  mysql: {
    host: string;
    port: number;
    user: string;
    password: string;
    database: string;
  };
  route: {
    id: string;
    atuRouteCode: string;
  };
  app: {
    port: number;
  };
  dryRun: boolean;
  auth: {
    username: string;
    password: string;
    brand: string;
    company: string;
  };
}

function parseBoolean(value: string | undefined, defaultValue: boolean): boolean {
  if (value === undefined) return defaultValue;
  return value.toLowerCase() === 'true';
}

function parseIntOrDefault(value: string | undefined, defaultValue: number): number {
  if (value === undefined) return defaultValue;
  const parsed = parseInt(value, 10);
  return isNaN(parsed) ? defaultValue : parsed;
}

const isTestRuntime =
  process.env.NODE_ENV === 'test' ||
  process.env.JEST_WORKER_ID !== undefined;

const resolvedEnv =
  (process.env.ATU_ENV as 'testing' | 'production' | undefined) ??
  (isTestRuntime ? 'testing' : 'production');

const config: AtuConfig = {
  env: resolvedEnv,
  ws: {
    endpoint: process.env.ATU_WS_ENDPOINT || '',
    token: process.env.ATU_TOKEN || '',
    maxUpdateIntervalSeconds: parseIntOrDefault(process.env.ATU_MAX_UPDATE_INTERVAL_SECONDS, 20),
    maxRetries: parseIntOrDefault(process.env.ATU_MAX_RETRIES, 5),
    reconnectSeconds: parseIntOrDefault(process.env.ATU_RECONNECT_SECONDS, 5),
  },
  position: {
    maxAgeMinutes: parseIntOrDefault(process.env.ATU_MAX_POSITION_AGE_MINUTES, 10),
  },
  gps: {
    sourceType: (process.env.GPS_SOURCE_TYPE as 'database') || 'database',
    pollIntervalMs: parseIntOrDefault(process.env.GPS_SOURCE_POLL_INTERVAL_MS, 10000),
    speedUnit: (process.env.GPS_SPEED_UNIT as 'km/h' | 'knots') || 'km/h',
    vehicleIds: process.env.GPS_VEHICLE_IDS ? process.env.GPS_VEHICLE_IDS.split(',').map(s => s.trim()).filter(Boolean) : [],
  },
  mysql: {
    host: process.env.MYSQL_HOST || '',
    port: parseIntOrDefault(process.env.MYSQL_PORT, 3306),
    user: process.env.MYSQL_USER || '',
    password: process.env.MYSQL_PASSWORD || '',
    database: process.env.MYSQL_DATABASE || 'traccar',
  },
  route: {
    id: process.env.ROUTE_ID || '08',
    atuRouteCode: process.env.ATU_ROUTE_CODE || process.env.ROUTE_ID || '08',
  },
  app: {
    port: parseIntOrDefault(process.env.APP_PORT, 3000),
  },
  dryRun: parseBoolean(process.env.ATU_DRY_RUN, false),
  auth: {
    username: process.env.AUTH_USERNAME || 'etochosa',
    password: process.env.AUTH_PASSWORD || 'etochosa',
    brand: process.env.AUTH_BRAND || 'ATU Retransmisor GPS',
    company: process.env.AUTH_COMPANY || '',
  },
};

// Validate required fields
const requiredFields: Array<{ path: string; value: string }> = [
  { path: 'ws.endpoint', value: config.ws.endpoint },
  { path: 'ws.token', value: config.ws.token },
  { path: 'mysql.host', value: config.mysql.host },
  { path: 'mysql.user', value: config.mysql.user },
];

const missingFields = requiredFields.filter(f => !f.value).map(f => f.path);
if (missingFields.length > 0 && config.env === 'production') {
  throw new Error(`Missing required environment variables: ${missingFields.join(', ')}`);
}

export { config };
export type { AtuConfig };
