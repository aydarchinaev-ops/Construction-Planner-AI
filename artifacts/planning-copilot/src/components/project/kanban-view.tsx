import { useState } from "react";
import { useGetTasks, useUpdateTask } from "@workspace/api-client-react";
import { Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useQueryClient } from "@tanstack/react-query";

const STATUS_COLUMNS = [
  { id: "not_started", label: "Not Started", color: "bg-slate-100 border-slate-200 text-slate-700" },
  { id: "in_progress", label: "In Progress", color: "bg-blue-50 border-blue-200 text-blue-700" },
  { id: "on_hold", label: "On Hold", color: "bg-amber-50 border-amber-200 text-amber-700" },
  { id: "completed", label: "Completed", color: "bg-emerald-50 border-emerald-200 text-emerald-700" }
];

export default function KanbanView({ projectId, selectedTaskId, onSelectTask }: { projectId: number, selectedTaskId: number | null, onSelectTask: (id: number) => void }) {
  const queryClient = useQueryClient();
  const { data: tasks = [], isLoading } = useGetTasks(projectId, {
    query: {
      enabled: !!projectId,
      queryKey: [`/api/projects/${projectId}/tasks`]
    }
  });

  const updateTask = useUpdateTask();

  const handleDragStart = (e: React.DragEvent, taskId: number) => {
    e.dataTransfer.setData("taskId", taskId.toString());
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault(); // Necessary to allow dropping
  };

  const handleDrop = (e: React.DragEvent, statusId: string) => {
    e.preventDefault();
    const taskIdStr = e.dataTransfer.getData("taskId");
    if (!taskIdStr) return;
    
    const taskId = parseInt(taskIdStr, 10);
    const task = tasks.find(t => t.id === taskId);
    
    if (task && task.status !== statusId) {
      // Optimistic update could go here
      updateTask.mutate(
        { projectId, taskId, data: { status: statusId as any } },
        {
          onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: [`/api/projects/${projectId}/tasks`] });
            queryClient.invalidateQueries({ queryKey: [`/api/projects/${projectId}/summary`] });
          }
        }
      );
    }
  };

  if (isLoading) {
    return (
      <div className="h-full w-full flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
      </div>
    );
  }

  // Filter out summaries for kanban board usually
  const boardTasks = tasks.filter(t => t.type !== "summary");

  return (
    <div className="h-full w-full p-6 bg-slate-50/50 overflow-x-auto">
      <div className="flex gap-6 h-full min-w-max pb-4">
        {STATUS_COLUMNS.map(col => {
          const colTasks = boardTasks.filter(t => t.status === col.id);
          
          return (
            <div 
              key={col.id} 
              className={`w-80 flex flex-col rounded-xl border ${col.color} bg-opacity-50`}
              onDragOver={handleDragOver}
              onDrop={(e) => handleDrop(e, col.id)}
            >
              <div className="px-4 py-3 border-b border-inherit bg-white/50 backdrop-blur-sm rounded-t-xl flex justify-between items-center shrink-0">
                <h3 className="font-semibold text-sm">{col.label}</h3>
                <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-black/5 text-inherit">
                  {colTasks.length}
                </span>
              </div>
              
              <div className="flex-grow p-3 space-y-3 overflow-y-auto min-h-[100px]">
                {colTasks.map(task => (
                  <div
                    key={task.id}
                    draggable
                    onDragStart={(e) => handleDragStart(e, task.id)}
                    onClick={() => onSelectTask(task.id)}
                    className={`bg-white border rounded-lg p-3 shadow-sm cursor-grab active:cursor-grabbing hover:border-blue-300 transition-colors ${selectedTaskId === task.id ? 'ring-2 ring-blue-500 border-transparent' : 'border-slate-200'}`}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <span className="text-[10px] font-mono text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">{task.taskCode}</span>
                      {task.isMilestone && <Badge variant="outline" className="text-[10px] h-4 py-0 border-indigo-200 text-indigo-700 bg-indigo-50">Milestone</Badge>}
                    </div>
                    <h4 className="text-sm font-medium text-slate-900 leading-snug mb-3">{task.name}</h4>
                    <div className="flex items-center justify-between text-xs mt-auto pt-3 border-t border-slate-100">
                      <div className="flex gap-1.5">
                        {task.discipline && (
                          <span className="text-slate-600 truncate max-w-[80px]">{task.discipline}</span>
                        )}
                      </div>
                      <span className="font-mono text-slate-500 font-medium">{task.duration}d</span>
                    </div>
                  </div>
                ))}
                
                {colTasks.length === 0 && (
                  <div className="h-full flex items-center justify-center text-xs text-slate-400 font-medium italic p-4 border-2 border-dashed border-slate-200 rounded-lg">
                    Drop tasks here
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
