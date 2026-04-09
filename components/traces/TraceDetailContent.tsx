"use client";

import { useState, useEffect } from "react";
import { CheckCircle2, AlertTriangle, Clock, Coins, Database, Code2, PlaySquare, AlertOctagon, Terminal, Layers as LayersIcon, Zap } from "lucide-react";

export default function TraceDetailContent({ run, logs }: { run: any, logs: any[] }) {
  const [selectedLogId, setSelectedLogId] = useState<string | null>(logs.length > 0 ? logs[0].id : null);
  
  const selectedLog = logs.find(l => l.id === selectedLogId) || logs[0];

  if (!logs || logs.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center border border-dashed border-white/10 rounded-2xl bg-white/[0.01]">
        <AlertTriangle className="w-10 h-10 text-muted/20 mb-4" />
        <h3 className="text-sm font-bold text-muted/40 uppercase tracking-widest">No Trace Data Found</h3>
      </div>
    );
  }

  return (
    <div className="flex-1 flex gap-6 overflow-hidden h-full">
      
      {/* 1. Left Panel: Vertical Timeline */}
      <div className="w-80 flex-shrink-0 bg-surface border border-white/5 rounded-xl overflow-y-auto no-scrollbar relative">
        <div className="sticky top-0 bg-surface/80 backdrop-blur-xl z-10 p-4 border-b border-white/5">
          <h2 className="text-[10px] font-bold text-muted/60 uppercase tracking-widest flex items-center gap-2">
            <LayersIcon /> Execution Sequence
          </h2>
        </div>
        
        <div className="p-4">
          <div className="relative border-l border-white/10 ml-4 space-y-6 pb-4">
            {logs.map((log, index) => {
              const isSelected = log.id === selectedLogId;
              const isSuccess = log.status === "success";
              const isFailed = log.status === "failed";
              
              return (
                <div 
                  key={log.id} 
                  className="relative pl-6 cursor-pointer group"
                  onClick={() => setSelectedLogId(log.id)}
                >
                  {/* Status Node Connector */}
                  <div className={`absolute -left-[9px] top-1 rounded-full border-4 border-surface w-[18px] h-[18px] flex items-center justify-center transition-colors
                    ${isSelected ? 'scale-125' : ''}
                    ${isSuccess ? 'bg-green-500' : isFailed ? 'bg-red-500' : 'bg-yellow-500'}
                  `}>
                    <div className="w-1.5 h-1.5 rounded-full bg-background" />
                  </div>

                  <div className={`
                    p-3 rounded-lg border transition-all
                    ${isSelected 
                      ? isFailed ? 'bg-red-500/10 border-red-500/30' : 'bg-accent/10 border-accent/20 shadow-[0_0_15px_rgba(var(--accent-rgb),0.1)]' 
                      : 'bg-white/[0.01] border-white/5 hover:bg-white/[0.03]'}
                  `}>
                    <div className="flex items-center justify-between mb-1">
                      <span className={`text-[10px] font-bold uppercase tracking-tighter truncate max-w-[150px] ${isSelected ? 'text-foreground' : 'text-muted/80'}`}>
                        {log.node_name || log.agent?.name || "System"}
                      </span>
                      <div className="flex items-center gap-1">
                        {log.fallback_triggered && (
                          <div className="w-1.5 h-1.5 rounded-full bg-yellow-500 shadow-[0_0_5px_rgba(234,179,8,0.5)]" title="Fallback Triggered" />
                        )}
                        <span className="text-[9px] font-mono-data text-muted/40">Step {index + 1}</span>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-3 mt-2 text-[9px] font-mono-data">
                      <div className={`flex items-center gap-1 ${isSelected ? 'text-accent/80' : 'text-muted/40'}`}>
                        <Clock className="w-3 h-3" />
                        {log.duration_ms}ms
                      </div>
                      <div className={`flex items-center gap-1 ${isSelected ? 'text-foreground/80' : 'text-muted/40'}`}>
                        <Coins className="w-3 h-3" />
                        ₹{(log.step_cost || 0).toFixed(6)}
                      </div>
                      {log.model_used && (
                        <div className={`px-1.5 py-0.5 rounded-sm bg-white/5 text-[7px] font-black uppercase tracking-tighter border border-white/5 ${isSelected ? 'text-accent/60' : 'text-muted/20'}`}>
                          {log.model_used}
                        </div>
                      )}
                    </div>
                    
                    {isFailed && (
                      <div className="text-[9px] text-red-500/80 uppercase font-bold tracking-wider mt-2 bg-red-500/10 p-1 rounded">
                        Execution Failed
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* 2. Right Panel: Deep Inspection details */}
      <div className="flex-1 bg-surface border border-white/5 rounded-xl flex flex-col overflow-hidden relative">
        {selectedLog ? (
          <>
            <div className="p-4 border-b border-white/5 flex items-center justify-between bg-black/20">
              <div className="flex items-center gap-3">
                {selectedLog.status === "success" ? (
                  <CheckCircle2 className="w-5 h-5 text-green-500" />
                ) : (
                  <AlertTriangle className="w-5 h-5 text-red-500" />
                )}
                <div>
                  <h2 className="text-lg font-bold tracking-tight">{selectedLog.node_name || selectedLog.agent?.name || "System"}</h2>
                  <div className="text-[10px] text-muted/60 font-mono-data uppercase tracking-widest mt-0.5">
                    ID: {selectedLog.id}
                  </div>
                </div>
              </div>
              
              {/* Node Stats */}
              <div className="flex flex-col items-end gap-2">
                <div className="flex items-center gap-4 bg-white/[0.02] border border-white/5 rounded-lg px-3 py-2">
                  <div className="flex items-center gap-2">
                    <Database className="w-3.5 h-3.5 text-accent/60" />
                    <div className="font-mono-data text-[10px]">
                      <span className="text-muted/40 uppercase">Tokens:</span>
                      <span className="ml-1 font-bold text-accent">{selectedLog.total_tokens || 0}</span>
                      <span className="text-muted/40 ml-1">({selectedLog.prompt_tokens || 0} in / {selectedLog.completion_tokens || 0} out)</span>
                    </div>
                  </div>
                </div>
                {selectedLog.fallback_triggered && (
                  <div className="text-[8px] font-bold text-yellow-500 uppercase tracking-widest flex items-center gap-1 bg-yellow-500/10 px-2 py-0.5 rounded border border-yellow-500/20">
                    <Zap className="w-2.5 h-2.5" /> Fallback Mechanism Active
                  </div>
                )}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-6 no-scrollbar relative">
              
              {/* Error Block */}
              {selectedLog.status === "failed" && selectedLog.error && (
                <div className="border border-red-500/20 bg-red-500/5 rounded-xl p-4">
                  <div className="flex items-center gap-2 text-red-500 mb-2">
                    <AlertOctagon className="w-4 h-4" />
                    <h3 className="text-[10px] font-bold uppercase tracking-widest">Runtime Error</h3>
                  </div>
                  <pre className="text-[11px] font-mono-data text-red-400 whitespace-pre-wrap leading-relaxed">
                    {selectedLog.error}
                  </pre>
                </div>
              )}

              {/* System Prompt */}
              {selectedLog.system_prompt && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h3 className="text-[10px] font-bold text-muted/60 uppercase tracking-widest flex items-center gap-2">
                      <Code2 className="w-3.5 h-3.5" /> System Prompt
                    </h3>
                  </div>
                  <div className="bg-black/60 border border-white/5 rounded-xl p-4 overflow-x-auto">
                    <pre className="text-[12px] font-mono-data text-[#88c0d0] whitespace-pre-wrap leading-relaxed">
                      {selectedLog.system_prompt}
                    </pre>
                  </div>
                </div>
              )}

              {/* Input Payload */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-[10px] font-bold text-muted/60 uppercase tracking-widest flex items-center gap-2">
                    <PlaySquare className="w-3.5 h-3.5" /> Input Payload
                  </h3>
                </div>
                <div className="bg-black/60 border border-white/5 rounded-xl p-4 overflow-x-auto">
                  <pre className="text-[12px] font-mono-data text-[#ebcb8b] whitespace-pre-wrap leading-relaxed">
                    {selectedLog.input 
                      ? (typeof selectedLog.input === 'object' ? JSON.stringify(selectedLog.input, null, 2) : selectedLog.input.toString()) 
                      : "---"}
                  </pre>
                </div>
              </div>

              {/* Output Response */}
              {selectedLog.output && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h3 className="text-[10px] font-bold text-muted/60 uppercase tracking-widest flex items-center gap-2">
                      <Terminal className="w-3.5 h-3.5" /> Output Response
                    </h3>
                  </div>
                  <div className="bg-black/60 border border-white/5 rounded-xl p-4 overflow-x-auto">
                    <pre className="text-[12px] font-mono-data text-[#a3be8c] whitespace-pre-wrap leading-relaxed">
                      {typeof selectedLog.output === 'object' 
                        ? JSON.stringify(selectedLog.output, null, 2) 
                        : selectedLog.output.toString()}
                    </pre>
                  </div>
                </div>
              )}

            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <p className="text-xs text-muted/40 font-mono-data uppercase tracking-widest">Select a step to inspect payload</p>
          </div>
        )}
      </div>

    </div>
  );
}


