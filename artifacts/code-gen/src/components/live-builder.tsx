import { useState, useRef, useEffect } from "react";
import {
  CheckCircle2,
  Code2,
  ExternalLink,
  FileText,
  Eye,
  Loader2,
  Monitor,
  PanelRight,
  RefreshCw,
  Send,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { getStoredToken } from "@/contexts/auth-context";
import { useAuth } from "@/contexts/auth-context";

// ─── Types ────────────────────────────────────────────────────────────────────

type BuildEventLog =
  | { type: "progress"; part: string; progress: number; message: string }
  | { type: "ask"; question: string; options: string[] }
  | { type: "answer"; text: string }
  | { type: "complete"; message: string }
  | { type: "modify"; part: string; message: string }
  | { type: "truncated" }
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
  /** Pre-loaded HTML from DB — shown immediately without triggering a new build */
  initialHtml?: string;
  files?: {
    id?: number;
    filename: string;
    language: string;
    content: string;
  }[];
}

const FALLBACK_OPTIONS = [
  "Continue building — add more features",
  "Polish the styling and layout",
  "Simplify and make it leaner",
];

// ─── Component ────────────────────────────────────────────────────────────────

export function LiveBuilder({ projectId, project, initialHtml, files = [] }: LiveBuilderProps) {
  const { toast } = useToast();
  const { refreshSubscription } = useAuth();

  const convIdRef = useRef<string | null>(null);
  const logScrollRef = useRef<HTMLDivElement>(null);
  const liveHtmlRef = useRef<string>(initialHtml ?? "");

  const [eventLog, setEventLog] = useState<BuildEventLog[]>([]);
  const [liveHtml, setLiveHtml] = useState<string>(initialHtml ?? "");
  const [htmlRevision, setHtmlRevision] = useState(0);
  const [progress, setProgress] = useState(initialHtml ? 100 : 0);
  const [progressPart, setProgressPart] = useState("");
  const [isDone, setIsDone] = useState(!!initialHtml);
  const [isBuilding, setIsBuilding] = useState(false);
  const [pendingQuestion, setPendingQuestion] = useState<{
    question: string;
    options: string[];
  } | null>(null);
  const [deployUrl, setDeployUrl] = useState<string | null>(null);

  const [previewMode, setPreviewMode] = useState<"preview" | "code">("preview");
  const [rightPanelMode, setRightPanelMode] = useState<"files" | "html">("files");
  const [modifyInput, setModifyInput] = useState("");

  // ── On mount: restore conversation ID and show cached state ─────────────

  useEffect(() => {
    const savedConvId = localStorage.getItem(`conv-${projectId}`);
    if (savedConvId) convIdRef.current = savedConvId;

    if (initialHtml) {
      // Show the cached build with options to continue
      const q = {
        question: "Welcome back! What would you like to change?",
        options: FALLBACK_OPTIONS,
      };
      setPendingQuestion(q);
      setEventLog([
        { type: "complete", message: "Previous build loaded from cache" },
        { type: "ask", ...q },
      ]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (logScrollRef.current) {
      logScrollRef.current.scrollTop = logScrollRef.current.scrollHeight;
    }
  }, [eventLog]);

  // ── Core streaming function ──────────────────────────────────────────────

  const runBuild = async (userMessage?: string) => {
    setIsBuilding(true);
    setIsDone(false);
    setPendingQuestion(null);

    if (userMessage) {
      setEventLog((prev) => [
        ...prev,
        { type: "answer" as const, text: userMessage },
      ]);
    }

    let receivedDone = false;

    try {
      const body: { message?: string; conversationId?: string; currentHtml?: string } = {};
      if (userMessage) body.message = userMessage;
      if (convIdRef.current) body.conversationId = convIdRef.current;
      if (userMessage && liveHtmlRef.current) body.currentHtml = liveHtmlRef.current;

      const token = getStoredToken();
      const resp = await fetch(`/api/projects/${projectId}/live-build`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(body),
      });

      if (resp.status === 401) {
        throw new Error("Please sign in to build projects.");
      }
      if (resp.status === 402) {
        throw new Error("Insufficient credit. Please upgrade your plan in Billing.");
      }
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
              deployUrl?: string;
              usage?: {
                inputTokens: number;
                outputTokens: number;
                chargedUsd: string;
                remainingCreditUsd: string;
              };
            };

            if (data.type === "init" && data.conversationId) {
              convIdRef.current = data.conversationId;
              localStorage.setItem(`conv-${projectId}`, data.conversationId);
            } else if (data.type === "action" && data.action) {
              if (data.action.done) receivedDone = true;
              handleAction(data.action);
            } else if (data.type === "done") {
              if (data.deployUrl) setDeployUrl(data.deployUrl);
              if (data.usage) {
                const total = data.usage.inputTokens + data.usage.outputTokens;
                toast({
                  title: "Build complete",
                  description: `${total.toLocaleString()} tokens used · $${data.usage.chargedUsd} charged · $${data.usage.remainingCreditUsd} credit left`,
                });
                refreshSubscription();
              }
            } else if (data.type === "error") {
              setEventLog((prev) => [
                ...prev,
                { type: "error" as const, message: data.message ?? "Build failed" },
              ]);
            }
          } catch {
            /* ignore malformed SSE frames */
          }
        }
      }

      // Stream ended — surface whatever was built if done:true never arrived
      if (!receivedDone) {
        if (liveHtmlRef.current) {
          const fallback = {
            question: "Here's what was built so far. What would you like to do next?",
            options: FALLBACK_OPTIONS,
          };
          setIsDone(true);
          setEventLog((prev) => [
            ...prev,
            { type: "truncated" as const },
            { type: "ask" as const, ...fallback },
          ]);
          setPendingQuestion(fallback);
        } else {
          setEventLog((prev) => [
            ...prev,
            {
              type: "error" as const,
              message: "Generation stopped before a preview was ready. Try again or simplify the description.",
            },
          ]);
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Build failed";
      setEventLog((prev) => [...prev, { type: "error" as const, message: msg }]);
      toast({ title: "Build Error", description: msg, variant: "destructive" });
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
      liveHtmlRef.current = action.html;
      setLiveHtml(action.html);
      setHtmlRevision((r) => r + 1);

      if (action.progress !== undefined) setProgress(action.progress);
      if (action.part) setProgressPart(action.part);

      if (action.action === "modify") {
        setEventLog((prev) => [
          ...prev,
          { type: "modify" as const, part: action.part ?? "Update", message: action.message ?? "" },
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

  const handleAnswerQuestion = (answer: string) => runBuild(answer);

  const handleModify = async (e: React.FormEvent) => {
    e.preventDefault();
    const msg = modifyInput.trim();
    if (!msg || isBuilding) return;
    setModifyInput("");
    await runBuild(msg);
  };

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="flex h-full overflow-hidden bg-[#0b0c10]">

      {/* ── Left panel: conversation ──────────────────────────────────── */}
      <div className="w-[360px] border-r border-border/70 flex flex-col bg-[#101116] min-w-0 shrink-0">

        {/* Header */}
        <div className="px-4 py-3 border-b border-border/70 bg-[#0d0e12] flex items-center gap-2 shrink-0">
          <Zap className="h-4 w-4 text-primary shrink-0" />
          <span className="text-xs font-bold tracking-widest text-primary uppercase">
            AI Builder
          </span>
          <div className="ml-auto flex items-center gap-2">
            {isBuilding && (
              <span className="text-xs text-muted-foreground font-mono flex items-center gap-1.5">
                <Loader2 className="h-3 w-3 animate-spin" />
                Building…
              </span>
            )}
            {isDone && !isBuilding && (
              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
            )}
          </div>
        </div>

        {/* Conversation log */}
        <div
          ref={logScrollRef}
          className="flex-1 overflow-auto p-4 space-y-3 font-mono text-xs"
        >
          {/* Initial state: no build yet */}
          {eventLog.length === 0 && !isBuilding && !liveHtml && (
            <div className="h-full flex flex-col items-center justify-center gap-4 text-center py-8">
              <div className="h-12 w-12 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center">
                <Zap className="h-6 w-6 text-primary" />
              </div>
              <div className="space-y-1">
                <p className="font-semibold text-foreground font-sans text-sm">{project.title}</p>
                <p className="text-muted-foreground text-xs font-sans">{project.techStack}</p>
                <p className="text-muted-foreground/70 text-xs font-sans max-w-[260px]">
                  Describe the app, then keep refining it while the preview stays visible.
                </p>
              </div>
              <Button
                onClick={() => runBuild()}
                className="gap-2 mt-2"
              >
                <Zap className="h-4 w-4" />
                Start Build
              </Button>
            </div>
          )}

          {eventLog.map((ev, i) => {
            if (ev.type === "progress") {
              return (
                <div key={i} className="flex items-start gap-2 text-emerald-700">
                  <CheckCircle2 className="h-3 w-3 mt-0.5 shrink-0 text-emerald-500" />
                  <div className="min-w-0">
                    <span className="font-semibold text-emerald-800">{ev.part}</span>
                    <span className="text-muted-foreground ml-2">{ev.progress}%</span>
                    <div className="text-muted-foreground mt-0.5 break-words">{ev.message}</div>
                  </div>
                </div>
              );
            }

            if (ev.type === "ask") {
              return (
                <div key={i} className="bg-primary/5 border border-primary/20 rounded-md p-3 space-y-2.5">
                  <div className="text-primary flex items-start gap-2">
                    <Zap className="h-3 w-3 mt-0.5 shrink-0" />
                    <span className="leading-relaxed font-sans">{ev.question}</span>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    {ev.options.map((opt, j) => (
                      <button
                        key={j}
                        onClick={() => pendingQuestion && handleAnswerQuestion(opt)}
                        disabled={!pendingQuestion || isBuilding}
                      className="text-left px-3 py-1.5 bg-[#151720] hover:bg-primary/10 border border-border/70 hover:border-primary/40 rounded text-foreground hover:text-primary text-xs transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
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
                  <span className="text-muted-foreground shrink-0">{">"}</span>
                  <span className="break-words">{ev.text}</span>
                </div>
              );
            }

            if (ev.type === "complete") {
              return (
                <div key={i} className="flex items-center gap-2 text-emerald-700 font-semibold pt-1">
                  <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-500" />
                  {ev.message}
                </div>
              );
            }

            if (ev.type === "truncated") {
              return (
                <div key={i} className="flex items-start gap-2 text-yellow-700 bg-yellow-50 border border-yellow-200 rounded p-2">
                  <span className="shrink-0">⚡</span>
                  <span>Preview ready — token limit reached. Tell me what to add or change next.</span>
                </div>
              );
            }

            if (ev.type === "modify") {
              return (
                <div key={i} className="flex items-start gap-2 text-blue-700">
                  <RefreshCw className="h-3 w-3 mt-0.5 shrink-0 text-blue-500" />
                  <div className="min-w-0">
                    <span className="font-semibold text-blue-800">{ev.part}</span>
                    <div className="text-muted-foreground mt-0.5 break-words">{ev.message}</div>
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
            <div className="flex items-center gap-2 text-muted-foreground">
              <span className="inline-block w-1.5 h-3.5 bg-primary animate-pulse rounded-sm" />
            </div>
          )}
        </div>

        {/* Input — shown once a build exists */}
        {(isDone || isBuilding) && (
          <form
            onSubmit={handleModify}
            className="p-3 border-t border-border/70 bg-[#0d0e12] shrink-0"
          >
            {liveHtml && (
              <div className="mb-2 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <Monitor className="h-3 w-3 text-primary" />
                The AI uses the current preview as context for each edit.
              </div>
            )}
            <div className="flex gap-2">
              <Input
                value={modifyInput}
                onChange={(e) => setModifyInput(e.target.value)}
                placeholder={isBuilding ? "Building…" : "Or describe your own change…"}
                disabled={isBuilding}
                className="h-8 text-xs font-mono bg-[#151720] border-border/70 focus-visible:ring-primary"
              />
              <Button
                type="submit"
                size="sm"
                disabled={!modifyInput.trim() || isBuilding}
                className="shrink-0 h-8 w-8 px-0"
              >
                <Send className="h-3 w-3" />
              </Button>
            </div>
          </form>
        )}
      </div>

      {/* ── Center panel: live preview ─────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0 bg-[#11131a]">

        {/* Progress bar while building */}
        {!isDone && isBuilding && (
          <div className="px-4 py-2.5 border-b border-border/70 bg-[#0d0e12] shrink-0">
            <div className="flex items-center justify-between mb-1.5 text-xs">
              <span className="text-muted-foreground font-mono truncate pr-4">
                {progressPart || "Initializing…"}
              </span>
              <span className="font-bold text-primary shrink-0">{progress}%</span>
            </div>
            <Progress value={progress} className="h-1" />
          </div>
        )}

        {/* Done banner — shows deploy URL + preview/code toggle */}
        {isDone && (
          <div className="flex items-center gap-3 px-4 py-2 bg-[#0d0e12] border-b border-border/70 shrink-0">
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
            <span className="text-xs font-semibold text-emerald-400">Preview ready</span>

            {deployUrl && (
              <a
                href={deployUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-xs text-primary hover:underline font-mono ml-1"
              >
                <ExternalLink className="h-3 w-3" />
                {deployUrl.replace("https://", "")}
              </a>
            )}

            <div className="ml-auto flex items-center gap-1 bg-[#151720] border border-border/70 rounded p-0.5">
              <button
                onClick={() => setPreviewMode("preview")}
                className={`flex items-center gap-1 px-2 py-1 rounded text-[11px] transition-colors ${
                  previewMode === "preview"
                    ? "bg-primary text-white"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Eye className="h-3 w-3" />
                Preview
              </button>
              <button
                onClick={() => setPreviewMode("code")}
                className={`flex items-center gap-1 px-2 py-1 rounded text-[11px] transition-colors ${
                  previewMode === "code"
                    ? "bg-primary text-white"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Code2 className="h-3 w-3" />
                Code
              </button>
            </div>
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-hidden relative p-3">
          <div className="h-full overflow-hidden rounded-lg border border-border/70 bg-white shadow-2xl">
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
                <pre className="p-4 text-xs font-mono text-gray-700 leading-relaxed whitespace-pre-wrap break-all bg-gray-50">
                  {liveHtml}
                </pre>
              </ScrollArea>
            )
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-muted-foreground/40 gap-3 bg-[#0d0e12]">
              {isBuilding ? (
                <>
                  <Loader2 className="h-10 w-10 animate-spin" />
                  <p className="text-sm font-mono">Generating first preview…</p>
                </>
              ) : (
                <>
                  <Eye className="h-10 w-10" />
                  <p className="text-sm">Preview will appear here once built.</p>
                </>
              )}
            </div>
          )}
          </div>
        </div>
      </div>

      <div className="w-[300px] border-l border-border/70 bg-[#0d0e12] flex flex-col shrink-0 min-w-0">
        <div className="px-3 py-3 border-b border-border/70 flex items-center gap-2 shrink-0">
          <PanelRight className="h-4 w-4 text-muted-foreground" />
          <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
            Tools & Files
          </span>
        </div>

        <div className="flex items-center gap-1 p-2 border-b border-border/70 shrink-0">
          <button
            onClick={() => setRightPanelMode("files")}
            className={`flex-1 flex items-center justify-center gap-1.5 rounded px-2 py-1.5 text-[11px] transition-colors ${
              rightPanelMode === "files"
                ? "bg-primary/20 text-primary"
                : "text-muted-foreground hover:bg-white/5 hover:text-foreground"
            }`}
          >
            <FileText className="h-3 w-3" />
            Files
          </button>
          <button
            onClick={() => setRightPanelMode("html")}
            className={`flex-1 flex items-center justify-center gap-1.5 rounded px-2 py-1.5 text-[11px] transition-colors ${
              rightPanelMode === "html"
                ? "bg-primary/20 text-primary"
                : "text-muted-foreground hover:bg-white/5 hover:text-foreground"
            }`}
          >
            <Code2 className="h-3 w-3" />
            Live HTML
          </button>
        </div>

        {rightPanelMode === "files" ? (
          <ScrollArea className="flex-1">
            <div className="p-3 space-y-2">
              {files.length === 0 && !liveHtml && (
                <div className="rounded-lg border border-dashed border-border/70 p-4 text-center text-xs text-muted-foreground">
                  Generated project files will appear here.
                </div>
              )}
              {liveHtml && !files.some((file) => file.filename === "_preview.html") && (
                <div className="rounded-md border border-primary/30 bg-primary/5 p-2.5">
                  <div className="flex items-center gap-2 min-w-0">
                    <FileText className="h-3.5 w-3.5 text-primary shrink-0" />
                    <span className="truncate text-xs font-mono text-foreground">_preview.html</span>
                  </div>
                  <div className="mt-1 text-[11px] text-muted-foreground font-mono">
                    {(liveHtml.length / 1024).toFixed(1)} KB · current preview
                  </div>
                </div>
              )}
              {files.map((file) => (
                <div key={file.id ?? file.filename} className="rounded-md border border-border/60 bg-[#151720] p-2.5">
                  <div className="flex items-center gap-2 min-w-0">
                    <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    <span className="truncate text-xs font-mono text-foreground">{file.filename}</span>
                  </div>
                  <div className="mt-1 text-[11px] text-muted-foreground font-mono">
                    {file.language} · {(file.content.length / 1024).toFixed(1)} KB
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        ) : (
          <ScrollArea className="flex-1">
            {liveHtml ? (
              <pre className="p-3 text-[11px] font-mono leading-relaxed whitespace-pre-wrap break-all text-muted-foreground">
                {liveHtml}
              </pre>
            ) : (
              <div className="h-full min-h-[240px] flex items-center justify-center p-4 text-center text-xs text-muted-foreground">
                Start a build to inspect the generated HTML.
              </div>
            )}
          </ScrollArea>
        )}
      </div>
    </div>
  );
}
