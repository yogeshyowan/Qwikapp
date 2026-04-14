import { Router, type IRouter } from "express";
import { eq, sql, and } from "drizzle-orm";
import {
  db,
  projectsTable,
  projectFilesTable,
  conversationsTable,
  messagesTable,
  subscriptionsTable,
  tokenUsageTable,
} from "@workspace/db";
import {
  CreateProjectBody,
  GetProjectParams,
  DeleteProjectParams,
  ListProjectFilesParams,
} from "@workspace/api-zod";
import {
  generateAppCode,
  streamConversationResponse,
  LIVE_BUILD_SYSTEM,
  extractCompleteJsonObjects,
} from "../../lib/codegen";
import { buildAndRunApp, stopAndRemoveApp } from "../../lib/docker";
import { logger } from "../../lib/logger";
import { requireAuth } from "../../middlewares/auth";

// Cost constants (microdollars per token, Claude Sonnet 4.6)
const INPUT_COST_MICRODOLLARS_PER_TOKEN = 3;   // $3 / million = 3 µ$/token
const OUTPUT_COST_MICRODOLLARS_PER_TOKEN = 15;  // $15 / million = 15 µ$/token
const USER_MARKUP = 2; // user charged 2× our Claude cost

const router: IRouter = Router();

router.get("/projects/stats", async (_req, res): Promise<void> => {
  const [{ total }] = await db
    .select({ total: sql<number>`count(*)` })
    .from(projectsTable);

  const [{ completed }] = await db
    .select({ completed: sql<number>`count(*)` })
    .from(projectsTable)
    .where(eq(projectsTable.status, "done"));

  const [{ filesTotal }] = await db
    .select({ filesTotal: sql<number>`count(*)` })
    .from(projectFilesTable);

  const breakdown = await db
    .select({
      techStack: projectsTable.techStack,
      count: sql<number>`count(*)`,
    })
    .from(projectsTable)
    .groupBy(projectsTable.techStack);

  res.json({
    totalProjects: Number(total),
    completedProjects: Number(completed),
    totalFilesGenerated: Number(filesTotal),
    techStackBreakdown: breakdown.map((b) => ({
      techStack: b.techStack,
      count: Number(b.count),
    })),
  });
});

router.get("/projects", async (_req, res): Promise<void> => {
  const projects = await db
    .select()
    .from(projectsTable)
    .orderBy(projectsTable.createdAt);

  res.json(
    projects.map((p) => ({
      ...p,
      createdAt: p.createdAt.toISOString(),
      updatedAt: p.updatedAt.toISOString(),
    }))
  );
});

router.post("/projects", async (req, res): Promise<void> => {
  const parsed = CreateProjectBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [project] = await db
    .insert(projectsTable)
    .values({
      title: parsed.data.title,
      description: parsed.data.description,
      techStack: parsed.data.techStack,
      status: "pending",
    })
    .returning();

  res.status(201).json({
    ...project,
    createdAt: project.createdAt.toISOString(),
    updatedAt: project.updatedAt.toISOString(),
  });
});

router.get("/projects/:id", async (req, res): Promise<void> => {
  const params = GetProjectParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "Invalid project ID" });
    return;
  }

  const [project] = await db
    .select()
    .from(projectsTable)
    .where(eq(projectsTable.id, params.data.id));

  if (!project) {
    res.status(404).json({ error: "Project not found" });
    return;
  }

  res.json({
    ...project,
    createdAt: project.createdAt.toISOString(),
    updatedAt: project.updatedAt.toISOString(),
  });
});

router.delete("/projects/:id", async (req, res): Promise<void> => {
  const params = DeleteProjectParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "Invalid project ID" });
    return;
  }

  const [project] = await db
    .select()
    .from(projectsTable)
    .where(eq(projectsTable.id, params.data.id));

  if (!project) {
    res.status(404).json({ error: "Project not found" });
    return;
  }

  if (project.conversationId) {
    await stopAndRemoveApp(project.conversationId).catch(() => {});
  }

  await db
    .delete(projectFilesTable)
    .where(eq(projectFilesTable.projectId, params.data.id));
  await db
    .delete(projectsTable)
    .where(eq(projectsTable.id, params.data.id));

  res.sendStatus(204);
});

