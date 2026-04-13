import { useEffect, useRef, useState } from "react";
import Editor, { loader, type OnMount } from "@monaco-editor/react";
import { X, Code2 } from "lucide-react";

// Load Monaco from CDN to avoid Vite worker bundling issues
loader.config({
  paths: { vs: "https://cdn.jsdelivr.net/npm/monaco-editor@0.52.0/min/vs" },
});

export interface EditorFile {
  id: number;
  filename: string;
  language: string;
  content: string;
}

interface CodeEditorProps {
  openFiles: EditorFile[];
  activeFileId: number | null;
  pendingChanges: Map<number, string>;
  onActivate: (fileId: number) => void;
  onClose: (fileId: number) => void;
  onChange: (fileId: number, value: string) => void;
  onSave: (fileId: number) => void;
}

// Map our language names to Monaco language IDs
function toMonacoLang(lang: string, filename: string): string {
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";
  if (ext === "tsx" || ext === "jsx") return "typescript";
  const map: Record<string, string> = {
    typescript: "typescript",
    javascript: "javascript",
    python: "python",
    css: "css",
    scss: "scss",
    html: "html",
    json: "json",
    markdown: "markdown",
    yaml: "yaml",
    rust: "rust",
    go: "go",
    java: "java",
    cpp: "cpp",
    c: "c",
    shell: "shell",
    sql: "sql",
    xml: "xml",
    dockerfile: "dockerfile",
    text: "plaintext",
  };
  return map[lang] ?? "plaintext";
}

function getLangBadgeColor(lang: string): string {
  const colors: Record<string, string> = {
    typescript: "text-blue-400", javascript: "text-yellow-400",
    python: "text-green-400", css: "text-cyan-400",
    html: "text-orange-400", json: "text-yellow-300",
    rust: "text-orange-400", go: "text-cyan-300",
    markdown: "text-gray-400", shell: "text-green-300",
  };
  return colors[lang] ?? "text-muted-foreground";
}

