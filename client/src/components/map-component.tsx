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
 * Shows a drone moving along its path during missions
 */
function MovingMarker({ 
  drone, 
  path, 
  isActive,
  speed = 10 // meters per second
}: { 
  drone: Drone, 
  path: L.LatLng[], 
  isActive: boolean,
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
  
  // Create custom drone icon
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
      box-shadow: 0 0 8px rgba(0,0,0,0.7);
      position: relative;
    ">
      <div style="
        position: absolute;
        width: 12px;
        height: 12px;
        background-color: #FF3D00;
        border-radius: 50%;
        animation: pulse 1.5s infinite;
      "></div>
    </div>`,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
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
  
  // Find active missions and create moving markers for them
  const activeMissions = useMemo(() => {
    return missions.filter(mission => mission.status === 'in-progress');
  }, [missions]);
  
  const activeMissionMarkers = useMemo(() => {
    return activeMissions.map(mission => {
      // Skip missions without waypoints
      if (!mission.waypoints || mission.waypoints.length < 2) return null;
      
      // Find the assigned drone(s) for this mission
      const assignedDrones = drones.filter(drone => 
        drone.status === 'in-mission' && 
        drone.assignedMissionId === mission.id
      );
      
      if (assignedDrones.length === 0) return null;
      
      // Create path from waypoints for the moving marker
      const path = mission.waypoints.map(wp => L.latLng(wp.lat, wp.lng));
      
      return assignedDrones.map(drone => (
        <MovingMarker 
          key={`moving-drone-${drone.id}`}
          drone={drone}
          path={path}
          isActive={true}
          speed={drone.speed || 10} // Use drone speed if available, otherwise default to 10 m/s
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
      
      return (
        <Polyline 
          key={`mission-path-${mission.id}`}
          positions={pathPositions}
          pathOptions={{ 
            color: '#FF9800',
            weight: 3,
            opacity: 0.7
          }}
        />
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
