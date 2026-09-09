import React, {
  useState,
  useMemo,
  useEffect,
  useRef,
  useCallback,
} from 'react';
import { Input, Form, Button, Modal } from 'antd';
import { useTranslation } from 'react-i18next';
import { isValidAddress } from '@ethereumjs/util';
import { debounce, flatten } from 'lodash';
import styled from 'styled-components';
import clsx from 'clsx';

import type { InputRef } from 'antd';

import { isSameAddress, useAlias, useCexId, useWallet } from 'ui/utils';

import { IconClearCC } from '@/ui/assets/component/IconClear';
import { ReactComponent as RcIconWarningCC } from '@/ui/assets/warning-cc.svg';
import { ReactComponent as RcIconQrcodeCC } from '@/ui/assets/qrcode-cc.svg';
import { resolveEnsAddressByName } from '@/ui/utils/ens';
import { AccountList } from './AccountList';
import { RezvaResolutionPanel } from './RezvaResolution';
import { useAccounts } from '@/ui/hooks/useAccounts';
import { AddressTypeCard } from '@/ui/component/AddressRiskAlert';
import { KEYRING_TYPE } from '@/constant';
import { ellipsisAddress } from '@/ui/utils/address';
import { useWhitelistStore } from '@/ui/state/whitelist';
import QRCodeReader from '@/ui/component/QRCodeReader';
import { classifySendInput } from '@/rezva';
import type {
  MappedPaymentOption,
  RezvaPublicConfig,
  RezvaResolveResult,
} from '@/rezva';

const StyledInputWrapper = styled.div<{ $hasError?: boolean }>`
  border-radius: 12px;
  overflow: hidden;
  .ant-input {
    font-size: 15px;
    ${({ $hasError }) =>
      $hasError && 'border-color: var(--r-red-default) !important;'}
  }
  .ant-input-clear-icon {
    top: unset !important;
    bottom: 8px !important;
    svg {
      width: 20px;
      height: 20px;
    }
  }
`;

const WhitelistAddressTypeCard = ({
  address,
  type,
  brandName,
}: {
  address: string;
  type: string;
  brandName: string;
}) => {
  const [cexInfo] = useCexId(address);
  const [aliasName] = useAlias(address);
  return (
    <div className="mt-[20px] w-full">
      <AddressTypeCard
        address={address}
        type={type}
        brandName={brandName}
        allowEditAlias
        aliasName={aliasName || ellipsisAddress(address)}
        className="bg-r-neutral-card1"
        cexInfo={{
          id: cexInfo?.id,
          name: cexInfo?.name,
          logo: cexInfo?.logo,
          isDeposit: !!cexInfo?.id,
        }}
      />
    </div>
  );
};

export type SelectToAddressExtras = {
  token?: string;
};

