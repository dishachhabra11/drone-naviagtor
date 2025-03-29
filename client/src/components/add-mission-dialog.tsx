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
  status: z.string(),
  isRecurring: z.boolean().default(false),
  recurringSchedule: z.string().optional(),
  startDate: z.date().optional(),
  endDate: z.date().optional(),
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
    const { selectedDrones, ...missionData } = values;
    
    const mission: InsertMission = {
      ...missionData,
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
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
