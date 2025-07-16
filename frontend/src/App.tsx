import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { AccountStatusProvider } from './context/AccountStatusContext';
import { useAuth } from './hooks/useAuth';
import { useConnectionStatus } from './hooks/useConnectionStatus';
import { memoryMonitorService } from './services/memoryMonitorService';
import { memoryLeakDetector } from './services/memoryLeakDetector';
import { resourceManager } from './utils/resourceManager';
import { appCache, apiCache, marketDataCache } from './services/cacheManager';
import { performanceMonitorService } from './services/performanceMonitorService';
import LandingPage from './pages/LandingPage';
import CopyTradeLogin from './pages/CopyTradeLogin';

import Settings from './pages/Settings';
import ComponentDemo from './pages/ComponentDemo';
import PortfolioAnalytics from './pages/PortfolioAnalytics';
import NotificationDisplay from './components/NotificationDisplay';
import AdvancedOrderManagement from './pages/AdvancedOrderManagement';
// Main application pages
import Dashboard from './pages/Dashboard';
import Holdings from './pages/Holdings';
import Orders from './pages/Orders';
import Positions from './pages/Positions';

import TradeSetup from './pages/TradeSetup';
import AccountSetup from './pages/AccountSetup';
import Portfolio from './pages/Portfolio';
import MarketOverview from './pages/MarketOverview';
import './styles/enterprise-base.css';

// Error Boundaries
import ErrorBoundary from './components/ErrorBoundary';
import NavigationErrorBoundary from './components/NavigationErrorBoundary';
import TradingErrorBoundary from './components/TradingErrorBoundary';
import AccountErrorBoundary from './components/AccountErrorBoundary';

// Connection Status Component
const ConnectionStatus: React.FC = () => {
  const { isOnline } = useConnectionStatus();

  if (isOnline) return null;

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      backgroundColor: '#ff6b35',
      color: 'white',
      padding: '0.5rem',
      textAlign: 'center',
      fontSize: '0.875rem',
      fontWeight: '500',
      zIndex: 9999,
      boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
    }}>
      🔌 Server connection lost. Retrying... (You can continue working offline)
    </div>
  );
};

// Protected Route Component
const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner"></div>
        <p className="loading-text">Loading...</p>
      </div>
    );
  }

  return isAuthenticated ? <>{children}</> : <Navigate to="/" replace />;
};

// Main App Component
const AppContent: React.FC = () => {
  const { isAuthenticated } = useAuth();

  return (
    <div className="app">
      <Routes>
        <Route
          path="/"
          element={
            isAuthenticated ? <Navigate to="/dashboard" replace /> : <CopyTradeLogin />
          }
        />
        <Route path="/landing" element={<LandingPage />} />

        {/* Main application routes */}
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <ErrorBoundary>
                <Dashboard />
              </ErrorBoundary>
            </ProtectedRoute>
          }
        />
        <Route
          path="/holdings"
          element={
            <ProtectedRoute>
              <ErrorBoundary>
                <Holdings />
              </ErrorBoundary>
            </ProtectedRoute>
          }
        />
        <Route
          path="/orders"
          element={
            <ProtectedRoute>
              <TradingErrorBoundary>
                <Orders />
              </TradingErrorBoundary>
            </ProtectedRoute>
          }
        />
        <Route
          path="/positions"
          element={
            <ProtectedRoute>
              <TradingErrorBoundary>
                <Positions />
              </TradingErrorBoundary>
            </ProtectedRoute>
          }
        />


        {/* Trading routes */}
        <Route
          path="/trade-setup"
          element={
            <ProtectedRoute>
              <TradingErrorBoundary>
                <TradeSetup />
              </TradingErrorBoundary>
            </ProtectedRoute>
          }
        />
        <Route
          path="/account-setup"
          element={
            <ProtectedRoute>
              <AccountErrorBoundary>
                <AccountSetup />
              </AccountErrorBoundary>
            </ProtectedRoute>
          }
        />
        <Route
          path="/portfolio"
          element={
            <ProtectedRoute>
              <ErrorBoundary>
                <Portfolio />
              </ErrorBoundary>
            </ProtectedRoute>
          }
        />

        {/* Legacy routes */}
        <Route
          path="/legacy-account-setup"
          element={
            <ProtectedRoute>
              <AccountErrorBoundary>
                <AccountSetup />
              </AccountErrorBoundary>
            </ProtectedRoute>
          }
        />
        <Route
          path="/legacy-trade-setup"
          element={
            <ProtectedRoute>
              <TradingErrorBoundary>
                <TradeSetup />
              </TradingErrorBoundary>
            </ProtectedRoute>
          }
        />
        <Route
          path="/portfolio-analytics"
          element={
            <ProtectedRoute>
              <ErrorBoundary>
                <PortfolioAnalytics />
              </ErrorBoundary>
            </ProtectedRoute>
          }
        />
        <Route
          path="/advanced-orders"
          element={
            <ProtectedRoute>
              <TradingErrorBoundary>
                <AdvancedOrderManagement />
              </TradingErrorBoundary>
            </ProtectedRoute>
          }
        />
        <Route
          path="/settings"
          element={
            <ProtectedRoute>
              <ErrorBoundary>
                <Settings />
              </ErrorBoundary>
            </ProtectedRoute>
          }
        />
        <Route
          path="/demo"
          element={
            <ErrorBoundary>
              <ComponentDemo />
            </ErrorBoundary>
          }
        />
        <Route
          path="/market-overview"
          element={
            <ProtectedRoute>
              <ErrorBoundary>
                <MarketOverview />
              </ErrorBoundary>
            </ProtectedRoute>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  );
};