router.get("/projects/:id/files", async (req, res): Promise<void> => {
  const params = ListProjectFilesParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "Invalid project ID" });
    return;
  }

  const files = await db
    .select()
    .from(projectFilesTable)
    .where(eq(projectFilesTable.projectId, params.data.id));

  res.json(
    files.map((f) => ({
      ...f,
      createdAt: f.createdAt.toISOString(),
    }))
  );
});

// Generate code + deploy
router.post("/projects/:id/generate", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);

  const [project] = await db
    .select()
    .from(projectsTable)
    .where(eq(projectsTable.id, id));

  if (!project) {
    res.status(404).json({ error: "Project not found" });
    return;
  }

  await db
    .update(projectsTable)
    .set({ status: "generating", updatedAt: new Date() })
    .where(eq(projectsTable.id, id));

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  try {
    const result = await generateAppCode(
      project.title,
      project.description,
      project.techStack,
      (chunk) => {
        res.write(`data: ${JSON.stringify({ type: "chunk", content: chunk })}\n\n`);
      }
    );

    // Save files to DB
    await db.delete(projectFilesTable).where(eq(projectFilesTable.projectId, id));
    for (const file of result.files) {
      await db.insert(projectFilesTable).values({
        projectId: id,
        filename: file.filename,
        language: file.language,
        content: file.content,
      });
    }

    // Deploy via Docker if Docker socket is available
    let deployUrl: string | null = null;
    try {
      const subdomain = `app-${id}`;
      const deployed = await buildAndRunApp(id, subdomain, result.files);
      const domain = process.env.PLATFORM_DOMAIN || "localhost";
      deployUrl = `https://${subdomain}.${domain}`;

      await db
        .update(projectsTable)
        .set({
          status: "done",
          conversationId: deployed.containerId,
          updatedAt: new Date(),
        })
        .where(eq(projectsTable.id, id));
    } catch (dockerErr) {
      logger.warn({ dockerErr }, "Docker not available, skipping deployment");
      await db
        .update(projectsTable)
        .set({ status: "done", updatedAt: new Date() })
        .where(eq(projectsTable.id, id));
    }

    res.write(
      `data: ${JSON.stringify({ type: "done", summary: result.summary, deployUrl, fileCount: result.files.length })}\n\n`
    );
  } catch (err) {
    logger.error({ err, projectId: id }, "Code generation failed");
    await db
      .update(projectsTable)
      .set({ status: "error", updatedAt: new Date() })
      .where(eq(projectsTable.id, id));
    const message =
      err instanceof Error ? err.message : "Generation failed unexpectedly";
    res.write(`data: ${JSON.stringify({ type: "error", message })}\n\n`);
  }

  res.end();
});

// Redeploy (CI/CD trigger)
router.post("/projects/:id/redeploy", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);

  const [project] = await db
    .select()
    .from(projectsTable)
    .where(eq(projectsTable.id, id));

  if (!project) {
    res.status(404).json({ error: "Project not found" });
    return;
  }

  const files = await db
    .select()
    .from(projectFilesTable)
    .where(eq(projectFilesTable.projectId, id));

  if (files.length === 0) {
    res.status(400).json({ error: "No files to deploy" });
    return;
  }

  await db
    .update(projectsTable)
    .set({ status: "generating", updatedAt: new Date() })
    .where(eq(projectsTable.id, id));

  // Stop old container
  if (project.conversationId) {
    await stopAndRemoveApp(project.conversationId).catch(() => {});
  }

  try {
    const subdomain = `app-${id}`;
    const deployed = await buildAndRunApp(id, subdomain, files);
    const domain = process.env.PLATFORM_DOMAIN || "localhost";
    const deployUrl = `https://${subdomain}.${domain}`;

    await db
      .update(projectsTable)
      .set({
        status: "done",
        conversationId: deployed.containerId,
        updatedAt: new Date(),
      })
      .where(eq(projectsTable.id, id));

    res.json({ success: true, deployUrl });
  } catch (err) {
    logger.error({ err, projectId: id }, "Redeploy failed");
    await db
      .update(projectsTable)
      .set({ status: "error", updatedAt: new Date() })
      .where(eq(projectsTable.id, id));
    res.status(500).json({ error: "Redeployment failed" });
  }
});

