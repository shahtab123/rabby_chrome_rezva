import { canPayFromResponse } from './validate';
import type { RezvaResolveResponse, RezvaSafetyDecision } from './types';

/** Active mappings with a destination change inside this window get Cancel/Continue. */
export const RECENT_CHANGE_WINDOW_MS = 24 * 60 * 60 * 1000;
export const RECENT_REGISTRATION_WINDOW_MS = 24 * 60 * 60 * 1000;

function ageMs(iso: string | null | undefined, now: number): number | null {
  if (!iso) return null;
  const ts = Date.parse(iso);
  if (Number.isNaN(ts)) return null;
  return Math.max(0, now - ts);
}

export function isRecentlyChanged(
  response: RezvaResolveResponse,
  now = Date.now(),
  windowMs = RECENT_CHANGE_WINDOW_MS
): boolean {
  const age = ageMs(response.registration.last_payment_update, now);
  return age !== null && age < windowMs;
}

export function isRecentlyRegistered(
  response: RezvaResolveResponse,
  now = Date.now(),
  windowMs = RECENT_REGISTRATION_WINDOW_MS
): boolean {
  const age = ageMs(
    response.registration.activated_at || response.registration.registered_at,
    now
  );
  return age !== null && age < windowMs;
}

export function evaluateSafety(
  response: RezvaResolveResponse,
  now = Date.now()
): RezvaSafetyDecision {
  switch (response.status) {
    case 'pending':
      return { action: 'block', reason: 'pending' };
    case 'update_pending':
      return { action: 'block', reason: 'update_pending' };
    case 'suspended':
      return { action: 'block', reason: 'suspended' };
    case 'removed':
      return { action: 'block', reason: 'removed' };
    case 'revoked':
      return { action: 'block', reason: 'revoked' };
    case 'active':
      break;
    default:
      return { action: 'block', reason: 'not_payment_ready' };
  }

  if (!canPayFromResponse(response)) {
    return { action: 'block', reason: 'no_payable_option' };
  }

  const recentlyChanged = isRecentlyChanged(response, now);
  const recentlyRegistered = isRecentlyRegistered(response, now);

  if (recentlyChanged) {
    return { action: 'warn-continue', reason: 'recently_changed' };
  }

  return {
    action: 'pay',
    recentlyChanged: false,
    recentlyRegistered,
  };
}

export function safetyMessage(decision: RezvaSafetyDecision): string {
  if (decision.action === 'warn-continue') {
    return 'Payment destination changed recently.';
  }
  if (decision.action === 'pay') {
    return '';
  }
  switch (decision.reason) {
    case 'pending':
      return 'This payment identifier is not currently payment-ready.';
    case 'update_pending':
      return 'Payment destination recently changed. Verify before sending.';
    case 'suspended':
      return 'This identifier has been suspended and cannot be used for normal payment.';
    case 'removed':
      return 'This identifier has been removed and is unavailable.';
    case 'revoked':
      return 'This identifier has been revoked and cannot be used for payment.';
    case 'not_payment_ready':
    case 'no_payable_option':
      return 'This identifier is not currently payment-ready.';
    default:
      return 'This identifier cannot be used for payment.';
  }
}

/** Compact copy for the Send resolve panel. */
export function displaySafetyMessage(
  decision: RezvaSafetyDecision | null
): string {
  if (!decision) return '';
  if (decision.action === 'warn-continue') {
    return 'Payment destination changed recently.';
  }
  if (decision.action === 'block') {
    if (decision.reason === 'pending') {
      return 'Registration pending';
    }
    if (decision.reason === 'update_pending') {
      return 'Payment destination changed recently.';
    }
    return safetyMessage(decision);
  }
  return '';
}
