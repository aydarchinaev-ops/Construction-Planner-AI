import { useGetAiSuggestions, useAcceptAiSuggestion, useRejectAiSuggestion } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Loader2, AlertTriangle, AlertCircle, Info, Check, X, Sparkles } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

export default function AiSuggestionsPanel({ projectId }: { projectId: number }) {
  const queryClient = useQueryClient();
  
  const { data: suggestions = [], isLoading } = useGetAiSuggestions(projectId, {
    query: {
      enabled: !!projectId,
      queryKey: [`/api/projects/${projectId}/suggestions`]
    }
  });

  const acceptMutation = useAcceptAiSuggestion();
  const rejectMutation = useRejectAiSuggestion();

  const handleAction = (id: number, action: 'accept' | 'reject') => {
    const mutation = action === 'accept' ? acceptMutation : rejectMutation;
    mutation.mutate(
      { projectId, suggestionId: id } as any, // types generated might differ slightly but concept matches
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: [`/api/projects/${projectId}/suggestions`] });
          if (action === 'accept') {
            // Re-fetch schedule data as accepting alters the schedule
            queryClient.invalidateQueries({ queryKey: [`/api/projects/${projectId}/tasks`] });
            queryClient.invalidateQueries({ queryKey: [`/api/projects/${projectId}/dependencies`] });
            queryClient.invalidateQueries({ queryKey: [`/api/projects/${projectId}/summary`] });
          }
        }
      }
    );
  };

  if (isLoading) {
    return (
      <div className="flex justify-center p-8">
        <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
      </div>
    );
  }

  const pendingSuggestions = suggestions.filter(s => s.status === 'pending');

  if (pendingSuggestions.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-6 text-center text-slate-500 bg-white">
        <div className="w-12 h-12 bg-emerald-50 rounded-full flex items-center justify-center mb-4">
          <Sparkles className="h-6 w-6 text-emerald-500" />
        </div>
        <h4 className="font-medium text-slate-900 mb-1">Schedule Optimized</h4>
        <p className="text-sm">No new AI insights available at the moment. Your schedule looks solid.</p>
      </div>
    );
  }

  const getIcon = (severity: string) => {
    switch(severity) {
      case 'critical': return <AlertCircle className="h-4 w-4 text-red-500 mt-0.5" />;
      case 'warning': return <AlertTriangle className="h-4 w-4 text-amber-500 mt-0.5" />;
      default: return <Info className="h-4 w-4 text-blue-500 mt-0.5" />;
    }
  };

  return (
    <div className="h-full overflow-y-auto bg-slate-50 p-4 space-y-4">
      <div className="flex items-center gap-2 mb-2 px-1">
        <Sparkles className="h-4 w-4 text-blue-500" />
        <span className="text-sm font-semibold text-slate-700">{pendingSuggestions.length} Pending Insights</span>
      </div>

      {pendingSuggestions.map(s => (
        <div key={s.id} className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden flex flex-col transition-shadow hover:shadow-md">
          <div className="p-3 pb-2 flex gap-2.5">
            {getIcon(s.severity)}
            <div>
              <div className="text-xs font-semibold text-slate-900 uppercase tracking-wide mb-1">
                {s.suggestionType.replace(/_/g, ' ')}
              </div>
              <p className="text-sm text-slate-600 leading-snug">
                {s.message}
              </p>
            </div>
          </div>
          
          <div className="bg-slate-50 px-3 py-2 border-t border-slate-100 flex justify-end gap-2 mt-auto">
            <Button 
              variant="ghost" 
              size="sm" 
              className="h-7 px-2 text-xs text-slate-500 hover:text-slate-800"
              onClick={() => handleAction(s.id, 'reject')}
              disabled={rejectMutation.isPending || acceptMutation.isPending}
            >
              <X className="h-3.5 w-3.5 mr-1" /> Dismiss
            </Button>
            <Button 
              size="sm" 
              className="h-7 px-3 text-xs bg-blue-50 text-blue-700 hover:bg-blue-100 hover:text-blue-800"
              onClick={() => handleAction(s.id, 'accept')}
              disabled={rejectMutation.isPending || acceptMutation.isPending}
            >
              <Check className="h-3.5 w-3.5 mr-1" /> Apply Fix
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}
