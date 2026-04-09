"use client";

import { X, Copy, Check, Terminal } from "lucide-react";
import { useState } from "react";

export default function TraceModal({ isOpen, onClose, content, agentName }: any) {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center p-6 bg-black/60 backdrop-blur-[2px] animate-in fade-in duration-200">
      <div 
        className="w-full max-w-3xl max-h-[80vh] modern-card flex flex-col shadow-2xl animate-in zoom-in-95 duration-200 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="px-4 py-3 border-b border-white/5 flex items-center justify-between bg-white/[0.02]">
          <div className="flex items-center gap-3">
            <div className="p-1.5 bg-accent/10 rounded-md">
              <Terminal className="w-4 h-4 text-accent" />
            </div>
            <div className="flex flex-col">
              <span className="text-[10px] text-muted/60 font-mono-data leading-none uppercase tracking-widest">Trace Inspector</span>
              <h2 className="text-xs font-bold uppercase tracking-tight text-foreground/90">{agentName || "System Agent"}</h2>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleCopy}
              className="flex items-center gap-2 px-3 py-1.5 rounded-md border border-white/5 bg-white/5 hover:bg-white/10 text-[10px] font-bold uppercase tracking-widest transition-all text-muted hover:text-foreground"
            >
              {copied ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3" />}
              {copied ? "Copied" : "Copy"}
            </button>
            <button 
              onClick={onClose}
              className="p-1.5 rounded-md text-muted hover:text-accent hover:bg-accent/10 transition-all"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </header>

        <main className="flex-1 overflow-auto p-6 bg-[#0a0a0a]">
          <pre className="font-mono text-[11px] leading-relaxed whitespace-pre-wrap text-foreground/80 selection:bg-accent/30 selection:text-white">
            {content || "--- EMPTY_OUTPUT_REGISTERED ---"}
          </pre>
        </main>

        <footer className="px-4 py-2 border-t border-white/5 bg-white/[0.02] flex justify-between items-center text-[9px] text-muted/40 font-mono-data uppercase tracking-[0.2em]">
          <span>Size: {content?.length || 0} bytes</span>
          <span>Verified Log</span>
        </footer>
      </div>
      <div className="absolute inset-0 -z-10" onClick={onClose} />
    </div>
  );
}
