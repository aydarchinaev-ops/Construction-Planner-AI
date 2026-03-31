import { useState, useMemo } from "react";
import { useGetTasks, useGetDependencies, useCreateTask } from "@workspace/api-client-react";
import { Loader2, Plus } from "lucide-react";
import { parseISO, differenceInDays, addDays, min, max } from "date-fns";
import { Button } from "@/components/ui/button";
import { useQueryClient } from "@tanstack/react-query";

export default function GanttView({ projectId, selectedTaskId, onSelectTask }: { projectId: number, selectedTaskId: number | null, onSelectTask: (id: number) => void }) {
  const queryClient = useQueryClient();
  const { data: tasks = [], isLoading: tasksLoading } = useGetTasks(projectId, {
    query: {
      enabled: !!projectId,
      queryKey: [`/api/projects/${projectId}/tasks`]
    }
  });

  const { data: dependencies = [], isLoading: depsLoading } = useGetDependencies(projectId, {
    query: {
      enabled: !!projectId,
      queryKey: [`/api/projects/${projectId}/dependencies`]
    }
  });

  const createTask = useCreateTask();
  const [zoomLevel, setZoomLevel] = useState(1); // multiplier for day width

  const { projectStart, projectEnd, totalDays } = useMemo(() => {
    if (!tasks.length) return { projectStart: new Date(), projectEnd: addDays(new Date(), 30), totalDays: 30 };
    
    const startDates = tasks.map(t => t.startDate ? parseISO(t.startDate) : new Date());
    const endDates = tasks.map(t => t.endDate ? parseISO(t.endDate) : addDays(new Date(), t.duration || 1));
    
    const pStart = min(startDates);
    // add buffer
    const pEnd = addDays(max(endDates), 14);
    
    return {
      projectStart: addDays(pStart, -7), // 1 week buffer before
      projectEnd: pEnd,
      totalDays: differenceInDays(pEnd, addDays(pStart, -7))
    };
  }, [tasks]);

  const handleCreateTask = () => {
    createTask.mutate(
      { 
        projectId,
        data: { 
          name: "New Activity", 
          duration: 5, 
          durationUnit: "days", 
          type: "task",
          isMilestone: false
        } 
      },
      {
        onSuccess: (newTask) => {
          queryClient.invalidateQueries({ queryKey: [`/api/projects/${projectId}/tasks`] });
          onSelectTask(newTask.id);
        }
      }
    );
  };

  if (tasksLoading || depsLoading) {
    return (
      <div className="h-full w-full flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
      </div>
    );
  }

  const DAY_WIDTH = 12 * zoomLevel;
  const ROW_HEIGHT = 36;
  const HEADER_HEIGHT = 40;
  const LEFT_PANEL_WIDTH = 350;

  const sortedTasks = [...tasks].sort((a, b) => a.sortOrder - b.sortOrder);

  // Group by discipline for colors
  const disciplineColors: Record<string, string> = {
    "Civil": "bg-amber-500",
    "Mechanical": "bg-blue-500",
    "Piping": "bg-indigo-500",
    "Electrical": "bg-yellow-500",
    "Instrumentation": "bg-red-500",
    "Commissioning": "bg-emerald-500"
  };

  return (
    <div className="flex h-full w-full bg-white relative font-sans text-sm">
      {/* Zoom controls floating */}
      <div className="absolute top-2 right-4 z-20 flex bg-white border border-slate-200 shadow-sm rounded-md overflow-hidden">
        <button className="px-3 py-1 hover:bg-slate-100 text-slate-600 border-r border-slate-200 text-xs font-medium" onClick={() => setZoomLevel(z => Math.max(0.5, z - 0.5))}>-</button>
        <div className="px-3 py-1 text-xs font-mono text-slate-600 flex items-center bg-slate-50">{Math.round(zoomLevel * 100)}%</div>
        <button className="px-3 py-1 hover:bg-slate-100 text-slate-600 text-xs font-medium" onClick={() => setZoomLevel(z => Math.min(3, z + 0.5))}>+</button>
      </div>

      {/* Left Data Grid */}
      <div className="flex flex-col border-r border-slate-200 z-10 bg-white" style={{ width: LEFT_PANEL_WIDTH, minWidth: LEFT_PANEL_WIDTH }}>
        <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 font-semibold text-slate-700 px-3 shrink-0" style={{ height: HEADER_HEIGHT }}>
          <div className="flex w-full">
            <div className="w-20 shrink-0">Code</div>
            <div className="flex-grow truncate">Activity Name</div>
            <div className="w-16 shrink-0 text-right">Dur.</div>
          </div>
        </div>
        <div className="flex-grow overflow-y-auto no-scrollbar pb-10">
          {tasks.length === 0 && (
            <div className="p-4 text-center text-slate-500 text-sm italic">
              No tasks. Generate via chat or add manually.
            </div>
          )}
          {sortedTasks.map(task => (
            <div 
              key={task.id}
              className={`flex items-center border-b border-slate-100 px-3 cursor-pointer group ${selectedTaskId === task.id ? 'bg-blue-50' : 'hover:bg-slate-50'}`}
              style={{ height: ROW_HEIGHT }}
              onClick={() => onSelectTask(task.id)}
            >
              <div className="w-20 shrink-0 font-mono text-[10px] text-slate-500">{task.taskCode}</div>
              <div className={`flex-grow truncate ${task.type === 'summary' ? 'font-bold' : ''} ${task.isMilestone ? 'italic' : ''}`}>
                {task.name}
              </div>
              <div className="w-16 shrink-0 text-right text-slate-500 font-mono text-xs">{task.duration}d</div>
            </div>
          ))}
          <div className="p-2">
            <Button 
              variant="ghost" 
              size="sm" 
              className="w-full justify-start text-blue-600 hover:text-blue-700 hover:bg-blue-50 h-8"
              onClick={handleCreateTask}
              disabled={createTask.isPending}
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Task
            </Button>
          </div>
        </div>
      </div>

      {/* Timeline Grid */}
      <div className="flex-grow overflow-auto relative bg-white" style={{ backgroundImage: `linear-gradient(to right, #f1f5f9 1px, transparent 1px)`, backgroundSize: `${DAY_WIDTH}px 100%` }}>
        {/* Timeline Header */}
        <div className="sticky top-0 z-10 bg-slate-50 border-b border-slate-200 flex" style={{ width: totalDays * DAY_WIDTH, height: HEADER_HEIGHT }}>
          {/* Simple header: just ticks every week */}
          {Array.from({ length: Math.ceil(totalDays / 7) }).map((_, i) => (
            <div key={i} className="border-l border-slate-300 px-1 text-[10px] text-slate-500 pt-1 shrink-0" style={{ width: DAY_WIDTH * 7 }}>
              {addDays(projectStart, i * 7).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
            </div>
          ))}
        </div>

        {/* Timeline Body */}
        <div className="relative" style={{ width: totalDays * DAY_WIDTH, height: Math.max(sortedTasks.length * ROW_HEIGHT, 500) }}>
          {sortedTasks.map((task, index) => {
            const start = task.startDate ? parseISO(task.startDate) : projectStart;
            const end = task.endDate ? parseISO(task.endDate) : addDays(start, task.duration || 1);
            
            const leftOffset = differenceInDays(start, projectStart) * DAY_WIDTH;
            const width = Math.max(differenceInDays(end, start) * DAY_WIDTH, DAY_WIDTH);
            const topOffset = index * ROW_HEIGHT + (ROW_HEIGHT - 16) / 2;

            const isSelected = selectedTaskId === task.id;
            const colorClass = task.discipline ? (disciplineColors[task.discipline] || "bg-blue-500") : "bg-slate-500";

            if (task.isMilestone) {
              return (
                <div 
                  key={task.id}
                  className={`absolute w-4 h-4 rotate-45 transform origin-center cursor-pointer shadow-sm ${isSelected ? 'ring-2 ring-offset-1 ring-blue-600 bg-indigo-600' : 'bg-indigo-500 hover:bg-indigo-400'}`}
                  style={{ left: leftOffset - 8, top: topOffset }}
                  onClick={() => onSelectTask(task.id)}
                  title={`${task.name} (${task.startDate})`}
                />
              );
            }

            if (task.type === "summary") {
              return (
                <div 
                  key={task.id}
                  className="absolute h-2 bg-slate-800 rounded-sm cursor-pointer shadow-sm"
                  style={{ left: leftOffset, top: topOffset + 4, width }}
                  onClick={() => onSelectTask(task.id)}
                >
                  <div className="absolute -left-1 -bottom-2 w-0 h-0 border-l-[4px] border-l-transparent border-r-[4px] border-r-transparent border-t-[6px] border-t-slate-800" />
                  <div className="absolute -right-1 -bottom-2 w-0 h-0 border-l-[4px] border-l-transparent border-r-[4px] border-r-transparent border-t-[6px] border-t-slate-800" />
                </div>
              );
            }

            return (
              <div 
                key={task.id}
                className={`absolute h-4 rounded-sm cursor-pointer shadow-sm transition-all ${colorClass} ${isSelected ? 'ring-2 ring-offset-1 ring-blue-600 opacity-100' : 'opacity-80 hover:opacity-100'}`}
                style={{ left: leftOffset, top: topOffset, width }}
                onClick={() => onSelectTask(task.id)}
                title={`${task.name}\n${task.startDate} to ${task.endDate}`}
              >
                {/* Progress bar overlay if we had percentComplete, mocking a subtle internal gradient for texture */}
                {task.percentComplete > 0 && (
                  <div className="absolute top-0 left-0 bottom-0 bg-black/20 rounded-sm" style={{ width: `${task.percentComplete}%` }} />
                )}
              </div>
            );
          })}

          {/* Simple dependency lines (SVG overlay) */}
          <svg className="absolute top-0 left-0 w-full h-full pointer-events-none" style={{ zIndex: 0 }}>
            {dependencies.map(dep => {
              const predIndex = sortedTasks.findIndex(t => t.id === dep.predecessorTaskId);
              const succIndex = sortedTasks.findIndex(t => t.id === dep.successorTaskId);
              if (predIndex === -1 || succIndex === -1) return null;

              const pred = sortedTasks[predIndex];
              const succ = sortedTasks[succIndex];

              const predEnd = pred.endDate ? parseISO(pred.endDate) : addDays(parseISO(pred.startDate || projectStart.toISOString()), pred.duration);
              const succStart = succ.startDate ? parseISO(succ.startDate) : projectStart;

              const x1 = differenceInDays(predEnd, projectStart) * DAY_WIDTH;
              const y1 = predIndex * ROW_HEIGHT + ROW_HEIGHT / 2;
              
              const x2 = differenceInDays(succStart, projectStart) * DAY_WIDTH;
              const y2 = succIndex * ROW_HEIGHT + ROW_HEIGHT / 2;

              // Draw a simple path. If x1 < x2, simple curve. If x1 > x2, complex path.
              // We'll just draw a simple cubic bezier for now to look nice.
              const isSelected = selectedTaskId === pred.id || selectedTaskId === succ.id;
              
              return (
                <path 
                  key={dep.id}
                  d={`M ${x1} ${y1} C ${x1 + 15} ${y1}, ${x2 - 15} ${y2}, ${x2} ${y2}`}
                  fill="none"
                  stroke={isSelected ? "#3b82f6" : "#cbd5e1"}
                  strokeWidth={isSelected ? 2 : 1}
                  markerEnd="url(#arrowhead)"
                  className="transition-colors"
                />
              );
            })}
            <defs>
              <marker id="arrowhead" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
                <polygon points="0 0, 6 3, 0 6" fill="#94a3b8" />
              </marker>
            </defs>
          </svg>

        </div>
      </div>
    </div>
  );
}
