import type { MappedPaymentOption, RezvaPaymentOption } from './types';

export type ChainLookup = {
  id: number;
  serverId: string;
  nativeTokenAddress?: string;
};

const EIP155 = /^eip155:(\d+)$/i;

export function parseEip155ChainId(networkIdentifier?: string): number | null {
  if (!networkIdentifier) return null;
  const match = EIP155.exec(networkIdentifier.trim());
  if (!match) return null;
  const chainId = Number(match[1]);
  return Number.isInteger(chainId) && chainId > 0 ? chainId : null;
}

export function mapPaymentOption(
  option: RezvaPaymentOption,
  findChainById: (chainId: number) => ChainLookup | null | undefined
): MappedPaymentOption {
  const chainId = parseEip155ChainId(option.network_identifier);
  const chain = chainId ? findChainById(chainId) : null;
  const tokenId = option.token_contract || chain?.nativeTokenAddress || '';
  const networkSupported = Boolean(chain && tokenId);
  return {
    ...option,
    chainId,
    rabbyServerId: chain?.serverId ?? null,
    rabbyTokenParam:
      networkSupported && chain ? `${chain.serverId}:${tokenId}` : null,
    networkSupported,
  };
}

export function mapPaymentOptions(
  options: RezvaPaymentOption[],
  findChainById: (chainId: number) => ChainLookup | null | undefined
): MappedPaymentOption[] {
  return options.map((option) => mapPaymentOption(option, findChainById));
}

export function payableMappedOptions(
  options: MappedPaymentOption[]
): MappedPaymentOption[] {
  return options.filter(
    (option) => option.payment_ready && option.networkSupported
  );
}
