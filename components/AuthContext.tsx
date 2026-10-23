import React, { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/router";
import axios from "axios";
import SplashScreen from "./splash-screen";

interface User {
  id: number;
  email: string;
  name?: string;
  role: string;
  stockAccess: boolean;
  fasonAccess: boolean;
  mobileAccess?: boolean;
}

interface LicenseSummary {
  ok: boolean;
  mode: "off" | "warn" | "enforce";
  status: string;
  reason: string;
  checkedAt: string;
}

interface AuthContextType {
  user: User | null;
  license: LicenseSummary | null;
  licenseBlocked: boolean;
  loading: boolean;
  authenticated: boolean;
  error: string | null;
  checkAuth: () => Promise<void>;
  logout: () => void;
}

interface AuthProviderProps {
  children: ReactNode;
  requireAuth?: boolean;
  requiredAccess?: "stock" | "fason" | "both";
}

type AuthState = "checking" | "logging-in" | "logging-out" | "idle";

const AUTH_SPLASH_EVENT_KEY = "auth:splash-event";
const AUTH_SPLASH_DURATION_MS = 2500;

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};

export const AuthProvider: React.FC<AuthProviderProps> = ({
  children,
  requireAuth = true,
  requiredAccess,
}) => {
  const [user, setUser] = useState<User | null>(null);
  const [license, setLicense] = useState<LicenseSummary | null>(null);
  const [licenseBlocked, setLicenseBlocked] = useState(false);
  const [loading, setLoading] = useState(true);
  const [authenticated, setAuthenticated] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [authState, setAuthState] = useState<AuthState>("idle");
  const splashTimerRef = useRef<number | null>(null);
  const router = useRouter();

  const clearSplashTimer = useCallback(() => {
    if (splashTimerRef.current !== null) {
      window.clearTimeout(splashTimerRef.current);
      splashTimerRef.current = null;
    }
  }, []);

  const startLoginSplash = useCallback(() => {
    clearSplashTimer();
    setAuthState("logging-in");
    splashTimerRef.current = window.setTimeout(() => {
      setAuthState("idle");
      splashTimerRef.current = null;
    }, AUTH_SPLASH_DURATION_MS);
  }, [clearSplashTimer]);

  const isTokenExpired = useCallback((token: string): boolean => {
    try {
      const payload = JSON.parse(atob(token.split(".")[1]));
      return payload.exp < Date.now() / 1000;
    } catch {
      return true;
    }
  }, []);

  const checkUserAccess = useCallback((userData: User, access: string): boolean => {
    switch (access) {
      case "stock":
        return userData.stockAccess;
      case "fason":
        return userData.fasonAccess;
      case "both":
        return userData.stockAccess && userData.fasonAccess;
      default:
        return true;
    }
  }, []);

  const redirectToLogin = useCallback(() => {
    setAuthState("idle");
    router.push("/login");
  }, [router]);

  const checkAuth = useCallback(async () => {
    if (!requireAuth) {
      setLoading(false);
      setAuthenticated(true);
      setAuthState("idle");
      return;
    }

    setLoading(true);
    setError(null);
    setAuthState("checking");

    try {
      const token = localStorage.getItem("token");

      if (!token) {
        setUser(null);
        setLicense(null);
        setLicenseBlocked(false);
        setAuthenticated(false);
        redirectToLogin();
        return;
      }

      if (isTokenExpired(token)) {
        localStorage.removeItem("token");
        setUser(null);
        setLicense(null);
        setLicenseBlocked(false);
        setAuthenticated(false);
        redirectToLogin();
        return;
      }

      const response = await axios.get("/api/auth/me", {
        headers: { Authorization: `Bearer ${token}` },
      });

      const userData = response.data.user as User;
      const licenseData = (response.data?.license || null) as LicenseSummary | null;
      const isBlocked = Boolean(licenseData && licenseData.ok === false && licenseData.mode === "enforce");

      setUser(userData);
      setLicense(licenseData);
      setLicenseBlocked(isBlocked);

      if (requiredAccess) {
        const hasAccess = checkUserAccess(userData, requiredAccess);
        if (!hasAccess) {
          router.push("/");
          return;
        }
      }

      if (isBlocked && router.pathname !== "/license") {
        router.push("/license");
      }

      setAuthenticated(true);

      const pendingSplashEvent =
        typeof window !== "undefined" ? sessionStorage.getItem(AUTH_SPLASH_EVENT_KEY) : null;
      if (pendingSplashEvent === "login") {
        sessionStorage.removeItem(AUTH_SPLASH_EVENT_KEY);
        startLoginSplash();
      } else {
        setAuthState("idle");
      }
    } catch (authError) {
      console.error("Auth check failed:", authError);
      localStorage.removeItem("token");
      setUser(null);
      setLicense(null);
      setLicenseBlocked(false);
      setAuthenticated(false);
      redirectToLogin();
    } finally {
      setLoading(false);
    }
  }, [checkUserAccess, isTokenExpired, redirectToLogin, requireAuth, requiredAccess, router, startLoginSplash]);

  useEffect(() => {
    void checkAuth();
  }, [checkAuth]);

  useEffect(() => {
    return () => {
      clearSplashTimer();
    };
  }, [clearSplashTimer]);

  const logout = (): void => {
    clearSplashTimer();
    setAuthState("logging-out");
    localStorage.removeItem("token");
    setUser(null);
    setLicense(null);
    setLicenseBlocked(false);
    setAuthenticated(false);

    splashTimerRef.current = window.setTimeout(() => {
      setAuthState("idle");
      router.push("/login");
      splashTimerRef.current = null;
    }, AUTH_SPLASH_DURATION_MS);
  };

  if (authState === "logging-in" || authState === "logging-out") {
    return (
      <SplashScreen
        autoHide={false}
        isLogout={authState === "logging-out"}
        onHide={() => setAuthState("idle")}
      />
    );
  }

  if (loading) {
    return (
      <div style={styles.loadingContainer}>
        <div style={styles.loadingSpinner} />
        <p style={styles.loadingText}>Kimlik dogrulama kontrol ediliyor...</p>
      </div>
    );
  }

  if (!authenticated && requireAuth) {
    return null;
  }

  return (
    <AuthContext.Provider
      value={{ user, license, licenseBlocked, loading, authenticated, error, checkAuth, logout }}
    >
      {children}
    </AuthContext.Provider>
  );
};

const styles = {
  loadingContainer: {
    minHeight: "100vh",
    display: "flex",
    flexDirection: "column" as const,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#f8f9fa",
    fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
  },
  loadingSpinner: {
    width: "40px",
    height: "40px",
    border: "4px solid #e3f2fd",
    borderTop: "4px solid #1976d2",
    borderRadius: "50%",
    animation: "spin 1s linear infinite",
  },
  loadingText: {
    marginTop: "1rem",
    color: "#6c757d",
    fontSize: "1rem",
  },
};

if (typeof document !== "undefined" && !document.getElementById("auth-context-spin-style")) {
  const style = document.createElement("style");
  style.id = "auth-context-spin-style";
  style.textContent = `
    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }
  `;
  document.head.appendChild(style);
}
