import { useState, useMemo } from "react";
import { useGetTasks, useGetDependencies, useGetWbsNodes, useCreateTask } from "@workspace/api-client-react";
import { Loader2, Plus, ChevronDown, ChevronRight } from "lucide-react";
import { parseISO, differenceInDays, addDays, min, max } from "date-fns";
import { Button } from "@/components/ui/button";
import { useQueryClient } from "@tanstack/react-query";

const WBS_COLORS: Record<string, { bar: string; header: string; text: string }> = {
  "1": { bar: "bg-slate-500",   header: "bg-slate-800/90",  text: "text-slate-200" },
  "2": { bar: "bg-blue-500",    header: "bg-blue-900/80",   text: "text-blue-100"  },
  "3": { bar: "bg-amber-500",   header: "bg-amber-900/80",  text: "text-amber-100" },
  "4": { bar: "bg-emerald-500", header: "bg-emerald-900/80",text: "text-emerald-100"},
  "5": { bar: "bg-purple-500",  header: "bg-purple-900/80", text: "text-purple-100" },
};

const DISCIPLINE_COLORS: Record<string, string> = {
  "PM":             "bg-slate-500",
  "Civil":          "bg-amber-500",
  "Structural":     "bg-orange-500",
  "Mechanical":     "bg-blue-500",
  "Piping":         "bg-indigo-500",
  "E&I":            "bg-yellow-500",
  "Electrical":     "bg-yellow-500",
  "Instrumentation":"bg-red-500",
  "Commissioning":  "bg-emerald-500",
  "Procurement":    "bg-purple-500",
  "Engineering":    "bg-sky-500",
};

type Row =
  | { kind: "wbs"; wbsId: number | null; code: string; name: string; count: number; collapsed: boolean }
  | { kind: "task"; task: any; wbsCode: string };

