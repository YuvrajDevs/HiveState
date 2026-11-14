"use client";
import { one, type Run, type Workflow } from "@/types/domain";

import { useState, useMemo } from "react";
import { 
  
  Search, 
  
  Activity, 
  Clock, 
  CheckCircle2, 
  Trash2,
  AlertTriangle,
  
  Loader2,
  AlertCircle,
  Wallet
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { clearCompletedTasks, stopTask } from "@/app/actions/tasks";

export default function TasksContent({ 
  initialTasks, 
  workflows 
}: { 
  initialTasks: Run[],
  workflows: Pick<Workflow, "id" | "name">[]
}) {
  const router = useRouter();
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterWorkflowId, setFilterWorkflowId] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [isClearing, setIsClearing] = useState(false);

  const handleClearTasks = async () => {
    if (!confirm("Are you sure you want to clear all completed and failed tasks? This action cannot be undone.")) {
      return;
    }

    setIsClearing(true);
    const result = await clearCompletedTasks();
    setIsClearing(false);

    if (result.success) {
      router.refresh();
    } else {
      alert(`Error clearing tasks: ${result.error}`);
    }
  };

  const filteredTasks = useMemo(() => {
    return initialTasks.filter(task => {
      const matchesStatus = filterStatus === "all" || task.status === filterStatus;
      const matchesWorkflow = filterWorkflowId === "all" || task.workflow_id === filterWorkflowId;
      const workflowName = (one(task.workflow)?.name || "").toLowerCase();
      const matchesSearch = workflowName.includes(searchQuery.toLowerCase()) || task.id.includes(searchQuery);
      
      return matchesStatus && matchesWorkflow && matchesSearch;
    });
  }, [initialTasks, filterStatus, filterWorkflowId, searchQuery]);

  const activeBreakers = useMemo(() => {
    return initialTasks.filter(t => t.circuit_breaker_triggered && t.status !== "completed");
  }, [initialTasks]);

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden gap-6">
      {/* Circuit Breaker Alerts */}
      {activeBreakers.length > 0 && (
        <div className="space-y-3">
          {activeBreakers.map(breaker => (
            <div 
              key={breaker.id}
              className="bg-white/[0.04] border border-white/10 rounded-2xl p-4 flex items-center justify-between animate-pulse-slow"
            >
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 bg-danger rounded-xl flex items-center justify-center text-white">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-micro font-semibold text-danger">Stopped after repeated failures</h3>
                  <p className="text-xs text-muted/85 font-medium">
                    <span className="text-foreground/80">{one(breaker.workflow)?.name || "System"}</span> halted after {breaker.consecutive_failures_count} consecutive failures.
                  </p>
                </div>
              </div>
              <Link 
                href={`/tasks/${breaker.id}`}
                className="px-4 py-2 bg-white/[0.04] hover:bg-white/[0.04] border border-white/10 rounded-xl text-micro font-semibold text-danger transition-all"
              >
                Resolve
              </Link>
            </div>
          ))}
        </div>
      )}
      {/* Search & Filter Bar */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-white/[0.02] border border-white/5 p-4 rounded-2xl">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted/80" />
          <input 
            type="text"
            placeholder="Search by workflow name or run ID…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-black/20 border border-white/10 rounded-xl py-2 pl-10 pr-4 text-xs focus:ring-1 focus:ring-accent/50 outline-none transition-all placeholder:text-muted/80"
          />
        </div>

        <div className="flex flex-wrap gap-2 [&>select]:min-w-[8rem]">
          <select 
            value={filterWorkflowId}
            onChange={(e) => setFilterWorkflowId(e.target.value)}
            className="flex-1 bg-black/20 border border-white/10 rounded-xl px-3 py-2 text-xs font-semibold outline-none focus:ring-1 focus:ring-accent/50 transition-all cursor-pointer"
          >
            <option value="all">All workflows</option>
            {workflows.map(w => (
              <option key={w.id} value={w.id}>{w.name}</option>
            ))}
          </select>
          
          <select 
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="w-40 bg-black/20 border border-white/10 rounded-xl px-3 py-2 text-xs font-semibold outline-none focus:ring-1 focus:ring-accent/50 transition-all cursor-pointer"
          >
            <option value="all">All statuses</option>
            <option value="running">Running</option>
            <option value="completed">Completed</option>
            <option value="failed">Failed</option>
          </select>
        </div>

        <div className="flex justify-end">
          <button
            onClick={handleClearTasks}
            disabled={isClearing || initialTasks.length === 0}
            className="flex items-center gap-2 bg-white/[0.04] hover:bg-white/[0.04] border border-white/10 rounded-xl px-4 py-2 text-xs font-semibold text-danger transition-all disabled:opacity-30 disabled:cursor-not-allowed group"
          >
            {isClearing ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Trash2 className="w-3.5 h-3.5 group-hover:scale-110 transition-transform" />
            )}
            {isClearing ? "Clearing..." : "Clear finished"}
          </button>
        </div>
      </div>

      {filteredTasks.length > 0 ? (
        <div className="flex-1 overflow-auto bg-surface border border-white/5 rounded-2xl relative shadow-sm no-scrollbar">
          <table className="w-full min-w-[720px] text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-white/5 bg-white/[0.03] text-muted/80 sticky top-0 z-10 h-12">
                <th className="px-6 w-[120px] font-bold">Status</th>
                <th className="px-4 w-[200px] font-bold">Workflow</th>
                <th className="px-4 w-[150px] font-bold">Duration</th>
                <th className="px-4 w-[120px] font-bold">Cost</th>
                <th className="px-6 text-right font-bold">Started</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.02]">
              {filteredTasks.map((task) => (
                <tr 
                  key={task.id} 
                  className="hover:bg-white/[0.02] transition-all group h-14 cursor-pointer"
                  onClick={() => router.push(`/tasks/${task.id}`)}
                >
                  <td className="px-6">
                    <div className="flex items-center justify-between gap-4 pr-4">
                      {task.status === "running" ? (
                        <div className="flex items-center gap-2 text-warning/80">
                          <Loader2 className="w-3 h-3 animate-spin" />
                          <span className="text-micro font-semibold">Running</span>
                        </div>
                      ) : task.status === "completed" ? (
                        <div className="flex items-center gap-2 text-success/80">
                          <CheckCircle2 className="w-3 h-3" />
                          <span className="text-micro font-semibold">Completed</span>
                        </div>
                      ) : task.status === "paused_hitl" ? (
                        <div className="flex items-center gap-2 text-warning">
                          <Clock className="w-3 h-3" />
                          <span className="text-micro font-semibold">Needs review</span>
                        </div>
                      ) : task.status === "paused_error" ? (
                        <div className="flex items-center gap-2 text-danger">
                          {task.pause_reason === "circuit_breaker" ? <AlertTriangle className="w-3 h-3" /> : <AlertCircle className="w-3 h-3" />}
                          <span className="text-micro font-semibold">
                            {task.pause_reason === "circuit_breaker" ? "Stopped (too many failures)" : "Paused on error"}
                          </span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 text-danger/80">
                          <AlertCircle className="w-3 h-3" />
                          <span className="text-micro font-semibold">Failed</span>
                        </div>
                      )}

                      {task.status === "running" && (
                        <button
                          onClick={async (e) => {
                            e.stopPropagation();
                            if (confirm("Stop this run? Work already completed is kept, but no further steps will run.")) {
                              await stopTask(task.id);
                            }
                          }}
                          className="px-2 py-1 bg-white/[0.04] hover:bg-white/[0.04] border border-white/10 rounded-md text-micro font-semibold text-danger transition-all"
                        >
                          STOP
                        </button>
                      )}
                    </div>
                  </td>
                  <td className="px-4">
                    <div className="flex flex-col">
                      <span className="font-semibold text-foreground/80 tracking-tight truncate max-w-[180px]">
                        {one(task.workflow)?.name || "Deleted workflow"}
                      </span>
                      <span className="text-micro text-muted/80">
                        ID: {task.id.split("-")[0]}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 text-muted/85">
                    <div className="flex items-center gap-2">
                      <Clock className="w-3 h-3 opacity-30" />
                      {task.total_duration_ms ? `${(task.total_duration_ms / 1000).toFixed(2)}s` : "---"}
                    </div>
                  </td>
                  <td className="px-4">
                    <div className="flex flex-col">
                      <div className="flex items-center gap-1.5 text-accent/80 font-bold">
                        <Wallet className="w-2.5 h-2.5 opacity-50" />
                        ₹{(task.total_cost || 0).toFixed(6)}
                      </div>
                      <span className="text-micro text-muted/80">
                        {task.total_tokens || 0} Tokens
                      </span>
                    </div>
                  </td>
                  <td className="px-6 text-right">
                    <div className="flex flex-col items-end">
                      <span className="text-muted/85">
                        <span suppressHydrationWarning>{formatDistanceToNow(new Date(task.started_at), { addSuffix: true })}</span>
                      </span>
                      <span className="text-micro text-muted/80">
                        {new Date(task.started_at).toISOString().slice(11, 19)} UTC
                      </span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center border border-dashed border-white/10 rounded-3xl p-20 bg-white/[0.01]">
          <Activity className="w-12 h-12 text-muted/5 mb-6" />
          <h3 className="text-xs font-semibold text-muted/80">No runs yet</h3>
          <p className="text-micro text-muted/85 mt-2">
            No active or historical tasks found in this sector.
          </p>
          <Link 
            href="/run" 
            className="mt-8 px-6 py-2 bg-accent/10 border border-accent/20 rounded-xl text-xs font-semibold text-accent hover:bg-accent/20 transition-all no-underline"
          >
            Initiate first task
          </Link>
        </div>
      )}
    </div>
  );
}
