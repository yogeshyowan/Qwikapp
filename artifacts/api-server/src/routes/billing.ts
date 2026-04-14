import { Router } from "express";
import crypto from "node:crypto";
import { eq } from "drizzle-orm";
import { db, subscriptionsTable, tokenUsageTable } from "@workspace/db";
import { requireAuth } from "../middlewares/auth";
import { logger } from "../lib/logger";

const router = Router();

// ─── Plan catalogue ───────────────────────────────────────────────────────────

export const PLANS = {
  free: {
    id: "free",
    name: "Free",
    priceInr: 0,
    priceDisplay: "Free",
    originalPriceDisplay: null,
    creditUsd: 1,
    creditMicrodollars: 1_000_000,
    description: "$1 token credit, no expiry",
    features: [
      "$1 token credit (one-time)",
      "Build unlimited projects",
      "Subdomain preview",
      "Community support",
    ],
  },
  standard: {
    id: "standard",
    name: "Standard",
    priceInr: 499,
    priceDisplay: "₹499/mo",
    originalPriceDisplay: "₹1,599",
    creditUsd: 5,
    creditMicrodollars: 5_000_000,
    description: "$5 token credit + 1 month subscription",
    features: [
      "$5 token credit per month",
      "Pay-as-you-go after credit",
      "Priority builds",
      "Email support",
    ],
  },
  pro: {
    id: "pro",
    name: "Pro",
    priceInr: 999,
    priceDisplay: "₹999/mo",
    originalPriceDisplay: null,
    creditUsd: 10,
    creditMicrodollars: 10_000_000,
    description: "$10 token credit + 1 month subscription",
    features: [
      "$10 token credit per month",
      "Pay-as-you-go after credit",
      "Fastest build priority",
      "Dedicated support",
    ],
  },
} as const;

type PlanId = keyof typeof PLANS;

// ─── Routes ───────────────────────────────────────────────────────────────────

/** GET /api/billing/plans */
router.get("/billing/plans", (_req, res): void => {
  res.json(Object.values(PLANS));
});

/** GET /api/billing/balance */
router.get("/billing/balance", requireAuth, async (req, res): Promise<void> => {
  const userId = req.user!.userId;

  const [sub] = await db
    .select()
    .from(subscriptionsTable)
    .where(eq(subscriptionsTable.userId, userId));

  if (!sub) {
    res.status(404).json({ error: "No subscription found" });
    return;
  }

  // Recent usage (last 10 entries)
  const usage = await db
    .select()
    .from(tokenUsageTable)
    .where(eq(tokenUsageTable.userId, userId))
    .orderBy(tokenUsageTable.createdAt)
    .limit(10);

  res.json({
    plan: sub.plan,
    creditMicrodollars: sub.creditMicrodollars,
    creditUsd: (sub.creditMicrodollars / 1_000_000).toFixed(4),
    expiresAt: sub.expiresAt?.toISOString() ?? null,
    recentUsage: usage.map((u) => ({
      inputTokens: u.inputTokens,
      outputTokens: u.outputTokens,
      claudeCostUsd: (u.claudeCostMicrodollars / 1_000_000).toFixed(6),
      userChargeUsd: (u.userChargeMicrodollars / 1_000_000).toFixed(6),
      description: u.description,
      createdAt: u.createdAt.toISOString(),
    })),
  });
});

/** POST /api/billing/create-order */
router.post("/billing/create-order", requireAuth, async (req, res): Promise<void> => {
  const { plan } = req.body as { plan?: string };
  if (!plan || !(plan in PLANS) || plan === "free") {
    res.status(400).json({ error: "Invalid plan" });
    return;
  }

  const razorpayKeyId = process.env.RAZORPAY_KEY_ID;
  const razorpayKeySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!razorpayKeyId || !razorpayKeySecret) {
    res.status(503).json({ error: "Payment gateway not configured" });
    return;
  }

  const planInfo = PLANS[plan as PlanId];

  try {
    // Create Razorpay order via REST API (avoids SDK ESM issues)
    const auth = Buffer.from(`${razorpayKeyId}:${razorpayKeySecret}`).toString("base64");
    const body = JSON.stringify({
      amount: planInfo.priceInr * 100, // paise
      currency: "INR",
      receipt: `plan_${plan}_${req.user!.userId}_${Date.now()}`,
      notes: { userId: String(req.user!.userId), plan },
    });

    const response = await fetch("https://api.razorpay.com/v1/orders", {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/json",
      },
      body,
    });

    if (!response.ok) {
      const err = await response.text();
      logger.error({ err, plan }, "Razorpay order creation failed");
      res.status(502).json({ error: "Payment gateway error" });
      return;
    }

    const order = await response.json() as { id: string; amount: number; currency: string };
    res.json({
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      keyId: razorpayKeyId,
      planName: planInfo.name,
    });
  } catch (err) {
    logger.error({ err }, "create-order failed");
    res.status(500).json({ error: "Failed to create order" });
  }
});

/** POST /api/billing/verify-payment */
router.post("/billing/verify-payment", requireAuth, async (req, res): Promise<void> => {
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature, plan } = req.body as {
    razorpay_order_id?: string;
    razorpay_payment_id?: string;
    razorpay_signature?: string;
    plan?: string;
  };

  if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature || !plan) {
    res.status(400).json({ error: "Missing payment details" });
    return;
  }

  if (!(plan in PLANS) || plan === "free") {
    res.status(400).json({ error: "Invalid plan" });
    return;
  }

  const razorpayKeySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!razorpayKeySecret) {
    res.status(503).json({ error: "Payment gateway not configured" });
    return;
  }

  // Verify HMAC signature
  const expectedSig = crypto
    .createHmac("sha256", razorpayKeySecret)
    .update(`${razorpay_order_id}|${razorpay_payment_id}`)
    .digest("hex");

  if (expectedSig !== razorpay_signature) {
    logger.warn({ userId: req.user!.userId }, "Invalid Razorpay signature");
    res.status(400).json({ error: "Payment verification failed" });
    return;
  }

  const planInfo = PLANS[plan as PlanId];
  const userId = req.user!.userId;

  // Upsert subscription
  const [existing] = await db
    .select()
    .from(subscriptionsTable)
    .where(eq(subscriptionsTable.userId, userId));

  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // +30 days

  if (existing) {
    await db
      .update(subscriptionsTable)
      .set({
        plan,
        creditMicrodollars: existing.creditMicrodollars + planInfo.creditMicrodollars,
        expiresAt,
        updatedAt: new Date(),
      })
      .where(eq(subscriptionsTable.userId, userId));
  } else {
    await db.insert(subscriptionsTable).values({
      userId,
      plan,
      creditMicrodollars: planInfo.creditMicrodollars,
      expiresAt,
    });
  }

  logger.info({ userId, plan }, "Subscription activated");
  res.json({
    ok: true,
    plan,
    creditUsd: planInfo.creditUsd,
    expiresAt: expiresAt.toISOString(),
  });
});

export default router;
