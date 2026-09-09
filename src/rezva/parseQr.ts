import type { RezvaQrPayload } from './types';

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

/**
 * Parse a Rezva QR / identifier carrier.
 * Documented payload: { resolver_url, type, value }
 */
export function parseRezvaQr(raw: string): RezvaQrPayload | null {
  const trimmed = raw?.trim();
  if (!trimmed) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    return null;
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return null;
  }

  const payload = parsed as Partial<RezvaQrPayload>;
  if (
    !isNonEmptyString(payload.resolver_url) ||
    !isNonEmptyString(payload.type) ||
    !isNonEmptyString(payload.value)
  ) {
    return null;
  }

  return {
    resolver_url: payload.resolver_url.trim(),
    type: payload.type.trim(),
    value: payload.value.trim(),
  };
}

export function isRezvaQrPayload(raw: string): boolean {
  return parseRezvaQr(raw) !== null;
}
