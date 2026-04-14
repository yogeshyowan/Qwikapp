import { useRef, useState } from "react";
import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useCreateProject, getListProjectsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Github, Loader2, Terminal, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  type PlanId,
  getRememberedPlan,
  PlanSelectionDialog,
  PLANS,
  rememberSelectedPlan,
} from "@/components/plan-selection-dialog";

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
  const zipInputRef = useRef<HTMLInputElement | null>(null);
  
  const [plansOpen, setPlansOpen] = useState(() => !getRememberedPlan());
  const [selectedPlan, setSelectedPlan] = useState<PlanId | null>(() => getRememberedPlan());

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: "",
      description: "",
      techStack: "Web App",
    },
  });

  const handleSelectPlan = (planId: PlanId) => {
    rememberSelectedPlan(planId);
    setSelectedPlan(planId);
    setPlansOpen(false);
  };

  const handleGithubImport = () => {
    toast({
      title: "GitHub import",
      description: "GitHub import will be connected here.",
    });
  };

  const handleZipImport = (file?: File) => {
    if (!file) return;
    toast({
      title: "Zip file selected",
      description: `${file.name} is ready to import once import processing is connected.`,
    });
  };

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    if (!selectedPlan) {
      setPlansOpen(true);
      return;
    }

    try {
      const project = await createProject.mutateAsync({ data: values });
      queryClient.invalidateQueries({ queryKey: getListProjectsQueryKey() });
      setLocation(`/projects/${project.id}`);
    } catch (error) {
      console.error(error);
      const message = error instanceof Error ? error.message : "There was an error creating the project.";
      toast({
        title: "Project creation failed",
        description: message,
        variant: "destructive",
      });
    }
  };

  const selectedPlanDetails = PLANS.find((plan) => plan.id === selectedPlan);

  return (
    <div className="max-w-2xl mx-auto mt-8">
      <PlanSelectionDialog
        open={plansOpen}
        onOpenChange={setPlansOpen}
        onSelectPlan={handleSelectPlan}
        title="Select a plan before creating your project"
        description="The payment/plan step appears only when project creation is triggered."
      />

      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight mb-2">Create Project</h1>
        <p className="text-muted-foreground">Describe your app idea, then continue into the conversational AI builder.</p>
      </div>

      <div className="border border-border bg-card rounded-lg p-6 shadow-sm">
        <div className="mb-6 flex items-center justify-between gap-3 rounded-lg border border-primary/20 bg-primary/5 px-4 py-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-primary">Selected plan</p>
            <p className="text-sm text-foreground">
              {selectedPlanDetails ? `${selectedPlanDetails.name} · ${selectedPlanDetails.priceDisplay}` : "Choose a plan to continue"}
            </p>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={() => setPlansOpen(true)}>
            Change plan
          </Button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
          <Button type="button" variant="outline" className="justify-center gap-2" onClick={handleGithubImport}>
            <Github className="h-4 w-4" />
            Import from GitHub
          </Button>
          <Button type="button" variant="outline" className="justify-center gap-2" onClick={() => zipInputRef.current?.click()}>
            <Upload className="h-4 w-4" />
            Import from Zip File
          </Button>
          <input
            ref={zipInputRef}
            type="file"
            accept=".zip,application/zip,application/x-zip-compressed"
            className="hidden"
            onChange={(event) => handleZipImport(event.target.files?.[0])}
          />
        </div>

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
                  <FormLabel className="text-foreground font-bold tracking-wide uppercase text-xs">Project Type</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger className="bg-background font-mono">
                        <SelectValue placeholder="Select project type" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="Web App">Web App</SelectItem>
                      <SelectItem value="Mobile App">Mobile App</SelectItem>
                      <SelectItem value="Website">Website</SelectItem>
                      <SelectItem value="Presentation">Presentation</SelectItem>
                      <SelectItem value="Dashboard">Dashboard</SelectItem>
                      <SelectItem value="Blog">Blog</SelectItem>
                      <SelectItem value="Document">Document</SelectItem>
                      <SelectItem value="3D Game">3D Game</SelectItem>
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
                    CONTINUE TO AI BUILDER
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
