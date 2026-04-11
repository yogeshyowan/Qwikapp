import { pgTable, text, serial, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const projectsTable = pgTable("projects", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  techStack: text("tech_stack").notNull(),
  status: text("status").notNull().default("pending"),
  conversationId: text("conversation_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const projectFilesTable = pgTable("project_files", {
  id: serial("id").primaryKey(),
  projectId: serial("project_id").notNull(),
  filename: text("filename").notNull(),
  language: text("language").notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertProjectSchema = createInsertSchema(projectsTable).omit({ id: true, createdAt: true, updatedAt: true });
export const insertProjectFileSchema = createInsertSchema(projectFilesTable).omit({ id: true, createdAt: true });

export type InsertProject = z.infer<typeof insertProjectSchema>;
export type Project = typeof projectsTable.$inferSelect;
export type InsertProjectFile = z.infer<typeof insertProjectFileSchema>;
export type ProjectFile = typeof projectFilesTable.$inferSelect;
