import { useState, useCallback, useMemo } from "react";
import { Drone, Mission, Waypoint, locationSchema } from "@shared/schema";
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Skeleton } from "@/components/ui/skeleton";

// Fix the Leaflet icon issue
// This is necessary for proper Leaflet functionality in React
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

interface MapComponentProps {
  drones: Drone[];
  missions: Mission[];
  isPlanning?: boolean;
  waypoints?: Waypoint[];
  onWaypointAdded?: (latlng: L.LatLng) => void;
}

// Component to handle map clicks for waypoint planning
function MapClickHandler({ onWaypointAdded }: { onWaypointAdded?: (latlng: L.LatLng) => void }) {
  const map = useMapEvents({
    click: (e) => {
      if (onWaypointAdded) {
        onWaypointAdded(e.latlng);
      }
    },
  });
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
            <Popup>
              <div>
                <strong>{drone.name}</strong><br/>
                {drone.model}<br/>
                Status: {drone.status}<br/>
                Battery: {drone.batteryLevel}%
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
          <Popup>
            Waypoint {index + 1}: {wp.altitude || 'Default'}m altitude
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
