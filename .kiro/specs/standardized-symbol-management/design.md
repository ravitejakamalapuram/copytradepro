# Design Document

## Overview

The Standardized Symbol Management System provides a unified approach to handling financial instrument symbols across multiple brokers. It decouples symbol data from broker-specific APIs, maintains a standardized internal format, and provides automatic conversion to broker-required formats.

## Architecture

### High-Level Architecture

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   External      │    │   Symbol Data    │    │   Broker        │
│   Data Sources  │───▶│   Processing     │───▶│   Formatters    │
│   (Upstox, etc)│    │   Service        │    │   (Fyers, etc)  │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                                │
                                ▼
                       ┌──────────────────┐
                       │   Standardized   │
                       │   Symbol         │
                       │   Database       │
                       └──────────────────┘
                                │
                                ▼
                       ┌──────────────────┐
                       │   Search & API   │
                       │   Services       │
                       └──────────────────┘
```

### Component Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Symbol Management System                  │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐ │
│  │   Data Ingestion│  │   Symbol Search │  │  Broker Format  │ │
│  │   Service       │  │   API           │  │  Converters     │ │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘ │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐ │
│  │   Validation    │  │   Caching       │  │   Historical    │ │
│  │   Engine        │  │   Layer         │  │   Data Manager  │ │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘ │
├─────────────────────────────────────────────────────────────┤
│                    Standardized Symbol Database              │
└─────────────────────────────────────────────────────────────┘
```

## Components and Interfaces

### 1. Standardized Symbol Data Model

```typescript
interface StandardizedSymbol {
  // Unique identifier
  id: string;
  
  // Display information
  displayName: string;          // "NIFTY 22000 CE 30 JAN 25"
  tradingSymbol: string;        // "NIFTY25JAN22000CE"
  
  // Basic information
  instrumentType: 'EQUITY' | 'OPTION' | 'FUTURE';
  exchange: 'NSE' | 'BSE' | 'NFO' | 'BFO' | 'MCX';
  segment: string;              // "EQ", "FO", "CD", etc.
  
  // Instrument-specific data
  underlying?: string;          // For options/futures
  strikePrice?: number;         // For options
  optionType?: 'CE' | 'PE';     // For options
  expiryDate?: string;          // ISO format: "2025-01-30"
  lotSize: number;
  tickSize: number;
  
  // Metadata
  isActive: boolean;
  lastUpdated: string;          // ISO timestamp
  source: string;               // "upstox", "manual", etc.
  
  // Additional data
  isin?: string;
  companyName?: string;         // For equity
  sector?: string;              // For equity
}
```

### 2. Symbol Data Ingestion Service

```typescript
interface SymbolDataIngestionService {
  // Main processing methods
  processUpstoxData(filePath: string): Promise<ProcessingResult>;
  validateSymbolData(symbols: RawSymbolData[]): ValidationResult;
  transformToStandardFormat(rawData: RawSymbolData[]): StandardizedSymbol[];
  
  // Database operations
  upsertSymbols(symbols: StandardizedSymbol[]): Promise<UpsertResult>;
  deactivateRemovedSymbols(activeSymbols: string[]): Promise<number>;
  
  // Scheduling
  scheduleDailyUpdate(): void;
  runManualUpdate(): Promise<UpdateResult>;
}

interface ProcessingResult {
  totalProcessed: number;
  validSymbols: number;
  invalidSymbols: number;
  newSymbols: number;
  updatedSymbols: number;
  errors: ProcessingError[];
}
```

### 3. Symbol Search API

```typescript
interface SymbolSearchService {
  // Search methods
  searchSymbols(query: SearchQuery): Promise<SearchResult>;
  getSymbolById(id: string): Promise<StandardizedSymbol | null>;
  getSymbolsByUnderlying(underlying: string): Promise<StandardizedSymbol[]>;
  
  // Filtering methods
  filterByInstrumentType(type: InstrumentType): Promise<StandardizedSymbol[]>;
  filterByExchange(exchange: string): Promise<StandardizedSymbol[]>;
  filterByExpiry(startDate: string, endDate: string): Promise<StandardizedSymbol[]>;
}

interface SearchQuery {
  query?: string;               // Text search
  instrumentType?: InstrumentType;
  exchange?: string;
  underlying?: string;
  strikeMin?: number;
  strikeMax?: number;
  expiryStart?: string;
  expiryEnd?: string;
  optionType?: 'CE' | 'PE';
  isActive?: boolean;
  limit?: number;
  offset?: number;
}

interface SearchResult {
  symbols: StandardizedSymbol[];
  total: number;
  hasMore: boolean;
}
```

