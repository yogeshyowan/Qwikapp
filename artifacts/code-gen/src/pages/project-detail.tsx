import { useCallback } from "react";
import { useParams } from "wouter";
import { useGetProject, useListProjectFiles } from "@workspace/api-client-react";
import { Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { TopBar } from "@/components/ide/top-bar";
import { LiveBuilder } from "@/components/live-builder";
import type { ProjectFile } from "@/components/ide/file-explorer";

async function downloadProjectZip(title: string, files: ProjectFile[]): Promise<void> {
  const JSZip = (await import("jszip")).default;
  const zip = new JSZip();
  for (const file of files) zip.file(file.filename, file.content);
  const blob = await zip.generateAsync({ type: "blob" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${title.replace(/[^a-z0-9-]/gi, "-").toLowerCase()}.zip`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function ProjectDetail() {
  const { id } = useParams<{ id: string }>();
  const projectId = parseInt(id ?? "0", 10);
  const { toast } = useToast();

  const { data: project, isLoading } = useGetProject(projectId);
  const { data: serverFiles, isLoading: filesLoading } = useListProjectFiles(projectId);

  const handleDownload = useCallback(async () => {
    if (!serverFiles || serverFiles.length === 0) {
      toast({ title: "Nothing to export", description: "No files found in this project." });
      return;
    }
    await downloadProjectZip(project?.title ?? "project", serverFiles as ProjectFile[]);
  }, [serverFiles, project, toast]);

  if (isLoading || filesLoading) {
    return (
      <div className="h-screen flex items-center justify-center bg-background text-muted-foreground gap-3">
        <Loader2 className="h-5 w-5 animate-spin" />
        <span className="text-sm font-mono">Loading project…</span>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="h-screen flex items-center justify-center bg-background text-destructive text-sm">
        Project not found.
      </div>
    );
  }

  const initialHtml = (serverFiles ?? []).find(f => f.filename === "_preview.html")?.content ?? "";

  return (
    <div className="h-screen flex flex-col bg-background overflow-hidden">
      <TopBar project={project} onDownload={handleDownload} />
      <div className="flex-1 overflow-hidden">
        <LiveBuilder projectId={projectId} project={project} initialHtml={initialHtml} />
      </div>
    </div>
  );
}
