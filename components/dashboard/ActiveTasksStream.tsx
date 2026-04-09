"use client";

import { useState, useEffect } from "react";
import { Loader2, ChevronLeft, ChevronRight, XCircle, AlertCircle, Activity } from "lucide-react";
import Link from "next/link";
import { StopTaskButton } from "@/components/tasks/StopTaskButton";
import { stopAllTasks } from "@/app/actions/tasks";
import { motion, AnimatePresence } from "framer-motion";

interface ActiveTasksStreamProps {
  initialTasks: any[];
  workflows: any[];
}

export function ActiveTasksStream({ initialTasks, workflows }: ActiveTasksStreamProps) {
  const [tasks, setTasks] = useState(initialTasks);
  const [dismissedTaskIds, setDismissedTaskIds] = useState<string[]>([]);
  const [page, setPage] = useState(0);
  const [errorNotification, setErrorNotification] = useState<string | null>(null);
  const itemsPerPage = 3;

  // Load dismissed from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem("hivestate_dismissed_tasks");
    if (saved) {
      try {
        setDismissedTaskIds(JSON.parse(saved));
      } catch (e) {
        console.error("Failed to parse dismissed tasks", e);
      }
    }
  }, []);

  // Poll for status updates and detect errors
  useEffect(() => {
    if (tasks.length === 0) return;

    const interval = setInterval(async () => {
      try {
        const res = await fetch("/api/tasks/running");
        if (res.ok) {
          const data = await res.json();
          const newTasks = data.tasks || [];
          
          // Check for alerts (recently failed tasks)
          if (data.alerts && data.alerts.length > 0) {
            // Take the first alert to show
            setErrorNotification(data.alerts[0].message);
            // In a real system, you'd probably want a queue or multiple toasts
          }

          setTasks(newTasks);
        }
      } catch (err) {
        console.error("Dashboard monitor error:", err);
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [tasks]);

  let totalPages = Math.ceil(tasks.length / itemsPerPage);

  // Safety: If current page becomes invalid due to tasks finishing
  useEffect(() => {
    if (page >= totalPages && totalPages > 0) {
      setPage(totalPages - 1);
    }
  }, [tasks.length, totalPages, page]);

  const handleStopAll = async () => {
    if (confirm("Terminate ALL running tasks in the cluster?")) {
      const res = await stopAllTasks();
      if (res.success) {
        setTasks(prev => prev.filter(t => t.status !== 'running'));
      }
    }
  };

  const handleClearHistory = () => {
    const finishedIds = tasks
      .filter(t => !['running', 'paused_hitl', 'paused_error', 'resumed'].includes(t.status))
      .map(t => t.id);
    const newDismissed = Array.from(new Set([...dismissedTaskIds, ...finishedIds]));
    setDismissedTaskIds(newDismissed);
    localStorage.setItem("hivestate_dismissed_tasks", JSON.stringify(newDismissed));
  };

  const visibleTasks = tasks.filter(t => !dismissedTaskIds.includes(t.id));
  totalPages = Math.ceil(visibleTasks.length / itemsPerPage);

  // Safety: If current page becomes invalid due to tasks finishing
  useEffect(() => {
    if (page >= totalPages && totalPages > 0) {
      setPage(totalPages - 1);
    }
  }, [visibleTasks.length, totalPages, page]);

  if (visibleTasks.length === 0) {
    return (
      <div className="modern-card p-8 border-dashed border-white/5 bg-white/[0.01] rounded-2xl flex flex-col items-center justify-center text-center">
        <Loader2 className="w-6 h-6 text-muted/10 mb-3 animate-spin" />
        <h3 className="text-[10px] font-bold text-muted/30 uppercase tracking-[0.2em]">No active tasks</h3>
        <p className="text-[8px] text-muted/10 mt-1 uppercase font-mono-data">System state: Idle</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 relative">
      {/* Header with Navigation and Stop All */}
      <div className="flex items-center justify-between px-1">
        <h2 className="text-[10px] font-bold text-accent uppercase tracking-[0.2em] flex items-center gap-2">
          <motion.div animate={{ opacity: [0.4, 1, 0.4] }} transition={{ repeat: Infinity, duration: 2 }}>
            <Activity className="w-3 h-3 text-accent" />
          </motion.div>
          Recent Activity Stream ({visibleTasks.length})
        </h2>
        
        <div className="flex items-center gap-4">
          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="flex items-center gap-1 bg-white/[0.03] border border-white/5 rounded-lg p-0.5">
              <button 
                onClick={() => setPage(Math.max(0, page - 1))}
                disabled={page === 0}
                className="p-1 hover:bg-white/5 disabled:opacity-20 transition-colors rounded-md"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
              <span className="text-[8px] font-mono-data text-muted/40 px-2 uppercase">
                {page + 1} / {totalPages}
              </span>
              <button 
                onClick={() => setPage(Math.min(totalPages - 1, page + 1))}
                disabled={page === totalPages - 1}
                className="p-1 hover:bg-white/5 disabled:opacity-20 transition-colors rounded-md"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Stop All Button */}
          <button
            onClick={handleStopAll}
            className="px-3 py-1 bg-white/5 hover:bg-white/10 border border-white/10 text-[8px] font-bold text-muted/40 uppercase tracking-widest rounded-lg transition-all"
          >
            Kill Active
          </button>

          {/* Clear History Button */}
          <button
            onClick={handleClearHistory}
            className="px-3 py-1 bg-accent/10 hover:bg-accent/20 border border-accent/20 text-[8px] font-bold text-accent uppercase tracking-widest rounded-lg transition-all"
          >
            Clear Done
          </button>
        </div>
      </div>

      {/* Tasks Grid with Animation */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <AnimatePresence mode="popLayout">
          {visibleTasks.slice(page * itemsPerPage, (page + 1) * itemsPerPage).map((run: any) => {
            const workflow = workflows?.find(w => w.id === run.workflow_id);
            const progress = run.status === 'completed' ? 100 : (run.progress || 0);
            const isRunning = run.status === 'running';
            const isFailed = run.status === 'failed';
            const isPaused = run.status === 'paused_hitl' || run.status === 'paused_error';
            const isBroken = run.circuit_breaker_triggered;

            
            return (
              <motion.div 
                key={run.id}
                layout
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.2 } }}
                className={`modern-card p-4 transition-all group rounded-xl relative flex flex-col ${
                  isBroken ? 'bg-red-950/20 border-red-500/30 hover:bg-red-950/30 ring-1 ring-red-500/20' :
                  isRunning ? 'bg-accent/5 border-accent/20 hover:bg-accent/10' : 
                  isFailed ? 'bg-red-500/5 border-red-500/10 hover:bg-red-500/10' :
                  isPaused ? 'bg-yellow-500/5 border-yellow-500/10 hover:bg-yellow-500/10' :
                  'bg-white/[0.02] border-white/5 hover:bg-white/[0.04]'
                }`}

              >
                <Link 
                  href={`/tasks/${run.id}`}
                  className="absolute inset-0 z-0 no-underline"
                />
                
                <div className="flex flex-col h-full relative z-10 pointer-events-none">
                  <div className="flex items-center justify-between mb-3 shrink-0">
                    <span className={`text-[9px] font-bold uppercase tracking-widest ${
                      isBroken ? 'text-red-500 font-black' :
                      run.status === 'running' ? 'text-accent/80' : 
                      run.status === 'completed' ? 'text-green-500/60' :
                      run.status === 'failed' ? 'text-red-500/60' :
                      'text-yellow-500/60'
                    }`}>
                      {isBroken ? 'Circuit Broken' :
                       run.status === 'running' ? 'Active Runner' : 
                       run.status === 'completed' ? 'Success' :
                       run.status === 'failed' ? 'Failed' :
                       'Intervention'}
                    </span>
                    {isRunning ? (
                      <Loader2 className="w-3 h-3 text-accent animate-spin" />
                    ) : run.status === 'completed' ? (
                      <div className="w-1.5 h-1.5 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]" />
                    ) : isBroken ? (
                      <AlertCircle className="w-3 h-3 text-red-500 animate-pulse" />
                    ) : isFailed ? (
                      <div className="w-1.5 h-1.5 rounded-full bg-red-500" />
                    ) : (
                      <div className="w-1.5 h-1.5 rounded-full bg-yellow-500 animate-pulse" />
                    )}


                  </div>

                  <h3 className="text-[11px] font-bold uppercase truncate mb-auto text-foreground/90">
                    {workflow?.name || "Autonomous Task"}
                  </h3>

                  <div className="mt-4">
                    <div className="flex items-center gap-2 mb-1.5">
                      <div className={`flex-1 h-1 rounded-full overflow-hidden ${
                        isRunning ? 'bg-accent/10' : 'bg-white/5'
                      }`}>
                        <motion.div 
                          className={`h-full ${
                            isFailed ? 'bg-red-500/40' :
                            isPaused ? 'bg-yellow-500/40' :
                            'bg-accent'
                          }`}
                          initial={{ width: 0 }}
                          animate={{ width: `${progress}%` }}
                          transition={{ duration: 0.5 }}
                        />
                      </div>
                      <span className="text-[8px] font-mono-data text-muted/30 uppercase">
                        {progress}%
                      </span>
                    </div>
                  </div>

                  {isRunning && (
                    <div className="pointer-events-auto mt-2 pt-2 border-t border-white/5">
                      <StopTaskButton runId={run.id} />
                    </div>
                  )}
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      {/* Error Notification Overlay */}
      <AnimatePresence>
        {errorNotification && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="fixed bottom-8 right-8 z-[100] modern-card border-red-500/40 bg-red-500/10 backdrop-blur-xl p-4 pr-12 rounded-2xl shadow-2xl max-w-sm"
          >
            <div className="flex items-start gap-4">
              <div className="p-2 bg-red-500/20 rounded-lg text-red-500">
                <XCircle className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-red-500 mb-1">Execution Failure</h4>
                <p className="text-[10px] text-red-500/60 leading-relaxed font-medium">
                  {errorNotification}
                </p>
              </div>
            </div>
            <button 
              onClick={() => setErrorNotification(null)}
              className="absolute top-4 right-4 text-red-500/40 hover:text-red-500"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
