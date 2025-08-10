import { ACCOUNT_STATUS, type AccountStatus } from '@copytrade/shared-types';
import { BrokerStatusResolver, DbAccountRecord, EffectiveStatus } from './types';

export const resolveFyersStatus: BrokerStatusResolver = (dbAccount: DbAccountRecord, nowInput?: Date): EffectiveStatus => {
  const now = nowInput ?? new Date();
  const accessTokenExpiry = dbAccount.token_expiry_time ? new Date(dbAccount.token_expiry_time) : null;
  const refreshTokenExpiry = dbAccount.refresh_token_expiry_time ? new Date(dbAccount.refresh_token_expiry_time) : null;

  const isAccessTokenExpired = accessTokenExpiry ? now > accessTokenExpiry : false;
  const isRefreshTokenExpired = refreshTokenExpiry ? now > refreshTokenExpiry : false;
  const hasAnyTokenInfo = Boolean(dbAccount.token_expiry_time || dbAccount.refresh_token_expiry_time);

  let accountStatus: AccountStatus;
  // If DB says not ACTIVE or tokens missing, treat as needing OAuth
  if (dbAccount.account_status !== ACCOUNT_STATUS.ACTIVE || !hasAnyTokenInfo) {
    accountStatus = ACCOUNT_STATUS.PROCEED_TO_OAUTH;
  } else if (isRefreshTokenExpired) {
    accountStatus = ACCOUNT_STATUS.INACTIVE; // needs full OAuth again
  } else if (isAccessTokenExpired) {
    // We don't have REFRESH_REQUIRED in ACCOUNT_STATUS; reflect inactive for UI but
    // the flow can still attempt refresh during actions if supported
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

