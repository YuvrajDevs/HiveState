"use client";

import { useState, useMemo } from "react";
import { Terminal, AlertTriangle, CheckCircle2, Maximize2, Filter, Layers, Clock, ChevronDown, ChevronRight, Activity } from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";
import { useRouter } from "next/navigation";

export default function TracesContent({ 
  initialLogs, 
  workflows 
}: { 
  initialLogs: any[],
  workflows: any[]
}) {
  const router = useRouter();
  const [filterWorkflowId, setFilterWorkflowId] = useState<string>("all");
  const [expandedWorkflows, setExpandedWorkflows] = useState<Record<string, boolean>>({});

  const toggleWorkflow = (id: string) => {
    setExpandedWorkflows(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  const groupedLogs = useMemo(() => {
    const groups: Record<string, any[]> = {};
    
    // Group logs by run ID
    initialLogs.forEach(log => {
      const runId = log.run_id || "system";
      if (!groups[runId]) groups[runId] = [];
      groups[runId].push(log);
    });

    return groups;
  }, [initialLogs]);

  const runList = useMemo(() => {
    return Object.keys(groupedLogs).map(runId => {
      const logs = groupedLogs[runId];
      // Get the earliest log for this run's basic info
      const earliestLog = [...logs].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())[0];
      const name = earliestLog.run?.workflow?.name || earliestLog.agent?.workflow?.name || "Deleted workflow";
      const timestamp = earliestLog.created_at;
      const status = logs.some(l => l.status === "failed") ? "failed" : "success";
      
      return { runId, name, logs, timestamp, status };
    }).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, [groupedLogs]);

  // Handle workflow filtering at the UI level
  const filteredRuns = useMemo(() => {
    if (filterWorkflowId === "all") return runList;
    return runList.filter(run => {
      const firstLog = run.logs[0];
      const wId = firstLog.run?.workflow?.id || firstLog.agent?.workflow?.id;
      return wId === filterWorkflowId;
    });
  }, [runList, filterWorkflowId]);

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden gap-4">
      {/* Filter & Control Bar */}
      <div className="flex items-center justify-between bg-white/[0.02] border border-white/10 p-3 rounded-xl">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 text-xs font-bold text-muted uppercase tracking-widest px-2">
            <Filter className="w-3.5 h-3.5" />
            Deployment Search
          </div>
          <select 
            value={filterWorkflowId}
            onChange={(e) => setFilterWorkflowId(e.target.value)}
            className="bg-inset/85 border border-white/15 text-xs px-3 py-1.5 rounded-lg outline-none focus:ring-1 focus:ring-accent/50 transition-all cursor-pointer uppercase font-bold tracking-wider"
          >
            <option value="all">ALL SESSSIONS</option>
            {workflows.map(w => (
              <option key={w.id} value={w.id}>{w.name}</option>
            ))}
          </select>
        </div>
        
        <div className="flex items-center gap-2 px-4 text-[11px] font-mono-data text-muted uppercase tracking-[0.2em]">
          <Activity className="w-3 h-3 text-accent" /> SessionBased_Telemetry_Active
        </div>
      </div>

      {filteredRuns.length > 0 ? (
        <div className="flex-1 overflow-auto no-scrollbar space-y-4">
          {filteredRuns.map((run, index) => {
            const isExpanded = expandedWorkflows[run.runId] !== undefined 
              ? expandedWorkflows[run.runId] 
              : index === 0; // Default expanded for the latest run only
            
            return (
              <div key={run.runId} className="bg-surface border border-white/10 rounded-2xl overflow-hidden shadow-sm">
                {/* Run Header */}
                <div 
                  className="p-4 bg-white/[0.03] flex items-center justify-between cursor-pointer hover:bg-white/[0.05] transition-colors group"
                  onClick={() => toggleWorkflow(run.runId)}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-lg border flex items-center justify-center ${
                      run.status === "success" ? "bg-green-500/10 border-green-500/20 text-ok" : "bg-red-500/10 border-red-500/20 text-bad"
                    }`}>
                      <Layers className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="flex items-center gap-3">
                        <h3 className="text-sm font-bold uppercase tracking-tight text-foreground/80">{run.name}</h3>
                        <span className={`text-[11px] px-1.5 py-0.5 font-bold uppercase rounded-sm ${
                          run.status === "success" ? "bg-green-500/10 text-ok" : "bg-red-500/10 text-bad"
                        }`}>
                          {run.status}
                        </span>
                      </div>
                      <p className="text-[11px] font-mono-data text-muted uppercase tracking-widest mt-0.5">
                        {format(new Date(run.timestamp), "MMM d, HH:mm:ss")} — {run.logs.length} Cycles Captured
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-xs font-mono-data text-muted opacity-0 group-hover:opacity-100 transition-opacity uppercase font-bold">
                      RUN: {run.runId.split("-")[0]}
                    </div>
                    {isExpanded ? <ChevronDown className="w-4 h-4 text-muted" /> : <ChevronRight className="w-4 h-4 text-muted" />}
                  </div>
                </div>

                {/* Workflow Logs Table */}
                {isExpanded && (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse font-mono-data text-[11px] table-fixed">
                      <thead>
                        <tr className="border-t border-b border-white/10 bg-inset/55 text-muted uppercase tracking-[0.1em] h-10">
                          <th className="px-6 w-[80px] font-bold">Status</th>
                          <th className="px-4 w-[120px] font-bold">Agent Node</th>
                          <th className="px-4 font-bold">Execution Payload Preview</th>
                          <th className="px-4 w-[150px] font-bold">Trace Date</th>
                          <th className="px-6 w-[60px] font-bold text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/[0.02]">
                        {run.logs.map((log: any) => (
                          <tr 
                            key={log.id} 
                            className="hover:bg-accent/[0.03] transition-colors group h-12 cursor-pointer"
                            onClick={() => {
                              if (log.run_id) router.push(`/traces/${log.run_id}`);
                            }}
                          >
                            <td className="px-6">
                              <div className="flex items-center">
                                {log.status === "success" ? (
                                  <div className="flex items-center gap-2 text-ok">
                                    <CheckCircle2 className="w-3.5 h-3.5" />
                                    <span className="text-[11px] font-bold uppercase">Success</span>
                                  </div>
                                ) : (
                                  <div className="flex items-center gap-2 text-bad">
                                    <AlertTriangle className="w-3.5 h-3.5" />
                                    <span className="text-[11px] font-bold uppercase">Error</span>
                                  </div>
                                )}
                              </div>
                            </td>
                            <td className="px-4 truncate font-bold text-accent uppercase tracking-tighter">
                              {log.node_name || log.agent?.name || "System"}
                            </td>
                            <td className="px-4 relative overflow-hidden">
                              <div className="flex items-center justify-between gap-4 w-full">
                                <span className="truncate flex-1 text-foreground/40 group-hover:text-foreground/70 transition-colors">
                                  {(log.output || log.input || "---").toString().replace(/\n/g, " ").slice(0, 100)}...
                                </span>
                              </div>
                            </td>
                            <td className="px-4 text-muted tabular-nums text-xs">
                              <div className="flex flex-col">
                                <span className="font-bold" suppressHydrationWarning>{formatDistanceToNow(new Date(log.created_at), { addSuffix: true })}</span>
                                <span className="text-[11px] opacity-80 uppercase">{format(new Date(log.created_at), "MMM d, HH:mm:ss")}</span>
                              </div>
                            </td>
                            <td className="px-6 text-right">
                              <Maximize2 className="w-3.5 h-3.5 text-accent opacity-0 group-hover:opacity-100 transition-all scale-75 group-hover:scale-100" />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center border border-dashed border-white/15 rounded-3xl p-20 bg-white/[0.01]">
          <Terminal className="w-12 h-12 text-muted mb-6" />
          <h3 className="text-[12px] font-bold text-muted uppercase tracking-[0.3em]">No Sequences Detected</h3>
          <p className="text-[11px] text-muted tracking-[0.2em] mt-3 font-mono-data italic uppercase">
            Cluster Registry Silent // Awaiting Initialization
          </p>
        </div>
      )}
    </div>
  );
}
