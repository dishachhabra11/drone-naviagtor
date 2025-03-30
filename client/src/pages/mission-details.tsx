import { useAuth } from "@/hooks/use-auth";
import { useQuery } from "@tanstack/react-query";
import { Drone, Mission } from "@shared/schema";
import { Sidebar } from "@/components/ui/sidebar";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Menu, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";
import { MapComponent } from "@/components/map-component";
import { createWebSocketConnection } from "@/lib/websocket";
import { useLocation } from "wouter";

export default function MissionDetails() {
  const { user } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [location] = useLocation();

  // Extract mission ID from URL
  const missionId = location.split("/").pop();

  // Fetch specific mission
  const { data: mission, isLoading: missionLoading } = useQuery<Mission>({
    queryKey: [`/api/missions/${missionId}`],
  });

  // Fetch drones assigned to this mission
  const { data: missionDrones, isLoading: dronesLoading } = useQuery<Drone[]>({
    queryKey: [`/api/missions/${missionId}/drones`],
    enabled: Boolean(missionId),
    refetchInterval: 5000, // Refetch every 5 seconds
  });

  // Setup WebSocket for real-time updates
  useEffect(() => {
    const socket = createWebSocketConnection();

    socket.addEventListener("message", (event) => {
      try {
        const data = JSON.parse(event.data);
        // Handle different message types
        if (data.type === "drone-location-update" && data.missionId === missionId) {
          // Invalidate the query to trigger a refetch
          // queryClient.invalidateQueries([`/api/missions/${missionId}/drones`]);
        }
      } catch (error) {
        console.error("Error parsing WebSocket message:", error);
      }
    });

    return () => {
      socket.close();
    };
  }, [missionId]);

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
              <button className="md:hidden mr-4 text-gray-600" onClick={() => setSidebarOpen(!sidebarOpen)}>
                <Menu className="h-6 w-6" />
              </button>
              <Button variant="ghost" size="sm" className="mr-2" onClick={() => window.history.back()}>
                <ArrowLeft className="h-4 w-4 mr-1" />
                Back
              </Button>
              <h1 className="text-xl font-semibold text-gray-800">{missionLoading ? <Skeleton className="h-6 w-48" /> : `Mission: ${mission?.name || "Details"}`}</h1>
            </div>

            <div className="flex items-center">
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
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Mission Map - Takes 2/3 of space on large screens */}
            <div className="lg:col-span-2">
              <Card className="mb-6">
                <CardContent className="pt-6">
                  <div className="flex justify-between items-center mb-4">
                    <h2 className="text-lg font-semibold text-gray-800">Mission Map</h2>
                    <div className="text-sm text-gray-500">{!missionLoading && mission?.status && <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full font-medium ${mission.status === "in-progress" ? "bg-green-100 text-green-800" : mission.status === "completed" ? "bg-blue-100 text-blue-800" : "bg-gray-100 text-gray-800"}`}>{mission.status.charAt(0).toUpperCase() + mission.status.slice(1)}</span>}</div>
                  </div>

                  {/* Map Component */}
                  <div className="h-[500px] w-full rounded-lg border border-gray-200 overflow-hidden">
                    {dronesLoading || missionLoading ? (
                      <div className="h-full flex items-center justify-center bg-gray-100">
                        <Skeleton className="h-12 w-12 rounded-full" />
                      </div>
                    ) : (
                      <MapComponent
                        // Only pass the drones for this mission
                        drones={missionDrones || []}
                        // Pass just this mission
                        missions={mission ? [mission] : []}
                        // Focus on this mission
                        focusedMissionId={missionId}
                        // Enable real-time tracking
                        trackingEnabled={true}
                      />
                    )}
                  </div>

                  <div className="mt-4 grid grid-cols-3 gap-4 text-sm">
                    <div className="flex items-center">
                      <span className="inline-block w-2 h-2 rounded-full bg-amber-500 mr-2"></span>
                      <span>Mission Drone</span>
                    </div>
                    <div className="flex items-center">
                      <span className="inline-block w-2 h-2 rounded-full bg-green-500 mr-2"></span>
                      <span>Mission Start</span>
                    </div>
                    <div className="flex items-center">
                      <span className="inline-block w-2 h-2 rounded-full bg-red-500 mr-2"></span>
                      <span>Mission End</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Mission Details - Takes 1/3 of space */}
            <div>
              <Card>
                <CardContent className="pt-6">
                  <h2 className="text-lg font-semibold text-gray-800 mb-4">Mission Details</h2>

                  {missionLoading ? (
                    <div className="space-y-4">
                      <Skeleton className="h-4 w-full" />
                      <Skeleton className="h-4 w-3/4" />
                      <Skeleton className="h-4 w-5/6" />
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div>
                        <p className="text-sm font-medium text-gray-500">Mission Name</p>
                        <p className="mt-1">{mission?.name}</p>
                      </div>

                      <div>
                        <p className="text-sm font-medium text-gray-500">Status</p>
                        <p className="mt-1 capitalize">{mission?.status}</p>
                      </div>

                      <div>
                        <p className="text-sm font-medium text-gray-500">Start Time</p>
                        <p className="mt-1">{mission?.startTime ? new Date(mission.startTime).toLocaleString() : "Not started"}</p>
                      </div>

                      <div>
                        <p className="text-sm font-medium text-gray-500">Estimated Duration</p>
                        <p className="mt-1">{mission?.estimatedDuration || "Unknown"} minutes</p>
                      </div>

                      <div>
                        <p className="text-sm font-medium text-gray-500">Assigned Drones</p>
                        <p className="mt-1">{missionDrones?.length || 0} drones</p>
                      </div>

                      <div>
                        <p className="text-sm font-medium text-gray-500">Description</p>
                        <p className="mt-1">{mission?.description || "No description provided"}</p>
                      </div>
                    </div>
                  )}

                  {!missionLoading && mission?.status === "in-progress" && (
                    <div className="mt-6">
                      <Button className="w-full">End Mission</Button>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Drone List */}
              <Card className="mt-6">
                <CardContent className="pt-6">
                  <h2 className="text-lg font-semibold text-gray-800 mb-4">Assigned Drones</h2>

                  {dronesLoading ? (
                    <div className="space-y-4">
                      <Skeleton className="h-14 w-full" />
                      <Skeleton className="h-14 w-full" />
                    </div>
                  ) : missionDrones?.length ? (
                    <div className="space-y-3">
                      {missionDrones.map((drone) => (
                        <div key={drone.id} className="border rounded-lg p-3 flex justify-between items-center">
                          <div>
                            <p className="font-medium">{drone.name}</p>
                            <p className="text-sm text-gray-500">ID: {drone.id}</p>
                          </div>
                          <div className={`px-2 py-1 rounded-full text-xs font-medium ${drone.status === "in-mission" ? "bg-amber-100 text-amber-800" : drone.status === "available" ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`}>{drone.status}</div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-gray-500 text-center py-6">No drones assigned to this mission</p>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
