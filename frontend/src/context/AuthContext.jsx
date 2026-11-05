import { useCallback, useEffect, useMemo, useState } from 'react';
import AuthContext from './authContext';
import { authApi } from '../services/api';

const TOKEN_STORAGE_KEY = 'nearby_places_token';
const USER_STORAGE_KEY = 'nearby_places_user';

export function AuthProvider({ children }) {
  const [token, setTokenState] = useState(() => localStorage.getItem(TOKEN_STORAGE_KEY) || '');
  const [user, setUserState] = useState(null);
  const [isLoading, setIsLoading] = useState(() => Boolean(localStorage.getItem(TOKEN_STORAGE_KEY)));

  const setToken = useCallback((nextToken) => {
    setTokenState(nextToken);
    if (nextToken) {
      localStorage.setItem(TOKEN_STORAGE_KEY, nextToken);
    } else {
      localStorage.removeItem(TOKEN_STORAGE_KEY);
    }
  }, []);

  const setUser = useCallback((nextUser) => {
    setUserState(nextUser);
    if (nextUser) {
      localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(nextUser));
    } else {
      localStorage.removeItem(USER_STORAGE_KEY);
    }
  }, []);

  useEffect(() => {
    let active = true;

    if (!token) return undefined;
    authApi
      .currentUser()
      .then((currentUser) => {
        if (active) setUser(currentUser);
      })
      .catch(() => {
        if (active) {
          setToken('');
          setUser(null);
        }
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });

    return () => {
      active = false;
    };
  }, [setToken, setUser, token]);

  const login = useCallback(async (credentials) => {
    const response = await authApi.login(credentials);
    setToken(response.access_token);
    setUser(response.user);
    return response.user;
  }, [setToken, setUser]);

  const register = useCallback(async (details) => {
    await authApi.register(details);
    return login({ email: details.email, password: details.password });
  }, [login]);

  const logout = useCallback(() => {
    setToken('');
    setUser(null);
  }, [setToken, setUser]);

  const value = useMemo(
    () => ({
      user,
      token,
      isLoading,
      isAuthenticated: Boolean(token && user),
      login,
      register,
      logout,
    }),
    [isLoading, login, logout, register, token, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
