import React, { useState, useEffect, useRef } from 'react';
import { brokerService } from '../services/brokerService';
import './OrderSearchInput.css';

interface OrderSearchInputProps {
  value: string;
  onChange: (value: string) => void;
  onSearch: (searchTerm: string) => void;
  placeholder?: string;
  disabled?: boolean;
}

interface SearchSuggestion {
  value: string;
  type: 'symbol' | 'order_id' | 'broker_order_id';
}

const OrderSearchInput: React.FC<OrderSearchInputProps> = ({
  value,
  onChange,
  onSearch,
  placeholder = "Search by symbol, order ID, or broker order ID...",
  disabled = false,
}) => {
  const [suggestions, setSuggestions] = useState<SearchSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  
  const inputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<number | null>(null);

  // Debounced search for suggestions
  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    if (value.trim().length >= 2) {
      debounceRef.current = window.setTimeout(async () => {
        setIsLoading(true);
        try {
          const response = await brokerService.getOrderSearchSuggestions(value.trim(), 8);
          if (response.success && response.data) {
            setSuggestions(response.data.suggestions);
            setShowSuggestions(true);
          }
        } catch (error) {
          console.error('Failed to fetch suggestions:', error);
        } finally {
          setIsLoading(false);
        }
      }, 300);
    } else {
      setSuggestions([]);
      setShowSuggestions(false);
    }

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [value]);

  // Handle input change
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    onChange(newValue);
    setSelectedIndex(-1);
  };

  // Handle suggestion selection
  const handleSuggestionClick = (suggestion: SearchSuggestion) => {
    onChange(suggestion.value);
    setShowSuggestions(false);
    onSearch(suggestion.value);
  };

  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showSuggestions || suggestions.length === 0) {
      if (e.key === 'Enter') {
        e.preventDefault();
        onSearch(value);
      }
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(prev => 
          prev < suggestions.length - 1 ? prev + 1 : prev
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(prev => prev > 0 ? prev - 1 : -1);
        break;
      case 'Enter':
        e.preventDefault();
        if (selectedIndex >= 0 && selectedIndex < suggestions.length) {
          handleSuggestionClick(suggestions[selectedIndex]);
        } else {
          onSearch(value);
        }
        break;
      case 'Escape':
        setShowSuggestions(false);
        setSelectedIndex(-1);
        break;
    }
  };

  // Handle click outside to close suggestions
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        suggestionsRef.current &&
        !suggestionsRef.current.contains(event.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(event.target as Node)
      ) {
        setShowSuggestions(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Get icon for suggestion type
  const getSuggestionIcon = (type: SearchSuggestion['type']) => {
    switch (type) {
      case 'symbol':
        return '📈';
      case 'order_id':
        return '🔢';
      case 'broker_order_id':
        return '🏦';
      default:
        return '🔍';
    }
  };

  // Get label for suggestion type
  const getSuggestionLabel = (type: SearchSuggestion['type']) => {
    switch (type) {
      case 'symbol':
        return 'Symbol';
      case 'order_id':
        return 'Order ID';
      case 'broker_order_id':
        return 'Broker Order ID';
      default:
        return 'Unknown';
    }
  };

  return (
    <div className="search-input-container">
      <div className="search-input-wrapper">
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="search-input"
          disabled={disabled}
        />
        <div className="search-input-icons">
          {isLoading && <div className="search-loading">⏳</div>}
          <button
            type="button"
            className="search-button"
            onClick={() => onSearch(value)}
            disabled={disabled}
          >
            🔍
          </button>
        </div>
      </div>

      {showSuggestions && suggestions.length > 0 && (
        <div ref={suggestionsRef} className="search-suggestions">
          {suggestions.map((suggestion, index) => (
            <div
              key={`${suggestion.type}-${suggestion.value}`}
              className={`search-suggestion ${index === selectedIndex ? 'selected' : ''}`}
              onClick={() => handleSuggestionClick(suggestion)}
            >
              <span className="suggestion-icon">
                {getSuggestionIcon(suggestion.type)}
              </span>
              <div className="suggestion-content">
                <span className="suggestion-value">{suggestion.value}</span>
                <span className="suggestion-type">
                  {getSuggestionLabel(suggestion.type)}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default OrderSearchInput;
