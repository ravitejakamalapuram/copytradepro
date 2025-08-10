import { convertSymbolForBroker } from '../services/symbolConversionHelper';

// Minimal mock symbol metadata resembling StandardizedSymbol
const sampleEquity = {
  tradingSymbol: 'TCS',
  exchange: 'NSE',
  instrumentType: 'EQUITY',
  segment: 'EQ'
};

const sampleOption = {
  tradingSymbol: 'NIFTY25JAN24500CE',
  exchange: 'NFO',
  instrumentType: 'OPTION',
  segment: 'OPT',
  strikePrice: 24500,
  optionType: 'CE',
  expiryDate: '2025-01-30'
};

describe('convertSymbolForBroker', () => {
  it('falls back to input when converter missing', () => {
    const res = convertSymbolForBroker(sampleEquity as any, 'unknown-broker');
    expect(res.tradingSymbol).toBe('TCS');
    expect(res.exchange).toBe('NSE');
  });

  it('returns a tradingSymbol for fyers equity', () => {
    const res = convertSymbolForBroker(sampleEquity as any, 'fyers');
    expect(res.tradingSymbol).toBeTruthy();
    expect(res.exchange).toBe('NSE');
  });

  it('returns a tradingSymbol for shoonya option', () => {
    const res = convertSymbolForBroker(sampleOption as any, 'shoonya');
    expect(res.tradingSymbol).toBeTruthy();
    expect(res.exchange).toBeTruthy();
  });
});

