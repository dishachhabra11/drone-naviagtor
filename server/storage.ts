import { 
  Organization, InsertOrganization, 
  Drone, InsertDrone, 
  Mission, InsertMission, 
  DroneAssignment, InsertDroneAssignment,
  MissionResult, InsertMissionResult,
  Location, Waypoint
} from "../shared/schema";
import session from "express-session";
import createMemoryStore from "memorystore";
import fs from 'fs';
import path from 'path';

const MemoryStore = createMemoryStore(session);
const DATA_FILE = path.join(process.cwd(), 'data.json');

export interface IStorage {
  // Organization operations
  getOrganization(id: number): Promise<Organization | undefined>;
  getOrganizationByEmail(email: string): Promise<Organization | undefined>;
  createOrganization(organization: InsertOrganization): Promise<Organization>;
  
  // User operations (for auth compatibility)
  getUser(id: number): Promise<Organization | undefined>;
  getUserByUsername(email: string): Promise<Organization | undefined>;
  createUser(user: InsertOrganization): Promise<Organization>;
  
  // Drone operations
  getDrone(id: number): Promise<Drone | undefined>;
  getDronesByOrganization(organizationId: number): Promise<Drone[]>;
  createDrone(drone: InsertDrone): Promise<Drone>;
  updateDrone(id: number, update: Partial<Drone>): Promise<Drone | undefined>;
  deleteDrone(id: number): Promise<boolean>;
  
  // Mission operations
  getMission(id: number): Promise<Mission | undefined>;
  getMissionsByOrganization(organizationId: number): Promise<Mission[]>;
  createMission(mission: InsertMission): Promise<Mission>;
  updateMission(id: number, update: Partial<Mission>): Promise<Mission | undefined>;
  deleteMission(id: number): Promise<boolean>;
  
  // DroneAssignment operations
  getDroneAssignment(id: number): Promise<DroneAssignment | undefined>;
  getDroneAssignmentsByMission(missionId: number): Promise<DroneAssignment[]>;
  createDroneAssignment(assignment: InsertDroneAssignment): Promise<DroneAssignment>;
  updateDroneAssignment(id: number, update: Partial<DroneAssignment>): Promise<DroneAssignment | undefined>;
  deleteDroneAssignment(id: number): Promise<boolean>;
  
  // MissionResult operations
  getMissionResult(id: number): Promise<MissionResult | undefined>;
  getMissionResultByMission(missionId: number): Promise<MissionResult | undefined>;
  createMissionResult(result: InsertMissionResult): Promise<MissionResult>;
  updateMissionResult(id: number, update: Partial<MissionResult>): Promise<MissionResult | undefined>;

  // Session store
  sessionStore: any; // Using any type to avoid TypeScript issues with session.SessionStore
}

export class MemStorage implements IStorage {
  private organizations: Map<number, Organization>;
  private drones: Map<number, Drone>;
  private missions: Map<number, Mission>;
  private droneAssignments: Map<number, DroneAssignment>;
  private missionResults: Map<number, MissionResult>;
  
  currentOrgId: number;
  currentDroneId: number;
  currentMissionId: number;
  currentAssignmentId: number;
  currentResultId: number;
  
  sessionStore: any; // Using any type to avoid TypeScript issues with session.SessionStore
  
  constructor() {
    this.organizations = new Map();
    this.drones = new Map();
    this.missions = new Map();
    this.droneAssignments = new Map();
    this.missionResults = new Map();
    
    this.currentOrgId = 1;
    this.currentDroneId = 1;
    this.currentMissionId = 1;
    this.currentAssignmentId = 1;
    this.currentResultId = 1;
    
    this.sessionStore = new MemoryStore({
      checkPeriod: 86400000 // prune expired entries every 24h
    });
    
    // Load data from file if it exists
    this.loadData();
  }
  
