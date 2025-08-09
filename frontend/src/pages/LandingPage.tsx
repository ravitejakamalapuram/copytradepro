import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import './LandingPage.css';

const LandingPage: React.FC = () => {
  const { isAuthenticated } = useAuth();

  // Redirect to main login page if not authenticated
  // or to dashboard if already authenticated
  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  return <Navigate to="/" replace />;

};

export default LandingPage;
