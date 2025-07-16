import React from 'react';
import { useAuth } from '../hooks/useAuth';
import { useFormValidation, commonValidationRules } from '../hooks/useFormValidation';
import { Input, Button, Stack } from './ui';

interface LoginFormData {
  email: string;
  password: string;
}

const LoginForm: React.FC = () => {
  const { login } = useAuth();

  const {
    values,
    errors,
    touched,
    isSubmitting,
    handleChange,
    handleBlur,
    handleSubmit,
    setFieldError
  } = useFormValidation<LoginFormData>(
    { email: '', password: '' },
    {
      email: commonValidationRules.email,
      password: { required: true, minLength: 1 } // Less strict for login
    },
    { validateOnChange: true, validateOnBlur: true, debounceMs: 500 }
  );

  const performLogin = async (formData: LoginFormData) => {
    try {
      await login({
        email: formData.email.trim().toLowerCase(),
        password: formData.password,
      });
    } catch (err: any) {
      let errorMessage = 'Login failed. Please try again.';

      if (err?.message) {
        if (err.message.includes('Invalid email or password')) {
          errorMessage = 'Invalid email or password. If you don\'t have an account, please register first.';
          // Set field-specific errors
          setFieldError('email', 'Invalid credentials');
          setFieldError('password', 'Invalid credentials');
        } else if (err.message.includes('Network error')) {
          errorMessage = 'Unable to connect to the server. Please check your internet connection.';
          setFieldError('email', errorMessage);
        } else {
          errorMessage = err.message;
          setFieldError('email', errorMessage);
        }
      } else {
        setFieldError('email', errorMessage);
      }

      throw new Error(errorMessage);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSubmit(performLogin);
    }
  };

  return (
    <div className="auth-form">
      <Stack gap={4}>
        <Input
          type="email"
          label="Email Address"
          value={values.email}
          onChange={(e) => handleChange('email', e.target.value)}
          onBlur={() => handleBlur('email')}
          onKeyPress={handleKeyPress}
          placeholder="Enter your email address"
          disabled={isSubmitting}
          autoComplete="email"
          state={errors.email ? 'error' : 'default'}
          error={touched.email ? errors.email : ''}
          required
          fullWidth
        />

        <Input
          type="password"
          label="Password"
          value={values.password}
          onChange={(e) => handleChange('password', e.target.value)}
          onBlur={() => handleBlur('password')}
          onKeyPress={handleKeyPress}
          placeholder="Enter your password"
          disabled={isSubmitting}
          autoComplete="current-password"
          state={errors.password ? 'error' : 'default'}
          error={touched.password ? errors.password : ''}
          required
          fullWidth
        />

        <Button
          variant="primary"
          size="lg"
          onClick={() => handleSubmit(performLogin)}
          disabled={isSubmitting}
          loading={isSubmitting}
          fullWidth
        >
          {isSubmitting ? 'Signing in...' : 'Sign In'}
        </Button>
      </Stack>
    </div>
  );
};

export default LoginForm;