  // Save data to persistent file
  private saveData() {
    try {
      const data = {
        organizations: Array.from(this.organizations.entries()),
        drones: Array.from(this.drones.entries()),
        missions: Array.from(this.missions.entries()),
        droneAssignments: Array.from(this.droneAssignments.entries()),
        missionResults: Array.from(this.missionResults.entries()),
        currentOrgId: this.currentOrgId,
        currentDroneId: this.currentDroneId,
        currentMissionId: this.currentMissionId,
        currentAssignmentId: this.currentAssignmentId,
        currentResultId: this.currentResultId
      };
      
      fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
      console.log('Data saved to file');
    } catch (error) {
      console.error('Error saving data to file:', error);
    }
  }
  
  // Load data from persistent file
  private loadData() {
    try {
      if (fs.existsSync(DATA_FILE)) {
        const fileContent = fs.readFileSync(DATA_FILE, 'utf8');
        const data = JSON.parse(fileContent);
        
        this.organizations = new Map(data.organizations);
        this.drones = new Map(data.drones);
        this.missions = new Map(data.missions);
        this.droneAssignments = new Map(data.droneAssignments);
        this.missionResults = new Map(data.missionResults);
        
        this.currentOrgId = data.currentOrgId;
        this.currentDroneId = data.currentDroneId;
        this.currentMissionId = data.currentMissionId;
        this.currentAssignmentId = data.currentAssignmentId;
        this.currentResultId = data.currentResultId;
        
        console.log('Data loaded from file');
      } else {
        console.log('No data file found, starting with empty state');
      }
    } catch (error) {
      console.error('Error loading data from file:', error);
    }
  }
  
  // Organization methods
  async getOrganization(id: number): Promise<Organization | undefined> {
    return this.organizations.get(id);
  }
  
  async getOrganizationByEmail(email: string): Promise<Organization | undefined> {
    return Array.from(this.organizations.values()).find(
      (org) => org.email === email
    );
  }
  
  async createOrganization(organization: InsertOrganization): Promise<Organization> {
    const id = this.currentOrgId++;
    const newOrg: Organization = { 
      ...organization, 
      id,
      createdAt: new Date() 
    };
    this.organizations.set(id, newOrg);
    this.saveData();
    return newOrg;
  }
  
  // User methods (aliases for auth compatibility)
  async getUser(id: number): Promise<Organization | undefined> {
    return this.getOrganization(id);
  }
  
  async getUserByUsername(email: string): Promise<Organization | undefined> {
    return this.getOrganizationByEmail(email);
  }
  
  async createUser(user: InsertOrganization): Promise<Organization> {
    return this.createOrganization(user);
  }
  
  // Drone methods
  async getDrone(id: number): Promise<Drone | undefined> {
    return this.drones.get(id);
  }
  
  async getDronesByOrganization(organizationId: number): Promise<Drone[]> {
    return Array.from(this.drones.values()).filter(
      (drone) => drone.organizationId === organizationId
    );
  }
  
  async createDrone(drone: InsertDrone): Promise<Drone> {
    const id = this.currentDroneId++;
    const newDrone: Drone = { 
      ...drone, 
      id,
      createdAt: new Date(),
      status: drone.status || 'available',
      batteryLevel: drone.batteryLevel || 100,
      lastKnownLocation: drone.lastKnownLocation || null
    };
    this.drones.set(id, newDrone);
    this.saveData();
    return newDrone;
  }
  
  async updateDrone(id: number, update: Partial<Drone>): Promise<Drone | undefined> {
    const drone = this.drones.get(id);
    if (!drone) return undefined;
    
    const updatedDrone = { ...drone, ...update };
    this.drones.set(id, updatedDrone);
    this.saveData();
    return updatedDrone;
  }
  
  async deleteDrone(id: number): Promise<boolean> {
    const result = this.drones.delete(id);
    this.saveData();
    return result;
  }
  
  // Mission methods
  async getMission(id: number): Promise<Mission | undefined> {
    const mission = this.missions.get(id);
    if (!mission) return undefined;
    
    // Attach waypoints from assignments to the mission data
    const assignments = await this.getDroneAssignmentsByMission(mission.id);
    if (assignments.length > 0 && assignments[0].waypoints) {
      // Convert the waypoints JSON to the expected Waypoint[] type
      mission.waypoints = Array.isArray(assignments[0].waypoints) 
        ? assignments[0].waypoints 
        : [];
    } else {
      mission.waypoints = [];
    }
    
    return mission;
  }
  
