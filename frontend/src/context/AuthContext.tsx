import React, { createContext, useContext, useReducer, useEffect } from 'react';
import type { User, AuthContextType, LoginCredentials, RegisterCredentials } from '../types/auth';
import { authService } from '../services/authService';

// Auth state interface
interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  loading: boolean;
}

// Auth actions
type AuthAction =
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'LOGIN_SUCCESS'; payload: { user: User; token: string } }
  | { type: 'LOGOUT' }
  | { type: 'SET_USER'; payload: User };

// Initial state
const initialState: AuthState = {
  user: null,
  token: null,
  isAuthenticated: false,
  loading: true,
};

// Auth reducer
const authReducer = (state: AuthState, action: AuthAction): AuthState => {
  switch (action.type) {
    case 'SET_LOADING':
      return { ...state, loading: action.payload };
    
    case 'LOGIN_SUCCESS':
      return {
        ...state,
        user: action.payload.user,
        token: action.payload.token,
        isAuthenticated: true,
        loading: false,
      };
    
    case 'LOGOUT':
      return {
        ...state,
        user: null,
        token: null,
        isAuthenticated: false,
        loading: false,
      };
    
    case 'SET_USER':
      return {
        ...state,
        user: action.payload,
        isAuthenticated: true,
        loading: false,
      };
    
    default:
      return state;
  }
};

// Create context
const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Auth provider component
export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, dispatch] = useReducer(authReducer, initialState);

  // Initialize auth state from localStorage
  useEffect(() => {
    const initializeAuth = async () => {
      try {
        const token = localStorage.getItem('token');
        const userStr = localStorage.getItem('user');

        if (token && userStr) {
          const user = JSON.parse(userStr);

          // First, optimistically set the user as authenticated
          dispatch({
            type: 'LOGIN_SUCCESS',
            payload: { user, token },
          });

          // Then verify token in background with retry logic
          const verifyToken = async (retries = 3): Promise<void> => {
            try {
              const response = await authService.getProfile();
              if (response.success && response.data?.user) {
                // Token is valid, update user data if needed
                dispatch({
                  type: 'LOGIN_SUCCESS',
                  payload: { user: response.data.user, token },
                });
              } else {
                // Token is invalid, clear storage
                console.warn('🔑 Token validation failed, logging out');
                localStorage.removeItem('token');
                localStorage.removeItem('user');
                dispatch({ type: 'LOGOUT' });
              }
            } catch (error: any) {
              console.warn(`🔄 Token verification failed (${4 - retries}/3):`, error.message);

              if (retries > 1) {
                // Retry after delay (server might be restarting)
                setTimeout(() => verifyToken(retries - 1), 2000);
              } else {
                // After all retries failed, keep user logged in but show warning
                console.warn('⚠️ Server unreachable, keeping user logged in locally');
                // Don't logout - let user continue working
              }
            }
          };

          // Start background verification
          verifyToken();
        } else {
          dispatch({ type: 'SET_LOADING', payload: false });
        }
      } catch (error) {
        console.error('🚨 Auth initialization error:', error);
        dispatch({ type: 'SET_LOADING', payload: false });
      }
    };

    initializeAuth();
  }, []);

  // Login function
  const login = async (credentials: LoginCredentials): Promise<void> => {
    try {
      dispatch({ type: 'SET_LOADING', payload: true });
      
      const response = await authService.login(credentials);
      
      if (response.success && response.data) {
        const { user, token } = response.data;
        
        // Store in localStorage
        localStorage.setItem('token', token);
        localStorage.setItem('user', JSON.stringify(user));
        
        dispatch({
          type: 'LOGIN_SUCCESS',
          payload: { user, token },
        });
      } else {
        dispatch({ type: 'SET_LOADING', payload: false });
        throw new Error(response.message || 'Login failed');
      }
    } catch (error) {
      dispatch({ type: 'SET_LOADING', payload: false });
      throw error;
    }
  };

  // Register function
  const register = async (credentials: RegisterCredentials): Promise<void> => {
    try {
      dispatch({ type: 'SET_LOADING', payload: true });
      
      const response = await authService.register(credentials);
      
      if (response.success && response.data) {
        const { user, token } = response.data;
        
        // Store in localStorage
        localStorage.setItem('token', token);
        localStorage.setItem('user', JSON.stringify(user));
        
        dispatch({
          type: 'LOGIN_SUCCESS',
          payload: { user, token },
        });
      } else {
        dispatch({ type: 'SET_LOADING', payload: false });
        throw new Error(response.message || 'Registration failed');
      }
    } catch (error) {
      dispatch({ type: 'SET_LOADING', payload: false });
      throw error;
    }
  };

  // Logout function
  const logout = async (): Promise<void> => {
    try {
      await authService.logout();
    } catch (error) {
      console.error('🚨 Logout error:', error);
    } finally {
      dispatch({ type: 'LOGOUT' });
    }
  };

  const value: AuthContextType = {
    user: state.user,
    token: state.token,
    isAuthenticated: state.isAuthenticated,
    loading: state.loading,
    login,
    register,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

// Custom hook to use auth context
export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
