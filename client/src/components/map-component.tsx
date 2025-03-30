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
 * Simply shows the drone at its current position - no client-side animation
 */
function MovingMarker({ 
  drone, 
  path, 
  mission
}: { 
  drone: Drone, 
  path: L.LatLng[], 
  mission?: Mission
}) {
  // Debug logging to check what's happening with the moving marker
  console.log(`MovingMarker - Drone ${drone.id} (${drone.name}): status=${drone.status}, assignedMissionId=${drone.assignedMissionId}`);
  const map = useMap();
  
  // Get the current location from the drone's lastKnownLocation or use first waypoint as fallback
  const position = useMemo(() => {
    if (drone.lastKnownLocation) {
      try {
        let location: any = drone.lastKnownLocation;
        // Parse if string
        if (typeof location === 'string') {
          location = JSON.parse(location);
        }
        // Ensure we have lat and lng
        if (location && typeof location.lat === 'number' && typeof location.lng === 'number') {
          return L.latLng(location.lat, location.lng);
        }
      } catch (error) {
        console.error(`Error parsing drone location for ${drone.name}:`, error);
      }
    }
    
    // Fallback to path's first point if available
    if (path.length > 0) {
      return path[0];
    }
    
    return null;
  }, [drone.lastKnownLocation, path]);
  
  // Show the path on the map when this drone is active
  useEffect(() => {
    if (position && path.length > 1) {
      // Fit bounds to show the entire path including the drone's current position
      const bounds = L.latLngBounds([position, ...path]);
      map.fitBounds(bounds);
    }
  }, [map, position, path]);
  
  // If drone has no position, don't render
  if (!position) return null;
  
  // Create drone icon for the active mission
  const droneIcon = L.divIcon({
    className: 'custom-drone-icon-moving',
    html: `<div style="
      width: 24px; 
      height: 24px; 
      background-color: #FF9800; 
      border-radius: 50%; 
      border: 3px solid white;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 0 8px rgba(0,0,0,0.5);
      position: relative;
    ">
      <div style="
        position: absolute;
        width: 12px;
        height: 12px;
        background-color: #FF3D00;
        border-radius: 50%;
      "></div>
    </div>`,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
  });
  
  return (
    <Marker position={position} icon={droneIcon}>
      <Tooltip direction="top" permanent>
        {drone.name} (Active)
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
      console.log(`Found ${missionsToActivate.length} missions to activate:`, missionsToActivate);
      
      // Use Promise.all to wait for all updates to complete
      Promise.all(missionsToActivate.map(async (mission) => {
        try {
          console.log(`Activating mission ${mission.id}: ${mission.name}`);
          
          const response = await fetch(`/api/missions/${mission.id}`, {
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ status: 'in-progress' }),
          });
          
          if (!response.ok) {
            throw new Error(`Failed to update mission status: ${response.statusText}`);
          }
          
          console.log(`Successfully activated mission: ${mission.name}`);
          
          // Force a re-fetch of missions data to update the UI
          await fetch('/api/missions')
            .then(res => res.json())
            .then(data => {
              console.log('Refreshed missions data:', data);
              // Manually trigger a check of active missions
              setCurrentTime(new Date());
            });
        } catch (error) {
          console.error(`Failed to update mission ${mission.id} status:`, error);
        }
      }));
    }
  }, [currentTime, missions]);
  
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
    // Debugging information
    console.log(`Active missions count: ${activeMissions.length}`);
    activeMissions.forEach(mission => {
      console.log(`Active mission ${mission.id}: ${mission.name} (${mission.status})`);
      if (mission.waypoints) {
        console.log(`  Waypoints: ${mission.waypoints.length}`);
      } else {
        console.log(`  No waypoints`);
      }
    });
    
    return activeMissions.map(mission => {
      // Skip missions without waypoints
      if (!mission.waypoints || mission.waypoints.length < 2) {
        console.log(`Mission ${mission.id} (${mission.name}) skipped: insufficient waypoints`);
        return null;
      }
      
      // Find the assigned drone(s) for this mission
      const assignedDrones = drones.filter(drone => {
        // A drone is assigned to a mission if:
        // 1. Its assignedMissionId matches the mission ID, OR
        // 2. Its status is 'in-mission' and the mission is in-progress (for immediate launch)
        const isAssignedById = drone.assignedMissionId === mission.id;
        const isAssignedByStatus = drone.status === 'in-mission' && mission.status === 'in-progress';
        const isAssigned = isAssignedById || isAssignedByStatus;
        
        console.log(`Checking drone ${drone.id} (${drone.name}): status=${drone.status}, assignedMissionId=${drone.assignedMissionId}, missionId=${mission.id}, isAssigned=${isAssigned}`);
        return isAssigned;
      });
      
      console.log(`Mission ${mission.id} has ${assignedDrones.length} assigned drones`);
      
      if (assignedDrones.length === 0) {
        console.log(`Mission ${mission.id} (${mission.name}) skipped: no assigned drones`);
        return null;
      }
      
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
      
      console.log(`Mission ${mission.id} (${mission.name}): Using drone speed of ${calculatedSpeed} m/s`);
      
      // Determine if the mission is active
      const now = new Date();
      const isPlannedAndStarted = mission.status === 'planned' && 
                                  mission.startTime && 
                                  new Date(mission.startTime) <= now;
      
      const isActive = (mission.status === 'in-progress' || isPlannedAndStarted) ? true : false;
      
      if (!isActive) {
        console.log(`Mission ${mission.id} (${mission.name}) is not active yet`);
      }
      
      // Create a moving marker for each assigned drone
      return assignedDrones.map(drone => {
        console.log(`Creating marker for drone ${drone.id} (${drone.name}) on mission ${mission.id}, active=${isActive}`);
        return (
          <MovingMarker 
            key={`moving-drone-${drone.id}`}
            drone={drone}
            path={path}
            mission={mission}
          />
        );
      });
    }).filter(Boolean).flat();
  }, [activeMissions, drones, currentTime]);
  
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
            dashArray: isActive ? '5, 5' : '',
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
