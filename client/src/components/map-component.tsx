import { useState, useCallback, useMemo, useEffect } from "react";
import { Drone, Mission, Waypoint, locationSchema } from "@shared/schema";
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMapEvents, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { OpenStreetMapProvider } from 'leaflet-geosearch';

const provider = new OpenStreetMapProvider();

function calculatePathDistance(waypoints: Waypoint[]): number {
  let distance = 0;
  for (let i = 0; i < waypoints.length - 1; i++) {
    const p1 = L.latLng(waypoints[i].lat, waypoints[i].lng);
    const p2 = L.latLng(waypoints[i + 1].lat, waypoints[i + 1].lng);
    distance += p1.distanceTo(p2);
  }
  return distance;
}

function calculateEstimatedDuration(distance: number, speed: number = 10): number {
  // Assuming speed in meters per second, returns duration in seconds
  return Math.ceil(distance / speed);
}

function MovingMarker({ position, path, isActive }: { position: L.LatLng, path: L.LatLng[], isActive: boolean }) {
  const map = useMap();
  
  useEffect(() => {
    if (isActive && path.length > 0) {
      map.fitBounds(L.latLngBounds(path));
    }
  }, [isActive, path]);

  return isActive ? <Marker position={position} /> : null;
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
function MapClickHandler({ onWaypointAdded, onSearch }: { 
  onWaypointAdded?: (latlng: L.LatLng) => void,
  onSearch?: (query: string) => void 
}) {
  const map = useMapEvents({
    click: (e) => {
      if (onWaypointAdded) {
        onWaypointAdded(e.latlng);
      }
    },
  });

  const handleSearch = async (query: string) => {
    const results = await provider.search({ query });
    if (results.length > 0) {
      const { x, y } = results[0];
      map.setView([y, x], 13);
      if (onWaypointAdded) {
        onWaypointAdded(L.latLng(y, x));
      }
    }
  };

  useEffect(() => {
    if (onSearch) {
      onSearch(handleSearch);
    }
  }, [onSearch]);

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
  
  // Create waypoint markers with custom icons
  const waypointMarkers = useMemo(() => {
    return waypoints.map((wp, index) => {
      const waypointIcon = L.divIcon({
        className: 'custom-waypoint-icon',
        html: `<div style="
          width: 16px; 
          height: 16px; 
          background-color: #3B82F6; 
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
          <Popup className="custom-popup" minWidth={200} maxWidth={300} closeButton={true} autoPan={true} autoPanPadding={[50, 50] as [number, number]}>
            <div className="p-3">
              <h4 className="text-lg font-bold mb-1">Waypoint {index + 1}</h4>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <span className="text-gray-500">Altitude:</span>
                <span className="font-medium">{wp.altitude || 'Default'}m</span>
                
                <span className="text-gray-500">Latitude:</span>
                <span className="font-medium">{wp.lat.toFixed(6)}</span>
                
                <span className="text-gray-500">Longitude:</span>
                <span className="font-medium">{wp.lng.toFixed(6)}</span>
              </div>
            </div>
          </Popup>
        </Marker>
      );
    });
  }, [waypoints]);
  
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
      
      {/* Drone markers */}
      {droneMarkers}
      
      {/* Waypoint markers */}
      {waypointMarkers}
      
      {/* Polyline connecting waypoints */}
      {waypoints.length > 1 && (
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
    </MapContainer>
  );
}
