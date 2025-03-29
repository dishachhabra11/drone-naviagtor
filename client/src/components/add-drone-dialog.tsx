import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useAuth } from "@/hooks/use-auth";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { insertDroneSchema, InsertDrone } from "@shared/schema";
import { Loader2 } from "lucide-react";

// Extended drone schema with validation
const droneFormSchema = insertDroneSchema.extend({
  name: z.string().min(2, "Name must be at least 2 characters"),
  model: z.string().min(2, "Model must be at least 2 characters"),
  batteryLevel: z.coerce.number().min(0, "Battery level must be at least 0").max(100, "Battery level cannot exceed 100"),
});

interface AddDroneDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AddDroneDialog({ open, onOpenChange }: AddDroneDialogProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  
  const form = useForm<z.infer<typeof droneFormSchema>>({
    resolver: zodResolver(droneFormSchema),
    defaultValues: {
      name: "",
      model: "",
      status: "available",
      batteryLevel: 100,
      lastKnownLocation: { lat: 34.0522, lng: -118.2437 },
      organizationId: user?.id || 0,
    },
  });
  
  const createDroneMutation = useMutation({
    mutationFn: async (data: InsertDrone) => {
      const res = await apiRequest("POST", "/api/drones", data);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/drones"] });
      toast({
        title: "Drone Added",
        description: "Your new drone has been added to the fleet.",
      });
      form.reset();
      onOpenChange(false);
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: `Failed to add drone: ${error.message}`,
        variant: "destructive",
      });
    },
  });
  
  function onSubmit(values: z.infer<typeof droneFormSchema>) {
    // Ensure organizationId is set to the current user's id
    const droneData = {
      ...values,
      organizationId: user?.id || 0,
    };
    
    createDroneMutation.mutate(droneData);
  }
  
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Add New Drone</DialogTitle>
          <DialogDescription>
            Enter the details of the drone you want to add to your fleet.
          </DialogDescription>
        </DialogHeader>
        
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Drone Name</FormLabel>
                  <FormControl>
                    <Input placeholder="Hawk-1" {...field} />
                  </FormControl>
                  <FormDescription>
                    A unique name to identify this drone
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="model"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Drone Model</FormLabel>
                  <FormControl>
                    <Input placeholder="DJI Mavic 3" {...field} />
                  </FormControl>
                  <FormDescription>
                    The manufacturer and model number
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="status"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Status</FormLabel>
                  <Select 
                    onValueChange={field.onChange} 
                    defaultValue={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a status" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="available">Available</SelectItem>
                      <SelectItem value="maintenance">Maintenance</SelectItem>
                      <SelectItem value="offline">Offline</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormDescription>
                    The current operational status of the drone
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="batteryLevel"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Battery Level (%)</FormLabel>
                  <FormControl>
                    <Input 
                      type="number" 
                      min="0" 
                      max="100" 
                      {...field} 
                    />
                  </FormControl>
                  <FormDescription>
                    Current battery percentage (0-100)
                  </FormDescription>
                  <FormMessage />
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
                disabled={createDroneMutation.isPending}
              >
                {createDroneMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Adding...
                  </>
                ) : (
                  "Add Drone"
                )}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
