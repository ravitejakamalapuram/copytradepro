import { BrokerStatusResolver, DbAccountRecord, EffectiveStatus } from './types';
import { resolveFyersStatus } from './fyers';
import { resolveShoonyaStatus } from './shoonya';
import { resolveDefaultStatus } from './defaultResolver';

const resolverMap: Record<string, BrokerStatusResolver> = {
  fyers: resolveFyersStatus,
  shoonya: resolveShoonyaStatus,
};

export function resolveAccountEffectiveStatus(dbAccount: DbAccountRecord, now?: Date): EffectiveStatus {
  const resolver = resolverMap[dbAccount.broker_name?.toLowerCase()] || resolveDefaultStatus;
  return resolver(dbAccount, now);
}

export * from './types';

