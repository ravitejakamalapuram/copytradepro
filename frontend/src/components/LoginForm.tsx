import React, { useState } from 'react';
import { useAuth } from '../hooks/useAuth';

const LoginForm: React.FC = () => {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setEmail(e.target.value);
    if (error) setError('');
  };

  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPassword(e.target.value);
    if (error) setError('');
  };

  const performLogin = () => {
    if (loading) return;

    if (!email.trim()) {
      setError('Email is required');
      return;
    }
    if (!password) {
      setError('Password is required');
      return;
    }
    if (!/\S+@\S+\.\S+/.test(email)) {
      setError('Please enter a valid email address');
      return;
    }

    setLoading(true);
    setError('');

    login({
      email: email.trim().toLowerCase(),
      password: password,
    }).catch((err) => {
      let errorMessage = 'Login failed. Please try again.';

      if (err?.message) {
        if (err.message.includes('Invalid email or password')) {
          errorMessage = 'Invalid email or password. If you don\'t have an account, please register first.';
        } else if (err.message.includes('Network error')) {
          errorMessage = 'Unable to connect to the server. Please check your internet connection.';
        } else {
          errorMessage = err.message;
        }
      }

      setError(errorMessage);
    }).finally(() => {
      setLoading(false);
    });
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      performLogin();
    }
  };

  return (
    <div className="auth-form">
      {error && (
        <div
          className="form-error mb-3"
          style={{
            textAlign: 'center',
            backgroundColor: '#fef2f2',
            border: '1px solid #fecaca',
            borderRadius: '6px',
            padding: '12px',
            marginBottom: '16px',
            color: '#dc2626'
          }}
        >
          {error}
          {error.includes('Invalid email or password') && (
            <div style={{ marginTop: '8px', fontSize: '14px', color: '#6b7280' }}>
              Don't have an account?{' '}
              <a href="/register" style={{ color: '#3b82f6', textDecoration: 'underline' }}>
                Register here
              </a>
            </div>
          )}
        </div>
      )}

      <div className="form-group">
        <label htmlFor="email" className="form-label">
          Email Address
        </label>
        <input
          type="email"
          id="email"
          value={email}
          onChange={handleEmailChange}
          onKeyPress={handleKeyPress}
          className="form-input"
          placeholder="Enter your email address"
          disabled={loading}
          autoComplete="email"
        />
      </div>

      <div className="form-group">
        <label htmlFor="password" className="form-label">
          Password
        </label>
        <input
          type="password"
          id="password"
          value={password}
          onChange={handlePasswordChange}
          onKeyPress={handleKeyPress}
          className="form-input"
          placeholder="Enter your password"
          disabled={loading}
          autoComplete="current-password"
        />
      </div>

      <div
        className="btn btn-primary w-full"
        style={{
          cursor: loading ? 'not-allowed' : 'pointer',
          opacity: loading ? 0.7 : 1,
          userSelect: 'none'
        }}
        onClick={performLogin}
      >
        {loading ? 'Signing in...' : 'Sign In'}
      </div>
    </div>
  );
};

export default LoginForm;
