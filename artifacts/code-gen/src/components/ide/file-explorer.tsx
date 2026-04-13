import { useEffect, useRef, useState } from "react";
import {
  ChevronDown,
  File,
  FilePlus,
  Folder,
  FolderOpen,
  Loader2,
  Pencil,
  Trash2,
} from "lucide-react";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";

export interface ProjectFile {
  id: number;
  filename: string;
  language: string;
  content: string;
  createdAt: string;
}

interface FileExplorerProps {
  files: ProjectFile[];
  openFileIds: number[];
  activeFileId: number | null;
  pendingFileIds: Set<number>;
  projectTitle: string;
  onOpen: (fileId: number) => void;
  onCreate: (filename: string) => Promise<void>;
  onRename: (fileId: number, newName: string) => Promise<void>;
  onDelete: (fileId: number) => Promise<void>;
}

// ── Language icon colours ───────────────────────────────────────────────────

function getLangColor(filename: string): string {
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";
  const colors: Record<string, string> = {
    ts: "text-blue-400", tsx: "text-blue-400",
    js: "text-yellow-400", jsx: "text-yellow-400",
    css: "text-cyan-400", scss: "text-pink-400",
    html: "text-orange-400",
    json: "text-yellow-300",
    py: "text-green-400",
    md: "text-gray-400",
    sh: "text-green-300",
    rs: "text-orange-400",
    go: "text-cyan-300",
    java: "text-red-400",
    yaml: "text-purple-400", yml: "text-purple-400",
    sql: "text-indigo-400",
  };
  return colors[ext] ?? "text-muted-foreground";
}

// ── Inline rename input ─────────────────────────────────────────────────────

function RenameInput({
  initial,
  onConfirm,
  onCancel,
}: {
  initial: string;
  onConfirm: (v: string) => void;
  onCancel: () => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    ref.current?.focus();
    ref.current?.select();
  }, []);

  return (
    <input
      ref={ref}
      defaultValue={initial}
      className="flex-1 bg-background border border-primary/60 rounded px-1 text-xs text-foreground outline-none h-5"
      onKeyDown={(e) => {
        if (e.key === "Enter") onConfirm((e.target as HTMLInputElement).value.trim());
        if (e.key === "Escape") onCancel();
        e.stopPropagation();
      }}
      onBlur={(e) => onConfirm(e.target.value.trim())}
      onClick={(e) => e.stopPropagation()}
    />
  );
}

// ── New-file input ──────────────────────────────────────────────────────────

function NewFileInput({
  onConfirm,
  onCancel,
}: {
  onConfirm: (name: string) => void;
  onCancel: () => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => { ref.current?.focus(); }, []);

  return (
    <div className="flex items-center gap-1.5 px-3 py-1">
      <File className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
      <input
        ref={ref}
        placeholder="filename.ts"
        className="flex-1 bg-background border border-primary/60 rounded px-1 text-xs text-foreground outline-none h-5"
        onKeyDown={(e) => {
          if (e.key === "Enter") onConfirm((e.target as HTMLInputElement).value.trim());
          if (e.key === "Escape") onCancel();
          e.stopPropagation();
        }}
        onBlur={(e) => {
          const val = e.target.value.trim();
          if (val) onConfirm(val);
          else onCancel();
        }}
      />
    </div>
  );
}

// ── Main component ──────────────────────────────────────────────────────────