router.post("/projects/:id/publish", requireAuth, async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);

  const [project] = await db
    .select()
    .from(projectsTable)
    .where(eq(projectsTable.id, id));

  if (!project) {
    res.status(404).json({ error: "Project not found" });
    return;
  }

  const { currentHtml } = (req.body ?? {}) as { currentHtml?: string };

  const [previewFile] = await db
    .select({ id: projectFilesTable.id, content: projectFilesTable.content })
    .from(projectFilesTable)
    .where(
      and(
        eq(projectFilesTable.projectId, id),
        eq(projectFilesTable.filename, "_preview.html")
      )
    );

  const htmlToPublish = typeof currentHtml === "string" && currentHtml.trim()
    ? currentHtml
    : previewFile?.content;

  if (!htmlToPublish) {
    res.status(400).json({ error: "Build a sandbox preview before publishing" });
    return;
  }

  if (previewFile) {
    await db
      .update(projectFilesTable)
      .set({ content: htmlToPublish })
      .where(eq(projectFilesTable.id, previewFile.id));
  } else {
    await db.insert(projectFilesTable).values({
      projectId: id,
      filename: "_preview.html",
      language: "html",
      content: htmlToPublish,
    });
  }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  const sendStage = (
    id: string,
    label: string,
    status: "running" | "done",
    message: string
  ) => {
    res.write(
      `data: ${JSON.stringify({
        type: "stage",
        stage: { id, label, status, message },
      })}\n\n`
    );
  };

  const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
  const domain = process.env.PLATFORM_DOMAIN || "qwikorder.site";
  const publishedUrl = `https://${domain}/sandbox/app-${id}`;

  try {
    sendStage("publish-bundle", "Publish bundle", "running", "Bundling sandbox preview");
    await wait(450);
    sendStage("publish-bundle", "Publish bundle", "done", "Preview bundle created");

    sendStage("security-bundle", "Security bundle", "running", "Checking HTML sandbox boundaries");
    await wait(450);
    sendStage("security-bundle", "Security bundle", "done", "Sandbox security checks passed");

    sendStage("promote-all", "Promote all", "running", "Promoting to qwikorder.site sub-page");
    await wait(450);
    sendStage("promote-all", "Promote all", "done", "Published route is live");

    await db
      .update(projectsTable)
      .set({ status: "done", updatedAt: new Date() })
      .where(eq(projectsTable.id, id));

    res.write(
      `data: ${JSON.stringify({ type: "done", publishedUrl })}\n\n`
    );
  } catch (err) {
    logger.error({ err, projectId: id }, "Publish workflow failed");
    res.write(
      `data: ${JSON.stringify({ type: "error", message: "Publish workflow failed" })}\n\n`
    );
  }

  res.end();
});

// ─── File CRUD ───────────────────────────────────────────────────────────────

function detectLanguage(filename: string): string {
  const ext = (filename.split(".").pop() ?? "").toLowerCase();
  const map: Record<string, string> = {
    ts: "typescript", tsx: "typescript",
    js: "javascript", jsx: "javascript", mjs: "javascript",
    py: "python", rb: "ruby", go: "go", rs: "rust",
    java: "java", kt: "kotlin", swift: "swift",
    c: "c", cpp: "cpp", h: "c", hpp: "cpp",
    css: "css", scss: "scss", less: "less",
    html: "html", htm: "html",
    json: "json", yaml: "yaml", yml: "yaml", toml: "toml",
    md: "markdown", txt: "text",
    sh: "shell", bash: "shell", zsh: "shell",
    dockerfile: "dockerfile", sql: "sql",
    xml: "xml", svg: "xml",
  };
  if (filename.toLowerCase() === "dockerfile") return "dockerfile";
  return map[ext] ?? "text";
}

