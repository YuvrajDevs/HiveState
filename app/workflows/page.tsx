"use client";

import { useState, useEffect } from "react";
import { 
  Search, 
  Plus, 
  Play, 
  Edit3, 
  Terminal, 
  BarChart3, 
  Clock, 
  ArrowUpDown,
  Filter,
  Activity,
  ChevronRight,
  MoreVertical,
  Layers,
  CheckCircle2,
  AlertCircle
} from "lucide-react";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { createWorkflow, getTemplates, useTemplate, renameWorkflow } from "@/app/actions/workflow";
import { useRouter } from "next/navigation";
import { Copy, Sparkles, Wand2, ChevronDown } from "lucide-react";

export default function WorkflowsPage() {
  const router = useRouter();
  const [workflows, setWorkflows] = useState<any[]>([]);
  const [templates, setTemplates] = useState<any[]>([]);
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
        
        const workflowsRaw = (wData.workflows || []).filter((w: any) => !w.is_template);
        const templatesRaw = tRes.data || [];
        const runsRaw = rData.runs || [];

        const workflowsWithStats = workflowsRaw.map((workflow: any) => {
          const workflowRuns = runsRaw.filter((r: any) => r.workflow_id === workflow.id);
          const totalRuns = workflowRuns.length;
          const successfulRuns = workflowRuns.filter((r: any) => r.status === 'completed').length;
          const successRate = totalRuns > 0 ? Math.round((successfulRuns / totalRuns) * 100) : 0;
          
          const lastRun = workflowRuns.sort((a: any, b: any) => 
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
    const { data, error } = await useTemplate(templateId, name);
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
          <h1 className="text-3xl font-black tracking-tight uppercase tracking-[0.1em] text-foreground/90">
            Workflow Registry
          </h1>
          <p className="text-muted/40 text-xs mt-1 italic">
            Manage, configure, and orchestrate agent clusters.
          </p>
        </div>
        
        <button 
          onClick={handleCreate}
          disabled={isCreating}
          className="bg-accent text-white px-6 py-3 text-[10px] font-bold rounded-xl hover:shadow-lg hover:shadow-accent/40 transition-all flex items-center justify-center gap-2 uppercase tracking-widest disabled:opacity-50"
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
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted/30 group-focus-within:text-accent transition-colors" />
          <input 
            type="text" 
            placeholder="Search clusters..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-black/20 border border-white/5 rounded-xl py-2.5 pl-11 pr-4 text-xs focus:ring-1 focus:ring-accent/50 focus:border-accent/50 transition-all outline-none placeholder:text-muted/20 tracking-tight"
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
                onClick={() => setSortBy(option.id as any)}
                className={`
                  flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[9px] font-bold uppercase transition-all
                  ${sortBy === option.id 
                    ? "bg-accent text-white shadow-sm" 
                    : "text-muted/40 hover:text-muted hover:bg-white/5"}
                `}
              >
                <option.icon className="w-3 h-3" />
                {option.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Registry Grid List */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 opacity-50">
          {[1,2,3,4,5,6].map(i => (
            <div key={i} className="h-48 modern-card animate-pulse bg-white/5" />
          ))}
        </div>
      ) : filteredWorkflows.length === 0 ? (
        <div className="text-center py-20 border border-dashed border-white/10 rounded-2xl bg-white/[0.01]">
          <Terminal className="w-10 h-10 text-muted/10 mx-auto mb-4" />
          <h3 className="text-muted/40 text-[10px] font-bold uppercase tracking-[0.2em]">Registry Empty</h3>
          <p className="text-[9px] text-muted/20 italic mt-1 font-mono-data">Initialize your first system sequence to begin.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredWorkflows.map((workflow) => {
            const canvas = typeof workflow.canvas_json === 'string' 
              ? JSON.parse(workflow.canvas_json) 
              : (workflow.canvas_json || {});
            const nodeCount = canvas.nodes?.length || 0;
            
            return (
              <div 
                key={workflow.id} 
                className="group relative modern-card overflow-hidden rounded-2xl border-white/5 bg-white/[0.01] hover:border-accent/40 hover:bg-white/[0.02] transition-all shadow-sm flex flex-col h-full"
              >
                {/* Status Bar */}
                <div className="px-5 py-4 border-b border-white/5 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.4)]" />
                    <span className="text-[9px] font-mono-data text-muted/40 uppercase tracking-widest">Active_Standby</span>
                  </div>
                  <button 
                    onClick={() => handleRename(workflow.id, workflow.name)}
                    className="p-1 hover:bg-white/5 rounded text-muted/20 hover:text-accent transition-colors"
                  >
                    <Edit3 className="w-3 h-3" />
                  </button>
                </div>

                <div className="p-5 flex-1 glass-shine">
                  <div className="flex items-start justify-between mb-2">
                    <h3 className="text-sm font-black uppercase tracking-tight group-hover:text-accent transition-colors leading-none">
                      {workflow.name}
                    </h3>
                  </div>
                  <p className="text-[9px] text-muted/30 font-mono-data mb-6 line-clamp-1 italic">
                    ID: {workflow.id}
                  </p>

                  <div className="grid grid-cols-2 gap-4 mb-6">
                    <div className="space-y-1">
                      <span className="text-[8px] text-muted/20 uppercase font-bold tracking-widest block">Success Rate</span>
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className={`w-3 h-3 ${workflow.successRate > 80 ? "text-green-500/50" : workflow.successRate > 50 ? "text-yellow-500/50" : "text-red-500/50"}`} />
                        <span className="text-xs font-black font-mono-data text-foreground/80">{workflow.successRate}%</span>
                      </div>
                    </div>
                    <div className="space-y-1 text-right">
                      <span className="text-[8px] text-muted/20 uppercase font-bold tracking-widest block">Last Cluster Interaction</span>
                      <div className="flex items-center gap-1 justify-end">
                        <Clock className="w-3 h-3 text-muted/30" />
                        <span className="text-[10px] font-mono-data text-muted/60">
                          {workflow.lastRunTime ? `${formatDistanceToNow(new Date(workflow.lastRunTime))} ago` : "Never"}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="mt-2 flex items-center gap-2 text-[8px] text-muted/20 font-mono-data uppercase tracking-widest">
                    <span>Total Runs: {workflow.totalRuns}</span>
                  </div>
                </div>

                {/* Actions */}
                <div className="p-2 bg-black/40 flex items-center gap-1 border-t border-white/5 opacity-80 group-hover:opacity-100 transition-opacity">
                  <Link 
                    href={`/workflows/${workflow.id}`}
                    className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg bg-white/5 hover:bg-white/10 text-[9px] font-bold uppercase transition-all border border-white/5 text-muted hover:text-foreground"
                  >
                    <Edit3 className="w-3 h-3" />
                    Configure
                  </Link>
                  <Link 
                    href={`/run?id=${workflow.id}`}
                    className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg bg-accent text-white text-[9px] font-bold uppercase transition-all shadow-md group/run"
                  >
                    <Play className="w-3 h-3 fill-current group-hover/run:scale-110 transition-transform" />
                    Execute
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
              <Sparkles className="w-5 h-5 text-accent animate-pulse" />
              <div>
                <h2 className="text-lg font-black uppercase tracking-tight text-foreground/80 group-hover:text-accent transition-colors">Template Library</h2>
                <p className="text-[10px] text-muted/30 uppercase tracking-widest font-mono-data">Instant industrial presets for complex workloads</p>
              </div>
            </div>
            <button className={`p-2 rounded-full hover:bg-white/5 transition-all ${isTemplatesCollapsed ? "" : "rotate-180"}`}>
              <ChevronDown className="w-5 h-5 text-muted/40" />
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
                      <h3 className="text-sm font-black uppercase tracking-tight text-accent/90">
                        {template.template_name || template.name}
                      </h3>
                      <Wand2 className="w-4 h-4 text-accent/40 group-hover:text-accent transition-colors" />
                    </div>
                    <p className="text-[10px] text-muted/60 leading-relaxed mb-4">
                      {template.template_description || "Pre-configured agent cluster for specialized tasks."}
                    </p>
                    
                    <div className="flex items-center gap-4 text-[9px] font-mono-data uppercase tracking-widest text-muted/40">
                      <div className="flex items-center gap-1.5">
                        <Layers className="w-3 h-3 text-accent/40" />
                        <span>{template.canvas_json?.nodes?.length || 0} Agents</span>
                      </div>
                    </div>
                  </div>

                  <div className="p-2 bg-accent/10 border-t border-accent/20 flex items-center justify-center">
                    <button 
                      onClick={() => handleUseTemplate(template.id, template.template_name || template.name)}
                      className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-accent text-white text-[9px] font-bold uppercase transition-all shadow-md active:scale-95"
                    >
                      <Plus className="w-3 h-3" />
                      Use Template
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