export function FileExplorer({
  files,
  openFileIds,
  activeFileId,
  pendingFileIds,
  projectTitle,
  onOpen,
  onCreate,
  onRename,
  onDelete,
}: FileExplorerProps) {
  const [creatingFile, setCreatingFile] = useState(false);
  const [renamingId, setRenamingId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [loading, setLoading] = useState<"create" | null>(null);

  // Group files by top-level folder segment
  const grouped = buildTree(files);

  const handleCreate = async (name: string) => {
    if (!name) { setCreatingFile(false); return; }
    setLoading("create");
    await onCreate(name);
    setLoading(null);
    setCreatingFile(false);
  };

  const handleRename = async (id: number, name: string) => {
    setRenamingId(null);
    if (!name) return;
    await onRename(id, name);
  };

  const handleDelete = async (id: number) => {
    setDeletingId(id);
    await onDelete(id);
    setDeletingId(null);
  };

  return (
    <div className="h-full flex flex-col bg-[#0d0e12] overflow-hidden">
      {/* Header */}
      <div className="px-3 py-2 flex items-center justify-between border-b border-border/50 shrink-0">
        <div className="flex items-center gap-1.5 min-w-0">
          <ChevronDown className="h-3 w-3 text-muted-foreground/50 shrink-0" />
          <span className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground truncate">
            {projectTitle}
          </span>
        </div>
        <button
          onClick={() => setCreatingFile(true)}
          className="h-5 w-5 flex items-center justify-center rounded text-muted-foreground/50 hover:text-foreground hover:bg-white/5 transition-colors shrink-0"
          title="New File"
        >
          {loading === "create" ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <FilePlus className="h-3 w-3" />
          )}
        </button>
      </div>

      {/* File tree */}
      <div className="flex-1 overflow-auto py-1">
        {creatingFile && (
          <NewFileInput
            onConfirm={handleCreate}
            onCancel={() => setCreatingFile(false)}
          />
        )}

        {grouped.map((node) => (
          <TreeNode
            key={node.path}
            node={node}
            activeFileId={activeFileId}
            openFileIds={openFileIds}
            pendingFileIds={pendingFileIds}
            renamingId={renamingId}
            deletingId={deletingId}
            onOpen={onOpen}
            onStartRename={(id) => setRenamingId(id)}
            onRename={handleRename}
            onDelete={handleDelete}
          />
        ))}

        {files.length === 0 && !creatingFile && (
          <div className="px-4 py-6 text-center text-xs text-muted-foreground/40">
            <p>No files yet.</p>
            <button
              onClick={() => setCreatingFile(true)}
              className="mt-2 text-primary/60 hover:text-primary underline-offset-2 hover:underline"
            >
              Create the first file
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Tree helpers ────────────────────────────────────────────────────────────

interface TreeNode {
  path: string;        // display path segment
  fullPath: string;    // full filename
  type: "file" | "folder";
  file?: ProjectFile;
  children?: TreeNode[];
  depth: number;
}

function buildTree(files: ProjectFile[]): TreeNode[] {
  const root: TreeNode[] = [];
  const folderMap = new Map<string, TreeNode>();

  const sorted = [...files].sort((a, b) => a.filename.localeCompare(b.filename));

  for (const file of sorted) {
    const parts = file.filename.split("/");
    let currentPath = "";

    for (let i = 0; i < parts.length - 1; i++) {
      const parent = currentPath;
      currentPath = currentPath ? `${currentPath}/${parts[i]}` : parts[i];

      if (!folderMap.has(currentPath)) {
        const node: TreeNode = {
          path: parts[i],
          fullPath: currentPath,
          type: "folder",
          children: [],
          depth: i,
        };
        folderMap.set(currentPath, node);
        if (i === 0) {
          root.push(node);
        } else {
          folderMap.get(parent)?.children?.push(node);
        }
      }
    }

    const fileNode: TreeNode = {
      path: parts[parts.length - 1],
      fullPath: file.filename,
      type: "file",
      file,
      depth: parts.length - 1,
    };

    if (parts.length === 1) {
      root.push(fileNode);
    } else {
      const parentPath = parts.slice(0, -1).join("/");
      folderMap.get(parentPath)?.children?.push(fileNode);
    }
  }

  return root;
}

function TreeNode({
  node,
  depth = 0,
  activeFileId,
  openFileIds,
  pendingFileIds,
  renamingId,
  deletingId,
  onOpen,
  onStartRename,
  onRename,
  onDelete,
}: {
  node: TreeNode;
  depth?: number;
  activeFileId: number | null;
  openFileIds: number[];
  pendingFileIds: Set<number>;
  renamingId: number | null;
  deletingId: number | null;
  onOpen: (id: number) => void;
  onStartRename: (id: number) => void;
  onRename: (id: number, name: string) => void;
  onDelete: (id: number) => void;
}) {
  const [folderOpen, setFolderOpen] = useState(true);
  const indent = depth * 12 + 12;

  if (node.type === "folder") {
    return (
      <div>
        <button
          onClick={() => setFolderOpen((v) => !v)}
          style={{ paddingLeft: indent }}
          className="w-full flex items-center gap-1.5 py-0.5 pr-2 text-xs text-muted-foreground hover:text-foreground hover:bg-white/4 transition-colors"
        >
          {folderOpen ? (
            <FolderOpen className="h-3.5 w-3.5 text-yellow-500/70 shrink-0" />
          ) : (
            <Folder className="h-3.5 w-3.5 text-yellow-500/70 shrink-0" />
          )}
          <span className="truncate font-medium">{node.path}</span>
        </button>
        {folderOpen && node.children?.map((child) => (
          <TreeNode
            key={child.fullPath}
            node={child}
            depth={depth + 1}
            activeFileId={activeFileId}
            openFileIds={openFileIds}
            pendingFileIds={pendingFileIds}
            renamingId={renamingId}
            deletingId={deletingId}
            onOpen={onOpen}
            onStartRename={onStartRename}
            onRename={onRename}
            onDelete={onDelete}
          />
        ))}
      </div>
    );
  }

  const file = node.file!;
  const isActive = activeFileId === file.id;
  const isOpen = openFileIds.includes(file.id);
  const isPending = pendingFileIds.has(file.id);
  const isDeleting = deletingId === file.id;

  return (
    <ContextMenu>
      <ContextMenuTrigger>
        <button
          onClick={() => onOpen(file.id)}
          onDoubleClick={() => onStartRename(file.id)}
          style={{ paddingLeft: indent }}
          disabled={isDeleting}
          className={`w-full flex items-center gap-1.5 py-0.5 pr-2 text-xs transition-colors ${
            isActive
              ? "bg-primary/15 text-foreground"
              : isOpen
                ? "text-foreground/80 hover:bg-white/4"
                : "text-muted-foreground hover:text-foreground hover:bg-white/4"
          } ${isDeleting ? "opacity-40" : ""}`}
        >
          <File className={`h-3.5 w-3.5 shrink-0 ${getLangColor(file.filename)}`} />
          {renamingId === file.id ? (
            <RenameInput
              initial={node.path}
              onConfirm={(name) => {
                const prefix = file.filename.includes("/")
                  ? file.filename.substring(0, file.filename.lastIndexOf("/") + 1)
                  : "";
                onRename(file.id, prefix + name);
              }}
              onCancel={() => onRename(file.id, file.filename)}
            />
          ) : (
            <>
              <span className="truncate flex-1 text-left">{node.path}</span>
              {isPending && (
                <span className="h-1.5 w-1.5 rounded-full bg-amber-400 shrink-0" title="Unsaved changes" />
              )}
            </>
          )}
        </button>
      </ContextMenuTrigger>
      <ContextMenuContent className="w-44">
        <ContextMenuItem onClick={() => onOpen(file.id)}>
          Open
        </ContextMenuItem>
        <ContextMenuItem onClick={() => onStartRename(file.id)}>
          <Pencil className="h-3.5 w-3.5 mr-2" /> Rename
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem
          onClick={() => onDelete(file.id)}
          className="text-destructive focus:text-destructive"
        >
          <Trash2 className="h-3.5 w-3.5 mr-2" /> Delete
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}
