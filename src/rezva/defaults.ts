/**
 * Configurable Rezva API base URLs.
 * Resolve code must not hardcode these — defaults come from build mode + env.
 */
export const REZVA_PRODUCTION_API_BASE_URL =
  'https://universal-payment-api.sabrishahtab.workers.dev';

/** Local/debug API (PC only). Requires the Rezva API running locally. */
export const REZVA_LOCAL_API_BASE_URL = 'http://127.0.0.1:8787';

/**
 * Default API base when REZVA_API_BASE_URL is unset.
 * - DEBUG webpack builds (dev/debug) → local
 * - production/release builds → production Worker
 */
export function defaultRezvaApiBaseUrl(): string {
  // Injected by webpack DefinePlugin for Rabby builds.
  if (process.env.DEBUG) {
    return REZVA_LOCAL_API_BASE_URL;
  }
  return REZVA_PRODUCTION_API_BASE_URL;
}
