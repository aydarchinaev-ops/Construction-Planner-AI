import { useState } from "react";
import { useParams, useLocation } from "wouter";
import { 
  ResizablePanelGroup, 
  ResizablePanel, 
  ResizableHandle 
} from "@/components/ui/resizable";
import { useGetProject, useGetProjectSummary } from "@workspace/api-client-react";
import TopBar from "@/components/project/top-bar";
import ChatPanel from "@/components/project/chat-panel";
import GanttView from "@/components/project/gantt-view";
import KanbanView from "@/components/project/kanban-view";
import NetworkView from "@/components/project/network-view";
import InspectorPanel from "@/components/project/inspector-panel";
import AiSuggestionsPanel from "@/components/project/ai-suggestions-panel";
import ValidationPanel from "@/components/project/validation-panel";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2 } from "lucide-react";

export default function ProjectWorkspace() {
  const params = useParams();
  const projectId = parseInt(params.id || "0", 10);
  const [location] = useLocation();

  // Determine active view from URL path
  const viewPath = location.split("/").pop();
  const activeView = ["gantt", "kanban", "network"].includes(viewPath || "") ? viewPath : "gantt";

  const { data: project, isLoading: projectLoading } = useGetProject(projectId, {
    query: {
      enabled: !!projectId,
      queryKey: [`/api/projects/${projectId}`]
    }
  });

  const [selectedTaskId, setSelectedTaskId] = useState<number | null>(null);
  const [rightPanelTab, setRightPanelTab] = useState("inspector");

  if (projectLoading || !project) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-slate-900">
        <div className="flex flex-col items-center gap-4 text-slate-400">
          <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
          <p>Loading workspace...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen w-full overflow-hidden bg-slate-50 text-slate-900">
      <TopBar project={project} activeView={activeView as string} />
      
      <div className="flex-grow overflow-hidden relative border-t border-slate-200">
        <ResizablePanelGroup direction="horizontal" className="h-full w-full">
          
          {/* LEFT PANEL: Chat Assistant (Dark) */}
          <ResizablePanel defaultSize={22} minSize={15} maxSize={35} className="bg-slate-900 text-slate-100 flex flex-col border-r border-slate-800">
            <ChatPanel projectId={projectId} />
          </ResizablePanel>
          
          <ResizableHandle withHandle className="bg-slate-300 hover:bg-blue-400 data-[resize-handle-state=drag]:bg-blue-500 w-1.5 transition-colors" />
          
          {/* CENTER PANEL: Main Views (Light) */}
          <ResizablePanel defaultSize={55} className="flex flex-col bg-white">
            <div className="flex-grow relative overflow-hidden">
              {activeView === "gantt" && <GanttView projectId={projectId} onSelectTask={setSelectedTaskId} selectedTaskId={selectedTaskId} />}
              {activeView === "kanban" && <KanbanView projectId={projectId} onSelectTask={setSelectedTaskId} selectedTaskId={selectedTaskId} />}
              {activeView === "network" && <NetworkView projectId={projectId} onSelectTask={setSelectedTaskId} selectedTaskId={selectedTaskId} />}
            </div>
          </ResizablePanel>

          <ResizableHandle withHandle className="bg-slate-300 hover:bg-blue-400 data-[resize-handle-state=drag]:bg-blue-500 w-1.5 transition-colors" />

          {/* RIGHT PANEL: Inspector / AI / Validation (Light) */}
          <ResizablePanel defaultSize={23} minSize={20} maxSize={40} className="bg-slate-50 border-l border-slate-200 flex flex-col">
            <Tabs value={rightPanelTab} onValueChange={setRightPanelTab} className="flex flex-col h-full">
              <div className="px-4 py-2 border-b border-slate-200 bg-white">
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="inspector" className="text-xs">Inspector</TabsTrigger>
                  <TabsTrigger value="ai" className="text-xs relative">
                    AI Insights
                    {/* Badge could go here */}
                  </TabsTrigger>
                  <TabsTrigger value="validation" className="text-xs">Validation</TabsTrigger>
                </TabsList>
              </div>
              
              <div className="flex-grow overflow-y-auto">
                <TabsContent value="inspector" className="m-0 h-full p-0">
                  <InspectorPanel projectId={projectId} taskId={selectedTaskId} />
                </TabsContent>
                <TabsContent value="ai" className="m-0 h-full p-0">
                  <AiSuggestionsPanel projectId={projectId} />
                </TabsContent>
                <TabsContent value="validation" className="m-0 h-full p-0">
                  <ValidationPanel projectId={projectId} onSelectTask={setSelectedTaskId} />
                </TabsContent>
              </div>
            </Tabs>
          </ResizablePanel>

        </ResizablePanelGroup>
      </div>
    </div>
  );
}
