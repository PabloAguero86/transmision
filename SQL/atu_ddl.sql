-- ============================================================
-- ATU GPS FORWARDER — DDL Scripts (Reference Only)
-- ============================================================
-- IMPORTANT: You MUST run these SQL scripts manually on your
-- MySQL server (161.132.49.33) BEFORE starting the forwarder.
-- The system will NOT create these tables automatically.
--
-- Run this file from MySQL CLI or your preferred DB tool:
--   mysql -h 161.132.49.33 -u datatransgps1985 -p traccar < SQL/atu_ddl.sql
-- ============================================================

-- ------------------------------------------------------------
-- Table: atu_transmissions
-- Purpose: Log every transmission attempt and ATU response
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS atu_transmissions (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  imei            VARCHAR(15) NOT NULL COMMENT 'GPS device IMEI (15 chars)',
  license_plate   VARCHAR(7) NOT NULL COMMENT 'Vehicle plate (max 7 chars)',
  route_id        VARCHAR(10) NOT NULL COMMENT 'Route code (max 10 chars)',
  driver_id       VARCHAR(20) COMMENT 'Driver document ID',
  direction_id    TINYINT NOT NULL COMMENT '0=IDA, 1=VUELTA',
  latitude        DECIMAL(10, 7) NOT NULL COMMENT 'GPS latitude (-90 to 90)',
  longitude       DECIMAL(11, 7) NOT NULL COMMENT 'GPS longitude (-180 to 180)',
  speed           DECIMAL(7, 3) NOT NULL COMMENT 'Speed in km/h (0 to 999.99)',
  ts              BIGINT NOT NULL COMMENT 'GPS timestamp in milliseconds UTC',
  tsinitialtrip   BIGINT NOT NULL COMMENT 'Trip start timestamp in ms UTC',
  identifier      VARCHAR(50) NOT NULL COMMENT 'Unique frame identifier',
  payload_json    TEXT NOT NULL COMMENT 'Full JSON payload sent to ATU',
  status          ENUM(
    'pending',
    'normalized',
    'validation_failed',
    'pending_send',
    'sent',
    'accepted_by_atu',
    'rejected_by_atu',
    'token_error',
    'websocket_error',
    'expired',
    'skipped',
    'retry_pending'
  ) NOT NULL DEFAULT 'pending' COMMENT 'Current transmission status',
  validation_error TEXT COMMENT 'Validation error details if failed',
  atu_response_code VARCHAR(5) COMMENT 'ATU response code (00, 01, 03, 05-14)',
  atu_response_message VARCHAR(255) COMMENT 'ATU response description',
  latency_ms      INT COMMENT 'Round-trip latency in milliseconds',
  retry_count      INT DEFAULT 0 COMMENT 'Number of retry attempts',
  created_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  INDEX idx_imei (imei),
  INDEX idx_status (status),
  INDEX idx_created_at (created_at),
  INDEX idx_identifier (identifier),
  INDEX idx_route_id (route_id),
  INDEX idx_license_plate (license_plate)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='ATU GPS transmission audit log';

-- ------------------------------------------------------------
-- Table: atu_system_alerts
-- Purpose: System alerts and notifications
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS atu_system_alerts (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  severity        ENUM('info', 'warning', 'critical') NOT NULL COMMENT 'Alert severity level',
  type            VARCHAR(50) NOT NULL COMMENT 'Alert type identifier',
  title           VARCHAR(255) NOT NULL COMMENT 'Short alert title',
  message         TEXT NOT NULL COMMENT 'Full alert message',
  status          ENUM('active', 'resolved') DEFAULT 'active' COMMENT 'Alert status',
  created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  resolved_at     TIMESTAMP NULL COMMENT 'When the alert was resolved',

  INDEX idx_severity (severity),
  INDEX idx_status (status),
  INDEX idx_created_at (created_at),
  INDEX idx_type (type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='ATU forwarder system alerts';

-- ------------------------------------------------------------
-- Table: atu_imei_change_logs
-- Purpose: Audit log for IMEI device changes
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS atu_imei_change_logs (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  license_plate   VARCHAR(7) NOT NULL COMMENT 'Vehicle plate',
  old_imei        VARCHAR(15) COMMENT 'Previous IMEI (null if new)',
  new_imei        VARCHAR(15) NOT NULL COMMENT 'New IMEI (15 chars validated)',
  changed_by      VARCHAR(100) COMMENT 'User who made the change',
  reason          VARCHAR(255) COMMENT 'Reason for the change',
  changed_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  INDEX idx_license_plate (license_plate),
  INDEX idx_changed_at (changed_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='IMEI change audit trail for ATU forwarder';

-- ------------------------------------------------------------
-- Table: atu_config
-- Purpose: ATU configuration (if using DB-based config)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS atu_config (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  environment     ENUM('testing', 'production') NOT NULL DEFAULT 'testing',
  endpoint        VARCHAR(255) NOT NULL COMMENT 'ATU WebSocket endpoint URL',
  token_encrypted TEXT COMMENT 'Encrypted ATU token (optional)',
  active          TINYINT DEFAULT 1 COMMENT 'Is this config active',
  created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  INDEX idx_environment (environment),
  INDEX idx_active (active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='ATU forwarder configuration storage';

-- ------------------------------------------------------------
-- Table: atu_vehicles (optional — for fleet management)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS atu_vehicles (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  license_plate   VARCHAR(7) NOT NULL UNIQUE COMMENT 'Vehicle plate',
  imei            VARCHAR(15) NOT NULL COMMENT 'GPS device IMEI',
  route_id        VARCHAR(10) NOT NULL COMMENT 'Assigned route',
  in_service      TINYINT DEFAULT 0 COMMENT 'Currently in service (1=yes)',
  status          ENUM('active', 'inactive', 'maintenance') DEFAULT 'active',
  created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  INDEX idx_imei (imei),
  INDEX idx_route_id (route_id),
  INDEX idx_in_service (in_service)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='ATU forwarder vehicle fleet registry';

-- ============================================================
-- QUICK VERIFICATION
-- After running, verify tables exist:
--   SHOW TABLES LIKE 'atu_%';
-- ============================================================