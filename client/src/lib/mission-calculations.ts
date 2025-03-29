import { Waypoint } from "@shared/schema";

/**
 * Calculate the distance between two points using the Haversine formula
 * @param lat1 Latitude of point 1 (in degrees)
 * @param lon1 Longitude of point 1 (in degrees)
 * @param lat2 Latitude of point 2 (in degrees)
 * @param lon2 Longitude of point 2 (in degrees)
 * @returns Distance in meters
 */
export function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000; // Earth radius in meters
  const φ1 = (lat1 * Math.PI) / 180; // Convert to radians
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c; // Distance in meters

  return distance;
}

/**
 * Calculate altitude change between two waypoints
 * @param alt1 Altitude of waypoint 1 (in meters)
 * @param alt2 Altitude of waypoint 2 (in meters)
 * @returns Altitude change in meters (positive for climb, negative for descent)
 */
export function calculateAltitudeChange(alt1: number | undefined, alt2: number | undefined): number {
  const altitude1 = alt1 || 0;
  const altitude2 = alt2 || 0;
  return altitude2 - altitude1;
}

/**
 * Estimate flight time between two waypoints based on distance and average drone speed
 * @param distance Distance in meters
 * @param altitudeChange Altitude change in meters
 * @param averageSpeed Average drone speed in meters per second (default: 10 m/s)
 * @param verticalSpeed Vertical drone speed in meters per second (default: 5 m/s)
 * @returns Estimated flight time in seconds
 */
export function estimateFlightTime(
  distance: number, 
  altitudeChange: number, 
  averageSpeed: number = 10, 
  verticalSpeed: number = 5
): number {
  // Horizontal time
  const horizontalTime = distance / averageSpeed;
  
  // Vertical time (if applicable)
  const verticalTime = Math.abs(altitudeChange) / verticalSpeed;
  
  // Use the longer of the two times (assuming drone moves diagonally)
  return Math.max(horizontalTime, verticalTime);
}

/**
 * Process waypoints to add distance and time calculations
 * @param waypoints Array of waypoints
 * @param droneSpeed Average drone speed in meters per second (default: 10 m/s)
 * @returns Processed waypoints with distance and time calculations
 */
export function processWaypoints(
  waypoints: Waypoint[], 
  droneSpeed: number = 10
): Waypoint[] {
  if (waypoints.length === 0) return [];
  
  const result: Waypoint[] = [];
  let cumulativeDistance = 0;
  let cumulativeTime = 0;

  // First waypoint doesn't have a previous point
  result.push({
    ...waypoints[0],
    distanceFromPrevious: 0,
    distanceFromStart: 0,
    estimatedTimeFromPrevious: 0,
    estimatedTimeFromStart: 0
  });

  // Process remaining waypoints
  for (let i = 1; i < waypoints.length; i++) {
    const prev = waypoints[i - 1];
    const current = waypoints[i];
    
    // Calculate distance from previous waypoint
    const distance = calculateDistance(prev.lat, prev.lng, current.lat, current.lng);
    
    // Calculate altitude change
    const altitudeChange = calculateAltitudeChange(prev.altitude, current.altitude);
    
    // Estimate flight time
    const time = estimateFlightTime(distance, altitudeChange, droneSpeed);
    
    // Update cumulative values
    cumulativeDistance += distance;
    cumulativeTime += time;
    
    result.push({
      ...current,
      distanceFromPrevious: distance,
      distanceFromStart: cumulativeDistance,
      estimatedTimeFromPrevious: time,
      estimatedTimeFromStart: cumulativeTime
    });
  }
  
  return result;
}

/**
 * Format distance for display
 * @param distance Distance in meters
 * @returns Formatted distance string (e.g., "1.2 km" or "450 m")
 */
export function formatDistance(distance: number): string {
  if (distance >= 1000) {
    return `${(distance / 1000).toFixed(1)} km`;
  }
  return `${Math.round(distance)} m`;
}

/**
 * Format time for display
 * @param seconds Time in seconds
 * @returns Formatted time string (e.g., "1h 15m" or "45m 30s")
 */
export function formatTime(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainingSeconds = Math.round(seconds % 60);
  
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  } else if (minutes > 0) {
    return `${minutes}m ${remainingSeconds}s`;
  }
  return `${remainingSeconds}s`;
}

/**
 * Calculate the total mission statistics from waypoints
 * @param waypoints Processed waypoints array
 * @returns Object containing total distance and time
 */
export function calculateMissionStats(waypoints: Waypoint[]): { 
  totalDistance: number; 
  totalTime: number; 
  maxAltitude: number;
  minAltitude: number;
} {
  if (waypoints.length === 0) {
    return { totalDistance: 0, totalTime: 0, maxAltitude: 0, minAltitude: 0 };
  }
  
  // Get total distance and time from the last waypoint
  const lastWaypoint = waypoints[waypoints.length - 1];
  const totalDistance = lastWaypoint.distanceFromStart || 0;
  const totalTime = lastWaypoint.estimatedTimeFromStart || 0;
  
  // Calculate min/max altitude
  const altitudes = waypoints
    .map(wp => wp.altitude || 0)
    .filter(alt => alt > 0);
  
  const maxAltitude = altitudes.length > 0 ? Math.max(...altitudes) : 0;
  const minAltitude = altitudes.length > 0 ? Math.min(...altitudes) : 0;
  
  return { totalDistance, totalTime, maxAltitude, minAltitude };
}