"use client";

import { useState, useCallback, useEffect, useMemo } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  Panel,
  useNodesState,
  useEdgesState,
  addEdge,
  type Connection,
  type Edge,
  type Node,
  MarkerType,
  ConnectionMode,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import {
  Save, Plus, ArrowLeft, Loader2, Play, X, ChevronRight, Pause, Undo2, Redo2, Keyboard, History, Copy, Check, AlertTriangle,
} from "lucide-react";
import { getWorkflow, updateWorkflowCanvas, duplicateWorkflow, restoreWorkflowVersion } from "@/app/actions/workflow";
import { resumeWorkflowAction } from "@/app/actions/resume";
import AgentNode from "@/components/canvas/AgentNode";
import HITLNode from "@/components/canvas/HITLNode";
import CanvasSidebar from "@/components/canvas/CanvasSidebar";
import { RunForm } from "@/components/run/RunForm";
import { Modal } from "@/components/ui/Modal";
import { ErrorState } from "@/components/ui/States";
import { useCanvasHistory, snapshot } from "@/lib/canvas/useCanvasHistory";
import { DEFAULT_MODEL } from "@/lib/models/catalog";
import type { Canvas } from "@/lib/engine/types";

const nodeTypes = { AgentNode, agentNode: AgentNode, agent: AgentNode, HITLNode };

const defaultEdgeOptions = {
  type: "step",
  style: { stroke: "rgba(var(--accent-rgb), 0.5)", strokeWidth: 2 },
  markerEnd: { type: MarkerType.ArrowClosed, color: "rgba(var(--accent-rgb), 0.5)" },
};

const ACTIVE = ["queued", "running", "resumed"];
const STATUS_LABEL: Record<string, string> = {
  queued: "Queued", running: "Running", resumed: "Running", completed: "Completed", paused_hitl: "Waiting for review",
  paused_error: "Paused on error", failed: "Failed", stopped: "Stopped",
};

function shortcuts(mod: string): Array<[string, string]> {
  return [
    [`${mod} Z`, "Undo"],
    [`${mod} Shift Z / ${mod} Y`, "Redo"],
    [`${mod} S`, "Save"],
    [`${mod} D`, "Duplicate selected step"],
    [`${mod} Enter`, "Run workflow"],
    ["A", "Add agent"],
    ["H", "Add review step"],
    ["Delete / Backspace", "Delete selection"],
    ["Esc", "Close panel or dialog"],
    ["?", "Show this list"],
  ];
}

function normalise(saved: Canvas | null): { nodes: Node[]; edges: Edge[] } {
  const nodes = (saved?.nodes || []).map((node, index) => {
    const isReview = node.type === "HITLNode" || node.type === "human";
    const data = { ...node.data };
    if (typeof data.is_hitl === "string") data.is_hitl = data.is_hitl === "true"; // legacy string flag
    return { ...node, data, type: isReview ? "HITLNode" : "AgentNode", position: node.position || { x: 100, y: 100 + index * 150 } } as Node;
  });
  return { nodes, edges: (saved?.edges || []) as Edge[] };
}

function isTyping(target: EventTarget | null) {
  const el = target as HTMLElement | null;
  return !!el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT" || el.isContentEditable);
}

type VersionRow = { version: number; note: string | null; created_at: string; nodeCount: number };
type RunView = { status: string; paused_node_id?: string | null; pause_reason?: string | null; total_cost?: number; total_tokens?: number };
type StepView = { id: string; node_id: string; status: string; input?: string; output?: string; total_tokens?: number; step_cost?: number; model_used?: string; attempts?: number };

