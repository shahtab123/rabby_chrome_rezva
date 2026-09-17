import { classifySendInput } from '@/rezva';
import { parseRezvaQr } from '@/rezva';
import { inferIdentifierType } from '@/rezva';
import { parseExplicitIdentifier } from '@/rezva';
import { validateResolveResponse, canPayFromResponse } from '@/rezva';
import {
  evaluateSafety,
  safetyMessage,
  displaySafetyMessage,
  isRecentlyChanged,
} from '@/rezva';
import { parseEip155ChainId, mapPaymentOption } from '@/rezva';
import { toResolveEndpoint } from '@/rezva';
import { resolveIdentifier } from '@/rezva';
import { resolveSendInput } from '@/rezva';
import { RezvaError } from '@/rezva';
import type { RezvaResolveResponse } from '@/rezva';

function activeResponse(
  overrides: Partial<RezvaResolveResponse> = {}
): RezvaResolveResponse {
  return {
    protocol_version: '1',
    status: 'active',
    payment_ready: true,
    identifier: { type: 'custom', value: 'shop-one' },
    registration: {
      registered_at: '2024-01-01T00:00:00.000Z',
      activated_at: '2024-01-02T00:00:00.000Z',
      last_updated: '2024-01-02T00:00:00.000Z',
      last_payment_update: null,
    },
    payment_options: [
      {
        chain: 'base',
        asset: 'USDC',
        address: '0x1111111111111111111111111111111111111111',
        token_contract: '0x2222222222222222222222222222222222222222',
        network_identifier: 'eip155:84532',
        payment_ready: true,
      },
    ],
    ...overrides,
  };
}

describe('classifySendInput', () => {
  it('keeps a normal blockchain address unchanged', () => {
    const address = '0x1111111111111111111111111111111111111111';
    expect(classifySendInput(address)).toEqual({
      kind: 'address',
      address,
    });
  });

  it('classifies a custom Rezva identifier', () => {
    expect(classifySendInput('shop-one')).toEqual({
      kind: 'identifier',
      type: 'custom',
      value: 'shop-one',
      source: 'typed',
    });
  });

  it('classifies Cash App links as custom (not merchant_id)', () => {
    expect(
      classifySendInput('https://cash.app/$coffeeandamike')
    ).toMatchObject({
      kind: 'identifier',
      type: 'custom',
      value: 'https://cash.app/$coffeeandamike',
    });
    expect(inferIdentifierType('https://cash.app/$coffeeandamike')).toBe(
      'custom'
    );
  });

  it('classifies email, phone, provider name, and explicit types', () => {
    expect(classifySendInput('pay@example.com')).toMatchObject({
      kind: 'identifier',
      type: 'email',
      value: 'pay@example.com',
    });
    expect(classifySendInput('+15551234567')).toMatchObject({
      kind: 'identifier',
      type: 'phone',
    });
    expect(classifySendInput('alice.redotpay')).toMatchObject({
      kind: 'identifier',
      type: 'provider_name',
      value: 'alice.redotpay',
    });
    expect(classifySendInput('email:pay@example.com')).toEqual({
      kind: 'identifier',
      type: 'email',
      value: 'pay@example.com',
      source: 'explicit',
    });
  });

  it('parses a QR-derived identifier payload', () => {
    const raw = JSON.stringify({
      resolver_url: 'http://127.0.0.1:8787/v1/resolve',
      type: 'email',
      value: 'pay@example.com',
    });
    expect(classifySendInput(raw)).toEqual({
      kind: 'identifier',
      type: 'email',
      value: 'pay@example.com',
      resolverUrl: 'http://127.0.0.1:8787/v1/resolve',
      source: 'qr',
    });
  });

  it('leaves ENS-like names for existing Rabby ENS handling', () => {
    expect(classifySendInput('alice.eth')).toEqual({
      kind: 'ens',
      name: 'alice.eth',
    });
  });
});

