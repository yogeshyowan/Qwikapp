import { useGetProjectStats, useListProjects } from "@workspace/api-client-react";
import { Link } from "wouter";
import { format } from "date-fns";
import { Terminal, Plus, Activity, Layers, FileCode2, Clock } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";

export default function Dashboard() {
  const { data: stats, isLoading: statsLoading } = useGetProjectStats();
  const { data: projects, isLoading: projectsLoading } = useListProjects();

  const getStatusColor = (status: string) => {
    switch (status) {
      case "done": return "bg-primary/20 text-primary border-primary/30";
      case "generating": return "bg-yellow-500/20 text-yellow-500 border-yellow-500/30 animate-pulse";
      case "error": return "bg-destructive/20 text-destructive border-destructive/30";
      default: return "bg-muted text-muted-foreground border-border";
    }
  };

  return (
    <div className="space-y-8 max-w-6xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold tracking-tight mb-2">Command Center</h1>
        <p className="text-muted-foreground">Monitor your generated applications and deployments.</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          { label: "Total Projects", value: stats?.totalProjects, icon: Layers, loading: statsLoading },
          { label: "Completed", value: stats?.completedProjects, icon: Activity, loading: statsLoading },
          { label: "Files Generated", value: stats?.totalFilesGenerated, icon: FileCode2, loading: statsLoading },
        ].map((stat, i) => (
          <div key={i} className="border border-border bg-card p-6 rounded-lg relative overflow-hidden group hover:border-primary/50 transition-colors">
            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
              <stat.icon className="w-16 h-16 text-primary" />
            </div>
            <div className="relative z-10">
              <p className="text-sm text-muted-foreground font-medium mb-1 uppercase tracking-wider">{stat.label}</p>
              {stat.loading ? (
                <Skeleton className="h-10 w-24 bg-muted/50" />
              ) : (
                <p className="text-4xl font-bold text-foreground font-sans tracking-tight">{stat.value || 0}</p>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Recent Projects */}
      <div>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold tracking-tight">Recent Deployments</h2>
          <Link href="/projects/new" className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground shadow hover:bg-primary/90 h-9 px-4 py-2 gap-2">
            <Plus className="h-4 w-4" />
            New Project
          </Link>
        </div>

        {projectsLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <Skeleton key={i} className="h-40 rounded-lg bg-card/50 border border-border" />
            ))}
          </div>
        ) : projects && projects.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {projects.map((project, i) => (
              <Link key={project.id} href={`/projects/${project.id}`} className="block">
                <div 
                  className="border border-border bg-card hover:bg-accent/5 p-5 rounded-lg h-full flex flex-col transition-all hover:border-primary/40 duration-300 animate-in fade-in slide-in-from-bottom-4"
                  style={{ animationDelay: `${i * 100}ms`, animationFillMode: "both" }}
                >
                  <div className="flex justify-between items-start mb-4">
                    <h3 className="font-bold text-lg truncate pr-2">{project.title}</h3>
                    <Badge variant="outline" className={getStatusColor(project.status)}>
                      {project.status}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground line-clamp-2 mb-4 flex-1">
                    {project.description}
                  </p>
                  <div className="flex items-center justify-between text-xs text-muted-foreground mt-auto pt-4 border-t border-border/50">
                    <span className="bg-secondary px-2 py-1 rounded text-secondary-foreground">{project.techStack}</span>
                    <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {format(new Date(project.createdAt), 'MMM d, yyyy')}</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="text-center py-16 border border-dashed border-border rounded-lg bg-card/30">
            <Terminal className="h-12 w-12 mx-auto text-muted-foreground mb-4 opacity-50" />
            <h3 className="text-lg font-medium mb-2">No projects yet</h3>
            <p className="text-muted-foreground mb-4">Create your first AI-generated application to get started.</p>
            <Link href="/projects/new" className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring bg-primary text-primary-foreground shadow hover:bg-primary/90 h-9 px-4 py-2 gap-2">
              <Plus className="h-4 w-4" />
              Initialize Project
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