export default function WorkflowCanvasPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [workflowName, setWorkflowName] = useState("");
  const [version, setVersion] = useState<number | null>(null);
  const [savedSnap, setSavedSnap] = useState("");
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [showRun, setShowRun] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [versions, setVersions] = useState<VersionRow[] | null>(null);
  const [showVersions, setShowVersions] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [mod, setMod] = useState("Ctrl");

  // Live run overlay
  const [executionRunId, setExecutionRunId] = useState<string | null>(searchParams.get("runId"));
  const [pollKey, setPollKey] = useState(0);
  const [runData, setRunData] = useState<RunView | null>(null);
  const [executionLogs, setExecutionLogs] = useState<StepView[]>([]);
  const [inspecting, setInspecting] = useState<{ nodeId: string; type: "input" | "output" } | null>(null);

  const applySnapshot = useCallback((n: Node[], e: Edge[]) => { setNodes(n); setEdges(e); }, [setNodes, setEdges]);
  const history = useCanvasHistory(nodes, edges, applySnapshot, !isLoading);
  const { reset: resetHistory } = history;
  const dirty = !isLoading && snapshot(nodes, edges) !== savedSnap;
  const selectedNode = useMemo(() => nodes.find((n) => n.id === selectedNodeId) || null, [nodes, selectedNodeId]);

  useEffect(() => {
    if (/Mac|iPhone|iPad/.test(navigator.platform)) setMod("⌘"); // eslint-disable-line react-hooks/set-state-in-effect
  }, []);

  useEffect(() => {
    if (!id) return;
    let alive = true;
    (async () => {
      const { data, error } = await getWorkflow(id);
      if (!alive) return;
      if (error || !data) {
        setLoadError(error || "Workflow not found");
      } else {
        setWorkflowName(data.name);
        setVersion(data.current_version ?? null);
        const { nodes: n, edges: e } = normalise(data.canvas_json);
        setNodes(n);
        setEdges(e);
        setSavedSnap(snapshot(n, e));
        resetHistory(n, e);
      }
      setIsLoading(false);
    })();
    return () => { alive = false; };
  }, [id, setNodes, setEdges, resetHistory]);

  // Warn before leaving with unsaved changes
  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);

  const onConnect = useCallback((params: Connection) => setEdges((eds) => addEdge(params, eds)), [setEdges]);

  const addNode = useCallback(
    (kind: "agent" | "review") => {
      const count = nodes.length;
      const position = { x: 120 + (count % 4) * 40, y: 80 + count * 40 };
      const node: Node =
        kind === "agent"
          ? { id: crypto.randomUUID(), type: "AgentNode", position, data: { label: `Agent ${count + 1}`, model: DEFAULT_MODEL, systemPrompt: "", retries: 2 } }
          : { id: crypto.randomUUID(), type: "HITLNode", position, data: { label: "Review", instructions: "Check the output before the workflow continues." } };
      setNodes((nds) => [...nds.map((n) => ({ ...n, selected: false })), { ...node, selected: true }]);
      setSelectedNodeId(node.id);
    },
    [nodes.length, setNodes],
  );

  const duplicateSelected = useCallback(() => {
    const src = nodes.find((n) => n.id === selectedNodeId);
    if (!src) return;
    const copy: Node = { ...src, id: crypto.randomUUID(), selected: true, position: { x: src.position.x + 40, y: src.position.y + 40 }, data: { ...src.data, label: `${src.data.label || "Step"} copy` } };
    setNodes((nds) => [...nds.map((n) => ({ ...n, selected: false })), copy]);
    setSelectedNodeId(copy.id);
  }, [nodes, selectedNodeId, setNodes]);

  const updateNodeData = useCallback(
    (nodeId: string, patch: Record<string, unknown>) => setNodes((nds) => nds.map((n) => (n.id === nodeId ? { ...n, data: { ...n.data, ...patch } } : n))),
    [setNodes],
  );

  const deleteNode = useCallback(
    (nodeId: string) => {
      setNodes((nds) => nds.filter((n) => n.id !== nodeId));
      setEdges((eds) => eds.filter((e) => e.source !== nodeId && e.target !== nodeId));
      setSelectedNodeId(null);
    },
    [setNodes, setEdges],
  );

  const onSave = useCallback(async () => {
    setSaveState("saving");
    setSaveError(null);
    const snap = snapshot(nodes, edges);
    const res = await updateWorkflowCanvas(id, JSON.parse(snap));
    if (res.error) {
      setSaveState("error");
      setSaveError(res.error);
      return false;
    }
    setSavedSnap(snap);
    if (res.version) setVersion(res.version);
    setVersions(null);
    setSaveState("saved");
    setTimeout(() => setSaveState((s) => (s === "saved" ? "idle" : s)), 1500);
    return true;
  }, [id, nodes, edges]);

  const openRun = useCallback(async () => {
    if (nodes.length === 0) return;
    if (dirty && !(await onSave())) return; // runs execute the saved canvas
    setShowRun(true);
  }, [dirty, onSave, nodes.length]);

  const toggleVersions = useCallback(async () => {
    setShowVersions((s) => !s);
    if (versions) return;
    const res = await fetch(`/api/workflows/${id}/versions`);
    const data = await res.json().catch(() => ({}));
    setVersions(res.ok ? data.versions : []);
  }, [id, versions]);

  const restore = async (v: number) => {
    if (dirty && !confirm("You have unsaved changes. Restore anyway? They will be lost.")) return;
    setBusy(`restore-${v}`);
    const res = await restoreWorkflowVersion(id, v);
    setBusy(null);
    if (res.error || !res.canvas) return alert(`Could not restore: ${res.error}`);
    const { nodes: n, edges: e } = normalise(res.canvas);
    setNodes(n);
    setEdges(e);
    setSavedSnap(snapshot(n, e));
    resetHistory(n, e);
    setVersion(res.version ?? null);
    setVersions(null);
    setShowVersions(false);
  };

  const duplicate = async () => {
    if (dirty && !(await onSave())) return;
    setBusy("duplicate");
    const res = await duplicateWorkflow(id);
    setBusy(null);
    if (res.data) router.push(`/workflows/${res.data.id}`);
    else alert(`Could not duplicate: ${res.error}`);
  };

  // Keyboard shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const isMod = e.metaKey || e.ctrlKey;
      const key = e.key.toLowerCase();
      if (isMod && key === "s") { e.preventDefault(); onSave(); return; }
      if (isMod && key === "enter" && !showRun) { e.preventDefault(); openRun(); return; }
      if (e.key === "Escape") { setShowVersions(false); if (!showRun && !showShortcuts && !inspecting) setSelectedNodeId(null); return; }
      if (isTyping(e.target) || showRun || showShortcuts) return;
      if (isMod && key === "z" && !e.shiftKey) { e.preventDefault(); history.undo(); }
      else if (isMod && ((key === "z" && e.shiftKey) || key === "y")) { e.preventDefault(); history.redo(); }
      else if (isMod && key === "d") { e.preventDefault(); duplicateSelected(); }
      else if (!isMod && !e.altKey && key === "a") { e.preventDefault(); addNode("agent"); }
      else if (!isMod && !e.altKey && key === "h") { e.preventDefault(); addNode("review"); }
      else if (e.key === "?") { e.preventDefault(); setShowShortcuts(true); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onSave, openRun, history, duplicateSelected, addNode, showRun, showShortcuts, inspecting]);

  // Poll the live run until it settles; streamed step output shows up as it is written.
  useEffect(() => {
    if (!executionRunId) return;
    let alive = true;
    let timer: ReturnType<typeof setTimeout>;
    const tick = async () => {
      try {
        const [runRes, logsRes] = await Promise.all([fetch(`/api/tasks/${executionRunId}`), fetch(`/api/tasks/${executionRunId}/logs`)]);
        if (runRes.ok && logsRes.ok && alive) {
          const run = (await runRes.json()).run as RunView;
          setRunData(run);
          setExecutionLogs((await logsRes.json()).logs || []);
          if (!ACTIVE.includes(run.status)) return;
        }
      } catch {
        /* transient network error: keep polling */
      }
      if (alive) timer = setTimeout(tick, 1200);
    };
    tick();
    return () => { alive = false; clearTimeout(timer); };
  }, [executionRunId, pollKey]);

  const retry = useCallback(async () => {
    if (!executionRunId) return;
    const res = await resumeWorkflowAction(executionRunId);
    if (res.error) alert(`Retry failed: ${res.error}`);
    else setPollKey((k) => k + 1);
  }, [executionRunId]);

  const runActive = !!runData && ACTIVE.includes(runData.status);

  const nodesWithExecution = useMemo(() => {
    if (!executionRunId) return nodes;
    return nodes.map((node) => {
      const log = [...executionLogs].reverse().find((l) => l.node_id === node.id); // latest attempt wins
      const pausedHere = runData?.paused_node_id === node.id && String(runData?.status).startsWith("paused");
      return {
        ...node,
        data: {
          ...node.data,
          status: pausedHere ? runData?.status : log?.status || (runActive ? "idle" : undefined),
          pause_reason: pausedHere ? runData?.pause_reason : undefined,
          executionLog: log,
          onInspect: (type: "input" | "output") => setInspecting({ nodeId: node.id, type }),
          onRetry: retry,
          runId: executionRunId,
        },
      };
    });
  }, [nodes, executionLogs, executionRunId, runData, runActive, retry]);

  const edgesWithExecution = useMemo(() => edges.map((e) => ({ ...e, animated: runActive })), [edges, runActive]);
  const inspectedLog = inspecting ? executionLogs.filter((l) => l.node_id === inspecting.nodeId).at(-1) : null;

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center gap-3 text-sm text-neutral-400" aria-busy="true">
        <Loader2 className="h-5 w-5 animate-spin text-accent" /> Loading workflow…
      </div>
    );
  }
  if (loadError) {
    return (
      <div className="mx-auto max-w-lg py-10">
        <ErrorState title="Couldn't open this workflow" message={loadError} />
        <Link href="/workflows" className="mt-4 inline-block text-sm text-accent underline">Back to workflows</Link>
      </div>
    );
  }

  const btn = "flex items-center gap-1.5 rounded-md border border-white/10 bg-white/5 px-2.5 py-1.5 text-xs font-semibold text-neutral-300 hover:bg-white/10 hover:text-white focus-visible:ring-2 focus-visible:ring-accent/60 disabled:opacity-40";

  return (
    <div className="absolute inset-0 flex flex-col bg-[#080808]">
      <header className="glass-panel z-10 flex flex-wrap items-center justify-between gap-2 border-b border-white/5 px-3 py-2">
        <div className="flex min-w-0 items-center gap-2">
          <Link href={executionRunId ? `/tasks/${executionRunId}` : "/workflows"} aria-label="Back" className="rounded-md p-1.5 text-neutral-400 hover:bg-white/5 hover:text-white">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="min-w-0">
            <h1 className="truncate text-sm font-semibold text-white">{workflowName}</h1>
            <p className="font-mono-data text-[11px] text-neutral-500">
              {version ? `v${version}` : "not saved yet"} · {nodes.length} step{nodes.length === 1 ? "" : "s"}
              {dirty && <span className="ml-1 text-yellow-400">· unsaved changes</span>}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <button onClick={history.undo} disabled={!history.canUndo} className={btn} aria-label={`Undo (${mod} Z)`} title={`Undo (${mod} Z)`}><Undo2 className="h-3.5 w-3.5" /></button>
          <button onClick={history.redo} disabled={!history.canRedo} className={btn} aria-label={`Redo (${mod} Shift Z)`} title={`Redo (${mod} Shift Z)`}><Redo2 className="h-3.5 w-3.5" /></button>
          <span className="mx-1 hidden h-4 w-px bg-white/10 sm:block" />
          <button onClick={() => addNode("agent")} className={btn} title="Add agent (A)"><Plus className="h-3.5 w-3.5 text-accent" /> <span className="hidden sm:inline">Agent</span></button>
          <button onClick={() => addNode("review")} className={btn} title="Add review step (H)"><Pause className="h-3.5 w-3.5 text-yellow-500" /> <span className="hidden sm:inline">Review</span></button>
          <div className="relative">
            <button onClick={toggleVersions} className={btn} aria-expanded={showVersions} aria-haspopup="true" title="Version history"><History className="h-3.5 w-3.5" /> <span className="hidden md:inline">Versions</span></button>
            {showVersions && (
              <div className="absolute right-0 top-full z-30 mt-1 w-72 rounded-md border border-white/10 bg-[#141414] p-1 shadow-xl">
                {versions === null ? (
                  <p className="p-3 text-xs text-neutral-400">Loading…</p>
                ) : versions.length === 0 ? (
                  <p className="p-3 text-xs text-neutral-400">No saved versions yet. Save to create v1.</p>
                ) : (
                  <ul className="max-h-72 overflow-y-auto">
                    {versions.map((v) => (
                      <li key={v.version} className="flex items-center justify-between gap-2 rounded px-2 py-1.5 text-xs hover:bg-white/5">
                        <div className="min-w-0">
                          <p className="font-semibold text-neutral-200">v{v.version} {v.version === version && <span className="text-[11px] font-normal text-green-400">current</span>}</p>
                          <p className="truncate text-[11px] text-neutral-500">{new Date(v.created_at).toLocaleString()} · {v.nodeCount} steps{v.note ? ` · ${v.note}` : ""}</p>
                        </div>
                        {v.version !== version && (
                          <button onClick={() => restore(v.version)} disabled={!!busy} className="shrink-0 rounded border border-white/10 px-2 py-0.5 text-[11px] hover:bg-white/10">
                            {busy === `restore-${v.version}` ? "…" : "Restore"}
                          </button>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
          <button onClick={duplicate} disabled={!!busy} className={btn} title="Duplicate workflow"><Copy className="h-3.5 w-3.5" /> <span className="hidden md:inline">Duplicate</span></button>
          <button onClick={() => setShowShortcuts(true)} className={`${btn} hidden sm:flex`} aria-label="Keyboard shortcuts (?)" title="Keyboard shortcuts (?)"><Keyboard className="h-3.5 w-3.5" /></button>
          <button onClick={onSave} disabled={saveState === "saving"} className="flex items-center gap-1.5 rounded-md border border-accent/30 bg-accent/10 px-3 py-1.5 text-xs font-semibold text-accent hover:bg-accent/20 focus-visible:ring-2 focus-visible:ring-accent/60 disabled:opacity-50" title={`Save (${mod} S)`}>
            {saveState === "saving" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : saveState === "saved" ? <Check className="h-3.5 w-3.5" /> : <Save className="h-3.5 w-3.5" />}
            {saveState === "saved" ? "Saved" : "Save"}
          </button>
          <button onClick={openRun} disabled={runActive || nodes.length === 0} className="flex items-center gap-1.5 rounded-md bg-green-600 px-3 py-1.5 text-xs font-semibold text-white hover:brightness-110 focus-visible:ring-2 focus-visible:ring-green-400/60 disabled:opacity-40" title={`Run (${mod} Enter)`}>
            {runActive ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5 fill-current" />} Run
          </button>
        </div>
      </header>

      {saveState === "error" && (
        <div role="alert" className="z-10 flex items-center gap-2 border-b border-red-500/30 bg-red-500/10 px-4 py-2 text-xs text-red-200">
          <AlertTriangle className="h-3.5 w-3.5" /> Save failed: {saveError}
          <button onClick={onSave} className="ml-auto underline">Retry</button>
        </div>
      )}

      {executionRunId && (
        <div className="z-10 flex flex-wrap items-center justify-between gap-2 border-b border-accent/10 bg-accent/5 px-4 py-2 text-xs" aria-live="polite">
          <div className="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-1">
            <span className="flex items-center gap-2 font-semibold text-neutral-200">
              <span className={`h-2 w-2 rounded-full ${runData?.status === "completed" ? "bg-green-500" : ["failed", "paused_error", "stopped"].includes(runData?.status || "") ? "bg-red-500" : runData?.status === "paused_hitl" ? "bg-yellow-500" : "animate-pulse bg-accent"}`} />
              {STATUS_LABEL[runData?.status || ""] || "Starting…"}
            </span>
            <span className="font-mono-data text-neutral-400">₹{Number(runData?.total_cost || 0).toFixed(4)} · {runData?.total_tokens || 0} tokens</span>
          </div>
          <div className="flex items-center gap-3">
            <Link href={`/tasks/${executionRunId}`} className="flex items-center gap-1 font-semibold text-neutral-300 hover:text-accent">Open run <ChevronRight className="h-3 w-3" /></Link>
            <button onClick={() => { setExecutionRunId(null); setRunData(null); setExecutionLogs([]); }} className="rounded p-1 text-neutral-400 hover:bg-white/5 hover:text-white" aria-label="Close live run view"><X className="h-3.5 w-3.5" /></button>
          </div>
        </div>
      )}

      <main className="relative flex-1 overflow-hidden">
        <ReactFlow
          nodes={nodesWithExecution}
          edges={edgesWithExecution}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onNodeClick={(_, n) => setSelectedNodeId(n.id)}
          onPaneClick={() => setSelectedNodeId(null)}
          nodeTypes={nodeTypes}
          defaultEdgeOptions={defaultEdgeOptions}
          connectionMode={ConnectionMode.Loose}
          deleteKeyCode={["Backspace", "Delete"]}
          fitView
          colorMode="dark"
        >
          <Background color="#333" gap={20} />
          <Controls className="!border-border !bg-surface" />
          <MiniMap pannable zoomable className="!hidden !bg-[#111] md:!block" maskColor="rgba(0,0,0,0.6)" />
          {nodes.length === 0 && (
            <Panel position="top-center" className="!top-1/4">
              <div className="max-w-sm rounded-md border border-dashed border-white/10 bg-[#0e0e0e]/90 p-6 text-center">
                <h2 className="text-sm font-semibold text-neutral-200">Start by adding a step</h2>
                <p className="mt-1 text-xs text-neutral-400">Add an agent and give it a prompt. Connect steps by dragging from one node&apos;s bottom handle to another&apos;s top handle.</p>
                <div className="mt-4 flex justify-center gap-2">
                  <button onClick={() => addNode("agent")} className="rounded-md bg-accent px-3 py-1.5 text-xs font-semibold text-white">Add agent (A)</button>
                  <button onClick={() => addNode("review")} className="rounded-md border border-white/10 px-3 py-1.5 text-xs text-neutral-300">Add review (H)</button>
                </div>
              </div>
            </Panel>
          )}
        </ReactFlow>

        <CanvasSidebar selectedNode={selectedNode} onUpdate={updateNodeData} onDelete={deleteNode} onClose={() => setSelectedNodeId(null)} />
      </main>

      <Modal open={showRun} onClose={() => setShowRun(false)} title={`Run ${workflowName}`}>
        <RunForm
          workflows={[{ id, name: workflowName, canvas_json: JSON.parse(savedSnap || '{"nodes":[],"edges":[]}') }]}
          initialWorkflowId={id}
          autoFocus
          onStarted={(runId) => {
            setShowRun(false);
            setRunData({ status: "queued" });
            setExecutionLogs([]);
            setExecutionRunId(runId);
          }}
        />
      </Modal>

      <Modal open={showShortcuts} onClose={() => setShowShortcuts(false)} title="Keyboard shortcuts">
        <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
          {shortcuts(mod).map(([k, v]) => (
            <div key={k} className="contents">
              <dt><kbd className="rounded border border-white/15 bg-white/5 px-1.5 py-0.5 font-mono-data text-[11px]">{k}</kbd></dt>
              <dd className="text-neutral-300">{v}</dd>
            </div>
          ))}
        </dl>
      </Modal>

      <Modal
        open={!!inspecting}
        onClose={() => setInspecting(null)}
        title={`${inspecting?.type === "input" ? "Input" : "Output"} · ${String(nodes.find((n) => n.id === inspecting?.nodeId)?.data?.label || "Step")}`}
        wide
      >
        <pre className="max-h-[60vh] overflow-auto whitespace-pre-wrap rounded-md border border-white/5 bg-black/60 p-4 font-mono-data text-xs leading-relaxed text-neutral-200">
          {(inspecting?.type === "input" ? inspectedLog?.input : inspectedLog?.output) || (inspectedLog?.status === "running" ? "Waiting for the first tokens…" : "Nothing recorded for this step yet.")}
        </pre>
        {inspecting?.type === "output" && inspectedLog?.status === "success" && (
          <p className="mt-3 font-mono-data text-xs text-neutral-400">
            {inspectedLog.total_tokens} tokens · ₹{Number(inspectedLog.step_cost || 0).toFixed(5)} · {inspectedLog.model_used} · {inspectedLog.attempts || 1} attempt(s)
          </p>
        )}
      </Modal>
    </div>
  );
}
