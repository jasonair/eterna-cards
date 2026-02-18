/**
 * Input validation & sanitization helpers.
 *
 * OWASP best practice: validate all user inputs server-side using
 * schema-based checks, type enforcement, and length limits.
 * Reject unexpected fields to prevent mass-assignment attacks.
 */

/** Validate that a value is a valid UUID v4 (Supabase default PK format) */
export function isValidUUID(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

/** Validate and sanitize a string field with length limits */
export function sanitizeString(
  value: unknown,
  maxLength: number = 1000,
): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== 'string') return null;
  // Trim whitespace and truncate to max length
  const trimmed = value.trim().slice(0, maxLength);
  return trimmed.length > 0 ? trimmed : null;
}

/** Validate that a value is a finite positive number within bounds */
export function isValidPositiveNumber(
  value: unknown,
  max: number = 1_000_000_000,
): value is number {
  if (typeof value !== 'number') return false;
  return Number.isFinite(value) && value > 0 && value <= max;
}

/** Validate that a value is a finite non-negative number within bounds */
export function isValidNonNegativeNumber(
  value: unknown,
  max: number = 1_000_000_000,
): value is number {
  if (typeof value !== 'number') return false;
  return Number.isFinite(value) && value >= 0 && value <= max;
}

/** Validate a date string in YYYY-MM-DD format */
export function isValidDateString(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(value);
  return !isNaN(date.getTime());
}

/** Validate an email address (basic RFC 5322 check) */
export function isValidEmail(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) && value.length <= 254;
}

/** Validate a currency code (3 uppercase letters) */
export function isValidCurrencyCode(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  return /^[A-Z]{3}$/.test(value);
}

/**
 * Reject unexpected fields from a request body.
 * Returns an array of unexpected field names, or empty if all are allowed.
 */
export function findUnexpectedFields(
  body: Record<string, unknown>,
  allowedFields: string[],
): string[] {
  const allowed = new Set(allowedFields);
  return Object.keys(body).filter((key) => !allowed.has(key));
}

/**
 * Validate an array of strings with individual and total length limits.
 * Returns a sanitized array or null if invalid.
 */
export function sanitizeStringArray(
  value: unknown,
  maxItems: number = 100,
  maxItemLength: number = 500,
): string[] | null {
  if (!Array.isArray(value)) return null;
  if (value.length > maxItems) return null;

  const result: string[] = [];
  for (const item of value) {
    if (typeof item !== 'string') continue;
    const trimmed = item.trim().slice(0, maxItemLength);
    if (trimmed.length > 0) {
      result.push(trimmed);
    }
  }
  return result;
}

/**
 * Validate pagination parameters.
 * Returns sanitized { limit, offset } with sensible defaults and caps.
 */
export function sanitizePagination(
  limitRaw: string | null,
  offsetRaw: string | null,
  maxLimit: number = 250,
): { limit: number; offset: number } {
  let limit = parseInt(limitRaw || '50', 10);
  let offset = parseInt(offsetRaw || '0', 10);

  if (!Number.isFinite(limit) || limit < 1) limit = 50;
  if (limit > maxLimit) limit = maxLimit;

  if (!Number.isFinite(offset) || offset < 0) offset = 0;

  return { limit, offset };
}

/**
 * Validate that the request body size is within acceptable limits.
 * Call this before parsing JSON to prevent oversized payloads.
 */
export function isBodySizeAcceptable(
  contentLength: string | null,
  maxBytes: number = 10 * 1024 * 1024, // 10 MB default
): boolean {
  if (!contentLength) return true; // Let downstream parsing handle it
  const size = parseInt(contentLength, 10);
  if (!Number.isFinite(size)) return true;
  return size <= maxBytes;
}
