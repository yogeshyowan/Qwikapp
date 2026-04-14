import { pool } from "@workspace/db";
import { logger } from "./logger";

/**
 * Idempotent DDL — creates new tables if they don't exist yet.
 * Safe to run on every startup.
 */
export async function runMigrations(): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id            SERIAL PRIMARY KEY,
        google_id     TEXT UNIQUE NOT NULL,
        email         TEXT NOT NULL,
        name          TEXT NOT NULL,
        picture       TEXT,
        created_at    TIMESTAMPTZ DEFAULT NOW() NOT NULL,
        updated_at    TIMESTAMPTZ DEFAULT NOW() NOT NULL
      );

      CREATE TABLE IF NOT EXISTS subscriptions (
        id                      SERIAL PRIMARY KEY,
        user_id                 INTEGER NOT NULL REFERENCES users(id),
        plan                    TEXT NOT NULL DEFAULT 'free',
        credit_microdollars     BIGINT NOT NULL DEFAULT 1000000,
        expires_at              TIMESTAMPTZ,
        created_at              TIMESTAMPTZ DEFAULT NOW() NOT NULL,
        updated_at              TIMESTAMPTZ DEFAULT NOW() NOT NULL
      );

      CREATE TABLE IF NOT EXISTS token_usage (
        id                          SERIAL PRIMARY KEY,
        user_id                     INTEGER NOT NULL,
        project_id                  INTEGER NOT NULL,
        input_tokens                INTEGER NOT NULL,
        output_tokens               INTEGER NOT NULL,
        claude_cost_microdollars    BIGINT NOT NULL,
        user_charge_microdollars    BIGINT NOT NULL,
        description                 TEXT NOT NULL DEFAULT '',
        created_at                  TIMESTAMPTZ DEFAULT NOW() NOT NULL
      );
    `);
    logger.info("DB migrations applied");
  } finally {
    client.release();
  }
}
