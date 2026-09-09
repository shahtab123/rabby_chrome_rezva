import React from 'react';
import { Button } from 'antd';
import clsx from 'clsx';
import type {
  MappedPaymentOption,
  RezvaPaymentOption,
  RezvaPublicConfig,
  RezvaResolveResult,
} from '@/rezva';
import { displaySafetyMessage } from '@/rezva';
import { ellipsisAddress } from '@/ui/utils/address';

function formatChainLabel(chain: string): string {
  return chain
    .split(/[-_]/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function identifierDisplayValue(result: RezvaResolveResult): string {
  const fromResponse = result.response?.identifier;
  return (
    fromResponse?.normalized_value ||
    fromResponse?.value ||
    (result.classification.kind === 'identifier'
      ? result.classification.value
      : '')
  );
}

function resolveTitle(result: RezvaResolveResult): string {
  const profileName = result.response?.profile?.name?.trim();
  const identifierValue = identifierDisplayValue(result);
  return profileName || identifierValue;
}

function resolveSubtitle(result: RezvaResolveResult): string | null {
  const profileName = result.response?.profile?.name?.trim();
  const identifierValue = identifierDisplayValue(result);
  if (profileName && identifierValue && profileName !== identifierValue) {
    return identifierValue;
  }
  return null;
}

function amountLine(option: RezvaPaymentOption | undefined): string | null {
  if (!option) return null;
  if (option.fixed_amount) {
    return `Amount: ${option.fixed_amount} ${option.asset}`;
  }
  if (option.minimum_amount || option.maximum_amount) {
    return `Amount: ${option.minimum_amount || '—'} – ${
      option.maximum_amount || '—'
    } ${option.asset}`;
  }
  return null;
}

export function RezvaResolutionPanel({
  result,
  loading,
  acknowledgedRecentChange,
  onAcknowledgeRecentChange,
  onCancelRecentChange,
  onSelectOption,
  publicConfig,
  apiKeyDraft,
  apiBaseUrlDraft,
  onApiKeyDraftChange,
  onApiBaseUrlDraftChange,
  onSaveConfig,
  savingConfig,
}: {
  result: RezvaResolveResult | null;
  loading: boolean;
  acknowledgedRecentChange: boolean;
  onAcknowledgeRecentChange: () => void;
  onCancelRecentChange: () => void;
  onSelectOption: (option: MappedPaymentOption) => void;
  publicConfig: RezvaPublicConfig | null;
  apiKeyDraft: string;
  apiBaseUrlDraft: string;
  onApiKeyDraftChange: (value: string) => void;
  onApiBaseUrlDraftChange: (value: string) => void;
  onSaveConfig: () => void;
  savingConfig: boolean;
}) {
  if (loading) {
    return (
      <div className="mt-[12px] p-[12px] bg-r-neutral-card1 rounded-[12px] text-[13px] text-r-neutral-body">
        Resolving identifier…
      </div>
    );
  }

  if (!result || result.classification.kind !== 'identifier') {
    return null;
  }

  const needsKey = result.error?.code === 'MISSING_API_KEY';
  const safety = result.safety;
  const blocked = safety?.action === 'block';
  const needsContinue =
    safety?.action === 'warn-continue' && !acknowledgedRecentChange;
  const safetyLine = displaySafetyMessage(safety);

  const primaryOption = result.response?.payment_options?.[0];
  const mappedPrimary = result.mappedOptions[0];
  const title = resolveTitle(result);
  const subtitle = resolveSubtitle(result);
  const acceptsLine =
    primaryOption?.asset && primaryOption?.chain
      ? `Accepts: ${primaryOption.asset} on ${formatChainLabel(
          primaryOption.chain
        )}`
      : null;
  const destinationLine = primaryOption?.address
    ? `To: ${ellipsisAddress(primaryOption.address)}`
    : null;
  const amount = amountLine(primaryOption);

  const canPay =
    result.response?.payment_ready === true &&
    primaryOption?.payment_ready === true &&
    !blocked &&
    !needsContinue &&
    Boolean(mappedPrimary?.rabbyTokenParam) &&
    Boolean(mappedPrimary?.networkSupported);

  return (
    <div className="mt-[12px] p-[12px] bg-r-neutral-card1 rounded-[12px] text-[13px] text-r-neutral-title1">
      {result.response && !result.error ? (
        <div>
          <div className="font-medium text-[16px] leading-snug break-all">
            {title}
          </div>
          {subtitle ? (
            <div className="mt-[4px] text-r-neutral-body break-all">
              {subtitle}
            </div>
          ) : null}
          {acceptsLine ? (
            <div className="mt-[10px] text-r-neutral-body">{acceptsLine}</div>
          ) : null}
          {amount ? (
            <div className="mt-[4px] text-r-neutral-body">{amount}</div>
          ) : null}
          {destinationLine ? (
            <div className="mt-[4px] text-r-neutral-body break-all">
              {destinationLine}
            </div>
          ) : null}
          {mappedPrimary && !mappedPrimary.networkSupported ? (
            <div className="mt-[8px] text-[12px] text-r-orange-default">
              This network is not enabled in Rabby. Add a custom network with
              chain ID {mappedPrimary.chainId ?? 'unknown'} first.
            </div>
          ) : null}
        </div>
      ) : null}

      {needsKey || result.error?.code === 'MISSING_RESOLVER_URL' ? (
        <div className="mt-[12px]">
          <div className="text-r-neutral-body mb-[8px]">
            Configure a Rezva API key locally (approved Provider key or Free API
            key). It is stored in this browser profile and is not committed.
          </div>
          <input
            className="w-full mb-[8px] h-[36px] px-[10px] rounded-[8px] bg-r-neutral-bg-2 text-r-neutral-title1"
            placeholder="Provider or Free API key"
            type="password"
            value={apiKeyDraft}
            onChange={(e) => onApiKeyDraftChange(e.target.value)}
          />
          <input
            className="w-full mb-[8px] h-[36px] px-[10px] rounded-[8px] bg-r-neutral-bg-2 text-r-neutral-title1"
            placeholder="Resolver base URL"
            value={apiBaseUrlDraft}
            onChange={(e) => onApiBaseUrlDraftChange(e.target.value)}
          />
          <Button
            type="primary"
            loading={savingConfig}
            onClick={onSaveConfig}
            className="w-full h-[40px]"
          >
            Save Rezva config
          </Button>
          {publicConfig?.keyPrefix ? (
            <div className="mt-[6px] text-[12px] text-r-neutral-foot">
              Current key: {publicConfig.keyPrefix}
            </div>
          ) : null}
        </div>
      ) : null}

      {result.error && !needsKey ? (
        <div className="mt-[8px] text-r-red-default font-medium">
          {result.error.code === 'UNAUTHORIZED'
            ? 'Rezva authentication failed. Check the Provider or Free API key.'
            : result.error.code === 'IDENTIFIER_NOT_FOUND'
            ? 'No mapping exists for this identifier.'
            : result.error.code === 'IDENTIFIER_INVALID'
            ? 'This identifier is invalid.'
            : result.error.code === 'RATE_LIMITED' ||
              result.error.code === 'FREE_API_RATE_LIMITED'
            ? `Resolver rate limited. Retry after ${
                result.error.retryAfterSeconds ?? 60
              }s.`
            : result.error.message}
        </div>
      ) : null}

      {safetyLine ? (
        <div
          className={clsx(
            'mt-[10px] font-medium',
            blocked || needsContinue
              ? 'text-r-orange-default'
              : 'text-r-neutral-body'
          )}
        >
          {safetyLine}
        </div>
      ) : null}

      {needsContinue ? (
        <div className="mt-[12px] flex gap-[8px]">
          <Button className="flex-1 h-[40px]" onClick={onCancelRecentChange}>
            Cancel
          </Button>
          <Button
            type="primary"
            className="flex-1 h-[40px]"
            onClick={onAcknowledgeRecentChange}
          >
            Continue
          </Button>
        </div>
      ) : null}

      {canPay && mappedPrimary ? (
        <div className="mt-[12px]">
          <Button
            type="primary"
            className="w-full h-[44px] text-[15px]"
            onClick={() => onSelectOption(mappedPrimary)}
          >
            Pay
          </Button>
        </div>
      ) : null}

      {!blocked &&
      !needsContinue &&
      result.response?.payment_ready === true &&
      result.mappedOptions.length > 1 ? (
        <div className="mt-[12px] space-y-[8px]">
          <div className="text-[12px] text-r-neutral-foot font-medium">
            Other payment options
          </div>
          {result.mappedOptions.slice(1).map((option, index) => {
            const disabled = !option.payment_ready || !option.networkSupported;
            return (
              <button
                type="button"
                key={`${option.address}-${option.network_identifier}-${index}`}
                disabled={disabled}
                onClick={() => onSelectOption(option)}
                className={clsx(
                  'w-full text-left p-[10px] rounded-[10px] border border-r-neutral-line',
                  disabled
                    ? 'opacity-50 cursor-not-allowed'
                    : 'hover:border-r-blue-default cursor-pointer'
                )}
              >
                <div className="font-medium">
                  {option.asset} on {formatChainLabel(option.chain)}
                </div>
                <div className="break-all text-[12px] text-r-neutral-foot mt-[4px]">
                  To: {ellipsisAddress(option.address)}
                </div>
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
