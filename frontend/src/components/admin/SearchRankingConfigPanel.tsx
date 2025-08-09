import React, { useEffect, useState } from 'react';
import Card, { CardHeader, CardContent } from '../ui/Card';
import Button from '../ui/Button';
import { Stack, Flex } from '../ui/Layout';
import { useToast } from '../Toast';
import api from '../../services/api';

type ApiResponse<T> = { success: boolean; data?: T; message?: string };

type Weights = {
  exactTradingSymbol: number;
  exactDisplayName: number;
  exactUnderlying: number;
  prefixTradingSymbol: number;
  prefixDisplayName: number;
  prefixUnderlying: number;
  partialTradingSymbol: number;
  partialDisplayName: number;
  partialCompanyName: number;
  bonusActive: number;
  bonusEquity: number;
  bonusOptionUnderlyingPrefix: number;
  bonusFutureUnderlyingPrefix: number;
  bonusOptionTradingSymbolPrefix: number;
};

const defaults: Weights = {
  exactTradingSymbol: 200,
  exactDisplayName: 180,
  exactUnderlying: 160,
  prefixTradingSymbol: 100,
  prefixDisplayName: 90,
  prefixUnderlying: 80,
  partialTradingSymbol: 70,
  partialDisplayName: 60,
  partialCompanyName: 50,
  bonusActive: 10,
  bonusEquity: 5,
  bonusOptionUnderlyingPrefix: 15,
  bonusFutureUnderlyingPrefix: 10,
  bonusOptionTradingSymbolPrefix: 10,
};

export const SearchRankingConfigPanel: React.FC = () => {
  const { showToast } = useToast();
  const [weights, setWeights] = useState<Weights>(defaults);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const res = await api.get<ApiResponse<Partial<Weights>>>('/api/admin/search-weights');
        const payload = (res as any).data as ApiResponse<Partial<Weights>>;
        if (payload?.success && payload?.data) {
          setWeights({ ...defaults, ...payload.data });
        }
      } catch (e) {
        // ignore
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const handleChange = (key: keyof Weights, value: string) => {
    const n = Number(value);
    if (!Number.isFinite(n)) return;
    setWeights(prev => ({ ...prev, [key]: n }));
  };

  const save = async () => {
    try {
      setLoading(true);
      const res = await api.post<ApiResponse<unknown>>('/api/admin/search-weights', weights);
      const payload = (res as any).data as ApiResponse<unknown>;
      if (payload?.success) {
        showToast({ type: 'success', title: 'Search weights updated' });
      } else {
        showToast({ type: 'error', title: payload?.message || 'Update failed' });
      }
    } catch (e: any) {
      showToast({ type: 'error', title: e.message || 'Update failed' });
    } finally {
      setLoading(false);
    }
  };

  const InputRow: React.FC<{ label: string; value: number; onChange: (v: string) => void }> = ({ label, value, onChange }) => (
    <Flex justify="between" align="center" style={{ gap: '1rem' }}>
      <div style={{ color: 'var(--text-secondary)' }}>{label}</div>
      <input
        type="number"
        className="form-input"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{ width: '8rem' }}
      />
    </Flex>
  );

  return (
    <Card>
      <CardHeader>
        <h3 style={{ margin: 0 }}>Search Ranking Weights</h3>
        <p style={{ margin: 0, color: 'var(--text-secondary)' }}>Tune ranking without redeploy. Changes take effect immediately.</p>
      </CardHeader>
      <CardContent>
        <Stack gap={3}>
          <InputRow label="Prefix: Trading Symbol" value={weights.prefixTradingSymbol} onChange={(v) => handleChange('prefixTradingSymbol', v)} />
          <InputRow label="Prefix: Display Name" value={weights.prefixDisplayName} onChange={(v) => handleChange('prefixDisplayName', v)} />
          <InputRow label="Prefix: Underlying" value={weights.prefixUnderlying} onChange={(v) => handleChange('prefixUnderlying', v)} />
          <InputRow label="Partial: Trading Symbol" value={weights.partialTradingSymbol} onChange={(v) => handleChange('partialTradingSymbol', v)} />
          <InputRow label="Exact: Trading Symbol" value={weights.exactTradingSymbol} onChange={(v) => handleChange('exactTradingSymbol', v)} />
          <InputRow label="Exact: Display Name" value={weights.exactDisplayName} onChange={(v) => handleChange('exactDisplayName', v)} />
          <InputRow label="Exact: Underlying" value={weights.exactUnderlying} onChange={(v) => handleChange('exactUnderlying', v)} />

          <InputRow label="Partial: Display Name" value={weights.partialDisplayName} onChange={(v) => handleChange('partialDisplayName', v)} />
          <InputRow label="Partial: Company Name" value={weights.partialCompanyName} onChange={(v) => handleChange('partialCompanyName', v)} />
          <InputRow label="Bonus: Active" value={weights.bonusActive} onChange={(v) => handleChange('bonusActive', v)} />
          <InputRow label="Bonus: Equity" value={weights.bonusEquity} onChange={(v) => handleChange('bonusEquity', v)} />
          <InputRow label="Deriv: Option Underlying Prefix" value={weights.bonusOptionUnderlyingPrefix} onChange={(v) => handleChange('bonusOptionUnderlyingPrefix', v)} />
          <InputRow label="Deriv: Future Underlying Prefix" value={weights.bonusFutureUnderlyingPrefix} onChange={(v) => handleChange('bonusFutureUnderlyingPrefix', v)} />
          <InputRow label="Deriv: Option TradingSymbol Prefix" value={weights.bonusOptionTradingSymbolPrefix} onChange={(v) => handleChange('bonusOptionTradingSymbolPrefix', v)} />
        </Stack>
        <div style={{ marginTop: '1rem' }}>
          <Button variant="primary" onClick={save} disabled={loading}>
            {loading ? 'Saving...' : 'Save'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default SearchRankingConfigPanel;

