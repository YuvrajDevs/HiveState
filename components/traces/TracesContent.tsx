"use client";
import { one, type Log, type Workflow } from "@/types/domain";
import { STATUS_TONE as TONE, logLabel, runLabel } from "@/lib/status";

import { useState, useMemo } from "react";
import { Terminal, AlertTriangle, CheckCircle2, Maximize2, Filter, Layers, ChevronDown, ChevronRight } from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";
import { useRouter } from "next/navigation";


export default function TracesContent({ 
  initialLogs, 
  workflows 
}: { 
  initialLogs: Log[],
  workflows: Pick<Workflow, "id" | "name">[]
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
    const groups: Record<string, Log[]> = {};
    
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
      const name = one(one(earliestLog.run)?.workflow)?.name || one(one(earliestLog.agent)?.workflow)?.name || "Deleted workflow";
      const timestamp = earliestLog.created_at;
      // The run's own status, not a guess from its steps: a paused or running run is not a success
      const status = runLabel(one(earliestLog.run)?.status, logs.some((l) => l.status === "failed"));
      
      return { runId, name, logs, timestamp, status };
    }).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, [groupedLogs]);

  // Handle workflow filtering at the UI level
  const filteredRuns = useMemo(() => {
    if (filterWorkflowId === "all") return runList;
    return runList.filter(run => {
      const firstLog = run.logs[0];
      const wId = one(one(firstLog.run)?.workflow)?.id || one(one(firstLog.agent)?.workflow)?.id;
      return wId === filterWorkflowId;
    });
  }, [runList, filterWorkflowId]);

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden gap-4">
      {/* Filter & Control Bar */}
      <div className="flex items-center justify-between bg-white/[0.02] border border-white/5 p-3 rounded-xl">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 text-xs font-semibold text-muted/80 px-2">
            <Filter className="w-3.5 h-3.5" />
            Filter
          </div>
          <select 
            value={filterWorkflowId}
            onChange={(e) => setFilterWorkflowId(e.target.value)}
            className="bg-black/40 border border-white/10 text-xs px-3 py-1.5 rounded-lg outline-none focus:ring-1 focus:ring-accent/50 transition-all cursor-pointer font-semibold"
          >
            <option value="all">All workflows</option>
            {workflows.map(w => (
              <option key={w.id} value={w.id}>{w.name}</option>
            ))}
          </select>
        </div>
        
      </div>

      {filteredRuns.length > 0 ? (
        <div className="flex-1 overflow-auto no-scrollbar space-y-4">
          {filteredRuns.map((run, index) => {
            const isExpanded = expandedWorkflows[run.runId] !== undefined 
              ? expandedWorkflows[run.runId] 
              : index === 0; // Default expanded for the latest run only
            
            return (
              <div key={run.runId} className="bg-surface border border-white/5 rounded-2xl overflow-hidden shadow-sm">
                {/* Run Header */}
                <div 
                  className="p-4 bg-white/[0.03] flex items-center justify-between cursor-pointer hover:bg-white/[0.05] transition-colors group"
                  onClick={() => toggleWorkflow(run.runId)}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-lg border flex items-center justify-center ${
                      TONE[run.status.tone].box
                    }`}>
                      <Layers className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="flex items-center gap-3">
                        <h3 className="text-sm font-semibold tracking-tight text-foreground/80">{run.name}</h3>
                        <span className={`text-micro px-1.5 py-0.5 font-semibold rounded-sm ${
                          TONE[run.status.tone].chip
                        }`}>
                          {run.status.text}
                        </span>
                      </div>
                      <p className="text-micro text-muted/80 mt-0.5">
                        {format(new Date(run.timestamp), "MMM d, HH:mm:ss")} — {run.logs.length} {run.logs.length === 1 ? "step" : "steps"}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-xs text-muted/80 opacity-0 group-hover:opacity-100 transition-opacity font-semibold">
                      RUN: {run.runId.split("-")[0]}
                    </div>
                    {isExpanded ? <ChevronDown className="w-4 h-4 text-muted/80" /> : <ChevronRight className="w-4 h-4 text-muted/80" />}
                  </div>
                </div>

                {/* Workflow Logs Table */}
                {isExpanded && (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse font-mono-data text-micro table-fixed">
                      <thead>
                        <tr className="border-t border-b border-white/5 bg-black/20 text-muted/80 h-10">
                          <th className="px-6 w-[80px] font-bold">Status</th>
                          <th className="px-4 w-[120px] font-bold">Agent node</th>
                          <th className="px-4 font-bold">Output preview</th>
                          <th className="px-4 w-[150px] font-bold">Trace date</th>
                          <th className="px-6 w-[60px] font-bold text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/[0.02]">
                        {run.logs.map((log) => (
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
                                  <div className="flex shrink-0 items-center gap-2 whitespace-nowrap pr-3 text-success">
                                    <CheckCircle2 className="w-3.5 h-3.5" />
                                    <span className="text-micro font-semibold">{logLabel(log.status).text}</span>
                                  </div>
                                ) : (
                                  <div className={`flex shrink-0 items-center gap-2 whitespace-nowrap pr-3 ${TONE[logLabel(log.status).tone].text}`}>
                                    <AlertTriangle className="w-3.5 h-3.5" />
                                    <span className="text-micro font-semibold">{logLabel(log.status).text}</span>
                                  </div>
                                )}
                              </div>
                            </td>
                            <td className="px-4 truncate font-semibold text-accent/80">
                              {log.node_name || one(log.agent)?.name || "System"}
                            </td>
                            <td className="px-4 relative overflow-hidden">
                              <div className="flex items-center justify-between gap-4 w-full">
                                <span className="truncate flex-1 text-foreground/40 group-hover:text-foreground/70 transition-colors">
                                  {(log.output || log.input || "---").toString().replace(/\n/g, " ").slice(0, 100)}...
                                </span>
                              </div>
                            </td>
                            <td className="px-4 text-muted/80 tabular-nums text-xs">
                              <div className="flex flex-col">
                                <span className="font-bold" suppressHydrationWarning>{formatDistanceToNow(new Date(log.created_at), { addSuffix: true })}</span>
                                <span className="text-micro opacity-50">{format(new Date(log.created_at), "MMM d, HH:mm:ss")}</span>
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
        <div className="flex-1 flex flex-col items-center justify-center border border-dashed border-white/10 rounded-3xl p-20 bg-white/[0.01]">
          <Terminal className="w-12 h-12 text-muted/5 mb-6" />
          <h3 className="text-xs font-semibold text-muted/80">No traces yet</h3>
          <p className="text-micro text-muted/85 mt-3">
            Run a workflow and each step will appear here.
          </p>
        </div>
      )}
    </div>
  );
}
