import { useEffect, useRef } from "react";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import {
  Download,
  Eye,
  File,
  FilePlus,
  Maximize2,
  Play,
  Save,
  Search,
  Square,
  Terminal,
  X,
  Zap,
} from "lucide-react";

export interface PaletteAction {
  id: string;
  label: string;
  description?: string;
  icon: React.ElementType;
  group: string;
  shortcut?: string;
  onSelect: () => void;
  disabled?: boolean;
}

interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  actions: PaletteAction[];
}

export function CommandPalette({ open, onOpenChange, actions }: CommandPaletteProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  // Group actions
  const groups = Array.from(new Set(actions.map((a) => a.group)));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="p-0 gap-0 max-w-lg border-border/80 bg-[#14151a] shadow-2xl overflow-hidden"
        style={{ borderRadius: "8px" }}
      >
        <Command className="bg-transparent">
          <div className="flex items-center border-b border-border/60 px-3">
            <Search className="h-4 w-4 text-muted-foreground/50 shrink-0 mr-2" />
            <CommandInput
              ref={inputRef}
              placeholder="Type a command or search…"
              className="h-11 bg-transparent border-0 text-sm focus:ring-0 focus:outline-none placeholder:text-muted-foreground/40"
            />
          </div>
          <CommandList className="max-h-80 overflow-y-auto">
            <CommandEmpty className="py-6 text-center text-xs text-muted-foreground/50">
              No commands found.
            </CommandEmpty>

            {groups.map((group, i) => {
              const groupActions = actions.filter((a) => a.group === group);
              return (
                <div key={group}>
                  {i > 0 && <CommandSeparator className="bg-border/30" />}
                  <CommandGroup
                    heading={group}
                    className="[&>*[cmdk-group-heading]]:text-[10px] [&>*[cmdk-group-heading]]:text-muted-foreground/40 [&>*[cmdk-group-heading]]:uppercase [&>*[cmdk-group-heading]]:tracking-widest [&>*[cmdk-group-heading]]:px-3 [&>*[cmdk-group-heading]]:py-1.5"
                  >
                    {groupActions.map((action) => (
                      <CommandItem
                        key={action.id}
                        value={`${action.label} ${action.description ?? ""}`}
                        disabled={action.disabled}
                        onSelect={() => {
                          onOpenChange(false);
                          action.onSelect();
                        }}
                        className="flex items-center gap-3 px-3 py-2 cursor-pointer aria-disabled:opacity-40 data-[selected]:bg-white/8 rounded mx-1"
                      >
                        <action.icon className="h-4 w-4 text-muted-foreground/60 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <span className="text-sm text-foreground/90">{action.label}</span>
                          {action.description && (
                            <span className="ml-2 text-xs text-muted-foreground/40 truncate">
                              {action.description}
                            </span>
                          )}
                        </div>
                        {action.shortcut && (
                          <kbd className="text-[10px] text-muted-foreground/40 font-mono bg-white/5 px-1.5 py-0.5 rounded border border-border/30 shrink-0">
                            {action.shortcut}
                          </kbd>
                        )}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </div>
              );
            })}
          </CommandList>

          <div className="flex items-center gap-3 px-3 py-2 border-t border-border/40 text-[10px] text-muted-foreground/30 font-mono">
            <span>↑↓ navigate</span>
            <span>↵ select</span>
            <span>esc close</span>
          </div>
        </Command>
      </DialogContent>
    </Dialog>
  );
}

// ── Build the default action list ───────────────────────────────────────────

export function buildActions({
  hasActiveFile,
  hasPendingChanges,
  isRunning,
  onNewFile,
  onSaveFile,
  onCloseTab,
  onRun,
  onStop,
  onTogglePreview,
  onToggleConsole,
  onToggleSidebar,
  onDownload,
  onSearch,
  onOpenLiveBuilder,
}: {
  hasActiveFile: boolean;
  hasPendingChanges: boolean;
  isRunning: boolean;
  onNewFile: () => void;
  onSaveFile: () => void;
  onCloseTab: () => void;
  onRun: () => void;
  onStop: () => void;
  onTogglePreview: () => void;
  onToggleConsole: () => void;
  onToggleSidebar: () => void;
  onDownload: () => void;
  onSearch: () => void;
  onOpenLiveBuilder: () => void;
}): PaletteAction[] {
  return [
    {
      id: "new-file",
      label: "New File",
      icon: FilePlus,
      group: "File",
      shortcut: "⌘N",
      onSelect: onNewFile,
    },
    {
      id: "save-file",
      label: "Save File",
      description: hasPendingChanges ? "unsaved changes" : undefined,
      icon: Save,
      group: "File",
      shortcut: "⌘S",
      disabled: !hasActiveFile || !hasPendingChanges,
      onSelect: onSaveFile,
    },
    {
      id: "close-tab",
      label: "Close Tab",
      icon: X,
      group: "File",
      shortcut: "⌘W",
      disabled: !hasActiveFile,
      onSelect: onCloseTab,
    },
    {
      id: "download",
      label: "Export Project (.zip)",
      icon: Download,
      group: "File",
      onSelect: onDownload,
    },
    {
      id: "run",
      label: isRunning ? "Stop Running" : "Run Project",
      icon: isRunning ? Square : Play,
      group: "Project",
      shortcut: "⌘↵",
      onSelect: isRunning ? onStop : onRun,
    },
    {
      id: "live-builder",
      label: "Open Live Builder",
      icon: Zap,
      group: "Project",
      onSelect: onOpenLiveBuilder,
    },
    {
      id: "toggle-preview",
      label: "Toggle Preview Panel",
      icon: Eye,
      group: "View",
      shortcut: "⌘⇧P",
      onSelect: onTogglePreview,
    },
    {
      id: "toggle-console",
      label: "Toggle Console",
      icon: Terminal,
      group: "View",
      shortcut: "⌘`",
      onSelect: onToggleConsole,
    },
    {
      id: "toggle-sidebar",
      label: "Toggle Sidebar",
      icon: Maximize2,
      group: "View",
      shortcut: "⌘B",
      onSelect: onToggleSidebar,
    },
    {
      id: "search",
      label: "Search in Files",
      icon: Search,
      group: "View",
      shortcut: "⌘F",
      onSelect: onSearch,
    },
  ];
}
