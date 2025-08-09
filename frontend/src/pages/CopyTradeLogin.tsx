import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useFormValidation, commonValidationRules } from '../hooks/useFormValidation';
import '../styles/app-theme.css';

interface LoginFormData {
  email: string;
  password: string;
}

interface RegisterFormData {
  name: string;
  email: string;
  password: string;
  confirmPassword: string;
}

const CopyTradeLogin: React.FC = () => {
  const { login, register } = useAuth();
  const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState(false);
  const [isRegisterMode, setIsRegisterMode] = useState(false);

  // Login form validation
  const loginForm = useFormValidation<LoginFormData>(
    { email: '', password: '' },
    {
      email: commonValidationRules.email,
      password: { required: true, minLength: 1 }
    },
    { validateOnChange: true, validateOnBlur: true, debounceMs: 500 }
  );

  // Register form validation
  const registerForm = useFormValidation<RegisterFormData>(
    { name: '', email: '', password: '', confirmPassword: '' },
    {
      name: commonValidationRules.name,
      email: commonValidationRules.email,
      password: commonValidationRules.password,
      confirmPassword: {
        required: true,
        custom: (value: string) => {
          if (value !== registerForm.values.password) {
            return 'Passwords do not match';
          }
          return null;
        }
      }
    },
    { validateOnChange: true, validateOnBlur: true, debounceMs: 300 }
  );

  // Helper functions
  const getUserInitials = () => {
    const currentEmail = isRegisterMode ? registerForm.values.email : loginForm.values.email;
    return currentEmail ? currentEmail.charAt(0).toUpperCase() : 'U';
  };

  const handleModeSwitch = (registerMode: boolean) => {
    setIsRegisterMode(registerMode);
    // Clear both forms when switching modes
    loginForm.reset();
    registerForm.reset();
  };

  const performLogin = async (formData: LoginFormData) => {
    try {
      const redirectPath = await login({
        email: formData.email.trim().toLowerCase(),
        password: formData.password,
      });
      
      // Navigate to the redirect path after successful login
      navigate(redirectPath, { replace: true });
    } catch (err: unknown) {
      let errorMessage = 'Login failed. Please try again.';

      if (err instanceof Error) {
        if (err.message.includes('Invalid email or password')) {
          errorMessage = 'Invalid email or password. If you don\'t have an account, please register first.';
          loginForm.setFieldError('email', 'Invalid credentials');
          loginForm.setFieldError('password', 'Invalid credentials');
        } else if (err.message.includes('Network error')) {
          errorMessage = 'Unable to connect to the server. Please check your internet connection.';
          loginForm.setFieldError('email', errorMessage);
        } else {
          errorMessage = err.message;
          loginForm.setFieldError('email', errorMessage);
        }
      } else {
        loginForm.setFieldError('email', errorMessage);
      }

      throw new Error(errorMessage);
    }
  };

  const performRegister = async (formData: RegisterFormData) => {
    try {
      await register({
        name: formData.name.trim(),
        email: formData.email.trim().toLowerCase(),
        password: formData.password,
      });
      
      // After successful registration, redirect to dashboard
      navigate('/dashboard', { replace: true });
    } catch (err: unknown) {
      let errorMessage = 'Registration failed. Please try again.';

      if (err instanceof Error) {
        if (err.message.includes('Email already exists')) {
          errorMessage = 'An account with this email already exists. Please login instead.';
          registerForm.setFieldError('email', errorMessage);
        } else if (err.message.includes('Network error')) {
          errorMessage = 'Unable to connect to the server. Please check your internet connection.';
          registerForm.setFieldError('email', errorMessage);
        } else {
          errorMessage = err.message;
          registerForm.setFieldError('email', errorMessage);
        }
      } else {
        registerForm.setFieldError('email', errorMessage);
      }

      throw new Error(errorMessage);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      if (isRegisterMode) {
        registerForm.handleSubmit(performRegister);
      } else {
        loginForm.handleSubmit(performLogin);
      }
    }
  };

  const currentForm = isRegisterMode ? registerForm : loginForm;
  const isSubmitting = currentForm.isSubmitting;

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, var(--interactive-primary) 0%, var(--interactive-secondary) 100%)',
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
          width: '80px',
          height: '80px',
          borderRadius: '50%',
          backgroundColor: 'var(--interactive-primary)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 2rem',
          fontSize: '1.5rem',
          fontWeight: '600',
          color: 'white'
        }}>
          {getUserInitials()}
        </div>

        {/* Mode Toggle */}
        <div style={{
          display: 'flex',
          gap: '1rem',
          marginBottom: '2rem',
          justifyContent: 'center'
        }}>
          <button
            onClick={() => handleModeSwitch(false)}
            style={{
              background: 'none',
              border: 'none',
              color: !isRegisterMode ? 'var(--interactive-primary)' : 'var(--text-secondary)',
              fontSize: '0.875rem',
              cursor: 'pointer',
              fontWeight: !isRegisterMode ? '600' : '400'
            }}
          >
            Login
          </button>
          <span style={{ color: 'var(--text-secondary)' }}>|</span>
          <button
            onClick={() => handleModeSwitch(true)}
            style={{
              background: 'none',
              border: 'none',
              color: isRegisterMode ? 'var(--interactive-primary)' : 'var(--text-secondary)',
              fontSize: '0.875rem',
              cursor: 'pointer',
              fontWeight: isRegisterMode ? '600' : '400'
            }}
          >
            Register
          </button>
        </div>

        {/* Form Card */}
        <div style={{
          backgroundColor: 'var(--color-bg-card)',
          borderRadius: '12px',
          padding: '2rem',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)',
          border: '1px solid var(--color-border-subtle)'
        }}>
          <h2 style={{
            fontSize: '1.5rem',
            fontWeight: '600',
            color: 'var(--text-primary)',
            marginBottom: '1.5rem',
            textAlign: 'center'
          }}>
            {isRegisterMode ? 'Create Account' : 'Welcome Back'}
          </h2>

          {/* Register-specific fields */}
          {isRegisterMode && (
            <div style={{ marginBottom: '1rem' }}>
              <input
                type="text"
                placeholder="Full Name"
                value={registerForm.values.name}
                onChange={(e) => registerForm.handleChange('name', e.target.value)}
                onBlur={() => registerForm.handleBlur('name')}
                onKeyPress={handleKeyPress}
                disabled={isSubmitting}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  border: `1px solid ${registerForm.errors.name ? 'var(--color-error)' : 'var(--color-border)'}`,
                  borderRadius: '8px',
                  fontSize: '1rem',
                  backgroundColor: 'var(--color-bg-input)',
                  color: 'var(--text-primary)',
                  outline: 'none',
                  transition: 'border-color 0.2s ease'
                }}
              />
              {registerForm.touched.name && registerForm.errors.name && (
                <div style={{ color: 'var(--color-error)', fontSize: '0.875rem', marginTop: '0.25rem' }}>
                  {registerForm.errors.name}
                </div>
              )}
            </div>
          )}

          {/* Email field */}
          <div style={{ marginBottom: '1rem' }}>
            <input
              type="email"
              placeholder="Email Address"
              value={currentForm.values.email}
              onChange={(e) => currentForm.handleChange('email', e.target.value)}
              onBlur={() => currentForm.handleBlur('email')}
              onKeyPress={handleKeyPress}
              disabled={isSubmitting}
              autoComplete="email"
              style={{
                width: '100%',
                padding: '0.75rem',
                border: `1px solid ${currentForm.errors.email ? 'var(--color-error)' : 'var(--color-border)'}`,
                borderRadius: '8px',
                fontSize: '1rem',
                backgroundColor: 'var(--color-bg-input)',
                color: 'var(--text-primary)',
                outline: 'none',
                transition: 'border-color 0.2s ease'
              }}
            />
            {currentForm.touched.email && currentForm.errors.email && (
              <div style={{ color: 'var(--color-error)', fontSize: '0.875rem', marginTop: '0.25rem' }}>
                {currentForm.errors.email}
              </div>
            )}
          </div>

          {/* Password field */}
          <div style={{ marginBottom: isRegisterMode ? '1rem' : '1.5rem' }}>
            <div style={{ position: 'relative' }}>
              <input
                type={showPassword ? 'text' : 'password'}
                placeholder="Password"
                value={currentForm.values.password}
                onChange={(e) => currentForm.handleChange('password', e.target.value)}
                onBlur={() => currentForm.handleBlur('password')}
                onKeyPress={handleKeyPress}
                disabled={isSubmitting}
                autoComplete={isRegisterMode ? 'new-password' : 'current-password'}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  paddingRight: '3rem',
                  border: `1px solid ${currentForm.errors.password ? 'var(--color-error)' : 'var(--color-border)'}`,
                  borderRadius: '8px',
                  fontSize: '1rem',
                  backgroundColor: 'var(--color-bg-input)',
                  color: 'var(--text-primary)',
                  outline: 'none',
                  transition: 'border-color 0.2s ease'
                }}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={{
                  position: 'absolute',
                  right: '0.75rem',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-secondary)',
                  cursor: 'pointer',
                  fontSize: '0.875rem'
                }}
              >
                {showPassword ? '👁️' : '👁️‍🗨️'}
              </button>
            </div>
            {currentForm.touched.password && currentForm.errors.password && (
              <div style={{ color: 'var(--color-error)', fontSize: '0.875rem', marginTop: '0.25rem' }}>
                {currentForm.errors.password}
              </div>
            )}
          </div>

          {/* Confirm Password field (Register only) */}
          {isRegisterMode && (
            <div style={{ marginBottom: '1.5rem' }}>
              <input
                type={showPassword ? 'text' : 'password'}
                placeholder="Confirm Password"
                value={registerForm.values.confirmPassword}
                onChange={(e) => registerForm.handleChange('confirmPassword', e.target.value)}
                onBlur={() => registerForm.handleBlur('confirmPassword')}
                onKeyPress={handleKeyPress}
                disabled={isSubmitting}
                autoComplete="new-password"
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  border: `1px solid ${registerForm.errors.confirmPassword ? 'var(--color-error)' : 'var(--color-border)'}`,
                  borderRadius: '8px',
                  fontSize: '1rem',
                  backgroundColor: 'var(--color-bg-input)',
                  color: 'var(--text-primary)',
                  outline: 'none',
                  transition: 'border-color 0.2s ease'
                }}
              />
              {registerForm.touched.confirmPassword && registerForm.errors.confirmPassword && (
                <div style={{ color: 'var(--color-error)', fontSize: '0.875rem', marginTop: '0.25rem' }}>
                  {registerForm.errors.confirmPassword}
                </div>
              )}
            </div>
          )}

          {/* Submit Button */}
          <button
            onClick={() => {
              if (isRegisterMode) {
                registerForm.handleSubmit(performRegister);
              } else {
                loginForm.handleSubmit(performLogin);
              }
            }}
            disabled={isSubmitting}
            style={{
              width: '100%',
              padding: '0.875rem',
              backgroundColor: isSubmitting ? 'var(--color-neutral-400)' : 'var(--interactive-primary)',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontSize: '1rem',
              fontWeight: '600',
              cursor: isSubmitting ? 'not-allowed' : 'pointer',
              transition: 'background-color 0.2s ease',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem'
            }}
          >
            {isSubmitting && (
              <div style={{
                width: '16px',
                height: '16px',
                border: '2px solid transparent',
                borderTop: '2px solid white',
                borderRadius: '50%',
                animation: 'spin 1s linear infinite'
              }} />
            )}
            {isSubmitting
              ? (isRegisterMode ? 'Creating Account...' : 'Signing In...')
              : (isRegisterMode ? 'Create Account' : 'Sign In')
            }
          </button>

          {/* Footer Text */}
          <div style={{
            marginTop: '1.5rem',
            textAlign: 'center',
            fontSize: '0.875rem',
            color: 'var(--text-secondary)'
          }}>
            {isRegisterMode ? (
              <>
                Already have an account?{' '}
                <button
                  onClick={() => handleModeSwitch(false)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--interactive-primary)',
                    cursor: 'pointer',
                    textDecoration: 'underline'
                  }}
                >
                  Sign in here
                </button>
              </>
            ) : (
              <>
                Don't have an account?{' '}
                <button
                  onClick={() => handleModeSwitch(true)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--interactive-primary)',
                    cursor: 'pointer',
                    textDecoration: 'underline'
                  }}
                >
                  Register here
                </button>
              </>
            )}
          </div>
        </div>

        {/* App Info */}
        <div style={{
          marginTop: '2rem',
          textAlign: 'center',
          color: 'rgba(255, 255, 255, 0.8)',
          fontSize: '0.875rem'
        }}>
          <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1.25rem', fontWeight: '600' }}>
            CopyTrade Pro
          </h3>
          <p style={{ margin: '0 0 1rem 0' }}>
            Professional multi-broker trading platform
          </p>
          <div style={{
            display: 'flex',
            justifyContent: 'center',
            gap: '1.5rem',
            fontSize: '0.75rem'
          }}>
            <span>🔗 Multi-Broker</span>
            <span>📊 Real-time</span>
            <span>🔒 Secure</span>
          </div>
        </div>
      </div>

      {/* Add CSS for spinner animation */}
      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

export default CopyTradeLogin;