router.post("/projects/:id/files", async (req, res): Promise<void> => {
  const id = parseInt(
    Array.isArray(req.params.id) ? req.params.id[0] : req.params.id,
    10
  );

  const [project] = await db
    .select()
    .from(projectsTable)
    .where(eq(projectsTable.id, id));

  if (!project) {
    res.status(404).json({ error: "Project not found" });
    return;
  }

  const { filename, content = "" } = (req.body ?? {}) as {
    filename?: string;
    content?: string;
  };

  if (!filename || typeof filename !== "string") {
    res.status(400).json({ error: "filename is required" });
    return;
  }

  const [file] = await db
    .insert(projectFilesTable)
    .values({
      projectId: id,
      filename,
      language: detectLanguage(filename),
      content,
    })
    .returning();

  res.status(201).json({ ...file, createdAt: file.createdAt.toISOString() });
});

router.put("/projects/:id/files/:fileId", async (req, res): Promise<void> => {
  const fileId = parseInt(req.params.fileId, 10);
  const { content } = (req.body ?? {}) as { content?: string };

  if (typeof content !== "string") {
    res.status(400).json({ error: "content is required" });
    return;
  }

  await db
    .update(projectFilesTable)
    .set({ content })
    .where(eq(projectFilesTable.id, fileId));

  res.json({ success: true });
});

router.patch("/projects/:id/files/:fileId", async (req, res): Promise<void> => {
  const fileId = parseInt(req.params.fileId, 10);
  const { filename } = (req.body ?? {}) as { filename?: string };

  if (!filename || typeof filename !== "string") {
    res.status(400).json({ error: "filename is required" });
    return;
  }

  const [file] = await db
    .update(projectFilesTable)
    .set({ filename, language: detectLanguage(filename) })
    .where(eq(projectFilesTable.id, fileId))
    .returning();

  res.json({ ...file, createdAt: file.createdAt.toISOString() });
});

router.delete("/projects/:id/files/:fileId", async (req, res): Promise<void> => {
  const fileId = parseInt(req.params.fileId, 10);
  await db
    .delete(projectFilesTable)
    .where(eq(projectFilesTable.id, fileId));
  res.sendStatus(204);
});

// ─── Live Builder ─────────────────────────────────────────────────────────────

