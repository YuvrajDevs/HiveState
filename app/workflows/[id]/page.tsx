"use client";
import type { AgentNodeData, CanvasNode, Log, Run } from "@/types/domain";

import { errorMessage } from "@/lib/errors";
import { useState, useCallback, useEffect, useMemo } from "react";
import { 
  ReactFlow, 
  Background, 
  Controls, 
  
  useNodesState, 
  useEdgesState, 
  addEdge,
  Connection,
  Edge,
  Node,
  MarkerType,
  ConnectionMode
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useParams, useSearchParams } from "next/navigation";
import { getWorkflow, updateWorkflowCanvas } from "@/app/actions/workflow";
import { resumeWorkflowAction } from "@/app/actions/resume";

import AgentNode from "@/components/canvas/AgentNode";
import HITLNode from "@/components/canvas/HITLNode";
import CanvasSidebar from "@/components/canvas/CanvasSidebar";

import { Save, Plus, ArrowLeft, Loader2, Play, X, ChevronRight, Code, Pause } from "lucide-react";

import Link from "next/link";

const nodeTypes = {
  AgentNode: AgentNode,
  agentNode: AgentNode, // case-insensitive alias
  agent: AgentNode,      // legacy alias
  HITLNode: HITLNode,
};


const defaultEdgeOptions = {
  type: "step",
  animated: true,
  style: { stroke: "rgba(var(--accent-rgb), 0.5)", strokeWidth: 2 },
  markerEnd: {
    type: MarkerType.ArrowClosed,
    color: "rgba(var(--accent-rgb), 0.5)",
  },
};

