/**
 * Search Helper Functions
 * Common utilities for instrument search operations
 */

import { logger } from './logger';

export interface SearchQuery {
  text?: string | undefined;
  instrumentType?: 'EQUITY' | 'OPTION' | 'FUTURE' | 'ALL' | undefined;
  exchange?: string | undefined;
  underlying?: string | undefined;
  strikeMin?: number | undefined;
  strikeMax?: number | undefined;
  expiryStart?: string | undefined;
  expiryEnd?: string | undefined;
  optionType?: 'CE' | 'PE' | undefined;
  isActive?: boolean | undefined;
  limit?: number | undefined;
  offset?: number | undefined;
  fuzzy?: boolean | undefined;
}

export interface SearchFilter {
  field: string;
  operator: 'eq' | 'ne' | 'gt' | 'gte' | 'lt' | 'lte' | 'in' | 'nin' | 'regex';
  value: any;
}

export interface SortOption {
  field: string;
  direction: 'asc' | 'desc';
}

/**
 * Build MongoDB aggregation pipeline for search
 */
export function buildSearchPipeline(
  query: SearchQuery,
  additionalFilters: SearchFilter[] = [],
  sortOptions: SortOption[] = []
): any[] {
  const pipeline: any[] = [];
  const matchStage: any = {};

  // Apply basic filters
  if (query.instrumentType && query.instrumentType !== 'ALL') {
    matchStage.instrumentType = query.instrumentType;
  }

  if (query.exchange) {
    matchStage.exchange = query.exchange;
  }

  if (query.underlying) {
    matchStage.underlying = { $regex: escapeRegex(query.underlying), $options: 'i' };
  }

  if (query.strikeMin !== undefined || query.strikeMax !== undefined) {
    matchStage.strikePrice = {};
    if (query.strikeMin !== undefined) {
      matchStage.strikePrice.$gte = query.strikeMin;
    }
    if (query.strikeMax !== undefined) {
      matchStage.strikePrice.$lte = query.strikeMax;
    }
  }

  if (query.expiryStart || query.expiryEnd) {
    matchStage.expiryDate = {};
    if (query.expiryStart) {
      matchStage.expiryDate.$gte = new Date(query.expiryStart);
    }
    if (query.expiryEnd) {
      matchStage.expiryDate.$lte = new Date(query.expiryEnd);
    }
  }

  if (query.optionType) {
    matchStage.optionType = query.optionType;
  }

  if (query.isActive !== undefined) {
    matchStage.isActive = query.isActive;
  }

  // Apply additional filters
  for (const filter of additionalFilters) {
    applyFilterToMatchStage(matchStage, filter);
  }

  // Add initial match stage if we have filters
  if (Object.keys(matchStage).length > 0) {
    pipeline.push({ $match: matchStage });
  }

  // Add text search and scoring
  if (query.text && query.text.trim()) {
    const textSearchStage = buildTextSearchStage(query.text, query.fuzzy !== false);
    pipeline.push(...textSearchStage);
  } else {
    // Add basic scoring for non-text searches
    pipeline.push({
      $addFields: {
        relevanceScore: {
          $add: [
            { $cond: ["$isActive", 10, 0] },
            { $cond: [{ $eq: ["$instrumentType", "EQUITY"] }, 5, 0] }
          ]
        }
      }
    });
  }

  // Add sorting
  const sortStage = buildSortStage(sortOptions, !!query.text);
  pipeline.push(sortStage);

  // Add pagination
  const limit = query.limit || 50;
  const offset = query.offset || 0;

  pipeline.push({
    $facet: {
      data: [
        { $skip: offset },
        { $limit: limit }
      ],
      totalCount: [
        { $count: "count" }
      ]
    }
  });

  return pipeline;
}

/**
 * Build text search stage with fuzzy matching and relevance scoring
 */
