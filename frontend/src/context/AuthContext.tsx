import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, UserRole } from '../types';
import { authService, familyAccessService } from '../services/api';
import toast from 'react-hot-toast';

interface AuthContextType {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  seniorMode: boolean;
  selectedPatientId: number | null;
  setSelectedPatientId: (id: number | null) => void;
  toggleSeniorMode: () => void;
  login: (email: string, password: string) => Promise<User>;
  register: (userData: any) => Promise<User>;
  logout: () => void;
  quickDemoLogin: (role: UserRole) => Promise<User>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(() => {
    const saved = localStorage.getItem('carebridge_user');
    return saved ? JSON.parse(saved) : null;
  });
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('carebridge_token'));
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [seniorMode, setSeniorMode] = useState<boolean>(() => {
    return localStorage.getItem('carebridge_senior_mode') === 'true';
  });
  const [selectedPatientId, setSelectedPatientId] = useState<number | null>(null);

  // Auto-initialize selected patient for Family and Caregiver roles
  useEffect(() => {
    const initPatient = async () => {
      if (user && (user.role === 'family' || user.role === 'caregiver') && token) {
        try {
          const patients = await familyAccessService.getConnectedPatients();
          if (patients.length > 0) {
            setSelectedPatientId((prev) => prev ?? patients[0].elder_id);
          }
        } catch (e) {
          console.error('Error auto-selecting patient:', e);
        }
      }
    };
    initPatient();
  }, [user, token]);

  // Apply senior mode class to body
  useEffect(() => {
    if (seniorMode) {
      document.body.classList.add('senior-mode');
    } else {
      document.body.classList.remove('senior-mode');
    }
    localStorage.setItem('carebridge_senior_mode', seniorMode ? 'true' : 'false');
  }, [seniorMode]);

  const toggleSeniorMode = () => {
    setSeniorMode((prev) => !prev);
    toast.success(!seniorMode ? 'Large text & high-contrast mode enabled' : 'Standard view restored', {
      icon: '👁️',
      duration: 2500
    });
  };

  const refreshUser = async () => {
    try {
      if (token) {
        const freshUser = await authService.getCurrentUser();
        setUser(freshUser);
        localStorage.setItem('carebridge_user', JSON.stringify(freshUser));
      }
    } catch (e) {
      console.error('Error refreshing user:', e);
    }
  };

  useEffect(() => {
    const initAuth = async () => {
      const storedToken = localStorage.getItem('carebridge_token');
      if (storedToken) {
        try {
          const u = await authService.getCurrentUser();
          setUser(u);
          localStorage.setItem('carebridge_user', JSON.stringify(u));
        } catch (err) {
          console.error('Failed to validate token on load:', err);
          localStorage.removeItem('carebridge_token');
          localStorage.removeItem('carebridge_user');
          setUser(null);
          setToken(null);
        }
      }
      setIsLoading(false);
    };
    initAuth();
  }, []);

  const login = async (email: string, password: string): Promise<User> => {
    setIsLoading(true);
    try {
      const data = await authService.login({ email, password });
      setToken(data.access_token);
      setUser(data.user);
      localStorage.setItem('carebridge_token', data.access_token);
      localStorage.setItem('carebridge_user', JSON.stringify(data.user));
      toast.success(`Welcome back, ${data.user.full_name}!`);
      return data.user;
    } catch (err: any) {
      const msg = err.response?.data?.detail || 'Login failed. Please check your credentials.';
      toast.error(msg);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const register = async (userData: any): Promise<User> => {
    setIsLoading(true);
    try {
      const data = await authService.register(userData);
      setToken(data.access_token);
      setUser(data.user);
      localStorage.setItem('carebridge_token', data.access_token);
      localStorage.setItem('carebridge_user', JSON.stringify(data.user));
      toast.success('Account created successfully!');
      return data.user;
    } catch (err: any) {
      const msg = err.response?.data?.detail || 'Registration failed.';
      toast.error(msg);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    localStorage.removeItem('carebridge_token');
    localStorage.removeItem('carebridge_user');
    setToken(null);
    setUser(null);
    setSelectedPatientId(null);
    toast.success('Signed out safely.');
  };

  const quickDemoLogin = async (role: UserRole): Promise<User> => {
    const creds = {
      elderly: { email: 'eleanor@carebridge.com', password: 'Password123!' },
      family: { email: 'sarah@carebridge.com', password: 'Password123!' },
      caregiver: { email: 'david@carebridge.com', password: 'Password123!' },
    }[role];

    return await login(creds.email, creds.password);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated: !!user && !!token,
        isLoading,
        seniorMode,
        selectedPatientId,
        setSelectedPatientId,
        toggleSeniorMode,
        login,
        register,
        logout,
        quickDemoLogin,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

