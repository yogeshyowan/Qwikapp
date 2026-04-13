import { useState } from "react";
import {
  ExternalLink,
  Eye,
  RefreshCw,
  Zap,
} from "lucide-react";
import { LiveBuilder } from "@/components/live-builder";

interface PreviewFile {
  filename: string;
  language: string;
  content: string;
}

interface PreviewPanelProps {
  projectId: number;
  project: {
    title: string;
    description: string;
    techStack: string;
  };
  files: PreviewFile[];
  onBuilderHtml?: (html: string) => void;
}

type PreviewMode = "files" | "builder";

export function PreviewPanel({
  projectId,
  project,
  files,
  onBuilderHtml,
}: PreviewPanelProps) {
  const [mode, setMode] = useState<PreviewMode>("files");
  const [refreshKey, setRefreshKey] = useState(0);

  const staticDoc = buildPreviewDocument(files);
  const hasFiles = files.length > 0;

  return (
    <div className="flex flex-col h-full bg-[#0d0e12] overflow-hidden">
      {/* Browser chrome */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border/60 bg-[#0c0d10] shrink-0">
        {/* Mode toggle */}
        <div className="flex items-center bg-[#1a1b22] rounded p-0.5 gap-0.5">
          <button
            onClick={() => setMode("files")}
            className={`flex items-center gap-1 px-2 py-1 rounded text-[11px] transition-colors ${
              mode === "files"
                ? "bg-white/10 text-foreground"
                : "text-muted-foreground/60 hover:text-muted-foreground"
            }`}
          >
            <Eye className="h-3 w-3" />
            Preview
          </button>
          <button
            onClick={() => setMode("builder")}
            className={`flex items-center gap-1 px-2 py-1 rounded text-[11px] transition-colors ${
              mode === "builder"
                ? "bg-primary/20 text-primary"
                : "text-muted-foreground/60 hover:text-muted-foreground"
            }`}
          >
            <Zap className="h-3 w-3" />
            Builder
          </button>
        </div>

        {mode === "files" && (
          <>
            {/* Fake URL bar */}
            <div className="flex-1 flex items-center gap-1.5 px-3 h-6 bg-[#1a1b22] rounded text-[11px] text-muted-foreground/50 font-mono overflow-hidden min-w-0">
              <span className="text-emerald-400/60 shrink-0">●</span>
              <span className="truncate">localhost · preview</span>
            </div>

            <button
              onClick={() => setRefreshKey((k) => k + 1)}
              className="h-6 w-6 flex items-center justify-center rounded text-muted-foreground/50 hover:text-muted-foreground hover:bg-white/5 transition-colors"
              title="Reload preview"
            >
              <RefreshCw className="h-3.5 w-3.5" />
            </button>

            <button
              onClick={() => {
                const blob = new Blob([staticDoc], { type: "text/html" });
                const url = URL.createObjectURL(blob);
                window.open(url, "_blank");
              }}
              className="h-6 w-6 flex items-center justify-center rounded text-muted-foreground/50 hover:text-muted-foreground hover:bg-white/5 transition-colors"
              title="Open in new tab"
            >
              <ExternalLink className="h-3.5 w-3.5" />
            </button>
          </>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {mode === "files" ? (
          hasFiles ? (
            <iframe
              key={refreshKey}
              srcDoc={staticDoc}
              sandbox="allow-scripts allow-forms allow-modals"
              className="w-full h-full bg-white border-0"
              title="App preview"
            />
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-muted-foreground/30 gap-3">
              <Eye className="h-10 w-10" />
              <p className="text-sm">No files to preview yet.</p>
              <button
                onClick={() => setMode("builder")}
                className="text-primary/60 hover:text-primary text-xs underline-offset-2 hover:underline"
              >
                Try Live Builder instead
              </button>
            </div>
          )
        ) : (
          <LiveBuilder
            projectId={projectId}
            project={project}
          />
        )}
      </div>
    </div>
  );
}

// ── Preview document builder (same as the existing helper) ──────────────────

function buildPreviewDocument(files: PreviewFile[]): string {
  const css = files
    .filter((f) => f.filename.endsWith(".css"))
    .map((f) => `/* ${f.filename} */\n${f.content}`)
    .join("\n");

  const scripts = files
    .filter((f) => /\.(jsx?|tsx?)$/.test(f.filename))
    .sort((a, b) => scoreScript(a.filename) - scoreScript(b.filename))
    .map((f) => `/* ${f.filename} */\n${preparePreviewScript(f.content)}`)
    .join("\n");

  const hasApp = /\bfunction\s+App\b|\bconst\s+App\b|\bclass\s+App\b/.test(scripts);
  const renderCode = hasApp
    ? "ReactDOM.createRoot(document.getElementById('root')).render(<App />);"
    : "document.getElementById('root').innerHTML = '<div style=\"font-family:sans-serif;padding:32px;color:#111\"><h1>Preview unavailable</h1><p>No App component found.</p></div>';";

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <style>
      html, body, #root { min-height: 100%; margin: 0; }
      body { background: #fff; color: #111827; }
      ${css}
    </style>
  </head>
  <body>
    <div id="root"></div>
    <script src="https://unpkg.com/react@18/umd/react.development.js"></script>
    <script src="https://unpkg.com/react-dom@18/umd/react-dom.development.js"></script>
    <script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>
    <script type="text/babel">
      const { useState, useEffect, useMemo, useCallback, useRef } = React;
      ${scripts}
      ${renderCode}
    </script>
  </body>
</html>`;
}

function scoreScript(filename: string): number {
  if (/src\/main\.(jsx?|tsx?)$/.test(filename)) return 100;
  if (/src\/App\.(jsx?|tsx?)$/.test(filename)) return 90;
  return 10;
}

function preparePreviewScript(source: string): string {
  return source
    .replace(/^\s*import\s+["'][^"']+\.css["'];?\s*$/gm, "")
    .replace(/^\s*import\s+[^;]+from\s+["']react["'];?\s*$/gm, "")
    .replace(/^\s*import\s+[^;]+from\s+["']react-dom\/client["'];?\s*$/gm, "")
    .replace(/^\s*import\s+[^;]+from\s+["']\.{1,2}\/[^"']+["'];?\s*$/gm, "")
    .replace(/^\s*import\s+["']\.{1,2}\/[^"']+["'];?\s*$/gm, "")
    .replace(/\bexport\s+default\s+function\s+([A-Za-z0-9_$]+)/g, "function $1")
    .replace(/\bexport\s+default\s+class\s+([A-Za-z0-9_$]+)/g, "class $1")
    .replace(/\bexport\s+default\s+([A-Za-z0-9_$]+);?/g, "")
    .replace(/\bexport\s+function\s+/g, "function ")
    .replace(/\bexport\s+const\s+/g, "const ")
    .replace(/\bexport\s+let\s+/g, "let ")
    .replace(/\bexport\s+var\s+/g, "var ")
    .replace(/ReactDOM\.createRoot\([^)]*\)\.render\([\s\S]*?\);?/g, "")
    .replace(/const\s+root\s*=\s*ReactDOM\.createRoot\([^;]+;?/g, "")
    .replace(/root\.render\([\s\S]*?\);?/g, "");
}
