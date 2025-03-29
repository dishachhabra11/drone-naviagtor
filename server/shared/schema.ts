import { pgTable, text, serial, integer, boolean, jsonb, timestamp, varchar } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Organization model
export const organizations = pgTable("organizations", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  password: text("password").notNull(),
});

// Drone model
export const drones = pgTable("drones", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  model: text("model").notNull(),
  // Status: 'available', 'in-mission', 'maintenance', 'offline'
  status: text("status").notNull().default('available'),
  batteryLevel: integer("battery_level").notNull().default(100),
  lastKnownLocation: jsonb("last_known_location").notNull().default({ lat: 0, lng: 0 }),
  organizationId: integer("organization_id").notNull(),
});

// Mission model
export const missions = pgTable("missions", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  location: text("location"),
  status: text("status").notNull().default('planned'), // planned, active, completed, cancelled
  startDate: timestamp("start_date"),
  endDate: timestamp("end_date"),
  isRecurring: boolean("is_recurring").default(false),
  recurringSchedule: text("recurring_schedule"),
  organizationId: integer("organization_id").notNull(),
});

// DroneAssignment model to connect drones to missions
export const droneAssignments = pgTable("drone_assignments", {
  id: serial("id").primaryKey(),
  droneId: integer("drone_id").notNull(),
  missionId: integer("mission_id").notNull(),
  waypoints: jsonb("waypoints").default([]),
  completed: boolean("completed").default(false),
});

// Mission Results model
export const missionResults = pgTable("mission_results", {
  id: serial("id").primaryKey(),
  missionId: integer("mission_id").notNull(),
  duration: integer("duration"), // in minutes
  distance: integer("distance"), // in meters
  batteryUsed: integer("battery_used"), // percentage
  data: jsonb("data").default({}),
  completedAt: timestamp("completed_at"),
});

// Insert Schemas
export const insertOrganizationSchema = createInsertSchema(organizations).pick({
  name: true,
  email: true,
  password: true,
});

export const insertDroneSchema = createInsertSchema(drones).pick({
  name: true,
  model: true,
  status: true,
  batteryLevel: true,
  lastKnownLocation: true,
  organizationId: true,
});

export const insertMissionSchema = createInsertSchema(missions).pick({
  name: true,
  description: true,
  location: true,
  status: true,
  startDate: true,
  endDate: true,
  isRecurring: true,
  recurringSchedule: true,
  organizationId: true,
});

export const insertDroneAssignmentSchema = createInsertSchema(droneAssignments).pick({
  droneId: true,
  missionId: true,
  waypoints: true,
  completed: true,
});

export const insertMissionResultSchema = createInsertSchema(missionResults).pick({
  missionId: true,
  duration: true,
  distance: true,
  batteryUsed: true,
  data: true,
  completedAt: true,
});

// Types
export type Organization = typeof organizations.$inferSelect;
export type InsertOrganization = z.infer<typeof insertOrganizationSchema>;

export type Drone = typeof drones.$inferSelect;
export type InsertDrone = z.infer<typeof insertDroneSchema>;

export type Mission = typeof missions.$inferSelect;
export type InsertMission = z.infer<typeof insertMissionSchema>;

export type DroneAssignment = typeof droneAssignments.$inferSelect;
export type InsertDroneAssignment = z.infer<typeof insertDroneAssignmentSchema>;

export type MissionResult = typeof missionResults.$inferSelect;
export type InsertMissionResult = z.infer<typeof insertMissionResultSchema>;

// Extended schema for location type
export const locationSchema = z.object({
  lat: z.number(),
  lng: z.number(),
});

export const waypointSchema = z.object({
  lat: z.number(),
  lng: z.number(),
  altitude: z.number().optional(),
});

export type Location = z.infer<typeof locationSchema>;
export type Waypoint = z.infer<typeof waypointSchema>;
