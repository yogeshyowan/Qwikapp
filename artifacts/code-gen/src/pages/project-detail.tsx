import { useState, useRef, useEffect } from "react";
import { useLocation, useParams } from "wouter";
import { useGetProject, useListProjectFiles, getGetProjectQueryKey } from "@workspace/api-client-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Terminal, FileCode, Play, Send, Loader2, Globe, ExternalLink, RefreshCw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";

export default function ProjectDetail() {
  const { id } = useParams<{ id: string }>();
  const projectId = parseInt(id || "0", 10);
  const { toast } = useToast();

  const { data: project, isLoading: projectLoading } = useGetProject(projectId);
  const { data: files, isLoading: filesLoading } = useListProjectFiles(projectId);

  const [activeFileId, setActiveFileId] = useState<number | null>(null);
  
  // Set first file as active when loaded
  useEffect(() => {
    if (files && files.length > 0 && !activeFileId) {
      setActiveFileId(files[0].id);
    }
  }, [files, activeFileId]);

  const activeFile = files?.find(f => f.id === activeFileId);

  // Chat State
  const [chatInput, setChatInput] = useState("");
  const [messages, setMessages] = useState<{role: 'user' | 'assistant', content: string}[]>([]);
  const [isSending, setIsSending] = useState(false);
  const chatScrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || isSending || !project?.conversationId) return;

    const userMessage = chatInput;
    setChatInput("");
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setIsSending(true);

    try {
      const response = await fetch(`/api/anthropic/conversations/${project.conversationId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: userMessage })
      });

      if (!response.body) throw new Error("No response body");

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      
      setMessages(prev => [...prev, { role: 'assistant', content: "" }]);
      
      let buffer = "";
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n\n');
        buffer = lines.pop() || "";
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              if (data.content) {
                setMessages(prev => {
                  const newMsgs = [...prev];
                  newMsgs[newMsgs.length - 1].content += data.content;
                  return newMsgs;
                });
              }
            } catch(e) {}
          }
        }
      }
    } catch (error) {
      console.error(error);
      toast({ title: "Error", description: "Failed to send message.", variant: "destructive" });
    } finally {
      setIsSending(false);
    }
  };

  const handleRedeploy = async () => {
    try {
      toast({ title: "Redeploying...", description: "Initiating deployment process." });
      await fetch(`/api/projects/${projectId}/redeploy`, { method: "POST" });
      toast({ title: "Success", description: "Project deployment started." });
    } catch (error) {
      toast({ title: "Error", description: "Failed to redeploy.", variant: "destructive" });
    }
  };

  if (projectLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-12 w-64" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (!project) return <div>Project not found</div>;

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between mb-6 shrink-0">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-3xl font-bold tracking-tight">{project.title}</h1>
            <Badge variant="outline" className={
              project.status === 'done' ? 'bg-primary/20 text-primary border-primary/30' :
              project.status === 'generating' ? 'bg-yellow-500/20 text-yellow-500 border-yellow-500/30 animate-pulse' :
              'bg-destructive/20 text-destructive border-destructive/30'
            }>
              {project.status.toUpperCase()}
            </Badge>
          </div>
          <p className="text-muted-foreground text-sm flex items-center gap-2">
            <span className="px-2 py-0.5 bg-secondary text-secondary-foreground rounded text-xs">{project.techStack}</span>
            <span>{project.description}</span>
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={handleRedeploy} className="gap-2">
          <RefreshCw className="h-4 w-4" /> Redeploy
        </Button>
      </div>

      <Tabs defaultValue="files" className="flex-1 flex flex-col h-full overflow-hidden">
        <TabsList className="w-full justify-start border-b border-border rounded-none bg-transparent h-auto p-0 gap-6 shrink-0">
          <TabsTrigger value="files" className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none pb-3 pt-2 px-1 font-mono tracking-wider">
            <FileCode className="h-4 w-4 mr-2" /> FILES
          </TabsTrigger>
          <TabsTrigger value="chat" className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none pb-3 pt-2 px-1 font-mono tracking-wider">
            <Terminal className="h-4 w-4 mr-2" /> TERMINAL CHAT
          </TabsTrigger>
          <TabsTrigger value="deploy" className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none pb-3 pt-2 px-1 font-mono tracking-wider">
            <Play className="h-4 w-4 mr-2" /> DEPLOYMENT
          </TabsTrigger>
        </TabsList>

        <TabsContent value="files" className="flex-1 mt-6 h-full overflow-hidden flex border border-border rounded-lg bg-card">
          {/* File Tree */}
          <div className="w-64 border-r border-border bg-sidebar flex flex-col h-full">
            <div className="p-3 border-b border-border text-xs font-bold text-muted-foreground uppercase tracking-wider">Project Files</div>
            <ScrollArea className="flex-1">
              <div className="p-2 space-y-1">
                {filesLoading ? (
                  Array(5).fill(0).map((_, i) => <Skeleton key={i} className="h-8 w-full bg-muted/50" />)
                ) : (
                  files?.map(file => (
                    <button
                      key={file.id}
                      onClick={() => setActiveFileId(file.id)}
                      className={`w-full text-left px-3 py-2 rounded-md text-sm font-mono flex items-center gap-2 transition-colors ${
                        activeFileId === file.id ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-accent/10 hover:text-foreground"
                      }`}
                    >
                      <FileCode className="h-3.5 w-3.5" />
                      <span className="truncate">{file.filename}</span>
                    </button>
                  ))
                )}
              </div>
            </ScrollArea>
          </div>
          
          {/* Code Viewer */}
          <div className="flex-1 bg-[#0d0d0d] flex flex-col min-w-0">
            <div className="px-4 py-2 border-b border-border/40 text-xs text-muted-foreground font-mono flex items-center gap-2">
              <span>{activeFile?.filename || 'No file selected'}</span>
            </div>
            <ScrollArea className="flex-1 w-full">
              {activeFile ? (
                <pre className="p-4 text-sm font-mono text-gray-300 leading-relaxed min-w-max">
                  <code>{activeFile.content}</code>
                </pre>
              ) : (
                <div className="h-full flex items-center justify-center text-muted-foreground">
                  Select a file to view its contents
                </div>
              )}
            </ScrollArea>
          </div>
        </TabsContent>

        <TabsContent value="chat" className="flex-1 mt-6 h-full overflow-hidden border border-border rounded-lg bg-card flex flex-col">
          <div className="p-3 border-b border-border bg-sidebar/50 text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
            <Terminal className="h-4 w-4" /> System Console
          </div>
          
          <div 
            ref={chatScrollRef}
            className="flex-1 overflow-auto p-4 space-y-4 font-mono text-sm bg-[#0a0a0a]"
          >
            {messages.length === 0 && (
              <div className="text-muted-foreground/50 italic">
                // AI Assistant ready. Ask me to modify the code or explain how it works.
              </div>
            )}
            
            {messages.map((msg, i) => (
              <div key={i} className={`flex gap-4 ${msg.role === 'user' ? 'text-primary' : 'text-gray-300'}`}>
                <span className="text-muted-foreground/50 select-none w-4 shrink-0">
                  {msg.role === 'user' ? '>' : '$'}
                </span>
                <span className="whitespace-pre-wrap break-words">{msg.content}</span>
              </div>
            ))}
            
            {isSending && (
              <div className="flex gap-4 text-gray-300">
                <span className="text-muted-foreground/50 select-none w-4 shrink-0">$</span>
                <span className="inline-block w-2 h-4 bg-primary animate-pulse" />
              </div>
            )}
          </div>
          
          <form onSubmit={handleSendMessage} className="p-4 border-t border-border bg-sidebar">
            <div className="flex gap-2">
              <Input 
                value={chatInput}
                onChange={e => setChatInput(e.target.value)}
                placeholder="Enter command..." 
                className="font-mono bg-[#050505] border-border focus-visible:ring-primary"
                disabled={isSending || !project.conversationId}
              />
              <Button type="submit" disabled={!chatInput.trim() || isSending || !project.conversationId} className="shrink-0 w-12 px-0">
                {isSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </Button>
            </div>
          </form>
        </TabsContent>

        <TabsContent value="deploy" className="flex-1 mt-6">
          <div className="border border-border bg-card rounded-lg p-8 max-w-2xl mx-auto mt-12 text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 text-primary mb-6">
              <Globe className="h-8 w-8" />
            </div>
            
            <h2 className="text-2xl font-bold mb-2">Live Deployment</h2>
            
            {project.status === 'done' ? (
              <div className="space-y-6">
                <p className="text-muted-foreground">Your application is successfully deployed and running.</p>
                <div className="p-4 bg-black rounded border border-border flex items-center justify-between max-w-md mx-auto">
                  <span className="font-mono text-sm truncate pr-4 text-primary">https://{project.title.toLowerCase().replace(/[^a-z0-9]/g, '-')}.devlaunch.app</span>
                  <Button size="sm" variant="secondary" className="shrink-0 gap-2">
                    <ExternalLink className="h-3.5 w-3.5" /> Visit
                  </Button>
                </div>
              </div>
            ) : project.status === 'generating' ? (
              <div className="space-y-4">
                <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
                <p className="text-muted-foreground">Deployment in progress. Please wait...</p>
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-destructive">Deployment failed or has not started.</p>
                <Button onClick={handleRedeploy}>Trigger Manual Deploy</Button>
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
