/**
 * Retry Manager
 * Manages retries for technical failures with exponential backoff
 */

export interface RetryOptions {
  maxRetries: number;
  baseDelayMs: number;
}

const DEFAULT_MAX_RETRIES = 5;
const DEFAULT_BASE_DELAY_MS = 1000; // 1 second base

/**
 * Error types that determine retryability
 */
export type ErrorType = 'technical' | 'functional';

/**
 * Technical errors that are retryable
 */
const RETRYABLE_ERROR_PATTERNS = [
  'WebSocket not connected',
  'Connection timeout',
  'Connection refused',
  'ETIMEDOUT',
  'ENOTFOUND',
  'ECONNREFUSED',
  'socket hang up',
  'NetworkError',
  'Failed to fetch',
];

/**
 * Functional errors that are NOT retryable
 */
const NON_RETRYABLE_CODES = ['00', '01', '03', '05', '06', '07', '08', '09', '10', '11', '12', '13', '14'];

/**
 * Check if an error is technical (retryable) based on message
 */
function isTechnicalError(errorMessage: string): boolean {
  return RETRYABLE_ERROR_PATTERNS.some(pattern => 
    errorMessage.toLowerCase().includes(pattern.toLowerCase())
  );
}

/**
 * Check if an ATU response code is technical (retryable)
 */
export function isRetryableCode(code: string): boolean {
  // ATU codes 00 is success, 01 is format error, 03 is token invalid
  // Codes 05-14 are validation errors - not retryable
  return code === '16' || code === '17' || code === '99';
}

export class RetryManager {
  private retryCount: Map<string, number> = new Map(); // identifier → count
  private retryScheduled: Map<string, number> = new Map(); // identifier → scheduled timestamp
  private options: RetryOptions;

  constructor(options?: Partial<RetryOptions>) {
    this.options = {
      maxRetries: options?.maxRetries ?? DEFAULT_MAX_RETRIES,
      baseDelayMs: options?.baseDelayMs ?? DEFAULT_BASE_DELAY_MS,
    };
  }

  /**
   * Determine if an error is technical or functional
   */
  classifyError(error: string | { code?: string; message?: string }): ErrorType {
    if (typeof error === 'string') {
      return isTechnicalError(error) ? 'technical' : 'functional';
    }

    // If we have an ATU code, check it
    if (error.code) {
      if (NON_RETRYABLE_CODES.includes(error.code)) {
        return 'functional';
      }
      if (isRetryableCode(error.code)) {
        return 'technical';
      }
    }

    // Fall back to message-based classification
    if (error.message) {
      return isTechnicalError(error.message) ? 'technical' : 'functional';
    }

    return 'technical'; // default to technical for unknown errors
  }

  /**
   * Check if we should retry an identifier
   */
  shouldRetry(identifier: string, errorType: ErrorType): boolean {
    // Functional errors never retry
    if (errorType === 'functional') {
      return false;
    }

    // Check retry count
    const count = this.retryCount.get(identifier) ?? 0;
    return count < this.options.maxRetries;
  }

  /**
   * Check if a retry is already scheduled for this identifier
   */
  isRetryScheduled(identifier: string): boolean {
    const scheduled = this.retryScheduled.get(identifier);
    if (scheduled === undefined) return false;
    return Date.now() < scheduled;
  }

  /**
   * Get remaining time until retry is available
   */
  getRetryDelayMs(identifier: string): number {
    const scheduled = this.retryScheduled.get(identifier);
    if (scheduled === undefined) return 0;
    return Math.max(0, scheduled - Date.now());
  }

  /**
   * Record a retry attempt
   */
  recordRetry(identifier: string): void {
    const count = (this.retryCount.get(identifier) ?? 0) + 1;
    this.retryCount.set(identifier, count);

    // Calculate next retry time with exponential backoff: 1s, 2s, 4s, 8s, 16s
    const delayMs = this.options.baseDelayMs * Math.pow(2, count - 1);
    const nextRetry = Date.now() + delayMs;
    this.retryScheduled.set(identifier, nextRetry);

    console.log(`[RetryManager] Scheduled retry #${count} for ${identifier} in ${delayMs}ms`);
  }

  /**
   * Reset retry state after successful transmission
   */
  resetRetry(identifier: string): void {
    this.retryCount.delete(identifier);
    this.retryScheduled.delete(identifier);
  }

  /**
   * Get current retry count for an identifier
   */
  getRetryCount(identifier: string): number {
    return this.retryCount.get(identifier) ?? 0;
  }

  /**
   * Check if max retries exceeded
   */
  hasExceededMaxRetries(identifier: string): boolean {
    return (this.retryCount.get(identifier) ?? 0) >= this.options.maxRetries;
  }

  /**
   * Get status info for an identifier
   */
  getStatus(identifier: string): {
    retryCount: number;
    hasExceededMaxRetries: boolean;
    isRetryScheduled: boolean;
    nextRetryMs: number;
  } {
    return {
      retryCount: this.getRetryCount(identifier),
      hasExceededMaxRetries: this.hasExceededMaxRetries(identifier),
      isRetryScheduled: this.isRetryScheduled(identifier),
      nextRetryMs: this.getRetryDelayMs(identifier),
    };
  }
}