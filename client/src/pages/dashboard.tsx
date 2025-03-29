import { useAuth } from "@/hooks/use-auth";
import { useQuery } from "@tanstack/react-query";
import { Drone, Mission } from "@shared/schema";
import { Sidebar } from "@/components/ui/sidebar";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "wouter";
import { Search, Menu } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";
import { MapComponent } from "@/components/map-component";
import { DroneTable } from "@/components/drone-table";
import { MissionList } from "@/components/mission-list";
import { createWebSocketConnection } from "@/lib/websocket";

export default function Dashboard() {
  const { user } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  
  // Fetch drones
  const { data: drones, isLoading: dronesLoading } = useQuery<Drone[]>({
    queryKey: ["/api/drones"],
  });
  
  // Fetch missions
  const { data: missions, isLoading: missionsLoading } = useQuery<Mission[]>({
    queryKey: ["/api/missions"],
  });
  
  // Setup WebSocket for real-time updates
  useEffect(() => {
    const socket = createWebSocketConnection();
    
    socket.addEventListener('message', (event) => {
      try {
        const data = JSON.parse(event.data);
        // Handle different message types
        if (data.type === 'drone-location-update') {
          // Invalidate the query to trigger a refetch
          // queryClient.invalidateQueries(['/api/drones']);
        }
      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
      }
    });
    
    return () => {
      socket.close();
    };
  }, []);
  
  // Calculate statistics
  const availableDrones = drones?.filter(drone => drone.status === 'available').length || 0;
  const inMissionDrones = drones?.filter(drone => drone.status === 'in-mission').length || 0;
  const offlineDrones = drones?.filter(drone => drone.status === 'offline').length || 0;
  
  const activeMissions = missions?.filter(mission => mission.status === 'active').length || 0;
  const completedMissions = missions?.filter(mission => mission.status === 'completed').length || 0;

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
              <h1 className="text-xl font-semibold text-gray-800">Dashboard</h1>
            </div>
            
            <div className="flex items-center">
              <div className="relative mr-4">
                <Input 
                  type="text" 
                  placeholder="Search..." 
                  className="bg-gray-100 rounded-full py-2 pl-4 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:bg-white w-48"
                />
                <Button 
                  variant="ghost" 
                  size="sm"
                  className="absolute right-1 top-1/2 -translate-y-1/2 p-1 text-gray-500"
                >
                  <Search className="h-4 w-4" />
                </Button>
              </div>
              
              <div className="relative">
                <div className="flex items-center text-gray-700">
                  <div className="h-8 w-8 rounded-full bg-gray-200 mr-2 flex items-center justify-center overflow-hidden">
                    {/* User avatar initial */}
                    <span className="font-medium">{user?.name.charAt(0).toUpperCase()}</span>
                  </div>
                  <span className="hidden md:block">{user?.name}</span>
                </div>
              </div>
            </div>
          </div>
        </header>

        {/* Main Content Area */}
        <main className="flex-1 overflow-y-auto p-4 bg-gray-50">
          {/* Stats Overview */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-gray-500 text-sm">Total Drones</p>
                    <h3 className="text-2xl font-bold text-gray-800">{drones?.length || 0}</h3>
                  </div>
                  <div className="bg-blue-100 p-3 rounded-full">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
                    </svg>
                  </div>
                </div>
                <div className="mt-4 flex items-center text-sm">
                  <div className="flex items-center text-green-500">
                    <span className="ml-1">{availableDrones} Available</span>
                  </div>
                  <div className="flex items-center text-amber-500 ml-4">
                    <span className="ml-1">{inMissionDrones} In Mission</span>
                  </div>
                  <div className="flex items-center text-red-500 ml-4">
                    <span className="ml-1">{offlineDrones} Offline</span>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-gray-500 text-sm">Active Missions</p>
                    <h3 className="text-2xl font-bold text-gray-800">{activeMissions}</h3>
                  </div>
                  <div className="bg-green-100 p-3 rounded-full">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-secondary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                    </svg>
                  </div>
                </div>
                <div className="mt-4 flex items-center justify-between text-sm">
                  <div className="flex items-center">
                    <span className="bg-green-500 rounded-full w-2 h-2 mr-2"></span>
                    <span>In Progress</span>
                  </div>
                  <span className="text-gray-500">Updated {new Date().toLocaleTimeString()}</span>
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-gray-500 text-sm">Completed Missions</p>
                    <h3 className="text-2xl font-bold text-gray-800">{completedMissions}</h3>
                  </div>
                  <div className="bg-amber-100 p-3 rounded-full">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                  </div>
                </div>
                <div className="mt-4 flex items-center text-sm">
                  <div className="flex items-center text-green-500">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                    </svg>
                    <span className="ml-1">
                      {completedMissions > 0 ? "+1 this week" : "No missions completed yet"}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Map Section */}
          <Card className="mb-6">
            <CardContent className="pt-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-semibold text-gray-800">Active Drone Missions</h2>
                <div className="flex space-x-2">
                  <Button variant="outline" size="sm">
                    Filter
                  </Button>
                  <Button size="sm">View All</Button>
                </div>
              </div>
              
              {/* Map Component */}
              <div className="h-[500px] w-full rounded-lg border border-gray-200 overflow-hidden">
                {dronesLoading || missionsLoading ? (
                  <div className="h-full flex items-center justify-center bg-gray-100">
                    <Skeleton className="h-12 w-12 rounded-full" />
                  </div>
                ) : (
                  <MapComponent 
                    drones={drones || []} 
                    missions={missions || []} 
                  />
                )}
              </div>
              
              <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                <div className="flex items-center">
                  <span className="inline-block w-2 h-2 rounded-full bg-green-500 mr-2"></span>
                  <span>Available Drone</span>
                </div>
                <div className="flex items-center">
                  <span className="inline-block w-2 h-2 rounded-full bg-amber-500 mr-2"></span>
                  <span>In Mission</span>
                </div>
                <div className="flex items-center">
                  <span className="inline-block w-2 h-2 rounded-full bg-red-500 mr-2"></span>
                  <span>Offline/Error</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Drone Fleet Summary */}
            <div className="col-span-2">
              <DroneTable 
                drones={drones || []} 
                isLoading={dronesLoading}
                showViewAll
                limit={3}
              />
            </div>
            
            {/* Mission Summary */}
            <div>
              <MissionList 
                missions={missions || []} 
                isLoading={missionsLoading} 
                showViewAll
                limit={3}
              />
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
