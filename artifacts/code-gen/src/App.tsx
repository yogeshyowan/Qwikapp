import { useEffect } from "react";
import { Switch, Route, Router as WouterRouter, useLocation } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/contexts/auth-context";
import NotFound from "@/pages/not-found";
import { Layout } from "@/components/layout";
import Landing from "@/pages/landing";
import Dashboard from "@/pages/dashboard";
import NewProject from "@/pages/new-project";
import ProjectDetail from "@/pages/project-detail";
import Chat from "@/pages/chat";
import Login from "@/pages/login";
import Billing from "@/pages/billing";
import SandboxPreview from "@/pages/sandbox-preview";
import { Loader2 } from "lucide-react";

const queryClient = new QueryClient();

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  const [, navigate] = useLocation();

  useEffect(() => {
    if (!isLoading && !user) {
      navigate("/login");
    }
  }, [isLoading, navigate, user]);

  if (isLoading) {
    return (
      <div className="h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return <>{children}</>;
}

function Router() {
  return (
    <Switch>
      <Route path="/">
        <Landing />
      </Route>

      {/* Public auth route */}
      <Route path="/login">
        <Login />
      </Route>

      <Route path="/sandbox/:id">
        <SandboxPreview />
      </Route>

      {/* /projects/new must come before /projects/:id */}
      <Route path="/projects/new">
        <ProtectedRoute>
          <Layout><NewProject /></Layout>
        </ProtectedRoute>
      </Route>

      {/* Project detail — full screen, no Layout */}
      <Route path="/projects/:id">
        <ProtectedRoute>
          <ProjectDetail />
        </ProtectedRoute>
      </Route>

      {/* All other routes use the sidebar Layout */}
      <Route>
        <ProtectedRoute>
          <Layout>
            <Switch>
              <Route path="/dashboard" component={Dashboard} />
              <Route path="/chat" component={Chat} />
              <Route path="/chat/:id" component={Chat} />
              <Route path="/billing" component={Billing} />
              <Route component={NotFound} />
            </Switch>
          </Layout>
        </ProtectedRoute>
      </Route>
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <Router />
          </WouterRouter>
          <Toaster />
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
