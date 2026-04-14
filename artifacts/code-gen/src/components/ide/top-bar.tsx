import { useLocation } from "wouter";
import { ArrowLeft, Download, Rocket, Terminal } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface TopBarProps {
  project: {
    id: number;
    title: string;
    techStack: string;
    status: string;
  };
  onDownload: () => void;
  onPublish?: () => void;
  isPublishing?: boolean;
}

export function TopBar({ project, onDownload, onPublish, isPublishing }: TopBarProps) {
  const [, setLocation] = useLocation();

  const statusColor =
    project.status === "done"
      ? "border-emerald-300 text-emerald-700 bg-emerald-50"
      : project.status === "generating"
        ? "border-yellow-300 text-yellow-700 bg-yellow-50"
        : project.status === "error"
          ? "border-red-300 text-red-700 bg-red-50"
          : "border-border text-muted-foreground";

  return (
    <header className="h-11 bg-sidebar border-b border-border flex items-center px-3 gap-2 shrink-0 z-20">
      <Tooltip delayDuration={300}>
        <TooltipTrigger asChild>
          <button
            onClick={() => setLocation("/")}
            className="h-7 w-7 flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-black/5 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
        </TooltipTrigger>
        <TooltipContent>Back to Dashboard</TooltipContent>
      </Tooltip>

      <div className="h-4 w-px bg-border mx-0.5" />

      <div className="flex items-center gap-2 min-w-0">
        <Terminal className="h-4 w-4 text-primary shrink-0" />
        <span className="text-xs font-bold text-primary tracking-widest hidden sm:block">
          QWIKIDE
        </span>
        <span className="text-muted-foreground/60 hidden sm:block">/</span>
        <span className="text-sm font-medium truncate max-w-[200px] text-foreground">
          {project.title}
        </span>
        <Badge
          variant="outline"
          className={`text-[10px] px-1.5 py-0 h-4 shrink-0 ${statusColor}`}
        >
          {project.status}
        </Badge>
        <span className="text-[11px] text-muted-foreground font-mono hidden md:block shrink-0">
          {project.techStack}
        </span>
      </div>

      <div className="flex-1" />

      {onPublish && (
        <Button
          size="sm"
          onClick={onPublish}
          disabled={isPublishing}
          className="h-7 gap-1.5 px-3 text-xs"
        >
          <Rocket className="h-3.5 w-3.5" />
          {isPublishing ? "Publishing…" : "Publish"}
        </Button>
      )}

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
    </header>
  );
}
