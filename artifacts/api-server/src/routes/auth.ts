import { Router } from "express";
import { OAuth2Client } from "google-auth-library";
import { eq } from "drizzle-orm";
import { db, usersTable, subscriptionsTable } from "@workspace/db";
import { requireAuth, signToken } from "../middlewares/auth";
import { logger } from "../lib/logger";

const router = Router();

function getGoogleClient(): OAuth2Client {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) throw new Error("GOOGLE_CLIENT_ID env var is not set");
  return new OAuth2Client(clientId);
}

/**
 * POST /api/auth/google
 * Body: { credential: string }  — Google ID token from GSI
 */
router.post("/auth/google", async (req, res): Promise<void> => {
  const { credential } = req.body as { credential?: string };
  if (!credential) {
    res.status(400).json({ error: "credential is required" });
    return;
  }

  try {
    const client = getGoogleClient();
    const ticket = await client.verifyIdToken({
      idToken: credential,
      audience: process.env.GOOGLE_CLIENT_ID!,
    });
    const payload = ticket.getPayload();
    if (!payload?.sub || !payload.email) {
      res.status(400).json({ error: "Invalid Google token" });
      return;
    }

    const googleId = payload.sub;
    const email = payload.email;
    const name = payload.name ?? email.split("@")[0];
    const picture = payload.picture ?? null;

    // Find or create user
    let [user] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.googleId, googleId));

    if (!user) {
      [user] = await db
        .insert(usersTable)
        .values({ googleId, email, name, picture })
        .returning();

      // Create free subscription for new user
      await db.insert(subscriptionsTable).values({
        userId: user.id,
        plan: "free",
        creditMicrodollars: 1_000_000, // $1
        expiresAt: null,
      });

      logger.info({ userId: user.id, email }, "New user registered");
    } else {
      // Update profile info in case it changed
      await db
        .update(usersTable)
        .set({ name, picture, updatedAt: new Date() })
        .where(eq(usersTable.id, user.id));
    }

    const token = signToken({ userId: user.id, email: user.email, name: user.name });
    res.json({ token, user: { id: user.id, email: user.email, name: user.name, picture: user.picture } });
  } catch (err) {
    logger.error({ err }, "Google auth failed");
    res.status(401).json({ error: "Google authentication failed" });
  }
});

/**
 * GET /api/auth/me
 * Returns current user + subscription info.
 */
router.get("/auth/me", requireAuth, async (req, res): Promise<void> => {
  const userId = req.user!.userId;

  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, userId));

  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  const [sub] = await db
    .select()
    .from(subscriptionsTable)
    .where(eq(subscriptionsTable.userId, userId));

  res.json({
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      picture: user.picture,
    },
    subscription: sub
      ? {
          plan: sub.plan,
          creditMicrodollars: sub.creditMicrodollars,
          expiresAt: sub.expiresAt?.toISOString() ?? null,
        }
      : null,
  });
});

/**
 * POST /api/auth/logout
 * Stateless JWT — client discards the token. We just acknowledge.
 */
router.post("/auth/logout", (_req, res): void => {
  res.json({ ok: true });
});

export default router;
