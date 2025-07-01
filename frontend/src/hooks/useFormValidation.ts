import { useState, useCallback, useMemo } from 'react';

// Validation rule types
export interface ValidationRule {
  required?: boolean;
  min?: number;
  max?: number;
  minLength?: number;
  maxLength?: number;
  pattern?: RegExp;
  custom?: (value: any) => string | null;
  message?: string;
}

export interface FieldValidation {
  [fieldName: string]: ValidationRule;
}

export interface ValidationError {
  field: string;
  message: string;
}

export interface FieldState {
  value: any;
  error: string | null;
  touched: boolean;
  isValid: boolean;
}

export interface FormState {
  [fieldName: string]: FieldState;
}

export interface UseFormValidationReturn {
  // Form state
  formState: FormState;
  errors: ValidationError[];
  isValid: boolean;
  hasErrors: boolean;
  
  // Field operations
  setValue: (field: string, value: any) => void;
  setError: (field: string, error: string | null) => void;
  setTouched: (field: string, touched?: boolean) => void;
  clearField: (field: string) => void;
  
  // Form operations
  validateField: (field: string) => boolean;
  validateForm: () => boolean;
  clearErrors: () => void;
  clearForm: () => void;
  resetForm: (initialValues?: Record<string, any>) => void;
  
  // Utility functions
  getFieldError: (field: string) => string | null;
  isFieldValid: (field: string) => boolean;
  isFieldTouched: (field: string) => boolean;
  getFieldValue: (field: string) => any;
  
  // Styling helpers
  getFieldClassName: (field: string, baseClassName?: string) => string;
  getFieldStyle: (field: string, baseStyle?: React.CSSProperties) => React.CSSProperties;
}

const defaultValidationMessages = {
  required: 'This field is required',
  min: 'Value must be at least {min}',
  max: 'Value must be at most {max}',
  minLength: 'Must be at least {minLength} characters',
  maxLength: 'Must be at most {maxLength} characters',
  pattern: 'Invalid format',
  email: 'Please enter a valid email address',
  number: 'Please enter a valid number',
  positive: 'Value must be positive',
  integer: 'Value must be a whole number'
};