describe('parseRezvaQr', () => {
  it('extracts resolver_url, type, and value', () => {
    expect(
      parseRezvaQr(
        '{"resolver_url":"https://example.test/v1/resolve","type":"custom","value":"shop-one"}'
      )
    ).toEqual({
      resolver_url: 'https://example.test/v1/resolve',
      type: 'custom',
      value: 'shop-one',
    });
  });

  it('rejects missing fields and non-JSON', () => {
    expect(
      parseRezvaQr('0x1111111111111111111111111111111111111111')
    ).toBeNull();
    expect(parseRezvaQr('{"type":"custom"}')).toBeNull();
  });
});

describe('inferIdentifierType', () => {
  it('does not treat addresses or ENS as Rezva types', () => {
    expect(
      inferIdentifierType('0x1111111111111111111111111111111111111111')
    ).toBeNull();
    expect(inferIdentifierType('alice.eth')).toBeNull();
  });

  it('supports explicit type prefixes without hard-coding values', () => {
    expect(parseExplicitIdentifier('bangla_qr:1231489485495')).toEqual({
      type: 'bangla_qr',
      value: '1231489485495',
    });
  });

  it('classifies full EMV Bangla QR payloads as bangla_qr (exact string)', () => {
    const emv =
      '00020101021126480014A000000677010111011300668812345895204000053033645802BD6304B3C2';
    expect(inferIdentifierType(emv)).toBe('bangla_qr');
    expect(classifySendInput(emv)).toEqual({
      kind: 'identifier',
      type: 'bangla_qr',
      value: emv,
      source: 'typed',
    });
  });

  it('does not treat EMV payloads as invalid addresses', () => {
    const emv = `00020101021126${'A'.repeat(40)}6304ABCD`;
    expect(emv.length).toBeLessThanOrEqual(700);
    expect(classifySendInput(emv).kind).toBe('identifier');
  });
});

describe('validateResolveResponse', () => {
  it('accepts an OpenAPI-shaped active response', () => {
    const parsed = validateResolveResponse(activeResponse());
    expect(canPayFromResponse(parsed)).toBe(true);
  });

  it('rejects missing required fields', () => {
    expect(() =>
      validateResolveResponse({ status: 'active', payment_ready: true })
    ).toThrow(RezvaError);
  });
});

describe('safety states', () => {
  it('blocks pending identifiers', () => {
    const decision = evaluateSafety(
      activeResponse({
        status: 'pending',
        payment_ready: false,
        payment_options: [],
      })
    );
    expect(decision).toEqual({ action: 'block', reason: 'pending' });
    expect(safetyMessage(decision)).toMatch(/not currently payment-ready/i);
  });

  it('blocks update_pending / recently changed destinations', () => {
    const decision = evaluateSafety(
      activeResponse({
        status: 'update_pending',
        payment_ready: false,
        payment_options: [],
      })
    );
    expect(decision).toEqual({ action: 'block', reason: 'update_pending' });
    expect(safetyMessage(decision)).toMatch(/recently changed/i);
  });

  it('requires Cancel/Continue for an active destination that changed recently', () => {
    const decision = evaluateSafety(
      activeResponse({
        registration: {
          registered_at: '2024-01-01T00:00:00.000Z',
          activated_at: '2024-01-02T00:00:00.000Z',
          last_updated: new Date().toISOString(),
          last_payment_update: new Date().toISOString(),
        },
      })
    );
    expect(decision).toEqual({
      action: 'warn-continue',
      reason: 'recently_changed',
    });
    expect(
      isRecentlyChanged(
        activeResponse({
          registration: {
            last_payment_update: new Date().toISOString(),
          },
        })
      )
    ).toBe(true);
  });

  it('blocks suspended and removed identifiers', () => {
    expect(
      evaluateSafety(
        activeResponse({
          status: 'suspended',
          payment_ready: false,
          payment_options: [],
        })
      )
    ).toEqual({ action: 'block', reason: 'suspended' });
    expect(
      evaluateSafety(
        activeResponse({
          status: 'removed',
          payment_ready: false,
          payment_options: [],
        })
      )
    ).toEqual({ action: 'block', reason: 'removed' });
    expect(safetyMessage({ action: 'block', reason: 'suspended' })).toMatch(
      /suspended/i
    );
  });

  it('uses compact display copy for pending and recent change', () => {
    expect(displaySafetyMessage({ action: 'block', reason: 'pending' })).toBe(
      'Registration pending'
    );
    expect(
      displaySafetyMessage({
        action: 'warn-continue',
        reason: 'recently_changed',
      })
    ).toBe('Payment destination changed recently.');
    expect(
      displaySafetyMessage({ action: 'block', reason: 'update_pending' })
    ).toBe('Payment destination changed recently.');
    expect(
      displaySafetyMessage({
        action: 'pay',
        recentlyChanged: false,
        recentlyRegistered: false,
      })
    ).toBe('');
  });
});