function buildTextSearchStage(text: string, fuzzy: boolean): any[] {
  const stages: any[] = [];
  const escapedText = escapeRegex(text.trim());

  if (fuzzy) {
    // Fuzzy search with relevance scoring
    stages.push({
      $match: {
        $or: [
          { tradingSymbol: { $regex: escapedText, $options: 'i' } },
          { displayName: { $regex: escapedText, $options: 'i' } },
          { underlying: { $regex: escapedText, $options: 'i' } },
          { companyName: { $regex: escapedText, $options: 'i' } }
        ]
      }
    });

    // Add relevance scoring
    stages.push({
      $addFields: {
        relevanceScore: {
          $add: [
            // Exact matches at start get highest score
            { $cond: [{ $regexMatch: { input: "$tradingSymbol", regex: `^${escapedText}`, options: "i" } }, 100, 0] },
            { $cond: [{ $regexMatch: { input: "$displayName", regex: `^${escapedText}`, options: "i" } }, 90, 0] },
            { $cond: [{ $regexMatch: { input: "$underlying", regex: `^${escapedText}`, options: "i" } }, 80, 0] },
            
            // Partial matches get medium score
            { $cond: [{ $regexMatch: { input: "$tradingSymbol", regex: escapedText, options: "i" } }, 70, 0] },
            { $cond: [{ $regexMatch: { input: "$displayName", regex: escapedText, options: "i" } }, 60, 0] },
            { $cond: [{ $regexMatch: { input: "$companyName", regex: escapedText, options: "i" } }, 50, 0] },
            
            // Bonus points for active instruments and equity
            { $cond: ["$isActive", 10, 0] },
            { $cond: [{ $eq: ["$instrumentType", "EQUITY"] }, 5, 0] }
          ]
        }
      }
    });
  } else {
    // Exact search without fuzzy matching
    stages.push({
      $match: {
        $or: [
          { tradingSymbol: { $regex: `^${escapedText}`, $options: 'i' } },
          { displayName: { $regex: `^${escapedText}`, $options: 'i' } },
          { companyName: { $regex: `^${escapedText}`, $options: 'i' } }
        ]
      }
    });

    stages.push({
      $addFields: {
        relevanceScore: {
          $add: [
            { $cond: ["$isActive", 10, 0] },
            { $cond: [{ $eq: ["$instrumentType", "EQUITY"] }, 5, 0] }
          ]
        }
      }
    });
  }

  return stages;
}

/**
 * Build sort stage based on options
 */
function buildSortStage(sortOptions: SortOption[], hasTextSearch: boolean): any {
  const sortStage: any = {};

  if (sortOptions.length > 0) {
    // Use provided sort options
    for (const option of sortOptions) {
      sortStage[option.field] = option.direction === 'desc' ? -1 : 1;
    }
  } else if (hasTextSearch) {
    // Default sort for text search: relevance first
    sortStage.relevanceScore = -1;
    sortStage.isActive = -1;
    sortStage.lastUpdated = -1;
  } else {
    // Default sort for non-text search
    sortStage.isActive = -1;
    sortStage.displayName = 1;
    sortStage.lastUpdated = -1;
  }

  return { $sort: sortStage };
}

/**
 * Apply filter to match stage
 */
function applyFilterToMatchStage(matchStage: any, filter: SearchFilter): void {
  const { field, operator, value } = filter;

  switch (operator) {
    case 'eq':
      matchStage[field] = value;
      break;
    case 'ne':
      matchStage[field] = { $ne: value };
      break;
    case 'gt':
      matchStage[field] = { $gt: value };
      break;
    case 'gte':
      matchStage[field] = { $gte: value };
      break;
    case 'lt':
      matchStage[field] = { $lt: value };
      break;
    case 'lte':
      matchStage[field] = { $lte: value };
      break;
    case 'in':
      matchStage[field] = { $in: Array.isArray(value) ? value : [value] };
      break;
    case 'nin':
      matchStage[field] = { $nin: Array.isArray(value) ? value : [value] };
      break;
    case 'regex':
      matchStage[field] = { $regex: escapeRegex(value), $options: 'i' };
      break;
    default:
      logger.warn('Unknown filter operator', {
        component: 'SEARCH_HELPERS',
        operation: 'APPLY_FILTER',
        operator
      });
  }
}

/**
 * Escape special regex characters for safe MongoDB regex queries
 */
