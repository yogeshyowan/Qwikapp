import { Link, useLocation } from "wouter";
import {
  LayoutDashboard,
  MessageSquare,
  Plus,
  Terminal,
} from "lucide-react";

const navItems = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/projects/new", label: "New Project", icon: Plus },
  { href: "/chat", label: "AI Assistant", icon: MessageSquare },
];

export function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();

  return (
    <div className="flex min-h-screen w-full bg-background text-foreground">
      {/* Sidebar */}
      <aside className="w-56 border-r border-border/70 bg-[#0a0b0e] flex-col hidden md:flex shrink-0">
        {/* Logo */}
        <div className="h-14 flex items-center gap-2.5 px-5 border-b border-border/50">
          <div className="h-7 w-7 rounded bg-primary/15 border border-primary/30 flex items-center justify-center">
            <Terminal className="h-3.5 w-3.5 text-primary" />
          </div>
          <span className="font-bold text-sm tracking-widest text-primary">QWIKIDE</span>
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
                    : "text-muted-foreground/70 hover:text-foreground hover:bg-white/5"
                }`}
              >
                <item.icon className="h-4 w-4 shrink-0" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="px-4 py-4 border-t border-border/40">
          <p className="text-[10px] text-muted-foreground/30 font-mono">
            Powered by Claude AI
          </p>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Mobile header */}
        <header className="h-14 border-b border-border/60 flex items-center px-4 md:hidden bg-[#0a0b0e] shrink-0">
          <div className="flex items-center gap-2 text-primary">
            <Terminal className="h-4 w-4" />
            <span className="font-bold text-sm tracking-widest">QWIKIDE</span>
          </div>
        </header>

        <div className="flex-1 overflow-auto p-6">
          {children}
        </div>
      </main>
    </div>
  );
}
