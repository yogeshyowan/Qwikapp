import { useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { Loader2, Terminal } from "lucide-react";
import { useAuth } from "@/contexts/auth-context";

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: {
            client_id: string;
            callback: (response: { credential: string }) => void;
            auto_select?: boolean;
          }) => void;
          renderButton: (
            parent: HTMLElement,
            options: Record<string, unknown>
          ) => void;
          prompt: () => void;
        };
      };
    };
  }
}

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined;

export default function Login() {
  const { login, isLoading, user } = useAuth();
  const [, navigate] = useLocation();
  const [error, setError] = useState<string | null>(null);
  const [signing, setSigning] = useState(false);
  const btnRef = useRef<HTMLDivElement>(null);

  // If already authenticated, redirect home
  useEffect(() => {
    if (!isLoading && user) navigate("/");
  }, [isLoading, user, navigate]);

  // Mount Google button once GSI script is ready
  useEffect(() => {
    if (!CLIENT_ID) return;
    let attempts = 0;

    const tryMount = () => {
      if (window.google?.accounts?.id && btnRef.current) {
        window.google.accounts.id.initialize({
          client_id: CLIENT_ID,
          callback: async ({ credential }) => {
            setSigning(true);
            setError(null);
            try {
              await login(credential);
              navigate("/");
            } catch {
              setError("Sign-in failed. Please try again.");
            } finally {
              setSigning(false);
            }
          },
          auto_select: false,
        });
        window.google.accounts.id.renderButton(btnRef.current, {
          theme: "outline",
          size: "large",
          width: 280,
          text: "signin_with",
        });
      } else if (attempts < 20) {
        attempts++;
        setTimeout(tryMount, 300);
      }
    };

    tryMount();
  }, [login, navigate]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-8">
        {/* Logo */}
        <div className="text-center space-y-2">
          <div className="inline-flex h-14 w-14 items-center justify-center rounded-xl bg-primary/10 border border-primary/30 mb-2">
            <Terminal className="h-7 w-7 text-primary" />
          </div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">
            Welcome to QwikIDE
          </h1>
          <p className="text-sm text-muted-foreground">
            Sign in to start building AI-powered apps
          </p>
        </div>

        {/* Card */}
        <div className="bg-white border border-border rounded-2xl p-8 shadow-sm space-y-6">
          {/* Plans preview */}
          <div className="space-y-2.5">
            {[
              { name: "Free", desc: "$1 token credit to get started" },
              { name: "Standard", desc: "₹499/mo · $5 credit + pay-as-you-go" },
              { name: "Pro", desc: "₹999/mo · $10 credit + pay-as-you-go" },
            ].map((plan) => (
              <div
                key={plan.name}
                className="flex items-center gap-3 text-sm text-muted-foreground"
              >
                <div className="h-1.5 w-1.5 rounded-full bg-primary shrink-0" />
                <span>
                  <span className="font-semibold text-foreground">{plan.name}</span>{" "}
                  — {plan.desc}
                </span>
              </div>
            ))}
          </div>

          <div className="border-t border-border" />

          {/* Google button */}
          <div className="flex flex-col items-center gap-3">
            {!CLIENT_ID && (
              <p className="text-xs text-destructive text-center">
                VITE_GOOGLE_CLIENT_ID is not configured.
              </p>
            )}

            {signing ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground h-10">
                <Loader2 className="h-4 w-4 animate-spin" />
                Signing in…
              </div>
            ) : (
              <div ref={btnRef} className="flex justify-center" />
            )}

            {error && (
              <p className="text-xs text-destructive text-center">{error}</p>
            )}
          </div>

          <p className="text-[11px] text-muted-foreground/60 text-center leading-relaxed">
            By signing in you agree to our terms of service. Token usage is
            billed at 2× our Claude API cost.
          </p>
        </div>
      </div>
    </div>
  );
}
