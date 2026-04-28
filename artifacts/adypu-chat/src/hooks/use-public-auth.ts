import { useState, useEffect, useCallback, createContext, useContext } from "react";

const PUBLIC_TOKEN_KEY = "adypu_user_token";
const PUBLIC_USER_KEY = "adypu_user_info";

export interface PublicUser {
  id: number;
  username: string;
  role: string;
}

export interface PublicAuthState {
  token: string | null;
  user: PublicUser | null;
  isReady: boolean;
  isAuthenticated: boolean;
  login: (token: string, user: PublicUser) => void;
  logout: () => void;
}

export function createPublicAuth(): PublicAuthState {
  throw new Error("Must be used within PublicAuthProvider");
}

import { type ReactNode } from "react";
import React from "react";

export const PublicAuthContext = createContext<PublicAuthState>({
  token: null,
  user: null,
  isReady: false,
  isAuthenticated: false,
  login: () => {},
  logout: () => {},
});

export function PublicAuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<PublicUser | null>(null);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const storedToken = localStorage.getItem(PUBLIC_TOKEN_KEY);
    const storedUser = localStorage.getItem(PUBLIC_USER_KEY);
    if (storedToken && storedUser) {
      try {
        setToken(storedToken);
        setUser(JSON.parse(storedUser));
      } catch {
        localStorage.removeItem(PUBLIC_TOKEN_KEY);
        localStorage.removeItem(PUBLIC_USER_KEY);
      }
    }
    setIsReady(true);
  }, []);

  const login = useCallback((newToken: string, newUser: PublicUser) => {
    localStorage.setItem(PUBLIC_TOKEN_KEY, newToken);
    localStorage.setItem(PUBLIC_USER_KEY, JSON.stringify(newUser));
    setToken(newToken);
    setUser(newUser);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(PUBLIC_TOKEN_KEY);
    localStorage.removeItem(PUBLIC_USER_KEY);
    setToken(null);
    setUser(null);
  }, []);

  return React.createElement(
    PublicAuthContext.Provider,
    { value: { token, user, isReady, isAuthenticated: !!token, login, logout } },
    children
  );
}

export function usePublicAuth() {
  return useContext(PublicAuthContext);
}

export function getPublicAuthHeaders(): Record<string, string> {
  const token = localStorage.getItem(PUBLIC_TOKEN_KEY);
  return token ? { Authorization: `Bearer ${token}` } : {};
}
