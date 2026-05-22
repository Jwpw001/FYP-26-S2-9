import React, { createContext, useContext, useState, useEffect } from 'react';
import { apiLogin, apiLogout } from '../services/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser]       = useState(null);   // { id, name, email, role }
  const [token, setToken]     = useState(() => localStorage.getItem('krewby_token'));
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');

  // If a token exists on load, treat as logged in
  // In production: call GET /api/auth/me here to validate
  useEffect(() => {
    if (token) {
      // Placeholder: once /api/auth/me is ready, fetch the real user here
      // For now keep whatever was stored
    }
  }, [token]);

  const login = async (email, password) => {
    setLoading(true);
    setError('');
    try {
      const data = await apiLogin(email, password);
      // Backend returns: { success, token, user: { id, name, email, role } }
      if (data.token && data.user) {
        setToken(data.token);
        setUser(data.user);
        return { success: true, role: data.user.role };
      }
      // Backend stub (no real auth yet) — allow demo login
      if (data.success) {
        const demoUser = { id: 'demo', name: email.split('@')[0], email, role: 'manager' };
        setUser(demoUser);
        return { success: true, role: 'manager' };
      }
      throw new Error(data.message || 'Login failed');
    } catch (err) {
      // If backend is offline, fall back to demo mode
      if (err.message.includes('Failed to fetch') || err.message.includes('NetworkError')) {
        const demoUser = { id: 'demo', name: email.split('@')[0], email, role: 'manager' };
        setUser(demoUser);
        return { success: true, role: 'manager', demo: true };
      }
      setError(err.message || 'Login failed. Please try again.');
      return { success: false };
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    apiLogout();
    setUser(null);
    setToken(null);
  };

  return (
    <AuthContext.Provider value={{ user, token, loading, error, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
