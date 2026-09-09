const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ETH_ADDRESS_PATTERN = /^0x[a-fA-F0-9]{40}$/;
const EXTERNAL_CRYPTO_NAME_PATTERN = /\.(eth|sol|crypto|bitcoin|btc|base\.eth|arb)$/i;
const EXPLICIT_TYPE_PATTERN = /^([a-z][a-z0-9_]{1,32}):(.+)$/i;
const PROVIDER_NAME_PATTERN = /^[a-z0-9][a-z0-9_-]{0,62}\.[a-z][a-z0-9-]{1,62}$/i;
const CUSTOM_PATTERN = /^[a-z0-9._-]+$/;

const URL_LIKE_TYPES = new Set(['http', 'https', 'ftp', 'ws', 'wss', 'file']);

export function isBlockchainAddress(value: string): boolean {
  return ETH_ADDRESS_PATTERN.test(value.trim());
}

export function isLikelyEnsName(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed || ETH_ADDRESS_PATTERN.test(trimmed)) return false;
  return EXTERNAL_CRYPTO_NAME_PATTERN.test(trimmed);
}

export function parseExplicitIdentifier(
  value: string
): { type: string; value: string } | null {
  const trimmed = value.trim();
  const match = EXPLICIT_TYPE_PATTERN.exec(trimmed);
  if (!match) return null;
  const type = match[1].toLowerCase();
  const identifierValue = match[2].trim();
  if (URL_LIKE_TYPES.has(type) || !identifierValue) return null;
  if (ETH_ADDRESS_PATTERN.test(trimmed)) return null;
  return { type, value: identifierValue };
}

function looksLikeEmail(value: string): boolean {
  const normalized = value.trim().toLowerCase();
  return normalized.length <= 254 && EMAIL_PATTERN.test(normalized);
}

function looksLikePhone(value: string): boolean {
  const trimmed = value.trim();
  if (/^\+[1-9]\d{7,14}$/.test(trimmed.replace(/[\s()-]/g, ''))) {
    return true;
  }
  const digits = trimmed.replace(/\D/g, '');
  if (digits.startsWith('880') && digits.length === 13) return true;
  if (digits.startsWith('0') && digits.length === 11) return true;
  return false;
}

/** EMV Merchant-Presented Mode payloads start with Payload Format Indicator `000201`. */
const EMV_PAYLOAD_PREFIX = /^000201/;
const REZVA_IDENTIFIER_MAX_CHARS = 700;

function looksLikeBanglaQr(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > REZVA_IDENTIFIER_MAX_CHARS) return false;

  // Full Bangla / EMV QR text — resolve the exact string as bangla_qr.
  // Do not rewrite into a merchant ID or chain address.
  if (EMV_PAYLOAD_PREFIX.test(trimmed) && trimmed.length >= 16) {
    return true;
  }

  // Legacy short numeric bangla_qr values (still valid when registered as digits).
  const digits = trimmed.replace(/\D/g, '');
  return digits.length >= 8 && digits.length <= 32 && /^\d+$/.test(trimmed);
}

export { looksLikeBanglaQr, REZVA_IDENTIFIER_MAX_CHARS };

function looksLikeCustom(value: string): boolean {
  const normalized = value.trim().toLowerCase();
  if (normalized.length < 3 || normalized.length > 64) return false;
  if (!CUSTOM_PATTERN.test(normalized)) return false;
  if (ETH_ADDRESS_PATTERN.test(normalized)) return false;
  if (EXTERNAL_CRYPTO_NAME_PATTERN.test(normalized)) return false;
  return true;
}

function looksLikeProviderName(value: string): boolean {
  const trimmed = value.trim();
  if (EXTERNAL_CRYPTO_NAME_PATTERN.test(trimmed)) return false;
  return PROVIDER_NAME_PATTERN.test(trimmed);
}

function looksLikeMerchantId(value: string): boolean {
  const normalized = value.trim();
  return normalized.length >= 2 && normalized.length <= 64;
}

/**
 * Infer a Rezva identifier type from a typed value.
 * QR / explicit `type:value` payloads should supply type themselves.
 */
export function inferIdentifierType(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed || ETH_ADDRESS_PATTERN.test(trimmed)) return null;
  if (isLikelyEnsName(trimmed)) return null;

  const explicit = parseExplicitIdentifier(trimmed);
  if (explicit) return explicit.type;

  // EMV / Bangla QR before other heuristics — payloads are long and not addresses.
  if (looksLikeBanglaQr(trimmed)) return 'bangla_qr';

  if (looksLikeEmail(trimmed)) return 'email';
  if (looksLikePhone(trimmed)) return 'phone';
  if (looksLikeProviderName(trimmed)) return 'provider_name';
  if (looksLikeCustom(trimmed)) return 'custom';
  if (looksLikeMerchantId(trimmed)) return 'merchant_id';
  return null;
}

export function identifierValueForType(type: string, raw: string): string {
  const explicit = parseExplicitIdentifier(raw);
  if (explicit && explicit.type === type) {
    return explicit.value;
  }
  // bangla_qr: keep the registered EMV string as-is (trim ends only).
  return raw.trim();
}