### 4. Broker Format Converters

```typescript
interface BrokerSymbolConverter {
  convertToFyersFormat(symbol: StandardizedSymbol): string;
  convertToShoonyaFormat(symbol: StandardizedSymbol): { tradingSymbol: string; exchange: string };
  convertToZerodhaFormat(symbol: StandardizedSymbol): string;
  
  // Generic converter
  convertToBrokerFormat(symbol: StandardizedSymbol, brokerName: string): BrokerSymbolFormat;
}

interface BrokerSymbolFormat {
  tradingSymbol: string;
  exchange?: string;
  segment?: string;
  additionalParams?: Record<string, any>;
}

// Broker-specific implementations
class FyersSymbolConverter implements BrokerSymbolConverter {
  convertToFyersFormat(symbol: StandardizedSymbol): string {
    switch (symbol.instrumentType) {
      case 'EQUITY':
        return `${symbol.exchange}:${symbol.tradingSymbol}-EQ`;
      case 'OPTION':
        return `${symbol.exchange}:${symbol.tradingSymbol}`;
      case 'FUTURE':
        return `${symbol.exchange}:${symbol.tradingSymbol}`;
      default:
        throw new Error(`Unsupported instrument type: ${symbol.instrumentType}`);
    }
  }
}

class ShoonyaSymbolConverter implements BrokerSymbolConverter {
  convertToShoonyaFormat(symbol: StandardizedSymbol): { tradingSymbol: string; exchange: string } {
    const exchangeMap = {
      'NSE': symbol.instrumentType === 'EQUITY' ? 'NSE' : 'NFO',
      'BSE': symbol.instrumentType === 'EQUITY' ? 'BSE' : 'BFO',
      'MCX': 'MCX'
    };
    
    return {
      tradingSymbol: symbol.tradingSymbol,
      exchange: exchangeMap[symbol.exchange] || symbol.exchange
    };
  }
}
```

### 5. Data Processing Pipeline

```typescript
interface DataProcessingPipeline {
  // Pipeline stages
  extract(source: DataSource): Promise<RawSymbolData[]>;
  transform(rawData: RawSymbolData[]): Promise<StandardizedSymbol[]>;
  validate(symbols: StandardizedSymbol[]): Promise<ValidationResult>;
  load(symbols: StandardizedSymbol[]): Promise<LoadResult>;
  
  // Pipeline execution
  runFullPipeline(source: DataSource): Promise<PipelineResult>;
  runIncrementalUpdate(source: DataSource): Promise<PipelineResult>;
}

interface DataSource {
  type: 'upstox' | 'nse' | 'bse' | 'manual';
  url?: string;
  filePath?: string;
  credentials?: Record<string, string>;
}
```

## Data Models

### Database Schema

