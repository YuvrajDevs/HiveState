"use client";
import type { Workflow } from "@/types/domain";

import { errorMessage } from "@/lib/errors";
import { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { 
  Play, 
  Loader2, 
  
  
  Zap, 
  BookOpen, 
  Cpu,
  ArrowLeft,
  
  CheckCircle2,
  AlertTriangle,
  ExternalLink,
  Upload,
  FileText,
  X,
} from "lucide-react";
import Link from "next/link";

// Since supabaseAdmin is server-side, I'll use a simple approach for now:
// In a real app, I'd use a server action to fetch these.
// I'll assume we have a simple action or just use an internal API.

export default function RunPage() {
  return (
    <Suspense fallback={<div className="p-8 text-muted">Loading…</div>}>
      <RunContent />
    </Suspense>
  );
}

function RunContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const initialId = searchParams.get("id");

  const [workflows, setWorkflows] = useState<Workflow[]>([]);
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
        const myWorkflows = allWorkflows.filter((w: Workflow) => !w.is_template);
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
    } catch (err: unknown) {
      setError(`File parse failed: ${errorMessage(err)}`);
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
    } catch (err: unknown) {
      setError(errorMessage(err));
      setIsRunning(false);
      setStatus("failed");
    }
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") { e.preventDefault(); handleRun(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });


  return (
    <div className="max-w-2xl mx-auto py-10 px-4 space-y-10">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/" className="p-2 hover:bg-white/5 rounded-md text-muted/85 hover:text-accent transition-all">
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Run a workflow</h1>
            <p className="text-muted/85 text-xs mt-1">Pick a workflow, give it some input, and start. Tip: press Ctrl/⌘ + Enter to run.</p>
          </div>
        </div>
      </header>

      {/* Main Execution Form */}
      <section className="modern-card p-4 space-y-6 rounded-2xl border-white/5 bg-white/[0.01] relative overflow-hidden">
        <div className="absolute top-0 right-0 p-4 opacity-[0.02] pointer-events-none">
          <Zap className="w-32 h-32" />
        </div>

        <div className="space-y-4 relative z-10">

          <div className="space-y-2">
            <label className="text-micro font-semibold text-muted/80 px-1">Workflow</label>
            <div className="grid grid-cols-1 gap-2">
              <select 
                value={selectedId}
                onChange={(e) => setSelectedId(e.target.value)}
                disabled={isRunning}
                className="w-full bg-white/[0.03] border border-white/10 p-3 rounded-lg text-xs font-medium focus:ring-1 focus:ring-accent/50 focus:border-accent/50 transition-all outline-none appearance-none cursor-pointer"
              >
                <option value="" disabled>Choose a workflow</option>
                {loading ? (
                  <option disabled>Loading workflows…</option>
                ) : workflows.length === 0 ? (
                  <option disabled>No workflows found</option>
                ) : (
                  workflows.map((w) => (
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
              <label className="text-micro font-semibold text-muted/80">Input</label>
              <div className="flex items-center gap-2">
                <span className="text-micro text-muted/80">Markdown supported</span>
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
                    <h4 className="text-xs font-semibold text-foreground/80 mb-0.5">Attach a file</h4>
                    <p className="text-micro text-muted/80">PDF, Markdown or plain text</p>
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
                    <h4 className="text-xs font-semibold text-accent line-clamp-1">{uploadedFile.name}</h4>
                    <p className="text-micro text-accent/50">{(uploadedFile.size / 1024).toFixed(1)} KB • Content Parsed</p>
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
                className={`w-full h-40 bg-white/[0.03] border border-white/10 p-4 rounded-xl text-xs leading-relaxed focus:ring-1 focus:ring-accent/50 focus:border-accent/50 transition-all outline-none resize-none placeholder:text-muted/85 tracking-tight ${useFileAsInput ? 'opacity-50' : ''}`}
              />
              {useFileAsInput && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-[1px] rounded-xl pointer-events-none">
                  <div className="flex items-center gap-2 px-3 py-1.5 bg-accent/20 border border-accent/40 rounded-full">
                    <div className="w-2 h-2 rounded-full bg-accent" />
                    <span className="text-micro font-semibold text-accent">Using document content</span>
                  </div>
                </div>
              )}
            </div>
            
            <div className="px-1 flex items-center gap-2">
              <Zap className="w-3 h-3 text-warning/40" />
              <span className="text-micro text-muted/80">This becomes the first agent’s input.</span>
            </div>
          </div>

          <button
            onClick={handleRun}
            disabled={isRunning || !selectedId || !input}
            className="w-full bg-accent text-white py-4 rounded-xl font-semibold text-xs flex items-center justify-center gap-3 hover:shadow-lg transition-all group disabled:opacity-30"
          >
            {isRunning ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Starting…
              </>
            ) : (
              <>
                <Play className="w-4 h-4 fill-current group-hover:scale-110 transition-transform" />
                Run workflow
              </>
            )}
          </button>
          {!isRunning && (!selectedId || !input) && (
            <p className="text-center text-xs text-muted" role="status">
              {!selectedId ? "Choose a workflow to continue." : "Add some input (type, paste, or attach a file) to enable Run."}
            </p>
          )}

          {status !== "idle" && (
            <div className={`mt-6 p-4 rounded-xl border animate-in fade-in slide-in-from-top-2 duration-300 ${
              status === "started" ? "bg-accent/5 border-accent/20 text-accent" :
              status === "completed" ? "bg-white/[0.04] border-white/10 text-success" :
              "bg-white/[0.04] border-white/10 text-danger"
            }`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {status === "started" && <Loader2 className="w-4 h-4 animate-spin" />}
                  {status === "completed" && <CheckCircle2 className="w-4 h-4" />}
                  {status === "failed" && <AlertTriangle className="w-4 h-4" />}
                  
                  <span className="text-xs font-semibold">
                    {status === "started" && "Run started"}
                    {status === "completed" && "Run completed"}
                    {status === "failed" && "Run failed"}
                  </span>
                </div>
                
                {status === "completed" && (
                  <Link 
                    href="/traces"
                    className="flex items-center gap-1.5 text-xs font-bold py-1.5 px-3 bg-white/[0.04] hover:bg-white/[0.04] rounded-lg transition-all"
                  >
                    View traces <ExternalLink className="w-3 h-3" />
                  </Link>
                )}
              </div>
              
              {(error || status === "failed") && (
                <p className="mt-2 text-xs opacity-70 font-mono-data">
                  {error || "The run failed. Check the trace for the step that broke."}
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
            <h4 className="text-xs font-semibold text-foreground/80 mb-1">How it runs</h4>
            <p className="text-micro text-muted/80 leading-relaxed">Each agent uses the Gemini model set on its node. Total time is the sum of every agent step.</p>
          </div>
        </div>
        <div className="modern-card p-4 border-none bg-white/[0.02] rounded-xl flex items-start gap-4">
          <div className="w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center flex-shrink-0">
            <BookOpen className="w-4 h-4 text-accent" />
          </div>
          <div>
            <h4 className="text-xs font-semibold text-foreground/80 mb-1">Every step logged</h4>
            <p className="text-micro text-muted/80 leading-relaxed">Full execution traces are available immediately in the Traces directory after start.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
