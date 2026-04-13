import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";

interface FileEntry {
  id: number;
  filename: string;
  content: string;
}

interface SearchPanelProps {
  files: FileEntry[];
  onOpenFile: (fileId: number) => void;
}

interface SearchMatch {
  fileId: number;
  filename: string;
  lineNumber: number;
  lineText: string;
  matchStart: number;
  matchEnd: number;
}

export function SearchPanel({ files, onOpenFile }: SearchPanelProps) {
  const [query, setQuery] = useState("");

  const results = useMemo<SearchMatch[]>(() => {
    const q = query.trim();
    if (!q || q.length < 2) return [];

    const matches: SearchMatch[] = [];
    const lower = q.toLowerCase();

    for (const file of files) {
      const lines = file.content.split("\n");
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const idx = line.toLowerCase().indexOf(lower);
        if (idx !== -1) {
          matches.push({
            fileId: file.id,
            filename: file.filename,
            lineNumber: i + 1,
            lineText: line,
            matchStart: idx,
            matchEnd: idx + q.length,
          });
          if (matches.length >= 200) return matches;
        }
      }
    }

    return matches;
  }, [query, files]);

  // Group by file
  const grouped = useMemo(() => {
    const map = new Map<string, SearchMatch[]>();
    for (const m of results) {
      const key = m.filename;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(m);
    }
    return map;
  }, [results]);

  return (
    <div className="h-full flex flex-col bg-[#0d0e12] overflow-hidden">
      {/* Header */}
      <div className="px-3 py-2 border-b border-border/50 shrink-0">
        <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground mb-2">
          Search
        </p>
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/40" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search in files…"
            className="h-7 pl-8 text-xs bg-[#1a1b22] border-border/50 focus-visible:ring-primary/50"
            autoFocus
          />
        </div>
        {results.length > 0 && (
          <p className="text-[10px] text-muted-foreground/40 mt-1.5">
            {results.length} result{results.length !== 1 ? "s" : ""} in{" "}
            {grouped.size} file{grouped.size !== 1 ? "s" : ""}
          </p>
        )}
      </div>

      {/* Results */}
      <ScrollArea className="flex-1">
        {query.length < 2 ? (
          <div className="px-4 py-8 text-center text-xs text-muted-foreground/30">
            Type at least 2 characters to search
          </div>
        ) : results.length === 0 ? (
          <div className="px-4 py-8 text-center text-xs text-muted-foreground/30">
            No results found for "{query}"
          </div>
        ) : (
          <div className="py-1">
            {Array.from(grouped.entries()).map(([filename, matches]) => (
              <div key={filename} className="mb-3">
                {/* File header */}
                <div className="sticky top-0 px-3 py-1 bg-[#0d0e12] border-b border-border/30">
                  <span className="text-[11px] text-foreground/70 font-medium">
                    {filename}
                  </span>
                  <span className="text-[10px] text-muted-foreground/40 ml-2">
                    {matches.length} match{matches.length !== 1 ? "es" : ""}
                  </span>
                </div>

                {/* Matches */}
                {matches.map((m, i) => (
                  <button
                    key={i}
                    onClick={() => onOpenFile(m.fileId)}
                    className="w-full text-left px-3 py-1.5 hover:bg-white/5 transition-colors flex items-start gap-3 group"
                  >
                    <span className="text-[10px] text-muted-foreground/30 tabular-nums w-8 shrink-0 text-right pt-px">
                      {m.lineNumber}
                    </span>
                    <span className="text-xs font-mono text-muted-foreground/60 truncate leading-relaxed">
                      {m.lineText.slice(0, m.matchStart)}
                      <span className="bg-yellow-400/20 text-yellow-300">
                        {m.lineText.slice(m.matchStart, m.matchEnd)}
                      </span>
                      {m.lineText.slice(m.matchEnd)}
                    </span>
                  </button>
                ))}
              </div>
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
