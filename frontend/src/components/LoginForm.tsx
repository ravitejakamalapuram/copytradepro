import React, { useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { Input, Button, Stack } from './ui';

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
        <div className="login-error-alert">
          {error}
          {error.includes('Invalid email or password') && (
            <div className="error-help-text">
              Don't have an account?{' '}
              <a href="/register" className="error-link">
                Register here
              </a>
            </div>
          )}
        </div>
      )}

      <Stack gap={4}>
        <Input
          type="email"
          label="Email Address"
          value={email}
          onChange={handleEmailChange}
          onKeyPress={handleKeyPress}
          placeholder="Enter your email address"
          disabled={loading}
          autoComplete="email"
          state={error && error.includes('email') ? 'error' : 'default'}
          fullWidth
        />

        <Input
          type="password"
          label="Password"
          value={password}
          onChange={handlePasswordChange}
          onKeyPress={handleKeyPress}
          placeholder="Enter your password"
          disabled={loading}
          autoComplete="current-password"
          state={error && error.includes('password') ? 'error' : 'default'}
          fullWidth
        />

        <Button
          variant="primary"
          size="lg"
          onClick={performLogin}
          disabled={loading}
          loading={loading}
          fullWidth
        >
          {loading ? 'Signing in...' : 'Sign In'}
        </Button>
      </Stack>
    </div>
  );
};

export default LoginForm;
