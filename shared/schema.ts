import { pgTable, serial, text, timestamp, integer, boolean, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Organization table (for authentication)
export const organizations = pgTable("organizations", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  password: text("password").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

// Drone table
export const drones = pgTable("drones", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  model: text("model").notNull(),
  status: text("status", { enum: ["available", "in-mission", "maintenance"] }).notNull().default("available"),
  batteryLevel: integer("battery_level").notNull().default(100),
  lastKnownLocation: jsonb("last_known_location"),
  organizationId: integer("organization_id").notNull().references(() => organizations.id),
  createdAt: timestamp("created_at").defaultNow(),
});

// Mission table
export const missions = pgTable("missions", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  status: text("status", { enum: ["planned", "in-progress", "completed", "failed"] }).notNull().default("planned"),
  location: jsonb("location").notNull(),
  startTime: timestamp("start_time"),
  endTime: timestamp("end_time"),
  estimatedDuration: integer("estimated_duration"),
  pathDistance: float("path_distance"),
  organizationId: integer("organization_id").notNull().references(() => organizations.id),
  createdAt: timestamp("created_at").defaultNow(),
});

// Drone Assignment table (for assigning drones to missions)
export const droneAssignments = pgTable("drone_assignments", {
  id: serial("id").primaryKey(),
  droneId: integer("drone_id").notNull().references(() => drones.id),
  missionId: integer("mission_id").notNull().references(() => missions.id),
  waypoints: jsonb("waypoints").default([]),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

// Mission Result table
export const missionResults = pgTable("mission_results", {
  id: serial("id").primaryKey(),
  missionId: integer("mission_id").notNull().references(() => missions.id).unique(),
  success: boolean("success").notNull(),
  findings: text("findings"),
  data: jsonb("data").default({}),
  completedAt: timestamp("completed_at").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

// Zod schemas for inserting data
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
  status: true,
  location: true,
  startTime: true,
  endTime: true,
  organizationId: true,
});

export const insertDroneAssignmentSchema = createInsertSchema(droneAssignments).pick({
  droneId: true,
  missionId: true,
  waypoints: true,
  isActive: true,
});

export const insertMissionResultSchema = createInsertSchema(missionResults).pick({
  missionId: true,
  success: true,
  findings: true,
  data: true,
  completedAt: true,
});

// Custom schemas for non-table data
export const locationSchema = z.object({
  lat: z.number(),
  lng: z.number(),
  altitude: z.number().optional(),
  accuracy: z.number().optional(),
});

export const waypointSchema = z.object({
  lat: z.number(),
  lng: z.number(),
  altitude: z.number().optional(),
});

// Type exports
export type Organization = typeof organizations.$inferSelect;
export type InsertOrganization = z.infer<typeof insertOrganizationSchema>;

export type Drone = typeof drones.$inferSelect;
export type InsertDrone = z.infer<typeof insertDroneSchema>;
export type DroneStatus = "available" | "in-mission" | "maintenance";

export type Mission = typeof missions.$inferSelect;
export type InsertMission = z.infer<typeof insertMissionSchema>;
export type MissionStatus = "planned" | "in-progress" | "completed" | "failed";

export type DroneAssignment = typeof droneAssignments.$inferSelect;
export type InsertDroneAssignment = z.infer<typeof insertDroneAssignmentSchema>;

export type MissionResult = typeof missionResults.$inferSelect;
export type InsertMissionResult = z.infer<typeof insertMissionResultSchema>;

export type Location = z.infer<typeof locationSchema>;
export type Waypoint = z.infer<typeof waypointSchema>;