import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { AccountStatusProvider } from './context/AccountStatusContext';
import { ToastProvider } from './components/Toast';
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

// Conditional wrapper that only provides AccountStatusProvider when authenticated
const ConditionalAccountStatusProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated } = useAuth();

  // Only provide account status context when user is authenticated
  if (isAuthenticated) {
    return <AccountStatusProvider>{children}</AccountStatusProvider>;
  }

  // For unauthenticated users (login page), don't fetch accounts
  return <>{children}</>;
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
    (window as unknown as { memoryMonitor?: typeof memoryMonitorService }).memoryMonitor = memoryMonitorService;
    (window as unknown as { leakDetector?: typeof memoryLeakDetector }).leakDetector = memoryLeakDetector;
    (window as unknown as { resourceManager?: typeof resourceManager }).resourceManager = resourceManager;
    (window as unknown as { appCache?: typeof appCache }).appCache = appCache;
    (window as unknown as { apiCache?: typeof apiCache }).apiCache = apiCache;
    (window as unknown as { marketDataCache?: typeof marketDataCache }).marketDataCache = marketDataCache;
    (window as unknown as { performanceMonitor?: typeof performanceMonitorService }).performanceMonitor = performanceMonitorService;
    
    // Setup memory alert handling
    const unsubscribeMemoryAlert = memoryMonitorService.onAlert((alert) => {
      if (typeof window.addNotification === 'function') {
        window.addNotification({
          title: `Memory ${alert.type.toUpperCase()}`,
          message: alert.message,
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
      delete (window as unknown as { memoryMonitor?: typeof memoryMonitorService }).memoryMonitor;
      delete (window as unknown as { leakDetector?: typeof memoryLeakDetector }).leakDetector;
      delete (window as unknown as { resourceManager?: typeof resourceManager }).resourceManager;
      delete (window as unknown as { appCache?: typeof appCache }).appCache;
      delete (window as unknown as { apiCache?: typeof apiCache }).apiCache;
      delete (window as unknown as { marketDataCache?: typeof marketDataCache }).marketDataCache;
      delete (window as unknown as { performanceMonitor?: typeof performanceMonitorService }).performanceMonitor;
    };
  }, []);

  return (
    <Router>
      <ToastProvider>
        <AuthProvider>
          <ConditionalAccountStatusProvider>
            <ErrorBoundary>
              <ConnectionStatus />
              <NavigationErrorBoundary>
                <AppContent />
              </NavigationErrorBoundary>
              <NotificationDisplay position="top-right" />
            </ErrorBoundary>
          </ConditionalAccountStatusProvider>
        </AuthProvider>
      </ToastProvider>
    </Router>
  );
};

export default App;