```sql
-- Main symbols table
CREATE TABLE standardized_symbols (
  id VARCHAR(50) PRIMARY KEY,
  display_name VARCHAR(200) NOT NULL,
  trading_symbol VARCHAR(100) NOT NULL,
  instrument_type ENUM('EQUITY', 'OPTION', 'FUTURE') NOT NULL,
  exchange ENUM('NSE', 'BSE', 'NFO', 'BFO', 'MCX') NOT NULL,
  segment VARCHAR(10),
  underlying VARCHAR(50),
  strike_price DECIMAL(10,2),
  option_type ENUM('CE', 'PE'),
  expiry_date DATE,
  lot_size INT NOT NULL DEFAULT 1,
  tick_size DECIMAL(10,4) NOT NULL DEFAULT 0.05,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  source VARCHAR(20) NOT NULL,
  isin VARCHAR(12),
  company_name VARCHAR(200),
  sector VARCHAR(50),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  INDEX idx_trading_symbol (trading_symbol),
  INDEX idx_instrument_type (instrument_type),
  INDEX idx_exchange (exchange),
  INDEX idx_underlying (underlying),
  INDEX idx_expiry_date (expiry_date),
  INDEX idx_is_active (is_active),
  INDEX idx_display_name (display_name),
  UNIQUE KEY unique_symbol (trading_symbol, exchange, expiry_date, strike_price, option_type)
);

-- Symbol history table for audit trail
CREATE TABLE symbol_history (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  symbol_id VARCHAR(50) NOT NULL,
  change_type ENUM('CREATED', 'UPDATED', 'DEACTIVATED', 'REACTIVATED') NOT NULL,
  old_data JSON,
  new_data JSON,
  changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  changed_by VARCHAR(50),
  
  INDEX idx_symbol_id (symbol_id),
  INDEX idx_changed_at (changed_at),
  FOREIGN KEY (symbol_id) REFERENCES standardized_symbols(id)
);

-- Processing logs table
CREATE TABLE symbol_processing_logs (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  process_type ENUM('DAILY_UPDATE', 'MANUAL_UPDATE', 'VALIDATION') NOT NULL,
  source VARCHAR(20) NOT NULL,
  status ENUM('STARTED', 'COMPLETED', 'FAILED') NOT NULL,
  total_processed INT DEFAULT 0,
  valid_symbols INT DEFAULT 0,
  invalid_symbols INT DEFAULT 0,
  new_symbols INT DEFAULT 0,
  updated_symbols INT DEFAULT 0,
  error_details JSON,
  started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP NULL,
  
  INDEX idx_process_type (process_type),
  INDEX idx_status (status),
  INDEX idx_started_at (started_at)
);
```

## Error Handling

### Error Types and Handling Strategy

```typescript
enum SymbolErrorType {
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  CONVERSION_ERROR = 'CONVERSION_ERROR',
  DATA_SOURCE_ERROR = 'DATA_SOURCE_ERROR',
  DATABASE_ERROR = 'DATABASE_ERROR',
  CACHE_ERROR = 'CACHE_ERROR'
}

interface SymbolError {
  type: SymbolErrorType;
  message: string;
  symbol?: string;
  details?: Record<string, any>;
  timestamp: string;
}

class SymbolErrorHandler {
  handleValidationError(error: ValidationError): void;
  handleConversionError(error: ConversionError): void;
  handleDataSourceError(error: DataSourceError): void;
  logError(error: SymbolError): void;
  notifyAdministrators(error: SymbolError): void;
}
```

## Testing Strategy

### Unit Tests
- Symbol data validation
- Format conversion for each broker
- Search query processing
- Data transformation logic

### Integration Tests
- End-to-end data processing pipeline
- Database operations
- API endpoint testing
- Cache behavior validation

### Performance Tests
- Search response times
- Bulk data processing
- Memory usage during updates
- Concurrent access patterns

## Performance Considerations

### Caching Strategy
- **L1 Cache**: In-memory cache for frequently accessed symbols
- **L2 Cache**: Redis cache for search results
- **Cache Invalidation**: Event-driven cache updates

### Database Optimization
- **Indexing**: Comprehensive indexes on search fields
- **Partitioning**: Partition by instrument type and exchange
- **Archiving**: Move old historical data to archive tables

### API Performance
- **Pagination**: Limit result sets to prevent large responses
- **Query Optimization**: Use database indexes effectively
- **Response Compression**: Compress API responses

## Security Considerations

### Data Protection
- **Input Validation**: Sanitize all input data
- **SQL Injection Prevention**: Use parameterized queries
- **Access Control**: Role-based access to admin functions

### API Security
- **Authentication**: Require valid JWT tokens
- **Rate Limiting**: Prevent abuse of search APIs
- **Audit Logging**: Log all data modification operations

## Deployment Strategy

### Phase 1: Foundation
- Implement standardized symbol data model
- Create data ingestion service
- Set up database schema

### Phase 2: Integration
- Implement broker format converters
- Create search API
- Add caching layer

### Phase 3: Migration
- Migrate existing symbol usage
- Deprecate old APIs
- Performance optimization

### Phase 4: Enhancement
- Add new data sources
- Implement advanced search features
- Add analytics and monitoring