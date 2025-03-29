import { Mission, Drone } from "../../shared/schema";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import { Button } from "@/components/ui/button";
import { PlusCircle, Calendar, Clock, MapPin, Users, ChevronRight, Eye } from "lucide-react";
import { Link } from "wouter";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { useQuery } from "@tanstack/react-query";
import { MapComponent } from "./map-component";
import { DroneAssignment } from "../../shared/schema";
import { BatteryIndicator } from "@/components/ui/battery-indicator";

interface MissionListProps {
  missions: Mission[];
  isLoading: boolean;
  showViewAll?: boolean;
  limit?: number;
  drones?: Drone[];
  showDetails?: boolean;
}

export function MissionList({
  missions,
  isLoading,
  showViewAll = false,
  limit,
  drones = [],
  showDetails = false,
}: MissionListProps) {
  const [selectedMission, setSelectedMission] = useState<Mission | null>(null);
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);

  // Fetch drone assignments if we have a selected mission
  const { data: assignments } = useQuery<DroneAssignment[]>({
    queryKey: ["/api/missions", selectedMission?.id, "assignments"],
    enabled: !!selectedMission,
  });

  // Get the assigned drones for the selected mission
  const assignedDrones = assignments
    ? drones.filter(drone => assignments.some(a => a.droneId === drone.id))
    : [];

  // Limit the number of missions shown if limit is specified
  const displayMissions = limit ? missions.slice(0, limit) : missions;

  const handleViewDetails = (mission: Mission) => {
    setSelectedMission(mission);
    setDetailsDialogOpen(true);
  };

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Missions</CardTitle>
          <Link href="/mission-planner">
            <Button>
              <PlusCircle className="h-4 w-4 mr-2" />
              New Mission
            </Button>
          </Link>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, index) => (
                <div key={index} className="flex flex-col space-y-2 p-4 border-b">
                  <div className="flex justify-between">
                    <Skeleton className="h-5 w-40" />
                    <Skeleton className="h-5 w-20" />
                  </div>
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-4 w-full" />
                </div>
              ))}
            </div>
          ) : displayMissions.length === 0 ? (
            <div className="text-center p-6">
              <h3 className="text-lg font-medium text-gray-500">No missions found</h3>
              <p className="text-sm text-gray-400 mt-1">Create a new mission to get started</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {displayMissions.map((mission) => (
                <div key={mission.id} className="p-4">
                  <div className="flex justify-between">
                    <div>
                      <h3 className="font-medium text-gray-800">{mission.name}</h3>
                      {mission.startTime && (
                        <p className="text-sm text-gray-500">
                          Scheduled: {new Date(mission.startTime).toLocaleString()}
                          {mission.estimatedDuration && (
                            <span> ({Math.round(mission.estimatedDuration / 60)} mins)</span>
                          )}
                        </p>
                      )}
                    </div>
                    <StatusBadge status={mission.status} />
                  </div>
                  <p className="text-sm text-gray-500 mt-1">{mission.description || mission.location}</p>

                  <div className="mt-2 text-xs text-gray-500 flex items-center">
                    <Calendar className="h-3 w-3 mr-1" />
                    {mission.startDate 
                      ? format(new Date(mission.startDate), "MMM d, yyyy")
                      : "Not scheduled"}

                    {mission.isRecurring && (
                      <span className="ml-2">
                        <Clock className="h-3 w-3 inline mr-1" />
                        {mission.recurringSchedule || "Recurring"}
                      </span>
                    )}
                  </div>

                  <div className="mt-3 flex items-center justify-between">
                    <div className="flex -space-x-2">
                      {drones.filter(drone => drone.status === 'in-mission').slice(0, 3).map((drone) => (
                        <div 
                          key={drone.id}
                          className="h-6 w-6 rounded-full ring-2 ring-white bg-gray-200 flex items-center justify-center text-xs"
                          title={drone.name}
                        >
                          {drone.name.charAt(0).toUpperCase()}
                        </div>
                      ))}
                    </div>

                    {showDetails ? (
                      <Button 
                        variant="ghost" 
                        size="sm"
                        className="text-sm text-primary"
                        onClick={() => handleViewDetails(mission)}
                      >
                        <Eye className="h-4 w-4 mr-1" />
                        Details
                      </Button>
                    ) : (
                      <Link href={`/missions/${mission.id}`}>
                        <Button variant="ghost" size="sm" className="text-sm text-primary">
                          View
                        </Button>
                      </Link>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {showViewAll && missions.length > 0 && (
            <div className="p-4 border-t border-gray-100">
              <Link href="/missions">
                <Button variant="outline" className="w-full py-2 bg-gray-50 text-sm text-gray-600 rounded hover:bg-gray-100">
                  View All Missions
                </Button>
              </Link>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Mission Details Dialog */}
      {selectedMission && (
        <Dialog open={detailsDialogOpen} onOpenChange={setDetailsDialogOpen}>
          <DialogContent className="max-w-3xl">
            <DialogHeader>
              <DialogTitle className="flex items-center justify-between">
                <div>{selectedMission.name}</div>
                <StatusBadge status={selectedMission.status} />
              </DialogTitle>
              <DialogDescription>
                {selectedMission.description || "No description provided"}
              </DialogDescription>
            </DialogHeader>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <h4 className="font-medium text-sm mb-2">Mission Details</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center">
                    <MapPin className="h-4 w-4 mr-2 text-gray-500" />
                    <span>{selectedMission.location || "No location specified"}</span>
                  </div>

                  <div className="flex items-center">
                    <Calendar className="h-4 w-4 mr-2 text-gray-500" />
                    <span>
                      {selectedMission.startDate 
                        ? format(new Date(selectedMission.startDate), "MMMM d, yyyy")
                        : "Not scheduled"}
                    </span>
                  </div>

                  <div className="flex items-center">
                    <Clock className="h-4 w-4 mr-2 text-gray-500" />
                    <span>
                      {selectedMission.isRecurring 
                        ? `Recurring (${selectedMission.recurringSchedule || "Not specified"})`
                        : "One-time mission"}
                    </span>
                  </div>

                  <div className="flex items-center">
                    <Users className="h-4 w-4 mr-2 text-gray-500" />
                    <span>{assignedDrones.length} Assigned Drones</span>
                  </div>
                </div>

                {assignedDrones.length > 0 && (
                  <>
                    <h4 className="font-medium text-sm mt-4 mb-2">Assigned Drones</h4>
                    <div className="space-y-2">
                      {assignedDrones.map(drone => (
                        <div key={drone.id} className="flex items-center justify-between bg-gray-50 p-2 rounded">
                          <div className="flex items-center">
                            <div className="h-8 w-8 bg-gray-200 rounded-full flex items-center justify-center mr-2">
                              {drone.name.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <div className="font-medium text-sm">{drone.name}</div>
                              <div className="text-xs text-gray-500">{drone.model}</div>
                            </div>
                          </div>
                          <div className="flex items-center space-x-2">
                            <BatteryIndicator level={drone.batteryLevel} size="sm" />
                            <StatusBadge status={drone.status} />
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>

              <div>
                <h4 className="font-medium text-sm mb-2">Mission Map</h4>
                <div className="h-[300px] border rounded overflow-hidden">
                  <MapComponent 
                    drones={assignedDrones}
                    missions={[selectedMission]}
                    waypoints={assignments?.[0]?.waypoints || []}
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end space-x-2 mt-4">
              <Button variant="outline" onClick={() => setDetailsDialogOpen(false)}>
                Close
              </Button>
              <Link href={`/missions/${selectedMission.id}/edit`}>
                <Button>Edit Mission</Button>
              </Link>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}