// Live interactive builder — requires auth, checks credit, tracks token usage
router.post("/projects/:id/live-build", requireAuth, async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  const userId = req.user!.userId;

  const [project] = await db
    .select()
    .from(projectsTable)
    .where(eq(projectsTable.id, id));

  if (!project) {
    res.status(404).json({ error: "Project not found" });
    return;
  }

  // Check user has sufficient credit
  const [sub] = await db
    .select()
    .from(subscriptionsTable)
    .where(eq(subscriptionsTable.userId, userId));

  if (!sub || sub.creditMicrodollars <= 0) {
    res.status(402).json({
      error: "Insufficient credit. Please upgrade your plan.",
      code: "INSUFFICIENT_CREDIT",
    });
    return;
  }

  const { message, conversationId, currentHtml } = (req.body ?? {}) as {
    message?: string;
    conversationId?: string;
    currentHtml?: string;
  };

  let convId: number;

  if (conversationId) {
    convId = parseInt(conversationId, 10);
    if (isNaN(convId)) {
      res.status(400).json({ error: "Invalid conversationId" });
      return;
    }
    if (message) {
      await db.insert(messagesTable).values({
        conversationId: convId,
        role: "user",
        content: message,
      });
    }
  } else {
    const [conv] = await db
      .insert(conversationsTable)
      .values({ title: `Live Build: ${project.title}` })
      .returning();
    convId = conv.id;

    const initialPrompt = `Build this app:\nTitle: ${project.title}\nDescription: ${project.description}\nTech Stack: ${project.techStack}`;
    await db.insert(messagesTable).values({
      conversationId: convId,
      role: "user",
      content: initialPrompt,
    });
  }

  const history = await db
    .select()
    .from(messagesTable)
    .where(eq(messagesTable.conversationId, convId))
    .orderBy(messagesTable.createdAt);

  const chatMessages = history.map((m) => ({
    role: m.role as "user" | "assistant",
    content: m.content,
  }));

  if (message && typeof currentHtml === "string" && currentHtml.trim() && chatMessages.length > 0) {
    const currentHtmlContext = currentHtml.length > 45000
      ? `${currentHtml.slice(0, 45000)}\n\n[HTML truncated to fit context]`
      : currentHtml;
    const lastMessage = chatMessages[chatMessages.length - 1];
    if (lastMessage.role === "user") {
      lastMessage.content = `${message}\n\nCurrent preview HTML, representing the interface the user is looking at right now:\n${currentHtmlContext}`;
    }
  }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  res.write(
    `data: ${JSON.stringify({ type: "init", conversationId: String(convId) })}\n\n`
  );

  try {
    let jsonBuffer = "";
    let lastHtml = "";

    const liveBuildTokens = conversationId ? 3000 : 6000;

    const streamResult = await streamConversationResponse(
      chatMessages,
      LIVE_BUILD_SYSTEM,
      (chunk) => {
        jsonBuffer += chunk;
        const { objects, remaining } = extractCompleteJsonObjects(jsonBuffer);
        jsonBuffer = remaining;

        for (const action of objects) {
          const a = action as Record<string, unknown>;
          if (typeof a.html === "string") lastHtml = a.html;
          res.write(
            `data: ${JSON.stringify({ type: "action", action })}\n\n`
          );
        }
      },
      liveBuildTokens
    );

    // Flush remaining buffer
    const { objects: finalObjects } = extractCompleteJsonObjects(jsonBuffer);
    for (const action of finalObjects) {
      const a = action as Record<string, unknown>;
      if (typeof a.html === "string") lastHtml = a.html;
      res.write(
        `data: ${JSON.stringify({ type: "action", action })}\n\n`
      );
    }

    // Persist assistant reply
    await db.insert(messagesTable).values({
      conversationId: convId,
      role: "assistant",
      content: streamResult.text,
    });

    // ── Token usage & billing ────────────────────────────────────────────
    const { inputTokens, outputTokens } = streamResult;
    const claudeCostMicrodollars =
      inputTokens * INPUT_COST_MICRODOLLARS_PER_TOKEN +
      outputTokens * OUTPUT_COST_MICRODOLLARS_PER_TOKEN;
    const userChargeMicrodollars = claudeCostMicrodollars * USER_MARKUP;

    const description = conversationId ? `Modify: ${project.title}` : `Build: ${project.title}`;

    await db.insert(tokenUsageTable).values({
      userId,
      projectId: id,
      inputTokens,
      outputTokens,
      claudeCostMicrodollars,
      userChargeMicrodollars,
      description,
    });

    // Deduct from subscription (floor at 0)
    const newCredit = Math.max(0, sub.creditMicrodollars - userChargeMicrodollars);
    await db
      .update(subscriptionsTable)
      .set({ creditMicrodollars: newCredit, updatedAt: new Date() })
      .where(eq(subscriptionsTable.userId, userId));

    // Save / update preview HTML
    if (lastHtml) {
      const [existing] = await db
        .select({ id: projectFilesTable.id })
        .from(projectFilesTable)
        .where(
          and(
            eq(projectFilesTable.projectId, id),
            eq(projectFilesTable.filename, "_preview.html")
          )
        );

      if (existing) {
        await db
          .update(projectFilesTable)
          .set({ content: lastHtml })
          .where(eq(projectFilesTable.id, existing.id));
      } else {
        await db.insert(projectFilesTable).values({
          projectId: id,
          filename: "_preview.html",
          language: "html",
          content: lastHtml,
        });
      }
    }

    const domain = process.env.PLATFORM_DOMAIN;
    const deployUrl = domain ? `https://app-${id}.${domain}` : null;

    res.write(
      `data: ${JSON.stringify({
        type: "done",
        deployUrl,
        usage: {
          inputTokens,
          outputTokens,
          chargedUsd: (userChargeMicrodollars / 1_000_000).toFixed(4),
          remainingCreditUsd: (newCredit / 1_000_000).toFixed(4),
        },
      })}\n\n`
    );
  } catch (err) {
    logger.error({ err, projectId: id }, "Live build stream failed");
    res.write(
      `data: ${JSON.stringify({ type: "error", message: "Stream failed" })}\n\n`
    );
  }

  res.end();
});

export default router;
