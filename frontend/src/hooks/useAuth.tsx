import { useState, useEffect, createContext, useContext, ReactNode } from 'react';

interface AuthState {
  authHeaders: Record<string, string>;
  isAuthenticated: boolean;
  login: (token: string) => void;
  logout: () => void;
}

interface AuthContextType extends AuthState {}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [token, setToken] = useState<string | null>(
    localStorage.getItem('workflow-token')
  );

  const authHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(token && { 'Authorization': `Bearer ${token}` }),
  };

  const isAuthenticated = !!token;

  const login = (newToken: string) => {
    setToken(newToken);
    localStorage.setItem('workflow-token', newToken);
  };

  const logout = () => {
    setToken(null);
    localStorage.removeItem('workflow-token');
  };

  const value = {
    authHeaders,
    isAuthenticated,
    login,
    logout,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthState => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export default useAuth;