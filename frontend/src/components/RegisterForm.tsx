import React, { useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { Input, Button, Stack } from './ui';

const RegisterForm: React.FC = () => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const { register } = useAuth();

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    
    // Clear error when user starts typing
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) {
      newErrors.name = 'Name is required';
    } else if (formData.name.trim().length < 2) {
      newErrors.name = 'Name must be at least 2 characters';
    } else if (formData.name.trim().length > 50) {
      newErrors.name = 'Name must be less than 50 characters';
    }

    if (!formData.email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = 'Please enter a valid email';
    }

    if (!formData.password) {
      newErrors.password = 'Password is required';
    } else if (formData.password.length < 6) {
      newErrors.password = 'Password must be at least 6 characters';
    } else if (!/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(formData.password)) {
      newErrors.password = 'Password must contain at least one uppercase letter, one lowercase letter, and one number';
    }

    if (!formData.confirmPassword) {
      newErrors.confirmPassword = 'Please confirm your password';
    } else if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);
    setErrors({});

    try {
      await register({
        name: formData.name.trim(),
        email: formData.email.trim().toLowerCase(),
        password: formData.password,
      });
    } catch (error: any) {
      console.error('🚨 Registration error:', error);
      setErrors({
        general: error.message || 'Registration failed. Please try again.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="auth-form">
      {errors.general && (
        <div className="register-error-alert">
          {errors.general}
        </div>
      )}

      <Stack gap={4}>
        <Input
          type="text"
          label="Full Name"
          name="name"
          value={formData.name}
          onChange={handleChange}
          placeholder="Enter your full name"
          disabled={isSubmitting}
          autoComplete="name"
          state={errors.name ? 'error' : 'default'}
          error={errors.name}
          fullWidth
        />

        <Input
          type="email"
          label="Email Address"
          name="email"
          value={formData.email}
          onChange={handleChange}
          placeholder="Enter your email"
          disabled={isSubmitting}
          autoComplete="email"
          state={errors.email ? 'error' : 'default'}
          error={errors.email}
          fullWidth
        />

        <Input
          type="password"
          label="Password"
          name="password"
          value={formData.password}
          onChange={handleChange}
          placeholder="Create a password"
          disabled={isSubmitting}
          autoComplete="new-password"
          state={errors.password ? 'error' : 'default'}
          error={errors.password}
          fullWidth
        />

        <Input
          type="password"
          label="Confirm Password"
          name="confirmPassword"
          value={formData.confirmPassword}
          onChange={handleChange}
          placeholder="Confirm your password"
          disabled={isSubmitting}
          autoComplete="new-password"
          state={errors.confirmPassword ? 'error' : 'default'}
          error={errors.confirmPassword}
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
