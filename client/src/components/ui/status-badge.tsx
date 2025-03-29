import { cn } from "@/lib/utils";
import { Badge } from "./badge";

type DroneStatus = 'available' | 'in-mission' | 'maintenance' | 'offline';
type MissionStatus = 'planned' | 'active' | 'completed' | 'cancelled';

interface StatusBadgeProps {
  status: DroneStatus | MissionStatus;
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const statusVariants = {
    // Drone statuses
    available: "bg-green-100 text-green-800",
    "in-mission": "bg-yellow-100 text-yellow-800",
    maintenance: "bg-blue-100 text-blue-800",
    offline: "bg-red-100 text-red-800",
    
    // Mission statuses
    planned: "bg-blue-100 text-blue-800",
    active: "bg-green-100 text-green-800",
    completed: "bg-gray-100 text-gray-800",
    cancelled: "bg-red-100 text-red-800",
  };
  
  const displayNames = {
    // Drone statuses
    available: "Available",
    "in-mission": "In Mission",
    maintenance: "Maintenance",
    offline: "Offline",
    
    // Mission statuses
    planned: "Planned",
    active: "Active",
    completed: "Completed",
    cancelled: "Cancelled",
  };

  return (
    <Badge className={cn("px-2.5 py-0.5 rounded-full text-xs font-medium", statusVariants[status], className)}>
      {displayNames[status]}
    </Badge>
  );
}
