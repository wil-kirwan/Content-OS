import { Switch, Route, Router as WouterRouter, Redirect } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { WorkspaceProvider } from "@/context/WorkspaceContext";
import { AppShell } from "@/components/layout/AppShell";
import NotFound from "@/pages/not-found";

import Dashboard from "@/pages/dashboard";
import Planner from "@/pages/planner";
import Campaigns from "@/pages/campaigns";
import CampaignDetail from "@/pages/campaign-detail";
import Integrations from "@/pages/integrations";
import Templates from "@/pages/templates";
import Settings from "@/pages/settings";
import Onboarding from "@/pages/onboarding";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30000,
    },
  },
});

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <WorkspaceProvider>
        <TooltipProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <Switch>
              <Route path="/" component={() => <Redirect to="/dashboard" />} />
              <Route path="/onboarding" component={Onboarding} />
              <Route path="/dashboard">
                <AppShell><Dashboard /></AppShell>
              </Route>
              <Route path="/planner">
                <AppShell><Planner /></AppShell>
              </Route>
              <Route path="/campaigns/:id">
                {(params) => <AppShell><CampaignDetail params={params} /></AppShell>}
              </Route>
              <Route path="/campaigns">
                <AppShell><Campaigns /></AppShell>
              </Route>
              <Route path="/integrations">
                <AppShell><Integrations /></AppShell>
              </Route>
              <Route path="/templates">
                <AppShell><Templates /></AppShell>
              </Route>
              <Route path="/settings">
                <AppShell><Settings /></AppShell>
              </Route>
              <Route>
                <AppShell><NotFound /></AppShell>
              </Route>
            </Switch>
          </WouterRouter>
          <Toaster />
        </TooltipProvider>
      </WorkspaceProvider>
    </QueryClientProvider>
  );
}

export default App;
