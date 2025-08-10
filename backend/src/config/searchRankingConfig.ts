/**
 * Search Ranking Configuration
 * Allows tuning of relevance scoring weights via environment variables.
 */

function num(envName: string, fallback: number): number {
  const raw = process.env[envName];
  if (!raw) return fallback;
  const n = Number(raw);
  return Number.isFinite(n) ? n : fallback;
}

export interface SearchRankingWeights {
  // Exact matches
  exactTradingSymbol: number;   // tradingSymbol equals(query)
  exactDisplayName: number;     // displayName equals(query)
  exactUnderlying: number;      // underlying equals(query)

  // Prefix matches
  prefixTradingSymbol: number;  // tradingSymbol startswith(query)
  prefixDisplayName: number;    // displayName startswith(query)
  prefixUnderlying: number;     // underlying startswith(query)

  // Partial matches
  partialTradingSymbol: number;
  partialDisplayName: number;
  partialCompanyName: number;

  // Generic bonuses
  bonusActive: number;
  bonusEquity: number;

  // Derivative-specific boosts
  bonusOptionUnderlyingPrefix: number;      // OPTION with underlying startswith(query)
  bonusFutureUnderlyingPrefix: number;      // FUTURE with underlying startswith(query)
  bonusOptionTradingSymbolPrefix: number;   // OPTION with tradingSymbol startswith(query)
}

export const searchRankingWeights: SearchRankingWeights = {
  // Defaults mirror existing behavior
  exactTradingSymbol: num('SEARCH_WEIGHT_EXACT_TS', 200),
  exactDisplayName: num('SEARCH_WEIGHT_EXACT_DN', 180),
  exactUnderlying: num('SEARCH_WEIGHT_EXACT_UNDER', 160),

  prefixTradingSymbol: num('SEARCH_WEIGHT_PREFIX_TS', 100),
  prefixDisplayName: num('SEARCH_WEIGHT_PREFIX_DN', 90),
  prefixUnderlying: num('SEARCH_WEIGHT_PREFIX_UNDER', 80),

  partialTradingSymbol: num('SEARCH_WEIGHT_PARTIAL_TS', 70),
  partialDisplayName: num('SEARCH_WEIGHT_PARTIAL_DN', 60),
  partialCompanyName: num('SEARCH_WEIGHT_PARTIAL_CN', 50),

  bonusActive: num('SEARCH_WEIGHT_BONUS_ACTIVE', 10),
  bonusEquity: num('SEARCH_WEIGHT_BONUS_EQUITY', 5),

  bonusOptionUnderlyingPrefix: num('SEARCH_WEIGHT_OPTION_UNDER_PREFIX', 15),
  bonusFutureUnderlyingPrefix: num('SEARCH_WEIGHT_FUTURE_UNDER_PREFIX', 10),
  bonusOptionTradingSymbolPrefix: num('SEARCH_WEIGHT_OPTION_TS_PREFIX', 10),
};

