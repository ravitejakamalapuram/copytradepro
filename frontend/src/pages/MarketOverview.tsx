/**
 * MARKET OVERVIEW PAGE
 * Comprehensive NSE market data dashboard
 */

import React, { useState, useEffect } from 'react';
import Navigation from '../components/Navigation';
import { marketDataService, type MarketIndex } from '../services/marketDataService';
import { useRealTimeData } from '../hooks/useRealTimeData';
import {
  Container,
  PageHeader,
  Card,
  CardHeader,
  CardContent,
  Button,
  StatusBadge,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHeaderCell,
  TableCell,
  Grid,
  HStack,
  Flex,
  Spacer
} from '../components/ui';
import SkeletonLoader from '../components/SkeletonLoader';
import AnimatedPrice from '../components/AnimatedPrice';
import AnimatedMarketCard from '../components/AnimatedMarketCard';
import MarketDataStatusIndicator from '../components/MarketDataStatusIndicator';
import LivePriceTicker from '../components/LivePriceTicker';

interface MarketData {
  indices: MarketIndex[];
  gainers: any[];
  losers: any[];
  highStocks: any[];
  lowStocks: any[];
  topValue: any[];
  topVolume: any[];
  marketStatus: any;
}

const MarketOverview: React.FC = () => {
  const [marketData, setMarketData] = useState<MarketData>({
    indices: [],
    gainers: [],
    losers: [],
    highStocks: [],
    lowStocks: [],
    topValue: [],
    topVolume: [],
    marketStatus: null
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'gainers' | 'losers' | '52week' | 'volume'>('gainers');
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  // Real-time data hook
  const {
    connected: rtConnected,
    marketIndices: rtMarketIndices,
    marketStatus: rtMarketStatus,
    subscribeToIndices,
    lastUpdate: rtLastUpdate
  } = useRealTimeData();

  const fetchMarketData = async () => {
    try {
      setLoading(true);
      setError(null);

      const [
        indicesResponse,
        gainersResponse,
        losersResponse,
        highStocksResponse,
        lowStocksResponse,
        topValueResponse,
        topVolumeResponse,
        marketStatusResponse
      ] = await Promise.allSettled([
        marketDataService.getMarketIndices(),
        marketDataService.getGainers(),
        marketDataService.getLosers(),
        marketDataService.get52WeekHigh(),
        marketDataService.get52WeekLow(),
        marketDataService.getTopValueStocks(),
        marketDataService.getTopVolumeStocks(),
        marketDataService.getMarketStatus()
      ]);

      setMarketData({
        indices: indicesResponse.status === 'fulfilled' ? indicesResponse.value : [],
        gainers: gainersResponse.status === 'fulfilled' && gainersResponse.value.success ? gainersResponse.value.data : [],
        losers: losersResponse.status === 'fulfilled' && losersResponse.value.success ? losersResponse.value.data : [],
        highStocks: highStocksResponse.status === 'fulfilled' && highStocksResponse.value.success ? highStocksResponse.value.data : [],
        lowStocks: lowStocksResponse.status === 'fulfilled' && lowStocksResponse.value.success ? lowStocksResponse.value.data : [],
        topValue: topValueResponse.status === 'fulfilled' && topValueResponse.value.success ? topValueResponse.value.data : [],
        topVolume: topVolumeResponse.status === 'fulfilled' && (topVolumeResponse.value as any)?.success ? (topVolumeResponse.value as any).data : [],
        marketStatus: marketStatusResponse.status === 'fulfilled' && marketStatusResponse.value.success ? marketStatusResponse.value.data : null
      });

      setLastUpdated(new Date());
    } catch (err: any) {
      console.error('Failed to fetch market data:', err);
      setError(err.message || 'Failed to fetch market data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMarketData();

    // Subscribe to real-time market indices
    subscribeToIndices();

    // Auto-refresh static data every 60 seconds (less frequent since we have real-time data)
    const interval = setInterval(fetchMarketData, 60000);
    return () => clearInterval(interval);
  }, [subscribeToIndices]);

  // Update indices from real-time data
  useEffect(() => {
    if (rtMarketIndices.length > 0) {
      setMarketData(prev => ({
        ...prev,
        indices: rtMarketIndices.map(index => ({
          name: index.name,
          value: index.last,
          change: index.variation,
          changePercent: index.percentChange,
          lastUpdated: new Date().toISOString()
        }))
      }));
    }
  }, [rtMarketIndices]);

  // Update market status from real-time data
  useEffect(() => {
    if (rtMarketStatus) {
      setMarketData(prev => ({
        ...prev,
        marketStatus: rtMarketStatus
      }));
    }
  }, [rtMarketStatus]);

  // Update last updated time from real-time data
  useEffect(() => {
    if (rtLastUpdate) {
      setLastUpdated(rtLastUpdate);
    }
  }, [rtLastUpdate]);

  const formatPrice = (value: number) => {
    if (value >= 10000000) return `₹${(value / 10000000).toFixed(2)}Cr`;
    if (value >= 100000) return `₹${(value / 100000).toFixed(2)}L`;
    if (value >= 1000) return `₹${(value / 1000).toFixed(2)}K`;
    return `₹${value.toFixed(2)}`;
  };

  const formatVolume = (value: number) => {
    if (value >= 10000000) return `${(value / 10000000).toFixed(2)}Cr`;
    if (value >= 100000) return `${(value / 100000).toFixed(2)}L`;
    if (value >= 1000) return `${(value / 1000).toFixed(2)}K`;
    return value.toString();
  };

  const renderStockTable = (stocks: any[], type: string) => {
    if (!stocks || stocks.length === 0) {
      return (
        <div className="text-center py-8 text-gray-500">
          No {type} data available
        </div>
      );
    }

    return (
      <Table>
        <TableHeader>
          <TableRow>
            <TableHeaderCell>Symbol</TableHeaderCell>
            <TableHeaderCell>LTP</TableHeaderCell>
            <TableHeaderCell>Change</TableHeaderCell>
            <TableHeaderCell>% Change</TableHeaderCell>
            {type === 'volume' && <TableHeaderCell>Volume</TableHeaderCell>}
            {type === 'value' && <TableHeaderCell>Turnover</TableHeaderCell>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {stocks.slice(0, 10).map((stock, index) => (
            <TableRow key={index}>
              <TableCell>
                <div className="font-medium">{stock.symbol}</div>
                {stock.series && (
                  <div className="text-sm text-gray-500">{stock.series}</div>
                )}
              </TableCell>
              <TableCell>
                <AnimatedPrice
                  value={stock.ltp || stock.lastPrice || 0}
                  animate={true}
                  size="md"
                />
              </TableCell>
              <TableCell>
                <AnimatedPrice
                  value={Math.abs(stock.netPrice || stock.change || 0)}
                  change={stock.netPrice || stock.change || 0}
                  showSign={true}
                  size="sm"
                  animate={true}
                />
              </TableCell>
              <TableCell>
                <AnimatedPrice
                  value={Math.abs(stock.pChange || stock.changePercent || 0)}
                  changePercent={stock.pChange || stock.changePercent || 0}
                  showSign={true}
                  size="sm"
                  animate={true}
                  currency=""
                />
              </TableCell>
              {type === 'volume' && (
                <TableCell>
                  <div className="text-sm">{formatVolume(stock.tradedQuantity || 0)}</div>
                </TableCell>
              )}
              {type === 'value' && (
                <TableCell>
                  <div className="text-sm">{formatPrice((stock.turnoverInLakhs || 0) * 100000)}</div>
                </TableCell>
              )}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    );
  };

  if (loading && marketData.indices.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navigation />
        <Container className="py-8">
          <SkeletonLoader />
        </Container>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />

      {/* Live Price Ticker */}
      <LivePriceTicker speed="medium" />

      <Container className="py-8">
        <PageHeader
          title="Market Overview"
          subtitle="Live NSE market data and analytics"
          actions={
            <HStack className="gap-4">
              <MarketDataStatusIndicator
                connected={rtConnected}
                lastUpdate={lastUpdated}
                subscribedCount={rtMarketIndices.length}
              />
              <Button
                onClick={fetchMarketData}
                disabled={loading}
                size="sm"
              >
                {loading ? '⏳' : '🔄'} Refresh
              </Button>
            </HStack>
          }
        />

        {error && (
          <Card className="mb-6 border-red-200 bg-red-50">
            <CardContent>
              <div className="text-red-600">⚠️ {error}</div>
            </CardContent>
          </Card>
        )}

        {/* Market Status */}
        {marketData.marketStatus && (
          <Card className="mb-6">
            <CardHeader>
              <h3 className="text-lg font-semibold">Market Status</h3>
            </CardHeader>
            <CardContent>
              <HStack className="gap-6">
                <StatusBadge
                  status={marketData.marketStatus.isOpen ? 'active' : 'error'}
                >
                  {marketData.marketStatus.status}
                </StatusBadge>
                <div className="text-sm text-gray-600">
                  NSE Trading Status
                </div>
              </HStack>
            </CardContent>
          </Card>
        )}

        {/* Market Indices */}
        <Card className="mb-6">
          <CardHeader>
            <h3 className="text-lg font-semibold">Market Indices</h3>
          </CardHeader>
          <CardContent>
            <Grid cols={2} gap={4} className="lg:grid-cols-4">
              {marketData.indices.map((index, i) => (
                <AnimatedMarketCard
                  key={i}
                  index={index}
                  isUpdating={rtConnected && rtMarketIndices.length > 0}
                />
              ))}
            </Grid>
          </CardContent>
        </Card>

        {/* Market Movers */}
        <Card>
          <CardHeader>
            <Flex align="center">
              <h3 className="text-lg font-semibold">Market Movers</h3>
              <Spacer />
              <HStack className="gap-2">
                <Button
                  variant={activeTab === 'gainers' ? 'primary' : 'secondary'}
                  size="sm"
                  onClick={() => setActiveTab('gainers')}
                >
                  Top Gainers
                </Button>
                <Button
                  variant={activeTab === 'losers' ? 'primary' : 'secondary'}
                  size="sm"
                  onClick={() => setActiveTab('losers')}
                >
                  Top Losers
                </Button>
                <Button
                  variant={activeTab === '52week' ? 'primary' : 'secondary'}
                  size="sm"
                  onClick={() => setActiveTab('52week')}
                >
                  52-Week High/Low
                </Button>
                <Button
                  variant={activeTab === 'volume' ? 'primary' : 'secondary'}
                  size="sm"
                  onClick={() => setActiveTab('volume')}
                >
                  Most Active
                </Button>
              </HStack>
            </Flex>
          </CardHeader>
          <CardContent>
            {activeTab === 'gainers' && renderStockTable(marketData.gainers, 'gainers')}
            {activeTab === 'losers' && renderStockTable(marketData.losers, 'losers')}
            {activeTab === '52week' && (
              <Grid cols={1} gap={4} className="lg:grid-cols-2">
                <div>
                  <h4 className="font-semibold mb-3 text-green-600">52-Week High</h4>
                  {renderStockTable(marketData.highStocks, 'high')}
                </div>
                <div>
                  <h4 className="font-semibold mb-3 text-red-600">52-Week Low</h4>
                  {renderStockTable(marketData.lowStocks, 'low')}
                </div>
              </Grid>
            )}
            {activeTab === 'volume' && (
              <Grid cols={1} gap={4} className="lg:grid-cols-2">
                <div>
                  <h4 className="font-semibold mb-3">Top by Volume</h4>
                  {renderStockTable(marketData.topVolume, 'volume')}
                </div>
                <div>
                  <h4 className="font-semibold mb-3">Top by Value</h4>
                  {renderStockTable(marketData.topValue, 'value')}
                </div>
              </Grid>
            )}
          </CardContent>
        </Card>
      </Container>
    </div>
  );
};

export default MarketOverview;
