import { useEffect, useRef } from "react";
import { ChevronDown, ChevronUp, Trash2, X } from "lucide-react";

export type LogLevel = "info" | "success" | "warn" | "error" | "cmd";

export interface LogEntry {
  id: number;
  level: LogLevel;
  text: string;
  timestamp: Date;
}

interface ConsolePanelProps {
  logs: LogEntry[];
  isOpen: boolean;
  onToggle: () => void;
  onClear: () => void;
}

function LevelBadge({ level }: { level: LogLevel }) {
  const styles: Record<LogLevel, string> = {
    info: "text-blue-400",
    success: "text-emerald-400",
    warn: "text-yellow-400",
    error: "text-red-400",
    cmd: "text-primary",
  };
  const labels: Record<LogLevel, string> = {
    info: "INFO",
    success: " OK ",
    warn: "WARN",
    error: "ERR ",
    cmd: " $ ",
  };
  return (
    <span className={`font-mono text-[10px] ${styles[level]} shrink-0 w-8 text-center`}>
      {labels[level]}
    </span>
  );
}

export function ConsolePanel({ logs, isOpen, onToggle, onClear }: ConsolePanelProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs, isOpen]);

  const errorCount = logs.filter((l) => l.level === "error").length;
  const warnCount = logs.filter((l) => l.level === "warn").length;

  return (
    <div className="flex flex-col h-full bg-[#0a0b0e] border-t border-border/70 overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-1.5 bg-[#0c0d10] border-b border-border/50 shrink-0">
        <button
          onClick={onToggle}
          className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors"
        >
          {isOpen ? (
            <ChevronDown className="h-3.5 w-3.5" />
          ) : (
            <ChevronUp className="h-3.5 w-3.5" />
          )}
          CONSOLE
        </button>

        {errorCount > 0 && (
          <span className="text-[10px] px-1 rounded bg-red-500/20 text-red-400 font-mono">
            {errorCount} error{errorCount > 1 ? "s" : ""}
          </span>
        )}
        {warnCount > 0 && (
          <span className="text-[10px] px-1 rounded bg-yellow-500/20 text-yellow-400 font-mono">
            {warnCount} warning{warnCount > 1 ? "s" : ""}
          </span>
        )}

        <div className="flex-1" />

        <button
          onClick={onClear}
          className="h-5 w-5 flex items-center justify-center rounded text-muted-foreground/50 hover:text-muted-foreground hover:bg-white/5 transition-colors"
          title="Clear console"
        >
          <Trash2 className="h-3 w-3" />
        </button>
        <button
          onClick={onToggle}
          className="h-5 w-5 flex items-center justify-center rounded text-muted-foreground/50 hover:text-muted-foreground hover:bg-white/5 transition-colors"
          title="Close console"
        >
          <X className="h-3 w-3" />
        </button>
      </div>

      {/* Log output */}
      {isOpen && (
        <div
          ref={scrollRef}
          className="flex-1 overflow-auto p-2 space-y-0.5 font-mono text-[12px]"
        >
          {logs.length === 0 && (
            <div className="text-muted-foreground/30 py-4 text-center text-xs">
              Console output will appear here
            </div>
          )}
          {logs.map((log) => (
            <div key={log.id} className="flex items-start gap-2 py-0.5 px-1 rounded hover:bg-white/3">
              <LevelBadge level={log.level} />
              <span className="text-muted-foreground/40 text-[10px] mt-px shrink-0 tabular-nums">
                {log.timestamp.toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                  second: "2-digit",
                })}
              </span>
              <span
                className={`break-words whitespace-pre-wrap flex-1 leading-relaxed ${
                  log.level === "error"
                    ? "text-red-300"
                    : log.level === "warn"
                      ? "text-yellow-300"
                      : log.level === "success"
                        ? "text-emerald-300"
                        : log.level === "cmd"
                          ? "text-primary"
                          : "text-gray-300"
                }`}
              >
                {log.text}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
