import { useEffect, useState } from "react";
import { Link, useParams } from "wouter";
import { AlertCircle, ArrowLeft, Loader2, Monitor } from "lucide-react";
import { Button } from "@/components/ui/button";

type ProjectFile = {
  filename: string;
  content: string;
};

export default function SandboxPreview() {
  const { id } = useParams<{ id: string }>();
  const numericId = id?.replace(/^app-/, "") ?? "";
  const [html, setHtml] = useState("");
  const [title, setTitle] = useState(id ?? "preview");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadPreview() {
      if (id === "demo") {
        setHtml(`<!doctype html><html><head><meta charset="utf-8"><style>body{font-family:Inter,system-ui;margin:0;background:#ecfdf5;color:#064e3b;display:grid;place-items:center;min-height:100vh}.card{background:white;border:1px solid #a7f3d0;border-radius:24px;padding:40px;max-width:560px;box-shadow:0 20px 80px #064e3b22}h1{font-size:42px;margin:0 0 12px}p{font-size:18px;line-height:1.6;color:#047857}</style></head><body><main class="card"><h1>Sandbox preview</h1><p>This is the public preview route for apps before they are promoted through publish.</p></main></body></html>`);
        setTitle("demo");
        setLoading(false);
        return;
      }

      try {
        const projectRes = await fetch(`/api/projects/${numericId}`);
        if (projectRes.ok) {
          const project = await projectRes.json() as { title?: string };
          if (!cancelled && project.title) setTitle(project.title);
        }

        const filesRes = await fetch(`/api/projects/${numericId}/files`);
        if (!filesRes.ok) throw new Error("Preview files were not found");
        const files = await filesRes.json() as ProjectFile[];
        const preview = files.find((file) => file.filename === "_preview.html");
        if (!preview) throw new Error("This project does not have a sandbox preview yet");
        if (!cancelled) setHtml(preview.content);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load preview");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadPreview();
    return () => {
      cancelled = true;
    };
  }, [id, numericId]);

  return (
    <div className="min-h-screen bg-[#080b10] text-white flex flex-col">
      <header className="h-12 border-b border-white/10 bg-[#0d1118] flex items-center gap-3 px-4">
        <Link href="/">
          <Button size="sm" variant="ghost" className="h-8 gap-2 text-slate-300 hover:text-white hover:bg-white/10">
            <ArrowLeft className="h-4 w-4" />
            Qwikorder
          </Button>
        </Link>
        <div className="h-5 w-px bg-white/10" />
        <Monitor className="h-4 w-4 text-emerald-300" />
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{title}</p>
          <p className="text-[11px] text-slate-400">qwikorder.site/sandbox/{id}</p>
        </div>
      </header>

      <main className="flex-1 p-3">
        <div className="h-full min-h-[calc(100vh-72px)] overflow-hidden rounded-xl border border-white/10 bg-white">
          {loading ? (
            <div className="h-full min-h-[calc(100vh-72px)] grid place-items-center text-slate-700">
              <div className="flex items-center gap-3 text-sm">
                <Loader2 className="h-5 w-5 animate-spin" />
                Loading sandbox preview…
              </div>
            </div>
          ) : error ? (
            <div className="h-full min-h-[calc(100vh-72px)] grid place-items-center bg-slate-50 text-slate-800">
              <div className="max-w-md text-center">
                <AlertCircle className="mx-auto mb-3 h-8 w-8 text-amber-500" />
                <h1 className="text-xl font-bold">Preview unavailable</h1>
                <p className="mt-2 text-sm text-slate-600">{error}</p>
              </div>
            </div>
          ) : (
            <iframe
              srcDoc={html}
              sandbox="allow-scripts allow-forms allow-modals"
              className="h-full min-h-[calc(100vh-72px)] w-full border-0 bg-white"
              title="Sandbox preview"
            />
          )}
        </div>
      </main>
    </div>
  );
}