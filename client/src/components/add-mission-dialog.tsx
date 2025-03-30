import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useAuth } from "@/hooks/use-auth";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { insertMissionSchema, InsertMission, Drone } from "@shared/schema";
import { Loader2 } from "lucide-react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

// Extended mission schema with validation
const missionFormSchema = z.object({
  name: z.string().min(3, "Name must be at least 3 characters"),
  description: z.string().optional(),
  location: z.string().min(2, "Location must be at least 2 characters"),
  status: z.enum(["planned", "in-progress", "completed", "failed"]).default("planned"),
  isRecurring: z.boolean().default(false),
  recurringSchedule: z.string().optional(),
  
  // Launch option
  launchImmediately: z.boolean().default(false),
  
  // Date and time fields for scheduling
  startDate: z.date().optional(),
  startTime: z.string().optional(),
  endDate: z.date().optional(),
  endTime: z.string().optional(),
  
  selectedDrones: z.array(z.number()).min(1, "You must select at least one drone"),
});

type MissionFormValues = z.infer<typeof missionFormSchema>;

interface AddMissionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  drones: Drone[];
}

export function AddMissionDialog({ open, onOpenChange, drones }: AddMissionDialogProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  
  const availableDrones = drones.filter(drone => drone.status === 'available');
  
  const form = useForm<MissionFormValues>({
    resolver: zodResolver(missionFormSchema),
    defaultValues: {
      name: "",
      description: "",
      location: "",
      status: "planned",
      isRecurring: false,
      recurringSchedule: "",
      launchImmediately: false,
      startDate: undefined,
      startTime: "",
      endDate: undefined,
      endTime: "",
      selectedDrones: [],
    },
  });
  
  const createMissionMutation = useMutation({
    mutationFn: async (data: InsertMission) => {
      const res = await apiRequest("POST", "/api/missions", data);
      return await res.json();
    },
    onSuccess: (mission) => {
      queryClient.invalidateQueries({ queryKey: ["/api/missions"] });
      toast({
        title: "Mission Created",
        description: "Your new mission has been created.",
      });
      
      // Create drone assignments
      const selectedDrones = form.getValues().selectedDrones;
      selectedDrones.forEach(async (droneId) => {
        try {
          await apiRequest("POST", `/api/missions/${mission.id}/assignments`, {
            droneId,
            missionId: mission.id,
            waypoints: [],
            completed: false,
          });
        } catch (error) {
          console.error("Error assigning drone:", error);
        }
      });
      
      queryClient.invalidateQueries({ queryKey: ["/api/drones"] });
      form.reset();
      onOpenChange(false);
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: `Failed to create mission: ${error.message}`,
        variant: "destructive",
      });
    },
  });
  
  function onSubmit(values: MissionFormValues) {
    const { selectedDrones, startDate, endDate, startTime, endTime, launchImmediately, ...otherData } = values;
    
    // Process start time and end time
    let combinedStartTime: Date | undefined;
    let combinedEndTime: Date | undefined;
    
    if (launchImmediately) {
      // Set start time to now if launching immediately
      combinedStartTime = new Date();
    } else if (startDate && startTime) {
      // Combine date and time into a single Date object
      const [hours, minutes] = startTime.split(':').map(Number);
      combinedStartTime = new Date(startDate);
      combinedStartTime.setHours(hours, minutes);
    }
    
    if (endDate && endTime) {
      // Combine date and time into a single Date object
      const [hours, minutes] = endTime.split(':').map(Number);
      combinedEndTime = new Date(endDate);
      combinedEndTime.setHours(hours, minutes);
    }
    
    // Set the mission status based on whether it's launching immediately
    const initialStatus = launchImmediately ? "in-progress" : "planned";
    
    // Create mission data with correct types
    const mission: InsertMission = {
      name: otherData.name,
      status: initialStatus,
      description: otherData.description,
      startTime: combinedStartTime,
      endTime: combinedEndTime,
      // Store location and recurring data in JSON location field
      location: JSON.stringify({
        address: otherData.location,
        isRecurring: otherData.isRecurring,
        recurringSchedule: otherData.recurringSchedule || null,
        launchImmediately: launchImmediately
      }),
      organizationId: user?.id || 0,
    };
    
    createMissionMutation.mutate(mission);
  }
  
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Create New Mission</DialogTitle>
          <DialogDescription>
            Define the details of your drone mission
          </DialogDescription>
        </DialogHeader>
        
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
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
              <AccordionItem value="assign-drones">
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
                            Select the drones to assign to this mission
                          </FormDescription>
                        </div>
                        
                        {availableDrones.length === 0 ? (
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
                  {form.watch("launchImmediately") && (
                    <div className="mb-4 p-2 bg-yellow-50 border border-yellow-100 rounded-md text-yellow-800 text-sm">
                      <p>Schedule settings are disabled because "Launch Immediately" is enabled.</p>
                    </div>
                  )}
                  <h3 className="font-medium text-sm mb-2">Mission Launch Time</h3>
                  <div className={`grid grid-cols-1 md:grid-cols-2 gap-4 mb-4 border rounded-md p-4 bg-muted/30 ${form.watch("launchImmediately") ? "opacity-50" : ""}`}>
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
                              disabled={form.watch("launchImmediately")}
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
                              disabled={form.watch("launchImmediately")}
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
                  <div className={`grid grid-cols-1 md:grid-cols-2 gap-4 border rounded-md p-4 bg-muted/30 ${form.watch("launchImmediately") ? "opacity-50" : ""}`}>
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
                              disabled={form.watch("launchImmediately")}
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
                              disabled={form.watch("launchImmediately")}
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
                            disabled={form.watch("launchImmediately")}
                          />
                        </FormControl>
                        <div className={`space-y-1 leading-none ${form.watch("launchImmediately") ? "opacity-50" : ""}`}>
                          <FormLabel>Recurring Mission</FormLabel>
                          <FormDescription>
                            Enable if this mission should repeat on a schedule
                          </FormDescription>
                        </div>
                      </FormItem>
                    )}
                  />
                  
                  {form.watch("isRecurring") && !form.watch("launchImmediately") && (
                    <FormField
                      control={form.control}
                      name="recurringSchedule"
                      render={({ field }) => (
                        <FormItem className="mt-4">
                          <FormLabel>Schedule Pattern</FormLabel>
                          <Select
                            onValueChange={field.onChange}
                            defaultValue={field.value}
                            disabled={form.watch("launchImmediately")}
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
            
            <FormField
              control={form.control}
              name="launchImmediately"
              render={({ field }) => (
                <FormItem className="flex flex-row items-start space-x-3 space-y-0 mt-4">
                  <FormControl>
                    <Checkbox
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                  <div className="space-y-1 leading-none">
                    <FormLabel>Launch Immediately</FormLabel>
                    <FormDescription>
                      Enable to start the mission as soon as it's created, using current drone location
                    </FormDescription>
                  </div>
                </FormItem>
              )}
            />
            
            <DialogFooter>
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button 
                type="submit"
                disabled={createMissionMutation.isPending}
              >
                {createMissionMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating...
                  </>
                ) : (
                  "Create Mission"
                )}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
