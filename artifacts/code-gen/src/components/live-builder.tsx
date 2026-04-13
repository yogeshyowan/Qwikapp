import { useState, useRef, useEffect } from "react";
import {
  CheckCircle2,
  Code2,
  Eye,
  Loader2,
  RefreshCw,
  Send,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";

// ─── Types ────────────────────────────────────────────────────────────────────

type BuildEventLog =
  | { type: "progress"; part: string; progress: number; message: string }
  | { type: "ask"; question: string; options: string[] }
  | { type: "answer"; text: string }
  | { type: "complete"; message: string }
  | { type: "modify"; part: string; message: string }
  | { type: "error"; message: string };

type BuildAction = {
  action: string;
  question?: string;
  options?: string[];
  part?: string;
  progress?: number;
  html?: string;
  message?: string;
  done?: boolean;
};

interface LiveBuilderProps {
  projectId: number;
  project: {
    title: string;
    description: string;
    techStack: string;
  };
}

// ─── Component ────────────────────────────────────────────────────────────────

export function LiveBuilder({ projectId, project }: LiveBuilderProps) {
  const { toast } = useToast();

  // Stable refs — never cause stale closures in async callbacks
  const convIdRef = useRef<string | null>(null);
  const hasStartedRef = useRef(false);
  const logScrollRef = useRef<HTMLDivElement>(null);

  // Build state
  const [eventLog, setEventLog] = useState<BuildEventLog[]>([]);
  const [liveHtml, setLiveHtml] = useState<string>("");
  const [htmlRevision, setHtmlRevision] = useState(0);
  const [progress, setProgress] = useState(0);
  const [progressPart, setProgressPart] = useState("");
  const [isDone, setIsDone] = useState(false);
  const [isBuilding, setIsBuilding] = useState(false);
  const [pendingQuestion, setPendingQuestion] = useState<{
    question: string;
    options: string[];
  } | null>(null);

  // Preview panel
  const [previewMode, setPreviewMode] = useState<"preview" | "code">("preview");
  const [modifyInput, setModifyInput] = useState("");

  // Auto-scroll the log
  useEffect(() => {
    if (logScrollRef.current) {
      logScrollRef.current.scrollTop = logScrollRef.current.scrollHeight;
    }
  }, [eventLog]);

  // Auto-start on first mount
  useEffect(() => {
    if (!hasStartedRef.current) {
      hasStartedRef.current = true;
      runBuild();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Core streaming function ──────────────────────────────────────────────

  const runBuild = async (userMessage?: string) => {
    setIsBuilding(true);
    setPendingQuestion(null);

    if (userMessage) {
      setEventLog((prev) => [
        ...prev,
        { type: "answer" as const, text: userMessage },
      ]);
    }

    try {
      const body: { message?: string; conversationId?: string } = {};
      if (userMessage) body.message = userMessage;
      if (convIdRef.current) body.conversationId = convIdRef.current;

      const resp = await fetch(`/api/projects/${projectId}/live-build`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!resp.ok) throw new Error(`Server error: HTTP ${resp.status}`);
      if (!resp.body) throw new Error("No response body");

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let sseBuffer = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        sseBuffer += decoder.decode(value, { stream: true });
        const lines = sseBuffer.split("\n\n");
        sseBuffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const data = JSON.parse(line.slice(6)) as {
              type: string;
              conversationId?: string;
              action?: BuildAction;
              message?: string;
            };

            if (data.type === "init" && data.conversationId) {
              convIdRef.current = data.conversationId;
            } else if (data.type === "action" && data.action) {
              handleAction(data.action);
            } else if (data.type === "error") {
              setEventLog((prev) => [
                ...prev,
                {
                  type: "error" as const,
                  message: data.message ?? "Build failed",
                },
              ]);
            }
          } catch {
            /* ignore malformed SSE frames */
          }
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Build failed";
      setEventLog((prev) => [...prev, { type: "error" as const, message: msg }]);
      toast({
        title: "Build Error",
        description: msg,
        variant: "destructive",
      });
    } finally {
      setIsBuilding(false);
    }
  };

  // ── Action dispatcher ────────────────────────────────────────────────────

  const handleAction = (action: BuildAction) => {
    if (action.action === "ask" && action.question && action.options) {
      const q = { question: action.question, options: action.options };
      setPendingQuestion(q);
      setEventLog((prev) => [...prev, { type: "ask" as const, ...q }]);
    } else if (
      (action.action === "build" || action.action === "modify") &&
      action.html
    ) {
      setLiveHtml(action.html);
      setHtmlRevision((r) => r + 1);

      if (action.progress !== undefined) setProgress(action.progress);
      if (action.part) setProgressPart(action.part);

      if (action.action === "modify") {
        setEventLog((prev) => [
          ...prev,
          {
            type: "modify" as const,
            part: action.part ?? "Update",
            message: action.message ?? "",
          },
        ]);
      } else {
        setEventLog((prev) => [
          ...prev,
          {
            type: "progress" as const,
            part: action.part ?? "",
            progress: action.progress ?? 0,
            message: action.message ?? "",
          },
        ]);
      }

      if (action.done) {
        setIsDone(true);
        setEventLog((prev) => [
          ...prev,
          { type: "complete" as const, message: action.message ?? "Done" },
        ]);
      }
    }
  };

  // ── Event handlers ───────────────────────────────────────────────────────

  const handleAnswerQuestion = (answer: string) => {
    setPendingQuestion(null);
    runBuild(answer);
  };

  const handleModify = async (e: React.FormEvent) => {
    e.preventDefault();
    const msg = modifyInput.trim();
    if (!msg || isBuilding) return;
    setModifyInput("");
    setIsDone(false);
    await runBuild(msg);
  };

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="flex h-full overflow-hidden border border-border rounded-lg bg-card">

      {/* ── Left panel: build log ─────────────────────────────────────── */}
      <div className="w-2/5 border-r border-border flex flex-col bg-[#070707] min-w-0">

        {/* Header */}
        <div className="px-4 py-3 border-b border-border bg-sidebar/50 flex items-center gap-2 shrink-0">
          <Zap className="h-4 w-4 text-primary shrink-0" />
          <span className="text-xs font-bold tracking-widest text-primary uppercase">
            Live Builder
          </span>
          <div className="ml-auto flex items-center gap-2">
            {isBuilding && (
              <span className="text-xs text-muted-foreground font-mono flex items-center gap-1.5">
                <Loader2 className="h-3 w-3 animate-spin" />
                Building...
              </span>
            )}
            {isDone && !isBuilding && (
              <CheckCircle2 className="h-4 w-4 text-green-500" />
            )}
          </div>
        </div>

        {/* Log */}
        <div
          ref={logScrollRef}
          className="flex-1 overflow-auto p-4 space-y-3 font-mono text-xs"
        >
          {eventLog.length === 0 && (
            <div className="text-muted-foreground/40 flex items-center gap-2">
              <Loader2 className="h-3 w-3 animate-spin" />
              Initializing build...
            </div>
          )}

          {eventLog.map((ev, i) => {
            if (ev.type === "progress") {
              return (
                <div key={i} className="flex items-start gap-2 text-green-400/80">
                  <CheckCircle2 className="h-3 w-3 mt-0.5 shrink-0 text-green-500" />
                  <div className="min-w-0">
                    <span className="font-semibold text-green-300">{ev.part}</span>
                    <span className="text-muted-foreground ml-2">{ev.progress}%</span>
                    <div className="text-muted-foreground/60 mt-0.5 truncate">{ev.message}</div>
                  </div>
                </div>
              );
            }

            if (ev.type === "ask") {
              return (
                <div
                  key={i}
                  className="bg-yellow-500/10 border border-yellow-500/20 rounded-md p-3 space-y-2.5"
                >
                  <div className="text-yellow-300 flex items-start gap-2">
                    <span className="text-yellow-500 font-bold shrink-0">?</span>
                    <span className="leading-relaxed">{ev.question}</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {ev.options.map((opt, j) => (
                      <button
                        key={j}
                        onClick={() => pendingQuestion && handleAnswerQuestion(opt)}
                        disabled={!pendingQuestion || isBuilding}
                        className="px-2.5 py-1 bg-yellow-500/20 hover:bg-yellow-500/35 border border-yellow-500/30 rounded text-yellow-200 text-xs transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        {opt}
                      </button>
                    ))}
                  </div>
                </div>
              );
            }

            if (ev.type === "answer") {
              return (
                <div key={i} className="flex items-center gap-2 text-primary font-mono">
                  <span className="text-muted-foreground/50 shrink-0">{">"}</span>
                  <span className="truncate">{ev.text}</span>
                </div>
              );
            }

            if (ev.type === "complete") {
              return (
                <div key={i} className="flex items-center gap-2 text-green-400 font-semibold pt-1">
                  <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                  Build complete
                </div>
              );
            }

            if (ev.type === "modify") {
              return (
                <div key={i} className="flex items-start gap-2 text-blue-400/80">
                  <RefreshCw className="h-3 w-3 mt-0.5 shrink-0 text-blue-400" />
                  <div className="min-w-0">
                    <span className="font-semibold text-blue-300">{ev.part}</span>
                    <div className="text-muted-foreground/60 mt-0.5 truncate">{ev.message}</div>
                  </div>
                </div>
              );
            }

            if (ev.type === "error") {
              return (
                <div key={i} className="flex items-start gap-2 text-destructive">
                  <span className="shrink-0 font-bold">✗</span>
                  <span>{ev.message}</span>
                </div>
              );
            }

            return null;
          })}

          {isBuilding && (
            <div className="flex items-center gap-2 text-muted-foreground/40">
              <span className="inline-block w-1.5 h-3.5 bg-primary animate-pulse rounded-sm" />
            </div>
          )}
        </div>

        {/* Modification input — shown after build completes */}
        {isDone && !isBuilding && (
          <form
            onSubmit={handleModify}
            className="p-3 border-t border-border bg-sidebar/30 shrink-0"
          >
            <div className="flex gap-2">
              <Input
                value={modifyInput}
                onChange={(e) => setModifyInput(e.target.value)}
                placeholder="Request changes..."
                className="h-8 text-xs font-mono bg-[#050505] border-border focus-visible:ring-primary"
              />
              <Button
                type="submit"
                size="sm"
                disabled={!modifyInput.trim()}
                className="shrink-0 h-8 w-8 px-0"
              >
                <Send className="h-3 w-3" />
              </Button>
            </div>
          </form>
        )}
      </div>

      {/* ── Right panel: live preview ─────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0">

        {/* Progress bar — visible while building */}
        {!isDone && (
          <div className="px-4 py-2.5 border-b border-border bg-sidebar/30 shrink-0">
            <div className="flex items-center justify-between mb-1.5 text-xs">
              <span className="text-muted-foreground font-mono truncate pr-4">
                {progressPart || "Initializing…"}
              </span>
              <span className="font-bold text-primary shrink-0">{progress}%</span>
            </div>
            <Progress value={progress} className="h-1" />
          </div>
        )}

        {/* Completion banner */}
        {isDone && (
          <div className="flex items-center gap-3 px-4 py-2.5 bg-green-500/10 border-b border-green-500/20 shrink-0">
            <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
            <span className="text-xs font-semibold text-green-400">
              App built successfully!
            </span>
            <span className="text-xs text-green-400/50 ml-auto hidden sm:block">
              Request changes on the left
            </span>
          </div>
        )}

        {/* Preview / Code toggle */}
        <div className="flex items-center gap-1 px-3 py-1.5 border-b border-border bg-sidebar/20 shrink-0">
          <button
            onClick={() => setPreviewMode("preview")}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium transition-colors ${
              previewMode === "preview"
                ? "bg-primary/20 text-primary"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Eye className="h-3 w-3" />
            Preview
          </button>
          <button
            onClick={() => setPreviewMode("code")}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium transition-colors ${
              previewMode === "code"
                ? "bg-primary/20 text-primary"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Code2 className="h-3 w-3" />
            Code
          </button>
        </div>

        {/* Content area */}
        <div className="flex-1 overflow-hidden relative">
          {liveHtml ? (
            previewMode === "preview" ? (
              <iframe
                key={htmlRevision}
                srcDoc={liveHtml}
                sandbox="allow-scripts allow-forms allow-modals"
                className="w-full h-full bg-white border-0"
                title="Live app preview"
              />
            ) : (
              <ScrollArea className="h-full w-full">
                <pre className="p-4 text-xs font-mono text-gray-300 leading-relaxed whitespace-pre-wrap break-all bg-[#0a0a0a]">
                  {liveHtml}
                </pre>
              </ScrollArea>
            )
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-muted-foreground/40 gap-3">
              <Loader2 className="h-10 w-10 animate-spin" />
              <p className="text-sm font-mono">Generating first preview…</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
