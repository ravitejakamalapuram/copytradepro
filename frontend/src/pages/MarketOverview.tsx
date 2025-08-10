/**
 * MARKET OVERVIEW PAGE - PLACEHOLDER
 * Market data features are not ready yet
 */

import React from 'react';
import Navigation from '../components/Navigation';
import { Container, PageHeader, Card, CardHeader, CardContent } from '../components/ui';

const MarketOverview: React.FC = () => {
  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />
      <Container className="py-8">
        <PageHeader title="Market Overview" subtitle="Real-time market data and insights" />

        <div className="mt-8">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-center">
              <div className="text-blue-600 mr-3">📊</div>
              <div>
                <p className="text-blue-800">
                  Market data features are currently under development. This page will display comprehensive market insights,
                  real-time indices, top gainers/losers, and market analytics once the feature is ready.
                </p>
              </div>
            </div>
          </div>

          <div className="mt-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <Card>
              <CardHeader>
                <h3 className="text-lg font-semibold">Market Indices</h3>
              </CardHeader>
              <CardContent>
                <p className="text-gray-500">Coming soon...</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <h3 className="text-lg font-semibold">Top Gainers</h3>
              </CardHeader>
              <CardContent>
                <p className="text-gray-500">Coming soon...</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <h3 className="text-lg font-semibold">Top Losers</h3>
              </CardHeader>
              <CardContent>
                <p className="text-gray-500">Coming soon...</p>
              </CardContent>
            </Card>
          </div>
        </div>
      </Container>
    </div>
  );
};

export default MarketOverview;