export function CodeEditor({
  openFiles,
  activeFileId,
  pendingChanges,
  onActivate,
  onClose,
  onChange,
  onSave,
}: CodeEditorProps) {
  const editorRef = useRef<Parameters<OnMount>[0] | null>(null);
  const monacoRef = useRef<Parameters<OnMount>[1] | null>(null);
  const [isMonacoReady, setIsMonacoReady] = useState(false);

  const activeFile = openFiles.find((f) => f.id === activeFileId);
  const activeContent = activeFileId != null
    ? (pendingChanges.get(activeFileId) ?? activeFile?.content ?? "")
    : "";

  const handleMount: OnMount = (editor, monaco) => {
    editorRef.current = editor;
    monacoRef.current = monaco;
    setIsMonacoReady(true);

    // Custom theme matching the app
    monaco.editor.defineTheme("qwik-dark", {
      base: "vs-dark",
      inherit: true,
      rules: [
        { token: "comment", foreground: "5c6370", fontStyle: "italic" },
        { token: "keyword", foreground: "c678dd" },
        { token: "string", foreground: "98c379" },
        { token: "number", foreground: "d19a66" },
        { token: "type", foreground: "e5c07b" },
        { token: "function", foreground: "61afef" },
        { token: "variable", foreground: "e06c75" },
      ],
      colors: {
        "editor.background": "#0d0e12",
        "editor.foreground": "#abb2bf",
        "editor.lineHighlightBackground": "#14151a",
        "editor.selectionBackground": "#3e4451",
        "editorLineNumber.foreground": "#3b4048",
        "editorLineNumber.activeForeground": "#636d83",
        "editorCursor.foreground": "#00ffa3",
        "editor.findMatchBackground": "#42557b",
        "editorWidget.background": "#1a1b20",
        "editorSuggestWidget.background": "#1a1b20",
        "editorHoverWidget.background": "#1a1b20",
        "scrollbar.shadow": "#00000000",
        "scrollbarSlider.background": "#ffffff10",
        "scrollbarSlider.hoverBackground": "#ffffff20",
        "input.background": "#1a1b20",
        "editorGroupHeader.tabsBackground": "#0c0d10",
        "tab.activeBackground": "#0d0e12",
        "tab.inactiveBackground": "#0c0d10",
        "tab.border": "#1e1f25",
      },
    });
    monaco.editor.setTheme("qwik-dark");

    // Ctrl+S / Cmd+S to save
    editor.addCommand(
      monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS,
      () => {
        if (activeFileId != null) onSave(activeFileId);
      }
    );
  };

  // Attach updated save handler when activeFileId changes
  useEffect(() => {
    if (!editorRef.current || !monacoRef.current || !isMonacoReady) return;
    const editor = editorRef.current;
    const monaco = monacoRef.current;
    editor.addCommand(
      monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS,
      () => {
        if (activeFileId != null) onSave(activeFileId);
      }
    );
  }, [activeFileId, onSave, isMonacoReady]);

  const handleTabClose = (e: React.MouseEvent, fileId: number) => {
    e.stopPropagation();
    onClose(fileId);
  };

  if (openFiles.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-muted-foreground/30 bg-[#0d0e12] gap-4">
        <Code2 className="h-12 w-12" />
        <div className="text-center">
          <p className="text-sm font-medium text-muted-foreground/50">No file open</p>
          <p className="text-xs mt-1">Select a file from the Explorer to start editing</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-[#0d0e12] overflow-hidden">
      {/* Tab bar */}
      <div className="flex items-end overflow-x-auto scrollbar-none border-b border-border/50 bg-[#0c0d10] shrink-0 min-h-[34px]">
        {openFiles.map((file) => {
          const isActive = file.id === activeFileId;
          const isPending = pendingChanges.has(file.id);
          const shortName = file.filename.split("/").pop() ?? file.filename;

          return (
            <div
              key={file.id}
              onClick={() => onActivate(file.id)}
              className={`group flex items-center gap-1.5 px-3 py-1.5 cursor-pointer border-r border-border/30 text-xs shrink-0 transition-colors select-none ${
                isActive
                  ? "bg-[#0d0e12] text-foreground border-t border-t-primary/50"
                  : "text-muted-foreground/60 hover:text-muted-foreground hover:bg-[#0d0e12]/60"
              }`}
            >
              {isPending && (
                <span className="h-1.5 w-1.5 rounded-full bg-amber-400 shrink-0" />
              )}
              <span className={`truncate max-w-[120px] ${getLangBadgeColor(file.language)}`}>
                {shortName}
              </span>
              <button
                onClick={(e) => handleTabClose(e, file.id)}
                className={`h-4 w-4 flex items-center justify-center rounded transition-colors ${
                  isActive || isPending
                    ? "text-muted-foreground hover:text-foreground hover:bg-white/10"
                    : "opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-foreground hover:bg-white/10"
                }`}
              >
                <X className="h-2.5 w-2.5" />
              </button>
            </div>
          );
        })}
      </div>

      {/* Breadcrumb */}
      {activeFile && (
        <div className="px-3 py-1 text-[11px] text-muted-foreground/40 font-mono border-b border-border/30 bg-[#0d0e12] shrink-0">
          {activeFile.filename}
        </div>
      )}

      {/* Monaco editor */}
      <div className="flex-1 overflow-hidden">
        {activeFile && (
          <Editor
            height="100%"
            language={toMonacoLang(activeFile.language, activeFile.filename)}
            value={activeContent}
            path={activeFile.filename}
            theme="qwik-dark"
            onMount={handleMount}
            onChange={(value) => {
              if (activeFileId != null && value !== undefined) {
                onChange(activeFileId, value);
              }
            }}
            loading={
              <div className="h-full flex items-center justify-center text-muted-foreground/30 bg-[#0d0e12]">
                <div className="text-xs font-mono animate-pulse">Loading editor…</div>
              </div>
            }
            options={{
              fontSize: 13,
              fontFamily: "'JetBrains Mono', 'Menlo', 'Monaco', monospace",
              fontLigatures: true,
              lineHeight: 1.7,
              minimap: { enabled: true, scale: 1 },
              scrollBeyondLastLine: false,
              renderWhitespace: "none",
              smoothScrolling: true,
              cursorSmoothCaretAnimation: "on",
              padding: { top: 12, bottom: 12 },
              tabSize: 2,
              wordWrap: "off",
              formatOnPaste: true,
              bracketPairColorization: { enabled: true },
              renderLineHighlight: "line",
              overviewRulerLanes: 0,
              hideCursorInOverviewRuler: true,
            }}
          />
        )}
      </div>
    </div>
  );
}
