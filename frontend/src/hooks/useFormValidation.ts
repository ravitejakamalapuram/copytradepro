import { useState, useCallback, useEffect } from 'react';

export interface ValidationRule {
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  pattern?: RegExp;
  min?: number;
  max?: number;
  custom?: (value: any) => string | null;
}

export interface ValidationRules {
  [fieldName: string]: ValidationRule;
}

export interface ValidationErrors {
  [fieldName: string]: string;
}

export interface FormValidationOptions {
  validateOnChange?: boolean;
  validateOnBlur?: boolean;
  debounceMs?: number;
}

export const useFormValidation = <T extends Record<string, any>>(
  initialValues: T,
  validationRules: ValidationRules,
  options: FormValidationOptions = {}
) => {
  const {
    validateOnChange = true,
    validateOnBlur = true,
    debounceMs = 300
  } = options;

  const [values, setValues] = useState<T>(initialValues);
  const [errors, setErrors] = useState<ValidationErrors>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitCount, setSubmitCount] = useState(0);

  // Debounced validation
  const [validationTimeouts, setValidationTimeouts] = useState<Record<string, NodeJS.Timeout>>({});

  const validateField = useCallback((fieldName: string, value: any): string | null => {
    const rule = validationRules[fieldName];
    if (!rule) return null;

    // Required validation
    if (rule.required && (!value || (typeof value === 'string' && !value.trim()))) {
      return `${fieldName.charAt(0).toUpperCase() + fieldName.slice(1)} is required`;
    }

    // Skip other validations if field is empty and not required
    if (!value || (typeof value === 'string' && !value.trim())) {
      return null;
    }

    // String validations
    if (typeof value === 'string') {
      if (rule.minLength && value.length < rule.minLength) {
        return `${fieldName.charAt(0).toUpperCase() + fieldName.slice(1)} must be at least ${rule.minLength} characters`;
      }

      if (rule.maxLength && value.length > rule.maxLength) {
        return `${fieldName.charAt(0).toUpperCase() + fieldName.slice(1)} must be less than ${rule.maxLength} characters`;
      }

      if (rule.pattern && !rule.pattern.test(value)) {
        return `${fieldName.charAt(0).toUpperCase() + fieldName.slice(1)} format is invalid`;
      }
    }

    // Number validations
    if (typeof value === 'number' || (typeof value === 'string' && !isNaN(Number(value)))) {
      const numValue = typeof value === 'number' ? value : Number(value);
      
      if (rule.min !== undefined && numValue < rule.min) {
        return `${fieldName.charAt(0).toUpperCase() + fieldName.slice(1)} must be at least ${rule.min}`;
      }

      if (rule.max !== undefined && numValue > rule.max) {
        return `${fieldName.charAt(0).toUpperCase() + fieldName.slice(1)} must be at most ${rule.max}`;
      }
    }

    // Custom validation
    if (rule.custom) {
      return rule.custom(value);
    }

    return null;
  }, [validationRules]);

  const validateAllFields = useCallback((): ValidationErrors => {
    const newErrors: ValidationErrors = {};
    
    Object.keys(validationRules).forEach(fieldName => {
      const error = validateField(fieldName, values[fieldName]);
      if (error) {
        newErrors[fieldName] = error;
      }
    });

    return newErrors;
  }, [values, validateField, validationRules]);

  const debouncedValidateField = useCallback((fieldName: string, value: any) => {
    // Clear existing timeout
    if (validationTimeouts[fieldName]) {
      clearTimeout(validationTimeouts[fieldName]);
    }

    // Set new timeout
    const timeoutId = setTimeout(() => {
      const error = validateField(fieldName, value);
      setErrors(prev => ({
        ...prev,
        [fieldName]: error || ''
      }));
    }, debounceMs);

    setValidationTimeouts(prev => ({
      ...prev,
      [fieldName]: timeoutId
    }));
  }, [validateField, debounceMs, validationTimeouts]);

  const handleChange = useCallback((fieldName: string, value: any) => {
    setValues(prev => ({
      ...prev,
      [fieldName]: value
    }));

    // Clear error when user starts typing
    if (errors[fieldName]) {
      setErrors(prev => ({
        ...prev,
        [fieldName]: ''
      }));
    }

    // Validate on change if enabled
    if (validateOnChange && (touched[fieldName] || submitCount > 0)) {
      debouncedValidateField(fieldName, value);
    }
  }, [errors, touched, submitCount, validateOnChange, debouncedValidateField]);

  const handleBlur = useCallback((fieldName: string) => {
    setTouched(prev => ({
      ...prev,
      [fieldName]: true
    }));

    // Validate on blur if enabled
    if (validateOnBlur) {
      const error = validateField(fieldName, values[fieldName]);
      setErrors(prev => ({
        ...prev,
        [fieldName]: error || ''
      }));
    }
  }, [validateOnBlur, validateField, values]);

  const handleSubmit = useCallback(async (onSubmit: (values: T) => Promise<void> | void) => {
    setIsSubmitting(true);
    setSubmitCount(prev => prev + 1);

    // Mark all fields as touched
    const allTouched = Object.keys(validationRules).reduce((acc, key) => {
      acc[key] = true;
      return acc;
    }, {} as Record<string, boolean>);
    setTouched(allTouched);

    // Validate all fields
    const validationErrors = validateAllFields();
    setErrors(validationErrors);

    // If there are errors, don't submit
    if (Object.keys(validationErrors).some(key => validationErrors[key])) {
      setIsSubmitting(false);
      return;
    }

    try {
      await onSubmit(values);
    } catch (error) {
      // Handle submission errors
      console.error('Form submission error:', error);
    } finally {
      setIsSubmitting(false);
    }
  }, [values, validationRules, validateAllFields]);

  const reset = useCallback((newValues?: Partial<T>) => {
    setValues(newValues ? { ...initialValues, ...newValues } : initialValues);
    setErrors({});
    setTouched({});
    setIsSubmitting(false);
    setSubmitCount(0);
    
    // Clear all timeouts
    Object.values(validationTimeouts).forEach(timeout => clearTimeout(timeout));
    setValidationTimeouts({});
  }, [initialValues, validationTimeouts]);

  const setFieldError = useCallback((fieldName: string, error: string) => {
    setErrors(prev => ({
      ...prev,
      [fieldName]: error
    }));
  }, []);

  const clearFieldError = useCallback((fieldName: string) => {
    setErrors(prev => ({
      ...prev,
      [fieldName]: ''
    }));
  }, []);

  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      Object.values(validationTimeouts).forEach(timeout => clearTimeout(timeout));
    };
  }, [validationTimeouts]);

  const isValid = Object.keys(errors).every(key => !errors[key]);
  const hasErrors = Object.keys(errors).some(key => errors[key]);

  return {
    values,
    errors,
    touched,
    isSubmitting,
    isValid,
    hasErrors,
    handleChange,
    handleBlur,
    handleSubmit,
    reset,
    setFieldError,
    clearFieldError,
    validateField,
    validateAllFields
  };
};

