import { Switch } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import NotFound from "@/pages/not-found";
import AuthPage from "@/pages/auth-page";
import Dashboard from "@/pages/dashboard";
import Drones from "@/pages/drones";
import Missions from "@/pages/missions";
import MissionPlanner from "@/pages/mission-planner";
import Analytics from "@/pages/analytics";
import { AuthProvider } from "./hooks/use-auth";
import { ProtectedRoute } from "./lib/protected-route";
import { Route } from "wouter";
import MissionDetails from "@/pages/mission-details";

function Router() {
  return (
    <Switch>
      <ProtectedRoute path="/" component={Dashboard} />
      <ProtectedRoute path="/drones" component={Drones} />
      <ProtectedRoute path="/missions" component={Missions} />
      <ProtectedRoute path="/mission-planner" component={MissionPlanner} />
      <ProtectedRoute path="/analytics" component={Analytics} />
      <ProtectedRoute path="/missions/:missionId" component={MissionDetails} />
      <Route path="/auth" component={AuthPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <Router />
        <Toaster />
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
