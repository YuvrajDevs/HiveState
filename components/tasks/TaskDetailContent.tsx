"use client";
import { one, parseCanvas, type CanvasNode, type Log, type Run } from "@/types/domain";

import { useEffect, useRef, useState } from "react";
import { 
  CheckCircle2, 
  AlertTriangle, 
  Clock, 
  Coins, 
  Database, 
  Code2, 
  
  AlertOctagon, 
  Terminal,
  Layers,
  ChevronRight,
  Copy,
  Check,
  Zap,
  Activity,
  
  Loader2,
  Pause,
  Play
} from "lucide-react";
import { resumeTask, approveTask, rejectTask } from "@/app/actions/tasks";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";

export default function TaskDetailContent({ initialRun, initialLogs }: { initialRun: Run; initialLogs: Log[] }) {
  const [run, setRun] = useState(initialRun);
  const [logs, setLogs] = useState(initialLogs);
  const [selectedLogId, setSelectedLogId] = useState<string | null>(initialLogs.length > 0 ? initialLogs[initialLogs.length - 1].id : null);
  const [isPolling, setIsPolling] = useState(run?.status === "running" || run?.status === "resumed");
  const [copied, setCopied] = useState(false);
  // The edited input belongs to one step; switching steps shows that step's own input again
  const [inputEdit, setInputEdit] = useState<{ logId: string | null; value: string } | null>(null);
  const [correctionNote, setCorrectionNote] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showCompletionModal, setShowCompletionModal] = useState(false);
  const [hasShownCompletion, setHasShownCompletion] = useState(false);

  const selectedLog = logs.find(l => l.id === selectedLogId) || (logs.length > 0 ? logs[logs.length - 1] : null);

  const editedInput = inputEdit && inputEdit.logId === (selectedLog?.id ?? null) ? inputEdit.value : selectedLog?.input || "";
  const setEditedInput = (value: string) => setInputEdit({ logId: selectedLog?.id ?? null, value });

  // Read inside the polling interval: refs, so each tick sees the latest values, not the ones from when polling began
  const statusRef = useRef(run.status);
  const shownCompletionRef = useRef(hasShownCompletion);
  useEffect(() => {
    statusRef.current = run.status;
    shownCompletionRef.current = hasShownCompletion;
  });

  // Poll for updates if the task is still running
  useEffect(() => {
    if (!isPolling) return;

    const interval = setInterval(async () => {
      try {
        const [runRes, logsRes] = await Promise.all([
          fetch(`/api/tasks/${run.id}`),
          fetch(`/api/tasks/${run.id}/logs`)
        ]);

        if (runRes.ok && logsRes.ok) {
          const runData = await runRes.json();
          const logsData = await logsRes.json();

          const prevStatus = statusRef.current;
          setRun(runData.run);
          setLogs(logsData.logs);
          // Follow the newest step while the run is live
          if (logsData.logs.length > 0) setSelectedLogId(logsData.logs[logsData.logs.length - 1].id);

          // Auto-trigger completion modal ONCE when status flips to completed
          if (runData.run.status === "completed" && prevStatus !== "completed" && !shownCompletionRef.current) {
            setShowCompletionModal(true);
            setHasShownCompletion(true);
          }

          if (runData.run.status !== "running" && runData.run.status !== "resumed") {
            setIsPolling(false);
            clearInterval(interval);
          }
        }
      } catch (err) {
        console.error("Polling error:", err);
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [isPolling, run.id]);

  const lastSuccessfulLog = [...logs].reverse().find(l => l.status === "success");

  // Calculate progress
  const canvas = parseCanvas(one(run.workflow)?.canvas_json);
  const totalSteps = canvas.nodes?.length || 0;
  const completedSteps = logs.filter(l => l.status === "success").length;
  // Ensure 100% if status is completed, regardless of step count math
  let progressPercent = totalSteps > 0 ? Math.min(Math.round((completedSteps / totalSteps) * 100), 100) : 0;
  if (run.status === "completed") progressPercent = 100;

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex-1 flex flex-col gap-6 overflow-hidden h-full">
      
      {/* 0. Enhanced Header Section */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Status Card */}
        <div className="md:col-span-2 modern-card p-4 flex items-center justify-between bg-white/[0.02]">
          <div className="flex items-center gap-4">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
              run.status === "completed" ? "bg-white/[0.04] text-success" :
              run.status === "failed" || run.status === "paused_error" ? "bg-white/[0.04] text-danger" :
              "bg-white/[0.04] text-warning"
            }`}>
              {run.status === "running" || run.status === "resumed" ? <Activity className="w-5 h-5" /> : 
               run.status === "completed" ? <CheckCircle2 className="w-5 h-5" /> : 
               run.status === "paused_hitl" ? <Pause className="w-5 h-5" /> :
               <AlertOctagon className="w-5 h-5" />}
            </div>
            <div>
              <div className="text-xs text-muted/80 font-semibold mb-0.5">Status</div>
              <h1 className="text-sm font-semibold tracking-tight flex items-center gap-2">
                {run.status === "running" ? "Running" : 
                 run.status === "resumed" ? "Resuming" :
                 run.status === "paused_hitl" ? "Waiting for review" :
                 run.status === "paused_error" ? "Paused on Error" :
                 run.status === "completed" ? "Run complete" : "Run failed"}
                {(run.status === "running" || run.status === "resumed") && <span className="flex h-1.5 w-1.5 rounded-full bg-accent animate-ping" />}
              </h1>
            </div>
          </div>
          <div className="text-right flex items-center gap-4">
            <div>
              <div className="text-xs text-muted/80 font-semibold mb-0.5">Progress</div>
              <div className="text-sm font-mono-data font-bold text-foreground/70">{progressPercent}%</div>
            </div>
            
            <Link 
              href={`/workflows/${run.workflow_id}?runId=${run.id}`}
              className="px-4 py-2 bg-accent/10 hover:bg-accent/20 border border-accent/20 rounded-xl text-xs font-semibold text-accent transition-all flex items-center gap-2"
            >
              <Activity className="w-3.5 h-3.5" />
              View canvas
            </Link>
          </div>
        </div>

        {/* Compute Metrics */}
        <div className="modern-card p-4 bg-white/[0.02] border border-white/5">
          <div className="text-micro text-muted/80 font-semibold mb-2 flex items-center gap-2">
            <Database className="w-3 h-3" /> Compute
          </div>
          <div className="flex items-end justify-between">
            <div className="text-lg font-mono-data font-bold text-accent">₹{(run.total_cost || 0).toFixed(6)}</div>
            <div className="text-xs font-mono-data text-muted/80 mb-1">{(run.total_tokens || 0).toLocaleString()} tokens</div>
          </div>
        </div>

        {/* Time Metrics */}
        <div className="modern-card p-4 bg-white/[0.02] border border-white/5">
          <div className="text-micro text-muted/80 font-semibold mb-2 flex items-center gap-2">
            <Clock className="w-3 h-3" /> Runtime
          </div>
          <div className="flex items-end justify-between">
            <div className="text-lg font-mono-data font-bold text-foreground/80">
              {run.total_duration_ms ? `${(run.total_duration_ms / 1000).toFixed(1)}s` : "---"}
            </div>
            <div className="text-xs font-mono-data text-muted/80 mb-1 flex items-center gap-1">
               {totalSteps} steps
            </div>
          </div>
        </div>
      </div>

      {/* 0.1 Intervention Panels */}
      {(run.status === "paused_error" || run.status === "paused_hitl") && (
        <div className="p-6 rounded-2xl border border-white/10 bg-surface">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="flex items-center gap-5">
              <div className={`w-12 h-12 rounded-2xl bg-surface-2 flex items-center justify-center ${
                run.status === "paused_error" ? "text-danger" : "text-warning"
              }`}>
                {run.status === "paused_error" ? <AlertTriangle className="w-6 h-6" /> : <Clock className="w-6 h-6" />}
              </div>
              <div className="space-y-1">
                <h2 className="text-lg font-semibold tracking-tight">
                  {run.pause_reason === "circuit_breaker" 
                    ? "Stopped after repeated failures" 
                    : run.pause_reason === "budget_limit"
                    ? "Daily budget reached"
                    : run.status === "paused_error" ? "Paused after an error" : "Your review is needed"}
                </h2>

                <p className="text-xs text-muted/85 font-medium leading-relaxed">
                  {run.pause_reason === "circuit_breaker"
                    ? `System halted after ${run.consecutive_failures_count} consecutive failures to prevent unstable execution. Review the failure logs below.`
                    : run.pause_reason === "budget_limit"
                    ? `Execution paused because the daily spend limit (₹${run.budget_limit || 100}) has been reached. Increase the limit in settings to resume.`
                    : run.status === "paused_error" 
                    ? "The agent encountered an unexpected failure. Review the input below, optionally fix it, and resume."
                    : (canvas.nodes?.find((n: CanvasNode) => n.id === selectedLog?.node_id)?.data?.instructions || "This node is marked for manual review. Approve to continue or Reject with a correction note.")}
                </p>


              </div>
            </div>

            <div className="flex items-center gap-3">
              {run.status === "paused_error" ? (
                <button 
                  onClick={async () => {
                    setIsSubmitting(true);
                    await resumeTask(run.id, selectedLog?.node_id ?? undefined, editedInput);
                    setIsPolling(true);
                    setIsSubmitting(false);
                  }}
                  disabled={isSubmitting}
                  className="px-6 py-3 bg-danger hover:bg-danger text-white rounded-xl font-semibold text-xs shadow-lg transition-all flex items-center gap-2"
                >
                  {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                  {run.circuit_breaker_triggered ? "Reset & Retry" : "Debug & Resume"}
                </button>

              ) : (
                <>
                   <button 
                    onClick={async () => {
                      setIsSubmitting(true);
                      await approveTask(run.id, selectedLog?.node_id ?? "", correctionNote);
                      setIsPolling(true);
                      setIsSubmitting(false);
                    }}
                    disabled={isSubmitting}
                    className="px-5 py-2.5 bg-accent hover:bg-accent/90 text-white rounded-xl font-semibold text-sm transition-colors flex items-center gap-2"
                  >
                    {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                    Approve and continue
                  </button>
                  <button 
                    onClick={async () => {
                      if (!correctionNote) {
                        alert("Please provide a correction note for rejection.");
                        return;
                      }
                      setIsSubmitting(true);
                      await rejectTask(run.id, selectedLog?.node_id ?? "", correctionNote);
                      setIsSubmitting(false);
                      setIsPolling(false);
                    }}
                    disabled={isSubmitting}
                    className="px-6 py-3 bg-white/5 hover:bg-white/10 border border-white/10 text-foreground/80 rounded-xl font-semibold text-xs transition-all"
                  >
                    Reject
                  </button>

                </>
              )}
            </div>
          </div>

          {/* Correction / Edit Area */}
          <div className="mt-6 p-4 bg-black/40 rounded-xl border border-white/5 space-y-4">
             <div className="flex items-center gap-2 text-micro font-semibold text-muted/80">
                <Code2 className="w-3.5 h-3.5" /> 
                {run.status === "paused_error" ? "Node Input Overlay (Editable)" : "Note for the next step"}
             </div>
             {run.status === "paused_error" ? (
               <textarea 
                value={editedInput}
                onChange={(e) => setEditedInput(e.target.value)}
                className="w-full bg-white/[0.02] border border-white/10 rounded-lg p-4 text-xs font-mono-data text-code-input min-h-[150px] focus:outline-none focus:border-white/10 transition-colors"
                placeholder="Adjust payload logic..."
               />
             ) : (
               <textarea 
                value={correctionNote}
                onChange={(e) => setCorrectionNote(e.target.value)}
                className="w-full bg-white/[0.02] border border-white/10 rounded-lg p-3 text-xs font-mono-data text-foreground/70 min-h-[80px] focus:outline-none focus:border-white/10 transition-colors"
                placeholder="Add reasoning for rejection or specific instructions..."
               />
             )}
          </div>
        </div>
      )}

      {/* Progress Bar (Global) */}
      <div className="h-1 w-full bg-white/5 rounded-full overflow-hidden">
        <div 
          className={`h-full transition-all duration-1000 ease-out ${
            run.status === "failed" ? "bg-danger" : "bg-accent"
          }`}
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      {/* Main Content Layout */}
      <div className="flex-1 flex gap-6 min-h-0">
        
        {/* 1. Left Panel: Vertical Timeline */}
        <div className="w-80 flex-shrink-0 bg-surface border border-white/5 rounded-2xl overflow-y-auto no-scrollbar relative flex flex-col">
          <div className="sticky top-0 bg-surface/80 backdrop-blur-xl z-20 p-4 border-b border-white/5 flex items-center justify-between">
            <h2 className="text-xs font-semibold text-muted/80 flex items-center gap-2">
              <Layers className="w-3.5 h-3.5" /> Steps
            </h2>
            <div className="text-micro font-mono-data text-muted/80">
              {logs.length} {logs.length === 1 ? "step" : "steps"} logged
            </div>
          </div>
          
          <div className="p-4 flex-1">
            <div className="relative border-l border-white/5 ml-4 space-y-4 pb-6">
              {logs.length === 0 ? (
                <div className="py-20 text-center flex flex-col items-center justify-center gap-4 opacity-20">
                  <Loader2 className="w-6 h-6 animate-spin text-accent" />
                  <p className="text-xs font-semibold">Waiting for Engine...</p>
                </div>
              ) : (
                logs.map((log, index) => {
                  const isSelected = log.id === selectedLogId;
                  const isSuccess = log.status === "success";
                  const isFailed = log.status === "failed";
                  const isLast = index === logs.length - 1;
                  
                  return (
                    <div 
                      key={log.id} 
                      className="relative pl-6 cursor-pointer group"
                      onClick={() => setSelectedLogId(log.id)}
                    >
                      {/* Connection Line Visual */}
                      {!isLast && <div className="absolute left-[-1px] top-6 bottom-[-16px] w-[1px] bg-white/5 group-hover:bg-accent/20 transition-colors" />}

                      <div className={`absolute -left-[9px] top-1.5 rounded-full border-4 border-surface w-[18px] h-[18px] flex items-center justify-center transition-all duration-300
                        ${isSelected ? 'scale-125 z-10' : 'scale-100'}
                        ${isSuccess ? 'bg-success shadow-[0_0_10px_rgba(34,197,94,0.3)]' : 
                          isFailed ? 'bg-danger shadow-[0_0_10px_rgba(239,68,68,0.3)]' : 
                          'bg-warning shadow-[0_0_10px_rgba(234,179,8,0.3)] animate-pulse'}
                      `}>
                        <div className="w-1.5 h-1.5 rounded-full bg-background" />
                      </div>

                      <div className={`
                        p-3 rounded-xl border transition-all duration-200
                        ${isSelected 
                          ? isFailed ? 'bg-white/[0.04] border-white/10' : 'bg-accent/10 border-accent/20 shadow-[0_8px_30px_rgba(0,0,0,0.3)]' 
                          : 'bg-white/[0.01] border-white/5 hover:bg-white/[0.03]'}
                      `}>
                        <div className="flex items-center justify-between gap-2 overflow-hidden mb-2">
                          <span className={`text-xs font-semibold tracking-tight truncate flex-1 ${isSelected ? 'text-foreground' : 'text-muted/85'}`}>
                            {log.node_name || one(log.agent)?.name || "Agent"}
                          </span>
                          <span className="text-micro font-mono-data text-muted/80 shrink-0">Step {index + 1}</span>
                        </div>
                        
                        <div className="flex items-center gap-3 text-micro font-mono-data opacity-60">
                          <div className={`flex items-center gap-1 ${isSelected ? 'text-foreground/60' : 'text-muted/80'}`}>
                            <Clock className="w-2.5 h-2.5 opacity-50" />
                            {log.duration_ms || 0}ms
                          </div>
                          <div className={`flex items-center gap-1 ${isSelected ? 'text-accent' : 'text-accent/30'}`}>
                            <Coins className="w-2.5 h-2.5 opacity-50" />
                            ₹{(log.step_cost || 0).toFixed(5)}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* 2. Right Panel: Deep Inspection details */}
        <div className="flex-1 bg-surface border border-white/5 rounded-2xl flex flex-col overflow-hidden relative shadow-2xl">
          {selectedLog ? (
            <>
              <div className="p-4 border-b border-white/5 flex items-center justify-between bg-black/40 backdrop-blur-md sticky top-0 z-10">
                <div className="flex items-center gap-4">
                  <div className={`p-2 rounded-lg ${
                    selectedLog.status === "success" ? "bg-white/[0.04] text-success" :
                    selectedLog.status === "failed" ? "bg-white/[0.04] text-danger" :
                    "bg-white/[0.04] text-warning"
                  }`}>
                    {selectedLog.status === "success" ? <CheckCircle2 className="w-4 h-4" /> : 
                     selectedLog.status === "failed" ? <AlertOctagon className="w-4 h-4" /> : 
                     <Loader2 className="w-4 h-4 animate-spin" />}
                  </div>
                  <div>
                    <h2 className="text-sm font-semibold tracking-tight">{selectedLog.node_name || one(selectedLog.agent)?.name || "Working"}</h2>
                    <div className="text-micro text-muted/80 mt-0.5">
                      Step ID {selectedLog.id.split("-")[0]}
                    </div>
                  </div>
                </div>
                
                  <div className="flex items-center gap-4 bg-white/[0.03] border border-white/5 rounded-xl px-3 py-1.5">
                    <div className="flex items-center gap-2 border-r border-white/10 pr-3">
                      <Database className="w-3 h-3 text-accent/60" />
                      <div className="font-mono-data text-xs">
                        <span className="text-muted/80">Prompt:</span>
                        <span className="ml-1 font-bold text-accent">{selectedLog.prompt_tokens || 0}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 border-r border-white/10 pr-3">
                      <Zap className="w-3 h-3 text-accent/60" />
                      <div className="font-mono-data text-xs">
                        <span className="text-muted/80">Completion:</span>
                        <span className="ml-1 font-bold text-accent">{selectedLog.completion_tokens || 0}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Activity className="w-3 h-3 text-accent/60" />
                      <div className="font-mono-data text-xs">
                        <span className="text-muted/80">Total:</span>
                        <span className="ml-1 font-bold text-accent">{selectedLog.total_tokens || 0}</span>
                      </div>
                    </div>
                  </div>
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-8 no-scrollbar relative">
                
                {/* Final Output if Task is done - ALWAYS SHOW AT TOP IF COMPLETED */}
                {run.status === "completed" && lastSuccessfulLog && (
                  <div className="space-y-4 animate-in fade-in zoom-in-95 duration-500">
                    <div className="flex items-center justify-between border-b border-white/10 pb-2">
                       <h3 className="text-xs font-semibold text-success flex items-center gap-2">
                        <Zap className="w-3.5 h-3.5 fill-current" /> Final system output
                      </h3>
                      <button 
                        onClick={() => copyToClipboard(lastSuccessfulLog.output?.toString() || "")}
                        className="flex items-center gap-2 text-micro font-semibold text-accent hover:text-white transition-all bg-accent/10 hover:bg-accent/30 border border-accent/20 px-3 py-1.5 rounded-lg"
                      >
                        {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                        {copied ? "Copied" : "Copy result"}
                      </button>
                    </div>
                    <div className="bg-white/[0.04] border border-white/10 rounded-2xl p-6 relative group overflow-hidden">
                      <div className="absolute top-0 right-0 p-4 opacity-[0.03] text-success group-hover:scale-110 transition-transform">
                        <CheckCircle2 className="w-24 h-24" />
                      </div>
                      <div className="relative z-10 text-body-sm leading-relaxed text-foreground/90 font-medium font-mono-data whitespace-pre-wrap">
                        {lastSuccessfulLog.output?.toString() || "No output generated."}
                      </div>
                    </div>
                  </div>
                )}

                {/* Error Block */}
                {selectedLog.status === "failed" && selectedLog.error && (
                  <div className="border border-white/10 bg-white/[0.04] rounded-2xl p-6">
                    <div className="flex items-center gap-2 text-danger mb-4">
                      <AlertOctagon className="w-4 h-4" />
                      <h3 className="text-xs font-semibold">Run failed</h3>
                    </div>
                    <div className="bg-black/40 rounded-xl p-4 border border-white/10">
                      <pre className="text-micro font-mono-data text-danger whitespace-pre-wrap leading-relaxed">
                        {selectedLog.error}
                      </pre>
                      {selectedLog.error_code && (
                        <div className="mt-4 pt-4 border-t border-white/10 text-micro font-semibold text-danger/40">
                          Error Code: {selectedLog.error_code}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Technical Inspector: Payload Breakdown */}
                <div className="space-y-6">
                  <div className="flex items-center gap-2 pb-2 border-b border-white/5">
                    <Terminal className="w-3.5 h-3.5 text-muted/80" />
                    <h3 className="text-xs font-semibold text-muted/85">Payload inspector</h3>
                  </div>

                  {/* Input */}
                  <div className="space-y-3">
                    <label className="text-micro font-semibold text-muted/80 px-1 flex items-center gap-2">
                       <ChevronRight className="w-3 h-3" /> Input context
                    </label>
                    <div className="bg-black/60 border border-white/5 rounded-xl overflow-hidden">
                      {selectedLog.input && selectedLog.input.startsWith('{"inputs":') ? (
                        <div className="divide-y divide-white/5">
                          {(() => {
                            try {
                              const parsed = JSON.parse(selectedLog.input);
                              return parsed.inputs.map((inp: { source_node?: string; name?: string; output?: string; content?: string }, idx: number) => (
                                <div key={idx} className="p-4 space-y-2 hover:bg-white/[0.02] transition-colors">
                                  <div className="flex items-center gap-2">
                                    <Layers className="w-3 h-3 text-accent" />
                                    <span className="text-xs font-semibold text-accent">{inp.source_node}</span>
                                  </div>
                                  <div className="text-micro font-mono-data text-foreground/70 whitespace-pre-wrap leading-relaxed">
                                    {inp.content}
                                  </div>
                                </div>
                              ));
                            } catch {
                              return <pre className="p-4 text-xs font-mono-data text-danger">{selectedLog.input}</pre>;
                            }
                          })()}
                        </div>
                      ) : (
                        <pre className="p-4 text-xs font-mono-data text-code-input/90 whitespace-pre-wrap leading-relaxed max-h-[300px] overflow-y-auto no-scrollbar">
                          {selectedLog.input 
                            ? (typeof selectedLog.input === 'object' ? JSON.stringify(selectedLog.input, null, 2) : selectedLog.input.toString()) 
                            : "NULL_CONTEXT"}
                        </pre>
                      )}
                    </div>
                  </div>

                  {/* Output */}
                  {selectedLog.output && (
                    <div className="space-y-3">
                      <label className="text-micro font-semibold text-muted/80 px-1 flex items-center gap-2">
                        <ChevronRight className="w-3 h-3" /> Output payload
                      </label>
                      <div className="bg-black/60 border border-white/5 rounded-xl p-4">
                        <pre className="text-xs font-mono-data text-code-output/90 whitespace-pre-wrap leading-relaxed max-h-[400px] overflow-y-auto no-scrollbar">
                          {typeof selectedLog.output === 'object' 
                            ? JSON.stringify(selectedLog.output, null, 2) 
                            : selectedLog.output.toString()}
                        </pre>
                      </div>
                    </div>
                  )}

                   {/* System Instruction */}
                   {selectedLog.system_prompt && (
                    <div className="space-y-3">
                      <label className="text-micro font-semibold text-muted/80 px-1 flex items-center gap-2">
                        <ChevronRight className="w-3 h-3" /> System strategy
                      </label>
                      <div className="bg-black/60 border border-white/5 rounded-xl p-4">
                        <pre className="text-micro font-mono-data text-accent/40 whitespace-pre-wrap leading-relaxed max-h-[200px] overflow-y-auto no-scrollbar">
                          {selectedLog.system_prompt}
                        </pre>
                      </div>
                    </div>
                  )}
                </div>

              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center py-20 opacity-20">
              <Terminal className="w-12 h-12 mb-4" />
              <p className="text-xs">No execution slice selected</p>
            </div>
          )}
        </div>

      </div>

      {/* Completion Modal */}
      <AnimatePresence>
        {showCompletionModal && lastSuccessfulLog && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="modern-card max-w-2xl w-full bg-surface border-white/10 shadow-2xl overflow-hidden rounded-3xl"
            >
              <div className="p-8 space-y-6">
                <div className="flex items-center gap-5">
                  <div className="w-16 h-16 rounded-2xl bg-white/[0.04] text-success flex items-center justify-center">
                    <CheckCircle2 className="w-8 h-8" />
                  </div>
                  <div>
                    <h2 className="text-xl font-semibold tracking-tight">Run completed</h2>
                    <p className="text-sm text-muted/80 font-medium">Global state finalized and persisted to vector engine.</p>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-muted/80">Final output</label>
                    <button 
                      onClick={() => copyToClipboard(lastSuccessfulLog.output?.toString() || "")}
                      className="text-xs font-semibold text-accent flex items-center gap-2 hover:opacity-80 transition-opacity"
                    >
                      {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                      {copied ? "Result copied" : "Copy to Clipboard"}
                    </button>
                  </div>
                  <div className="bg-black/40 border border-white/5 rounded-2xl p-6 overflow-y-auto max-h-[300px] no-scrollbar">
                    <pre className="text-sm font-mono-data text-foreground/80 whitespace-pre-wrap leading-relaxed">
                      {lastSuccessfulLog.output?.toString() || "Success acknowledged by engine."}
                    </pre>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <Link
                    href={`/workflows/${run.workflow_id}?runId=${run.id}`}
                    className="flex items-center justify-center gap-3 py-4 bg-accent/10 hover:bg-accent/20 border border-accent/20 rounded-2xl font-semibold text-xs text-accent transition-all"
                  >
                    <Activity className="w-4 h-4" />
                    Inspect flow
                  </Link>
                  <button
                    onClick={() => setShowCompletionModal(false)}
                    className="py-4 bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl font-semibold text-xs text-foreground/60 transition-all"
                  >
                    Dismiss trace
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

