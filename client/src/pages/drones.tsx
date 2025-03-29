import { useAuth } from "@/hooks/use-auth";
import { useQuery } from "@tanstack/react-query";
import { Drone } from "@shared/schema";
import { Sidebar } from "@/components/ui/sidebar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { Menu, PlusCircle } from "lucide-react";
import { DroneTable } from "@/components/drone-table";
import { AddDroneDialog } from "@/components/add-drone-dialog";
import { MapComponent } from "@/components/map-component";

export default function Drones() {
  const { user } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showAddDroneDialog, setShowAddDroneDialog] = useState(false);
  
  // Fetch drones
  const { data: drones, isLoading: dronesLoading } = useQuery<Drone[]>({
    queryKey: ["/api/drones"],
  });
  
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
              <h1 className="text-xl font-semibold text-gray-800">Drone Fleet</h1>
            </div>
            
            <div className="flex items-center">
              <Button onClick={() => setShowAddDroneDialog(true)}>
                <PlusCircle className="h-4 w-4 mr-2" />
                Add New Drone
              </Button>
            </div>
          </div>
        </header>

        {/* Main Content Area */}
        <main className="flex-1 overflow-y-auto p-4 bg-gray-50">
          {/* Drone Fleet Overview */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <Card>
              <CardContent className="pt-6">
                <div className="text-center">
                  <p className="text-gray-500 text-sm mb-1">Total Drones</p>
                  <h3 className="text-3xl font-bold text-gray-800">{drones?.length || 0}</h3>
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="pt-6">
                <div className="text-center">
                  <p className="text-gray-500 text-sm mb-1">Available</p>
                  <h3 className="text-3xl font-bold text-green-600">
                    {drones?.filter(d => d.status === 'available').length || 0}
                  </h3>
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="pt-6">
                <div className="text-center">
                  <p className="text-gray-500 text-sm mb-1">In Mission</p>
                  <h3 className="text-3xl font-bold text-amber-600">
                    {drones?.filter(d => d.status === 'in-mission').length || 0}
                  </h3>
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="pt-6">
                <div className="text-center">
                  <p className="text-gray-500 text-sm mb-1">Offline</p>
                  <h3 className="text-3xl font-bold text-red-600">
                    {drones?.filter(d => d.status === 'offline').length || 0}
                  </h3>
                </div>
              </CardContent>
            </Card>
          </div>
          
          {/* Map with drone locations */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Drone Fleet Map</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[400px] w-full rounded-lg border border-gray-200 overflow-hidden">
                <MapComponent drones={drones || []} missions={[]} />
              </div>
            </CardContent>
          </Card>
          
          {/* Drone List */}
          <DroneTable
            drones={drones || []}
            isLoading={dronesLoading}
            showActions
          />
        </main>
      </div>
      
      {/* Add Drone Dialog */}
      <AddDroneDialog
        open={showAddDroneDialog}
        onOpenChange={setShowAddDroneDialog}
      />
    </div>
  );
}
