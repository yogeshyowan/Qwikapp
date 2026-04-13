import { useState } from "react";
import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useCreateProject, getListProjectsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Terminal, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";

const formSchema = z.object({
  title: z.string().min(2, "Title must be at least 2 characters."),
  description: z.string().min(10, "Please provide more details for the AI to generate a good app."),
  techStack: z.string().min(1, "Please select a tech stack."),
});

export default function NewProject() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const createProject = useCreateProject();
  
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationLogs, setGenerationLogs] = useState<string[]>([]);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: "",
      description: "",
      techStack: "React",
    },
  });

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    try {
      setIsGenerating(true);
      setGenerationLogs(["Initializing generation protocol...", `Target stack: ${values.techStack}`, "Booting AI assistant..."]);
      
      const project = await createProject.mutateAsync({ data: values });
      
      queryClient.invalidateQueries({ queryKey: getListProjectsQueryKey() });
      
      // Start SSE stream
      setGenerationLogs(prev => [...prev, `Project created with ID: ${project.id}`, "Awaiting code generation stream..."]);
      
      const response = await fetch(`/api/projects/${project.id}/generate`, {
        method: "POST",
      });

      if (!response.body) throw new Error("No response body");

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      
      let buffer = "";
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n\n');
        buffer = lines.pop() || "";
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            let data: { type?: string; content?: string; summary?: string; deployUrl?: string | null; fileCount?: number; message?: string };
            try {
              data = JSON.parse(line.slice(6));
            } catch (e) {
              console.error(e);
              throw new Error("Invalid generation stream response");
            }

            if (data.type === 'chunk') {
              setGenerationLogs(prev => {
                const newLogs = [...prev, `[WRITING] ${(data.content ?? "").substring(0, 50).replace(/\n/g, '')}...`];
                return newLogs.slice(-15);
              });
            } else if (data.type === 'done') {
              setGenerationLogs(prev => [...prev, "SUCCESS: Generation complete", data.deployUrl ? `Deployed at: ${data.deployUrl}` : "Files saved to project database"]);
              setTimeout(() => {
                setLocation(`/projects/${project.id}`);
              }, 1500);
              return;
            } else if (data.type === 'error') {
              throw new Error(data.message || "Generation error");
            }
          }
        }
      }

      throw new Error("Generation stream ended before completion");
      
    } catch (error) {
      console.error(error);
      const message = error instanceof Error ? error.message : "There was an error generating the project.";
      setGenerationLogs(prev => [...prev, `ERROR: ${message}`]);
      toast({
        title: "Generation failed",
        description: message,
        variant: "destructive",
      });
      setIsGenerating(false);
    }
  };

  if (isGenerating) {
    return (
      <div className="fixed inset-0 z-50 bg-background flex flex-col">
        <div className="flex items-center gap-3 p-6 border-b border-border bg-sidebar">
          <Terminal className="h-6 w-6 text-primary animate-pulse" />
          <div>
            <h2 className="font-bold text-lg text-primary uppercase tracking-widest">Generating System</h2>
            <p className="text-xs text-muted-foreground">Do not close this window</p>
          </div>
        </div>
        <div className="flex-1 bg-[#0a0a0a] p-6 font-mono text-sm overflow-auto text-green-400/80 leading-relaxed shadow-inner">
          <div className="max-w-4xl mx-auto space-y-1">
            {generationLogs.map((log, i) => (
              <div key={i} className="flex gap-4">
                <span className="text-muted-foreground/50 select-none w-16 inline-block text-right">
                  {String(i + 1).padStart(4, '0')}
                </span>
                <span className="whitespace-pre-wrap break-all">{log}</span>
              </div>
            ))}
            <div className="flex gap-4 items-center mt-4">
              <span className="text-muted-foreground/50 select-none w-16 inline-block text-right">
                {String(generationLogs.length + 1).padStart(4, '0')}
              </span>
              <span className="inline-block w-2 h-4 bg-primary animate-pulse" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto mt-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight mb-2">Initialize New Project</h1>
        <p className="text-muted-foreground">Describe your app idea, and Claude will generate the code and deploy it.</p>
      </div>

      <div className="border border-border bg-card rounded-lg p-6 shadow-sm">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-foreground font-bold tracking-wide uppercase text-xs">Project Name</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., TaskTracker Pro" className="bg-background font-sans" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="techStack"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-foreground font-bold tracking-wide uppercase text-xs">Target Environment</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger className="bg-background font-mono">
                        <SelectValue placeholder="Select stack" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="React">React (Vite)</SelectItem>
                      <SelectItem value="Next.js">Next.js</SelectItem>
                      <SelectItem value="Node.js">Node.js (Express)</SelectItem>
                      <SelectItem value="Python Flask">Python Flask</SelectItem>
                      <SelectItem value="Full-Stack">Full-Stack (React + Node)</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-foreground font-bold tracking-wide uppercase text-xs">System Prompt / Requirements</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="Describe your application in detail. What features does it need? What does it look like?"
                      className="min-h-[200px] bg-background font-sans resize-y"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="pt-4 border-t border-border/50 flex justify-end">
              <Button type="submit" className="w-full sm:w-auto font-bold tracking-wider" disabled={createProject.isPending}>
                {createProject.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    INITIALIZING...
                  </>
                ) : (
                  <>
                    <Terminal className="mr-2 h-4 w-4" />
                    EXECUTE GENERATION
                  </>
                )}
              </Button>
            </div>
          </form>
        </Form>
      </div>
    </div>
  );
}
