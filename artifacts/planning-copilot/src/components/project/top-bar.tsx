import { useState } from "react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  useGetProjectSummary, 
  useExportP6Xml,
  useGetScheduleVersions,
  useCreateScheduleVersion,
  useUpdateProject,
  useGetWbsNodes,
  useCreateWbsNode
} from "@workspace/api-client-react";
import { 
  LayoutList, KanbanSquare, Network, Download, ArrowLeft, 
  Activity, Layers, Link as LinkIcon, CheckCircle2,
  Settings, History, Plus, Loader2
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useQueryClient } from "@tanstack/react-query";

export default function TopBar({ project, activeView }: { project: any, activeView: string }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  const { data: summary } = useGetProjectSummary(project.id, {
    query: {
      enabled: !!project.id,
      queryKey: [`/api/projects/${project.id}/summary`]
    }
  });

  const { data: versions = [] } = useGetScheduleVersions(project.id, {
    query: {
      enabled: !!project.id,
      queryKey: [`/api/projects/${project.id}/versions`]
    }
  });

  const { data: wbsNodes = [] } = useGetWbsNodes(project.id, {
    query: {
      enabled: !!project.id,
      queryKey: [`/api/projects/${project.id}/wbs`]
    }
  });

  const exportXml = useExportP6Xml();
  const createVersion = useCreateScheduleVersion();
  const updateProject = useUpdateProject();
  const createWbsNode = useCreateWbsNode();

  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [versionName, setVersionName] = useState("");
  const [isVersionOpen, setIsVersionOpen] = useState(false);
  
  const [newWbsCode, setNewWbsCode] = useState("");
  const [newWbsName, setNewWbsName] = useState("");

  const handleExport = () => {
    exportXml.mutate(
      { data: { projectId: project.id } },
      {
        onSuccess: (res) => {
          const blob = new Blob([res.content], { type: 'text/xml' });
          const url = window.URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = res.filename;
          a.click();
          toast({
            title: "Export Successful",
            description: `Downloaded ${res.filename}`,
          });
        }
      }
    );
  };

  const handleCreateVersion = (e: React.FormEvent) => {
    e.preventDefault();
    if (!versionName) return;
    
    createVersion.mutate(
      { projectId: project.id, data: { name: versionName } },
      {
        onSuccess: () => {
          toast({ title: "Version Created", description: `Saved as ${versionName}` });
          queryClient.invalidateQueries({ queryKey: [`/api/projects/${project.id}/versions`] });
          setIsVersionOpen(false);
          setVersionName("");
        }
      }
    );
  };

  const handleCreateWbs = () => {
    if (!newWbsCode || !newWbsName) return;
    createWbsNode.mutate(
      { projectId: project.id, data: { code: newWbsCode, name: newWbsName, level: 1 } },
      {
        onSuccess: () => {
          toast({ title: "WBS Node Created" });
          queryClient.invalidateQueries({ queryKey: [`/api/projects/${project.id}/wbs`] });
          setNewWbsCode("");
          setNewWbsName("");
        }
      }
    );
  };

  const handleStatusChange = (status: "draft" | "active" | "on_hold" | "completed") => {
    updateProject.mutate(
      { projectId: project.id, data: { status } },
      {
        onSuccess: () => {
          toast({ title: "Project status updated" });
          queryClient.invalidateQueries({ queryKey: [`/api/projects/${project.id}`] });
        }
      }
    );
  };

  return (
    <header className="h-14 min-h-[56px] bg-slate-900 border-b border-slate-800 text-slate-200 px-4 flex items-center justify-between">
      <div className="flex items-center gap-4">
        <Link href="/">
          <Button variant="ghost" size="icon" className="text-slate-400 hover:text-white hover:bg-slate-800 rounded-md">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div className="flex flex-col">
          <div className="flex items-center gap-2">
            <h1 className="font-semibold text-slate-100 text-sm">{project.name}</h1>
            <Badge variant="outline" className={`text-[10px] h-4 py-0 px-1.5 border-slate-700 bg-slate-800/50 ${project.status === 'active' ? 'text-emerald-400' : 'text-slate-400'}`}>
              {project.status.toUpperCase()}
            </Badge>
          </div>
          <div className="text-[11px] text-slate-500 font-mono tracking-wider">
            {project.projectType} • {project.industry}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-1 bg-slate-800/50 p-1 rounded-lg border border-slate-700/50">
        <Link href={`/projects/${project.id}/gantt`}>
          <Button variant={activeView === "gantt" ? "secondary" : "ghost"} size="sm" className={`h-8 px-3 text-xs ${activeView === 'gantt' ? 'bg-blue-600 text-white hover:bg-blue-700' : 'text-slate-400 hover:text-slate-200'}`}>
            <LayoutList className="h-3.5 w-3.5 mr-2" />
            Gantt
          </Button>
        </Link>
        <Link href={`/projects/${project.id}/kanban`}>
          <Button variant={activeView === "kanban" ? "secondary" : "ghost"} size="sm" className={`h-8 px-3 text-xs ${activeView === 'kanban' ? 'bg-blue-600 text-white hover:bg-blue-700' : 'text-slate-400 hover:text-slate-200'}`}>
            <KanbanSquare className="h-3.5 w-3.5 mr-2" />
            Kanban
          </Button>
        </Link>
        <Link href={`/projects/${project.id}/network`}>
          <Button variant={activeView === "network" ? "secondary" : "ghost"} size="sm" className={`h-8 px-3 text-xs ${activeView === 'network' ? 'bg-blue-600 text-white hover:bg-blue-700' : 'text-slate-400 hover:text-slate-200'}`}>
            <Network className="h-3.5 w-3.5 mr-2" />
            Network
          </Button>
        </Link>
      </div>

      <div className="flex items-center gap-4 text-xs text-slate-400">
        {summary && (
          <div className="hidden lg:flex items-center gap-4 mr-2 bg-slate-800/50 rounded-md px-3 py-1.5 border border-slate-700/50">
            <div className="flex items-center gap-1.5" title="Total Tasks">
              <Layers className="h-3.5 w-3.5 text-blue-400" />
              <span className="font-mono">{summary.totalTasks}</span>
            </div>
            <div className="w-px h-3 bg-slate-700"></div>
            <div className="flex items-center gap-1.5" title="Dependencies">
              <LinkIcon className="h-3.5 w-3.5 text-amber-500" />
              <span className="font-mono">{summary.totalDependencies}</span>
            </div>
            <div className="w-px h-3 bg-slate-700"></div>
            <div className="flex items-center gap-1.5" title="Completion">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
              <span className="font-mono">{summary.completionPercentage.toFixed(0)}%</span>
            </div>
            <div className="w-px h-3 bg-slate-700"></div>
            <div className="flex items-center gap-1.5" title="Critical Path Length">
              <Activity className="h-3.5 w-3.5 text-red-400" />
              <span className="font-mono">{summary.criticalPathLength}d</span>
            </div>
          </div>
        )}

        <Dialog open={isVersionOpen} onOpenChange={setIsVersionOpen}>
          <DialogTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-300 hover:bg-slate-800 hover:text-white" title="Schedule Versions">
              <History className="h-4 w-4" />
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[400px]">
            <DialogHeader>
              <DialogTitle>Schedule Baselines & Versions</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="flex gap-2">
                <Input placeholder="Version Name (e.g. Baseline 1)" value={versionName} onChange={e => setVersionName(e.target.value)} />
                <Button onClick={handleCreateVersion} disabled={createVersion.isPending}>
                  {createVersion.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
                </Button>
              </div>
              <div className="space-y-2 max-h-[200px] overflow-y-auto">
                {versions.length === 0 ? (
                  <p className="text-sm text-slate-500 text-center py-4">No saved versions yet.</p>
                ) : (
                  versions.map(v => (
                    <div key={v.id} className="flex justify-between items-center text-sm p-2 border rounded-md">
                      <div>
                        <span className="font-semibold text-slate-900">{v.name}</span>
                        <span className="text-xs text-slate-500 ml-2">v{v.versionNumber}</span>
                      </div>
                      <span className="text-xs text-slate-400">{new Date(v.createdAt).toLocaleDateString()}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
          <DialogTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-300 hover:bg-slate-800 hover:text-white" title="Project Settings">
              <Settings className="h-4 w-4" />
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[600px]">
            <DialogHeader>
              <DialogTitle>Project Settings</DialogTitle>
            </DialogHeader>
            <div className="space-y-6 py-4">
              
              <div className="space-y-3">
                <h4 className="text-sm font-semibold">Status Management</h4>
                <div className="flex gap-2">
                  <Button variant={project.status === 'draft' ? 'default' : 'outline'} size="sm" onClick={() => handleStatusChange('draft')}>Draft</Button>
                  <Button variant={project.status === 'active' ? 'default' : 'outline'} size="sm" onClick={() => handleStatusChange('active')}>Active</Button>
                  <Button variant={project.status === 'on_hold' ? 'default' : 'outline'} size="sm" onClick={() => handleStatusChange('on_hold')}>On Hold</Button>
                  <Button variant={project.status === 'completed' ? 'default' : 'outline'} size="sm" onClick={() => handleStatusChange('completed')}>Completed</Button>
                </div>
              </div>

              <div className="space-y-3">
                <h4 className="text-sm font-semibold">Work Breakdown Structure (WBS)</h4>
                <div className="flex gap-2">
                  <Input placeholder="WBS Code (e.g. ENG)" value={newWbsCode} onChange={e => setNewWbsCode(e.target.value)} className="w-1/3" />
                  <Input placeholder="WBS Name (e.g. Engineering)" value={newWbsName} onChange={e => setNewWbsName(e.target.value)} className="flex-grow" />
                  <Button onClick={handleCreateWbs} disabled={createWbsNode.isPending}><Plus className="h-4 w-4" /></Button>
                </div>
                <div className="space-y-1 max-h-[150px] overflow-y-auto mt-2">
                  {wbsNodes.map(node => (
                    <div key={node.id} className="text-sm py-1 border-b text-slate-600 flex justify-between">
                      <span><span className="font-mono text-slate-900 mr-2">{node.code}</span> {node.name}</span>
                      <span className="text-xs text-slate-400">Level {node.level}</span>
                    </div>
                  ))}
                </div>
              </div>

            </div>
          </DialogContent>
        </Dialog>

        <Button 
          variant="outline" 
          size="sm" 
          className="h-8 border-slate-700 text-slate-300 hover:bg-slate-800 hover:text-white ml-2"
          onClick={handleExport}
          disabled={exportXml.isPending}
        >
          {exportXml.isPending ? <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" /> : <Download className="h-3.5 w-3.5 mr-2" />}
          Export P6
        </Button>
      </div>
    </header>
  );
}
