import { Switch, Route, Router as WouterRouter, Redirect } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/use-auth";
import { PublicAuthProvider } from "@/hooks/use-public-auth";
import NotFound from "@/pages/not-found";

// Pages
import ChatPage from "./pages/chat";
import AdminLogin from "./pages/admin/login";
import AdminDashboard from "./pages/admin/dashboard";
import AdminSources from "./pages/admin/sources";
import AdminDocuments from "./pages/admin/documents";
import AdminReview from "./pages/admin/review";
import AdminUsers from "./pages/admin/users";
import AdminSettings from "./pages/admin/settings";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

function ProtectedRoute({ component: Component, ...rest }: { component: React.ComponentType }) {
  const { isAuthenticated, isReady } = useAuth();
  if (!isReady) return null;
  if (!isAuthenticated) return <Redirect to="/admin/login" />;
  return <Component {...rest} />;
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={ChatPage} />
      <Route path="/admin/login" component={AdminLogin} />
      <Route path="/admin">
        {() => <ProtectedRoute component={AdminDashboard} />}
      </Route>
      <Route path="/admin/sources">
        {() => <ProtectedRoute component={AdminSources} />}
      </Route>
      <Route path="/admin/documents">
        {() => <ProtectedRoute component={AdminDocuments} />}
      </Route>
      <Route path="/admin/review">
        {() => <ProtectedRoute component={AdminReview} />}
      </Route>
      <Route path="/admin/users">
        {() => <ProtectedRoute component={AdminUsers} />}
      </Route>
      <Route path="/admin/settings">
        {() => <ProtectedRoute component={AdminSettings} />}
      </Route>
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <PublicAuthProvider>
        <TooltipProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <Router />
          </WouterRouter>
          <Toaster />
        </TooltipProvider>
      </PublicAuthProvider>
    </QueryClientProvider>
  );
}

export default App;