export const useFormValidation = (
  validationRules: FieldValidation,
  initialValues: Record<string, any> = {}
): UseFormValidationReturn => {
  
  // Initialize form state
  const [formState, setFormState] = useState<FormState>(() => {
    const initialState: FormState = {};
    
    // Initialize all fields from validation rules and initial values
    const allFields = new Set([
      ...Object.keys(validationRules),
      ...Object.keys(initialValues)
    ]);
    
    allFields.forEach(field => {
      initialState[field] = {
        value: initialValues[field] || '',
        error: null,
        touched: false,
        isValid: true
      };
    });
    
    return initialState;
  });

  // Validate a single field
  const validateField = useCallback((field: string): boolean => {
    const rules = validationRules[field];
    if (!rules) return true;

    const value = formState[field]?.value;
    let error: string | null = null;

    // Required validation
    if (rules.required && (!value || (typeof value === 'string' && value.trim() === ''))) {
      error = rules.message || defaultValidationMessages.required;
    }
    
    // Only validate other rules if value exists
    if (!error && value !== null && value !== undefined && value !== '') {
      // Min/Max validation for numbers
      if (rules.min !== undefined && Number(value) < rules.min) {
        error = rules.message || defaultValidationMessages.min.replace('{min}', rules.min.toString());
      }
      
      if (rules.max !== undefined && Number(value) > rules.max) {
        error = rules.message || defaultValidationMessages.max.replace('{max}', rules.max.toString());
      }
      
      // Length validation for strings
      if (rules.minLength !== undefined && String(value).length < rules.minLength) {
        error = rules.message || defaultValidationMessages.minLength.replace('{minLength}', rules.minLength.toString());
      }
      
      if (rules.maxLength !== undefined && String(value).length > rules.maxLength) {
        error = rules.message || defaultValidationMessages.maxLength.replace('{maxLength}', rules.maxLength.toString());
      }
      
      // Pattern validation
      if (rules.pattern && !rules.pattern.test(String(value))) {
        error = rules.message || defaultValidationMessages.pattern;
      }
      
      // Custom validation
      if (rules.custom) {
        const customError = rules.custom(value);
        if (customError) {
          error = customError;
        }
      }
    }

    // Update field state
    setFormState(prev => ({
      ...prev,
      [field]: {
        ...prev[field],
        error,
        isValid: !error
      }
    }));

    return !error;
  }, [formState, validationRules]);

  // Validate entire form
  const validateForm = useCallback((): boolean => {
    let isFormValid = true;
    
    Object.keys(validationRules).forEach(field => {
      const fieldValid = validateField(field);
      if (!fieldValid) {
        isFormValid = false;
        // Mark field as touched to show error
        setFormState(prev => ({
          ...prev,
          [field]: {
            ...prev[field],
            touched: true
          }
        }));
      }
    });
    
    return isFormValid;
  }, [validateField, validationRules]);

  // Set field value
  const setValue = useCallback((field: string, value: any) => {
    setFormState(prev => ({
      ...prev,
      [field]: {
        ...prev[field],
        value,
        error: null, // Clear error when value changes
        isValid: true
      }
    }));
  }, []);

  // Set field error
  const setError = useCallback((field: string, error: string | null) => {
    setFormState(prev => ({
      ...prev,
      [field]: {
        ...prev[field],
        error,
        isValid: !error
      }
    }));
  }, []);

  // Set field touched state
  const setTouched = useCallback((field: string, touched: boolean = true) => {
    setFormState(prev => ({
      ...prev,
      [field]: {
        ...prev[field],
        touched
      }
    }));
  }, []);

  // Clear specific field
  const clearField = useCallback((field: string) => {
    setFormState(prev => ({
      ...prev,
      [field]: {
        value: '',
        error: null,
        touched: false,
        isValid: true
      }
    }));
  }, []);

  // Clear all errors
  const clearErrors = useCallback(() => {
    setFormState(prev => {
      const newState = { ...prev };
      Object.keys(newState).forEach(field => {
        newState[field] = {
          ...newState[field],
          error: null,
          isValid: true
        };
      });
      return newState;
    });
  }, []);

  // Clear entire form
  const clearForm = useCallback(() => {
    setFormState(prev => {
      const newState = { ...prev };
      Object.keys(newState).forEach(field => {
        newState[field] = {
          value: '',
          error: null,
          touched: false,
          isValid: true
        };
      });
      return newState;
    });
  }, []);

  // Reset form with new initial values
  const resetForm = useCallback((newInitialValues: Record<string, any> = {}) => {
    setFormState(prev => {
      const newState = { ...prev };
      Object.keys(newState).forEach(field => {
        newState[field] = {
          value: newInitialValues[field] || '',
          error: null,
          touched: false,
          isValid: true
        };
      });
      return newState;
    });
  }, []);

  // Utility functions
  const getFieldError = useCallback((field: string): string | null => {
    return formState[field]?.error || null;
  }, [formState]);

  const isFieldValid = useCallback((field: string): boolean => {
    return formState[field]?.isValid !== false;
  }, [formState]);

  const isFieldTouched = useCallback((field: string): boolean => {
    return formState[field]?.touched || false;
  }, [formState]);

  const getFieldValue = useCallback((field: string): any => {
    return formState[field]?.value || '';
  }, [formState]);

  // Styling helpers
  const getFieldClassName = useCallback((field: string, baseClassName: string = ''): string => {
    const fieldState = formState[field];
    if (!fieldState) return baseClassName;

    const hasError = fieldState.error && fieldState.touched;
    const errorClass = hasError ? 'field-error' : '';
    
    return `${baseClassName} ${errorClass}`.trim();
  }, [formState]);

  const getFieldStyle = useCallback((field: string, baseStyle: React.CSSProperties = {}): React.CSSProperties => {
    const fieldState = formState[field];
    if (!fieldState) return baseStyle;

    const hasError = fieldState.error && fieldState.touched;
    
    return {
      ...baseStyle,
      ...(hasError && {
        borderColor: 'var(--kite-loss, #e53e3e)',
        boxShadow: '0 0 0 1px var(--kite-loss, #e53e3e)'
      })
    };
  }, [formState]);

  // Computed values
  const errors = useMemo((): ValidationError[] => {
    return Object.entries(formState)
      .filter(([_, fieldState]) => fieldState.error && fieldState.touched)
      .map(([field, fieldState]) => ({
        field,
        message: fieldState.error!
      }));
  }, [formState]);

  const isValid = useMemo((): boolean => {
    return Object.values(formState).every(fieldState => fieldState.isValid);
  }, [formState]);

  const hasErrors = useMemo((): boolean => {
    return errors.length > 0;
  }, [errors]);

  return {
    // Form state
    formState,
    errors,
    isValid,
    hasErrors,
    
    // Field operations
    setValue,
    setError,
    setTouched,
    clearField,
    
    // Form operations
    validateField,
    validateForm,
    clearErrors,
    clearForm,
    resetForm,
    
    // Utility functions
    getFieldError,
    isFieldValid,
    isFieldTouched,
    getFieldValue,
    
    // Styling helpers
    getFieldClassName,
    getFieldStyle
  };
};

export default useFormValidation;
