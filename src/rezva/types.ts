export const REZVA_RESOLVE_STATUSES = [
  'pending',
  'active',
  'update_pending',
  'suspended',
  'removed',
  'revoked',
] as const;

export type RezvaResolveStatus = typeof REZVA_RESOLVE_STATUSES[number];

export type RezvaQrPayload = {
  resolver_url: string;
  type: string;
  value: string;
};

export type RezvaIdentifier = {
  type: string;
  value: string;
  normalized_value?: string;
};

export type RezvaRegistration = {
  registered_at?: string | null;
  activated_at?: string | null;
  last_updated?: string | null;
  last_payment_update?: string | null;
};

export type RezvaPaymentOption = {
  chain: string;
  asset: string;
  address: string;
  payment_ready: boolean;
  token_contract?: string;
  network_identifier?: string;
  memo?: string;
  payment_reference?: string;
  minimum_amount?: string;
  maximum_amount?: string;
  fixed_amount?: string;
  expiration?: string;
};

export type RezvaResolveResponse = {
  protocol_version: string;
  status: RezvaResolveStatus;
  payment_ready: boolean;
  identifier: RezvaIdentifier;
  registration: RezvaRegistration;
  payment_options: RezvaPaymentOption[];
  trust?: {
    warnings?: string[];
  };
  profile?: {
    name?: string;
  };
  pending_destination?: Partial<RezvaPaymentOption> | null;
  available_at?: string | null;
  removal_kind?: string;
};

export type RezvaApiErrorBody = {
  error?: {
    code?: string;
    message?: string;
  };
};

export type RezvaErrorCode =
  | 'IDENTIFIER_NOT_FOUND'
  | 'IDENTIFIER_INVALID'
  | 'IDENTIFIER_PENDING'
  | 'IDENTIFIER_UPDATE_PENDING'
  | 'IDENTIFIER_SUSPENDED'
  | 'IDENTIFIER_REMOVED'
  | 'TYPE_NOT_SUPPORTED'
  | 'DESTINATION_UNAVAILABLE'
  | 'UNAUTHORIZED'
  | 'RATE_LIMITED'
  | 'FREE_API_RATE_LIMITED'
  | 'RESOLVER_ERROR'
  | 'INVALID_RESPONSE'
  | 'MISSING_API_KEY'
  | 'MISSING_RESOLVER_URL'
  | 'NETWORK_UNSUPPORTED';

export class RezvaError extends Error {
  readonly code: RezvaErrorCode;
  readonly httpStatus?: number;
  readonly retryAfterSeconds?: number;

  constructor(
    code: RezvaErrorCode,
    message: string,
    extras?: { httpStatus?: number; retryAfterSeconds?: number }
  ) {
    super(message);
    this.name = 'RezvaError';
    this.code = code;
    this.httpStatus = extras?.httpStatus;
    this.retryAfterSeconds = extras?.retryAfterSeconds;
  }
}

export type SerializedRezvaError = {
  name: string;
  message: string;
  code: RezvaErrorCode;
  httpStatus?: number;
  retryAfterSeconds?: number;
};

export function serializeRezvaError(
  error: RezvaError | null
): SerializedRezvaError | null {
  if (!error) return null;
  return {
    name: error.name,
    message: error.message,
    code: error.code,
    httpStatus: error.httpStatus,
    retryAfterSeconds: error.retryAfterSeconds,
  };
}

export type ClassifiedSendInput =
  | { kind: 'empty' }
  | { kind: 'address'; address: string }
  | { kind: 'ens'; name: string }
  | {
      kind: 'identifier';
      type: string;
      value: string;
      resolverUrl?: string;
      source: 'qr' | 'typed' | 'explicit';
    }
  | { kind: 'unknown'; value: string };

export type MappedPaymentOption = RezvaPaymentOption & {
  chainId: number | null;
  rabbyTokenParam: string | null;
  rabbyServerId: string | null;
  networkSupported: boolean;
};

export type RezvaSafetyDecision =
  | { action: 'pay'; recentlyChanged: boolean; recentlyRegistered: boolean }
  | { action: 'warn-continue'; reason: 'recently_changed' }
  | {
      action: 'block';
      reason:
        | 'pending'
        | 'update_pending'
        | 'suspended'
        | 'removed'
        | 'revoked'
        | 'not_payment_ready'
        | 'no_payable_option';
    };

export type RezvaResolveResult = {
  classification: ClassifiedSendInput;
  response: RezvaResolveResponse | null;
  mappedOptions: MappedPaymentOption[];
  safety: RezvaSafetyDecision | null;
  error: SerializedRezvaError | null;
};
