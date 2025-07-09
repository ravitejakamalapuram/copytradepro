import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { useAuth } from './hooks/useAuth';
import { useConnectionStatus } from './hooks/useConnectionStatus';
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
              <Dashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/holdings"
          element={
            <ProtectedRoute>
              <Holdings />
            </ProtectedRoute>
          }
        />
        <Route
          path="/orders"
          element={
            <ProtectedRoute>
              <Orders />
            </ProtectedRoute>
          }
        />
        <Route
          path="/positions"
          element={
            <ProtectedRoute>
              <Positions />
            </ProtectedRoute>
          }
        />


        {/* Trading routes */}
        <Route
          path="/trade-setup"
          element={
            <ProtectedRoute>
              <TradeSetup />
            </ProtectedRoute>
          }
        />
        <Route
          path="/account-setup"
          element={
            <ProtectedRoute>
              <AccountSetup />
            </ProtectedRoute>
          }
        />
        <Route
          path="/portfolio"
          element={
            <ProtectedRoute>
              <Portfolio />
            </ProtectedRoute>
          }
        />

        {/* Legacy routes */}
        <Route
          path="/legacy-account-setup"
          element={
            <ProtectedRoute>
              <AccountSetup />
            </ProtectedRoute>
          }
        />
        <Route
          path="/legacy-trade-setup"
          element={
            <ProtectedRoute>
              <TradeSetup />
            </ProtectedRoute>
          }
        />
        <Route
          path="/portfolio"
          element={
            <ProtectedRoute>
              <PortfolioAnalytics />
            </ProtectedRoute>
          }
        />
        <Route
          path="/advanced-orders"
          element={
            <ProtectedRoute>
              <AdvancedOrderManagement />
            </ProtectedRoute>
          }
        />
        <Route
          path="/settings"
          element={
            <ProtectedRoute>
              <Settings />
            </ProtectedRoute>
          }
        />
        <Route
          path="/demo"
          element={<ComponentDemo />}
        />
        <Route
          path="/market-overview"
          element={
            <ProtectedRoute>
              <MarketOverview />
            </ProtectedRoute>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  );
};

const App: React.FC = () => {
  return (
    <Router>
      <AuthProvider>
        <ConnectionStatus />
        <AppContent />
        <NotificationDisplay position="top-right" />
      </AuthProvider>
    </Router>
  );
};

export default App;
