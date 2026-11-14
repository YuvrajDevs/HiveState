"use client";
import { parseCanvas, type Run, type Workflow } from "@/types/domain";

type WorkflowWithStats = Workflow & { created_at: string; totalRuns: number; successRate: number; lastRunTime: string | null };

import { useState, useEffect } from "react";
import { 
  Search, 
  Plus, 
  Play, 
  Edit3, 
  Terminal, 
  
  Clock, 
  ArrowUpDown,
  
  Activity,
  
  
  Layers,
  CheckCircle2,
} from "lucide-react";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { createWorkflow, getTemplates, createFromTemplate, renameWorkflow } from "@/app/actions/workflow";
import { useRouter } from "next/navigation";
import { Sparkles, Wand2, ChevronDown } from "lucide-react";

export default function WorkflowsPage() {
  const router = useRouter();
  const [workflows, setWorkflows] = useState<WorkflowWithStats[]>([]);
  const [templates, setTemplates] = useState<Workflow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<"name" | "most_used" | "recent">("recent");
  const [isCreating, setIsCreating] = useState(false);
  const [isTemplatesCollapsed, setIsTemplatesCollapsed] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        const [wRes, rRes, tRes] = await Promise.all([
          fetch("/api/workflows"),
          fetch("/api/run-workflow"),
          getTemplates()
        ]);
        
        const [wData, rData] = await Promise.all([
          wRes.json(),
          rRes.json()
        ]);
        
        const workflowsRaw = (wData.workflows || []).filter((w: Workflow) => !w.is_template);
        const templatesRaw = tRes.data || [];
        const runsRaw = rData.runs || [];

        const workflowsWithStats: WorkflowWithStats[] = workflowsRaw.map((workflow: Workflow & { created_at: string }) => {
          const workflowRuns = runsRaw.filter((r: Run) => r.workflow_id === workflow.id);
          const totalRuns = workflowRuns.length;
          const successfulRuns = workflowRuns.filter((r: Run) => r.status === 'completed').length;
          const successRate = totalRuns > 0 ? Math.round((successfulRuns / totalRuns) * 100) : 0;
          
          const lastRun = workflowRuns.sort((a: Run, b: Run) => 
            new Date(b.started_at).getTime() - new Date(a.started_at).getTime()
          )[0];

          return {
            ...workflow,
            totalRuns,
            successRate,
            lastRunTime: lastRun?.started_at || null
          };
        });

        setWorkflows(workflowsWithStats);
        setTemplates(templatesRaw);
      } catch (err) {
        console.error("Failed to load workflows:", err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  const handleCreate = async () => {
    const name = prompt("Enter workflow name:");
    if (!name) return;
    
    setIsCreating(true);
    const { data, error } = await createWorkflow(name);
    if (data) {
      router.push(`/workflows/${data.id}`);
    } else {
      alert("Error: " + error);
    }
    setIsCreating(false);
  };

  const handleUseTemplate = async (templateId: string, defaultName: string) => {
    const name = prompt("Enter a name for your new workflow:", defaultName);
    if (!name) return;

    setIsCreating(true);
    const { data, error } = await createFromTemplate(templateId, name);
    if (data) {
      router.push(`/workflows/${data.id}`);
    } else {
      alert("Error: " + error);
    }
    setIsCreating(false);
  };

  const handleRename = async (id: string, currentName: string) => {
    const newName = prompt("Enter new workflow name:", currentName);
    if (!newName || newName === currentName) return;

    const { error } = await renameWorkflow(id, newName);
    if (error) {
      alert("Error renaming: " + error);
    } else {
      setWorkflows(prev => prev.map(w => w.id === id ? { ...w, name: newName } : w));
    }
  };

  const filteredWorkflows = workflows
    .filter(w => w.name.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      if (sortBy === "name") return a.name.localeCompare(b.name);
      if (sortBy === "recent") return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      if (sortBy === "most_used") return b.totalRuns - a.totalRuns;
      return 0;
    });

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      {/* Header Section */}
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/5 pb-8">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-foreground/90">
            Workflows
          </h1>
          <p className="text-muted/80 text-xs mt-1 italic">
            Create, edit and run your agent workflows.
          </p>
        </div>
        
        <button 
          onClick={handleCreate}
          disabled={isCreating}
          className="bg-accent text-white px-6 py-3 text-xs font-semibold rounded-xl hover:shadow-lg transition-all flex items-center justify-center gap-2 disabled:opacity-50"
        >
          {isCreating ? (
            <Activity className="w-4 h-4 animate-spin" />
          ) : (
            <Plus className="w-4 h-4" />
          )}
          Create Workflow
        </button>
      </header>

      {/* Control Bar */}
      <div className="flex flex-col md:flex-row gap-4 items-center justify-between bg-white/[0.02] border border-white/5 p-4 rounded-2xl shadow-sm">
        <div className="relative w-full md:max-w-md group">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted/80 group-focus-within:text-accent transition-colors" />
          <input 
            type="text" 
            placeholder="Search workflows…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-black/20 border border-white/5 rounded-xl py-2.5 pl-11 pr-4 text-xs focus:ring-1 focus:ring-accent/50 focus:border-accent/50 transition-all outline-none placeholder:text-muted/80 tracking-tight"
          />
        </div>
        
        <div className="flex items-center gap-2 w-full md:w-auto">
          <div className="flex items-center gap-1 bg-black/20 border border-white/5 rounded-xl p-1">
            {[
              { id: "recent", label: "Recent", icon: Clock },
              { id: "name", label: "Name", icon: ArrowUpDown },
              { id: "most_used", label: "Usage", icon: Activity },
            ].map((option) => (
              <button
                key={option.id}
                onClick={() => setSortBy(option.id as typeof sortBy)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-micro font-semibold transition-all ${sortBy === option.id 
                    ? "bg-accent text-white shadow-sm" 
                    : "text-muted/80 hover:text-muted hover:bg-white/5"}
                `}
              >
                <option.icon className="w-3 h-3" />
                {option.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Workflow grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 opacity-50">
          {[1,2,3,4,5,6].map(i => (
            <div key={i} className="h-48 modern-card bg-white/5" />
          ))}
        </div>
      ) : filteredWorkflows.length === 0 ? (
        <div className="text-center py-20 border border-dashed border-white/10 rounded-2xl bg-white/[0.01]">
          <Terminal className="w-10 h-10 text-muted/85 mx-auto mb-4" />
          <h3 className="text-muted/80 text-xs font-semibold">No workflows yet</h3>
          <p className="text-micro text-muted/80 italic mt-1 font-mono-data">Create one, or start from a template.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredWorkflows.map((workflow) => {
            return (
              <div 
                key={workflow.id} 
                className="group relative modern-card overflow-hidden rounded-2xl border-white/5 bg-white/[0.01] hover:border-accent/40 hover:bg-white/[0.02] transition-all shadow-sm flex flex-col h-full"
              >
                {/* Status Bar */}
                <div className="px-5 py-4 border-b border-white/5 flex items-center justify-between">
                  <span className="flex items-center gap-2 text-micro font-semibold text-muted/80">
                    {parseCanvas(workflow.canvas_json).nodes?.length ?? 0} agents
                  </span>
                  <button 
                    onClick={() => handleRename(workflow.id, workflow.name)}
                    aria-label={`Rename ${workflow.name}`}
                    title="Rename"
                    className="p-1 hover:bg-white/5 rounded text-muted/80 hover:text-accent transition-colors"
                  >
                    <Edit3 className="w-3 h-3" />
                  </button>
                </div>

                <div className="p-5 flex-1 glass-shine">
                  <div className="flex items-start justify-between mb-2">
                    <h3 className="text-sm font-semibold tracking-tight group-hover:text-accent transition-colors leading-none">
                      {workflow.name}
                    </h3>
                  </div>
                  <div className="mb-6" />

                  <div className="grid grid-cols-2 gap-4 mb-6">
                    <div className="space-y-1">
                      <span className="text-micro text-muted/80 font-semibold block">Success rate</span>
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className={`w-3 h-3 ${workflow.successRate > 80 ? "text-success/50" : workflow.successRate > 50 ? "text-warning/50" : "text-danger/50"}`} />
                        <span className="text-xs font-semibold font-mono-data text-foreground/80">{workflow.successRate}%</span>
                      </div>
                    </div>
                    <div className="space-y-1 text-right">
                      <span className="text-micro text-muted/80 font-semibold block">Last run</span>
                      <div className="flex items-center gap-1 justify-end">
                        <Clock className="w-3 h-3 text-muted/80" />
                        <span className="text-xs font-mono-data text-muted/85">
                          <span suppressHydrationWarning>{workflow.lastRunTime ? `${formatDistanceToNow(new Date(workflow.lastRunTime))} ago` : "Never"}</span>
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="mt-2 flex items-center gap-2 text-micro text-muted/80">
                    <span>Total Runs: {workflow.totalRuns}</span>
                  </div>
                </div>

                {/* Actions */}
                <div className="p-2 bg-black/40 flex items-center gap-1 border-t border-white/5 opacity-80 group-hover:opacity-100 transition-opacity">
                  <Link 
                    href={`/workflows/${workflow.id}`}
                    className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg bg-white/5 hover:bg-white/10 text-micro font-semibold transition-all border border-white/5 text-muted hover:text-foreground"
                  >
                    <Edit3 className="w-3 h-3" />
                    Edit
                  </Link>
                  <Link 
                    href={`/run?id=${workflow.id}`}
                    className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg bg-accent text-white text-micro font-semibold transition-all shadow-md group/run"
                  >
                    <Play className="w-3 h-3 fill-current group-hover/run:scale-110 transition-transform" />
                    Run
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Template Library Section (Moved below) */}
      {!loading && templates.length > 0 && (
        <section className="space-y-6 pt-12 border-t border-white/5">
          <div 
            className="flex items-center justify-between px-1 cursor-pointer group"
            onClick={() => setIsTemplatesCollapsed(!isTemplatesCollapsed)}
          >
            <div className="flex items-center gap-3">
              <Sparkles className="w-5 h-5 text-accent" />
              <div>
                <h2 className="text-lg font-semibold tracking-tight text-foreground/80 group-hover:text-accent transition-colors">Template library</h2>
                <p className="text-xs text-muted/80">Start from a ready-made workflow</p>
              </div>
            </div>
            <button className={`p-2 rounded-full hover:bg-white/5 transition-all ${isTemplatesCollapsed ? "" : "rotate-180"}`}>
              <ChevronDown className="w-5 h-5 text-muted/80" />
            </button>
          </div>
          
          {!isTemplatesCollapsed && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-in slide-in-from-top-4 duration-500">
              {templates.map((template) => (
                <div 
                  key={template.id}
                  className="group relative modern-card overflow-hidden rounded-2xl border-accent/20 bg-accent/[0.02] hover:border-accent/60 hover:bg-accent/[0.04] transition-all shadow-sm flex flex-col h-full"
                >
                  <div className="p-5 flex-1 glass-shine">
                    <div className="flex items-start justify-between mb-2">
                      <h3 className="text-sm font-semibold tracking-tight text-accent/90">
                        {template.template_name || template.name}
                      </h3>
                      <Wand2 className="w-4 h-4 text-accent/40 group-hover:text-accent transition-colors" />
                    </div>
                    <p className="text-xs text-muted/85 leading-relaxed mb-4">
                      {template.template_description || "A ready-made workflow you can copy and edit."}
                    </p>
                    
                    <div className="flex items-center gap-4 text-micro text-muted/80">
                      <div className="flex items-center gap-1.5">
                        <Layers className="w-3 h-3 text-accent/40" />
                        <span>{parseCanvas(template.canvas_json).nodes?.length || 0} agents</span>
                      </div>
                    </div>
                  </div>

                  <div className="p-2 bg-accent/10 border-t border-accent/20 flex items-center justify-center">
                    <button 
                      onClick={() => handleUseTemplate(template.id, template.template_name || template.name)}
                      className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-accent text-white text-micro font-semibold transition-all shadow-md active:scale-95"
                    >
                      <Plus className="w-3 h-3" />
                      Use template
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