describe('network and asset selection', () => {
  it('maps eip155 network identifiers and keeps multiple options', () => {
    expect(parseEip155ChainId('eip155:84532')).toBe(84532);
    const option = mapPaymentOption(activeResponse().payment_options[0], (id) =>
      id === 84532
        ? {
            id: 84532,
            serverId: 'custom_84532',
            nativeTokenAddress: '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
          }
        : null
    );
    expect(option.networkSupported).toBe(true);
    expect(option.rabbyTokenParam).toBe(
      'custom_84532:0x2222222222222222222222222222222222222222'
    );
  });

  it('does not auto-select an unsupported network', () => {
    const option = mapPaymentOption(
      activeResponse().payment_options[0],
      () => null
    );
    expect(option.networkSupported).toBe(false);
    expect(option.rabbyTokenParam).toBeNull();
  });
});

describe('resolver client', () => {
  it('posts type/value to the resolver URL with bearer auth', async () => {
    const fetchImpl = jest.fn(async () => {
      return {
        ok: true,
        status: 200,
        headers: { get: () => null },
        text: async () => JSON.stringify(activeResponse()),
      } as any;
    });
    await resolveIdentifier(
      {
        type: 'custom',
        value: 'shop-one',
        resolverUrl: 'http://127.0.0.1:8787',
        apiKey: 'rzva_free_test',
      },
      fetchImpl as any
    );
    expect(fetchImpl).toHaveBeenCalledWith(
      'http://127.0.0.1:8787/v1/resolve',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          authorization: 'Bearer rzva_free_test',
        }),
        body: JSON.stringify({ type: 'custom', value: 'shop-one' }),
      })
    );
  });

  it('authenticates approved Provider API keys the same way', async () => {
    const fetchImpl = jest.fn(async () => {
      return {
        ok: true,
        status: 200,
        headers: { get: () => null },
        text: async () => JSON.stringify(activeResponse()),
      } as any;
    });
    await resolveIdentifier(
      {
        type: 'email',
        value: 'pay@example.com',
        resolverUrl: 'http://127.0.0.1:8787/v1/resolve',
        apiKey: 'rzva_prov_example',
      },
      fetchImpl as any
    );
    expect(fetchImpl).toHaveBeenCalledWith(
      'http://127.0.0.1:8787/v1/resolve',
      expect.objectContaining({
        headers: expect.objectContaining({
          authorization: 'Bearer rzva_prov_example',
        }),
        body: JSON.stringify({ type: 'email', value: 'pay@example.com' }),
      })
    );
  });

  it('does not nest /v1/resolve when the QR already includes it', () => {
    expect(toResolveEndpoint('http://127.0.0.1:8787/v1/resolve')).toBe(
      'http://127.0.0.1:8787/v1/resolve'
    );
  });

  it('surfaces authentication failure', async () => {
    const fetchImpl = jest.fn(async () => {
      return {
        ok: false,
        status: 401,
        headers: { get: () => null },
        text: async () =>
          JSON.stringify({
            error: { code: 'UNAUTHORIZED', message: 'Invalid key' },
          }),
      } as any;
    });
    await expect(
      resolveIdentifier(
        {
          type: 'custom',
          value: 'shop-one',
          resolverUrl: 'http://127.0.0.1:8787/v1/resolve',
          apiKey: 'bad',
        },
        fetchImpl as any
      )
    ).rejects.toMatchObject({ code: 'UNAUTHORIZED', httpStatus: 401 });
  });

  it('surfaces not found, invalid, and resolver errors', async () => {
    const fail = (status: number, code: string) =>
      jest.fn(async () => {
        return {
          ok: false,
          status,
          headers: { get: () => null },
          text: async () => JSON.stringify({ error: { code, message: code } }),
        } as any;
      });

    await expect(
      resolveIdentifier(
        {
          type: 'custom',
          value: 'missing',
          resolverUrl: 'http://127.0.0.1:8787',
          apiKey: 'k',
        },
        fail(404, 'IDENTIFIER_NOT_FOUND') as any
      )
    ).rejects.toMatchObject({ code: 'IDENTIFIER_NOT_FOUND' });

    await expect(
      resolveIdentifier(
        {
          type: 'custom',
          value: '!!!',
          resolverUrl: 'http://127.0.0.1:8787',
          apiKey: 'k',
        },
        fail(400, 'IDENTIFIER_INVALID') as any
      )
    ).rejects.toMatchObject({ code: 'IDENTIFIER_INVALID' });
  });
});