export default function GanttView({ projectId, selectedTaskId, onSelectTask }: {
  projectId: number;
  selectedTaskId: number | null;
  onSelectTask: (id: number) => void;
}) {
  const queryClient = useQueryClient();

  const { data: tasks = [], isLoading: tasksLoading } = useGetTasks(projectId, {
    query: { enabled: !!projectId, queryKey: [`/api/projects/${projectId}/tasks`] }
  });
  const { data: dependencies = [], isLoading: depsLoading } = useGetDependencies(projectId, {
    query: { enabled: !!projectId, queryKey: [`/api/projects/${projectId}/dependencies`] }
  });
  const { data: wbsNodes = [], isLoading: wbsLoading } = useGetWbsNodes(projectId, {
    query: { enabled: !!projectId, queryKey: [`/api/projects/${projectId}/wbs`] }
  });

  const createTask = useCreateTask();
  const [zoomLevel, setZoomLevel] = useState(1);
  const [collapsed, setCollapsed] = useState<Record<number | string, boolean>>({});

  const wbsById = useMemo(() =>
    Object.fromEntries(wbsNodes.map(w => [w.id, w])), [wbsNodes]);

  const { projectStart, totalDays } = useMemo(() => {
    if (!tasks.length) return { projectStart: new Date(), totalDays: 30 };
    const startDates = tasks.map(t => t.startDate ? parseISO(t.startDate) : new Date());
    const endDates   = tasks.map(t => t.endDate   ? parseISO(t.endDate)   : addDays(new Date(), t.duration || 1));
    const pStart = min(startDates);
    const pEnd   = addDays(max(endDates), 14);
    return { projectStart: addDays(pStart, -7), totalDays: differenceInDays(pEnd, addDays(pStart, -7)) };
  }, [tasks]);

  const rows: Row[] = useMemo(() => {
    const sorted = [...tasks].sort((a, b) => a.sortOrder - b.sortOrder);
    if (!wbsNodes.length) {
      return sorted.map(t => ({ kind: "task", task: t, wbsCode: "1" }));
    }

    const result: Row[] = [];
    let lastWbsId: number | null | undefined = undefined;

    for (const task of sorted) {
      const wbsId = task.wbsNodeId ?? null;
      if (wbsId !== lastWbsId) {
        lastWbsId = wbsId;
        const wbs = wbsId !== null ? wbsById[wbsId] : null;
        const sibling = sorted.filter(t => (t.wbsNodeId ?? null) === wbsId);
        result.push({
          kind: "wbs",
          wbsId,
          code: wbs?.code ?? "—",
          name: wbs?.name ?? "Uncategorised",
          count: sibling.length,
          collapsed: false,
        });
      }
      const wbs = wbsId !== null ? wbsById[wbsId] : null;
      result.push({ kind: "task", task, wbsCode: wbs?.code ?? "1" });
    }
    return result;
  }, [tasks, wbsNodes, wbsById]);

  const visibleRows = useMemo(() => {
    const result: Row[] = [];
    let skip: number | null | "none" = null;
    for (const row of rows) {
      if (row.kind === "wbs") {
        skip = collapsed[row.wbsId ?? "none"] ? (row.wbsId ?? "none") : null;
        result.push(row);
      } else {
        const wbsKey = row.task.wbsNodeId ?? "none";
        if (skip === wbsKey) continue;
        result.push(row);
      }
    }
    return result;
  }, [rows, collapsed]);

  const toggleWbs = (id: number | null) => {
    const key = id ?? "none";
    setCollapsed(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const handleCreateTask = () => {
    createTask.mutate(
      { projectId, data: { name: "New Activity", duration: 5, durationUnit: "days", type: "task", isMilestone: false } },
      { onSuccess: (newTask) => { queryClient.invalidateQueries({ queryKey: [`/api/projects/${projectId}/tasks`] }); onSelectTask(newTask.id); } }
    );
  };

  if (tasksLoading || depsLoading || wbsLoading) {
    return <div className="h-full w-full flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-blue-500" /></div>;
  }

  const DAY_WIDTH    = 12 * zoomLevel;
  const ROW_HEIGHT   = 36;
  const WBS_HEIGHT   = 28;
  const HEADER_HEIGHT = 40;
  const LEFT_PANEL_WIDTH = 360;

  const sortedTasksForDeps = [...tasks].sort((a, b) => a.sortOrder - b.sortOrder);
  const taskIndexInVisible: Record<number, number> = {};
  let taskRowOffset = 0;
  visibleRows.forEach((row, i) => {
    if (row.kind === "wbs") {
      taskRowOffset += WBS_HEIGHT;
    } else {
      taskIndexInVisible[row.task.id] = taskRowOffset;
      taskRowOffset += ROW_HEIGHT;
    }
  });

  const totalContentHeight = taskRowOffset;

  return (
    <div className="flex h-full w-full bg-white relative font-sans text-sm">
      {/* Zoom controls */}
      <div className="absolute top-2 right-4 z-20 flex bg-white border border-slate-200 shadow-sm rounded-md overflow-hidden">
        <button className="px-3 py-1 hover:bg-slate-100 text-slate-600 border-r border-slate-200 text-xs font-medium" onClick={() => setZoomLevel(z => Math.max(0.5, z - 0.5))}>−</button>
        <div className="px-3 py-1 text-xs font-mono text-slate-600 flex items-center bg-slate-50">{Math.round(zoomLevel * 100)}%</div>
        <button className="px-3 py-1 hover:bg-slate-100 text-slate-600 text-xs font-medium" onClick={() => setZoomLevel(z => Math.min(3, z + 0.5))}>+</button>
      </div>

      {/* Left panel */}
      <div className="flex flex-col border-r border-slate-200 z-10 bg-white shrink-0" style={{ width: LEFT_PANEL_WIDTH }}>
        {/* Header */}
        <div className="flex items-center border-b border-slate-200 bg-slate-50 font-semibold text-slate-700 px-3 shrink-0" style={{ height: HEADER_HEIGHT }}>
          <div className="w-20 shrink-0 text-xs uppercase tracking-wider text-slate-500">Code</div>
          <div className="flex-grow text-xs uppercase tracking-wider text-slate-500">Activity Name</div>
          <div className="w-14 shrink-0 text-right text-xs uppercase tracking-wider text-slate-500">Dur.</div>
        </div>

        <div className="flex-grow overflow-y-auto no-scrollbar pb-10">
          {tasks.length === 0 && (
            <div className="p-4 text-center text-slate-500 text-sm italic">No tasks. Generate via chat or add manually.</div>
          )}

          {visibleRows.map((row, i) => {
            if (row.kind === "wbs") {
              const colors = WBS_COLORS[row.code] ?? WBS_COLORS["1"];
              const isCollapsed = collapsed[row.wbsId ?? "none"];
              return (
                <div
                  key={`wbs-${row.wbsId}`}
                  className={`flex items-center px-2 cursor-pointer select-none ${colors.header}`}
                  style={{ height: WBS_HEIGHT }}
                  onClick={() => toggleWbs(row.wbsId)}
                >
                  {isCollapsed
                    ? <ChevronRight className={`h-3.5 w-3.5 mr-1.5 shrink-0 ${colors.text}`} />
                    : <ChevronDown  className={`h-3.5 w-3.5 mr-1.5 shrink-0 ${colors.text}`} />
                  }
                  <span className={`font-mono text-[10px] mr-2 shrink-0 ${colors.text} opacity-70`}>{row.code}</span>
                  <span className={`text-xs font-semibold tracking-wide uppercase truncate ${colors.text}`}>{row.name}</span>
                  <span className={`ml-auto text-[10px] font-mono ${colors.text} opacity-60 shrink-0 pl-2`}>{row.count}</span>
                </div>
              );
            }

            const { task } = row;
            return (
              <div
                key={task.id}
                className={`flex items-center border-b border-slate-100 px-3 cursor-pointer group ${selectedTaskId === task.id ? 'bg-blue-50 border-blue-200' : 'hover:bg-slate-50'}`}
                style={{ height: ROW_HEIGHT }}
                onClick={() => onSelectTask(task.id)}
              >
                <div className="w-20 shrink-0 font-mono text-[10px] text-slate-400 pl-1">{task.taskCode}</div>
                <div className={`flex-grow truncate text-xs pl-1 ${task.type === 'summary' ? 'font-bold text-slate-800' : 'text-slate-700'} ${task.isMilestone ? 'italic text-indigo-700' : ''}`}>
                  {task.name}
                </div>
                <div className="w-14 shrink-0 text-right text-slate-400 font-mono text-[11px]">{task.duration}d</div>
              </div>
            );
          })}

          <div className="p-2">
            <Button variant="ghost" size="sm" className="w-full justify-start text-blue-600 hover:text-blue-700 hover:bg-blue-50 h-8" onClick={handleCreateTask} disabled={createTask.isPending}>
              <Plus className="h-4 w-4 mr-2" />Add Task
            </Button>
          </div>
        </div>
      </div>

      {/* Timeline */}
      <div className="flex-grow overflow-auto relative bg-white" style={{ backgroundImage: `linear-gradient(to right, #f1f5f9 1px, transparent 1px)`, backgroundSize: `${DAY_WIDTH * 7}px 100%` }}>
        {/* Header */}
        <div className="sticky top-0 z-10 bg-slate-50 border-b border-slate-200 flex" style={{ width: totalDays * DAY_WIDTH, height: HEADER_HEIGHT }}>
          {Array.from({ length: Math.ceil(totalDays / 7) }).map((_, i) => (
            <div key={i} className="border-l border-slate-300 px-1 text-[10px] text-slate-500 pt-1 shrink-0" style={{ width: DAY_WIDTH * 7 }}>
              {addDays(projectStart, i * 7).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
            </div>
          ))}
        </div>

        {/* Body */}
        <div className="relative" style={{ width: totalDays * DAY_WIDTH, height: Math.max(totalContentHeight, 500) }}>
          {/* WBS group shading bands */}
          {(() => {
            const bands: React.ReactNode[] = [];
            let yOffset = 0;
            for (const row of visibleRows) {
              if (row.kind === "wbs") {
                const colors = WBS_COLORS[row.code] ?? WBS_COLORS["1"];
                bands.push(
                  <div
                    key={`band-wbs-${row.wbsId}`}
                    className={`absolute left-0 right-0 ${colors.header} opacity-40`}
                    style={{ top: yOffset, height: WBS_HEIGHT, width: totalDays * DAY_WIDTH }}
                  />
                );
                yOffset += WBS_HEIGHT;
              } else {
                yOffset += ROW_HEIGHT;
              }
            }
            return bands;
          })()}

          {/* Task bars */}
          {visibleRows.map((row) => {
            if (row.kind === "wbs") return null;
            const { task } = row;
            const yTop = taskIndexInVisible[task.id];
            if (yTop === undefined) return null;

            const start = task.startDate ? parseISO(task.startDate) : projectStart;
            const end   = task.endDate   ? parseISO(task.endDate)   : addDays(start, task.duration || 1);
            const leftOffset = differenceInDays(start, projectStart) * DAY_WIDTH;
            const width      = Math.max(differenceInDays(end, start) * DAY_WIDTH, task.isMilestone ? 0 : DAY_WIDTH);
            const barTop     = yTop + (ROW_HEIGHT - 16) / 2;

            const isSelected = selectedTaskId === task.id;
            const colorClass = DISCIPLINE_COLORS[task.discipline ?? ""] ?? "bg-blue-400";
            const wbsColors  = WBS_COLORS[row.wbsCode] ?? WBS_COLORS["1"];

            if (task.isMilestone) {
              return (
                <div
                  key={task.id}
                  className={`absolute w-4 h-4 rotate-45 transform cursor-pointer shadow-sm ${isSelected ? 'ring-2 ring-offset-1 ring-blue-600 bg-indigo-600' : 'bg-indigo-500 hover:bg-indigo-400'}`}
                  style={{ left: leftOffset - 8, top: barTop }}
                  onClick={() => onSelectTask(task.id)}
                  title={`${task.name} (${task.startDate})`}
                />
              );
            }

            if (task.type === "summary") {
              return (
                <div key={task.id} className="absolute cursor-pointer" style={{ left: leftOffset, top: barTop + 4, width }} onClick={() => onSelectTask(task.id)}>
                  <div className={`h-2 ${wbsColors.bar} rounded-sm shadow-sm`} />
                  <div className={`absolute -left-1 bottom-[-6px] w-0 h-0 border-l-[4px] border-l-transparent border-r-[4px] border-r-transparent border-t-[6px] ${wbsColors.bar.replace("bg-", "border-t-")}`} style={{ borderTopColor: "" }} />
                </div>
              );
            }

            return (
              <div
                key={task.id}
                className={`absolute h-4 rounded-sm cursor-pointer shadow-sm transition-all ${colorClass} ${isSelected ? 'ring-2 ring-offset-1 ring-blue-600 opacity-100' : 'opacity-75 hover:opacity-100'}`}
                style={{ left: leftOffset, top: barTop, width }}
                onClick={() => onSelectTask(task.id)}
                title={`${task.name}\n${task.startDate} → ${task.endDate}`}
              >
                {task.percentComplete > 0 && (
                  <div className="absolute top-0 left-0 bottom-0 bg-black/20 rounded-sm" style={{ width: `${task.percentComplete}%` }} />
                )}
              </div>
            );
          })}

          {/* Dependency arrows */}
          <svg className="absolute top-0 left-0 pointer-events-none overflow-visible" style={{ width: totalDays * DAY_WIDTH, height: Math.max(totalContentHeight, 500), zIndex: 0 }}>
            <defs>
              <marker id="arrowhead" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
                <polygon points="0 0, 6 3, 0 6" fill="#94a3b8" />
              </marker>
              <marker id="arrowhead-sel" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
                <polygon points="0 0, 6 3, 0 6" fill="#3b82f6" />
              </marker>
            </defs>
            {dependencies.map(dep => {
              const predYTop = taskIndexInVisible[dep.predecessorTaskId];
              const succYTop = taskIndexInVisible[dep.successorTaskId];
              if (predYTop === undefined || succYTop === undefined) return null;

              const pred = tasks.find(t => t.id === dep.predecessorTaskId);
              const succ = tasks.find(t => t.id === dep.successorTaskId);
              if (!pred || !succ) return null;

              const predEnd   = pred.endDate   ? parseISO(pred.endDate)   : addDays(parseISO(pred.startDate ?? projectStart.toISOString()), pred.duration);
              const succStart = succ.startDate  ? parseISO(succ.startDate) : projectStart;

              const x1 = differenceInDays(predEnd, projectStart)   * DAY_WIDTH;
              const y1 = predYTop + ROW_HEIGHT / 2;
              const x2 = differenceInDays(succStart, projectStart) * DAY_WIDTH;
              const y2 = succYTop + ROW_HEIGHT / 2;

              const isSelected = selectedTaskId === pred.id || selectedTaskId === succ.id;
              return (
                <path
                  key={dep.id}
                  d={`M ${x1} ${y1} C ${x1 + 15} ${y1}, ${x2 - 15} ${y2}, ${x2} ${y2}`}
                  fill="none"
                  stroke={isSelected ? "#3b82f6" : "#cbd5e1"}
                  strokeWidth={isSelected ? 2 : 1}
                  markerEnd={isSelected ? "url(#arrowhead-sel)" : "url(#arrowhead)"}
                />
              );
            })}
          </svg>
        </div>
      </div>
    </div>
  );
}
