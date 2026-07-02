import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Layout } from "@/components/layout/Layout";
import { AlertsProvider } from "@/contexts/alerts-context";
import NotFound from "@/pages/not-found";

import Home from "@/pages/home";
import Medicines from "@/pages/medicines";
import Adherence from "@/pages/adherence";
import Diet from "@/pages/diet";
import Recipes from "@/pages/recipes";
import Profile from "@/pages/profile";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

function Router() {
  return (
    <Layout>
      <Switch>
        <Route path="/" component={Home} />
        <Route path="/medicines" component={Medicines} />
        <Route path="/medicines/adherence" component={Adherence} />
        <Route path="/diet" component={Diet} />
        <Route path="/recipes" component={Recipes} />
        <Route path="/profile" component={Profile} />
        <Route component={NotFound} />
      </Switch>
    </Layout>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AlertsProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <Router />
          </WouterRouter>
          <Toaster />
        </AlertsProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
