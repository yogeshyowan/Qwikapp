import { CheckCircle2, Loader2, Sparkles, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export type PlanId = "free" | "standard" | "pro";

export interface Plan {
  id: PlanId;
  name: string;
  priceDisplay: string;
  originalPriceDisplay: string | null;
  creditUsd: number;
  description: string;
  features: string[];
}

export const PLANS: Plan[] = [
  {
    id: "free",
    name: "Free",
    priceDisplay: "Free",
    originalPriceDisplay: null,
    creditUsd: 1,
    description: "Start with $1 token credit",
    features: [
      "$1 starter build credit",
      "AI project creation workspace",
      "Sandbox preview page",
      "Publish to qwikorder.site sub-page",
    ],
  },
  {
    id: "standard",
    name: "Standard",
    priceDisplay: "₹499/mo",
    originalPriceDisplay: "₹1,599",
    creditUsd: 5,
    description: "$5 token credit + publish workflow",
    features: [
      "$5 monthly build credit",
      "Priority AI generation",
      "Publish bundle workflow",
      "Security bundle check",
    ],
  },
  {
    id: "pro",
    name: "Pro",
    priceDisplay: "₹999/mo",
    originalPriceDisplay: null,
    creditUsd: 10,
    description: "$10 token credit for heavier builds",
    features: [
      "$10 monthly build credit",
      "Fastest project creation queue",
      "Promote-all publishing",
      "Dedicated app previews",
    ],
  },
];

export function rememberSelectedPlan(planId: PlanId) {
  localStorage.setItem("qwikide_selected_plan", planId);
}

export function getRememberedPlan(): PlanId | null {
  const saved = localStorage.getItem("qwikide_selected_plan");
  return saved === "free" || saved === "standard" || saved === "pro" ? saved : null;
}

interface PlanSelectionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectPlan: (planId: PlanId) => void | Promise<void>;
  loadingPlan?: string | null;
  title?: string;
  description?: string;
}

export function PlanSelectionDialog({
  open,
  onOpenChange,
  onSelectPlan,
  loadingPlan,
  title = "Choose a plan to create your project",
  description = "Select a plan first, then continue into the AI project builder.",
}: PlanSelectionDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl p-0 overflow-hidden">
        <div className="bg-[#0b0f14] text-white px-6 py-5 border-b border-white/10">
          <DialogHeader>
            <div className="flex items-center gap-2 text-emerald-300 text-xs font-bold uppercase tracking-[0.24em]">
              <Sparkles className="h-4 w-4" />
              Qwikorder.site builder access
            </div>
            <DialogTitle className="text-2xl text-white">{title}</DialogTitle>
            <DialogDescription className="text-slate-300">
              {description}
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-5 bg-white">
          {PLANS.map((plan) => {
            const highlighted = plan.id === "standard";
            const loading = loadingPlan === plan.id;
            return (
              <div
                key={plan.id}
                className={`relative rounded-2xl border p-5 flex flex-col gap-4 ${
                  highlighted
                    ? "border-primary shadow-lg shadow-primary/10"
                    : "border-border"
                }`}
              >
                {highlighted && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span className="rounded-full bg-primary px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-white">
                      Recommended
                    </span>
                  </div>
                )}

                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    {plan.name}
                  </p>
                  <div className="mt-1 flex items-baseline gap-2">
                    <span className="text-2xl font-bold text-foreground">
                      {plan.priceDisplay}
                    </span>
                    {plan.originalPriceDisplay && (
                      <span className="text-sm text-muted-foreground line-through">
                        {plan.originalPriceDisplay}
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {plan.description}
                  </p>
                </div>

                <ul className="flex-1 space-y-2">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2 text-xs">
                      <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-500" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>

                <Button
                  className="w-full gap-2"
                  variant={highlighted ? "default" : "outline"}
                  disabled={!!loadingPlan}
                  onClick={() => onSelectPlan(plan.id)}
                >
                  {loading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Processing…
                    </>
                  ) : (
                    <>
                      <Zap className="h-4 w-4" />
                      Select {plan.name}
                    </>
                  )}
                </Button>
              </div>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}