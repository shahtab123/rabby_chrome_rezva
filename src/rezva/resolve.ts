import { resolveIdentifier } from './client';
import { getRezvaRuntimeConfig } from './config';
import { classifySendInput } from './parseInput';
import { mapPaymentOptions } from './mapDestination';
import { evaluateSafety } from './safety';
import { RezvaError, serializeRezvaError } from './types';
import type { RezvaResolveResult } from './types';
import type { ChainLookup } from './mapDestination';

export type ResolveSendInputDeps = {
  fetch?: typeof fetch;
  getConfig?: typeof getRezvaRuntimeConfig;
  findChainById?: (chainId: number) => ChainLookup | null | undefined;
};

export async function resolveSendInput(
  raw: string,
  deps: ResolveSendInputDeps = {}
): Promise<RezvaResolveResult> {
  const classification = classifySendInput(raw);

  if (classification.kind !== 'identifier') {
    return {
      classification,
      response: null,
      mappedOptions: [],
      safety: null,
      error: null,
    };
  }

  const config = await (deps.getConfig || getRezvaRuntimeConfig)();
  const resolverUrl = classification.resolverUrl || config.apiBaseUrl;

  if (!config.apiKey) {
    return {
      classification,
      response: null,
      mappedOptions: [],
      safety: null,
      error: serializeRezvaError(
        new RezvaError(
          'MISSING_API_KEY',
          'A Rezva API key is required to resolve identifiers.'
        )
      ),
    };
  }

  if (!resolverUrl) {
    return {
      classification,
      response: null,
      mappedOptions: [],
      safety: null,
      error: serializeRezvaError(
        new RezvaError(
          'MISSING_RESOLVER_URL',
          'No resolver URL is configured. Scan a Rezva QR or set REZVA_API_BASE_URL.'
        )
      ),
    };
  }

  try {
    const response = await resolveIdentifier(
      {
        type: classification.type,
        value: classification.value,
        resolverUrl,
        apiKey: config.apiKey,
      },
      deps.fetch
    );
    const mappedOptions = deps.findChainById
      ? mapPaymentOptions(response.payment_options, deps.findChainById)
      : response.payment_options.map((option) => ({
          ...option,
          chainId: null,
          rabbyTokenParam: null,
          rabbyServerId: null,
          networkSupported: false,
        }));
    return {
      classification,
      response,
      mappedOptions,
      safety: evaluateSafety(response),
      error: null,
    };
  } catch (error) {
    const rezvaError =
      error instanceof RezvaError
        ? error
        : new RezvaError(
            'RESOLVER_ERROR',
            error instanceof Error ? error.message : 'Resolver request failed.'
          );
    return {
      classification,
      response: null,
      mappedOptions: [],
      safety: null,
      error: serializeRezvaError(rezvaError),
    };
  }
}
