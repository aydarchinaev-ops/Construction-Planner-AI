import { useState, useRef, useEffect } from "react";
import { useGetChatHistory, useSendChatMessage, useGenerateSchedule } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Send, Bot, User, Zap, Loader2 } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

export default function ChatPanel({ projectId }: { projectId: number }) {
  const queryClient = useQueryClient();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [input, setInput] = useState("");
  
  const { data: messages = [], isLoading } = useGetChatHistory(projectId, {
    query: {
      enabled: !!projectId,
      queryKey: [`/api/projects/${projectId}/chat/history`]
    }
  });

  const sendMessage = useSendChatMessage();
  const generateSchedule = useGenerateSchedule();

  const scrollToBottom = () => {
    if (scrollRef.current) {
      const scrollContainer = scrollRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (scrollContainer) {
        scrollContainer.scrollTop = scrollContainer.scrollHeight;
      }
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!input.trim() || sendMessage.isPending) return;

    const content = input;
    setInput("");
    
    // Optimistic update could go here
    
    sendMessage.mutate(
      { projectId, data: { content } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: [`/api/projects/${projectId}/chat/history`] });
        }
      }
    );
  };

  const handleGenerate = () => {
    generateSchedule.mutate(
      { projectId },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: [`/api/projects/${projectId}/tasks`] });
          queryClient.invalidateQueries({ queryKey: [`/api/projects/${projectId}/dependencies`] });
          queryClient.invalidateQueries({ queryKey: [`/api/projects/${projectId}/wbs`] });
          queryClient.invalidateQueries({ queryKey: [`/api/projects/${projectId}/summary`] });
          queryClient.invalidateQueries({ queryKey: [`/api/projects/${projectId}/chat/history`] });
        }
      }
    );
  };

  return (
    <div className="flex flex-col h-full bg-slate-900 relative">
      <div className="flex-none p-3 border-b border-slate-800 bg-slate-900/95 backdrop-blur z-10 flex items-center justify-between">
        <h2 className="text-sm font-semibold flex items-center gap-2 text-slate-200">
          <Bot className="h-4 w-4 text-blue-400" />
          Planning Copilot
        </h2>
      </div>

      <ScrollArea className="flex-grow px-4 py-4" ref={scrollRef}>
        <div className="space-y-6 pb-20">
          {isLoading ? (
            <div className="flex justify-center p-4">
              <Loader2 className="h-5 w-5 animate-spin text-slate-500" />
            </div>
          ) : messages.length === 0 ? (
            <div className="text-center mt-10 space-y-3">
              <Bot className="h-10 w-10 text-slate-600 mx-auto" />
              <p className="text-sm text-slate-400">Describe your project requirements, duration, and key milestones to start generating a schedule.</p>
            </div>
          ) : (
            messages.map((msg) => (
              <div key={msg.id} className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                <div className={`w-7 h-7 shrink-0 rounded-md flex items-center justify-center ${msg.role === 'user' ? 'bg-blue-600' : 'bg-slate-700'}`}>
                  {msg.role === 'user' ? <User className="h-4 w-4 text-white" /> : <Bot className="h-4 w-4 text-blue-300" />}
                </div>
                <div className={`text-sm py-2 px-3 rounded-lg max-w-[85%] ${
                  msg.role === 'user' 
                    ? 'bg-blue-600 text-white rounded-tr-none' 
                    : 'bg-slate-800 text-slate-200 rounded-tl-none border border-slate-700'
                }`}>
                  <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                </div>
              </div>
            ))
          )}
          
          {(sendMessage.isPending || generateSchedule.isPending) && (
            <div className="flex gap-3">
              <div className="w-7 h-7 shrink-0 rounded-md bg-slate-700 flex items-center justify-center">
                <Bot className="h-4 w-4 text-blue-300" />
              </div>
              <div className="text-sm py-2 px-4 rounded-lg bg-slate-800 text-slate-400 rounded-tl-none border border-slate-700 flex items-center gap-2">
                <Loader2 className="h-3 w-3 animate-spin" />
                Thinking...
              </div>
            </div>
          )}
        </div>
      </ScrollArea>

      <div className="p-3 border-t border-slate-800 bg-slate-900/95 backdrop-blur absolute bottom-0 left-0 right-0">
        {messages.length > 0 && messages[messages.length - 1]?.role === 'assistant' && !generateSchedule.isPending && (
          <Button 
            variant="outline" 
            size="sm" 
            className="w-full mb-3 bg-amber-500/10 text-amber-500 border-amber-500/20 hover:bg-amber-500/20 hover:text-amber-400 font-semibold"
            onClick={handleGenerate}
          >
            <Zap className="h-4 w-4 mr-2" />
            Generate / Update Schedule
          </Button>
        )}
        
        <form onSubmit={handleSend} className="relative flex items-center">
          <Input 
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type your requirements..." 
            className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500 pr-10 focus-visible:ring-blue-500"
            disabled={sendMessage.isPending}
          />
          <Button 
            type="submit" 
            size="icon" 
            variant="ghost" 
            className="absolute right-1 h-8 w-8 text-blue-400 hover:text-blue-300 hover:bg-slate-700"
            disabled={!input.trim() || sendMessage.isPending}
          >
            <Send className="h-4 w-4" />
          </Button>
        </form>
      </div>
    </div>
  );
}