const App: React.FC = () => {
  // Initialize memory monitoring and leak detection
  useEffect(() => {
    console.log('🚀 Initializing memory monitoring services');
    
    // Start memory monitoring
    memoryMonitorService.startMonitoring();
    
    // Start leak detection
    memoryLeakDetector.startDetection();
    
    // Start performance monitoring
    performanceMonitorService.startMonitoring();
    
    // Expose services globally for debugging
    (window as any).memoryMonitor = memoryMonitorService;
    (window as any).leakDetector = memoryLeakDetector;
    (window as any).resourceManager = resourceManager;
    (window as any).appCache = appCache;
    (window as any).apiCache = apiCache;
    (window as any).marketDataCache = marketDataCache;
    (window as any).performanceMonitor = performanceMonitorService;
    
    // Setup memory alert handling
    const unsubscribeMemoryAlert = memoryMonitorService.onAlert((alert) => {
      if ((window as any).addNotification) {
        (window as any).addNotification({
          title: `Memory ${alert.type.toUpperCase()}`,
          message: alert.message,
          type: alert.type === 'critical' ? 'error' : 'warning',
          autoClose: alert.type !== 'critical',
          duration: alert.type === 'critical' ? 0 : 10000,
          actions: alert.type === 'critical' ? [
            {
              label: 'Refresh Page',
              action: () => window.location.reload(),
              variant: 'primary' as const
            },
            {
              label: 'Clear Cache',
              action: () => memoryMonitorService.clearCaches(),
              variant: 'secondary' as const
            }
          ] : undefined
        });
      }
    });
    
    // Cleanup on app unmount
    return () => {
      console.log('🧹 Shutting down memory monitoring services');
      
      unsubscribeMemoryAlert();
      memoryMonitorService.shutdown();
      memoryLeakDetector.shutdown();
      resourceManager.shutdown();
      performanceMonitorService.shutdown();
      
      // Shutdown cache managers
      appCache.shutdown();
      apiCache.shutdown();
      marketDataCache.shutdown();
      
      // Clean up global references
      delete (window as any).memoryMonitor;
      delete (window as any).leakDetector;
      delete (window as any).resourceManager;
      delete (window as any).appCache;
      delete (window as any).apiCache;
      delete (window as any).marketDataCache;
      delete (window as unknown).performanceMonitor;
    };
  }, []);

  return (
    <Router>
      <AuthProvider>
        <AccountStatusProvider>
          <ErrorBoundary>
            <ConnectionStatus />
            <NavigationErrorBoundary>
              <AppContent />
            </NavigationErrorBoundary>
            <NotificationDisplay position="top-right" />
          </ErrorBoundary>
        </AccountStatusProvider>
      </AuthProvider>
    </Router>
  );
};

export default App;
