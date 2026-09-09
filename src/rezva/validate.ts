import { REZVA_RESOLVE_STATUSES, RezvaError } from './types';
import type {
  RezvaPaymentOption,
  RezvaResolveResponse,
  RezvaResolveStatus,
} from './types';

function isObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function optionalString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

function optionalNullableString(value: unknown): string | null | undefined {
  if (value === null) return null;
  if (typeof value === 'string') return value;
  return undefined;
}

function parsePaymentOption(value: unknown): RezvaPaymentOption | null {
  if (!isObject(value)) return null;
  if (
    typeof value.chain !== 'string' ||
    typeof value.asset !== 'string' ||
    typeof value.address !== 'string' ||
    typeof value.payment_ready !== 'boolean'
  ) {
    return null;
  }
  return {
    chain: value.chain,
    asset: value.asset,
    address: value.address,
    payment_ready: value.payment_ready,
    token_contract: optionalString(value.token_contract),
    network_identifier: optionalString(value.network_identifier),
    memo: optionalString(value.memo),
    payment_reference: optionalString(value.payment_reference),
    minimum_amount: optionalString(value.minimum_amount),
    maximum_amount: optionalString(value.maximum_amount),
    fixed_amount: optionalString(value.fixed_amount),
    expiration: optionalString(value.expiration),
  };
}

export function validateResolveResponse(body: unknown): RezvaResolveResponse {
  if (!isObject(body)) {
    throw new RezvaError(
      'INVALID_RESPONSE',
      'Resolver returned a non-object body.'
    );
  }

  if (typeof body.protocol_version !== 'string' || !body.protocol_version) {
    throw new RezvaError(
      'INVALID_RESPONSE',
      'Resolver response is missing protocol_version.'
    );
  }

  if (
    typeof body.status !== 'string' ||
    !REZVA_RESOLVE_STATUSES.includes(body.status as RezvaResolveStatus)
  ) {
    throw new RezvaError(
      'INVALID_RESPONSE',
      'Resolver response has an unknown or missing status.'
    );
  }

  if (typeof body.payment_ready !== 'boolean') {
    throw new RezvaError(
      'INVALID_RESPONSE',
      'Resolver response is missing payment_ready.'
    );
  }

  if (
    !isObject(body.identifier) ||
    typeof body.identifier.type !== 'string' ||
    typeof body.identifier.value !== 'string'
  ) {
    throw new RezvaError(
      'INVALID_RESPONSE',
      'Resolver response is missing identifier.type/value.'
    );
  }

  if (!isObject(body.registration)) {
    throw new RezvaError(
      'INVALID_RESPONSE',
      'Resolver response is missing registration metadata.'
    );
  }

  if (!Array.isArray(body.payment_options)) {
    throw new RezvaError(
      'INVALID_RESPONSE',
      'Resolver response is missing payment_options.'
    );
  }

  const payment_options: RezvaPaymentOption[] = [];
  for (const option of body.payment_options) {
    const parsed = parsePaymentOption(option);
    if (!parsed) {
      throw new RezvaError(
        'INVALID_RESPONSE',
        'Resolver returned a malformed payment option.'
      );
    }
    payment_options.push(parsed);
  }

  const registration = body.registration;
  const trust = isObject(body.trust)
    ? {
        warnings: Array.isArray(body.trust.warnings)
          ? body.trust.warnings.filter(
              (item): item is string => typeof item === 'string'
            )
          : undefined,
      }
    : undefined;

  const profile = isObject(body.profile)
    ? { name: optionalString(body.profile.name) }
    : undefined;

  return {
    protocol_version: body.protocol_version,
    status: body.status as RezvaResolveStatus,
    payment_ready: body.payment_ready,
    identifier: {
      type: body.identifier.type,
      value: body.identifier.value,
      normalized_value: optionalString(body.identifier.normalized_value),
    },
    registration: {
      registered_at: optionalNullableString(registration.registered_at),
      activated_at: optionalNullableString(registration.activated_at),
      last_updated: optionalNullableString(registration.last_updated),
      last_payment_update: optionalNullableString(
        registration.last_payment_update
      ),
    },
    payment_options,
    trust,
    profile,
    pending_destination: isObject(body.pending_destination)
      ? body.pending_destination
      : body.pending_destination === null
      ? null
      : undefined,
    available_at: optionalNullableString(body.available_at),
    removal_kind: optionalString(body.removal_kind),
  };
}

export function canPayFromResponse(response: RezvaResolveResponse): boolean {
  return (
    response.status === 'active' &&
    response.payment_ready === true &&
    response.payment_options.some((option) => option.payment_ready === true)
  );
}
