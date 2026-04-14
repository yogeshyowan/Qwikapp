import { useState } from "react";
import { CheckCircle2, Loader2, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/auth-context";
import { useToast } from "@/hooks/use-toast";
import { getStoredToken } from "@/contexts/auth-context";

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => {
      open: () => void;
      on: (event: string, handler: () => void) => void;
    };
  }
}

interface Plan {
  id: string;
  name: string;
  priceDisplay: string;
  originalPriceDisplay: string | null;
  creditUsd: number;
  description: string;
  features: string[];
}

const PLAN_HIGHLIGHT: Record<string, boolean> = { standard: true };

export default function Billing() {
  const { subscription, user, refreshSubscription } = useAuth();
  const { toast } = useToast();
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);

  const plans: Plan[] = [
    {
      id: "free",
      name: "Free",
      priceDisplay: "Free",
      originalPriceDisplay: null,
      creditUsd: 1,
      description: "Get started with $1 token credit",
      features: [
        "$1 token credit (one-time)",
        "Build unlimited projects",
        "Subdomain preview (app-N.qwikorder.site)",
        "Community support",
      ],
    },
    {
      id: "standard",
      name: "Standard",
      priceDisplay: "₹499/mo",
      originalPriceDisplay: "₹1,599",
      creditUsd: 5,
      description: "$5 token credit + pay-as-you-go",
      features: [
        "$5 token credit per month",
        "Pay-as-you-go after credit runs out",
        "Priority build queue",
        "Email support",
      ],
    },
    {
      id: "pro",
      name: "Pro",
      priceDisplay: "₹999/mo",
      originalPriceDisplay: null,
      creditUsd: 10,
      description: "$10 token credit + pay-as-you-go",
      features: [
        "$10 token credit per month",
        "Pay-as-you-go after credit runs out",
        "Fastest build priority",
        "Dedicated support",
      ],
    },
  ];

  const handleSubscribe = async (planId: string) => {
    if (planId === "free" || !user) return;
    setLoadingPlan(planId);

    try {
      const token = getStoredToken();
      const orderRes = await fetch("/api/billing/create-order", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ plan: planId }),
      });

      if (!orderRes.ok) {
        const err = await orderRes.json() as { error: string };
        throw new Error(err.error ?? "Failed to create order");
      }

      const order = await orderRes.json() as {
        orderId: string;
        amount: number;
        currency: string;
        keyId: string;
        planName: string;
      };

      // Load Razorpay SDK if not already loaded
      if (!window.Razorpay) {
        await new Promise<void>((resolve, reject) => {
          const s = document.createElement("script");
          s.src = "https://checkout.razorpay.com/v1/checkout.js";
          s.onload = () => resolve();
          s.onerror = () => reject(new Error("Failed to load Razorpay"));
          document.head.appendChild(s);
        });
      }

      await new Promise<void>((resolve, reject) => {
        const rzp = new window.Razorpay!({
          key: order.keyId,
          amount: order.amount,
          currency: order.currency,
          name: "QwikIDE",
          description: `${order.planName} Plan`,
          order_id: order.orderId,
          prefill: { email: user.email, name: user.name },
          theme: { color: "#059669" },
          handler: async (response: {
            razorpay_order_id: string;
            razorpay_payment_id: string;
            razorpay_signature: string;
          }) => {
            try {
              const verifyRes = await fetch("/api/billing/verify-payment", {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({ ...response, plan: planId }),
              });

              if (!verifyRes.ok) {
                throw new Error("Payment verification failed");
              }

              await refreshSubscription();
              toast({
                title: "Subscription activated!",
                description: `${order.planName} plan is now active.`,
              });
              resolve();
            } catch (err) {
              reject(err);
            }
          },
        });

        rzp.on("payment.failed", () => {
          reject(new Error("Payment failed"));
        });

        rzp.open();
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Payment failed";
      toast({ title: "Payment failed", description: msg, variant: "destructive" });
    } finally {
      setLoadingPlan(null);
    }
  };

  const creditUsd = subscription
    ? (subscription.creditMicrodollars / 1_000_000).toFixed(4)
    : "0.0000";

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">Billing & Plans</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Token usage is billed at 2× our Claude API cost. 1 USD of our cost = 2 USD charged to you.
        </p>
      </div>

      {/* Current balance */}
      {subscription && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-5 flex items-center gap-4">
          <div className="h-10 w-10 rounded-full bg-emerald-100 border border-emerald-300 flex items-center justify-center">
            <Zap className="h-5 w-5 text-emerald-600" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-emerald-800">
              Current plan:{" "}
              <span className="capitalize">{subscription.plan}</span>
            </p>
            <p className="text-xs text-emerald-700 mt-0.5">
              ${creditUsd} token credit remaining
              {subscription.expiresAt && (
                <> · Renews {new Date(subscription.expiresAt).toLocaleDateString()}</>
              )}
            </p>
          </div>
        </div>
      )}

      {/* Plans */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {plans.map((plan) => {
          const isCurrent = subscription?.plan === plan.id;
          const isHighlighted = PLAN_HIGHLIGHT[plan.id];
          const isLoading = loadingPlan === plan.id;

          return (
            <div
              key={plan.id}
              className={`relative rounded-2xl border p-6 flex flex-col gap-4 bg-white
                ${isHighlighted
                  ? "border-primary shadow-md shadow-primary/10"
                  : "border-border"
                }`}
            >
              {isHighlighted && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="bg-primary text-white text-[10px] font-bold px-3 py-1 rounded-full tracking-wider uppercase">
                    Most Popular
                  </span>
                </div>
              )}

              <div>
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                  {plan.name}
                </p>
                <div className="flex items-baseline gap-2 mt-1">
                  <span className="text-2xl font-bold text-foreground">
                    {plan.priceDisplay}
                  </span>
                  {plan.originalPriceDisplay && (
                    <span className="text-sm text-muted-foreground line-through">
                      {plan.originalPriceDisplay}
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {plan.description}
                </p>
              </div>

              <ul className="space-y-2 flex-1">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-xs text-foreground">
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 mt-0.5 shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>

              {plan.id === "free" ? (
                <Button
                  variant="outline"
                  className="w-full mt-2"
                  disabled
                >
                  {isCurrent ? "Current Plan" : "Free Forever"}
                </Button>
              ) : (
                <Button
                  className="w-full mt-2"
                  variant={isHighlighted ? "default" : "outline"}
                  disabled={isCurrent || isLoading}
                  onClick={() => handleSubscribe(plan.id)}
                >
                  {isLoading ? (
                    <><Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" /> Processing…</>
                  ) : isCurrent ? (
                    "Current Plan"
                  ) : (
                    `Subscribe — ${plan.priceDisplay}`
                  )}
                </Button>
              )}
            </div>
          );
        })}
      </div>

      {/* Pricing note */}
      <div className="bg-gray-50 border border-border rounded-xl p-5 text-xs text-muted-foreground space-y-1">
        <p className="font-semibold text-foreground text-sm">How token billing works</p>
        <p>We use Claude Sonnet by Anthropic. Our cost: $3/M input tokens, $15/M output tokens.</p>
        <p>You are charged at <strong>2× our cost</strong>. After your monthly credit is used up, builds continue on pay-as-you-go at the same 2× rate.</p>
        <p>After each build, you&apos;ll see exactly how many tokens were used and how much was charged.</p>
      </div>
    </div>
  );
}
