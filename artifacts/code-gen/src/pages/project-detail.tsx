import { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "wouter";
import {
  useGetProject,
  useListProjectFiles,
} from "@workspace/api-client-react";
import {
  Panel,
  PanelGroup,
  PanelResizeHandle,
} from "react-resizable-panels";
import { Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

import { TopBar } from "@/components/ide/top-bar";
import {
  ActivityBar,
  type ActivePanel,
} from "@/components/ide/activity-bar";
import {
  FileExplorer,
  type ProjectFile,
} from "@/components/ide/file-explorer";
import { CodeEditor } from "@/components/ide/code-editor";
import { ConsolePanel, type LogEntry, type LogLevel } from "@/components/ide/console-panel";
import { PreviewPanel } from "@/components/ide/preview-panel";
import {
  CommandPalette,
  buildActions,
} from "@/components/ide/command-palette";
import { SearchPanel } from "@/components/ide/search-panel";

// ─── JSZip for download ───────────────────────────────────────────────────────

async function downloadProjectZip(
  title: string,
  files: ProjectFile[]
): Promise<void> {
  const JSZip = (await import("jszip")).default;
  const zip = new JSZip();
  for (const file of files) {
    zip.file(file.filename, file.content);
  }
  const blob = await zip.generateAsync({ type: "blob" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${title.replace(/[^a-z0-9-]/gi, "-").toLowerCase()}.zip`;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── Resize handle ───────────────────────────────────────────────────────────

function Handle({ direction = "horizontal" }: { direction?: "horizontal" | "vertical" }) {
  return (
    <PanelResizeHandle
      className={`
        relative flex items-center justify-center bg-transparent
        hover:bg-primary/20 active:bg-primary/30
        transition-colors duration-150 group
        ${direction === "horizontal" ? "w-1 cursor-col-resize" : "h-1 cursor-row-resize"}
      `}
    >
      <div
        className={`
          bg-border/60 group-hover:bg-primary/50 transition-colors rounded-full
          ${direction === "horizontal" ? "w-px h-8" : "h-px w-8"}
        `}
      />
    </PanelResizeHandle>
  );
}

// ─── Chat panel (reuses existing conversation API) ───────────────────────────

function ChatPanel({ conversationId }: { conversationId?: string | null }) {
  const { toast } = useToast();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [messages, setMessages] = useState<{ role: "user" | "assistant"; content: string }[]>([]);
  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);

  useEffect(() => {
    if (scrollRef.current)
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isSending || !conversationId) return;
    const msg = input;
    setInput("");
    setMessages((p) => [...p, { role: "user", content: msg }]);
    setIsSending(true);
    try {
      const resp = await fetch(
        `/api/anthropic/conversations/${conversationId}/messages`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content: msg }),
        }
      );
      if (!resp.body) throw new Error();
      const reader = resp.body.getReader();
      const dec = new TextDecoder();
      setMessages((p) => [...p, { role: "assistant", content: "" }]);
      let buf = "";
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        const lines = buf.split("\n\n");
        buf = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const d = JSON.parse(line.slice(6));
            if (d.content) {
              setMessages((p) => {
                const n = [...p];
                n[n.length - 1] = {
                  ...n[n.length - 1],
                  content: n[n.length - 1].content + d.content,
                };
                return n;
              });
            }
          } catch { /* ignore */ }
        }
      }
    } catch {
      toast({ title: "Error", description: "Failed to send message", variant: "destructive" });
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="h-full flex flex-col bg-[#0d0e12]">
      <div className="px-3 py-2 border-b border-border/50 shrink-0">
        <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
          AI Chat
        </p>
      </div>
      <div
        ref={scrollRef}
        className="flex-1 overflow-auto p-3 space-y-3 font-mono text-xs"
      >
        {messages.length === 0 && (
          <div className="text-muted-foreground/30 italic text-xs py-4 text-center">
            Ask the AI to explain or modify your code
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={`flex gap-2 ${m.role === "user" ? "text-primary" : "text-gray-300"}`}>
            <span className="text-muted-foreground/40 shrink-0">{m.role === "user" ? ">" : "$"}</span>
            <span className="whitespace-pre-wrap break-words flex-1">{m.content}</span>
          </div>
        ))}
        {isSending && (
          <div className="flex gap-2 text-gray-400">
            <span className="text-muted-foreground/40">$</span>
            <span className="animate-pulse">▋</span>
          </div>
        )}
      </div>
      <form onSubmit={handleSend} className="p-3 border-t border-border/50 shrink-0">
        <div className="flex gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={conversationId ? "Ask about your code…" : "No conversation linked"}
            disabled={!conversationId || isSending}
            className="flex-1 bg-[#1a1b22] border border-border/50 rounded px-2.5 py-1.5 text-xs text-foreground placeholder:text-muted-foreground/30 outline-none focus:border-primary/50 disabled:opacity-40"
          />
          <button
            type="submit"
            disabled={!input.trim() || isSending || !conversationId}
            className="px-3 py-1.5 bg-primary/20 hover:bg-primary/30 text-primary text-xs rounded border border-primary/30 disabled:opacity-30 transition-colors"
          >
            {isSending ? <Loader2 className="h-3 w-3 animate-spin" /> : "Send"}
          </button>
        </div>
      </form>
    </div>
  );
}

// ─── Main IDE page ────────────────────────────────────────────────────────────

export default function ProjectDetail() {
  const { id } = useParams<{ id: string }>();
  const projectId = parseInt(id ?? "0", 10);
  const { toast } = useToast();

  const {
    data: project,
    isLoading: projLoading,
  } = useGetProject(projectId);

  const {
    data: serverFiles,
    isLoading: filesLoading,
    refetch: refetchFiles,
  } = useListProjectFiles(projectId);

  // ── Layout state ────────────────────────────────────────────────────────

  const [activePanel, setActivePanel] = useState<ActivePanel>("files");
  const [showPreview, setShowPreview] = useState(true);
  const [showConsole, setShowConsole] = useState(true);
  const [cmdPaletteOpen, setCmdPaletteOpen] = useState(false);

  // ── Editor state ────────────────────────────────────────────────────────

  const [openTabIds, setOpenTabIds] = useState<number[]>([]);
  const [activeTabId, setActiveTabId] = useState<number | null>(null);
  const [pendingChanges, setPendingChanges] = useState<Map<number, string>>(new Map());
  const [isSaving, setIsSaving] = useState(false);

  // ── Console state ───────────────────────────────────────────────────────

  const logIdRef = useRef(0);
  const [consoleLogs, setConsoleLogs] = useState<LogEntry[]>([]);

  const addLog = useCallback((level: LogLevel, text: string) => {
    setConsoleLogs((prev) => [
      ...prev,
      { id: ++logIdRef.current, level, text, timestamp: new Date() },
    ]);
  }, []);

  // ── Running state ───────────────────────────────────────────────────────

  const [isRunning, setIsRunning] = useState(false);

  // ── Derived helpers ─────────────────────────────────────────────────────

  const openFiles = (serverFiles ?? []).filter((f) =>
    openTabIds.includes(f.id)
  );
  const activeFile = openFiles.find((f) => f.id === activeTabId);
  const pendingFileIds = new Set(pendingChanges.keys());

  // ── File operations ─────────────────────────────────────────────────────

  const openFile = useCallback(
    (fileId: number) => {
      setOpenTabIds((prev) =>
        prev.includes(fileId) ? prev : [...prev, fileId]
      );
      setActiveTabId(fileId);
    },
    []
  );

  const closeTab = useCallback(
    (fileId: number) => {
      setOpenTabIds((prev) => {
        const idx = prev.indexOf(fileId);
        const next = prev.filter((id) => id !== fileId);
        if (activeTabId === fileId) {
          setActiveTabId(next[Math.min(idx, next.length - 1)] ?? null);
        }
        return next;
      });
      setPendingChanges((prev) => {
        const next = new Map(prev);
        next.delete(fileId);
        return next;
      });
    },
    [activeTabId]
  );

  const handleFileChange = useCallback(
    (fileId: number, value: string) => {
      setPendingChanges((prev) => new Map(prev).set(fileId, value));
    },
    []
  );

  const saveFile = useCallback(
    async (fileId: number) => {
      const content = pendingChanges.get(fileId);
      if (content === undefined) return;
      setIsSaving(true);
      try {
        const res = await fetch(
          `/api/projects/${projectId}/files/${fileId}`,
          {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ content }),
          }
        );
        if (!res.ok) throw new Error("Save failed");
        setPendingChanges((prev) => {
          const next = new Map(prev);
          next.delete(fileId);
          return next;
        });
        const filename =
          serverFiles?.find((f) => f.id === fileId)?.filename ?? "file";
        addLog("success", `Saved ${filename}`);
        await refetchFiles();
      } catch {
        toast({
          title: "Save failed",
          description: "Could not save the file",
          variant: "destructive",
        });
        addLog("error", "Save failed");
      } finally {
        setIsSaving(false);
      }
    },
    [pendingChanges, projectId, serverFiles, addLog, refetchFiles, toast]
  );

  const saveActiveFile = useCallback(() => {
    if (activeTabId != null) saveFile(activeTabId);
  }, [activeTabId, saveFile]);

  const createFile = useCallback(
    async (filename: string) => {
      try {
        const res = await fetch(`/api/projects/${projectId}/files`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ filename, content: "" }),
        });
        const newFile = await res.json() as ProjectFile;
        await refetchFiles();
        openFile(newFile.id);
        addLog("info", `Created ${filename}`);
      } catch {
        toast({
          title: "Error",
          description: "Could not create file",
          variant: "destructive",
        });
      }
    },
    [projectId, refetchFiles, openFile, addLog, toast]
  );

  const renameFile = useCallback(
    async (fileId: number, newName: string) => {
      try {
        await fetch(`/api/projects/${projectId}/files/${fileId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ filename: newName }),
        });
        await refetchFiles();
        addLog("info", `Renamed to ${newName}`);
      } catch {
        toast({ title: "Error", description: "Could not rename file", variant: "destructive" });
      }
    },
    [projectId, refetchFiles, addLog, toast]
  );

  const deleteFile = useCallback(
    async (fileId: number) => {
      const filename = serverFiles?.find((f) => f.id === fileId)?.filename ?? "file";
      try {
        await fetch(`/api/projects/${projectId}/files/${fileId}`, {
          method: "DELETE",
        });
        closeTab(fileId);
        await refetchFiles();
        addLog("warn", `Deleted ${filename}`);
      } catch {
        toast({ title: "Error", description: "Could not delete file", variant: "destructive" });
      }
    },
    [projectId, serverFiles, closeTab, refetchFiles, addLog, toast]
  );

  // ── Run / Stop ──────────────────────────────────────────────────────────

  const handleRun = useCallback(() => {
    setIsRunning(true);
    setShowConsole(true);
    addLog("cmd", "$ starting preview server…");
    addLog("success", "Preview available in the right panel");
    setTimeout(() => addLog("info", "Ready."), 600);
  }, [addLog]);

  const handleStop = useCallback(() => {
    setIsRunning(false);
    addLog("warn", "Preview server stopped.");
  }, [addLog]);

  // ── Download ─────────────────────────────────────────────────────────────

  const handleDownload = useCallback(async () => {
    if (!serverFiles || serverFiles.length === 0) {
      toast({ title: "Nothing to export", description: "No files found in this project." });
      return;
    }
    addLog("info", `Exporting ${serverFiles.length} files…`);
    await downloadProjectZip(project?.title ?? "project", serverFiles as ProjectFile[]);
    addLog("success", "Download started");
  }, [serverFiles, project, addLog, toast]);

  // ── Global keyboard shortcuts ───────────────────────────────────────────

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key === "k") {
        e.preventDefault();
        setCmdPaletteOpen(true);
      }
      if (mod && e.key === "b") {
        e.preventDefault();
        setActivePanel((p) => (p === "files" ? null : "files"));
      }
      if (mod && e.key === "`") {
        e.preventDefault();
        setShowConsole((v) => !v);
      }
      if (mod && e.shiftKey && e.key === "P") {
        e.preventDefault();
        setShowPreview((v) => !v);
      }
      if (mod && e.shiftKey && e.key === "F") {
        e.preventDefault();
        setActivePanel("search");
      }
      if (mod && e.key === "n") {
        e.preventDefault();
        setActivePanel("files");
      }
      if (mod && e.key === "w" && activeTabId != null) {
        e.preventDefault();
        closeTab(activeTabId);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [activeTabId, closeTab]);

  // ── Open first file automatically ───────────────────────────────────────

  useEffect(() => {
    if (serverFiles && serverFiles.length > 0 && openTabIds.length === 0) {
      openFile(serverFiles[0].id);
    }
  }, [serverFiles, openTabIds.length, openFile]);

  // ── Loading ─────────────────────────────────────────────────────────────

  if (projLoading) {
    return (
      <div className="h-screen flex items-center justify-center bg-[#0c0d10] text-muted-foreground gap-3">
        <Loader2 className="h-5 w-5 animate-spin" />
        <span className="text-sm font-mono">Loading project…</span>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="h-screen flex items-center justify-center bg-[#0c0d10] text-destructive text-sm">
        Project not found.
      </div>
    );
  }

  // ── Command palette actions ─────────────────────────────────────────────

  const paletteActions = buildActions({
    hasActiveFile: activeTabId != null,
    hasPendingChanges: pendingChanges.has(activeTabId ?? -1),
    isRunning,
    onNewFile: () => { setActivePanel("files"); },
    onSaveFile: saveActiveFile,
    onCloseTab: () => { if (activeTabId != null) closeTab(activeTabId); },
    onRun: handleRun,
    onStop: handleStop,
    onTogglePreview: () => setShowPreview((v) => !v),
    onToggleConsole: () => setShowConsole((v) => !v),
    onToggleSidebar: () => setActivePanel((p) => (p ? null : "files")),
    onDownload: handleDownload,
    onSearch: () => setActivePanel("search"),
    onOpenLiveBuilder: () => setActivePanel("builder"),
  });

  // ── Render ──────────────────────────────────────────────────────────────

  return (
    <div className="h-screen flex flex-col bg-[#0c0d10] overflow-hidden">

      {/* Top bar */}
      <TopBar
        project={project}
        isRunning={isRunning}
        isSaving={isSaving}
        onRun={handleRun}
        onStop={handleStop}
        onDownload={handleDownload}
        onOpenCommandPalette={() => setCmdPaletteOpen(true)}
      />

      {/* Command palette */}
      <CommandPalette
        open={cmdPaletteOpen}
        onOpenChange={setCmdPaletteOpen}
        actions={paletteActions}
      />

      {/* IDE body */}
      <div className="flex flex-1 overflow-hidden">

        {/* Activity bar */}
        <ActivityBar active={activePanel} onChange={setActivePanel} />

        {/* Main horizontal panels */}
        <PanelGroup direction="horizontal" className="flex-1">

          {/* Sidebar */}
          {activePanel && (
            <>
              <Panel
                defaultSize={20}
                minSize={12}
                maxSize={40}
                className="overflow-hidden flex flex-col"
              >
                {activePanel === "files" && (
                  <FileExplorer
                    files={(serverFiles ?? []) as ProjectFile[]}
                    openFileIds={openTabIds}
                    activeFileId={activeTabId}
                    pendingFileIds={pendingFileIds}
                    projectTitle={project.title}
                    onOpen={openFile}
                    onCreate={createFile}
                    onRename={renameFile}
                    onDelete={deleteFile}
                  />
                )}
                {activePanel === "search" && (
                  <SearchPanel
                    files={(serverFiles ?? []) as ProjectFile[]}
                    onOpenFile={openFile}
                  />
                )}
                {activePanel === "chat" && (
                  <ChatPanel conversationId={project.conversationId} />
                )}
                {activePanel === "builder" && (
                  // When builder is in sidebar, show a thin strip that opens the preview
                  <div className="h-full flex flex-col items-center justify-center gap-3 text-muted-foreground/30 p-4 text-center">
                    <p className="text-xs">Live Builder runs in the preview panel.</p>
                    <button
                      onClick={() => {
                        setShowPreview(true);
                        setActivePanel("files");
                      }}
                      className="text-primary/60 hover:text-primary text-xs underline-offset-2 hover:underline"
                    >
                      Open preview panel →
                    </button>
                  </div>
                )}
              </Panel>
              <Handle direction="horizontal" />
            </>
          )}

          {/* Editor + console vertical stack */}
          <Panel className="flex flex-col overflow-hidden min-w-0">
            <PanelGroup direction="vertical" className="flex-1">

              {/* Editor */}
              <Panel minSize={20} className="overflow-hidden">
                <CodeEditor
                  openFiles={openFiles}
                  activeFileId={activeTabId}
                  pendingChanges={pendingChanges}
                  onActivate={setActiveTabId}
                  onClose={closeTab}
                  onChange={handleFileChange}
                  onSave={saveFile}
                />
              </Panel>

              {/* Console */}
              {showConsole && (
                <>
                  <Handle direction="vertical" />
                  <Panel
                    defaultSize={22}
                    minSize={8}
                    maxSize={50}
                    className="overflow-hidden"
                  >
                    <ConsolePanel
                      logs={consoleLogs}
                      isOpen={showConsole}
                      onToggle={() => setShowConsole((v) => !v)}
                      onClear={() => setConsoleLogs([])}
                    />
                  </Panel>
                </>
              )}
            </PanelGroup>

            {/* Console toggle when closed */}
            {!showConsole && (
              <button
                onClick={() => setShowConsole(true)}
                className="h-6 shrink-0 border-t border-border/50 bg-[#0c0d10] text-[10px] text-muted-foreground/40 hover:text-muted-foreground flex items-center justify-center gap-1.5 transition-colors"
              >
                <span className="uppercase tracking-widest">Console</span>
                {consoleLogs.filter((l) => l.level === "error").length > 0 && (
                  <span className="text-red-400">
                    {consoleLogs.filter((l) => l.level === "error").length} error
                    {consoleLogs.filter((l) => l.level === "error").length > 1 ? "s" : ""}
                  </span>
                )}
              </button>
            )}
          </Panel>

          {/* Preview panel */}
          {showPreview && (
            <>
              <Handle direction="horizontal" />
              <Panel
                defaultSize={35}
                minSize={20}
                className="overflow-hidden"
              >
                <PreviewPanel
                  projectId={projectId}
                  project={{
                    title: project.title,
                    description: project.description,
                    techStack: project.techStack,
                  }}
                  files={(serverFiles ?? []) as ProjectFile[]}
                />
              </Panel>
            </>
          )}

        </PanelGroup>

        {/* Preview toggle button when closed */}
        {!showPreview && (
          <button
            onClick={() => setShowPreview(true)}
            className="w-6 bg-[#0a0b0e] border-l border-border/60 text-[9px] text-muted-foreground/30 hover:text-muted-foreground hover:bg-[#0d0e12] flex items-center justify-center writing-mode-vertical tracking-widest uppercase transition-colors"
            title="Show Preview"
            style={{ writingMode: "vertical-rl" }}
          >
            Preview
          </button>
        )}

      </div>
    </div>
  );
}
