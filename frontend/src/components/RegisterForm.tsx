import React from 'react';
import { useAuth } from '../hooks/useAuth';
import { useFormValidation, commonValidationRules } from '../hooks/useFormValidation';
import { Input, Button, Stack } from './ui';

interface RegisterFormData {
  name: string;
  email: string;
  password: string;
  confirmPassword: string;
}

const RegisterForm: React.FC = () => {
  const { register } = useAuth();

  const {
    values,
    errors,
    touched,
    isSubmitting,
    handleChange,
    handleBlur,
    handleSubmit,
    setFieldError
  } = useFormValidation<RegisterFormData>(
    { name: '', email: '', password: '', confirmPassword: '' },
    {
      name: commonValidationRules.name,
      email: commonValidationRules.email,
      password: commonValidationRules.password,
      confirmPassword: {
        required: true,
        custom: (value: string) => {
          if (value !== values.password) {
            return 'Passwords do not match';
          }
          return null;
        }
      }
    },
    { validateOnChange: true, validateOnBlur: true, debounceMs: 300 }
  );

  const performRegister = async (formData: RegisterFormData) => {
    try {
      await register({
        name: formData.name.trim(),
        email: formData.email.trim().toLowerCase(),
        password: formData.password,
      });
    } catch (error: any) {
      console.error('🚨 Registration error:', error);
      
      // Set field-specific errors based on the error message
      if (error.message?.includes('email already exists') || error.message?.includes('email is already registered')) {
        setFieldError('email', 'This email is already registered. Please use a different email or try logging in.');
      } else if (error.message?.includes('password')) {
        setFieldError('password', error.message);
      } else if (error.message?.includes('name')) {
        setFieldError('name', error.message);
      } else {
        setFieldError('email', error.message || 'Registration failed. Please try again.');
      }

      throw error;
    }
  };

  return (
    <form onSubmit={(e) => { e.preventDefault(); handleSubmit(performRegister); }} className="auth-form">
      <Stack gap={4}>
        <Input
          type="text"
          label="Full Name"
          value={values.name}
          onChange={(e) => handleChange('name', e.target.value)}
          onBlur={() => handleBlur('name')}
          placeholder="Enter your full name"
          disabled={isSubmitting}
          autoComplete="name"
          state={errors.name ? 'error' : 'default'}
          error={touched.name ? errors.name : ''}
          required
          fullWidth
        />

        <Input
          type="email"
          label="Email Address"
          value={values.email}
          onChange={(e) => handleChange('email', e.target.value)}
          onBlur={() => handleBlur('email')}
          placeholder="Enter your email"
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
          placeholder="Create a password"
          disabled={isSubmitting}
          autoComplete="new-password"
          state={errors.password ? 'error' : 'default'}
          error={touched.password ? errors.password : ''}
          required
          fullWidth
        />

        <Input
          type="password"
          label="Confirm Password"
          value={values.confirmPassword}
          onChange={(e) => handleChange('confirmPassword', e.target.value)}
          onBlur={() => handleBlur('confirmPassword')}
          placeholder="Confirm your password"
          disabled={isSubmitting}
          autoComplete="new-password"
          state={errors.confirmPassword ? 'error' : 'default'}
          error={touched.confirmPassword ? errors.confirmPassword : ''}
          required
          fullWidth
        />

        <Button
          type="submit"
          variant="primary"
          size="lg"
          disabled={isSubmitting}
          loading={isSubmitting}
          fullWidth
        >
          {isSubmitting ? 'Creating Account...' : 'Create Account'}
        </Button>
      </Stack>
    </form>
  );
};

export default RegisterForm;