describe('resolveSendInput', () => {
  it('does not call the resolver for a normal address', async () => {
    const fetchImpl = jest.fn();
    const result = await resolveSendInput(
      '0x1111111111111111111111111111111111111111',
      { fetch: fetchImpl as any }
    );
    expect(result.classification.kind).toBe('address');
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('resolves a dynamic identifier and maps multiple payment options', async () => {
    const response = activeResponse({
      payment_options: [
        {
          chain: 'base',
          asset: 'USDC',
          address: '0x1111111111111111111111111111111111111111',
          token_contract: '0x2222222222222222222222222222222222222222',
          network_identifier: 'eip155:84532',
          payment_ready: true,
        },
        {
          chain: 'ethereum',
          asset: 'USDC',
          address: '0x3333333333333333333333333333333333333333',
          token_contract: '0x4444444444444444444444444444444444444444',
          network_identifier: 'eip155:1',
          payment_ready: true,
        },
      ],
    });
    const result = await resolveSendInput('shop-one', {
      fetch: (async () =>
        ({
          ok: true,
          status: 200,
          headers: { get: () => null },
          text: async () => JSON.stringify(response),
        } as any)) as any,
      getConfig: async () => ({
        apiKey: 'k',
        apiBaseUrl: 'http://127.0.0.1:8787',
      }),
      findChainById: (id) =>
        id === 84532
          ? { id: 84532, serverId: 'custom_84532' }
          : id === 1
          ? { id: 1, serverId: 'eth' }
          : null,
    });
    expect(result.error).toBeNull();
    expect(result.mappedOptions).toHaveLength(2);
    expect(result.mappedOptions[0].rabbyTokenParam).toContain('custom_84532:');
    expect(result.mappedOptions[1].rabbyTokenParam).toContain('eth:');
    expect(result.safety?.action).toBe('pay');
  });

  it('returns a missing-key error without calling the resolver', async () => {
    const fetchImpl = jest.fn();
    const result = await resolveSendInput('shop-one', {
      fetch: fetchImpl as any,
      getConfig: async () => ({
        apiKey: '',
        apiBaseUrl: 'http://127.0.0.1:8787',
      }),
    });
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(result.error?.code).toBe('MISSING_API_KEY');
  });

  it('surfaces resolver HTTP errors as serializable results', async () => {
    const result = await resolveSendInput('shop-one', {
      fetch: (async () =>
        ({
          ok: false,
          status: 500,
          headers: { get: () => null },
          text: async () => 'upstream failed',
        } as any)) as any,
      getConfig: async () => ({
        apiKey: 'k',
        apiBaseUrl: 'http://127.0.0.1:8787',
      }),
    });
    expect(result.error?.code).toBe('RESOLVER_ERROR');
    expect(result.error?.httpStatus).toBe(500);
  });
});
