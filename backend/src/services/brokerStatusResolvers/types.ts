import { ACCOUNT_STATUS, type AccountStatus } from '@copytrade/shared-types';

export interface DbAccountRecord {
  id: string | number;
  broker_name: string;
  account_id: string;
  user_id: string | number;
  user_name?: string;
  email?: string;
  broker_display_name?: string;
  exchanges?: string;
  products?: string;
  account_status?: AccountStatus;
  token_expiry_time?: string | null;
  refresh_token_expiry_time?: string | null;
  created_at?: string;
}

export interface EffectiveStatus {
  accountStatus: AccountStatus;
  isActive: boolean;
  isTokenExpired: boolean;
  shouldShowActivateButton: boolean;
  shouldShowDeactivateButton: boolean;
}

export type BrokerStatusResolver = (dbAccount: DbAccountRecord, now?: Date) => EffectiveStatus;

