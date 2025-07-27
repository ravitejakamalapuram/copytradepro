import React, { useState, useEffect } from 'react';
import './UnifiedSymbolSearch.css';

interface UnifiedSymbol {
  symbol: string;
  tradingSymbol: string;
  name: string;
  instrument_type: 'EQUITY' | 'OPTION' | 'FUTURE';
  exchange: string;
  underlying_symbol?: string;
  strike_price?: number;
  expiry_date?: string;
  option_type?: 'CE' | 'PE' | 'FUT';
  lot_size?: number;
  status?: string;
}

interface UnifiedSearchResult {
  equity: UnifiedSymbol[];
  options: UnifiedSymbol[];
  futures: UnifiedSymbol[];
  total: number;
}

interface Props {
  onSymbolSelect: (symbol: UnifiedSymbol) => void;
  selectedSymbol?: UnifiedSymbol | null;
}

const UnifiedSymbolSearch: React.FC<Props> = ({ onSymbolSelect, selectedSymbol }) => {
  const [query, setQuery] = useState('');
  const [searchResults, setSearchResults] = useState<UnifiedSearchResult>({
    equity: [],
    options: [],
    futures: [],
    total: 0
  });
  const [activeTab, setActiveTab] = useState<'equity' | 'options' | 'futures'>('equity');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (query.length >= 2) {
      searchSymbols(query);
    } else {
      setSearchResults({ equity: [], options: [], futures: [], total: 0 });
    }
  }, [query]);

  const searchSymbols = async (searchQuery: string) => {
    setLoading(true);
    try {
      const response = await fetch(`/api/market-data/search-unified/${searchQuery}?type=all`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setSearchResults(data.data);
        
        // Auto-switch to tab with results
        if (data.data.equity.length > 0) {
          setActiveTab('equity');
        } else if (data.data.options.length > 0) {
          setActiveTab('options');
        } else if (data.data.futures.length > 0) {
          setActiveTab('futures');
        }
      }
    } catch (error) {
      console.error('Search failed:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSymbolClick = (symbol: UnifiedSymbol) => {
    onSymbolSelect(symbol);
    setQuery(''); // Clear search after selection
    setSearchResults({ equity: [], options: [], futures: [], total: 0 });
  };

  const renderSymbolItem = (symbol: UnifiedSymbol) => (
    <div 
      key={symbol.symbol} 
      className="symbol-item"
      onClick={() => handleSymbolClick(symbol)}
    >
      <div className="symbol-main">
        <span className="symbol-name">{symbol.symbol}</span>
        <span className="symbol-description">{symbol.name}</span>
      </div>
      
      {symbol.instrument_type === 'OPTION' && (
        <div className="fo-details">
          <span className="strike">₹{symbol.strike_price}</span>
          <span className="expiry">{symbol.expiry_date}</span>
          <span className={`option-type ${symbol.option_type?.toLowerCase()}`}>
            {symbol.option_type}
          </span>
          <span className="lot-size">Lot: {symbol.lot_size}</span>
        </div>
      )}
      
      {symbol.instrument_type === 'FUTURE' && (
        <div className="fo-details">
          <span className="expiry">{symbol.expiry_date}</span>
          <span className="lot-size">Lot: {symbol.lot_size}</span>
        </div>
      )}
      
      <div className="symbol-meta">
        <span className="exchange">{symbol.exchange}</span>
        <span className={`instrument-type ${symbol.instrument_type.toLowerCase()}`}>
          {symbol.instrument_type}
        </span>
      </div>
    </div>
  );

  return (
    <div className="unified-symbol-search">
      <div className="search-input-container">
        <input
          type="text"
          placeholder="Search stocks, options, futures..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="search-input"
        />
        {loading && <div className="search-loading">Searching...</div>}
      </div>

      {selectedSymbol && (
        <div className="selected-symbol">
          <div className="selected-label">Selected:</div>
          <div className="selected-details">
            <span className="selected-name">{selectedSymbol.symbol}</span>
            <span className="selected-description">{selectedSymbol.name}</span>
            {selectedSymbol.instrument_type === 'OPTION' && (
              <span className="selected-fo">
                ₹{selectedSymbol.strike_price} {selectedSymbol.option_type} | {selectedSymbol.expiry_date}
              </span>
            )}
            {selectedSymbol.instrument_type === 'FUTURE' && (
              <span className="selected-fo">{selectedSymbol.expiry_date}</span>
            )}
          </div>
        </div>
      )}

      {searchResults.total > 0 && (
        <div className="search-results">
          <div className="results-tabs">
            <button 
              className={`tab ${activeTab === 'equity' ? 'active' : ''}`}
              onClick={() => setActiveTab('equity')}
              disabled={searchResults.equity.length === 0}
            >
              Equity ({searchResults.equity.length})
            </button>
            <button 
              className={`tab ${activeTab === 'options' ? 'active' : ''}`}
              onClick={() => setActiveTab('options')}
              disabled={searchResults.options.length === 0}
            >
              Options ({searchResults.options.length})
            </button>
            <button 
              className={`tab ${activeTab === 'futures' ? 'active' : ''}`}
              onClick={() => setActiveTab('futures')}
              disabled={searchResults.futures.length === 0}
            >
              Futures ({searchResults.futures.length})
            </button>
          </div>

          <div className="results-content">
            {activeTab === 'equity' && (
              <div className="results-list">
                {searchResults.equity.map(renderSymbolItem)}
              </div>
            )}
            
            {activeTab === 'options' && (
              <div className="results-list">
                {searchResults.options.map(renderSymbolItem)}
              </div>
            )}
            
            {activeTab === 'futures' && (
              <div className="results-list">
                {searchResults.futures.map(renderSymbolItem)}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default UnifiedSymbolSearch;