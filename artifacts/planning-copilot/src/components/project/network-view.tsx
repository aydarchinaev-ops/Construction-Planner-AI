import React, { useEffect, useRef, useState, useMemo } from "react";
import { useGetTasks, useGetDependencies } from "@workspace/api-client-react";
import { Loader2, ZoomIn, ZoomOut, Maximize } from "lucide-react";

// A very simplified static layout algorithm for the network diagram.
// In a real pro app, we'd use a layout engine like Dagre.
// Here we do a crude layer-based assignment.

export default function NetworkView({ projectId, selectedTaskId, onSelectTask }: { projectId: number, selectedTaskId: number | null, onSelectTask: (id: number) => void }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [transform, setTransform] = useState<{ x: number, y: number, scale: number }>({ x: 0, y: 0, scale: 1 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

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

  if (tasksLoading || depsLoading) {
    return (
      <div className="h-full w-full flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
      </div>
    );
  }

  // Compute layers (Crude topological sort)
  const nodeLayers: Record<number, number> = {};
  const activeTasks = tasks.filter((t: any) => t.type !== "summary");
  
  // Initialize nodes
  activeTasks.forEach((t: any) => {
    nodeLayers[t.id] = 0;
  });

  // Relax layers (O(N^2) worst case but fine for UI mock)
  let changed = true;
  let iterations = 0;
  while (changed && iterations < 100) {
    changed = false;
    iterations++;
    dependencies.forEach((dep: any) => {
      if (nodeLayers[dep.predecessorTaskId] !== undefined && nodeLayers[dep.successorTaskId] !== undefined) {
        if (nodeLayers[dep.successorTaskId] <= nodeLayers[dep.predecessorTaskId]) {
          nodeLayers[dep.successorTaskId] = nodeLayers[dep.predecessorTaskId] + 1;
          changed = true;
        }
      }
    });
  }

  // Calculate coordinates
  const LAYER_WIDTH = 250;
  const NODE_HEIGHT = 80;
  const V_SPACE = 40;
  const NODE_WIDTH = 180;

  const layerCounts: Record<number, number> = {};
  const nodePositions: Record<number, { x: number, y: number }> = {};

  activeTasks.forEach((task: any) => {
    const layer = nodeLayers[task.id];
    const indexInLayer = layerCounts[layer] || 0;
    
    nodePositions[task.id] = {
      x: layer * LAYER_WIDTH + 50,
      y: indexInLayer * (NODE_HEIGHT + V_SPACE) + 50
    };
    
    layerCounts[layer] = indexInLayer + 1;
  });

  // Derived state for linked tasks
  const linkedTaskIds = useMemo(() => {
    if (!selectedTaskId) return new Set<number>();
    
    const linked = new Set<number>([selectedTaskId]);
    dependencies.forEach((dep: any) => {
      if (dep.predecessorTaskId === selectedTaskId) linked.add(dep.successorTaskId);
      if (dep.successorTaskId === selectedTaskId) linked.add(dep.predecessorTaskId);
    });
    return linked;
  }, [selectedTaskId, dependencies]);

  // Zoom to fit selection
  useEffect(() => {
    if (!selectedTaskId || !containerRef.current) return;
    
    const container = containerRef.current.getBoundingClientRect();
    const margin = 100;

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    let hasNodes = false;

    linkedTaskIds.forEach((id: number) => {
      const pos = nodePositions[id];
      if (pos) {
        hasNodes = true;
        minX = Math.min(minX, pos.x);
        minY = Math.min(minY, pos.y);
        maxX = Math.max(maxX, pos.x + NODE_WIDTH);
        maxY = Math.max(maxY, pos.y + NODE_HEIGHT);
      }
    });

    if (!hasNodes) return;

    const width = maxX - minX;
    const height = maxY - minY;
    
    let scale = Math.min(
      (container.width - margin * 2) / Math.max(width, 1),
      (container.height - margin * 2) / Math.max(height, 1),
      1.2 // Max zoom scale when selecting
    );

    const centerX = minX + width / 2;
    const centerY = minY + height / 2;

    const tx = container.width / 2 - centerX * scale;
    const ty = container.height / 2 - centerY * scale;

    setTransform({ x: tx, y: ty, scale });
  }, [selectedTaskId, linkedTaskIds, activeTasks.length]);

  // Pan and Zoom handlers
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    if (e.ctrlKey || e.metaKey) {
      // Zoom
      const scaleAdj = e.deltaY > 0 ? 0.9 : 1.1;
      setTransform((prev: any) => ({ ...prev, scale: Math.max(0.1, Math.min(3, prev.scale * scaleAdj)) }));
    } else {
      // Pan
      setTransform((prev: any) => ({
        ...prev,
        x: prev.x - e.deltaX,
        y: prev.y - e.deltaY
      }));
    }
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    // Only pan on background drag
    if ((e.target as HTMLElement).tagName === 'svg' || (e.target as HTMLElement).classList.contains('bg-grid')) {
      setIsDragging(true);
      setDragStart({ x: e.clientX, y: e.clientY });
      e.currentTarget.setPointerCapture(e.pointerId);
    }
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (isDragging) {
      const dx = e.clientX - dragStart.x;
      const dy = e.clientY - dragStart.y;
      setTransform((prev: any) => ({
        ...prev,
        x: prev.x + dx,
        y: prev.y + dy
      }));
      setDragStart({ x: e.clientX, y: e.clientY });
    }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    setIsDragging(false);
    e.currentTarget.releasePointerCapture(e.pointerId);
  };

  return (
    <div 
      className="h-full w-full overflow-hidden bg-slate-50 cursor-grab active:cursor-grabbing bg-grid select-none relative" 
      ref={containerRef}
      onWheel={handleWheel}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      style={{ backgroundImage: 'radial-gradient(#cbd5e1 1px, transparent 1px)', backgroundSize: '24px 24px' }}
    >
      <div 
        className="w-full h-full origin-top-left transition-transform duration-300 ease-out"
        style={{ transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})` }}
      >
        <svg className="absolute top-0 left-0 w-full h-full overflow-visible pointer-events-none">
          <defs>
            <marker id="arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto">
              <path d="M 0 0 L 10 5 L 0 10 z" fill="#94a3b8" />
            </marker>
            <marker id="arrow-selected" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto">
              <path d="M 0 0 L 10 5 L 0 10 z" fill="#3b82f6" />
            </marker>
            <marker id="arrow-shaded" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto">
              <path d="M 0 0 L 10 5 L 0 10 z" fill="#e2e8f0" />
            </marker>
          </defs>
          
          <style>{`
            @keyframes link-flow {
              to {
                stroke-dashoffset: -24;
              }
            }
            .animate-flow {
              stroke-dasharray: 8 4;
              animation: link-flow 0.5s linear infinite;
            }
          `}</style>

          {dependencies.map((dep: any) => {
            const pred = nodePositions[dep.predecessorTaskId];
            const succ = nodePositions[dep.successorTaskId];
            if (!pred || !succ) return null;

            const x1 = pred.x + NODE_WIDTH;
            const y1 = pred.y + NODE_HEIGHT / 2;
            const x2 = succ.x;
            const y2 = succ.y + NODE_HEIGHT / 2;

            const isLinkSelected = selectedTaskId === dep.predecessorTaskId || selectedTaskId === dep.successorTaskId;
            const isDimmedLink = selectedTaskId !== null && !isLinkSelected;

            // Rectangular routing
            const controlPointX = x1 + (x2 - x1) / 2;
            const path = `M ${x1} ${y1} L ${controlPointX} ${y1} L ${controlPointX} ${y2} L ${x2} ${y2}`;

            return (
              <g key={dep.id} className={isDimmedLink ? "opacity-30" : "opacity-100"}>
                <path
                  d={path}
                  fill="none"
                  stroke={isLinkSelected ? "#3b82f6" : "#cbd5e1"}
                  strokeWidth={isLinkSelected ? 2.5 : 1.5}
                  markerEnd={isLinkSelected ? "url(#arrow-selected)" : isDimmedLink ? "url(#arrow-shaded)" : "url(#arrow)"}
                  className={`transition-all duration-300 ${isLinkSelected ? 'animate-flow' : ''}`}
                />
                {/* Relationship label */}
                <rect 
                  x={(x1+x2)/2 - 12} 
                  y={(y1+y2)/2 - 8} 
                  width="24" 
                  height="16" 
                  fill="white" 
                  rx="4" 
                  stroke={isLinkSelected ? "#bfdbfe" : "#f1f5f9"}
                />
                <text 
                  x={(x1+x2)/2} 
                  y={(y1+y2)/2 + 3} 
                  textAnchor="middle" 
                  fontSize="8" 
                  fontFamily="monospace"
                  fill={isLinkSelected ? "#2563eb" : "#64748b"}
                  fontWeight="bold"
                >
                  {dep.relationshipType}
                </text>
              </g>
            );
          })}
        </svg>

        {activeTasks.map((task: any) => {
          const pos = nodePositions[task.id];
          if (!pos) return null;
          const isSelected = selectedTaskId === task.id;
          const isLinked = linkedTaskIds.has(task.id);
          const isDimmed = selectedTaskId !== null && !isLinked;

          return (
            <div
              key={task.id}
              className={`absolute bg-white rounded-lg border-2 shadow-sm transition-all duration-300 cursor-pointer overflow-hidden
                ${isSelected ? 'border-blue-500 shadow-md ring-4 ring-blue-500/20' : 'border-slate-200 hover:border-slate-400'}
                ${isDimmed ? 'opacity-40 grayscale-[50%]' : 'opacity-100'}
              `}
              style={{ 
                left: pos.x, 
                top: pos.y, 
                width: NODE_WIDTH, 
                height: NODE_HEIGHT 
              }}
              onClick={() => onSelectTask(task.id)}
            >
              <div className={`h-1.5 w-full ${task.isMilestone ? 'bg-indigo-500' : 'bg-slate-400'} transition-colors`} />
              <div className="p-3">
                <div className="flex justify-between items-center mb-1">
                  <span className="font-mono text-[10px] text-slate-500">{task.taskCode}</span>
                  <span className="font-mono text-[10px] font-semibold text-slate-700 bg-slate-100 px-1 rounded transition-colors">{task.duration}d</span>
                </div>
                <div className="text-xs font-medium text-slate-900 leading-tight line-clamp-2 transition-colors" title={task.name}>
                  {task.name}
                </div>
              </div>
            </div>
          );
        })}
      </div>
      
      {/* Zoom hint overlay */}
      <div className="absolute bottom-4 right-4 bg-white/80 backdrop-blur-sm border border-slate-200 text-slate-500 text-xs px-3 py-1.5 rounded shadow-sm pointer-events-none">
        Drag to pan • Scroll to zoom
      </div>

      {/* Zoom Controls */}
      <div className="absolute top-4 right-4 flex flex-col gap-1 bg-white/90 backdrop-blur-sm rounded-lg shadow-sm p-1.5 border border-slate-200">
        <button 
          className="p-1.5 hover:bg-slate-100 rounded-md text-slate-600 hover:text-slate-900 transition-colors tooltip"
          title="Zoom In"
          onClick={() => setTransform((prev: any) => ({...prev, scale: Math.min(prev.scale * 1.3, 3)}))}
        >
          <ZoomIn className="w-4 h-4" />
        </button>
        <button 
          className="p-1.5 hover:bg-slate-100 rounded-md text-slate-600 hover:text-slate-900 transition-colors tooltip"
          title="Zoom Out"
          onClick={() => setTransform((prev: any) => ({...prev, scale: Math.max(prev.scale / 1.3, 0.1)}))}
        >
          <ZoomOut className="w-4 h-4" />
        </button>
        <div className="h-px bg-slate-200 my-0.5 mx-1" />
        <button 
          className="p-1.5 hover:bg-slate-100 rounded-md text-slate-600 hover:text-slate-900 transition-colors tooltip"
          title="Reset View"
          onClick={() => setTransform({ x: 0, y: 0, scale: 1 })}
        >
          <Maximize className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
