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

const MemoryStore = createMemoryStore(session);

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
  sessionStore: session.SessionStore;
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
  
  sessionStore: session.SessionStore;
  
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
    const newOrg: Organization = { ...organization, id };
    this.organizations.set(id, newOrg);
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
    const newDrone: Drone = { ...drone, id };
    this.drones.set(id, newDrone);
    return newDrone;
  }
  
  async updateDrone(id: number, update: Partial<Drone>): Promise<Drone | undefined> {
    const drone = this.drones.get(id);
    if (!drone) return undefined;
    
    const updatedDrone = { ...drone, ...update };
    this.drones.set(id, updatedDrone);
    return updatedDrone;
  }
  
  async deleteDrone(id: number): Promise<boolean> {
    return this.drones.delete(id);
  }
  
  // Mission methods
  async getMission(id: number): Promise<Mission | undefined> {
    return this.missions.get(id);
  }
  
  async getMissionsByOrganization(organizationId: number): Promise<Mission[]> {
    return Array.from(this.missions.values()).filter(
      (mission) => mission.organizationId === organizationId
    );
  }
  
  async createMission(mission: InsertMission): Promise<Mission> {
    const id = this.currentMissionId++;
    const newMission: Mission = { ...mission, id };
    this.missions.set(id, newMission);
    return newMission;
  }
  
  async updateMission(id: number, update: Partial<Mission>): Promise<Mission | undefined> {
    const mission = this.missions.get(id);
    if (!mission) return undefined;
    
    const updatedMission = { ...mission, ...update };
    this.missions.set(id, updatedMission);
    return updatedMission;
  }
  
  async deleteMission(id: number): Promise<boolean> {
    return this.missions.delete(id);
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
    const newAssignment: DroneAssignment = { ...assignment, id };
    this.droneAssignments.set(id, newAssignment);
    return newAssignment;
  }
  
  async updateDroneAssignment(id: number, update: Partial<DroneAssignment>): Promise<DroneAssignment | undefined> {
    const assignment = this.droneAssignments.get(id);
    if (!assignment) return undefined;
    
    const updatedAssignment = { ...assignment, ...update };
    this.droneAssignments.set(id, updatedAssignment);
    return updatedAssignment;
  }
  
  async deleteDroneAssignment(id: number): Promise<boolean> {
    return this.droneAssignments.delete(id);
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
    const newResult: MissionResult = { ...result, id };
    this.missionResults.set(id, newResult);
    return newResult;
  }
  
  async updateMissionResult(id: number, update: Partial<MissionResult>): Promise<MissionResult | undefined> {
    const result = this.missionResults.get(id);
    if (!result) return undefined;
    
    const updatedResult = { ...result, ...update };
    this.missionResults.set(id, updatedResult);
    return updatedResult;
  }
}

export const storage = new MemStorage();
