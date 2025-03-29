import { Drone } from "@shared/schema";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import { BatteryIndicator } from "@/components/ui/battery-indicator";
import { Button } from "@/components/ui/button";
import { Eye, Edit, Trash2, PlusCircle } from "lucide-react";
import { Link } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

interface DroneTableProps {
  drones: Drone[];
  isLoading: boolean;
  showActions?: boolean;
  showViewAll?: boolean;
  limit?: number;
}

export function DroneTable({ 
  drones, 
  isLoading, 
  showActions = false,
  showViewAll = false,
  limit
}: DroneTableProps) {
  const { toast } = useToast();
  const [deletingDroneId, setDeletingDroneId] = useState<number | null>(null);
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  
  const deleteDroneMutation = useMutation({
    mutationFn: async (droneId: number) => {
      await apiRequest("DELETE", `/api/drones/${droneId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/drones"] });
      toast({
        title: "Drone Deleted",
        description: "The drone has been successfully removed.",
      });
      setConfirmDialogOpen(false);
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: `Failed to delete drone: ${error.message}`,
        variant: "destructive",
      });
    },
  });
  
  const handleDeleteClick = (droneId: number) => {
    setDeletingDroneId(droneId);
    setConfirmDialogOpen(true);
  };
  
  const confirmDelete = () => {
    if (deletingDroneId) {
      deleteDroneMutation.mutate(deletingDroneId);
    }
  };
  
  // Limit the number of drones shown if limit is specified
  const displayDrones = limit ? drones.slice(0, limit) : drones;
  
  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Drone Fleet</CardTitle>
          {showActions && (
            <Link href="/drones/add">
              <Button>
                <PlusCircle className="h-4 w-4 mr-2" />
                Add New Drone
              </Button>
            </Link>
          )}
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, index) => (
                <div key={index} className="flex items-center space-x-4">
                  <Skeleton className="h-12 w-12 rounded-full" />
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-40" />
                    <Skeleton className="h-4 w-24" />
                  </div>
                </div>
              ))}
            </div>
          ) : displayDrones.length === 0 ? (
            <div className="text-center p-6">
              <h3 className="text-lg font-medium text-gray-500">No drones found</h3>
              <p className="text-sm text-gray-400 mt-1">Add drones to your fleet to see them here</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead>
                  <tr className="text-left text-xs text-gray-500 uppercase tracking-wider">
                    <th className="pb-3 font-medium">Drone Name</th>
                    <th className="pb-3 font-medium">Model</th>
                    <th className="pb-3 font-medium">Status</th>
                    <th className="pb-3 font-medium">Battery</th>
                    <th className="pb-3 font-medium">Last Location</th>
                    {showActions && <th className="pb-3 font-medium">Actions</th>}
                  </tr>
                </thead>
                <tbody>
                  {displayDrones.map((drone) => (
                    <tr key={drone.id} className="border-t border-gray-100">
                      <td className="py-3">
                        <div className="flex items-center">
                          <div className="h-8 w-8 mr-3 bg-gray-200 rounded-full flex items-center justify-center">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
                            </svg>
                          </div>
                          <span className="font-medium text-gray-800">{drone.name}</span>
                        </div>
                      </td>
                      <td className="py-3 text-gray-500">{drone.model}</td>
                      <td className="py-3">
                        <StatusBadge status={drone.status} />
                      </td>
                      <td className="py-3">
                        <BatteryIndicator level={drone.batteryLevel} />
                      </td>
                      <td className="py-3 text-gray-500 font-mono text-xs">
                        {drone.lastKnownLocation?.lat.toFixed(4)}°, {drone.lastKnownLocation?.lng.toFixed(4)}°
                      </td>
                      {showActions && (
                        <td className="py-3">
                          <div className="flex space-x-2">
                            <Button variant="ghost" size="sm">
                              <Eye className="h-4 w-4 text-blue-500" />
                            </Button>
                            <Button variant="ghost" size="sm">
                              <Edit className="h-4 w-4 text-gray-500" />
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="sm"
                              onClick={() => handleDeleteClick(drone.id)}
                              disabled={deleteDroneMutation.isPending && deletingDroneId === drone.id}
                            >
                              <Trash2 className="h-4 w-4 text-red-500" />
                            </Button>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          
          {showViewAll && drones.length > 0 && (
            <div className="p-3 border-t border-gray-100 text-sm text-gray-500">
              Showing {Math.min(limit || drones.length, drones.length)} of {drones.length} drones
              <Link href="/drones">
                <Button variant="link" className="text-primary ml-2 p-0">View All</Button>
              </Link>
            </div>
          )}
        </CardContent>
      </Card>
      
      {/* Confirmation Dialog */}
      <Dialog open={confirmDialogOpen} onOpenChange={setConfirmDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Drone</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this drone? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDialogOpen(false)}>Cancel</Button>
            <Button 
              variant="destructive" 
              onClick={confirmDelete}
              disabled={deleteDroneMutation.isPending}
            >
              {deleteDroneMutation.isPending ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
