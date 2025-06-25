import React, { useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import LoginForm from '../components/LoginForm';
import RegisterForm from '../components/RegisterForm';
import './LandingPage.css';

const LandingPage: React.FC = () => {
  const [isLogin, setIsLogin] = useState(true);
  const { loading } = useAuth();

  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner"></div>
        <p>Loading...</p>
      </div>
    );
  }

  return (
    <div className="landing-page">
      <div className="landing-container">
        {/* Hero Section */}
        <div className="hero-section">
          <div className="hero-content">
            <h1 className="hero-title">CopyTrade Pro</h1>
            <p className="hero-subtitle">
              Professional multi-broker trading platform for copy trading and portfolio management
            </p>
            <div className="hero-features">
              <div className="feature-item">
                <span className="feature-icon">🔗</span>
                <span>Multi-Broker Support</span>
              </div>
              <div className="feature-item">
                <span className="feature-icon">📊</span>
                <span>Real-time Trading</span>
              </div>
              <div className="feature-item">
                <span className="feature-icon">🔒</span>
                <span>Secure & Reliable</span>
              </div>
            </div>
          </div>
        </div>

        {/* Auth Section */}
        <div className="auth-section">
          <div className="auth-container">
            <div className="auth-header">
              <div className="auth-tabs">
                <button
                  className={`auth-tab ${isLogin ? 'active' : ''}`}
                  onClick={() => setIsLogin(true)}
                >
                  Login
                </button>
                <button
                  className={`auth-tab ${!isLogin ? 'active' : ''}`}
                  onClick={() => setIsLogin(false)}
                >
                  Register
                </button>
              </div>
            </div>

            <div className="auth-form-container">
              {isLogin ? <LoginForm /> : <RegisterForm />}
            </div>

            <div className="auth-footer">
              <p className="auth-switch">
                {isLogin ? "Don't have an account? " : "Already have an account? "}
                <button
                  className="auth-switch-btn"
                  onClick={() => setIsLogin(!isLogin)}
                >
                  {isLogin ? 'Register here' : 'Login here'}
                </button>
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="landing-footer">
        <div className="footer-content">
          <p>&copy; 2024 CopyTrade Pro. Built for professional traders.</p>
          <div className="footer-disclaimer">
            <small>
              Trading involves risk. This software is for execution only and does not provide financial advice.
            </small>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
