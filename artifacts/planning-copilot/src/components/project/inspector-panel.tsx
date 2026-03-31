import { useEffect, useState } from "react";
import { 
  useGetTask, 
  useUpdateTask, 
  useDeleteTask,
  useGetDependencies,
  useCreateDependency,
  useDeleteDependency
} from "@workspace/api-client-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Save, Trash2, CalendarIcon, Link as LinkIcon, Plus, X } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function InspectorPanel({ projectId, taskId }: { projectId: number, taskId: number | null }) {
  const queryClient = useQueryClient();
  const [localData, setLocalData] = useState<any>(null);
  const [activeTab, setActiveTab] = useState("details");
  const [newDepTask, setNewDepTask] = useState("");
  const [newDepType, setNewDepType] = useState<"FS"|"SS"|"FF"|"SF">("FS");

  const { data: task, isLoading } = useGetTask(taskId || 0, {
    query: {
      enabled: !!taskId,
      queryKey: [`/api/tasks/${taskId}`]
    }
  });

  const { data: dependencies = [] } = useGetDependencies(projectId, {
    query: {
      enabled: !!projectId,
      queryKey: [`/api/projects/${projectId}/dependencies`]
    }
  });

  const updateTask = useUpdateTask();
  const deleteTask = useDeleteTask();
  const createDep = useCreateDependency();
  const deleteDep = useDeleteDependency();

  useEffect(() => {
    if (task) {
      setLocalData({ ...task });
    } else {
      setLocalData(null);
    }
  }, [task]);

  if (!taskId) {
    return (
      <div className="h-full w-full flex flex-col items-center justify-center text-slate-400 bg-slate-50 p-6 text-center">
        <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mb-4">
          <CalendarIcon className="h-6 w-6 text-slate-300" />
        </div>
        <p className="text-sm">Select a task in the schedule view to inspect and edit its details.</p>
      </div>
    );
  }

  if (isLoading || !localData) {
    return (
      <div className="flex justify-center p-8">
        <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
      </div>
    );
  }

  const handleChange = (field: string, value: any) => {
    setLocalData((prev: any) => ({ ...prev, [field]: value }));
  };

  const handleSave = () => {
    updateTask.mutate(
      { 
        taskId: taskId,
        data: {
          name: localData.name,
          duration: parseInt(localData.duration, 10),
          startDate: localData.startDate,
          endDate: localData.endDate,
          discipline: localData.discipline,
          area: localData.area,
          status: localData.status,
          isMilestone: localData.isMilestone,
          notes: localData.notes
        }
      } as any,
      {
        onSuccess: () => {
          toast.success("Task updated");
          queryClient.invalidateQueries({ queryKey: [`/api/projects/${projectId}/tasks`] });
          queryClient.invalidateQueries({ queryKey: [`/api/tasks/${taskId}`] });
        }
      }
    );
  };

  const handleDelete = () => {
    if (confirm("Are you sure you want to delete this task?")) {
      deleteTask.mutate(
        { taskId },
        {
          onSuccess: () => {
            toast.success("Task deleted");
            queryClient.invalidateQueries({ queryKey: [`/api/projects/${projectId}/tasks`] });
          }
        }
      );
    }
  };

  const handleAddDependency = () => {
    const succId = parseInt(newDepTask, 10);
    if (isNaN(succId)) return;
    
    createDep.mutate(
      { projectId, data: { predecessorTaskId: taskId, successorTaskId: succId, relationshipType: newDepType, lagValue: 0, lagUnit: "days" } },
      {
        onSuccess: () => {
          toast.success("Dependency added");
          queryClient.invalidateQueries({ queryKey: [`/api/projects/${projectId}/dependencies`] });
          setNewDepTask("");
        }
      }
    );
  };

  const handleDeleteDependency = (depId: number) => {
    deleteDep.mutate(
      { dependencyId: depId } as any, // might need adjustment depending on exact param name in API
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: [`/api/projects/${projectId}/dependencies`] });
        }
      }
    );
  };

  const predecessors = dependencies.filter(d => d.successorTaskId === taskId);
  const successors = dependencies.filter(d => d.predecessorTaskId === taskId);

  return (
    <div className="flex flex-col h-full bg-white font-sans">
      <div className="p-4 border-b border-slate-100 bg-slate-50 flex items-start justify-between shrink-0">
        <div>
          <div className="text-xs font-mono text-slate-500 mb-1">{localData.taskCode}</div>
          <h3 className="font-semibold text-slate-900 leading-tight pr-4">{localData.name}</h3>
        </div>
        <Badge status={localData.status} />
      </div>

      <div className="border-b border-slate-200">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="w-full h-10 bg-transparent rounded-none p-0 grid grid-cols-2">
            <TabsTrigger 
              value="details" 
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-blue-600 data-[state=active]:bg-transparent data-[state=active]:shadow-none"
            >
              Details
            </TabsTrigger>
            <TabsTrigger 
              value="links" 
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-blue-600 data-[state=active]:bg-transparent data-[state=active]:shadow-none"
            >
              Links ({predecessors.length + successors.length})
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <div className="flex-grow overflow-y-auto no-scrollbar">
        {activeTab === "details" ? (
          <div className="p-4 space-y-5">
            <div className="space-y-2">
              <Label className="text-xs text-slate-500">Task Name</Label>
              <Input 
                value={localData.name} 
                onChange={(e) => handleChange("name", e.target.value)} 
                className="h-8 text-sm"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-xs text-slate-500">Duration (Days)</Label>
                <Input 
                  type="number" 
                  value={localData.duration} 
                  onChange={(e) => handleChange("duration", e.target.value)}
                  className="h-8 text-sm font-mono"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs text-slate-500">Status</Label>
                <Select value={localData.status} onValueChange={(val) => handleChange("status", val)}>
                  <SelectTrigger className="h-8 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="not_started">Not Started</SelectItem>
                    <SelectItem value="in_progress">In Progress</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="on_hold">On Hold</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-xs text-slate-500">Start Date</Label>
                <Input 
                  type="date" 
                  value={localData.startDate?.split('T')[0] || ''} 
                  onChange={(e) => handleChange("startDate", e.target.value)}
                  className="h-8 text-sm font-mono"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs text-slate-500">End Date</Label>
                <Input 
                  type="date" 
                  value={localData.endDate?.split('T')[0] || ''} 
                  onChange={(e) => handleChange("endDate", e.target.value)}
                  className="h-8 text-sm font-mono"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-xs text-slate-500">Discipline</Label>
                <Select value={localData.discipline || "none"} onValueChange={(val) => handleChange("discipline", val === "none" ? null : val)}>
                  <SelectTrigger className="h-8 text-sm">
                    <SelectValue placeholder="Select..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    <SelectItem value="Civil">Civil</SelectItem>
                    <SelectItem value="Mechanical">Mechanical</SelectItem>
                    <SelectItem value="Electrical">Electrical</SelectItem>
                    <SelectItem value="Piping">Piping</SelectItem>
                    <SelectItem value="Instrumentation">Instrumentation</SelectItem>
                    <SelectItem value="Commissioning">Commissioning</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-xs text-slate-500">Area/Zone</Label>
                <Input 
                  value={localData.area || ''} 
                  onChange={(e) => handleChange("area", e.target.value)}
                  className="h-8 text-sm"
                  placeholder="e.g. Unit 01"
                />
              </div>
            </div>

            <div className="flex items-center justify-between p-3 border border-slate-100 rounded-md bg-slate-50/50">
              <div className="space-y-0.5">
                <Label className="text-sm font-medium">Milestone</Label>
                <p className="text-xs text-slate-500">Mark as a key project milestone</p>
              </div>
              <Switch 
                checked={localData.isMilestone} 
                onCheckedChange={(val) => handleChange("isMilestone", val)} 
              />
            </div>

            <div className="space-y-2 border-t border-slate-100 pt-4">
              <Label className="text-xs text-slate-500">Notes & Constraints</Label>
              <Textarea 
                value={localData.notes || ''} 
                onChange={(e) => handleChange("notes", e.target.value)}
                className="text-sm min-h-[100px] resize-none"
                placeholder="Add engineering notes or execution constraints..."
              />
            </div>
          </div>
        ) : (
          <div className="p-4 space-y-6">
            <div className="space-y-3">
              <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                <LinkIcon className="h-3.5 w-3.5" /> Predecessors
              </h4>
              {predecessors.length === 0 ? (
                <p className="text-sm text-slate-400 italic">No predecessors</p>
              ) : (
                <div className="space-y-2">
                  {predecessors.map(dep => (
                    <div key={dep.id} className="flex items-center justify-between bg-slate-50 p-2 rounded border border-slate-100 text-sm">
                      <div>
                        <span className="font-mono text-xs text-slate-500 mr-2">#{dep.predecessorTaskId}</span>
                        <Badge variant="outline" className="text-[10px] py-0 px-1 font-mono mr-2">{dep.relationshipType}</Badge>
                      </div>
                      <Button variant="ghost" size="icon" className="h-6 w-6 text-slate-400 hover:text-red-500" onClick={() => handleDeleteDependency(dep.id)}>
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-3 pt-4 border-t border-slate-100">
              <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                <LinkIcon className="h-3.5 w-3.5" /> Successors
              </h4>
              {successors.length === 0 ? (
                <p className="text-sm text-slate-400 italic">No successors</p>
              ) : (
                <div className="space-y-2">
                  {successors.map(dep => (
                    <div key={dep.id} className="flex items-center justify-between bg-slate-50 p-2 rounded border border-slate-100 text-sm">
                      <div>
                        <Badge variant="outline" className="text-[10px] py-0 px-1 font-mono mr-2">{dep.relationshipType}</Badge>
                        <span className="font-mono text-xs text-slate-500">#{dep.successorTaskId}</span>
                      </div>
                      <Button variant="ghost" size="icon" className="h-6 w-6 text-slate-400 hover:text-red-500" onClick={() => handleDeleteDependency(dep.id)}>
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="pt-4 border-t border-slate-100 space-y-3">
              <h4 className="text-xs font-semibold text-slate-900">Add Successor Link</h4>
              <div className="flex gap-2">
                <Input 
                  placeholder="Task ID" 
                  value={newDepTask}
                  onChange={e => setNewDepTask(e.target.value)}
                  className="h-8 w-20 text-xs font-mono"
                />
                <Select value={newDepType} onValueChange={(val: any) => setNewDepType(val)}>
                  <SelectTrigger className="h-8 w-24 text-xs font-mono">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="FS">FS</SelectItem>
                    <SelectItem value="SS">SS</SelectItem>
                    <SelectItem value="FF">FF</SelectItem>
                    <SelectItem value="SF">SF</SelectItem>
                  </SelectContent>
                </Select>
                <Button size="sm" className="h-8 flex-grow" onClick={handleAddDependency} disabled={createDep.isPending || !newDepTask}>
                  <Plus className="h-3.5 w-3.5 mr-1" /> Add
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="p-4 border-t border-slate-200 bg-white flex gap-3 shrink-0">
        <Button 
          variant="destructive" 
          size="sm" 
          className="flex-none px-3" 
          onClick={handleDelete}
          disabled={deleteTask.isPending}
        >
          {deleteTask.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
        </Button>
        <Button 
          className="flex-grow" 
          size="sm" 
          onClick={handleSave}
          disabled={updateTask.isPending}
        >
          {updateTask.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          <Save className="h-4 w-4 mr-2" />
          Save Changes
        </Button>
      </div>
    </div>
  );
}

function Badge({ status }: { status: string }) {
  const map: Record<string, { label: string, cls: string }> = {
    "not_started": { label: "Not Started", cls: "bg-slate-100 text-slate-600" },
    "in_progress": { label: "In Progress", cls: "bg-blue-100 text-blue-700" },
    "completed": { label: "Completed", cls: "bg-emerald-100 text-emerald-700" },
    "on_hold": { label: "On Hold", cls: "bg-amber-100 text-amber-700" }
  };
  const s = map[status] || map["not_started"];
  return (
    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${s.cls} whitespace-nowrap`}>
      {s.label}
    </span>
  );
}
