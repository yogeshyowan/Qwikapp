import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, conversationsTable, messagesTable } from "@workspace/db";
import {
  CreateConversationBody,
  SendAnthropicMessageBody,
} from "@workspace/api-zod";
import { streamConversationResponse } from "../../lib/codegen";
import { logger } from "../../lib/logger";

const router: IRouter = Router();

const CODE_ASSISTANT_SYSTEM = `You are an expert software engineer and coding assistant built into a developer platform.
You help developers plan and architect app ideas, answer technical questions, debug code, suggest improvements, and explain deployment.
Be concise, practical, and actionable. Use proper markdown code blocks for code.`;

function parseId(raw: string | string[]): number {
  const str = Array.isArray(raw) ? raw[0] : raw;
  return parseInt(str, 10);
}

router.get("/anthropic/conversations", async (_req, res): Promise<void> => {
  const conversations = await db
    .select()
    .from(conversationsTable)
    .orderBy(conversationsTable.createdAt);

  res.json(
    conversations.map((c) => ({
      id: String(c.id),
      title: c.title,
      createdAt: c.createdAt.toISOString(),
      updatedAt: c.updatedAt.toISOString(),
    }))
  );
});

router.post("/anthropic/conversations", async (req, res): Promise<void> => {
  const parsed = CreateConversationBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [conversation] = await db
    .insert(conversationsTable)
    .values({ title: parsed.data.title })
    .returning();

  res.status(201).json({
    id: String(conversation.id),
    title: conversation.title,
    createdAt: conversation.createdAt.toISOString(),
    updatedAt: conversation.updatedAt.toISOString(),
  });
});

router.get(
  "/anthropic/conversations/:conversationId",
  async (req, res): Promise<void> => {
    const id = parseId(req.params.conversationId);
    if (isNaN(id)) {
      res.status(400).json({ error: "Invalid conversation ID" });
      return;
    }

    const [conversation] = await db
      .select()
      .from(conversationsTable)
      .where(eq(conversationsTable.id, id));

    if (!conversation) {
      res.status(404).json({ error: "Conversation not found" });
      return;
    }

    const msgs = await db
      .select()
      .from(messagesTable)
      .where(eq(messagesTable.conversationId, id))
      .orderBy(messagesTable.createdAt);

    res.json({
      id: String(conversation.id),
      title: conversation.title,
      createdAt: conversation.createdAt.toISOString(),
      updatedAt: conversation.updatedAt.toISOString(),
      messages: msgs.map((m) => ({
        id: String(m.id),
        conversationId: String(m.conversationId),
        role: m.role,
        content: m.content,
        createdAt: m.createdAt.toISOString(),
      })),
    });
  }
);

router.delete(
  "/anthropic/conversations/:conversationId",
  async (req, res): Promise<void> => {
    const id = parseId(req.params.conversationId);
    if (isNaN(id)) {
      res.status(400).json({ error: "Invalid conversation ID" });
      return;
    }

    await db.delete(messagesTable).where(eq(messagesTable.conversationId, id));
    await db.delete(conversationsTable).where(eq(conversationsTable.id, id));

    res.sendStatus(204);
  }
);

router.post(
  "/anthropic/conversations/:conversationId/messages",
  async (req, res): Promise<void> => {
    const id = parseId(req.params.conversationId);
    if (isNaN(id)) {
      res.status(400).json({ error: "Invalid conversation ID" });
      return;
    }

    const body = SendAnthropicMessageBody.safeParse(req.body);
    if (!body.success) {
      res.status(400).json({ error: body.error.message });
      return;
    }

    const [conversation] = await db
      .select()
      .from(conversationsTable)
      .where(eq(conversationsTable.id, id));

    if (!conversation) {
      res.status(404).json({ error: "Conversation not found" });
      return;
    }

    await db.insert(messagesTable).values({
      conversationId: id,
      role: "user",
      content: body.data.content,
    });

    const history = await db
      .select()
      .from(messagesTable)
      .where(eq(messagesTable.conversationId, id))
      .orderBy(messagesTable.createdAt);

    const chatMessages = history.map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    }));

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    try {
      const fullResponse = await streamConversationResponse(
        chatMessages,
        CODE_ASSISTANT_SYSTEM,
        (chunk) => {
          res.write(`data: ${JSON.stringify({ content: chunk })}\n\n`);
        }
      );

      await db.insert(messagesTable).values({
        conversationId: id,
        role: "assistant",
        content: fullResponse,
      });

      res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
    } catch (err) {
      logger.error({ err }, "Streaming failed");
      res.write(`data: ${JSON.stringify({ error: "Stream failed" })}\n\n`);
    }

    res.end();
  }
);

export default router;
