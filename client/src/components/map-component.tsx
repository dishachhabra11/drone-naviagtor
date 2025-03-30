import { useState, useCallback, useMemo, useEffect, useRef } from "react";
import { Drone, Mission, Waypoint, locationSchema } from "@shared/schema";
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMapEvents, useMap, Tooltip } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { OpenStreetMapProvider } from 'leaflet-geosearch';
import { 
  processWaypoints, 
  formatDistance, 
  formatTime, 
  calculateMissionStats 
} from "@/lib/mission-calculations";

const provider = new OpenStreetMapProvider();

/**
 * Moving marker component for active drone missions
 * Shows a drone moving along its path during missions with speed based on mission duration
 */
function MovingMarker({ 
  drone, 
  path, 
  isActive,
  mission,
  speed = 10 // meters per second (default)
}: { 
  drone: Drone, 
  path: L.LatLng[], 
  isActive: boolean,
  mission?: Mission,
  speed?: number 
}) {
  const map = useMap();
  const [position, setPosition] = useState<L.LatLng | null>(null);
  const [segmentIndex, setSegmentIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const animationRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number | null>(null);
  
  // Set initial position
  useEffect(() => {
    if (path.length > 0) {
      setPosition(path[0]);
      setSegmentIndex(0);
      setProgress(0);
    }
  }, [path]);
  
  // Handle active state change
  useEffect(() => {
    if (isActive && path.length > 1) {
      // Fit bounds to show the entire path
      map.fitBounds(L.latLngBounds(path));
      
      // Start animation
      lastTimeRef.current = null;
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
      
      const animate = (time: number) => {
        if (lastTimeRef.current === null) {
          lastTimeRef.current = time;
          animationRef.current = requestAnimationFrame(animate);
          return;
        }
        
        const deltaTime = time - lastTimeRef.current;
        lastTimeRef.current = time;
        
        // Calculate how far to move based on speed and time
        const distanceToMove = (speed * deltaTime) / 1000; // m/s * ms / 1000 = meters
        
        // Update progress
        setProgress(prev => {
          let newProgress = prev + distanceToMove;
          
          // Current segment
          const currentSegment = segmentIndex;
          if (currentSegment < path.length - 1) {
            const from = path[currentSegment];
            const to = path[currentSegment + 1];
            const segmentLength = from.distanceTo(to);
            
            // If we've completed this segment
            if (newProgress >= segmentLength) {
              newProgress -= segmentLength;
              setSegmentIndex(si => Math.min(si + 1, path.length - 2));
            }
            
            // Calculate new position along the segment
            const ratio = Math.min(newProgress / segmentLength, 1);
            const newLat = from.lat + (to.lat - from.lat) * ratio;
            const newLng = from.lng + (to.lng - from.lng) * ratio;
            setPosition(L.latLng(newLat, newLng));
          }
          
          return newProgress;
        });
        
        // Continue animation if not at the end
        if (segmentIndex < path.length - 2 || progress < path[segmentIndex].distanceTo(path[segmentIndex + 1])) {
          animationRef.current = requestAnimationFrame(animate);
        }
      };
      
      animationRef.current = requestAnimationFrame(animate);
    } else {
      // Stop animation
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = null;
      }
    }
    
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = null;
      }
    };
  }, [isActive, path, map, segmentIndex, progress, speed]);
  
  if (!isActive || !position) return null;
  
  // Calculate mission progress percentage
  const calculateMissionProgress = () => {
    if (!mission || !path.length) return 0;
    
    // If we're at the end, return 100%
    if (segmentIndex >= path.length - 1) return 100;
    
    // Calculate total distance traveled
    let totalDistance = 0;
    for (let i = 0; i < segmentIndex; i++) {
      totalDistance += path[i].distanceTo(path[i+1]);
    }
    
    // Add the distance traveled in current segment
    if (segmentIndex < path.length - 1) {
      const from = path[segmentIndex];
      const to = path[segmentIndex + 1];
      const segmentLength = from.distanceTo(to);
      const ratio = Math.min(progress / segmentLength, 1);
      totalDistance += segmentLength * ratio;
    }
    
    // Calculate total path distance
    let pathTotalDistance = 0;
    for (let i = 0; i < path.length - 1; i++) {
      pathTotalDistance += path[i].distanceTo(path[i+1]);
    }
    
    return pathTotalDistance > 0 ? (totalDistance / pathTotalDistance) * 100 : 0;
  };
  
  const progressPercent = calculateMissionProgress();
  
  // Create custom drone icon with progress indicator
  const droneIcon = L.divIcon({
    className: 'custom-drone-icon-moving',
    html: `<div style="
      position: relative;
      width: 28px; 
      height: 28px;
    ">
      <div style="
        width: 24px; 
        height: 24px; 
        background-color: #FF9800; 
        border-radius: 50%; 
        border: 3px solid white;
        display: flex;
        align-items: center;
        justify-content: center;
        box-shadow: 0 0 8px rgba(0,0,0,0.7);
        position: relative;
        z-index: 2;
        animation: throb 1.5s infinite cubic-bezier(0.66, 0, 0, 1);
      ">
        <div style="
          position: absolute;
          width: 14px;
          height: 14px;
          background-color: #FF3D00;
          border-radius: 50%;
          animation: pulse 1.5s infinite;
          z-index: 3;
        "></div>
      </div>
      ${progressPercent > 0 ? `
        <div style="
          position: absolute;
          top: -8px;
          left: -8px;
          width: 40px;
          height: 40px;
          border-radius: 50%;
          background: conic-gradient(#4CAF50 ${progressPercent}%, transparent ${progressPercent}%);
          clip-path: polygon(50% 50%, 100% 0, 100% 100%, 0 100%, 0 0);
          opacity: 0.7;
          z-index: 1;
        "></div>
      ` : ''}
    </div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  });
  
  return (
    <Marker position={position} icon={droneIcon}>
      <Tooltip direction="top" permanent>
        {drone.name}
      </Tooltip>
    </Marker>
  );
}
import { Skeleton } from "@/components/ui/skeleton";

// Fix the Leaflet icon issue
// This is necessary for proper Leaflet functionality in React
// @ts-ignore
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// We'll apply the styles directly to each popup to avoid TypeScript issues

interface MapComponentProps {
  drones: Drone[];
  missions: Mission[];
  isPlanning?: boolean;
  waypoints?: Waypoint[];
  onWaypointAdded?: (latlng: L.LatLng) => void;
}

// Component to handle map clicks for waypoint planning
function MapClickHandler({ onWaypointAdded }: { 
  onWaypointAdded?: (latlng: L.LatLng) => void
}) {
  const map = useMapEvents({
    click: (e) => {
      if (onWaypointAdded) {
        onWaypointAdded(e.latlng);
      }
    },
  });

  // Expose a function to search for locations
  // This is designed to be called from outside via a ref
  const searchLocation = async (query: string) => {
    try {
      const results = await provider.search({ query });
      if (results.length > 0) {
        const { x, y } = results[0];
        map.setView([y, x], 13);
        if (onWaypointAdded) {
          onWaypointAdded(L.latLng(y, x));
        }
        return true;
      }
      return false;
    } catch (error) {
      console.error("Error searching for location:", error);
      return false;
    }
  };

  // Mount this function to the window for easier access from parent components
  // This is a workaround for React's unidirectional data flow
  useEffect(() => {
    // @ts-ignore - Intentionally adding a property to window
    window.__mapSearchLocation = searchLocation;
    return () => {
      // @ts-ignore - Clean up when component unmounts
      delete window.__mapSearchLocation;
    };
  }, []);

  return null;
}

export function MapComponent({ drones, missions, isPlanning = false, waypoints = [], onWaypointAdded }: MapComponentProps) {
  // Find an initial center for the map based on drones
  const mapCenter = useMemo(() => {
    if (drones.length > 0) {
      const validDrones = drones.filter(d => {
        if (!d.lastKnownLocation) return false;
        try {
          return locationSchema.safeParse(d.lastKnownLocation).success;
        } catch {
          return false;
        }
      });
      
      if (validDrones.length > 0) {
        const firstDrone = validDrones[0];
        try {
          const location = locationSchema.parse(firstDrone.lastKnownLocation);
          return [location.lat, location.lng] as [number, number];
        } catch (error) {
          console.error("Error parsing drone location:", error);
        }
      }
    }
    
    if (waypoints.length > 0) {
      return [waypoints[0].lat, waypoints[0].lng] as [number, number];
    }
    
    // Default center if no drones or waypoints
    return [34.0522, -118.2437] as [number, number];
  }, [drones, waypoints]);
  
  // Convert waypoints for polyline
  const waypointPositions = useMemo(() => {
    return waypoints.map(wp => [wp.lat, wp.lng] as [number, number]);
  }, [waypoints]);
  
  // Create drone markers with custom icons
  const droneMarkers = useMemo(() => {
    return drones.map(drone => {
      if (!drone.lastKnownLocation) return null;
      
      try {
        const location = locationSchema.parse(drone.lastKnownLocation);
        if (!location.lat || !location.lng) return null;
        
        // Create icon based on drone status
        const iconColor = drone.status === 'available' 
          ? 'green' 
          : drone.status === 'in-mission' 
            ? 'orange' 
            : 'red';
        
        const droneIcon = L.divIcon({
          className: 'custom-drone-icon',
          html: `<div style="
            width: 20px; 
            height: 20px; 
            background-color: ${iconColor}; 
            border-radius: 50%; 
            border: 2px solid white;
            display: flex;
            align-items: center;
            justify-content: center;
            box-shadow: 0 0 5px rgba(0,0,0,0.5);
          "></div>`,
          iconSize: [20, 20],
          iconAnchor: [10, 10],
        });
        
        return (
          <Marker 
            key={`drone-${drone.id}`}
            position={[location.lat, location.lng]} 
            icon={droneIcon}
          >
            <Popup className="custom-popup" minWidth={200} maxWidth={300} closeButton={true} autoPan={true} autoPanPadding={[50, 50] as [number, number]}>
              <div className="p-3">
                <h4 className="text-lg font-bold mb-1">{drone.name}</h4>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <span className="text-gray-500">Model:</span>
                  <span className="font-medium">{drone.model}</span>
                  
                  <span className="text-gray-500">Status:</span>
                  <span className={`font-medium ${
                    drone.status === 'available' ? 'text-green-600' : 
                    drone.status === 'in-mission' ? 'text-orange-500' : 
                    'text-red-500'
                  }`}>{drone.status}</span>
                  
                  <span className="text-gray-500">Battery:</span>
                  <span className={`font-medium ${
                    drone.batteryLevel > 70 ? 'text-green-600' : 
                    drone.batteryLevel > 30 ? 'text-orange-500' : 
                    'text-red-500'
                  }`}>{drone.batteryLevel}%</span>
                </div>
              </div>
            </Popup>
          </Marker>
        );
      } catch (error) {
        console.error(`Error processing drone ${drone.id}:`, error);
        return null;
      }
    }).filter(Boolean);
  }, [drones]);
  
  // Process waypoints to add distance and time calculations
  const processedWaypoints = useMemo(() => {
    return waypoints.length > 0 ? processWaypoints(waypoints) : [];
  }, [waypoints]);
  
  // Calculate overall mission statistics
  const missionStats = useMemo(() => {
    return processedWaypoints.length > 0 ? calculateMissionStats(processedWaypoints) : { 
      totalDistance: 0, 
      totalTime: 0 
    };
  }, [processedWaypoints]);
  
  // Create waypoint markers with custom icons and enhanced information
  const waypointMarkers = useMemo(() => {
    return processedWaypoints.map((wp, index) => {
      // Use blue for first/last waypoints, and green for intermediate points
      const isEndpoint = index === 0 || index === processedWaypoints.length - 1;
      const backgroundColor = isEndpoint ? '#3B82F6' : '#10B981';
      
      const waypointIcon = L.divIcon({
        className: 'custom-waypoint-icon',
        html: `<div style="
          width: 16px; 
          height: 16px; 
          background-color: ${backgroundColor}; 
          border-radius: 50%; 
          border: 2px solid white;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 10px;
          color: white;
          font-weight: bold;
          box-shadow: 0 0 5px rgba(0,0,0,0.5);
        ">${index + 1}</div>`,
        iconSize: [16, 16],
        iconAnchor: [8, 8],
      });
      
      return (
        <Marker 
          key={`waypoint-${index}`}
          position={[wp.lat, wp.lng]} 
          icon={waypointIcon}
        >
          <Popup className="custom-popup" minWidth={220} maxWidth={300} closeButton={true} autoPan={true} autoPanPadding={[50, 50] as [number, number]}>
            <div className="p-3">
              <h4 className="text-lg font-bold mb-2">Waypoint {index + 1}</h4>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <span className="text-gray-500">Altitude:</span>
                <span className="font-medium">{wp.altitude || 'Default'}m</span>
                
                <span className="text-gray-500">Coordinates:</span>
                <span className="font-medium">{wp.lat.toFixed(5)}, {wp.lng.toFixed(5)}</span>
                
                {index > 0 && (
                  <>
                    <span className="text-gray-500">Distance from prev:</span>
                    <span className="font-medium">{formatDistance(wp.distanceFromPrevious || 0)}</span>
                    
                    <span className="text-gray-500">Altitude change:</span>
                    {wp.altitude !== undefined && processedWaypoints[index-1]?.altitude !== undefined ? (
                      <span className={`font-medium ${
                        ((wp.altitude || 0) - (processedWaypoints[index-1]?.altitude || 0)) > 0 ? 'text-amber-600' : 
                        ((wp.altitude || 0) - (processedWaypoints[index-1]?.altitude || 0)) < 0 ? 'text-blue-600' : 
                        'text-gray-600'
                      }`}>
                        {((wp.altitude || 0) - (processedWaypoints[index-1]?.altitude || 0)) > 0 ? '+' : ''}
                        {(wp.altitude || 0) - (processedWaypoints[index-1]?.altitude || 0)}m
                      </span>
                    ) : (
                      <span className="font-medium text-gray-600">0m</span>
                    )}
                    
                    <span className="text-gray-500">Est. flight time:</span>
                    <span className="font-medium">{formatTime(wp.estimatedTimeFromPrevious || 0)}</span>
                  </>
                )}
              </div>
              
              {index === processedWaypoints.length - 1 && processedWaypoints.length > 1 && (
                <div className="mt-3 pt-3 border-t border-gray-200">
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <span className="text-gray-500 font-medium">Total Distance:</span>
                    <span className="font-bold text-blue-600">{formatDistance(missionStats.totalDistance)}</span>
                    
                    <span className="text-gray-500 font-medium">Total Time:</span>
                    <span className="font-bold text-blue-600">{formatTime(missionStats.totalTime)}</span>
                  </div>
                </div>
              )}
            </div>
          </Popup>
        </Marker>
      );
    });
  }, [processedWaypoints, missionStats]);
  
  // Check scheduled missions and find ones that should be active based on current time
  const [currentTime, setCurrentTime] = useState(new Date());
  
  // Update current time every minute to check for scheduled missions
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 10000); // Check every 10 seconds
    
    return () => clearInterval(interval);
  }, []);
  
  // Check for missions that need status updates (planned -> in-progress)
  useEffect(() => {
    const now = new Date();
    
    // Find missions that should be activated
    const missionsToActivate = missions.filter(mission => 
      mission.status === 'planned' && 
      mission.startTime && 
      new Date(mission.startTime) <= now
    );
    
    // Update mission status to in-progress
    if (missionsToActivate.length > 0) {
      missionsToActivate.forEach(async mission => {
        try {
          await fetch(`/api/missions/${mission.id}`, {
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ status: 'in-progress' }),
          });
          
          // Also update assigned drones status
          const assignedDrones = drones.filter(drone => 
            drone.assignedMissionId === mission.id && 
            drone.status === 'available'
          );
          
          assignedDrones.forEach(async drone => {
            await fetch(`/api/drones/${drone.id}`, {
              method: 'PATCH',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({ status: 'in-mission' }),
            });
          });
          
          console.log(`Activated mission: ${mission.name}`);
        } catch (error) {
          console.error(`Failed to update mission ${mission.id} status:`, error);
        }
      });
    }
  }, [currentTime, missions, drones]);
  
  const activeMissions = useMemo(() => {
    const now = currentTime;
    return missions.filter(mission => {
      // Already in-progress missions are active
      if (mission.status === 'in-progress') return true;
      
      // Planned missions should activate when their start time is reached
      if (mission.status === 'planned' && mission.startTime) {
        const startTime = new Date(mission.startTime);
        return startTime <= now;
      }
      
      return false;
    });
  }, [missions, currentTime]);
  
  // Calculate the total distance of a mission path
  const calculateTotalPathDistance = (waypoints: Waypoint[]): number => {
    if (!waypoints || waypoints.length < 2) return 0;
    
    let totalDistance = 0;
    for (let i = 0; i < waypoints.length - 1; i++) {
      const p1 = L.latLng(waypoints[i].lat, waypoints[i].lng);
      const p2 = L.latLng(waypoints[i + 1].lat, waypoints[i + 1].lng);
      totalDistance += p1.distanceTo(p2);
    }
    
    return totalDistance;
  };
  
  const activeMissionMarkers = useMemo(() => {
    return activeMissions.map(mission => {
      // Skip missions without waypoints
      if (!mission.waypoints || mission.waypoints.length < 2) return null;
      
      // Find the assigned drone(s) for this mission
      const assignedDrones = drones.filter(drone => 
        (drone.status === 'in-mission' || drone.status === 'available') && 
        drone.assignedMissionId === mission.id
      );
      
      if (assignedDrones.length === 0) return null;
      
      // Create path from waypoints for the moving marker
      const path = mission.waypoints.map(wp => L.latLng(wp.lat, wp.lng));
      
      // Calculate appropriate speed based on mission data and estimated time
      let calculatedSpeed = 10; // Default speed in meters per second
      
      // If we have mission start and end times, calculate speed to complete within that timeframe
      if (mission.startTime && mission.endTime) {
        const startTime = new Date(mission.startTime);
        const endTime = new Date(mission.endTime);
        const missionDuration = (endTime.getTime() - startTime.getTime()) / 1000; // in seconds
        
        if (missionDuration > 0) {
          const pathDistance = calculateTotalPathDistance(mission.waypoints);
          if (pathDistance > 0) {
            // Speed = distance / time (meters per second)
            calculatedSpeed = pathDistance / missionDuration;
          }
        }
      } else {
        // Calculate based on processed waypoints
        const processedPath = processWaypoints(mission.waypoints);
        const stats = calculateMissionStats(processedPath);
        if (stats.totalDistance > 0 && stats.totalTime > 0) {
          calculatedSpeed = stats.totalDistance / stats.totalTime;
        }
      }
      
      // Ensure speed is within reasonable bounds (1-30 m/s)
      calculatedSpeed = Math.max(1, Math.min(30, calculatedSpeed));
      
      // Create a moving marker for each assigned drone
      return assignedDrones.map(drone => (
        <MovingMarker 
          key={`moving-drone-${drone.id}`}
          drone={drone}
          path={path}
          mission={mission}
          isActive={true}
          speed={calculatedSpeed}
        />
      ));
    }).filter(Boolean).flat();
  }, [activeMissions, drones]);
  
  // Add mission path lines for active missions
  const missionPathLines = useMemo(() => {
    return activeMissions.map(mission => {
      // Skip missions without waypoints
      if (!mission.waypoints || mission.waypoints.length < 2) return null;
      
      const pathPositions = mission.waypoints.map(wp => [wp.lat, wp.lng] as [number, number]);
      
      // Add animation and styling for currently active missions vs. completed ones
      const isActive = mission.status === 'in-progress';
      const className = isActive ? 'mission-path-active' : '';
      
      return (
        <Polyline 
          key={`mission-path-${mission.id}`}
          positions={pathPositions}
          className={className}
          pathOptions={{ 
            color: isActive ? '#FF9800' : '#4CAF50',
            weight: isActive ? 4 : 3,
            opacity: isActive ? 0.8 : 0.6,
            lineCap: 'round',
            lineJoin: 'round',
            dashArray: isActive ? '5, 10' : '',
          }}
        >
          <Tooltip direction="top" sticky>
            <div className="p-1 text-xs font-medium">
              <span className="font-bold">{mission.name}</span>
              {isActive && <span className="ml-1 text-orange-500">(Active)</span>}
            </div>
          </Tooltip>
        </Polyline>
      );
    }).filter(Boolean);
  }, [activeMissions]);
  
  return (
    <MapContainer 
      center={mapCenter} 
      zoom={13} 
      scrollWheelZoom={true}
      style={{ height: '100%', width: '100%' }}
      className="rounded-lg"
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      
      {/* Add click handler for waypoint planning */}
      {isPlanning && <MapClickHandler onWaypointAdded={onWaypointAdded} />}
      
      {/* Active mission path lines (solid) */}
      {missionPathLines}
      
      {/* Waypoint planning path line (dashed) */}
      {isPlanning && waypoints.length > 1 && (
        <Polyline 
          positions={waypointPositions}
          pathOptions={{ 
            color: '#3B82F6',
            weight: 3,
            opacity: 0.7,
            dashArray: '5, 5' 
          }}
        />
      )}
      
      {/* Static drone markers */}
      {droneMarkers}
      
      {/* Waypoint markers */}
      {waypointMarkers}
      
      {/* Moving drone markers for active missions */}
      {activeMissionMarkers}
    </MapContainer>
  );
}
