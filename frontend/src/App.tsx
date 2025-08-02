import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { AccountStatusProvider } from './context/AccountStatusContext';
import { ToastProvider } from './components/Toast';
import { ThemeProvider } from './context/ThemeContext';
import { useAuth } from './hooks/useAuth';
import { useConnectionStatus } from './hooks/useConnectionStatus';
import { memoryMonitorService } from './services/memoryMonitorService';
import { memoryLeakDetector } from './services/memoryLeakDetector';
import { resourceManager } from './utils/resourceManager';
import { appCache, apiCache, marketDataCache } from './services/cacheManager';
import { performanceMonitorService } from './services/performanceMonitorService';
import { errorCaptureService } from './services/errorCaptureService';
// Lazy load components for better performance
const LandingPage = React.lazy(() => import('./pages/LandingPage'));
const CopyTradeLogin = React.lazy(() => import('./pages/CopyTradeLogin'));
const Settings = React.lazy(() => import('./pages/Settings'));
const ComponentDemo = React.lazy(() => import('./pages/ComponentDemo'));
const PortfolioAnalytics = React.lazy(() => import('./pages/PortfolioAnalytics'));
const AdvancedOrderManagement = React.lazy(() => import('./pages/AdvancedOrderManagement'));

// Main application pages - lazy loaded
const Dashboard = React.lazy(() => import('./pages/Dashboard'));
const Holdings = React.lazy(() => import('./pages/Holdings'));
const Orders = React.lazy(() => import('./pages/Orders'));
const Positions = React.lazy(() => import('./pages/Positions'));
const TradeSetup = React.lazy(() => import('./pages/TradeSetup'));
const AccountSetup = React.lazy(() => import('./pages/AccountSetup'));
const Portfolio = React.lazy(() => import('./pages/Portfolio'));
const MarketOverview = React.lazy(() => import('./pages/MarketOverview'));

// Advanced features - lazy loaded
const AlertsManagement = React.lazy(() => import('./pages/AlertsManagement'));
const RiskManagement = React.lazy(() => import('./pages/RiskManagement'));
const CopyTradingStrategies = React.lazy(() => import('./pages/CopyTradingStrategies'));
const UserSettings = React.lazy(() => import('./pages/UserSettings'));
const AdminPanel = React.lazy(() => import('./pages/AdminPanel'));
const AdminUserDetails = React.lazy(() => import('./pages/AdminUserDetails'));

// Keep NotificationDisplay as regular import since it's always needed
import NotificationDisplay from './components/NotificationDisplay';
import ErrorNotificationDisplay from './components/ErrorNotificationDisplay';
import './styles/enterprise-base.css';
import './styles/dark-theme.css';

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

// Loading Fallback Component
const LoadingFallback: React.FC = () => (
  <div className="loading-container" style={{
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '60vh',
    gap: '1rem'
  }}>
    <div className="loading-spinner"></div>
    <p className="loading-text" style={{ color: 'var(--text-secondary)' }}>Loading...</p>
  </div>
);

// Protected Route Component with Suspense
const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return <LoadingFallback />;
  }

  return isAuthenticated ? (
    <React.Suspense fallback={<LoadingFallback />}>
      {children}
    </React.Suspense>
  ) : <Navigate to="/" replace />;
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
            isAuthenticated ? <Navigate to="/dashboard" replace /> : (
              <React.Suspense fallback={<LoadingFallback />}>
                <CopyTradeLogin />
              </React.Suspense>
            )
          }
        />
        <Route
          path="/landing"
          element={
            <React.Suspense fallback={<LoadingFallback />}>
              <LandingPage />
            </React.Suspense>
          }
        />

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

        {/* Advanced Features */}
        <Route
          path="/alerts"
          element={
            <ProtectedRoute>
              <ErrorBoundary>
                <AlertsManagement />
              </ErrorBoundary>
            </ProtectedRoute>
          }
        />
        <Route
          path="/risk-management"
          element={
            <ProtectedRoute>
              <ErrorBoundary>
                <RiskManagement />
              </ErrorBoundary>
            </ProtectedRoute>
          }
        />
        <Route
          path="/copy-trading"
          element={
            <ProtectedRoute>
              <TradingErrorBoundary>
                <CopyTradingStrategies />
              </TradingErrorBoundary>
            </ProtectedRoute>
          }
        />

        {/* User Settings */}
        <Route
          path="/settings"
          element={
            <ProtectedRoute>
              <ErrorBoundary>
                <UserSettings />
              </ErrorBoundary>
            </ProtectedRoute>
          }
        />

        {/* Admin Panel */}
        <Route
          path="/admin"
          element={
            <ProtectedRoute>
              <ErrorBoundary>
                <AdminPanel />
              </ErrorBoundary>
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/user/:userId"
          element={
            <ProtectedRoute>
              <ErrorBoundary>
                <AdminUserDetails />
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
          path="/legacy-settings"
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
            <React.Suspense fallback={<LoadingFallback />}>
              <ErrorBoundary>
                <ComponentDemo />
              </ErrorBoundary>
            </React.Suspense>
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

    // Error capture service is automatically initialized
    console.log('🛡️ Error capture service initialized');

    // Expose services globally for debugging
    (window as unknown as { memoryMonitor?: typeof memoryMonitorService }).memoryMonitor = memoryMonitorService;
    (window as unknown as { leakDetector?: typeof memoryLeakDetector }).leakDetector = memoryLeakDetector;
    (window as unknown as { resourceManager?: typeof resourceManager }).resourceManager = resourceManager;
    (window as unknown as { appCache?: typeof appCache }).appCache = appCache;
    (window as unknown as { apiCache?: typeof apiCache }).apiCache = apiCache;
    (window as unknown as { marketDataCache?: typeof marketDataCache }).marketDataCache = marketDataCache;
    (window as unknown as { performanceMonitor?: typeof performanceMonitorService }).performanceMonitor = performanceMonitorService;
    (window as unknown as { errorCapture?: typeof errorCaptureService }).errorCapture = errorCaptureService;

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
      errorCaptureService.destroy();

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
      delete (window as unknown as { errorCapture?: typeof errorCaptureService }).errorCapture;
    };
  }, []);

  return (
    <Router>
      <ThemeProvider>
        <ToastProvider>
          <AuthProvider>
            <ConditionalAccountStatusProvider>
              <ErrorBoundary>
                <ConnectionStatus />
                <NavigationErrorBoundary>
                  <AppContent />
                </NavigationErrorBoundary>
                <NotificationDisplay position="top-right" />
                <ErrorNotificationDisplay position="top-right" />
              </ErrorBoundary>
            </ConditionalAccountStatusProvider>
          </AuthProvider>
        </ToastProvider>
      </ThemeProvider>
    </Router>
  );
};

export default App;
