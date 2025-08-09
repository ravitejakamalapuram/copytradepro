import { Request, Response } from 'express';
import { searchRankingWeightsService } from '../services/searchRankingWeightsService';
import { adminConfigService } from '../services/adminConfigService';
import { searchRankingWeights } from '../config/searchRankingConfig';

export const getSearchWeights = async (_req: Request, res: Response): Promise<void> => {
  try {
    // Prefer DB overrides if present; else return defaults
    const stored = await adminConfigService.get('searchRankingWeights');
    res.json({ success: true, data: stored ?? searchRankingWeights });
  } catch (e: any) {
    res.status(500).json({ success: false, message: e.message || 'Failed to get search weights' });
  }
};

export const updateSearchWeights = async (req: Request, res: Response): Promise<void> => {
  try {
    const body = req.body || {};
    // Basic validation: ensure numeric values where expected
    const numericKeys = [
      'exactTradingSymbol','exactDisplayName','exactUnderlying',
      'prefixTradingSymbol','prefixDisplayName','prefixUnderlying',
      'partialTradingSymbol','partialDisplayName','partialCompanyName',
      'bonusActive','bonusEquity',
      'bonusOptionUnderlyingPrefix','bonusFutureUnderlyingPrefix','bonusOptionTradingSymbolPrefix'
    ] as const;

    const cleaned: any = {};
    for (const k of numericKeys) {
      const v = body[k];
      if (v === undefined) continue;
      const n = Number(v);
      if (!Number.isFinite(n)) {
        res.status(400).json({ success: false, message: `Invalid number for ${k}` });
        return;
      }
      cleaned[k] = n;
    }

    const ok = await adminConfigService.set('searchRankingWeights', cleaned);
    if (!ok) {
      res.status(500).json({ success: false, message: 'Failed to persist weights' });
      return;
    }

    // Apply overrides in memory to make immediate effect
    searchRankingWeightsService.applyOverrides(cleaned);

    res.json({ success: true, message: 'Weights updated. Changes applied immediately.' });
  } catch (e: any) {
    res.status(500).json({ success: false, message: e.message || 'Failed to update search weights' });
  }
};

