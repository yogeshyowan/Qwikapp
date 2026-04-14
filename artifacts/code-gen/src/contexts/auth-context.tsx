import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

const TOKEN_KEY = "qwikide_auth_token";

export interface AuthUser {
  id: number;
  email: string;
  name: string;
  picture: string | null;
}

export interface Subscription {
  plan: "free" | "standard" | "pro";
  creditMicrodollars: number;
  expiresAt: string | null;
}

interface AuthState {
  user: AuthUser | null;
  subscription: Subscription | null;
  isLoading: boolean;
  token: string | null;
}

interface AuthContext extends AuthState {
  login: (credential: string) => Promise<void>;
  logout: () => void;
  refreshSubscription: () => Promise<void>;
}

const Ctx = createContext<AuthContext | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    subscription: null,
    isLoading: true,
    token: null,
  });

  // On mount, validate stored token
  useEffect(() => {
    const stored = localStorage.getItem(TOKEN_KEY);
    if (!stored) {
      setState((s) => ({ ...s, isLoading: false }));
      return;
    }
    fetchMe(stored)
      .then(({ user, subscription }) => {
        setState({ user, subscription, isLoading: false, token: stored });
      })
      .catch(() => {
        localStorage.removeItem(TOKEN_KEY);
        setState({ user: null, subscription: null, isLoading: false, token: null });
      });
  }, []);

  const login = useCallback(async (credential: string) => {
    const res = await fetch("/api/auth/google", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ credential }),
    });
    if (!res.ok) throw new Error("Google sign-in failed");
    const data = (await res.json()) as { token: string; user: AuthUser };
    localStorage.setItem(TOKEN_KEY, data.token);

    // Fetch full me to get subscription
    const { user, subscription } = await fetchMe(data.token);
    setState({ user, subscription, isLoading: false, token: data.token });
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    setState({ user: null, subscription: null, isLoading: false, token: null });
  }, []);

  const refreshSubscription = useCallback(async () => {
    const t = state.token ?? localStorage.getItem(TOKEN_KEY);
    if (!t) return;
    const { subscription } = await fetchMe(t);
    setState((s) => ({ ...s, subscription }));
  }, [state.token]);

  return (
    <Ctx.Provider value={{ ...state, login, logout, refreshSubscription }}>
      {children}
    </Ctx.Provider>
  );
}

export function useAuth(): AuthContext {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}

/** Exported so live-builder can attach auth header to SSE requests */
export function getStoredToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

async function fetchMe(
  token: string
): Promise<{ user: AuthUser; subscription: Subscription | null }> {
  const res = await fetch("/api/auth/me", {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error("Not authenticated");
  return res.json() as Promise<{ user: AuthUser; subscription: Subscription | null }>;
}
