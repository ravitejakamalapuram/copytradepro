/**
 * LIVE PRICE TICKER
 * Scrolling ticker with live price updates
 */

import React, { useState, useEffect } from 'react';
import { useRealTimeData } from '../hooks/useRealTimeData';
import AnimatedPrice from './AnimatedPrice';
import './LivePriceTicker.css';

interface TickerSymbol {
  symbol: string;
  name: string;
  exchange: string;
}

interface LivePriceTickerProps {
  symbols?: TickerSymbol[];
  speed?: 'slow' | 'medium' | 'fast';
  className?: string;
}

const defaultSymbols: TickerSymbol[] = [
  { symbol: 'RELIANCE', name: 'Reliance Industries', exchange: 'NSE' },
  { symbol: 'TCS', name: 'Tata Consultancy Services', exchange: 'NSE' },
  { symbol: 'HDFCBANK', name: 'HDFC Bank', exchange: 'NSE' },
  { symbol: 'INFY', name: 'Infosys', exchange: 'NSE' },
  { symbol: 'ICICIBANK', name: 'ICICI Bank', exchange: 'NSE' },
  { symbol: 'HINDUNILVR', name: 'Hindustan Unilever', exchange: 'NSE' },
  { symbol: 'ITC', name: 'ITC Limited', exchange: 'NSE' },
  { symbol: 'SBIN', name: 'State Bank of India', exchange: 'NSE' },
  { symbol: 'BHARTIARTL', name: 'Bharti Airtel', exchange: 'NSE' },
  { symbol: 'KOTAKBANK', name: 'Kotak Mahindra Bank', exchange: 'NSE' }
];

const LivePriceTicker: React.FC<LivePriceTickerProps> = ({
  symbols = defaultSymbols,
  speed = 'medium',
  className = ''
}) => {
  const { subscribeToSymbols, getLivePrice, connected } = useRealTimeData();
  const [isVisible, setIsVisible] = useState(true);

  // Subscribe to ticker symbols on mount
  useEffect(() => {
    if (connected) {
      subscribeToSymbols(symbols.map(s => ({ symbol: s.symbol, exchange: s.exchange })));
    }
  }, [connected, subscribeToSymbols, symbols]);

  // Auto-hide ticker when not connected
  useEffect(() => {
    setIsVisible(connected);
  }, [connected]);

  const getSpeedClass = () => {
    switch (speed) {
      case 'slow': return 'ticker-scroll--slow';
      case 'fast': return 'ticker-scroll--fast';
      default: return 'ticker-scroll--medium';
    }
  };

  if (!isVisible) {
    return null;
  }

  return (
    <div className={`live-price-ticker ${className}`}>
      <div className="ticker-container">
        <div className="ticker-label">
          <span className="ticker-icon">📈</span>
          <span className="ticker-text">LIVE</span>
        </div>
        
        <div className="ticker-content">
          <div className={`ticker-scroll ${getSpeedClass()}`}>
            {/* Duplicate symbols for seamless scrolling */}
            {[...symbols, ...symbols].map((symbol, index) => {
              const livePrice = getLivePrice(symbol.symbol, symbol.exchange);
              
              return (
                <div key={`${symbol.symbol}-${index}`} className="ticker-item">
                  <span className="ticker-symbol">{symbol.symbol}</span>
                  <AnimatedPrice
                    value={livePrice?.price || 0}
                    change={livePrice?.change || 0}
                    changePercent={livePrice?.changePercent || 0}
                    size="sm"
                    animate={true}
                    className="ticker-price"
                  />
                  <span className={`ticker-change ${
                    (livePrice?.changePercent || 0) >= 0 ? 'ticker-change--up' : 'ticker-change--down'
                  }`}>
                    {(livePrice?.changePercent || 0) >= 0 ? '▲' : '▼'}
                    {Math.abs(livePrice?.changePercent || 0).toFixed(2)}%
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="ticker-controls">
          <button
            className="ticker-control-btn"
            onClick={() => setIsVisible(false)}
            title="Hide ticker"
          >
            ✕
          </button>
        </div>
      </div>
    </div>
  );
};

export default LivePriceTicker;
