"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { 
  Play, 
  Loader2, 
  ChevronRight, 
  Settings2, 
  Zap, 
  BookOpen, 
  Cpu,
  ArrowLeft,
  Activity,
  CheckCircle2,
  AlertTriangle,
  ExternalLink,
  Upload,
  FileText,
  X,
  FileJson
} from "lucide-react";
import Link from "next/link";
import { supabaseAdmin } from "@/lib/supabase"; // Note: this might need a client-side wrapper if not safe, but I'll use a fetcher pattern or an action.

// Since supabaseAdmin is server-side, I'll use a simple approach for now:
// In a real app, I'd use a server action to fetch these.
// I'll assume we have a simple action or just use an internal API.

export default function RunPage() {
  return (
    <Suspense fallback={<div className="p-8 text-muted">Initializing Engine...</div>}>
      <RunContent />
    </Suspense>
  );
}

function RunContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const initialId = searchParams.get("id");

  const [workflows, setWorkflows] = useState<any[]>([]);
  const [selectedId, setSelectedId] = useState(initialId || "");
  const [input, setInput] = useState("");
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "started" | "completed" | "failed">("idle");
  const [loading, setLoading] = useState(true);
  
  // File upload state
  const [isUploading, setIsUploading] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<{ name: string; size: number } | null>(null);
  const [useFileAsInput, setUseFileAsInput] = useState(false);

  useEffect(() => {
    async function loadWorkflows() {
      try {
        const response = await fetch("/api/workflows");
        const data = await response.json();
        const allWorkflows = data.workflows || [];
        // Only show my workflows (no templates directly unless user specifically wants them, 
        // but typically user clones a template first. Using is_template check.)
        const myWorkflows = allWorkflows.filter((w: any) => !w.is_template);
        setWorkflows(myWorkflows);
        
        if (!selectedId && myWorkflows.length > 0) {
          setSelectedId(myWorkflows[0].id);
        }
      } catch (err) {
        console.error("Failed to load workflows:", err);
      } finally {
        setLoading(false);
      }
    }
    loadWorkflows();
  }, [selectedId]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setError(null);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch("/api/parse-file", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (data.error) throw new Error(data.error);

      setInput(data.text);
      setUploadedFile({ name: file.name, size: file.size });
      setUseFileAsInput(true);
    } catch (err: any) {
      setError(`File parse failed: ${err.message}`);
    } finally {
      setIsUploading(false);
    }
  };

  const removeFile = () => {
    setUploadedFile(null);
    setUseFileAsInput(false);
    setInput("");
  };

  const handleRun = async () => {
    if (!selectedId || !input) return;
    
    setIsRunning(true);
    setError(null);
    setStatus("started");

    try {
      const res = await fetch("/api/run-workflow", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workflowId: selectedId, input }),
      });

      const data = await res.json();
      
      if (data.error) throw new Error(data.error);

      // Successfully started, redirect to task detail
      setStatus("completed");
      setIsRunning(false);
      
      if (data.runId) {
        router.push(`/workflows/${selectedId}?runId=${data.runId}`);
      }
    } catch (err: any) {
      setError(err.message);
      setIsRunning(false);
      setStatus("failed");
    }
  };

  const selectedWorkflow = workflows.find(w => w.id === selectedId);

  return (
    <div className="max-w-2xl mx-auto py-10 px-4 space-y-10">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/" className="p-2 hover:bg-white/5 rounded-md text-muted/50 hover:text-accent transition-all">
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold tracking-tight uppercase tracking-[0.1em]">Execution Hub</h1>
            <p className="text-muted/50 text-xs mt-1">Select a workflow cluster and provide input context.</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
          <span className="text-[10px] font-mono-data text-green-500/70 uppercase tracking-widest">Engine Ready</span>
        </div>
      </header>

      {/* Main Execution Form */}
      <section className="modern-card p-4 space-y-6 rounded-2xl border-white/5 bg-white/[0.01] relative overflow-hidden">
        <div className="absolute top-0 right-0 p-4 opacity-[0.02] pointer-events-none">
          <Zap className="w-32 h-32" />
        </div>

        <div className="space-y-4 relative z-10">
          <div className="bg-accent/5 border border-accent/10 p-3 rounded-lg mb-6 flex items-center gap-3">
            <Activity className="w-4 h-4 text-accent" />
            <span className="text-[10px] font-bold uppercase tracking-wider text-accent/80">
              Select a workflow and provide input to execute
            </span>
          </div>

          <div className="space-y-2">
            <label className="text-[9px] font-bold text-muted/40 uppercase tracking-[0.2em] px-1">Selected Workflow</label>
            <div className="grid grid-cols-1 gap-2">
              <select 
                value={selectedId}
                onChange={(e) => setSelectedId(e.target.value)}
                disabled={isRunning}
                className="w-full bg-white/[0.03] border border-white/10 p-3 rounded-lg text-xs font-medium focus:ring-1 focus:ring-accent/50 focus:border-accent/50 transition-all outline-none appearance-none cursor-pointer"
              >
                <option value="" disabled>--- SELECT CLUSTER ---</option>
                {loading ? (
                  <option disabled>Loading clusters...</option>
                ) : workflows.length === 0 ? (
                  <option disabled>No workflows found</option>
                ) : (
                  workflows.map((w: any) => (
                    <option key={w.id} value={w.id}>
                      {w.name} {w.is_template ? "(Template)" : ""}
                    </option>
                  ))
                )}
              </select>
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex justify-between items-center px-1">
              <label className="text-[9px] font-bold text-muted/40 uppercase tracking-[0.2em]">Initial Input Context</label>
              <div className="flex items-center gap-2">
                <span className="text-[9px] text-muted/20 font-mono-data uppercase">Markdown Supported</span>
              </div>
            </div>

            {/* File Upload Zone */}
            {!uploadedFile ? (
              <label className="group relative border border-dashed border-white/10 rounded-xl p-4 bg-white/[0.01] hover:bg-white/[0.03] hover:border-accent/40 cursor-pointer transition-all block overflow-hidden">
                <input 
                  type="file" 
                  className="hidden" 
                  onChange={handleFileUpload}
                  accept=".pdf,.md,.txt"
                  disabled={isUploading || isRunning}
                />
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform">
                    {isUploading ? (
                      <Loader2 className="w-4 h-4 text-accent animate-spin" />
                    ) : (
                      <Upload className="w-4 h-4 text-accent" />
                    )}
                  </div>
                  <div>
                    <h4 className="text-[10px] font-bold text-foreground/80 uppercase tracking-wider mb-0.5">Attach Source Code or Data</h4>
                    <p className="text-[9px] text-muted/30 uppercase tracking-widest font-mono-data">Supports PDF, Markdown, Plain Text</p>
                  </div>
                </div>
              </label>
            ) : (
              <div className="border border-accent/40 rounded-xl p-3 bg-accent/5 flex items-center justify-between animate-in zoom-in-95 duration-200">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-accent/20 flex items-center justify-center">
                    <FileText className="w-4 h-4 text-accent" />
                  </div>
                  <div>
                    <h4 className="text-[10px] font-bold text-accent uppercase tracking-wider line-clamp-1">{uploadedFile.name}</h4>
                    <p className="text-[9px] text-accent/50 uppercase tracking-widest font-mono-data">{(uploadedFile.size / 1024).toFixed(1)} KB • Content Parsed</p>
                  </div>
                </div>
                <button 
                  onClick={removeFile}
                  className="p-1.5 hover:bg-accent/20 rounded-md text-accent transition-all"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}

            <div className="relative">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                disabled={isRunning || !selectedId || isUploading}
                placeholder="Enter instructions or paste documentation here..."
                className={`w-full h-40 bg-white/[0.03] border border-white/10 p-4 rounded-xl text-xs leading-relaxed focus:ring-1 focus:ring-accent/50 focus:border-accent/50 transition-all outline-none resize-none placeholder:text-muted/10 tracking-tight ${useFileAsInput ? 'opacity-50' : ''}`}
              />
              {useFileAsInput && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-[1px] rounded-xl pointer-events-none">
                  <div className="flex items-center gap-2 px-3 py-1.5 bg-accent/20 border border-accent/40 rounded-full">
                    <div className="w-2 h-2 rounded-full bg-accent animate-pulse" />
                    <span className="text-[8px] font-bold text-accent uppercase tracking-widest">Using Document Content</span>
                  </div>
                </div>
              )}
            </div>
            
            <div className="px-1 flex items-center gap-2">
              <Zap className="w-3 h-3 text-yellow-500/40" />
              <span className="text-[8px] text-muted/30 uppercase font-mono-data tracking-[0.1em]">Input will be processed as the primary workflow context head.</span>
            </div>
          </div>

          <button
            onClick={handleRun}
            disabled={isRunning || !selectedId || !input}
            className="w-full bg-accent text-white py-4 rounded-xl font-bold text-xs uppercase tracking-[0.2em] flex items-center justify-center gap-3 hover:shadow-lg hover:shadow-accent/20 transition-all group disabled:opacity-30"
          >
            {isRunning ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Initializing Run...
              </>
            ) : (
              <>
                <Play className="w-4 h-4 fill-current group-hover:scale-110 transition-transform" />
                Execute Cluster
              </>
            )}
          </button>

          {status !== "idle" && (
            <div className={`mt-6 p-4 rounded-xl border animate-in fade-in slide-in-from-top-2 duration-300 ${
              status === "started" ? "bg-accent/5 border-accent/20 text-accent" :
              status === "completed" ? "bg-green-500/5 border-green-500/20 text-green-500" :
              "bg-red-500/5 border-red-500/20 text-red-500"
            }`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {status === "started" && <Loader2 className="w-4 h-4 animate-spin" />}
                  {status === "completed" && <CheckCircle2 className="w-4 h-4" />}
                  {status === "failed" && <AlertTriangle className="w-4 h-4" />}
                  
                  <span className="text-xs font-bold uppercase tracking-wider">
                    {status === "started" && "Execution Started"}
                    {status === "completed" && "Execution Completed"}
                    {status === "failed" && "Execution Failed"}
                  </span>
                </div>
                
                {status === "completed" && (
                  <Link 
                    href="/traces"
                    className="flex items-center gap-1.5 text-[10px] font-bold py-1.5 px-3 bg-green-500/10 hover:bg-green-500/20 rounded-lg transition-all"
                  >
                    View Traces <ExternalLink className="w-3 h-3" />
                  </Link>
                )}
              </div>
              
              {(error || status === "failed") && (
                <p className="mt-2 text-[10px] opacity-70 font-mono-data">
                  {error || "An unexpected error occurred during execution sequence."}
                </p>
              )}
            </div>
          )}
        </div>
      </section>

      {/* Info context */}
      <footer className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="modern-card p-4 border-none bg-white/[0.02] rounded-xl flex items-start gap-4">
          <div className="w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center flex-shrink-0">
            <Cpu className="w-4 h-4 text-accent" />
          </div>
          <div>
            <h4 className="text-[10px] font-bold text-foreground/80 uppercase tracking-wider mb-1">Compute Logic</h4>
            <p className="text-[9px] text-muted/40 leading-relaxed">Runs on Gemini 1.5 Flash. Total latency is cumulative per-node processing time.</p>
          </div>
        </div>
        <div className="modern-card p-4 border-none bg-white/[0.02] rounded-xl flex items-start gap-4">
          <div className="w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center flex-shrink-0">
            <BookOpen className="w-4 h-4 text-accent" />
          </div>
          <div>
            <h4 className="text-[10px] font-bold text-foreground/80 uppercase tracking-wider mb-1">Persistent Logs</h4>
            <p className="text-[9px] text-muted/40 leading-relaxed">Full execution traces are available immediately in the Traces directory after start.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
