import { useAuth } from "@/hooks/use-auth";
import { useQuery } from "@tanstack/react-query";
import { Mission, Drone, DroneAssignment } from "@shared/schema";
import { Sidebar } from "@/components/ui/sidebar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { Menu, PlusCircle, Calendar, Clock, MapPin, User } from "lucide-react";
import { AddMissionDialog } from "@/components/add-mission-dialog";
import { MissionList } from "@/components/mission-list";
import { format } from "date-fns";
import { StatusBadge } from "@/components/ui/status-badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";

export default function Missions() {
  const { user } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showAddMissionDialog, setShowAddMissionDialog] = useState(false);
  
  // Fetch missions
  const { data: missions, isLoading: missionsLoading } = useQuery<Mission[]>({
    queryKey: ["/api/missions"],
  });
  
  // Fetch drones
  const { data: drones, isLoading: dronesLoading } = useQuery<Drone[]>({
    queryKey: ["/api/drones"],
  });
  
  // Filter missions by status
  const activeMissions = missions?.filter(m => m.status === 'active') || [];
  const plannedMissions = missions?.filter(m => m.status === 'planned') || [];
  const completedMissions = missions?.filter(m => m.status === 'completed') || [];
  
  return (
    <div className="flex h-screen overflow-hidden bg-gray-100">
      {/* Mobile sidebar toggle */}
      <Sidebar className={sidebarOpen ? "block absolute z-20 h-screen" : "hidden"} />
      
      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="bg-white shadow-sm z-10">
          <div className="flex items-center justify-between p-4">
            <div className="flex items-center">
              <button 
                className="md:hidden mr-4 text-gray-600"
                onClick={() => setSidebarOpen(!sidebarOpen)}
              >
                <Menu className="h-6 w-6" />
              </button>
              <h1 className="text-xl font-semibold text-gray-800">Missions</h1>
            </div>
            
            <div className="flex items-center">
              <Button onClick={() => setShowAddMissionDialog(true)}>
                <PlusCircle className="h-4 w-4 mr-2" />
                New Mission
              </Button>
            </div>
          </div>
        </header>

        {/* Main Content Area */}
        <main className="flex-1 overflow-y-auto p-4 bg-gray-50">
          {/* Mission Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <Card>
              <CardContent className="pt-6">
                <div className="text-center">
                  <p className="text-gray-500 text-sm mb-1">Active Missions</p>
                  <h3 className="text-3xl font-bold text-green-600">{activeMissions.length}</h3>
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="pt-6">
                <div className="text-center">
                  <p className="text-gray-500 text-sm mb-1">Scheduled</p>
                  <h3 className="text-3xl font-bold text-blue-600">{plannedMissions.length}</h3>
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="pt-6">
                <div className="text-center">
                  <p className="text-gray-500 text-sm mb-1">Completed</p>
                  <h3 className="text-3xl font-bold text-gray-600">{completedMissions.length}</h3>
                </div>
              </CardContent>
            </Card>
          </div>
          
          {/* Mission Tabs */}
          <Card>
            <CardHeader>
              <CardTitle>Mission Management</CardTitle>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="all">
                <TabsList className="mb-4">
                  <TabsTrigger value="all">All Missions</TabsTrigger>
                  <TabsTrigger value="active">Active</TabsTrigger>
                  <TabsTrigger value="planned">Planned</TabsTrigger>
                  <TabsTrigger value="completed">Completed</TabsTrigger>
                </TabsList>
                
                <TabsContent value="all">
                  <MissionList 
                    missions={missions || []} 
                    isLoading={missionsLoading} 
                    drones={drones || []}
                    showDetails
                  />
                </TabsContent>
                
                <TabsContent value="active">
                  <MissionList 
                    missions={activeMissions} 
                    isLoading={missionsLoading} 
                    drones={drones || []}
                    showDetails
                  />
                </TabsContent>
                
                <TabsContent value="planned">
                  <MissionList 
                    missions={plannedMissions} 
                    isLoading={missionsLoading} 
                    drones={drones || []}
                    showDetails
                  />
                </TabsContent>
                
                <TabsContent value="completed">
                  <MissionList 
                    missions={completedMissions} 
                    isLoading={missionsLoading} 
                    drones={drones || []}
                    showDetails
                  />
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </main>
      </div>
      
      {/* Add Mission Dialog */}
      <AddMissionDialog
        open={showAddMissionDialog}
        onOpenChange={setShowAddMissionDialog}
        drones={drones || []}
      />
    </div>
  );
}
