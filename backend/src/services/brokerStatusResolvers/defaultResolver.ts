import { ACCOUNT_STATUS, type AccountStatus } from '@copytrade/shared-types';
import { BrokerStatusResolver, DbAccountRecord, EffectiveStatus } from './types';

export const resolveDefaultStatus: BrokerStatusResolver = (dbAccount: DbAccountRecord, nowInput?: Date): EffectiveStatus => {
  const now = nowInput ?? new Date();
  const accessTokenExpiry = dbAccount.token_expiry_time ? new Date(dbAccount.token_expiry_time) : null;
  const isAccessTokenExpired = accessTokenExpiry ? now > accessTokenExpiry : false;

  let accountStatus: AccountStatus;
  if (!dbAccount.account_status || dbAccount.account_status === ACCOUNT_STATUS.INACTIVE) {
    accountStatus = ACCOUNT_STATUS.INACTIVE;
  } else if (isAccessTokenExpired) {
    accountStatus = ACCOUNT_STATUS.INACTIVE;
  } else {
    accountStatus = ACCOUNT_STATUS.ACTIVE;
  }

  const isActive = accountStatus === ACCOUNT_STATUS.ACTIVE;

  return {
    accountStatus,
    isActive,
    isTokenExpired: isAccessTokenExpired,
    shouldShowActivateButton: !isActive,
    shouldShowDeactivateButton: isActive,
  };
};

