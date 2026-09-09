import { RezvaError } from './types';
import type { RezvaApiErrorBody, RezvaResolveResponse } from './types';
import { toResolveEndpoint } from './config';
import { validateResolveResponse } from './validate';

export type ResolveIdentifierRequest = {
  type: string;
  value: string;
  resolverUrl: string;
  apiKey: string;
};

function httpErrorCode(status: number, code?: string): RezvaError['code'] {
  if (code === 'FREE_API_RATE_LIMITED' || code === 'RATE_LIMITED') {
    return code;
  }
  if (status === 401 || status === 403) return 'UNAUTHORIZED';
  if (status === 404) return 'IDENTIFIER_NOT_FOUND';
  if (status === 400) {
    if (code === 'TYPE_NOT_SUPPORTED') return 'TYPE_NOT_SUPPORTED';
    if (code === 'IDENTIFIER_INVALID') return 'IDENTIFIER_INVALID';
    return 'IDENTIFIER_INVALID';
  }
  if (status === 429) return 'RATE_LIMITED';
  return 'RESOLVER_ERROR';
}

export async function resolveIdentifier(
  request: ResolveIdentifierRequest,
  fetchImpl: typeof fetch = fetch
): Promise<RezvaResolveResponse> {
  if (!request.apiKey) {
    throw new RezvaError(
      'MISSING_API_KEY',
      'A Rezva API key is required to resolve identifiers.'
    );
  }
  const endpoint = toResolveEndpoint(request.resolverUrl);
  if (!endpoint) {
    throw new RezvaError(
      'MISSING_RESOLVER_URL',
      'A resolver URL is required to resolve this identifier.'
    );
  }

  let response: Response;
  try {
    response = await fetchImpl(endpoint, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${request.apiKey}`,
      },
      body: JSON.stringify({
        type: request.type,
        value: request.value,
      }),
    });
  } catch (error) {
    throw new RezvaError(
      'RESOLVER_ERROR',
      error instanceof Error ? error.message : 'Resolver request failed.'
    );
  }

  const retryAfter = Number(response.headers.get('retry-after') || '');
  const text = await response.text();
  let body: unknown = null;
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = { raw: text };
    }
  }

  if (!response.ok) {
    const parsed = body as RezvaApiErrorBody;
    const code = httpErrorCode(response.status, parsed?.error?.code);
    const message =
      parsed?.error?.message ||
      `Resolver HTTP ${response.status}${text ? `: ${text}` : ''}`;
    throw new RezvaError(code, message, {
      httpStatus: response.status,
      retryAfterSeconds: Number.isFinite(retryAfter) ? retryAfter : undefined,
    });
  }

  return validateResolveResponse(body);
}
