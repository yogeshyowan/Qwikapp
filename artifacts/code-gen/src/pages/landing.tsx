import { useState } from "react";
import { Link, useLocation } from "wouter";
import {
  ArrowRight,
  CheckCircle2,
  Code2,
  Globe2,
  Layers3,
  Rocket,
  ShieldCheck,
  Sparkles,
  Terminal,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/auth-context";
import {
  type PlanId,
  PlanSelectionDialog,
  rememberSelectedPlan,
} from "@/components/plan-selection-dialog";

export default function Landing() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const [plansOpen, setPlansOpen] = useState(false);

  const handlePlan = (planId: PlanId) => {
    rememberSelectedPlan(planId);
    setPlansOpen(false);
    setLocation(user ? "/projects/new" : "/login?next=/projects/new");
  };

  return (
    <div className="min-h-screen bg-[#05070a] text-white overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.22),transparent_34%),radial-gradient(circle_at_80%_20%,rgba(59,130,246,0.18),transparent_28%)]" />
      <div className="relative">
        <header className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-emerald-400/30 bg-emerald-400/10">
              <Terminal className="h-5 w-5 text-emerald-300" />
            </div>
            <div>
              <p className="text-sm font-bold tracking-[0.22em] text-emerald-300">QWIKORDER</p>
              <p className="text-[11px] text-slate-400">qwikorder.site</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {user ? (
              <Link href="/dashboard">
                <Button variant="outline" className="border-white/15 bg-white/5 text-white hover:bg-white/10">
                  Dashboard
                </Button>
              </Link>
            ) : (
              <Link href="/login">
                <Button variant="ghost" className="text-slate-200 hover:bg-white/10 hover:text-white">
                  Sign in
                </Button>
              </Link>
            )}
            <Button onClick={() => setPlansOpen(true)} className="gap-2">
              Create project
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </header>

        <main className="mx-auto grid max-w-7xl grid-cols-1 items-center gap-12 px-6 pb-20 pt-10 lg:grid-cols-[1.02fr_0.98fr]">
          <section className="space-y-8">
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-300/20 bg-emerald-300/10 px-3 py-1 text-xs font-semibold text-emerald-200">
              <Sparkles className="h-3.5 w-3.5" />
              AI app creation, sandbox preview, and publish workflow
            </div>
            <div className="space-y-5">
              <h1 className="max-w-4xl text-5xl font-bold tracking-tight sm:text-6xl lg:text-7xl">
                Build and publish apps on{" "}
                <span className="text-emerald-300">qwikorder.site</span>.
              </h1>
              <p className="max-w-2xl text-lg leading-8 text-slate-300">
                Describe what you want, build with an interactive AI workspace, preview in a sandbox page, then publish through bundle, security bundle, and promote-all stages.
              </p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row">
              <Button size="lg" onClick={() => setPlansOpen(true)} className="gap-2">
                Create project
                <Rocket className="h-4 w-4" />
              </Button>
              <Link href="/sandbox/demo">
                <Button size="lg" variant="outline" className="border-white/15 bg-white/5 text-white hover:bg-white/10">
                  View sandbox route
                </Button>
              </Link>
            </div>
            <div className="grid grid-cols-1 gap-3 text-sm text-slate-300 sm:grid-cols-3">
              {[
                "Conversational AI builder",
                "Sandbox preview page",
                "Publish to custom path",
              ].map((item) => (
                <div key={item} className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-300" />
                  {item}
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-3xl border border-white/10 bg-white/[0.06] p-4 shadow-2xl shadow-black/40 backdrop-blur">
            <div className="rounded-2xl border border-white/10 bg-[#0a0f16] overflow-hidden">
              <div className="flex items-center gap-2 border-b border-white/10 px-4 py-3">
                <div className="h-2.5 w-2.5 rounded-full bg-red-400" />
                <div className="h-2.5 w-2.5 rounded-full bg-yellow-400" />
                <div className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
                <span className="ml-3 text-xs text-slate-400">sandbox / app preview</span>
              </div>
              <div className="grid grid-cols-[210px_1fr] min-h-[460px]">
                <div className="border-r border-white/10 bg-[#090d13] p-4">
                  <div className="mb-4 flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-emerald-300">
                    <Sparkles className="h-4 w-4" />
                    AI Builder
                  </div>
                  <div className="space-y-3 text-xs">
                    <div className="rounded-xl border border-emerald-300/20 bg-emerald-300/10 p-3 text-emerald-100">
                      Build a restaurant ordering app with menus, cart, checkout, and admin view.
                    </div>
                    <div className="rounded-xl border border-white/10 bg-white/5 p-3 text-slate-300">
                      Creating app structure…
                    </div>
                    <div className="rounded-xl border border-white/10 bg-white/5 p-3 text-slate-300">
                      Wiring sandbox preview…
                    </div>
                    <div className="rounded-xl border border-white/10 bg-white/5 p-3 text-slate-300">
                      Ready to publish.
                    </div>
                  </div>
                </div>
                <div className="p-5">
                  <div className="mb-4 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold">QwikOrder Express</p>
                      <p className="text-xs text-slate-400">qwikorder.site/sandbox/app-24</p>
                    </div>
                    <Button size="sm" className="gap-2">
                      <Rocket className="h-3.5 w-3.5" />
                      Publish
                    </Button>
                  </div>
                  <div className="grid gap-3">
                    {[
                      { icon: Layers3, label: "Publish bundle", done: true },
                      { icon: ShieldCheck, label: "Security bundle", done: true },
                      { icon: Globe2, label: "Promote all", done: false },
                    ].map((step) => (
                      <div key={step.label} className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 p-4">
                        <step.icon className={step.done ? "h-5 w-5 text-emerald-300" : "h-5 w-5 text-slate-400"} />
                        <span className="text-sm">{step.label}</span>
                        <span className="ml-auto text-xs text-slate-400">{step.done ? "Complete" : "Next"}</span>
                      </div>
                    ))}
                  </div>
                  <div className="mt-5 rounded-2xl border border-white/10 bg-white p-5 text-slate-950">
                    <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-emerald-700">
                      <Code2 className="h-4 w-4" />
                      Live preview
                    </div>
                    <h3 className="mt-3 text-2xl font-bold">Fresh food, ordered fast.</h3>
                    <p className="mt-2 text-sm text-slate-600">
                      A generated ordering experience ready for sandbox review and publish promotion.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </section>
        </main>
      </div>

      <PlanSelectionDialog
        open={plansOpen}
        onOpenChange={setPlansOpen}
        onSelectPlan={handlePlan}
      />
    </div>
  );
}