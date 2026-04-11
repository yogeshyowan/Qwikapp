import { useState, useRef, useEffect } from "react";
import { useListConversations, useCreateConversation, useGetConversation, getListConversationsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Terminal, Send, Loader2, Plus, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

export default function Chat() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const chatScrollRef = useRef<HTMLDivElement>(null);
  
  const { data: conversations, isLoading: convsLoading } = useListConversations();
  const createConv = useCreateConversation();

  const [activeConvId, setActiveConvId] = useState<string | null>(null);
  const { data: activeConv, isLoading: activeConvLoading } = useGetConversation(activeConvId || "", {
    query: { enabled: !!activeConvId }
  });

  // Chat State
  const [chatInput, setChatInput] = useState("");
  const [messages, setMessages] = useState<{role: 'user' | 'assistant', content: string}[]>([]);
  const [isSending, setIsSending] = useState(false);

  // Sync messages when active conv loads
  useEffect(() => {
    if (activeConv?.messages) {
      setMessages(activeConv.messages.map(m => ({ role: m.role, content: m.content })));
    } else {
      setMessages([]);
    }
  }, [activeConv]);

  // Set first conv active on load if none selected
  useEffect(() => {
    if (conversations && conversations.length > 0 && !activeConvId) {
      setActiveConvId(conversations[0].id);
    }
  }, [conversations, activeConvId]);

  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleNewChat = async () => {
    try {
      const newConv = await createConv.mutateAsync({ data: { title: "New Session" } });
      queryClient.invalidateQueries({ queryKey: getListConversationsQueryKey() });
      setActiveConvId(newConv.id);
    } catch (e) {
      toast({ title: "Error", description: "Failed to create conversation", variant: "destructive" });
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || isSending) return;

    let targetConvId = activeConvId;
    
    // Auto-create conv if none selected
    if (!targetConvId) {
      try {
        const newConv = await createConv.mutateAsync({ data: { title: chatInput.substring(0, 30) } });
        queryClient.invalidateQueries({ queryKey: getListConversationsQueryKey() });
        setActiveConvId(newConv.id);
        targetConvId = newConv.id;
      } catch (e) {
        toast({ title: "Error", description: "Failed to start conversation", variant: "destructive" });
        return;
      }
    }

    const userMessage = chatInput;
    setChatInput("");
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setIsSending(true);

    try {
      const response = await fetch(`/api/anthropic/conversations/${targetConvId}/messages`, {
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

  return (
    <div className="h-[calc(100vh-8rem)] flex border border-border rounded-lg overflow-hidden bg-card shadow-lg max-w-6xl mx-auto mt-4">
      {/* Sidebar */}
      <div className="w-72 border-r border-border bg-sidebar flex flex-col">
        <div className="p-4 border-b border-border">
          <Button onClick={handleNewChat} className="w-full gap-2 font-bold tracking-wide" disabled={createConv.isPending}>
            {createConv.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            NEW SESSION
          </Button>
        </div>
        <ScrollArea className="flex-1">
          <div className="p-3 space-y-1">
            {convsLoading ? (
              <div className="space-y-2 p-2 text-center text-muted-foreground text-sm">
                <Loader2 className="h-4 w-4 animate-spin mx-auto mb-2" />
                Loading sessions...
              </div>
            ) : conversations?.map((conv) => (
              <button
                key={conv.id}
                onClick={() => setActiveConvId(conv.id)}
                className={`w-full text-left p-3 rounded-lg text-sm flex flex-col gap-1 transition-all ${
                  activeConvId === conv.id 
                    ? "bg-primary/10 border border-primary/20 text-primary" 
                    : "hover:bg-accent/10 text-muted-foreground border border-transparent"
                }`}
              >
                <span className="font-semibold truncate">{conv.title || 'Untitled Session'}</span>
                <span className="text-xs opacity-70 font-mono flex items-center gap-1">
                  <MessageSquare className="h-3 w-3" />
                  {format(new Date(conv.updatedAt), 'MMM d, h:mm a')}
                </span>
              </button>
            ))}
          </div>
        </ScrollArea>
      </div>

      {/* Chat Area */}
      <div className="flex-1 flex flex-col bg-[#050505]">
        <div className="p-4 border-b border-border/40 bg-sidebar/30 flex items-center gap-3">
          <Terminal className="h-5 w-5 text-primary" />
          <div>
            <h2 className="font-bold text-sm tracking-widest text-primary uppercase">SYSTEM TERMINAL</h2>
            <p className="text-xs text-muted-foreground font-mono">ID: {activeConvId || 'AWAITING_INIT'}</p>
          </div>
        </div>

        <div 
          ref={chatScrollRef}
          className="flex-1 overflow-auto p-6 space-y-6 font-mono text-sm"
        >
          {activeConvLoading ? (
            <div className="flex items-center gap-3 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> 
              <span>Retrieving logs...</span>
            </div>
          ) : messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-muted-foreground opacity-50">
              <Terminal className="h-16 w-16 mb-4" />
              <p className="text-lg">System ready for input.</p>
            </div>
          ) : (
            messages.map((msg, i) => (
              <div key={i} className={`flex gap-4 ${msg.role === 'user' ? 'text-primary' : 'text-gray-300'}`}>
                <span className="text-muted-foreground/50 select-none w-4 shrink-0 font-bold">
                  {msg.role === 'user' ? '>' : '$'}
                </span>
                <div className="prose prose-invert max-w-none prose-pre:bg-[#111] prose-pre:border prose-pre:border-border prose-p:leading-relaxed">
                  {msg.content.split('```').map((block, idx) => {
                    if (idx % 2 === 1) { // It's a code block
                      const lines = block.split('\n');
                      const lang = lines[0];
                      const code = lines.slice(1).join('\n');
                      return (
                        <div key={idx} className="my-4 rounded-md overflow-hidden border border-border/50">
                          <div className="bg-sidebar px-4 py-1.5 text-xs text-muted-foreground border-b border-border/50 uppercase tracking-wider">{lang || 'text'}</div>
                          <pre className="p-4 text-sm font-mono m-0 bg-[#0a0a0a] text-gray-300 overflow-x-auto">
                            <code>{code}</code>
                          </pre>
                        </div>
                      );
                    }
                    return <div key={idx} className="whitespace-pre-wrap">{block}</div>;
                  })}
                </div>
              </div>
            ))
          )}
          
          {isSending && (
            <div className="flex gap-4 text-gray-300">
              <span className="text-muted-foreground/50 select-none w-4 shrink-0 font-bold">$</span>
              <span className="inline-block w-2.5 h-5 bg-primary animate-pulse" />
            </div>
          )}
        </div>

        <form onSubmit={handleSendMessage} className="p-4 border-t border-border/40 bg-sidebar/30">
          <div className="flex gap-3 max-w-4xl mx-auto">
            <div className="relative flex-1 flex items-center">
              <span className="absolute left-4 text-primary font-bold">{'>'}</span>
              <Input 
                value={chatInput}
                onChange={e => setChatInput(e.target.value)}
                placeholder="Type command or query..." 
                className="font-mono bg-[#0a0a0a] border-border focus-visible:ring-primary pl-8 h-12 text-base"
                disabled={isSending}
                autoFocus
              />
            </div>
            <Button type="submit" disabled={!chatInput.trim() || isSending} className="shrink-0 w-12 h-12 px-0 bg-primary hover:bg-primary/90">
              {isSending ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
