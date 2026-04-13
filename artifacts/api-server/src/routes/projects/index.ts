import { Router, type IRouter } from "express";
import { eq, sql } from "drizzle-orm";
import { db, projectsTable, projectFilesTable } from "@workspace/db";
import {
  CreateProjectBody,
  GetProjectParams,
  DeleteProjectParams,
  ListProjectFilesParams,
} from "@workspace/api-zod";
import { generateAppCode } from "../../lib/codegen";
import { buildAndRunApp, stopAndRemoveApp } from "../../lib/docker";
import { logger } from "../../lib/logger";

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

export default router;
