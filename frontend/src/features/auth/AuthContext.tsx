import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { apiRequest } from "../../lib/api";
import type { AuthUser, TokenPair } from "./types";

type AuthStatus = "loading" | "authenticated" | "anonymous";

type AuthContextValue = {
  accessToken: string | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  status: AuthStatus;
  user: AuthUser | null;
};

type StoredTokens = {
  accessToken: string;
  refreshToken: string;
};

const ACCESS_TOKEN_KEY = "clinica.accessToken";
const REFRESH_TOKEN_KEY = "clinica.refreshToken";

const AuthContext = createContext<AuthContextValue | null>(null);

function readStoredTokens(): StoredTokens | null {
  const accessToken = window.localStorage.getItem(ACCESS_TOKEN_KEY);
  const refreshToken = window.localStorage.getItem(REFRESH_TOKEN_KEY);

  if (!accessToken || !refreshToken) {
    return null;
  }

  return { accessToken, refreshToken };
}

function storeTokens(tokens: TokenPair) {
  window.localStorage.setItem(ACCESS_TOKEN_KEY, tokens.access_token);
  window.localStorage.setItem(REFRESH_TOKEN_KEY, tokens.refresh_token);
}

function clearStoredTokens() {
  window.localStorage.removeItem(ACCESS_TOKEN_KEY);
  window.localStorage.removeItem(REFRESH_TOKEN_KEY);
}

async function requestCurrentUser(accessToken: string) {
  return apiRequest<AuthUser>("/auth/me", { token: accessToken });
}

async function requestTokenRefresh(refreshToken: string) {
  return apiRequest<TokenPair>("/auth/refresh", {
    method: "POST",
    body: JSON.stringify({ refresh_token: refreshToken }),
  });
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [user, setUser] = useState<AuthUser | null>(null);

  const clearSession = useCallback(() => {
    clearStoredTokens();
    setAccessToken(null);
    setUser(null);
    setStatus("anonymous");
  }, []);

  const restoreSession = useCallback(async () => {
    const storedTokens = readStoredTokens();

    if (!storedTokens) {
      clearSession();
      return;
    }

    try {
      const currentUser = await requestCurrentUser(storedTokens.accessToken);
      setAccessToken(storedTokens.accessToken);
      setUser(currentUser);
      setStatus("authenticated");
      return;
    } catch {
      // Try one refresh before asking the user to sign in again.
    }

    try {
      const refreshedTokens = await requestTokenRefresh(storedTokens.refreshToken);
      storeTokens(refreshedTokens);
      const currentUser = await requestCurrentUser(refreshedTokens.access_token);
      setAccessToken(refreshedTokens.access_token);
      setUser(currentUser);
      setStatus("authenticated");
    } catch {
      clearSession();
    }
  }, [clearSession]);

  useEffect(() => {
    void restoreSession();
  }, [restoreSession]);

  const login = useCallback(async (email: string, password: string) => {
    setStatus("loading");

    try {
      const tokens = await apiRequest<TokenPair>("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
      storeTokens(tokens);
      const currentUser = await requestCurrentUser(tokens.access_token);
      setAccessToken(tokens.access_token);
      setUser(currentUser);
      setStatus("authenticated");
    } catch (error) {
      clearSession();
      throw error;
    }
  }, [clearSession]);

  const logout = useCallback(() => {
    clearSession();
  }, [clearSession]);

  const value = useMemo<AuthContextValue>(
    () => ({
      accessToken,
      login,
      logout,
      status,
      user,
    }),
    [accessToken, login, logout, status, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth deve ser usado dentro de AuthProvider");
  }

  return context;
}
