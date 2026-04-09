"use client";

import { useState, useMemo } from "react";
import { 
  Terminal, 
  Search, 
  Filter, 
  Activity, 
  Clock, 
  CheckCircle2, 
  Trash2,
  AlertTriangle,
  Layers,
  Loader2,
  AlertCircle,
  Wallet
} from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { clearCompletedTasks, stopTask } from "@/app/actions/tasks";

export default function TasksContent({ 
  initialTasks, 
  workflows 
}: { 
  initialTasks: any[],
  workflows: any[]
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
      const workflowName = (task.workflow?.name || "").toLowerCase();
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
              className="bg-red-500/10 border border-red-500/20 rounded-2xl p-4 flex items-center justify-between animate-pulse-slow shadow-[0_0_20px_rgba(239,68,68,0.1)]"
            >
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 bg-red-500 rounded-xl flex items-center justify-center text-white">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-[11px] font-bold text-red-500 uppercase tracking-widest">Circuit Breaker Triggered</h3>
                  <p className="text-[10px] text-muted/60 font-medium">
                    <span className="text-foreground/80">{breaker.workflow?.name || "System"}</span> halted after {breaker.consecutive_failures_count} consecutive failures.
                  </p>
                </div>
              </div>
              <Link 
                href={`/tasks/${breaker.id}`}
                className="px-4 py-2 bg-red-500/20 hover:bg-red-500/30 border border-red-500/30 rounded-xl text-[9px] font-bold text-red-500 uppercase tracking-widest transition-all"
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
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted/30" />
          <input 
            type="text"
            placeholder="Search by workflow or ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-black/20 border border-white/10 rounded-xl py-2 pl-10 pr-4 text-xs focus:ring-1 focus:ring-accent/50 outline-none transition-all placeholder:text-muted/20"
          />
        </div>

        <div className="flex gap-2">
          <select 
            value={filterWorkflowId}
            onChange={(e) => setFilterWorkflowId(e.target.value)}
            className="flex-1 bg-black/20 border border-white/10 rounded-xl px-3 py-2 text-[10px] font-bold uppercase tracking-wider outline-none focus:ring-1 focus:ring-accent/50 transition-all cursor-pointer"
          >
            <option value="all">ALL CLUSTERS</option>
            {workflows.map(w => (
              <option key={w.id} value={w.id}>{w.name}</option>
            ))}
          </select>
          
          <select 
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="w-32 bg-black/20 border border-white/10 rounded-xl px-3 py-2 text-[10px] font-bold uppercase tracking-wider outline-none focus:ring-1 focus:ring-accent/50 transition-all cursor-pointer"
          >
            <option value="all">STATUS</option>
            <option value="running">RUNNING</option>
            <option value="completed">SUCCESS</option>
            <option value="failed">FAILED</option>
          </select>
        </div>

        <div className="flex justify-end">
          <button
            onClick={handleClearTasks}
            disabled={isClearing || initialTasks.length === 0}
            className="flex items-center gap-2 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 rounded-xl px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-red-400 transition-all disabled:opacity-30 disabled:cursor-not-allowed group"
          >
            {isClearing ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Trash2 className="w-3.5 h-3.5 group-hover:scale-110 transition-transform" />
            )}
            {isClearing ? "Clearing..." : "Clear Registry"}
          </button>
        </div>
      </div>

      {filteredTasks.length > 0 ? (
        <div className="flex-1 overflow-auto bg-surface border border-white/5 rounded-2xl relative shadow-sm no-scrollbar">
          <table className="w-full text-left border-collapse text-[11px] font-mono-data">
            <thead>
              <tr className="border-b border-white/5 bg-white/[0.03] text-muted/40 sticky top-0 z-10 uppercase tracking-[0.15em] h-12">
                <th className="px-6 w-[120px] font-bold">Status</th>
                <th className="px-4 w-[200px] font-bold">Workflow Cluster</th>
                <th className="px-4 w-[150px] font-bold">Duration</th>
                <th className="px-4 w-[120px] font-bold">Compute Cost</th>
                <th className="px-6 text-right font-bold">Incept Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.02]">
              {filteredTasks.map((task: any) => (
                <tr 
                  key={task.id} 
                  className="hover:bg-white/[0.02] transition-all group h-14 cursor-pointer"
                  onClick={() => router.push(`/tasks/${task.id}`)}
                >
                  <td className="px-6">
                    <div className="flex items-center justify-between gap-4 pr-4">
                      {task.status === "running" ? (
                        <div className="flex items-center gap-2 text-yellow-500/80">
                          <Loader2 className="w-3 h-3 animate-spin" />
                          <span className="text-[9px] font-bold uppercase tracking-widest">Active</span>
                        </div>
                      ) : task.status === "completed" ? (
                        <div className="flex items-center gap-2 text-green-500/80">
                          <CheckCircle2 className="w-3 h-3" />
                          <span className="text-[9px] font-bold uppercase tracking-widest">Success</span>
                        </div>
                      ) : task.status === "paused_hitl" ? (
                        <div className="flex items-center gap-2 text-yellow-500">
                          <Clock className="w-3 h-3" />
                          <span className="text-[9px] font-bold uppercase tracking-widest">HITL Pause</span>
                        </div>
                      ) : task.status === "paused_error" ? (
                        <div className="flex items-center gap-2 text-red-500">
                          {task.pause_reason === "circuit_breaker" ? <AlertTriangle className="w-3 h-3 animate-pulse" /> : <AlertCircle className="w-3 h-3" />}
                          <span className="text-[9px] font-bold uppercase tracking-widest">
                            {task.pause_reason === "circuit_breaker" ? "System Halted" : "Paused Detail"}
                          </span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 text-red-500/80">
                          <AlertCircle className="w-3 h-3" />
                          <span className="text-[9px] font-bold uppercase tracking-widest">Failed</span>
                        </div>
                      )}

                      {task.status === "running" && (
                        <button
                          onClick={async (e) => {
                            e.stopPropagation();
                            if (confirm("Terminate this running sequence?")) {
                              await stopTask(task.id);
                            }
                          }}
                          className="px-2 py-1 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 rounded-md text-[8px] font-black uppercase text-red-500 transition-all opacity-0 group-hover:opacity-100"
                        >
                          STOP
                        </button>
                      )}
                    </div>
                  </td>
                  <td className="px-4">
                    <div className="flex flex-col">
                      <span className="font-bold text-foreground/80 uppercase tracking-tight truncate max-w-[180px]">
                        {task.workflow?.name || "System_Process"}
                      </span>
                      <span className="text-[8px] text-muted/30 uppercase tracking-tighter">
                        ID: {task.id.split("-")[0]}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 text-muted/60">
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
                      <span className="text-[8px] text-muted/30 uppercase">
                        {task.total_tokens || 0} Tokens
                      </span>
                    </div>
                  </td>
                  <td className="px-6 text-right">
                    <div className="flex flex-col items-end">
                      <span className="text-muted/60 uppercase">
                        {formatDistanceToNow(new Date(task.started_at), { addSuffix: true })}
                      </span>
                      <span className="text-[8px] text-muted/20">
                        {format(new Date(task.started_at), "HH:mm:ss 'GMT'")}
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
          <h3 className="text-[12px] font-bold text-muted/20 uppercase tracking-[0.3em]">Registry Empty</h3>
          <p className="text-[9px] text-muted/10 tracking-[0.2em] mt-2 font-mono-data uppercase italic">
            No active or historical tasks found in this sector.
          </p>
          <Link 
            href="/run" 
            className="mt-8 px-6 py-2 bg-accent/10 border border-accent/20 rounded-xl text-[10px] font-bold text-accent uppercase tracking-[0.2em] hover:bg-accent/20 transition-all no-underline"
          >
            Initiate First Task
          </Link>
        </div>
      )}
    </div>
  );
}
