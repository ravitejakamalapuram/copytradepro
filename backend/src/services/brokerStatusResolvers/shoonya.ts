import { ACCOUNT_STATUS } from '@copytrade/shared-types';
import { BrokerStatusResolver, DbAccountRecord, EffectiveStatus } from './types';

export const resolveShoonyaStatus: BrokerStatusResolver = (dbAccount: DbAccountRecord): EffectiveStatus => {
  // Shoonya tokens do not expire; status is manual
  const accountStatus = dbAccount.account_status === ACCOUNT_STATUS.ACTIVE
    ? ACCOUNT_STATUS.ACTIVE
    : ACCOUNT_STATUS.INACTIVE;

  const isActive = accountStatus === ACCOUNT_STATUS.ACTIVE;

  return {
    accountStatus,
    isActive,
    isTokenExpired: false,
    shouldShowActivateButton: !isActive,
    shouldShowDeactivateButton: false, // per preference: don't show deactivate for infinity tokens
  };
};