  async getMissionsByOrganization(organizationId: number): Promise<Mission[]> {
    const missions = Array.from(this.missions.values()).filter(
      (mission) => mission.organizationId === organizationId
    );
    
    // Attach waypoints to each mission from its assignments
    for (const mission of missions) {
      const assignments = await this.getDroneAssignmentsByMission(mission.id);
      if (assignments.length > 0 && assignments[0].waypoints) {
        // Convert the waypoints JSON to the expected Waypoint[] type
        mission.waypoints = Array.isArray(assignments[0].waypoints) 
          ? assignments[0].waypoints 
          : [];
      } else {
        mission.waypoints = [];
      }
    }
    
    return missions;
  }
  
  async createMission(mission: InsertMission): Promise<Mission> {
    const id = this.currentMissionId++;
    const newMission: Mission = { 
      ...mission, 
      id,
      createdAt: new Date(),
      status: mission.status || 'planned',
      description: mission.description || null,
      startTime: mission.startTime || null,
      endTime: mission.endTime || null,
      estimatedDuration: mission.estimatedDuration || null,
      pathDistance: mission.pathDistance || null,
      waypoints: []
    };
    this.missions.set(id, newMission);
    this.saveData();
    return newMission;
  }
  
  async updateMission(id: number, update: Partial<Mission>): Promise<Mission | undefined> {
    const mission = this.missions.get(id);
    if (!mission) return undefined;
    
    const updatedMission = { ...mission, ...update };
    this.missions.set(id, updatedMission);
    this.saveData();
    return updatedMission;
  }
  
  async deleteMission(id: number): Promise<boolean> {
    const result = this.missions.delete(id);
    this.saveData();
    return result;
  }
  
  // DroneAssignment methods
  async getDroneAssignment(id: number): Promise<DroneAssignment | undefined> {
    return this.droneAssignments.get(id);
  }
  
  async getDroneAssignmentsByMission(missionId: number): Promise<DroneAssignment[]> {
    return Array.from(this.droneAssignments.values()).filter(
      (assignment) => assignment.missionId === missionId
    );
  }
  
  async createDroneAssignment(assignment: InsertDroneAssignment): Promise<DroneAssignment> {
    const id = this.currentAssignmentId++;
    const newAssignment: DroneAssignment = { 
      ...assignment, 
      id,
      createdAt: new Date(),
      isActive: assignment.isActive !== undefined ? assignment.isActive : true,
      waypoints: assignment.waypoints || []
    };
    this.droneAssignments.set(id, newAssignment);
    this.saveData();
    return newAssignment;
  }
  
  async updateDroneAssignment(id: number, update: Partial<DroneAssignment>): Promise<DroneAssignment | undefined> {
    const assignment = this.droneAssignments.get(id);
    if (!assignment) return undefined;
    
    const updatedAssignment = { ...assignment, ...update };
    this.droneAssignments.set(id, updatedAssignment);
    this.saveData();
    return updatedAssignment;
  }
  
  async deleteDroneAssignment(id: number): Promise<boolean> {
    const result = this.droneAssignments.delete(id);
    this.saveData();
    return result;
  }
  
  // MissionResult methods
  async getMissionResult(id: number): Promise<MissionResult | undefined> {
    return this.missionResults.get(id);
  }
  
  async getMissionResultByMission(missionId: number): Promise<MissionResult | undefined> {
    return Array.from(this.missionResults.values()).find(
      (result) => result.missionId === missionId
    );
  }
  
  async createMissionResult(result: InsertMissionResult): Promise<MissionResult> {
    const id = this.currentResultId++;
    const newResult: MissionResult = { 
      ...result, 
      id,
      createdAt: new Date(),
      data: result.data || null,
      findings: result.findings || null
    };
    this.missionResults.set(id, newResult);
    this.saveData();
    return newResult;
  }
  
  async updateMissionResult(id: number, update: Partial<MissionResult>): Promise<MissionResult | undefined> {
    const result = this.missionResults.get(id);
    if (!result) return undefined;
    
    const updatedResult = { ...result, ...update };
    this.missionResults.set(id, updatedResult);
    this.saveData();
    return updatedResult;
  }
}

export const storage = new MemStorage();