export function escapeRegex(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Normalize search query text
 */
export function normalizeSearchQuery(query: string): string {
  return query
    .trim()
    .replace(/\s+/g, ' ') // Replace multiple spaces with single space
    .toUpperCase(); // Convert to uppercase for consistent matching
}

/**
 * Build option chain filters
 */
export function buildOptionChainFilters(
  underlying: string,
  expiryDate?: string,
  strikeRange?: { min: number; max: number }
): SearchFilter[] {
  const filters: SearchFilter[] = [
    { field: 'instrumentType', operator: 'eq', value: 'OPTION' },
    { field: 'underlying', operator: 'eq', value: underlying },
    { field: 'isActive', operator: 'eq', value: true }
  ];

  if (expiryDate) {
    filters.push({ field: 'expiryDate', operator: 'eq', value: new Date(expiryDate) });
  }

  if (strikeRange) {
    if (strikeRange.min) {
      filters.push({ field: 'strikePrice', operator: 'gte', value: strikeRange.min });
    }
    if (strikeRange.max) {
      filters.push({ field: 'strikePrice', operator: 'lte', value: strikeRange.max });
    }
  }

  return filters;
}

/**
 * Build futures chain filters
 */
export function buildFuturesChainFilters(underlying: string): SearchFilter[] {
  return [
    { field: 'instrumentType', operator: 'eq', value: 'FUTURE' },
    { field: 'underlying', operator: 'eq', value: underlying },
    { field: 'isActive', operator: 'eq', value: true }
  ];
}

/**
 * Validate search parameters
 */
export function validateSearchQuery(query: SearchQuery): {
  isValid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  // Validate limit
  if (query.limit !== undefined) {
    if (query.limit < 1 || query.limit > 1000) {
      errors.push('Limit must be between 1 and 1000');
    }
  }

  // Validate offset
  if (query.offset !== undefined) {
    if (query.offset < 0) {
      errors.push('Offset must be non-negative');
    }
  }

  // Validate strike range
  if (query.strikeMin !== undefined && query.strikeMax !== undefined) {
    if (query.strikeMin > query.strikeMax) {
      errors.push('Strike minimum cannot be greater than strike maximum');
    }
  }

  // Validate date range
  if (query.expiryStart && query.expiryEnd) {
    const startDate = new Date(query.expiryStart);
    const endDate = new Date(query.expiryEnd);
    
    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      errors.push('Invalid date format in expiry range');
    } else if (startDate > endDate) {
      errors.push('Expiry start date cannot be after end date');
    }
  }

  // Validate instrument type
  if (query.instrumentType && !['EQUITY', 'OPTION', 'FUTURE', 'ALL'].includes(query.instrumentType)) {
    errors.push('Invalid instrument type');
  }

  // Validate option type
  if (query.optionType && !['CE', 'PE'].includes(query.optionType)) {
    errors.push('Invalid option type');
  }

  // Validate exchange
  if (query.exchange && !['NSE', 'BSE', 'NFO', 'BFO', 'MCX'].includes(query.exchange)) {
    errors.push('Invalid exchange');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Create search cache key
 */
export function createSearchCacheKey(query: SearchQuery): string {
  const keyParts = [
    query.text || '',
    query.instrumentType || 'ALL',
    query.exchange || '',
    query.underlying || '',
    query.strikeMin?.toString() || '',
    query.strikeMax?.toString() || '',
    query.expiryStart || '',
    query.expiryEnd || '',
    query.optionType || '',
    query.isActive?.toString() || 'true',
    query.limit?.toString() || '50',
    query.offset?.toString() || '0',
    query.fuzzy?.toString() || 'true'
  ];

  return `search:${keyParts.join(':')}`;
}

/**
 * Parse search query from request parameters
 */
export function parseSearchQuery(params: any): SearchQuery {
  const strikeMin = params.strikeMin ? parseFloat(params.strikeMin) : undefined;
  const strikeMax = params.strikeMax ? parseFloat(params.strikeMax) : undefined;
  
  return {
    text: params.query || params.q || undefined,
    instrumentType: params.instrumentType || params.type || undefined,
    exchange: params.exchange || undefined,
    underlying: params.underlying || undefined,
    strikeMin: !isNaN(strikeMin as any) ? strikeMin : undefined,
    strikeMax: !isNaN(strikeMax as any) ? strikeMax : undefined,
    expiryStart: params.expiryStart || undefined,
    expiryEnd: params.expiryEnd || undefined,
    optionType: params.optionType || undefined,
    isActive: params.isActive !== undefined ? params.isActive === 'true' : true,
    limit: params.limit ? parseInt(params.limit, 10) : 50,
    offset: params.offset ? parseInt(params.offset, 10) : 0,
    fuzzy: params.fuzzy !== undefined ? params.fuzzy === 'true' : true
  };
}

/**
 * Format search results for API response
 */
export function formatSearchResults(results: any[], total: number, searchTime: number): {
  success: boolean;
  data: any[];
  pagination: {
    total: number;
    count: number;
    hasMore: boolean;
  };
  meta: {
    searchTime: number;
    timestamp: string;
  };
} {
  return {
    success: true,
    data: results,
    pagination: {
      total,
      count: results.length,
      hasMore: results.length > 0 && results.length < total
    },
    meta: {
      searchTime,
      timestamp: new Date().toISOString()
    }
  };
}

/**
 * Create error response for search failures
 */
export function createSearchErrorResponse(error: Error, searchTime: number): {
  success: boolean;
  error: string;
  data: any[];
  meta: {
    searchTime: number;
    timestamp: string;
  };
} {
  return {
    success: false,
    error: error.message,
    data: [],
    meta: {
      searchTime,
      timestamp: new Date().toISOString()
    }
  };
}