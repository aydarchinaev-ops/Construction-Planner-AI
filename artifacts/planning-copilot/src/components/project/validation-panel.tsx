import { useValidateSchedule } from "@workspace/api-client-react";
import { Loader2, ShieldAlert, ShieldCheck, AlertCircle, AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export default function ValidationPanel({ projectId, onSelectTask }: { projectId: number, onSelectTask: (id: number) => void }) {
  const { data: result, isLoading } = useValidateSchedule(projectId, {
    query: {
      enabled: !!projectId,
      queryKey: [`/api/projects/${projectId}/validate`]
    }
  });

  if (isLoading) {
    return (
      <div className="flex justify-center p-8">
        <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
      </div>
    );
  }

  if (!result) return null;

  if (result.isValid && result.issues.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-6 text-center text-slate-500 bg-white">
        <div className="w-12 h-12 bg-emerald-50 rounded-full flex items-center justify-center mb-4">
          <ShieldCheck className="h-6 w-6 text-emerald-500" />
        </div>
        <h4 className="font-medium text-slate-900 mb-1">Validation Passed</h4>
        <p className="text-sm">Zero structural or logic issues found in the network diagram.</p>
      </div>
    );
  }

  const errors = result.issues.filter(i => i.type === 'error');
  const warnings = result.issues.filter(i => i.type === 'warning');

  return (
    <div className="h-full overflow-y-auto bg-slate-50 p-4 font-sans text-sm">
      <div className="mb-4 bg-white p-3 rounded-md border border-slate-200 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-2 font-semibold text-slate-800">
          <ShieldAlert className="h-4 w-4 text-red-500" />
          Integrity Check
        </div>
        <div className="flex gap-2 text-xs font-mono">
          <span className="text-red-600 bg-red-50 px-1.5 py-0.5 rounded">{result.errorCount} Err</span>
          <span className="text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded">{result.warningCount} Warn</span>
        </div>
      </div>

      {errors.length > 0 && (
        <div className="mb-6 space-y-2">
          <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider pl-1">Critical Logic Errors</h4>
          {errors.map((issue, idx) => (
            <IssueCard key={idx} issue={issue} onSelectTask={onSelectTask} icon={<AlertCircle className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />} bg="bg-red-50/50" border="border-red-100" />
          ))}
        </div>
      )}

      {warnings.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider pl-1">Warnings</h4>
          {warnings.map((issue, idx) => (
            <IssueCard key={idx} issue={issue} onSelectTask={onSelectTask} icon={<AlertTriangle className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />} bg="bg-white" border="border-slate-200" />
          ))}
        </div>
      )}
    </div>
  );
}

function IssueCard({ issue, onSelectTask, icon, bg, border }: { issue: any, onSelectTask: (id: number) => void, icon: React.ReactNode, bg: string, border: string }) {
  return (
    <div className={`p-3 rounded-lg border ${border} ${bg} shadow-sm transition-all hover:shadow-md cursor-pointer`}
      onClick={() => {
        if (issue.affectedTaskIds?.length) {
          onSelectTask(issue.affectedTaskIds[0]);
        }
      }}
    >
      <div className="flex gap-2.5">
        {icon}
        <div>
          <div className="text-xs font-bold text-slate-800 mb-1">{issue.code}</div>
          <div className="text-sm text-slate-700 leading-snug">{issue.message}</div>
          
          {issue.affectedTaskIds && issue.affectedTaskIds.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {issue.affectedTaskIds.slice(0, 3).map((id: number) => (
                <span key={id} className="text-[10px] bg-slate-200 text-slate-600 px-1.5 py-0.5 rounded font-mono">
                  Task #{id}
                </span>
              ))}
              {issue.affectedTaskIds.length > 3 && (
                <span className="text-[10px] text-slate-500 px-1 py-0.5">+{issue.affectedTaskIds.length - 3} more</span>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