// Common validation rules
export const commonValidationRules = {
  email: {
    required: true,
    pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
    custom: (value: string) => {
      if (value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
        return 'Please enter a valid email address';
      }
      return null;
    }
  },
  password: {
    required: true,
    minLength: 6,
    custom: (value: string) => {
      if (value && value.length >= 6 && !/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(value)) {
        return 'Password must contain at least one uppercase letter, one lowercase letter, and one number';
      }
      return null;
    }
  },
  name: {
    required: true,
    minLength: 2,
    maxLength: 50,
    custom: (value: string) => {
      if (value && !/^[a-zA-Z\s]+$/.test(value.trim())) {
        return 'Name can only contain letters and spaces';
      }
      return null;
    }
  },
  symbol: {
    required: true,
    pattern: /^[A-Z0-9&-]+$/,
    custom: (value: string) => {
      if (value && !/^[A-Z0-9&-]+$/.test(value)) {
        return 'Symbol must contain only uppercase letters, numbers, and hyphens';
      }
      return null;
    }
  },
  quantity: {
    required: true,
    min: 1,
    custom: (value: string | number) => {
      const num = typeof value === 'string' ? parseInt(value) : value;
      if (isNaN(num) || num <= 0) {
        return 'Quantity must be a positive number';
      }
      if (num !== Math.floor(num)) {
        return 'Quantity must be a whole number';
      }
      return null;
    }
  },
  price: {
    required: true,
    min: 0.01,
    custom: (value: string | number) => {
      const num = typeof value === 'string' ? parseFloat(value) : value;
      if (isNaN(num) || num <= 0) {
        return 'Price must be a positive number';
      }
      return null;
    }
  }
};