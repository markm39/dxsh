import { useState, useEffect } from 'react';

interface AuthState {
  authHeaders: Record<string, string>;
  isAuthenticated: boolean;
  login: (token: string) => void;
  logout: () => void;
}

export const useAuth = (): AuthState => {
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

  return {
    authHeaders,
    isAuthenticated,
    login,
    logout,
  };
};

export default useAuth;