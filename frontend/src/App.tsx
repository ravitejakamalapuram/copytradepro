import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { useAuth } from './hooks/useAuth';
import LandingPage from './pages/LandingPage';
import AccountSetup from './pages/AccountSetup';
import TradeSetup from './pages/TradeSetup';
import Settings from './pages/Settings';
import ComponentDemo from './pages/ComponentDemo';
import PortfolioAnalytics from './pages/PortfolioAnalytics';
import NotificationDisplay from './components/NotificationDisplay';
import AdvancedOrderManagement from './pages/AdvancedOrderManagement';
import './styles/enterprise-base.css';

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
            isAuthenticated ? <Navigate to="/account-setup" replace /> : <LandingPage />
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
          path="/trade-setup"
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
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  );
};

const App: React.FC = () => {
  return (
    <Router>
      <AuthProvider>
        <AppContent />
        <NotificationDisplay position="top-right" />
      </AuthProvider>
    </Router>
  );
};

export default App;
