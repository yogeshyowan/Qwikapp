import { Folder, MessageSquare, Search, Zap } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export type ActivePanel = "files" | "search" | "builder" | "chat" | null;

interface ActivityBarProps {
  active: ActivePanel;
  onChange: (panel: ActivePanel) => void;
}

const PANELS: { id: ActivePanel; icon: React.ElementType; label: string }[] = [
  { id: "files", icon: Folder, label: "Explorer (⌘B)" },
  { id: "search", icon: Search, label: "Search (⌘F)" },
  { id: "builder", icon: Zap, label: "Live Builder" },
  { id: "chat", icon: MessageSquare, label: "AI Chat" },
];

export function ActivityBar({ active, onChange }: ActivityBarProps) {
  const toggle = (id: ActivePanel) => onChange(active === id ? null : id);

  return (
    <div className="w-12 bg-[#0a0b0e] border-r border-border/70 flex flex-col items-center py-2 shrink-0 gap-1">
      {PANELS.map((panel) => {
        const isActive = active === panel.id;
        return (
          <Tooltip key={panel.id} delayDuration={200}>
            <TooltipTrigger asChild>
              <button
                onClick={() => toggle(panel.id)}
                className={`relative w-9 h-9 flex items-center justify-center rounded-md transition-all duration-150 ${
                  isActive
                    ? "text-foreground bg-white/8"
                    : "text-muted-foreground/50 hover:text-muted-foreground hover:bg-white/5"
                }`}
              >
                {isActive && (
                  <span className="absolute left-0 top-2 bottom-2 w-0.5 bg-primary rounded-full -translate-x-[3px]" />
                )}
                <panel.icon className="h-5 w-5" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="right" className="text-xs">
              {panel.label}
            </TooltipContent>
          </Tooltip>
        );
      })}
    </div>
  );
}
