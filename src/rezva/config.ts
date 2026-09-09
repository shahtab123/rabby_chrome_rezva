import {
  defaultRezvaApiBaseUrl,
  REZVA_LOCAL_API_BASE_URL,
  REZVA_PRODUCTION_API_BASE_URL,
} from './defaults';

export type RezvaRuntimeConfig = {
  apiKey: string;
  apiBaseUrl: string;
};

export type RezvaPublicConfig = {
  configured: boolean;
  apiBaseUrl: string;
  keyPrefix: string;
};

export {
  REZVA_LOCAL_API_BASE_URL,
  REZVA_PRODUCTION_API_BASE_URL,
  defaultRezvaApiBaseUrl,
};

const STORAGE_KEY = 'rezvaConfig';

/**
 * OpenAPI bearerAuth accepts an approved provider API key or a Free API
 * resolver key. Prefer the provider credential when both are present locally.
 */
function readProcessEnv(): RezvaRuntimeConfig {
  const apiKey = String(
    process.env.REZVA_PROVIDER_API_KEY ||
      process.env.REZVA_API_KEY ||
      process.env.REZVA_FREE_API_KEY ||
      ''
  ).trim();
  // Explicit env wins; otherwise debug → local, release → production.
  const explicit = String(process.env.REZVA_API_BASE_URL || '').trim();
  const apiBaseUrl = explicit || defaultRezvaApiBaseUrl();
  return { apiKey, apiBaseUrl };
}

function keyPrefix(apiKey: string): string {
  if (!apiKey) return '';
  return apiKey.length <= 12
    ? `${apiKey.slice(0, 4)}…`
    : `${apiKey.slice(0, 12)}…`;
}

export async function getRezvaRuntimeConfig(storage?: {
  get: (key: string) => Promise<Record<string, unknown>>;
}): Promise<RezvaRuntimeConfig> {
  const fromEnv = readProcessEnv();
  let stored: Partial<RezvaRuntimeConfig> = {};
  try {
    const store = storage ?? (globalThis as any)?.chrome?.storage?.local;
    if (store?.get) {
      const result = await store.get(STORAGE_KEY);
      stored = (result?.[STORAGE_KEY] ||
        result ||
        {}) as Partial<RezvaRuntimeConfig>;
    }
  } catch {
    // Tests and environments without chrome.storage fall back to env.
  }
  return {
    apiKey: String(stored.apiKey || fromEnv.apiKey || '').trim(),
    apiBaseUrl: String(stored.apiBaseUrl || fromEnv.apiBaseUrl || '').trim(),
  };
}

export async function setRezvaRuntimeConfig(
  next: Partial<RezvaRuntimeConfig>,
  storage?: { set: (items: Record<string, unknown>) => Promise<void> }
): Promise<RezvaPublicConfig> {
  const current = await getRezvaRuntimeConfig(
    storage as
      | { get: (key: string) => Promise<Record<string, unknown>> }
      | undefined
  );
  const merged: RezvaRuntimeConfig = {
    apiKey: next.apiKey !== undefined ? next.apiKey.trim() : current.apiKey,
    apiBaseUrl:
      next.apiBaseUrl !== undefined
        ? next.apiBaseUrl.trim()
        : current.apiBaseUrl,
  };
  const store = storage ?? (globalThis as any)?.chrome?.storage?.local;
  if (!store?.set) {
    throw new Error('Rezva config storage is unavailable.');
  }
  await store.set({ [STORAGE_KEY]: merged });
  return toPublicConfig(merged);
}

export function toPublicConfig(config: RezvaRuntimeConfig): RezvaPublicConfig {
  return {
    configured: Boolean(config.apiKey),
    apiBaseUrl: config.apiBaseUrl,
    keyPrefix: keyPrefix(config.apiKey),
  };
}

export async function getRezvaPublicConfig(storage?: {
  get: (key: string) => Promise<Record<string, unknown>>;
}): Promise<RezvaPublicConfig> {
  return toPublicConfig(await getRezvaRuntimeConfig(storage));
}

/**
 * QR payloads may already include `/v1/resolve`.
 * Configured base URLs should not grow a nested `/v1/v1/resolve`.
 */
export function toResolveEndpoint(resolverUrl: string): string {
  const trimmed = resolverUrl.trim().replace(/\/+$/, '');
  if (!trimmed) return '';
  if (/\/v1\/resolve$/i.test(trimmed)) {
    return trimmed;
  }
  return `${trimmed}/v1/resolve`;
}
