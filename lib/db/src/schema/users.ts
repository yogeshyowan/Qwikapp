import {
  pgTable,
  text,
  serial,
  timestamp,
  bigint,
  integer,
} from "drizzle-orm/pg-core";

export const usersTable = pgTable("users", {
  id: serial("id").primaryKey(),
  googleId: text("google_id").unique().notNull(),
  email: text("email").notNull(),
  name: text("name").notNull(),
  picture: text("picture"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

/**
 * plan: "free" | "standard" | "pro"
 * creditMicrodollars: remaining credit. 1 USD = 1_000_000 microdollars.
 *   Free  : 1_000_000  ($1)
 *   Standard: 5_000_000  ($5)
 *   Pro   : 10_000_000 ($10)
 * expiresAt: null for free (no expiry); set for paid plans (1 month from purchase).
 */
export const subscriptionsTable = pgTable("subscriptions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => usersTable.id),
  plan: text("plan").notNull().default("free"),
  creditMicrodollars: bigint("credit_microdollars", { mode: "number" })
    .notNull()
    .default(1_000_000),
  expiresAt: timestamp("expires_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

/**
 * Per-request token usage log.
 * Claude cost:  inputTokens * 3µ$ + outputTokens * 15µ$
 * User charge:  2× Claude cost
 */
export const tokenUsageTable = pgTable("token_usage", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  projectId: integer("project_id").notNull(),
  inputTokens: integer("input_tokens").notNull(),
  outputTokens: integer("output_tokens").notNull(),
  claudeCostMicrodollars: bigint("claude_cost_microdollars", {
    mode: "number",
  }).notNull(),
  userChargeMicrodollars: bigint("user_charge_microdollars", {
    mode: "number",
  }).notNull(),
  description: text("description").notNull().default(""),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type User = typeof usersTable.$inferSelect;
export type Subscription = typeof subscriptionsTable.$inferSelect;
export type TokenUsage = typeof tokenUsageTable.$inferSelect;
