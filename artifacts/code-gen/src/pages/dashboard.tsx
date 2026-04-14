import { useGetProjectStats, useListProjects } from "@workspace/api-client-react";
import { Link } from "wouter";
import { format } from "date-fns";
import {
  Activity,
  Clock,
  FileCode2,
  Layers,
  Plus,
  Terminal,
  Zap,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

function statusStyle(status: string) {
  switch (status) {
    case "done":
      return "bg-emerald-50 text-emerald-700 border-emerald-200";
    case "generating":
      return "bg-yellow-50 text-yellow-700 border-yellow-200 animate-pulse";
    case "error":
      return "bg-red-50 text-red-700 border-red-200";
    default:
      return "bg-muted text-muted-foreground border-border";
  }
}

export default function Dashboard() {
  const { data: stats, isLoading: statsLoading } = useGetProjectStats();
  const { data: projects, isLoading: projectsLoading } = useListProjects();

  const statCards = [
    { label: "Total Projects", value: stats?.totalProjects, icon: Layers },
    { label: "Completed", value: stats?.completedProjects, icon: Activity },
    { label: "Files Generated", value: stats?.totalFilesGenerated, icon: FileCode2 },
  ];

  return (
    <div className="max-w-5xl mx-auto space-y-8">

      {/* Hero header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Projects</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Build and deploy AI-generated applications instantly.
          </p>
        </div>
        <Link href="/projects/new">
          <Button size="sm" className="gap-2 shrink-0">
            <Plus className="h-4 w-4" />
            Create Project
          </Button>
        </Link>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-3">
        {statCards.map((s, i) => (
          <div
            key={i}
            className="bg-card border border-border/60 rounded-lg p-4 relative overflow-hidden group hover:border-border transition-colors"
          >
            <div className="absolute top-3 right-3 opacity-8 group-hover:opacity-15 transition-opacity">
              <s.icon className="h-8 w-8 text-primary" />
            </div>
            <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">{s.label}</p>
            {statsLoading ? (
              <Skeleton className="h-8 w-16 bg-muted/30" />
            ) : (
              <p className="text-3xl font-bold tabular-nums">{s.value ?? 0}</p>
            )}
          </div>
        ))}
      </div>

      {/* Project grid */}
      <div>
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">
          Recent
        </h2>

        {projectsLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {Array(6).fill(0).map((_, i) => (
              <Skeleton key={i} className="h-36 rounded-lg bg-card/50 border border-border/40" />
            ))}
          </div>
        ) : projects && projects.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {projects.map((project, i) => (
              <Link key={project.id} href={`/projects/${project.id}`}>
                <div
                  className="group bg-card border border-border/60 rounded-lg p-4 h-full flex flex-col gap-3 hover:border-primary/30 hover:bg-card/80 transition-all duration-200 cursor-pointer"
                  style={{
                    animationDelay: `${i * 50}ms`,
                    animation: "fadeIn 0.3s ease both",
                  }}
                >
                  {/* Title row */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="h-7 w-7 rounded bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
                        <Terminal className="h-3.5 w-3.5 text-primary" />
                      </div>
                      <h3 className="font-semibold text-sm truncate">{project.title}</h3>
                    </div>
                    <Badge
                      variant="outline"
                      className={`text-[10px] px-1.5 h-5 shrink-0 ${statusStyle(project.status)}`}
                    >
                      {project.status}
                    </Badge>
                  </div>

                  {/* Description */}
                  <p className="text-xs text-muted-foreground/70 line-clamp-2 leading-relaxed flex-1">
                    {project.description}
                  </p>

                  {/* Footer */}
                  <div className="flex items-center justify-between pt-2 border-t border-border/40">
                    <span className="text-[10px] font-mono bg-secondary/60 text-secondary-foreground px-1.5 py-0.5 rounded">
                      {project.techStack}
                    </span>
                    <span className="text-[10px] text-muted-foreground/40 flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {format(new Date(project.createdAt), "MMM d")}
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="border border-dashed border-border/50 rounded-lg py-16 px-8 text-center">
            <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 border border-primary/20 mb-4">
              <Zap className="h-6 w-6 text-primary" />
            </div>
            <h3 className="font-semibold mb-1">No projects yet</h3>
            <p className="text-sm text-muted-foreground mb-5">
              Describe an app idea and Claude will build it for you.
            </p>
            <Link href="/projects/new">
              <Button size="sm" className="gap-2">
                <Plus className="h-4 w-4" />
                Create first project
              </Button>
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
