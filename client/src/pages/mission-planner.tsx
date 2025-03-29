import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Drone, Mission, InsertMission, DroneAssignment, InsertDroneAssignment, Waypoint } from "@shared/schema";
import { Sidebar } from "@/components/ui/sidebar";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Menu, PlusCircle, Save, Check, Trash2 } from "lucide-react";
import { MapComponent } from "@/components/map-component";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Textarea } from "@/components/ui/textarea";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

// Form schema for mission creation
const missionFormSchema = z.object({
  name: z.string().min(3, {
    message: "Mission name must be at least 3 characters.",
  }),
  description: z.string().optional(),
  location: z.string().min(1, {
    message: "Please provide a location name.",
  }),
  startDate: z.date().optional(),
  startTime: z.string().optional(),
  endDate: z.date().optional(),
  endTime: z.string().optional(),
  isRecurring: z.boolean().default(false),
  recurringSchedule: z.string().optional(),
  selectedDrones: z.array(z.number()).min(1, {
    message: "Please select at least one drone.",
  }),
});

type MissionFormValues = z.infer<typeof missionFormSchema>;

export default function MissionPlanner() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [waypoints, setWaypoints] = useState<Waypoint[]>([]);
  const [selectedMissionId, setSelectedMissionId] = useState<number | null>(null);
  
  // Fetch drones
  const { data: drones, isLoading: dronesLoading } = useQuery<Drone[]>({
    queryKey: ["/api/drones"],
  });
  
  // Fetch missions
  const { data: missions, isLoading: missionsLoading } = useQuery<Mission[]>({
    queryKey: ["/api/missions"],
  });
  
  // Available drones (only available ones)
  const availableDrones = drones?.filter(drone => drone.status === 'available') || [];
  
  // Form setup
  const form = useForm<MissionFormValues>({
    resolver: zodResolver(missionFormSchema),
    defaultValues: {
      name: "",
      description: "",
      location: "",
      startDate: undefined,
      startTime: "",
      endDate: undefined,
      endTime: "",
      isRecurring: false,
      recurringSchedule: "",
      selectedDrones: [],
    },
  });
  
  // Create mission mutation
  const createMissionMutation = useMutation({
    mutationFn: async (data: InsertMission) => {
      const res = await apiRequest("POST", "/api/missions", data);
      return await res.json() as Mission;
    },
    onSuccess: (mission) => {
      queryClient.invalidateQueries({ queryKey: ["/api/missions"] });
      toast({
        title: "Mission Created",
        description: `Mission "${mission.name}" has been created successfully.`,
      });
      
      // Now create drone assignments with waypoints
      const selectedDrones = form.getValues().selectedDrones;
      selectedDrones.forEach(async (droneId) => {
        const assignment: InsertDroneAssignment = {
          droneId,
          missionId: mission.id,
          waypoints,
          isActive: true,
        };
        
        try {
          await apiRequest("POST", `/api/missions/${mission.id}/assignments`, assignment);
          queryClient.invalidateQueries({ queryKey: ["/api/drones"] });
        } catch (error) {
          console.error("Error creating assignment:", error);
        }
      });
      
      // Reset form and waypoints
      form.reset();
      setWaypoints([]);
    },
    onError: (error) => {
      toast({
        title: "Error Creating Mission",
        description: error.message,
        variant: "destructive",
      });
    },
  });
  
  // Submit handler
  const onSubmit = (values: MissionFormValues) => {
    if (waypoints.length === 0) {
      toast({
        title: "No Waypoints",
        description: "Please add at least one waypoint on the map.",
        variant: "destructive",
      });
      return;
    }
    
    // Process start date and time
    let combinedStartTime = undefined;
    if (values.startDate) {
      combinedStartTime = new Date(values.startDate);
      if (values.startTime) {
        const [hours, minutes] = values.startTime.split(':').map(Number);
        combinedStartTime.setHours(hours, minutes);
      }
    }
    
    // Process end date and time
    let combinedEndTime = undefined;
    if (values.endDate) {
      combinedEndTime = new Date(values.endDate);
      if (values.endTime) {
        const [hours, minutes] = values.endTime.split(':').map(Number);
        combinedEndTime.setHours(hours, minutes);
      }
    }
    
    // Create the mission data
    const missionData: InsertMission = {
      name: values.name,
      description: values.description || "",
      status: 'planned',
      // Store location and recurring data in JSON location field
      location: JSON.stringify({
        address: values.location,
        isRecurring: values.isRecurring,
        recurringSchedule: values.isRecurring ? values.recurringSchedule : null
      }),
      startTime: combinedStartTime,
      endTime: combinedEndTime,
      organizationId: user!.id,
    };
    
    createMissionMutation.mutate(missionData);
  };
  
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
              <h1 className="text-xl font-semibold text-gray-800">Mission Planner</h1>
            </div>
          </div>
        </header>

        {/* Main Content Area */}
        <main className="flex-1 overflow-y-auto p-4 bg-gray-50">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Mission Form */}
            <Card className="lg:col-span-1">
              <CardHeader>
                <CardTitle>Create New Mission</CardTitle>
                <CardDescription>
                  Define mission details and assign drones
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                    <FormField
                      control={form.control}
                      name="name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Mission Name</FormLabel>
                          <FormControl>
                            <Input placeholder="Agricultural Survey" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={form.control}
                      name="description"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Description</FormLabel>
                          <FormControl>
                            <Textarea 
                              placeholder="Describe the mission objectives and details"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={form.control}
                      name="location"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Location</FormLabel>
                          <FormControl>
                            <Input placeholder="Urban Farm Area" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <Accordion type="single" collapsible className="w-full">
                      <AccordionItem value="selected-drones">
                        <AccordionTrigger>Assign Drones</AccordionTrigger>
                        <AccordionContent>
                          <FormField
                            control={form.control}
                            name="selectedDrones"
                            render={() => (
                              <FormItem>
                                <div className="mb-4">
                                  <FormLabel className="text-base">Available Drones</FormLabel>
                                  <FormDescription>
                                    Select the drones you want to assign to this mission
                                  </FormDescription>
                                </div>
                                {dronesLoading ? (
                                  <p>Loading drones...</p>
                                ) : availableDrones.length === 0 ? (
                                  <p className="text-sm text-red-500">No available drones. All drones are currently assigned or offline.</p>
                                ) : (
                                  <div className="space-y-2">
                                    {availableDrones.map((drone) => (
                                      <FormField
                                        key={drone.id}
                                        control={form.control}
                                        name="selectedDrones"
                                        render={({ field }) => {
                                          return (
                                            <FormItem
                                              key={drone.id}
                                              className="flex flex-row items-start space-x-3 space-y-0"
                                            >
                                              <FormControl>
                                                <Checkbox
                                                  checked={field.value?.includes(drone.id)}
                                                  onCheckedChange={(checked) => {
                                                    return checked
                                                      ? field.onChange([...field.value, drone.id])
                                                      : field.onChange(
                                                          field.value?.filter(
                                                            (value) => value !== drone.id
                                                          )
                                                        )
                                                  }}
                                                />
                                              </FormControl>
                                              <FormLabel className="font-normal">
                                                {drone.name} ({drone.model}) - {drone.batteryLevel}% Battery
                                              </FormLabel>
                                            </FormItem>
                                          )
                                        }}
                                      />
                                    ))}
                                  </div>
                                )}
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </AccordionContent>
                      </AccordionItem>
                      
                      <AccordionItem value="schedule">
                        <AccordionTrigger>Schedule</AccordionTrigger>
                        <AccordionContent>
                          <h3 className="font-medium text-sm mb-2">Mission Launch Time</h3>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4 border rounded-md p-4 bg-muted/30">
                            <FormField
                              control={form.control}
                              name="startDate"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Start Date</FormLabel>
                                  <FormControl>
                                    <Input 
                                      type="date" 
                                      onChange={(e) => {
                                        const date = e.target.valueAsDate;
                                        if (date) {
                                          field.onChange(date);
                                        }
                                      }}
                                    />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            
                            <FormField
                              control={form.control}
                              name="startTime"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Start Time</FormLabel>
                                  <FormControl>
                                    <Input 
                                      type="time" 
                                      {...field}
                                    />
                                  </FormControl>
                                  <FormDescription>
                                    Time to launch the mission
                                  </FormDescription>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          </div>
                          
                          <h3 className="font-medium text-sm mb-2">Mission End Time (Optional)</h3>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border rounded-md p-4 bg-muted/30">
                            <FormField
                              control={form.control}
                              name="endDate"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>End Date</FormLabel>
                                  <FormControl>
                                    <Input 
                                      type="date" 
                                      onChange={(e) => {
                                        const date = e.target.valueAsDate;
                                        if (date) {
                                          field.onChange(date);
                                        }
                                      }}
                                    />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            
                            <FormField
                              control={form.control}
                              name="endTime"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>End Time</FormLabel>
                                  <FormControl>
                                    <Input 
                                      type="time" 
                                      {...field}
                                    />
                                  </FormControl>
                                  <FormDescription>
                                    Expected mission completion time
                                  </FormDescription>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          </div>
                                  
                          <FormField
                            control={form.control}
                            name="isRecurring"
                            render={({ field }) => (
                              <FormItem className="flex flex-row items-start space-x-3 space-y-0 mt-4">
                                <FormControl>
                                  <Checkbox
                                    checked={field.value}
                                    onCheckedChange={field.onChange}
                                  />
                                </FormControl>
                                <div className="space-y-1 leading-none">
                                  <FormLabel>Recurring Mission</FormLabel>
                                  <FormDescription>
                                    Enable if this mission should repeat on a schedule
                                  </FormDescription>
                                </div>
                              </FormItem>
                            )}
                          />
                          
                          {form.watch("isRecurring") && (
                            <FormField
                              control={form.control}
                              name="recurringSchedule"
                              render={({ field }) => (
                                <FormItem className="mt-4">
                                  <FormLabel>Schedule Pattern</FormLabel>
                                  <Select
                                    onValueChange={field.onChange}
                                    defaultValue={field.value}
                                  >
                                    <FormControl>
                                      <SelectTrigger>
                                        <SelectValue placeholder="Select schedule" />
                                      </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                      <SelectItem value="daily">Daily</SelectItem>
                                      <SelectItem value="weekly">Weekly</SelectItem>
                                      <SelectItem value="biweekly">Bi-weekly</SelectItem>
                                      <SelectItem value="monthly">Monthly</SelectItem>
                                    </SelectContent>
                                  </Select>
                                  <FormDescription>
                                    How often this mission should repeat
                                  </FormDescription>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          )}
                        </AccordionContent>
                      </AccordionItem>
                    </Accordion>
                    
                    <div className="pt-4">
                      <Button 
                        type="submit" 
                        className="w-full"
                        disabled={createMissionMutation.isPending}
                      >
                        {createMissionMutation.isPending ? (
                          <>Creating Mission...</>
                        ) : (
                          <>
                            <Save className="mr-2 h-4 w-4" /> 
                            Save Mission
                          </>
                        )}
                      </Button>
                    </div>
                  </form>
                </Form>
                
                <div className="mt-6">
                  <h3 className="font-medium mb-2">Waypoints ({waypoints.length})</h3>
                  {waypoints.length === 0 ? (
                    <p className="text-sm text-gray-500">No waypoints added. Click on the map to add waypoints.</p>
                  ) : (
                    <div className="space-y-2 max-h-60 overflow-y-auto">
                      {waypoints.map((waypoint, index) => (
                        <div key={index} className="flex justify-between items-center p-2 bg-gray-50 rounded border">
                          <div className="text-sm">
                            <span className="font-mono">
                              {waypoint.lat.toFixed(6)}°, {waypoint.lng.toFixed(6)}°
                            </span>
                            <span className="text-gray-500 ml-2">
                              {waypoint.altitude ? `${waypoint.altitude}m` : 'Default altitude'}
                            </span>
                          </div>
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => {
                              const newWaypoints = [...waypoints];
                              newWaypoints.splice(index, 1);
                              setWaypoints(newWaypoints);
                            }}
                          >
                            <Trash2 className="h-4 w-4 text-red-500" />
                          </Button>
                        </div>
                      ))}
                      
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="w-full"
                        onClick={() => setWaypoints([])}
                      >
                        Clear All Waypoints
                      </Button>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
            
            {/* Map for mission planning */}
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>Mission Waypoint Planning</CardTitle>
                <CardDescription>
                  Click on the map to add waypoints for your mission path
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[600px] w-full rounded-lg border border-gray-200 overflow-hidden">
                  <MapComponent 
                    drones={drones || []} 
                    missions={missions || []}
                    isPlanning={true}
                    waypoints={waypoints}
                    onWaypointAdded={(latlng) => {
                      setWaypoints([...waypoints, { 
                        lat: latlng.lat, 
                        lng: latlng.lng,
                        altitude: 50 // Default altitude in meters
                      }]);
                    }}
                  />
                </div>
              </CardContent>
            </Card>
          </div>
        </main>
      </div>
    </div>
  );
}
