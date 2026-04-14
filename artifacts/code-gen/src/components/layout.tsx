import { Link, useLocation } from "wouter";
import {
  CreditCard,
  LayoutDashboard,
  LogOut,
  Plus,
  Terminal,
  Zap,
} from "lucide-react";
import { useAuth } from "@/contexts/auth-context";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/projects/new", label: "Create Project", icon: Plus },
  { href: "/billing", label: "Billing", icon: CreditCard },
];

export function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { user, subscription, logout } = useAuth();

  const creditUsd = subscription
    ? (subscription.creditMicrodollars / 1_000_000).toFixed(2)
    : "0.00";

  const creditLow = subscription && subscription.creditMicrodollars < 100_000; // < $0.10

  return (
    <div className="flex min-h-screen w-full bg-background text-foreground">
      {/* Sidebar */}
      <aside className="w-56 border-r border-border bg-sidebar flex-col hidden md:flex shrink-0">
        {/* Logo */}
        <div className="h-14 flex items-center gap-2.5 px-5 border-b border-border">
          <div className="h-7 w-7 rounded bg-primary/10 border border-primary/30 flex items-center justify-center">
            <Terminal className="h-3.5 w-3.5 text-primary" />
          </div>
          <span className="font-bold text-sm tracking-widest text-primary">QWIKORDER</span>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-0.5">
          {navItems.map((item) => {
            const isActive = location === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors ${
                  isActive
                    ? "bg-primary/10 text-primary border border-primary/20"
                    : "text-muted-foreground hover:text-foreground hover:bg-black/5"
                }`}
              >
                <item.icon className="h-4 w-4 shrink-0" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* Credit balance */}
        {subscription && (
          <div className="px-4 py-3 border-t border-border">
            <div
              className={`flex items-center gap-2 text-xs rounded-lg px-3 py-2 ${
                creditLow
                  ? "bg-red-50 border border-red-200 text-red-700"
                  : "bg-emerald-50 border border-emerald-200 text-emerald-700"
              }`}
            >
              <Zap className="h-3 w-3 shrink-0" />
              <div className="min-w-0">
                <p className="font-semibold truncate capitalize">{subscription.plan} plan</p>
                <p className="text-[10px] opacity-80">${creditUsd} credit left</p>
              </div>
            </div>
          </div>
        )}

        {/* User + logout */}
        {user && (
          <div className="px-4 py-3 border-t border-border flex items-center gap-2.5">
            {user.picture ? (
              <img
                src={user.picture}
                alt={user.name}
                className="h-7 w-7 rounded-full shrink-0 border border-border"
              />
            ) : (
              <div className="h-7 w-7 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
                <span className="text-[10px] font-bold text-primary">
                  {user.name.charAt(0).toUpperCase()}
                </span>
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-foreground truncate">{user.name}</p>
              <p className="text-[10px] text-muted-foreground truncate">{user.email}</p>
            </div>
            <button
              onClick={logout}
              className="text-muted-foreground hover:text-destructive transition-colors shrink-0"
              title="Sign out"
            >
              <LogOut className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </aside>

      {/* Main */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Mobile header */}
        <header className="h-14 border-b border-border flex items-center justify-between px-4 md:hidden bg-sidebar shrink-0">
          <div className="flex items-center gap-2 text-primary">
            <Terminal className="h-4 w-4" />
            <span className="font-bold text-sm tracking-widest">QWIKORDER</span>
          </div>
          {user && (
            <button onClick={logout} className="text-muted-foreground hover:text-destructive">
              <LogOut className="h-4 w-4" />
            </button>
          )}
        </header>

        <div className="flex-1 overflow-auto p-6">
          {children}
        </div>
      </main>
    </div>
  );
}
