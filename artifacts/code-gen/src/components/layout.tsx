import { Link, useLocation } from "wouter";
import { Terminal, Plus, LayoutDashboard, MessageSquare } from "lucide-react";

export function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();

  const navItems = [
    { href: "/", label: "Dashboard", icon: LayoutDashboard },
    { href: "/projects/new", label: "New Project", icon: Plus },
    { href: "/chat", label: "AI Assistant", icon: MessageSquare },
  ];

  return (
    <div className="flex min-h-screen w-full bg-background text-foreground font-mono">
      {/* Sidebar */}
      <aside className="w-64 border-r border-border bg-sidebar flex flex-col hidden md:flex">
        <div className="p-6 flex items-center gap-3 text-primary">
          <Terminal className="h-6 w-6" />
          <span className="font-bold text-lg tracking-wider">DEVLAUNCH</span>
        </div>
        <nav className="flex-1 px-4 py-2 space-y-2">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2 rounded-md transition-colors ${
                location === item.href
                  ? "bg-primary/10 text-primary border border-primary/20"
                  : "text-muted-foreground hover:text-foreground hover:bg-accent/5"
              }`}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </Link>
          ))}
        </nav>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
        <header className="h-14 border-b border-border flex items-center px-6 md:hidden">
          <div className="flex items-center gap-2 text-primary">
            <Terminal className="h-5 w-5" />
            <span className="font-bold tracking-wider">DEVLAUNCH</span>
          </div>
        </header>
        <div className="flex-1 overflow-auto p-6 relative">
          <div className="absolute inset-0 bg-noise pointer-events-none" />
          <div className="relative z-10 h-full">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}
