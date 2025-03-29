import { cn } from "@/lib/utils";

interface BatteryIndicatorProps {
  level: number;
  className?: string;
  showText?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export function BatteryIndicator({ 
  level, 
  className,
  showText = true,
  size = 'md'
}: BatteryIndicatorProps) {
  // Ensure level is between 0 and 100
  const batteryLevel = Math.max(0, Math.min(100, level));
  
  // Determine battery color based on level
  const getColor = () => {
    if (batteryLevel > 60) return "bg-green-500";
    if (batteryLevel > 20) return "bg-yellow-500";
    return "bg-red-500";
  };
  
  // Determine width based on size
  const getWidth = () => {
    switch (size) {
      case 'sm': return 'w-12';
      case 'lg': return 'w-24';
      case 'md':
      default: return 'w-16';
    }
  };
  
  // Determine height based on size
  const getHeight = () => {
    switch (size) {
      case 'sm': return 'h-1.5';
      case 'lg': return 'h-3';
      case 'md':
      default: return 'h-2';
    }
  };
  
  // Determine text size based on indicator size
  const getTextSize = () => {
    switch (size) {
      case 'sm': return 'text-xs';
      case 'lg': return 'text-sm';
      case 'md':
      default: return 'text-xs';
    }
  };

  return (
    <div className={cn("flex flex-col", className)}>
      <div className={cn("bg-gray-200 rounded-full", getWidth(), getHeight())}>
        <div 
          className={cn("rounded-full", getHeight(), getColor())} 
          style={{ width: `${batteryLevel}%` }}
        ></div>
      </div>
      {showText && (
        <span className={cn("text-gray-500", getTextSize())}>{batteryLevel}%</span>
      )}
    </div>
  );
}
