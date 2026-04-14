import { type Request, type Response, type NextFunction, Router } from "express";
import { eq, and } from "drizzle-orm";
import { db, projectFilesTable, projectsTable } from "@workspace/db";
import { logger } from "../lib/logger";

const router = Router();

/**
 * Intercepts requests to app-{id}.{PLATFORM_DOMAIN} and serves the
 * live-built preview HTML directly. All other requests fall through.
 */
router.use(async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const host = (req.headers.host ?? "").toLowerCase();
  const domain = (process.env.PLATFORM_DOMAIN ?? "").toLowerCase();

  if (!domain || !host.endsWith("." + domain)) {
    return next();
  }

  const subdomain = host.slice(0, host.length - domain.length - 1);
  const match = /^app-(\d+)$/.exec(subdomain);
  if (!match) {
    return next();
  }

  const id = parseInt(match[1], 10);

  try {
    const [project] = await db
      .select({ title: projectsTable.title })
      .from(projectsTable)
      .where(eq(projectsTable.id, id));

    const [previewFile] = await db
      .select({ content: projectFilesTable.content })
      .from(projectFilesTable)
      .where(
        and(
          eq(projectFilesTable.projectId, id),
          eq(projectFilesTable.filename, "_preview.html")
        )
      );

    if (!previewFile) {
      res.status(404).send(`<!doctype html>
<html lang="en">
<head><meta charset="UTF-8"><title>Not deployed</title>
<style>body{font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;background:#f9fafb}
.card{text-align:center;padding:2rem;border:1px solid #e5e7eb;border-radius:12px;max-width:400px}</style>
</head>
<body><div class="card">
<h1 style="color:#111827;margin-bottom:.5rem">${project?.title ?? "App"}</h1>
<p style="color:#6b7280;margin-bottom:1.5rem">This app hasn't been built yet.</p>
<a href="https://${domain}" style="background:#059669;color:#fff;padding:.5rem 1.25rem;border-radius:8px;text-decoration:none;font-weight:600">Open Builder →</a>
</div></body></html>`);
      return;
    }

    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("X-Frame-Options", "SAMEORIGIN");
    res.send(previewFile.content);
  } catch (err) {
    logger.error({ err, subdomain, id }, "Failed to serve preview");
    next(err);
  }
});

export default router;
