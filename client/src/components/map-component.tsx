import { useEffect, useRef, useState } from "react";
import { Drone, Mission, Waypoint, Location, locationSchema } from "@shared/schema";
import { Skeleton } from "@/components/ui/skeleton";
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

interface MapComponentProps {
  drones: Drone[];
  missions: Mission[];
  isPlanning?: boolean;
  waypoints?: Waypoint[];
  onWaypointAdded?: (latlng: L.LatLng) => void;
}

export function MapComponent({ drones, missions, isPlanning = false, waypoints = [], onWaypointAdded }: MapComponentProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const [mapInstance, setMapInstance] = useState<L.Map | null>(null);
  const [droneMarkers, setDroneMarkers] = useState<{ [key: number]: L.Marker }>({});
  const [waypointLayer, setWaypointLayer] = useState<L.Polyline | null>(null);
  
  // Fix the Leaflet icon issue
  useEffect(() => {
    // @ts-ignore - This is necessary for proper Leaflet functionality
    delete L.Icon.Default.prototype._getIconUrl;
    L.Icon.Default.mergeOptions({
      iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
      iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
      shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
    });
  }, []);
  
  // Initialize map on component mount
  useEffect(() => {
    if (!mapRef.current || mapInstance || !L) return;
    
    try {
      // Default center - can be adjusted based on drone locations
      const map = L.map(mapRef.current).setView([34.0522, -118.2437], 13);
      
      // Add tile layer
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
      }).addTo(map);
    
      // Add click handler for mission planning
      if (isPlanning) {
        map.on('click', (e: any) => {
          if (onWaypointAdded) {
            onWaypointAdded(e.latlng);
          }
        });
      }
      
      setMapInstance(map);
      
      // Cleanup on unmount
      return () => {
        map.remove();
      };
    } catch (error) {
      console.error("Error initializing map:", error);
      return; // Return early if map initialization fails
    }
  }, [mapRef, mapInstance, isPlanning, onWaypointAdded]);
  
  // Update drone markers when drones change
  useEffect(() => {
    if (!mapInstance || !L) return;
    
    // Clear existing markers
    Object.values(droneMarkers).forEach(marker => marker.remove());
    
    // Create new markers
    const markers: { [key: number]: L.Marker } = {};
    
    drones.forEach(drone => {
      // Skip if drone has no location
      if (!drone.lastKnownLocation) return;
      
      try {
        // Validate location using our schema
        const location = locationSchema.parse(drone.lastKnownLocation);
        if (!location.lat || !location.lng) return;
        
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
        
        // Create marker
        const marker = L.marker(
          [location.lat, location.lng], 
          { icon: droneIcon }
        ).addTo(mapInstance);
      
        // Add popup
        marker.bindPopup(`
          <div>
            <strong>${drone.name}</strong><br/>
            ${drone.model}<br/>
            Status: ${drone.status}<br/>
            Battery: ${drone.batteryLevel}%
          </div>
        `);
        
        markers[drone.id] = marker;
      } catch (error) {
        console.error(`Error processing drone ${drone.id}:`, error);
      }
    });
    
    setDroneMarkers(markers);
    
    // Center map on drones if any exist
    if (drones.length > 0) {
      try {
        const validDrones = drones.filter(d => {
          if (!d.lastKnownLocation) return false;
          try {
            // Use the schema to validate
            return locationSchema.safeParse(d.lastKnownLocation).success;
          } catch {
            return false;
          }
        });
        
        if (validDrones.length > 0) {
          const firstDrone = validDrones[0];
          const location = locationSchema.parse(firstDrone.lastKnownLocation);
          mapInstance.setView([location.lat, location.lng], 13);
        }
      } catch (error) {
        console.error("Error centering map:", error);
      }
    }
  }, [mapInstance, drones]);
  
  // Update waypoints when they change
  useEffect(() => {
    if (!mapInstance || !L) return;
    
    // Remove existing waypoint layer
    if (waypointLayer) {
      waypointLayer.remove();
    }
    
    if (waypoints.length > 0) {
      // Convert waypoints to LatLng array
      const latlngs = waypoints.map(wp => L.latLng(wp.lat, wp.lng));
      
      // Create waypoint markers
      waypoints.forEach((wp, index) => {
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
        
        L.marker([wp.lat, wp.lng], { icon: waypointIcon })
          .addTo(mapInstance)
          .bindTooltip(`Waypoint ${index + 1}: ${wp.altitude || 'Default'}m altitude`);
      });
      
      // Create polyline connecting waypoints
      const polyline = L.polyline(latlngs, {
        color: '#3B82F6',
        weight: 3,
        opacity: 0.7,
        dashArray: '5, 5',
      }).addTo(mapInstance);
      
      setWaypointLayer(polyline);
      
      // Pan to waypoints if planning
      if (isPlanning && waypoints.length > 0) {
        mapInstance.fitBounds(L.latLngBounds(latlngs));
      }
    }
  }, [mapInstance, waypoints, isPlanning]);
  
  return (
    <div ref={mapRef} className="h-full w-full" />
  );
}
