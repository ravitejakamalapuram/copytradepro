import { searchRankingWeights as defaultWeights, SearchRankingWeights } from '../config/searchRankingConfig';
import { adminConfigService } from './adminConfigService';
import { logger } from '../utils/logger';

let current: SearchRankingWeights = { ...defaultWeights } as SearchRankingWeights;

export const searchRankingWeightsService = {
  getWeights(): SearchRankingWeights {
    return current;
  },

  async refresh(): Promise<void> {
    try {
      const overrides = await adminConfigService.get<SearchRankingWeights>('searchRankingWeights');
      if (overrides && typeof overrides === 'object') {
        current = { ...defaultWeights, ...overrides } as SearchRankingWeights;
        logger.info('Search ranking weights loaded from DB', { component: 'SEARCH_WEIGHTS' });
      } else {
        current = { ...defaultWeights } as SearchRankingWeights;
        logger.info('Using default search ranking weights', { component: 'SEARCH_WEIGHTS' });
      }
    } catch (e) {
      logger.error('Failed to refresh search ranking weights. Using defaults.', { component: 'SEARCH_WEIGHTS' }, e);
      current = { ...defaultWeights } as SearchRankingWeights;
    }
  },

  // Apply overrides immediately in-memory (used after admin updates)
  applyOverrides(overrides: Partial<SearchRankingWeights>): void {
    current = { ...defaultWeights, ...overrides } as SearchRankingWeights;
    logger.info('Applied search ranking overrides in memory', { component: 'SEARCH_WEIGHTS' });
  }
};

