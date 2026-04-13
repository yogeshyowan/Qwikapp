import { useLocation } from "wouter";
import {
  ArrowLeft,
  Download,
  Loader2,
  Play,
  Square,
  Terminal,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface TopBarProps {
  project: {
    id: number;
    title: string;
    techStack: string;
    status: string;
  };
  isRunning: boolean;
  isSaving: boolean;
  onRun: () => void;
  onStop: () => void;
  onDownload: () => void;
  onOpenCommandPalette: () => void;
}

export function TopBar({
  project,
  isRunning,
  isSaving,
  onRun,
  onStop,
  onDownload,
  onOpenCommandPalette,
}: TopBarProps) {
  const [, setLocation] = useLocation();

  const statusColor =
    project.status === "done"
      ? "border-emerald-500/40 text-emerald-400 bg-emerald-500/10"
      : project.status === "generating"
        ? "border-yellow-500/40 text-yellow-400 bg-yellow-500/10"
        : project.status === "error"
          ? "border-red-500/40 text-red-400 bg-red-500/10"
          : "border-border text-muted-foreground";

  return (
    <header className="h-11 bg-[#0c0d10] border-b border-border/70 flex items-center px-3 gap-2 shrink-0 z-20">
      {/* Back */}
      <Tooltip delayDuration={300}>
        <TooltipTrigger asChild>
          <button
            onClick={() => setLocation("/")}
            className="h-7 w-7 flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-white/5 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
        </TooltipTrigger>
        <TooltipContent>Back to Dashboard</TooltipContent>
      </Tooltip>

      <div className="h-4 w-px bg-border/60 mx-0.5" />

      {/* Branding + project */}
      <div className="flex items-center gap-2 min-w-0">
        <Terminal className="h-4 w-4 text-primary shrink-0" />
        <span className="text-xs font-bold text-primary tracking-widest hidden sm:block">
          QWIKIDE
        </span>
        <span className="text-muted-foreground/40 hidden sm:block">/</span>
        <span className="text-sm font-medium truncate max-w-[180px] text-foreground/90">
          {project.title}
        </span>
        <Badge
          variant="outline"
          className={`text-[10px] px-1.5 py-0 h-4 shrink-0 ${statusColor}`}
        >
          {project.status}
        </Badge>
        <span className="text-[11px] text-muted-foreground/40 font-mono hidden md:block shrink-0">
          {project.techStack}
        </span>
      </div>

      <div className="flex-1" />

      {/* Right-side actions */}
      {isSaving && (
        <span className="text-xs text-muted-foreground flex items-center gap-1.5">
          <Loader2 className="h-3 w-3 animate-spin" />
          <span className="hidden sm:block">Saving…</span>
        </span>
      )}

      {/* Command palette hint */}
      <button
        onClick={onOpenCommandPalette}
        className="hidden md:flex items-center gap-1.5 h-6 px-2 text-[11px] text-muted-foreground/60 hover:text-muted-foreground border border-border/40 hover:border-border/70 rounded transition-colors font-mono"
      >
        <span>⌘K</span>
      </button>

      <Tooltip delayDuration={300}>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            onClick={onDownload}
            className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
          >
            <Download className="h-3.5 w-3.5" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Export project (.zip)</TooltipContent>
      </Tooltip>

      {/* Run / Stop */}
      <Button
        size="sm"
        onClick={isRunning ? onStop : onRun}
        className={`h-7 px-3 gap-1.5 text-xs font-semibold shrink-0 ${
          isRunning
            ? "bg-red-600/90 hover:bg-red-600 text-white border-0"
            : "bg-emerald-600/90 hover:bg-emerald-600 text-white border-0"
        }`}
      >
        {isRunning ? (
          <>
            <Square className="h-3 w-3 fill-current" />
            Stop
          </>
        ) : (
          <>
            <Play className="h-3.5 w-3.5 fill-current" />
            Run
          </>
        )}
      </Button>
    </header>
  );
}
