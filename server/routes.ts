import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth } from "./auth";
import { WebSocketServer, WebSocket } from "ws";
import { z } from "zod";
import { 
  insertDroneSchema, 
  insertMissionSchema, 
  insertDroneAssignmentSchema,
  insertMissionResultSchema,
  waypointSchema
} from "../shared/schema";

// Middleware to check if user is authenticated
function isAuthenticated(req: any, res: any, next: any) {
  if (req.isAuthenticated()) {
    return next();
  }
  res.status(401).json({ message: "Unauthorized" });
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Setup authentication
  setupAuth(app);

  // Create HTTP server
  const httpServer = createServer(app);
  
  // Setup WebSocket server for real-time updates
  const wss = new WebSocketServer({ server: httpServer, path: '/ws' });
  
  // WebSocket connection handler
  wss.on('connection', (ws) => {
    console.log('Client connected to WebSocket');
    
    ws.on('message', async (message) => {
      try {
        const data = JSON.parse(message.toString());
        
        // Handle different message types
        if (data.type === 'drone-location-update') {
          // Update drone location and broadcast to all clients
          const { droneId, location } = data;
          const drone = await storage.getDrone(droneId);
          
          if (drone) {
            const updatedDrone = await storage.updateDrone(droneId, {
              lastKnownLocation: location
            });
            
            // Broadcast the update to all connected clients
            wss.clients.forEach((client) => {
              if (client.readyState === WebSocket.OPEN) {
                client.send(JSON.stringify({
                  type: 'drone-location-update',
                  drone: updatedDrone
                }));
              }
            });
          }
        }
      } catch (error) {
        console.error('WebSocket message error:', error);
      }
    });
    
    // Send initial data
    ws.send(JSON.stringify({ type: 'connected', message: 'Connected to Drone Mission Management System' }));
  });

  // API Routes
  // Organizations are handled by auth.ts
  
  // Drone routes
  app.get('/api/drones', isAuthenticated, async (req, res) => {
    const drones = await storage.getDronesByOrganization((req.user as any).id);
    res.json(drones);
  });
  
  app.get('/api/drones/:id', isAuthenticated, async (req, res) => {
    const drone = await storage.getDrone(parseInt(req.params.id));
    if (!drone) {
      return res.status(404).json({ message: 'Drone not found' });
    }
    
    // Check if drone belongs to the user's organization
    if (drone.organizationId !== (req.user as any).id) {
      return res.status(403).json({ message: 'Forbidden' });
    }
    
    res.json(drone);
  });
  
  app.post('/api/drones', isAuthenticated, async (req, res) => {
    try {
      const droneData = insertDroneSchema.parse({
        ...req.body,
        organizationId: (req.user as any).id
      });
      
      const drone = await storage.createDrone(droneData);
      res.status(201).json(drone);
    } catch (error) {
      res.status(400).json({ message: 'Invalid drone data', error });
    }
  });
  
  app.put('/api/drones/:id', isAuthenticated, async (req, res) => {
    try {
      const droneId = parseInt(req.params.id);
      const drone = await storage.getDrone(droneId);
      
      if (!drone) {
        return res.status(404).json({ message: 'Drone not found' });
      }
      
      // Check if drone belongs to the user's organization
      if (drone.organizationId !== (req.user as any).id) {
        return res.status(403).json({ message: 'Forbidden' });
      }
      
      const updatedDrone = await storage.updateDrone(droneId, req.body);
      res.json(updatedDrone);
    } catch (error) {
      res.status(400).json({ message: 'Invalid drone data', error });
    }
  });
  
  app.delete('/api/drones/:id', isAuthenticated, async (req, res) => {
    try {
      const droneId = parseInt(req.params.id);
      const drone = await storage.getDrone(droneId);
      
      if (!drone) {
        return res.status(404).json({ message: 'Drone not found' });
      }
      
      // Check if drone belongs to the user's organization
      if (drone.organizationId !== (req.user as any).id) {
        return res.status(403).json({ message: 'Forbidden' });
      }
      
      await storage.deleteDrone(droneId);
      res.status(204).send();
    } catch (error) {
      res.status(400).json({ message: 'Error deleting drone', error });
    }
  });
  
  // Mission routes
  app.get('/api/missions', isAuthenticated, async (req, res) => {
    const missions = await storage.getMissionsByOrganization((req.user as any).id);
    res.json(missions);
  });
  
  app.get('/api/missions/:id', isAuthenticated, async (req, res) => {
    const mission = await storage.getMission(parseInt(req.params.id));
    if (!mission) {
      return res.status(404).json({ message: 'Mission not found' });
    }
    
    // Check if mission belongs to the user's organization
    if (mission.organizationId !== (req.user as any).id) {
      return res.status(403).json({ message: 'Forbidden' });
    }
    
    res.json(mission);
  });
  
  app.post('/api/missions', isAuthenticated, async (req, res) => {
    try {
      // Prepare the mission data
      const data = {
        ...req.body,
        organizationId: (req.user as any).id
      };
      
      // Convert date strings to Date objects if needed
      if (data.startTime && typeof data.startTime === 'string') {
        data.startTime = new Date(data.startTime);
      }
      
      if (data.endTime && typeof data.endTime === 'string') {
        data.endTime = new Date(data.endTime);
      }
      
      const missionData = insertMissionSchema.parse(data);
      
      // Create the mission
      const mission = await storage.createMission(missionData);
      
      // Check if this is a mission that should launch immediately
      if (mission.location) {
        try {
          // mission.location is a jsonb field that could be parsed already or still a string
          let locationData: { 
            address?: string; 
            isRecurring?: boolean; 
            recurringSchedule?: string | null;
            launchImmediately?: boolean;
          };
          
          if (typeof mission.location === 'string') {
            locationData = JSON.parse(mission.location);
          } else {
            locationData = mission.location as any;
          }
          if (locationData.launchImmediately) {
            console.log('Launching mission immediately:', mission.id);
            
            // Update mission status to 'in-progress'
            await storage.updateMission(mission.id, { status: 'in-progress' });
            
            // The updated mission to send out (with additional data)
            let updatedMissionData: any = await storage.getMission(mission.id);
            
            // We'll collect the waypoints from assignments to attach to the mission
            updatedMissionData.waypoints = [];
            
            // Check if there are existing assignments
            const assignments = await storage.getDroneAssignmentsByMission(mission.id);
            
            // If no assignments yet, we're still waiting for them to be created after this endpoint
            if (assignments.length > 0) {
              // Update assigned drones status to 'in-mission'
              for (const assignment of assignments) {
                const drone = await storage.getDrone(assignment.droneId);
                if (drone && drone.status === 'available') {
                  await storage.updateDrone(drone.id, { 
                    status: 'in-mission', 
                    assignedMissionId: mission.id 
                  });
                }
                
                // Use the waypoints from the first assignment
                if (assignment.waypoints && Array.isArray(assignment.waypoints) && assignment.waypoints.length > 0) {
                  updatedMissionData.waypoints = assignment.waypoints;
                }
              }
              
              // Broadcast this launch to all connected WebSocket clients
              wss.clients.forEach((client) => {
                if (client.readyState === WebSocket.OPEN) {
                  client.send(JSON.stringify({
                    type: 'mission-launched',
                    mission: updatedMissionData
                  }));
                }
              });
            }
            
            // Return the updated mission
            res.status(201).json(updatedMissionData);
            return;
          }
        } catch (e) {
          console.error('Error parsing mission location data:', e);
          // Continue with normal processing if parsing fails
        }
      }
      
      // Return the mission as usual if not launching immediately
      res.status(201).json(mission);
    } catch (error) {
      console.error('Mission creation error:', error);
      res.status(400).json({ message: 'Invalid mission data', error });
    }
  });
  
  app.put('/api/missions/:id', isAuthenticated, async (req, res) => {
    try {
      const missionId = parseInt(req.params.id);
      const mission = await storage.getMission(missionId);
      
      if (!mission) {
        return res.status(404).json({ message: 'Mission not found' });
      }
      
      // Check if mission belongs to the user's organization
      if (mission.organizationId !== (req.user as any).id) {
        return res.status(403).json({ message: 'Forbidden' });
      }
      
      const updatedMission = await storage.updateMission(missionId, req.body);
      res.json(updatedMission);
    } catch (error) {
      res.status(400).json({ message: 'Invalid mission data', error });
    }
  });
  
  // PATCH endpoint for partial mission updates
  app.patch('/api/missions/:id', async (req, res) => {
    try {
      const missionId = parseInt(req.params.id);
      const mission = await storage.getMission(missionId);
      
      if (!mission) {
        return res.status(404).json({ message: 'Mission not found' });
      }
      
      // Allow status updates even from automatic processes without authentication
      const updatedMission = await storage.updateMission(missionId, req.body);
      
      // If we're activating a mission, also update assigned drones
      if (req.body.status === 'in-progress') {
        const assignments = await storage.getDroneAssignmentsByMission(missionId);
        for (const assignment of assignments) {
          const drone = await storage.getDrone(assignment.droneId);
          if (drone && drone.status === 'available') {
            await storage.updateDrone(drone.id, { status: 'in-mission', assignedMissionId: missionId });
          }
        }
      }
      
      res.json(updatedMission);
    } catch (error) {
      console.error('Mission update error:', error);
      res.status(400).json({ message: 'Invalid mission data', error });
    }
  });
  
  app.delete('/api/missions/:id', isAuthenticated, async (req, res) => {
    try {
      const missionId = parseInt(req.params.id);
      const mission = await storage.getMission(missionId);
      
      if (!mission) {
        return res.status(404).json({ message: 'Mission not found' });
      }
      
      // Check if mission belongs to the user's organization
      if (mission.organizationId !== (req.user as any).id) {
        return res.status(403).json({ message: 'Forbidden' });
      }
      
      await storage.deleteMission(missionId);
      res.status(204).send();
    } catch (error) {
      res.status(400).json({ message: 'Error deleting mission', error });
    }
  });
  
  // Drone Assignment routes
  app.get('/api/missions/:id/assignments', isAuthenticated, async (req, res) => {
    try {
      const missionId = parseInt(req.params.id);
      const mission = await storage.getMission(missionId);
      
      if (!mission) {
        return res.status(404).json({ message: 'Mission not found' });
      }
      
      // Check if mission belongs to the user's organization
      if (mission.organizationId !== (req.user as any).id) {
        return res.status(403).json({ message: 'Forbidden' });
      }
      
      const assignments = await storage.getDroneAssignmentsByMission(missionId);
      res.json(assignments);
    } catch (error) {
      res.status(400).json({ message: 'Error retrieving assignments', error });
    }
  });
  
  app.post('/api/missions/:id/assignments', isAuthenticated, async (req, res) => {
    try {
      const missionId = parseInt(req.params.id);
      const mission = await storage.getMission(missionId);
      
      if (!mission) {
        return res.status(404).json({ message: 'Mission not found' });
      }
      
      // Check if mission belongs to the user's organization
      if (mission.organizationId !== (req.user as any).id) {
        return res.status(403).json({ message: 'Forbidden' });
      }
      
      // Validate the waypoints array using the schema
      const waypointsValidation = z.array(waypointSchema);
      const validatedWaypoints = waypointsValidation.parse(req.body.waypoints || []);
      
      const assignmentData = insertDroneAssignmentSchema.parse({
        ...req.body,
        missionId,
        waypoints: validatedWaypoints
      });
      
      const assignment = await storage.createDroneAssignment(assignmentData);
      
      // Get the mission to check if it's an immediate launch
      const currentMission = await storage.getMission(missionId);
      
      // Update drone status to 'in-mission' and set assignedMissionId
      await storage.updateDrone(assignment.droneId, { 
        status: 'in-mission',
        assignedMissionId: missionId
      });
      
      // If mission is in-progress, broadcast a WebSocket notification
      if (currentMission && currentMission.status === 'in-progress') {
        // Update mission with waypoints to send in the WebSocket
        const missionWithData = {
          ...currentMission,
          waypoints: assignment.waypoints
        };
        
        // Broadcast this launch to all connected WebSocket clients
        wss.clients.forEach((client) => {
          if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify({
              type: 'mission-launched',
              mission: missionWithData
            }));
          }
        });
      }
      
      res.status(201).json(assignment);
    } catch (error) {
      res.status(400).json({ message: 'Invalid assignment data', error });
    }
  });
  
  app.put('/api/assignments/:id', isAuthenticated, async (req, res) => {
    try {
      const assignmentId = parseInt(req.params.id);
      const assignment = await storage.getDroneAssignment(assignmentId);
      
      if (!assignment) {
        return res.status(404).json({ message: 'Assignment not found' });
      }
      
      // Check if assignment belongs to a mission of the user's organization
      const mission = await storage.getMission(assignment.missionId);
      if (!mission || mission.organizationId !== (req.user as any).id) {
        return res.status(403).json({ message: 'Forbidden' });
      }
      
      const updatedAssignment = await storage.updateDroneAssignment(assignmentId, req.body);
      res.json(updatedAssignment);
    } catch (error) {
      res.status(400).json({ message: 'Invalid assignment data', error });
    }
  });
  
  // Mission Results routes
  app.get('/api/missions/:id/results', isAuthenticated, async (req, res) => {
    try {
      const missionId = parseInt(req.params.id);
      const mission = await storage.getMission(missionId);
      
      if (!mission) {
        return res.status(404).json({ message: 'Mission not found' });
      }
      
      // Check if mission belongs to the user's organization
      if (mission.organizationId !== (req.user as any).id) {
        return res.status(403).json({ message: 'Forbidden' });
      }
      
      const result = await storage.getMissionResultByMission(missionId);
      if (!result) {
        return res.status(404).json({ message: 'No results found for this mission' });
      }
      
      res.json(result);
    } catch (error) {
      res.status(400).json({ message: 'Error retrieving results', error });
    }
  });
  
  app.post('/api/missions/:id/results', isAuthenticated, async (req, res) => {
    try {
      const missionId = parseInt(req.params.id);
      const mission = await storage.getMission(missionId);
      
      if (!mission) {
        return res.status(404).json({ message: 'Mission not found' });
      }
      
      // Check if mission belongs to the user's organization
      if (mission.organizationId !== (req.user as any).id) {
        return res.status(403).json({ message: 'Forbidden' });
      }
      
      const resultData = insertMissionResultSchema.parse({
        ...req.body,
        missionId,
        completedAt: new Date()
      });
      
      const result = await storage.createMissionResult(resultData);
      
      // Update mission status to completed
      await storage.updateMission(missionId, { status: 'completed' });
      
      // Update assigned drones status back to available
      const assignments = await storage.getDroneAssignmentsByMission(missionId);
      for (const assignment of assignments) {
        await storage.updateDrone(assignment.droneId, { status: 'available' });
      }
      
      res.status(201).json(result);
    } catch (error) {
      res.status(400).json({ message: 'Invalid result data', error });
    }
  });

  return httpServer;
}
