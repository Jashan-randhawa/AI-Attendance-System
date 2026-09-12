import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { authApi, setAuthToken, getAuthToken, type UserProfile } from "@/services/api";

interface AuthContextType {
  user: UserProfile | null;
  token: string | null;
  role: "admin" | "operator" | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<UserProfile>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [token, setTokenState] = useState<string | null>(getAuthToken());
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const logout = useCallback(() => {
    setAuthToken(null);
    setTokenState(null);
    setUser(null);
  }, []);

  const bootstrap = useCallback(async () => {
    const currentToken = getAuthToken();
    if (!currentToken) {
      setIsLoading(false);
      return;
    }
    try {
      const profile = await authApi.me();
      setUser(profile);
      setTokenState(currentToken);
    } catch {
      logout();
    } finally {
      setIsLoading(false);
    }
  }, [logout]);

  useEffect(() => {
    bootstrap();
  }, [bootstrap]);

  const login = async (username: string, password: string): Promise<UserProfile> => {
    const res = await authApi.login({ username, password });
    setTokenState(res.access_token);
    const profile = await authApi.me();
    setUser(profile);
    return profile;
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        role: user?.role ?? null,
        isAuthenticated: !!user,
        isLoading,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