export const EnterAddress = ({
  onNext,
  onCancel,
}: {
  onNext: (
    address: string,
    type?: string,
    extras?: SelectToAddressExtras
  ) => void;
  onCancel: () => void;
}) => {
  const { t } = useTranslation();
  const wallet = useWallet();
  const { fetchAllAccounts, allSortedAccountList } = useAccounts();
  const whitelist = useWhitelistStore((state) => state.whitelists);

  const inputRef = useRef<InputRef>(null);

  const [inputAddress, setInputAddress] = useState('');
  const [ensResult, setEnsResult] = useState<null | {
    addr: string;
    name: string;
  }>(null);
  const [tags, setTags] = useState<string[]>([]);
  const [rezvaResult, setRezvaResult] = useState<RezvaResolveResult | null>(
    null
  );
  const [rezvaLoading, setRezvaLoading] = useState(false);
  const [acknowledgedRecentChange, setAcknowledgedRecentChange] = useState(
    false
  );
  const [scanOpen, setScanOpen] = useState(false);
  const [publicConfig, setPublicConfig] = useState<RezvaPublicConfig | null>(
    null
  );
  const [apiKeyDraft, setApiKeyDraft] = useState('');
  const [apiBaseUrlDraft, setApiBaseUrlDraft] = useState('');
  const [savingConfig, setSavingConfig] = useState(false);

  const isValidAddr = useMemo(() => {
    return isValidAddress(inputAddress);
  }, [inputAddress]);
  const classified = useMemo(() => classifySendInput(inputAddress), [
    inputAddress,
  ]);
  const hasResolvedRezvaAddress = Boolean(
    rezvaResult?.classification.kind === 'identifier' &&
      rezvaResult.safety &&
      rezvaResult.safety.action !== 'block'
  );
  const hasError =
    !!inputAddress &&
    !isValidAddr &&
    !ensResult?.addr &&
    classified.kind !== 'identifier' &&
    classified.kind !== 'ens';
  const disableSubmit =
    !inputAddress ||
    (hasError && !hasResolvedRezvaAddress) ||
    classified.kind === 'identifier';

  const [isFocusAddress, setIsFocusAddress] = useState(false);
  const [shouldRender, setShouldRender] = useState(false);

  const filteredAccounts = useMemo(() => {
    const lowerFilterText = inputAddress?.toLowerCase() || '';
    const flattenedAccounts = flatten(allSortedAccountList);
    if (!lowerFilterText) {
      return flattenedAccounts;
    }
    return flattenedAccounts.filter((account) => {
      const address = account.address.toLowerCase();
      const aliasName = account.alianName?.toLowerCase() || '';
      return (
        address.includes(lowerFilterText) || aliasName.includes(lowerFilterText)
      );
    });
  }, [allSortedAccountList, inputAddress]);

  const showSearchError = hasError && !filteredAccounts.length;

  useEffect(() => {
    const timer = setTimeout(() => {
      setShouldRender(true);
    }, 300);

    return () => {
      clearTimeout(timer);
    };
  }, []);

  useEffect(() => {
    fetchAllAccounts();
  }, [fetchAllAccounts]);

  useEffect(() => {
    let cancelled = false;
    wallet
      .getRezvaConfig()
      .then((config) => {
        if (cancelled) return;
        setPublicConfig(config);
        setApiBaseUrlDraft(config.apiBaseUrl || '');
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [wallet]);

  const handleConfirmENS = useCallback(
    (result: string) => {
      setInputAddress(result);
      setTags([`ENS: ${ensResult?.name || ''}`]);
      setEnsResult(null);
    },
    [ensResult?.name]
  );

  const handleKeyDown = useMemo(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === 'enter') {
        if (ensResult) {
          e.preventDefault();
          handleConfirmENS(ensResult.addr);
        }
      }
    };
    return handler;
  }, [ensResult, handleConfirmENS]);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleKeyDown]);

  const resolveRezva = useCallback(
    async (value: string) => {
      const classifiedValue = classifySendInput(value);
      if (classifiedValue.kind !== 'identifier') {
        setRezvaResult(null);
        setRezvaLoading(false);
        return;
      }
      setRezvaLoading(true);
      setAcknowledgedRecentChange(false);
      try {
        const resolved = await wallet.resolvePaymentIdentifier(value);
        setRezvaResult(resolved);
      } catch (error) {
        setRezvaResult({
          classification: classifiedValue,
          response: null,
          mappedOptions: [],
          safety: null,
          error: {
            name: 'RezvaError',
            message:
              error instanceof Error
                ? error.message
                : 'Resolver request failed.',
            code: 'RESOLVER_ERROR',
          },
        });
      } finally {
        setRezvaLoading(false);
      }
    },
    [wallet]
  );

  const handleValuesChange = useMemo(
    () =>
      debounce(async ({ address }: { address: string }) => {
        setTags([]);
        setAcknowledgedRecentChange(false);
        const next = classifySendInput(address);
        if (next.kind === 'address') {
          setEnsResult(null);
          setRezvaResult(null);
          return;
        }
        if (next.kind === 'identifier') {
          setEnsResult(null);
          await resolveRezva(address);
          return;
        }
        if (!isValidAddress(address)) {
          try {
            const result = await resolveEnsAddressByName(address, wallet);
            if (result && result.addr) {
              setEnsResult(result);
              setRezvaResult(null);
            } else {
              setEnsResult(null);
              if (next.kind !== 'empty') {
                setRezvaResult(null);
              }
            }
          } catch (e) {
            setEnsResult(null);
          }
        } else {
          setEnsResult(null);
        }
      }, 400),
    [wallet, resolveRezva]
  );

  const handleNextClick = () => {
    const address = ensResult?.addr || inputAddress;
    if (address && isValidAddress(address)) {
      onNext(address);
    }
  };

  const handleSelectRezvaOption = (option: MappedPaymentOption) => {
    if (!option.address || !isValidAddress(option.address)) return;
    if (!option.rabbyTokenParam) return;
    onNext(option.address, undefined, { token: option.rabbyTokenParam });
  };

  const applyScannedValue = (text: string) => {
    setScanOpen(false);
    setInputAddress(text);
    handleValuesChange({ address: text });
  };

  return (
    <Form
      autoComplete="off"
      onFinish={handleNextClick}
      className="flex flex-1 flex-col"
    >
      <div
        className="relative overflow-auto"
        onClick={() => {
          if (!inputAddress) {
            onCancel();
          }
        }}
      >
        <Form.Item name="address">
          <StyledInputWrapper
            onClick={(e) => e.stopPropagation()}
            className="relative"
            $hasError={
              !isValidAddr &&
              !filteredAccounts.length &&
              classified.kind !== 'identifier'
            }
          >
            <Input.TextArea
              maxLength={700}
              placeholder={t('page.selectToAddress.enterAddressOrENS')}
              allowClear={false}
              autoFocus
              ref={inputRef}
              onFocus={() => setIsFocusAddress(true)}
              onBlur={() => setIsFocusAddress(false)}
              value={inputAddress}
              onChange={(e) => {
                setInputAddress(e.target.value);
                handleValuesChange({ address: e.target.value });
              }}
              size="large"
              spellCheck={false}
              rows={4}
              className={clsx(
                'border-bright-on-active bg-r-neutral-card1 rounded-[12px] leading-normal pt-[14px] pl-[15px] h-[80px]'
              )}
            />
            <div className="absolute right-[16px] bottom-[16px] flex items-center gap-[10px]">
              <RcIconQrcodeCC
                className="w-[20px] h-[20px] cursor-pointer text-r-neutral-foot"
                onClick={(e) => {
                  e.stopPropagation();
                  setScanOpen(true);
                }}
              />
              <IconClearCC
                onClick={() => {
                  setInputAddress('');
                  handleValuesChange({ address: '' });
                  setRezvaResult(null);
                  inputRef.current?.focus();
                }}
                className={clsx(
                  isFocusAddress && inputAddress.length > 0
                    ? 'opacity-100 cursor-pointer'
                    : 'opacity-0 cursor-text'
                )}
              />
            </div>
          </StyledInputWrapper>
          {showSearchError && (
            <div className="text-r-red-default text-[13px] font-medium flex gap-[4px] items-center mt-[8px]">
              <div className="text-r-red-default">
                <RcIconWarningCC />
              </div>
              <div>{t('page.whitelist.invalidAddress')}</div>
            </div>
          )}
        </Form.Item>
        {tags.length > 0 && (
          <ul className="mt-[13px]">
            {tags.map((tag) => (
              <li
                className="border-none pl-0 py-0 text-[13px] text-r-neutral-body font-medium"
                key={tag}
              >
                {tag}
              </li>
            ))}
          </ul>
        )}
        {ensResult && (
          <div
            className="mt-[12px] p-[12px] bg-r-neutral-card1 rounded-[12px] cursor-pointer"
            onClick={() => handleConfirmENS(ensResult.addr)}
          >
            <div className="flex items-center gap-[8px] break-all">
              <span className="flex-1">{ensResult.addr}</span>
            </div>
          </div>
        )}
        <RezvaResolutionPanel
          result={rezvaResult}
          loading={rezvaLoading}
          acknowledgedRecentChange={acknowledgedRecentChange}
          onAcknowledgeRecentChange={() => setAcknowledgedRecentChange(true)}
          onCancelRecentChange={() => {
            setAcknowledgedRecentChange(false);
            setRezvaResult(null);
            setInputAddress('');
          }}
          onSelectOption={handleSelectRezvaOption}
          publicConfig={publicConfig}
          apiKeyDraft={apiKeyDraft}
          apiBaseUrlDraft={apiBaseUrlDraft}
          onApiKeyDraftChange={setApiKeyDraft}
          onApiBaseUrlDraftChange={setApiBaseUrlDraft}
          savingConfig={savingConfig}
          onSaveConfig={async () => {
            setSavingConfig(true);
            try {
              const next = await wallet.setRezvaConfig({
                apiKey: apiKeyDraft,
                apiBaseUrl: apiBaseUrlDraft,
              });
              setPublicConfig(next);
              setApiKeyDraft('');
              if (classified.kind === 'identifier') {
                await resolveRezva(inputAddress);
              }
            } finally {
              setSavingConfig(false);
            }
          }}
        />
        {isValidAddr &&
          (whitelist.some((item) => isSameAddress(item, inputAddress)) ||
            !!filteredAccounts.length) && (
            <WhitelistAddressTypeCard
              address={inputAddress}
              type={
                filteredAccounts?.[0]?.address &&
                isSameAddress(inputAddress, filteredAccounts[0].address)
                  ? filteredAccounts[0].type
                  : KEYRING_TYPE.WatchAddressKeyring
              }
              brandName={
                filteredAccounts?.[0]?.address &&
                isSameAddress(inputAddress, filteredAccounts[0].address)
                  ? filteredAccounts[0].brandName
                  : KEYRING_TYPE.WatchAddressKeyring
              }
            />
          )}
      </div>
      {shouldRender && (
        <>
          <div className="flex-1 pt-[20px] overflow-y-scroll">
            {!isValidAddr && classified.kind !== 'identifier' && (
              <AccountList
                list={filteredAccounts}
                whitelist={whitelist}
                onChange={(acc) => onNext(acc.address, acc.type)}
              />
            )}
          </div>
          <div className={'footer'}>
            <div className="btn-wrapper w-[100%] px-[16px] flex justify-center">
              <Button
                disabled={disableSubmit}
                type="primary"
                htmlType="submit"
                size="large"
                className="w-[100%] h-[48px] text-[16px]"
              >
                {t('global.confirm')}
              </Button>
            </div>
          </div>
        </>
      )}
      <Modal
        visible={scanOpen}
        title="Scan identifier"
        footer={null}
        onCancel={() => setScanOpen(false)}
        destroyOnClose
      >
        <div className="flex justify-center py-[12px]">
          <QRCodeReader
            width={240}
            height={240}
            onSuccess={applyScannedValue}
          />
        </div>
      </Modal>
    </Form>
  );
};
