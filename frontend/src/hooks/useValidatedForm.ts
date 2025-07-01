import { useCallback } from 'react';
import { useFormValidation, type FieldValidation, type UseFormValidationReturn } from './useFormValidation';
import { useToast } from './useToast';

export interface UseValidatedFormOptions {
  validationRules: FieldValidation;
  initialValues?: Record<string, any>;
  showToastOnError?: boolean;
  showToastOnSuccess?: boolean;
}

export interface UseValidatedFormReturn extends UseFormValidationReturn {
  // Enhanced form operations with toast notifications
  validateAndSubmit: (onSubmit: (values: Record<string, any>) => Promise<void> | void) => Promise<boolean>;
  handleSubmit: (onSubmit: (values: Record<string, any>) => Promise<void> | void) => (e?: React.FormEvent) => Promise<void>;
  
  // Form values as object
  values: Record<string, any>;
  
  // Enhanced field operations
  handleFieldChange: (field: string) => (value: any) => void;
  handleFieldBlur: (field: string) => () => void;
  
  // Validation with toast notifications
  validateWithToast: () => boolean;
  showValidationErrors: () => void;
}

export const useValidatedForm = (options: UseValidatedFormOptions): UseValidatedFormReturn => {
  const {
    validationRules,
    initialValues = {},
    showToastOnError = true,
    showToastOnSuccess = false
  } = options;

  const formValidation = useFormValidation(validationRules, initialValues);
  const { validationError, formSuccess } = useToast();

  const {
    formState,
    validateForm,
    validateField,
    setValue,
    setTouched,
    errors,
    getFieldValue
  } = formValidation;

  // Get all form values as an object
  const values = Object.keys(formState).reduce((acc, field) => {
    acc[field] = getFieldValue(field);
    return acc;
  }, {} as Record<string, any>);

  // Validate form and show toast notification if there are errors
  const validateWithToast = useCallback((): boolean => {
    const isValid = validateForm();
    
    if (!isValid && showToastOnError) {
      const errorCount = errors.length;
      const firstError = errors[0];
      
      if (errorCount === 1) {
        validationError(firstError.message);
      } else if (errorCount > 1) {
        validationError(`Please fix ${errorCount} validation errors in the form`);
      } else {
        validationError('Please fill in all required fields');
      }
    }
    
    return isValid;
  }, [validateForm, showToastOnError, errors, validationError]);

  // Show all validation errors as toast notifications
  const showValidationErrors = useCallback(() => {
    if (errors.length === 0) return;
    
    if (errors.length === 1) {
      validationError(errors[0].message);
    } else {
      const errorMessages = errors.map(error => `• ${error.message}`).join('\n');
      validationError(`Please fix the following errors:\n${errorMessages}`);
    }
  }, [errors, validationError]);

  // Validate and submit form
  const validateAndSubmit = useCallback(async (
    onSubmit: (values: Record<string, any>) => Promise<void> | void
  ): Promise<boolean> => {
    const isValid = validateWithToast();
    
    if (!isValid) {
      return false;
    }

    try {
      await onSubmit(values);
      
      if (showToastOnSuccess) {
        formSuccess('Form submitted successfully');
      }
      
      return true;
    } catch (error: any) {
      if (showToastOnError) {
        validationError(error.message || 'Failed to submit form');
      }
      return false;
    }
  }, [validateWithToast, values, showToastOnSuccess, showToastOnError, formSuccess, validationError]);

  // Handle form submission with event prevention
  const handleSubmit = useCallback((
    onSubmit: (values: Record<string, any>) => Promise<void> | void
  ) => {
    return async (e?: React.FormEvent) => {
      if (e) {
        e.preventDefault();
      }
      await validateAndSubmit(onSubmit);
    };
  }, [validateAndSubmit]);

  // Handle field change with automatic validation
  const handleFieldChange = useCallback((field: string) => {
    return (value: any) => {
      setValue(field, value);
      
      // Validate field if it was previously touched and had an error
      if (formState[field]?.touched && formState[field]?.error) {
        setTimeout(() => validateField(field), 100);
      }
    };
  }, [setValue, validateField, formState]);

  // Handle field blur with validation
  const handleFieldBlur = useCallback((field: string) => {
    return () => {
      setTouched(field, true);
      validateField(field);
    };
  }, [setTouched, validateField]);

  return {
    // Include all form validation methods
    ...formValidation,
    
    // Enhanced form operations
    validateAndSubmit,
    handleSubmit,
    
    // Form values
    values,
    
    // Enhanced field operations
    handleFieldChange,
    handleFieldBlur,
    
    // Validation with toast notifications
    validateWithToast,
    showValidationErrors
  };
};

// Common validation rules for reuse
export const commonValidationRules = {
  required: { required: true },
  email: { 
    required: true, 
    pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
    message: 'Please enter a valid email address'
  },
  positiveNumber: {
    required: true,
    custom: (value: any) => {
      const num = Number(value);
      if (isNaN(num)) return 'Please enter a valid number';
      if (num <= 0) return 'Value must be positive';
      return null;
    }
  },
  positiveInteger: {
    required: true,
    custom: (value: any) => {
      const num = Number(value);
      if (isNaN(num)) return 'Please enter a valid number';
      if (num <= 0) return 'Value must be positive';
      if (!Number.isInteger(num)) return 'Value must be a whole number';
      return null;
    }
  },
  price: {
    required: true,
    custom: (value: any) => {
      const num = Number(value);
      if (isNaN(num)) return 'Please enter a valid price';
      if (num <= 0) return 'Price must be positive';
      if (num > 1000000) return 'Price seems too high';
      return null;
    }
  },
  quantity: {
    required: true,
    custom: (value: any) => {
      const num = Number(value);
      if (isNaN(num)) return 'Please enter a valid quantity';
      if (num <= 0) return 'Quantity must be positive';
      if (!Number.isInteger(num)) return 'Quantity must be a whole number';
      if (num > 100000) return 'Quantity seems too high';
      return null;
    }
  },
  symbol: {
    required: true,
    minLength: 1,
    maxLength: 20,
    pattern: /^[A-Z0-9-]+$/,
    message: 'Symbol must contain only uppercase letters, numbers, and hyphens'
  },
  accountSelection: {
    custom: (value: any) => {
      if (!Array.isArray(value) || value.length === 0) {
        return 'Please select at least one account';
      }
      return null;
    }
  }
};

export default useValidatedForm;
