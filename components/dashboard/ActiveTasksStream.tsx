"use client";
import type { Run, Workflow } from "@/types/domain";

import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { Loader2, ChevronLeft, ChevronRight, XCircle, AlertCircle } from "lucide-react";
import Link from "next/link";
import { StopTaskButton } from "@/components/tasks/StopTaskButton";
import { stopAllTasks } from "@/app/actions/tasks";
import { motion, AnimatePresence } from "framer-motion";

interface ActiveTasksStreamProps {
  initialTasks: Run[];
  workflows: Pick<Workflow, "id" | "name" | "canvas_json">[];
}

export function ActiveTasksStream({ initialTasks, workflows }: ActiveTasksStreamProps) {
  const [tasks, setTasks] = useState(initialTasks);
  const [dismissedTaskIds, setDismissedTaskIds] = useDismissedTaskIds();
  const [requestedPage, setPage] = useState(0);
  const [errorNotification, setErrorNotification] = useState<string | null>(null);
  const itemsPerPage = 3;


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

  const handleStopAll = async () => {
    if (confirm("Stop every running run?")) {
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
  };

  const visibleTasks = tasks.filter(t => !dismissedTaskIds.includes(t.id));
  totalPages = Math.ceil(visibleTasks.length / itemsPerPage);

  // When runs finish and the list shrinks, show the last page that still exists (derived, not synced)
  const page = Math.min(requestedPage, Math.max(0, totalPages - 1));

  if (visibleTasks.length === 0) {
    return (
      <div className="modern-card p-8 border-dashed border-white/5 bg-white/[0.01] rounded-2xl flex flex-col items-center justify-center text-center">
        <Loader2 className="w-6 h-6 text-muted/85 mb-3 animate-spin" />
        <h3 className="text-xs font-semibold text-muted/80">No active tasks</h3>
        <p className="text-micro text-muted/85 mt-1">System state: Idle</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 relative">
      {/* Header with Navigation and Stop All */}
      <div className="flex items-center justify-between px-1">
        <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
          Recent runs ({visibleTasks.length})
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
              <span className="text-micro text-muted/80 px-2">
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
            className="px-3 py-1 bg-white/5 hover:bg-white/10 border border-white/10 text-micro font-semibold text-muted/80 rounded-lg transition-all"
          >
            Stop all
          </button>

          {/* Clear History Button */}
          <button
            onClick={handleClearHistory}
            className="px-3 py-1 bg-accent/10 hover:bg-accent/20 border border-accent/20 text-micro font-semibold text-accent rounded-lg transition-all"
          >
            Clear done
          </button>
        </div>
      </div>

      {/* Tasks Grid with Animation */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <AnimatePresence mode="popLayout">
          {visibleTasks.slice(page * itemsPerPage, (page + 1) * itemsPerPage).map((run) => {
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
                  isBroken ? 'bg-white/[0.04] border-white/10 hover:bg-white/[0.04] ring-1 ring-white/10' :
                  isRunning ? 'bg-accent/5 border-accent/20 hover:bg-accent/10' : 
                  isFailed ? 'bg-white/[0.04] border-white/10 hover:bg-white/[0.04]' :
                  isPaused ? 'bg-white/[0.04] border-white/10 hover:bg-white/[0.04]' :
                  'bg-white/[0.02] border-white/5 hover:bg-white/[0.04]'
                }`}

              >
                <Link 
                  href={`/tasks/${run.id}`}
                  className="absolute inset-0 z-0 no-underline"
                />
                
                <div className="flex flex-col h-full relative z-10 pointer-events-none">
                  <div className="flex items-center justify-between mb-3 shrink-0">
                    <span className={`text-micro font-semibold ${
                      isBroken ? 'text-danger font-semibold' :
                      run.status === 'running' ? 'text-accent/80' : 
                      run.status === 'completed' ? 'text-success/60' :
                      run.status === 'failed' ? 'text-danger/60' :
                      'text-warning/60'
                    }`}>
                      {isBroken ? 'Stopped after repeated failures' :
                       run.status === 'running' ? 'Running' :
                       run.status === 'completed' ? 'Completed' :
                       run.status === 'failed' ? 'Failed' :
                       'Needs you'}
                    </span>
                    {isRunning ? (
                      <Loader2 className="w-3 h-3 text-accent animate-spin" />
                    ) : run.status === 'completed' ? (
                      <div className="w-1.5 h-1.5 rounded-full bg-success" />
                    ) : isBroken ? (
                      <AlertCircle className="w-3 h-3 text-danger" />
                    ) : isFailed ? (
                      <div className="w-1.5 h-1.5 rounded-full bg-danger" />
                    ) : (
                      <div className="w-1.5 h-1.5 rounded-full bg-warning" />
                    )}


                  </div>

                  <h3 className="text-micro font-semibold truncate mb-auto text-foreground/90">
                    {workflow?.name || "Untitled workflow"}
                  </h3>

                  <div className="mt-4">
                    <div className="flex items-center gap-2 mb-1.5">
                      <div className={`flex-1 h-1 rounded-full overflow-hidden ${
                        isRunning ? 'bg-accent/10' : 'bg-white/5'
                      }`}>
                        <motion.div 
                          className={`h-full ${
                            isFailed ? 'bg-white/[0.04]' :
                            isPaused ? 'bg-white/[0.04]' :
                            'bg-accent'
                          }`}
                          initial={{ width: 0 }}
                          animate={{ width: `${progress}%` }}
                          transition={{ duration: 0.5 }}
                        />
                      </div>
                      <span className="text-micro text-muted/80">
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
            className="fixed bottom-8 right-8 z-[100] modern-card border-white/10 bg-white/[0.04] backdrop-blur-xl p-4 pr-12 rounded-2xl shadow-2xl max-w-sm"
          >
            <div className="flex items-start gap-4">
              <div className="p-2 bg-white/[0.04] rounded-lg text-danger">
                <XCircle className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-xs font-semibold text-danger mb-1">Execution failure</h4>
                <p className="text-xs text-danger/60 leading-relaxed font-medium">
                  {errorNotification}
                </p>
              </div>
            </div>
            <button 
              onClick={() => setErrorNotification(null)}
              className="absolute top-4 right-4 text-danger/40 hover:text-danger"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/**
 * Runs the user has cleared from the stream, kept in localStorage. Read through useSyncExternalStore so the
 * server render and the first client render agree, and other tabs stay in step.
 */
const DISMISSED_KEY = "hivestate_dismissed_tasks";
const EMPTY = "[]";
function subscribe(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener(DISMISSED_KEY, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(DISMISSED_KEY, onChange);
  };
}
function useDismissedTaskIds(): [string[], (ids: string[]) => void] {
  const raw = useSyncExternalStore(subscribe, () => localStorage.getItem(DISMISSED_KEY) ?? EMPTY, () => EMPTY);
  const ids = useMemo(() => {
    try {
      const v: unknown = JSON.parse(raw);
      return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
    } catch {
      return [];
    }
  }, [raw]);
  const set = useCallback((next: string[]) => {
    localStorage.setItem(DISMISSED_KEY, JSON.stringify(next));
    window.dispatchEvent(new Event(DISMISSED_KEY));
  }, []);
  return [ids, set];
}