export default function WorkflowCanvasPage() {
  const { id } = useParams();
  const searchParams = useSearchParams();
  const [nodes, setNodes, onNodesChange] = useNodesState<Node<AgentNodeData>>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [workflowName, setWorkflowName] = useState("");
  
  // Execution State
  const initialRunId = searchParams.get("runId");
  const [executionRunId, setExecutionRunId] = useState<string | null>(initialRunId);
  const [runData, setRunData] = useState<Run | null>(null);
  const [executionLogs, setExecutionLogs] = useState<Log[]>([]);
  const [inspectingNode, setInspectingNode] = useState<{ nodeId: string, type: 'input' | 'output' } | null>(null);

  // Memoize selected node
  const selectedNode = useMemo(() => 
    nodes.find((n) => n.id === selectedNodeId) || null, 
    [nodes, selectedNodeId]
  );

  useEffect(() => {
    async function loadWorkflow() {
      if (!id || id === "null") return;
      setIsLoading(true);
      const { data, error } = await getWorkflow(id as string);

      if (data) {
        setWorkflowName(data.name);
        if (data.canvas_json) {
          const { nodes: savedNodes, edges: savedEdges } = data.canvas_json;
          
          // Force legacy/default nodes to render with customized AgentNode styles
          // And provide a default position if missing to prevent ReactFlow crash
          const standardizedNodes = (savedNodes || []).map((node: CanvasNode, index: number) => {
            // Force legacy/default nodes to render with customized AgentNode styles
            // We treat anything that isnt HITL as an AgentNode
            const isHITL = node.type === "HITLNode" || node.type === "human";
            return {
              ...node,
              type: isHITL ? "HITLNode" : "AgentNode",
              position: node.position || { x: 100, y: 100 + (index * 150) }
            };
          });


          setNodes(standardizedNodes);
          setEdges(savedEdges || []);
        }
      } else if (error) {
        console.error("Workflow fetch failed:", error);
      }
      setIsLoading(false);
    }
    loadWorkflow();
  }, [id, setNodes, setEdges]);

  const onConnect = useCallback(
    (params: Connection) => setEdges((eds) => addEdge(params, eds)),
    [setEdges]
  );

  const onNodeClick = useCallback((_: React.MouseEvent, node: Node<AgentNodeData>) => {
    setSelectedNodeId(node.id);
  }, []);

  const onPaneClick = useCallback(() => {
    setSelectedNodeId(null);
  }, []);

  const addNode = useCallback(() => {
    const newNode: Node = {
      id: crypto.randomUUID(),
      type: "AgentNode",
      position: { x: Math.random() * 400, y: Math.random() * 400 },
      data: { 
        label: `Agent_${nodes.length + 1}`,
        model: "gemini-2.5-flash",
        systemPrompt: "" 
      },
    };
    setNodes((nds) => nds.concat(newNode));
    setSelectedNodeId(newNode.id);
  }, [nodes.length, setNodes]);

  const updateNodeData = useCallback((nodeId: string, newData: Partial<AgentNodeData>) => {
    setNodes((nds) => 
      nds.map((node) => {
        if (node.id === nodeId) {
          return { ...node, data: { ...node.data, ...newData } };
        }
        return node;
      })
    );
  }, [setNodes]);

  const onSave = async () => {
    setIsSaving(true);
    const canvasData = { nodes, edges };
    
    const { success, error } = await updateWorkflowCanvas(id as string, canvasData);

    if (error) {
      console.error("Save failed:", error);
      alert("Pipeline compilation/save failed. System logged.");
    } else if (success) {
      // Show a temporary success indicator if needed
    }
    
    setIsSaving(false);
  };

  const [isExecuting, setIsExecuting] = useState(false);
  const [showRunModal, setShowRunModal] = useState(false);
  const [runInput, setRunInput] = useState("");

  const handleExecute = async () => {
    if (!runInput) return;
    setIsExecuting(true);
    try {
      const res = await fetch("/api/run-workflow", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workflowId: id, input: runInput }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      
      // Success - stay on canvas and start execution view
      setExecutionRunId(data.runId);
      setShowRunModal(false);
      
      // The polling useEffect will take over from here
    } catch (err: unknown) {
      alert("Execution failed: " + errorMessage(err));
      setIsExecuting(false);
    }
  };
  
  const handleRetryNode = useCallback(async (nodeId: string) => {
    if (!executionRunId) return;
    setIsExecuting(true);
    try {
      const res = await resumeWorkflowAction(executionRunId, nodeId);
      if (res.error) throw new Error(res.error);
      
      // The polling logic will pick up the 'resumed/running' status
    } catch (err: unknown) {
      alert("Retry failed: " + errorMessage(err));
      setIsExecuting(false);
    }
  }, [executionRunId]);

  // Polling for execution updates
  useEffect(() => {
    if (!executionRunId) return;

    const interval = setInterval(async () => {
      try {
        const [runRes, logsRes] = await Promise.all([
          fetch(`/api/tasks/${executionRunId}`),
          fetch(`/api/tasks/${executionRunId}/logs`)
        ]);

        if (runRes.ok && logsRes.ok) {
          const runUpdate = await runRes.json();
          const logsUpdate = await logsRes.json();

          setRunData(runUpdate.run);
          setExecutionLogs(logsUpdate.logs);

          // Stop polling if finished
          if (["completed", "failed", "paused_error", "paused_hitl"].includes(runUpdate.run.status)) {
            setIsExecuting(false);
            if (runUpdate.run.status !== "paused_error" && runUpdate.run.status !== "paused_hitl") {
              // We can keep the executionRunId to show results, but stop polling
              clearInterval(interval);
            } else {
              // On pause/error we might want to keep polling in case user resumes elsewhere?
              // Or just stop and wait for them to click Resume here.
              clearInterval(interval);
            }
          }
        }
      } catch (err) {
        console.error("Polling error:", err);
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [executionRunId]);

  // Merge execution data into nodes
  const nodesWithExecution = useMemo(() => {
    return nodes.map((node) => {
      const log = executionLogs.find(l => l.node_id === node.id);
      const isPausedHere = runData?.paused_node_id === node.id;
      
      return {
        ...node,
        data: {
          ...node.data,
          status: isPausedHere ? (runData?.status || "paused") : (log?.status || (executionRunId && (runData?.status === "running" || runData?.status === "resumed") ? "idle" : node.data.status)),
          pause_reason: isPausedHere ? runData?.pause_reason : log?.pause_reason,
          executionLog: log,
          isInspecting: inspectingNode?.nodeId === node.id,
          onInspect: (type: 'input' | 'output') => setInspectingNode({ nodeId: node.id, type }),
          onRetry: () => handleRetryNode(node.id),
          runId: executionRunId
        }
      };
    });
  }, [nodes, executionLogs, executionRunId, runData, inspectingNode, handleRetryNode]);

  // Animate edges if executing
  const edgesWithExecution = useMemo(() => {
    return edges.map(edge => ({
      ...edge,
      animated: !!(executionRunId && (runData?.status === "running" || runData?.status === "resumed") && runData?.pause_reason !== "circuit_breaker")
    }));
  }, [edges, executionRunId, runData?.status, runData?.pause_reason]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full gap-3 text-muted">
        <Loader2 className="w-6 h-6 animate-spin text-accent" />
        Initializing_Canvas...
      </div>
    );
  }

  return (
    <div className="absolute inset-0 flex flex-col bg-canvas">
      {/* Top Bar */}
      <header className="min-h-14 glass-panel border-b border-white/5 flex flex-wrap items-center justify-between gap-2 px-4 py-2 z-10">
        <div className="flex items-center gap-3">
          <Link 
            href={executionRunId ? `/tasks/${executionRunId}` : "/"} 
            className="p-1.5 hover:bg-white/5 rounded-md text-muted/85 hover:text-accent transition-all"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div className="h-4 w-px bg-white/10 mx-1" />
          <div className="flex flex-col">
            <span className="text-micro text-muted/80">Workflow editor</span>
            <h1 className="text-xs font-semibold tracking-tight text-foreground/90">{workflowName}</h1>
          </div>
        </div>

        {/* Actions scroll sideways on a phone instead of being cut off */}
        <div className="-mx-1 flex max-w-full items-center gap-2 overflow-x-auto px-1 [scrollbar-width:none] [&>*]:shrink-0 [&>*]:whitespace-nowrap">
          <button
            onClick={addNode}
            className="flex items-center gap-2 px-3 py-1.5 rounded-md border border-white/10 bg-white/5 hover:bg-white/10 text-xs font-semibold transition-all text-muted hover:text-foreground"
          >
            <Plus className="w-3 h-3 text-accent" />
            Add agent
          </button>
          <button
            onClick={() => {
              const newNode: Node = {
                id: crypto.randomUUID(),
                type: "HITLNode",
                position: { x: Math.random() * 400, y: Math.random() * 400 },
                data: { 
                  label: "Manual review",
                  instructions: "Review intermediate output." 
                },
              };
              setNodes((nds) => nds.concat(newNode));
              setSelectedNodeId(newNode.id);
            }}
            className="flex items-center gap-2 px-3 py-1.5 rounded-md border border-white/10 bg-white/5 hover:bg-white/10 text-xs font-semibold transition-all text-muted hover:text-foreground"
          >
            <Pause className="w-3 h-3 text-warning" />
            Add HITL
          </button>

          <button
            onClick={onSave}
            disabled={isSaving}
            className="flex items-center gap-2 px-4 py-1.5 rounded-md bg-accent/10 border border-accent/20 text-accent hover:bg-accent/20 text-xs font-semibold transition-all disabled:opacity-50"
          >
            {isSaving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
            Save Pipeline
          </button>
          <button 
            onClick={() => setShowRunModal(true)}
            disabled={isExecuting}
            className="flex items-center gap-2 px-4 py-1.5 rounded-md bg-white/[0.04] border border-white/10 text-success hover:bg-white/[0.04] text-xs font-semibold transition-all group"
          >
            {isExecuting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Play className="w-3 h-3 fill-current group-hover:scale-110 transition-transform" />}
            Execute
          </button>
        </div>
      </header>

      {/* Execution Status Bar */}
      {executionRunId && (
        <div className="h-10 bg-accent/5 border-b border-accent/10 flex items-center justify-between px-6 z-10 animate-in slide-in-from-top duration-300">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${
                runData?.status === "completed" ? "bg-success" :
                runData?.status === "failed" || runData?.status === "paused_error" ? "bg-danger" :
                "bg-accent animate-pulse"
              }`} />
              <span className="text-xs font-semibold text-foreground/80">
                {runData?.status === "running" ? "Executing Pipeline..." :
                 runData?.status === "completed" ? "Run complete" :
                 runData?.status === "paused_hitl" ? "Waiting for Approval" :
                 runData?.status === "paused_error" ? "Paused on Error" : 
                 runData?.status || "Initializing..."}
              </span>
            </div>
            
            <div className="h-4 w-px bg-white/5" />

            <div className="flex items-center gap-2 max-w-[300px] truncate">
              <span className="text-micro text-muted/80 shrink-0">Input:</span>
              <span className="text-xs text-muted/85 truncate italic">&ldquo;{runData?.input_prompt || "…"}&rdquo;</span>
            </div>
            
            <div className="h-4 w-px bg-white/5" />
            
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1.5">
                <span className="text-micro text-muted/80">Compute:</span>
                <span className="text-xs font-mono-data font-bold text-accent">₹{(runData?.total_cost || 0).toFixed(5)}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-micro text-muted/80">Tokens:</span>
                <span className="text-xs font-mono-data font-bold text-foreground/60">{runData?.total_tokens || 0}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
             {runData?.status === "completed" && (
                <Link 
                  href={`/tasks/${executionRunId}`}
                  className="text-micro font-semibold text-muted hover:text-accent transition-colors flex items-center gap-1.5"
                >
                  View details <ChevronRight className="w-3 h-3" />
                </Link>
             )}
             <button 
                onClick={() => setExecutionRunId(null)}
                className="p-1 hover:bg-white/5 rounded text-muted/80 hover:text-foreground transition-colors"
                title="Exit live view"
             >
                <X className="w-3 h-3" />
             </button>
          </div>
        </div>
      )}

      {/* Run Modal */}
      {showRunModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setShowRunModal(false)} />
          <div className="relative w-full max-w-lg modern-card bg-[var(--color-surface)] rounded-2xl p-6 border-white/5 shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center mb-6">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-white/[0.04] flex items-center justify-center">
                  <Play className="w-4 h-4 text-success fill-current" />
                </div>
                <h2 className="text-sm font-semibold">Run this workflow</h2>
              </div>
              <button 
                onClick={() => setShowRunModal(false)}
                className="p-1 hover:bg-white/5 rounded-md text-muted transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between px-1">
                  <label className="text-micro font-semibold text-muted/80">Initial InputContext</label>
                  <span className="text-micro text-accent opacity-40">Pipeline_Ready</span>
                </div>
                <textarea 
                  autoFocus
                  value={runInput}
                  onChange={(e) => setRunInput(e.target.value)}
                  placeholder="Provide the initial prompt or data for the workflow..."
                  className="w-full h-32 bg-white/[0.02] border border-white/5 p-4 rounded-xl text-xs leading-relaxed focus:ring-1 focus:ring-white/10 focus:border-white/10 transition-all outline-none resize-none tracking-tight"
                />
              </div>

              <button
                onClick={handleExecute}
                disabled={isExecuting || !runInput}
                className="w-full bg-white/10 text-white py-3 rounded-xl font-semibold text-xs flex items-center justify-center gap-2 hover:shadow-lg transition-all disabled:opacity-30"
              >
                {isExecuting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5 fill-current" />}
                Confirm and Run
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Execution Inspector Modal */}
      {inspectingNode && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/90 backdrop-blur-md" onClick={() => setInspectingNode(null)} />
          <div className="relative w-full max-w-2xl modern-card bg-canvas rounded-3xl border-white/5 shadow-2xl animate-in zoom-in-95 duration-200 flex flex-col max-h-[80vh]">
            <div className="p-6 border-b border-white/5 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="p-2 bg-accent/10 rounded-xl">
                  {inspectingNode.type === 'input' ? <ChevronRight className="w-5 h-5 text-accent" /> : <ChevronRight className="w-5 h-5 text-success rotate-90" />}
                </div>
                <div>
                  <h3 className="text-sm font-semibold flex items-center gap-2">
                    Node {inspectingNode.type === 'input' ? 'Input' : 'Output'}
                    <span className="text-xs text-muted/80 font-mono-data ml-2">[{nodesWithExecution.find(n => n.id === inspectingNode.nodeId)?.data?.label || "Agent"}]</span>
                  </h3>
                </div>
              </div>
              <button 
                onClick={() => setInspectingNode(null)}
                className="p-2 hover:bg-white/5 rounded-full text-muted transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-6 space-y-6 no-scrollbar font-mono-data">
              <div className="bg-black/60 border border-white/5 rounded-2xl p-6 relative group">
                <div className="absolute top-4 right-4 text-micro font-semibold text-muted/80">{inspectingNode.type}</div>
                <pre className="text-xs leading-relaxed whitespace-pre-wrap text-foreground/80">
                  {inspectingNode.type === 'input' 
                    ? nodesWithExecution.find(n => n.id === inspectingNode.nodeId)?.data.executionLog?.input || "NO_INPUT_FOUND"
                    : nodesWithExecution.find(n => n.id === inspectingNode.nodeId)?.data.executionLog?.output || "NO_OUTPUT_YET_GENERATED"}
                </pre>
              </div>

              {inspectingNode.type === 'output' && nodesWithExecution.find(n => n.id === inspectingNode.nodeId)?.data.executionLog && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 bg-white/[0.02] border border-white/5 rounded-xl">
                    <div className="text-micro text-muted/80 font-semibold mb-1">Tokens used</div>
                    <div className="text-xs font-bold text-accent">{nodesWithExecution.find(n => n.id === inspectingNode.nodeId)?.data.executionLog?.total_tokens ?? 0}</div>
                  </div>
                  <div className="p-4 bg-white/[0.02] border border-white/5 rounded-xl">
                    <div className="text-micro text-muted/80 font-semibold mb-1">Step cost</div>
                    <div className="text-xs font-bold text-success">₹{(nodesWithExecution.find(n => n.id === inspectingNode.nodeId)?.data.executionLog?.step_cost ?? 0).toFixed(5)}</div>
                  </div>
                </div>
              )}
            </div>
            
            <div className="p-6 border-t border-white/5 bg-white/[0.01] flex items-center justify-between">
              <button 
                onClick={() => setInspectingNode(null)}
                className="px-6 py-3 bg-white/5 hover:bg-white/10 rounded-xl text-xs font-semibold text-muted transition-all"
              >
                Close
              </button>
              <div className="flex items-center gap-4">
                <span className="text-xs text-muted/80 hidden md:inline">
                  Seq_ID: {executionRunId?.split("-")[0] || "N/A"}
                </span>
                {executionRunId && (
                  <Link 
                    href={`/tasks/${executionRunId}`}
                    className="flex items-center gap-2 px-3 py-1 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-micro font-semibold text-muted/85 transition-all no-underline"
                  >
                    View traces <Code className="w-3 h-3" />
                  </Link>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main Canvas Area */}
      <main className="flex-1 relative overflow-hidden">
        <ReactFlow
          nodes={nodesWithExecution}
          edges={edgesWithExecution}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onNodeClick={onNodeClick}
          onPaneClick={onPaneClick}
          nodeTypes={nodeTypes}
          defaultEdgeOptions={defaultEdgeOptions}
          connectionMode={ConnectionMode.Loose}
          fitView
          colorMode="dark"
        >
          <Background color="#333" gap={20} />
          <Controls className="!bg-surface !border-border !fill-white" />
          
          {nodes.length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-0">
              <div className="text-center space-y-4 max-w-sm px-6 py-10 border border-dashed border-white/5 rounded-3xl bg-white/[0.01]">
                <Plus className="w-10 h-10 text-accent/20 mx-auto mb-2" />
                <h3 className="text-sm font-semibold text-muted/85">
                  Add your first agent to begin building your workflow
                </h3>
                <p className="text-xs text-muted/80">
                  Connect agents to define execution flow
                </p>
              </div>
            </div>
          )}

        </ReactFlow>

        {/* Sidebar */}
        <CanvasSidebar
          selectedNode={selectedNode}
          onUpdate={updateNodeData}
          onClose={() => setSelectedNodeId(null)}
        />
      </main>
    </div>
  );
}
