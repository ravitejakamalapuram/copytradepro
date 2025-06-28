import React, { useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import '../styles/kite-theme.css';

const CopyTradeLogin: React.FC = () => {
  const { login, register } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [isRegisterMode, setIsRegisterMode] = useState(false);

  const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setEmail(e.target.value);
    if (error) setError('');
  };

  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPassword(e.target.value);
    if (error) setError('');
  };

  const performLogin = async () => {
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

    try {
      await login({
        email: email.trim().toLowerCase(),
        password: password,
      });
    } catch (err: any) {
      let errorMessage = 'Login failed. Please try again.';

      if (err?.message) {
        if (err.message.includes('Invalid email or password')) {
          errorMessage = 'Invalid email or password';
        } else if (err.message.includes('Network error')) {
          errorMessage = 'Unable to connect to server';
        } else {
          errorMessage = err.message;
        }
      }

      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const performRegister = async () => {
    if (loading) return;

    if (!name.trim()) {
      setError('Name is required');
      return;
    }
    if (!email.trim()) {
      setError('Email is required');
      return;
    }
    if (!password) {
      setError('Password is required');
      return;
    }
    if (!confirmPassword) {
      setError('Please confirm your password');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    if (!/\S+@\S+\.\S+/.test(email)) {
      setError('Please enter a valid email address');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    setLoading(true);
    setError('');

    try {
      await register({
        name: name.trim(),
        email: email.trim().toLowerCase(),
        password: password,
      });
    } catch (err: any) {
      let errorMessage = 'Registration failed. Please try again.';

      if (err?.message) {
        if (err.message.includes('already exists')) {
          errorMessage = 'Email already exists. Please login instead.';
        } else if (err.message.includes('Network error')) {
          errorMessage = 'Unable to connect to server';
        } else {
          errorMessage = err.message;
        }
      }

      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      isRegisterMode ? performRegister() : performLogin();
    }
  };

  // Get user initials from email
  const getUserInitials = (email: string): string => {
    if (!email) return 'CT';
    const parts = email.split('@')[0].split('.');
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return email.substring(0, 2).toUpperCase();
  };

  // Generate user ID from email
  const getUserId = (email: string): string => {
    if (!email) return 'CT9734';
    const emailPart = email.split('@')[0];
    const numbers = Math.abs(emailPart.split('').reduce((a, b) => a + b.charCodeAt(0), 0));
    return `CT${numbers.toString().substring(0, 4)}`;
  };

  return (
    <div className="kite-theme" style={{
      minHeight: '100vh',
      backgroundColor: 'var(--kite-bg-primary)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '2rem'
    }}>
      <div style={{
        width: '100%',
        maxWidth: '400px',
        textAlign: 'center'
      }}>
        {/* User Avatar */}
        <div style={{
          width: '120px',
          height: '120px',
          borderRadius: '50%',
          backgroundColor: 'var(--kite-brand-primary)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 2rem',
          fontSize: '2.5rem',
          fontWeight: '600',
          color: 'white',
          border: '4px solid var(--kite-border-primary)'
        }}>
          {getUserInitials(email)}
        </div>

        {/* User ID */}
        <div style={{
          fontSize: '1.5rem',
          fontWeight: '600',
          color: 'var(--kite-text-primary)',
          marginBottom: '0.5rem'
        }}>
          {getUserId(email)}
        </div>

        {/* Mode Toggle */}
        <div style={{
          display: 'flex',
          gap: '1rem',
          marginBottom: '1rem'
        }}>
          <button
            onClick={() => {
              setIsRegisterMode(false);
              setError('');
              setConfirmPassword('');
              setName('');
            }}
            style={{
              background: 'none',
              border: 'none',
              color: !isRegisterMode ? 'var(--kite-brand-primary)' : 'var(--kite-text-secondary)',
              fontSize: '0.875rem',
              cursor: 'pointer',
              textDecoration: 'none',
              fontWeight: !isRegisterMode ? '600' : '400'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.textDecoration = 'underline';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.textDecoration = 'none';
            }}
          >
            Login
          </button>
          <span style={{ color: 'var(--kite-text-secondary)' }}>|</span>
          <button
            onClick={() => {
              setIsRegisterMode(true);
              setError('');
            }}
            style={{
              background: 'none',
              border: 'none',
              color: isRegisterMode ? 'var(--kite-brand-primary)' : 'var(--kite-text-secondary)',
              fontSize: '0.875rem',
              cursor: 'pointer',
              textDecoration: 'none',
              fontWeight: isRegisterMode ? '600' : '400'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.textDecoration = 'underline';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.textDecoration = 'none';
            }}
          >
            Register
          </button>
        </div>

        {/* Change User Link */}
        {!isRegisterMode && (
          <button
            onClick={() => {
              setEmail('');
              setPassword('');
              setError('');
            }}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--kite-brand-primary)',
              fontSize: '0.875rem',
              cursor: 'pointer',
              marginBottom: '2rem',
              textDecoration: 'none'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.textDecoration = 'underline';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.textDecoration = 'none';
            }}
          >
            Change user
          </button>
        )}

        {/* Login/Register Form */}
        <div style={{ marginBottom: '2rem' }}>
          {/* Name Input (Register only) */}
          {isRegisterMode && (
            <div style={{ marginBottom: '1.5rem' }}>
              <input
                type="text"
                placeholder="Full Name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyPress={handleKeyPress}
                disabled={loading}
                style={{
                  width: '100%',
                  padding: '1rem',
                  fontSize: '1rem',
                  border: `2px solid ${error ? 'var(--kite-loss)' : 'var(--kite-border-secondary)'}`,
                  borderRadius: 'var(--kite-radius-md)',
                  backgroundColor: 'var(--kite-bg-secondary)',
                  color: 'var(--kite-text-primary)',
                  outline: 'none',
                  transition: 'border-color 0.2s ease',
                  boxSizing: 'border-box'
                }}
                onFocus={(e) => {
                  if (!error) {
                    e.target.style.borderColor = 'var(--kite-brand-primary)';
                  }
                }}
                onBlur={(e) => {
                  if (!error) {
                    e.target.style.borderColor = 'var(--kite-border-secondary)';
                  }
                }}
              />
            </div>
          )}

          {/* Email Input */}
          <div style={{ marginBottom: '1.5rem' }}>
            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={handleEmailChange}
              onKeyPress={handleKeyPress}
              disabled={loading}
              style={{
                width: '100%',
                padding: '1rem',
                fontSize: '1rem',
                border: `2px solid ${error ? 'var(--kite-loss)' : 'var(--kite-border-secondary)'}`,
                borderRadius: 'var(--kite-radius-md)',
                backgroundColor: 'var(--kite-bg-secondary)',
                color: 'var(--kite-text-primary)',
                outline: 'none',
                transition: 'border-color 0.2s ease',
                boxSizing: 'border-box'
              }}
              onFocus={(e) => {
                if (!error) {
                  e.target.style.borderColor = 'var(--kite-brand-primary)';
                }
              }}
              onBlur={(e) => {
                if (!error) {
                  e.target.style.borderColor = 'var(--kite-border-secondary)';
                }
              }}
            />
          </div>

          {/* Password Input */}
          <div style={{ position: 'relative', marginBottom: '1.5rem' }}>
            <input
              type={showPassword ? 'text' : 'password'}
              placeholder="Password"
              value={password}
              onChange={handlePasswordChange}
              onKeyPress={handleKeyPress}
              disabled={loading}
              style={{
                width: '100%',
                padding: '1rem',
                paddingRight: '3rem',
                fontSize: '1rem',
                border: `2px solid ${error ? 'var(--kite-loss)' : 'var(--kite-border-secondary)'}`,
                borderRadius: 'var(--kite-radius-md)',
                backgroundColor: 'var(--kite-bg-secondary)',
                color: 'var(--kite-text-primary)',
                outline: 'none',
                transition: 'border-color 0.2s ease',
                boxSizing: 'border-box'
              }}
              onFocus={(e) => {
                if (!error) {
                  e.target.style.borderColor = 'var(--kite-brand-primary)';
                }
              }}
              onBlur={(e) => {
                if (!error) {
                  e.target.style.borderColor = 'var(--kite-border-secondary)';
                }
              }}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              style={{
                position: 'absolute',
                right: '1rem',
                top: '50%',
                transform: 'translateY(-50%)',
                background: 'none',
                border: 'none',
                color: 'var(--kite-text-secondary)',
                cursor: 'pointer',
                fontSize: '1.25rem'
              }}
            >
              {showPassword ? '🙈' : '👁️'}
            </button>
          </div>

          {/* Confirm Password Input (Register only) */}
          {isRegisterMode && (
            <div style={{ position: 'relative', marginBottom: '1.5rem' }}>
              <input
                type="password"
                placeholder="Confirm Password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                onKeyPress={handleKeyPress}
                disabled={loading}
                style={{
                  width: '100%',
                  padding: '1rem',
                  fontSize: '1rem',
                  border: `2px solid ${error ? 'var(--kite-loss)' : 'var(--kite-border-secondary)'}`,
                  borderRadius: 'var(--kite-radius-md)',
                  backgroundColor: 'var(--kite-bg-secondary)',
                  color: 'var(--kite-text-primary)',
                  outline: 'none',
                  transition: 'border-color 0.2s ease',
                  boxSizing: 'border-box'
                }}
                onFocus={(e) => {
                  if (!error) {
                    e.target.style.borderColor = 'var(--kite-brand-primary)';
                  }
                }}
                onBlur={(e) => {
                  if (!error) {
                    e.target.style.borderColor = 'var(--kite-border-secondary)';
                  }
                }}
              />
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div style={{
              padding: '0.75rem',
              backgroundColor: 'var(--kite-bg-danger)',
              border: '1px solid var(--kite-loss)',
              borderRadius: 'var(--kite-radius-md)',
              color: 'var(--kite-loss)',
              fontSize: '0.875rem',
              marginBottom: '1.5rem',
              textAlign: 'left'
            }}>
              {error}
            </div>
          )}

          {/* Submit Button */}
          <button
            onClick={isRegisterMode ? performRegister : performLogin}
            disabled={loading || !email || !password || (isRegisterMode && (!name || !confirmPassword))}
            style={{
              width: '100%',
              padding: '1rem',
              fontSize: '1rem',
              fontWeight: '600',
              border: 'none',
              borderRadius: 'var(--kite-radius-md)',
              backgroundColor: loading || !email || !password || (isRegisterMode && (!name || !confirmPassword)) ? 'var(--kite-bg-neutral)' : 'var(--kite-brand-secondary)',
              color: loading || !email || !password || (isRegisterMode && (!name || !confirmPassword)) ? 'var(--kite-text-secondary)' : 'white',
              cursor: loading || !email || !password || (isRegisterMode && (!name || !confirmPassword)) ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s ease',
              marginBottom: '1.5rem'
            }}
            onMouseEnter={(e) => {
              const isEnabled = !loading && email && password && (!isRegisterMode || (name && confirmPassword));
              if (isEnabled) {
                e.currentTarget.style.backgroundColor = '#e67e22';
              }
            }}
            onMouseLeave={(e) => {
              const isEnabled = !loading && email && password && (!isRegisterMode || (name && confirmPassword));
              if (isEnabled) {
                e.currentTarget.style.backgroundColor = 'var(--kite-brand-secondary)';
              }
            }}
          >
            {loading ? (isRegisterMode ? 'Creating account...' : 'Signing in...') : (isRegisterMode ? 'Create Account' : 'Login')}
          </button>

          {/* Forgot Password */}
          <button
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--kite-text-secondary)',
              fontSize: '0.875rem',
              cursor: 'pointer',
              textDecoration: 'none'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.textDecoration = 'underline';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.textDecoration = 'none';
            }}
          >
            Forgot user ID or password?
          </button>
        </div>

        {/* Platform Icons */}
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          gap: '1rem',
          marginBottom: '2rem'
        }}>
          <div style={{ fontSize: '1.5rem' }}>▶️</div>
          <div style={{ fontSize: '1.5rem' }}>🍎</div>
        </div>

        {/* CopyTrade Pro Branding */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '0.5rem',
          marginBottom: '1rem'
        }}>
          <div style={{ fontSize: '1.25rem' }}>📈</div>
          <span style={{
            fontSize: '1.25rem',
            fontWeight: '600',
            color: 'var(--kite-text-primary)'
          }}>
            COPYTRADE PRO
          </span>
        </div>

        {/* Toggle Link */}
        <div style={{
          fontSize: '0.875rem',
          color: 'var(--kite-text-secondary)',
          marginBottom: '2rem'
        }}>
          {isRegisterMode ? 'Already have an account?' : "Don't have an account?"}{' '}
          <button
            onClick={() => {
              setIsRegisterMode(!isRegisterMode);
              setError('');
              setConfirmPassword('');
              setName('');
            }}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--kite-brand-primary)',
              cursor: 'pointer',
              textDecoration: 'none'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.textDecoration = 'underline';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.textDecoration = 'none';
            }}
          >
            {isRegisterMode ? 'Login here!' : 'Signup now!'}
          </button>
        </div>

        {/* Footer */}
        <div style={{
          fontSize: '0.75rem',
          color: 'var(--kite-text-secondary)',
          lineHeight: '1.4'
        }}>
          CopyTrade Pro: Professional Multi-Broker Trading Platform | Secure API Integration
          <br />
          Advanced Portfolio Management | Real-time Market Data | Copy Trading Solutions
          <br />
          <br />
          v1.0.0
        </div>
      </div>
    </div>
  );
};

export default CopyTradeLogin;
