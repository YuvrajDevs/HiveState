"use client";

import { X, Settings2, Code, Box } from "lucide-react";

export default function CanvasSidebar({ selectedNode, onUpdate, onClose }: any) {
  if (!selectedNode) return null;

  const handleChange = (field: string, value: string) => {
    onUpdate(selectedNode.id, { ...selectedNode.data, [field]: value });
  };

  return (
    <aside className="fixed right-0 top-0 bottom-0 w-80 glass-panel border-l border-white/10 z-20 shadow-2xl flex flex-col font-mono-data animate-in slide-in-from-right duration-300">
      <header className="px-4 py-3 border-b border-white/5 flex items-center justify-between bg-white/[0.02]">
        <div className="flex items-center gap-2.5 text-accent">
          <div className="p-1.5 bg-accent/10 rounded-md">
            <Settings2 className="w-4 h-4" />
          </div>
          <h3 className="text-[11px] font-bold uppercase tracking-[0.2em] shadow-sm">Agent Spec</h3>
        </div>
        <button 
          onClick={onClose}
          className="hover:text-accent transition-all p-1.5 rounded-md hover:bg-accent/10 text-muted/50"
        >
          <X className="w-4 h-4" />
        </button>
      </header>

      <div className="flex-1 overflow-y-auto p-5 space-y-6">
        {/* Node Label */}
        <div className="space-y-2">
          <label className="text-[9px] text-muted/50 flex items-center gap-2 uppercase tracking-[0.2em] font-bold px-1">
            <Box className="w-3 h-3" />
            Node Identity
          </label>
          <input
            type="text"
            value={selectedNode.data.label || ""}
            onChange={(e) => handleChange("label", e.target.value)}
            className="w-full bg-white/[0.03] border border-white/10 p-2.5 rounded-lg text-xs focus:ring-1 focus:ring-accent/50 focus:border-accent/50 focus:outline-none transition-all placeholder:text-muted/20"
            placeholder="e.g. Data_Analyst"
          />
        </div>

        {selectedNode.type === 'AgentNode' ? (
          <>
            {/* Model Selection */}
            <div className="space-y-2">
              <label className="text-[9px] text-muted/50 flex items-center gap-2 uppercase tracking-[0.2em] font-bold px-1">
                <Settings2 className="w-3 h-3" />
                Model Core
              </label>
              <div className="relative">
                <select
                  value={selectedNode.data.model || "gemini-2.5-flash-lite"}
                  onChange={(e) => handleChange("model", e.target.value)}
                  className="w-full bg-white/[0.03] border border-white/10 p-2.5 rounded-lg text-[10px] focus:ring-1 focus:ring-accent/50 focus:border-accent/50 focus:outline-none transition-all appearance-none cursor-pointer text-foreground/80 font-bold"
                >
                  <option value="gemini-2.5-flash">GEMINI-2.5-FLASH</option>
                  <option value="gemini-2.5-flash-lite">GEMINI-2.5-FLASH-LITE</option>
                </select>
                <div className="absolute right-3 top-3 pointer-events-none opacity-30">
                  <Settings2 className="w-3 h-3" />
                </div>
              </div>
            </div>

            {/* System Prompt */}
            <div className="space-y-2">
              <label className="text-[9px] text-muted/50 flex items-center gap-2 uppercase tracking-[0.2em] font-bold px-1">
                <Code className="w-3 h-3" />
                System Protocol
              </label>
              <textarea
                value={selectedNode.data.systemPrompt || ""}
                onChange={(e) => handleChange("systemPrompt", e.target.value)}
                rows={10}
                className="w-full bg-white/[0.03] border border-white/10 p-4 rounded-lg text-[10px] leading-relaxed focus:ring-1 focus:ring-accent/50 focus:border-accent/50 focus:outline-none transition-all resize-none font-mono text-foreground/70 placeholder:text-muted/20"
                placeholder="DEFINE SYSTEM PROTOCOL..."
              />
            </div>

            {/* HITL Toggle for Agents */}
            <div className="pt-4 border-t border-white/5">
              <label className="flex items-center justify-between cursor-pointer group">
                <div className="space-y-1">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-foreground/80 group-hover:text-accent transition-colors">Manual Review</span>
                  <p className="text-[8px] text-muted/40 uppercase tracking-tighter">Pause before this agent executes</p>
                </div>
                <input 
                  type="checkbox" 
                  checked={!!selectedNode.data.is_hitl}
                  onChange={(e) => handleChange("is_hitl", e.target.checked.toString())}
                  className="w-4 h-4 rounded border-white/10 bg-white/5 text-accent focus:ring-accent/50 focus:ring-offset-0"
                />
              </label>
            </div>
          </>
        ) : (
          <>
            {/* HITL Instructions */}
            <div className="space-y-2">
              <label className="text-[9px] text-muted/50 flex items-center gap-2 uppercase tracking-[0.2em] font-bold px-1">
                <Code className="w-3 h-3" />
                Review Instructions
              </label>
              <textarea
                value={selectedNode.data.instructions || ""}
                onChange={(e) => handleChange("instructions", e.target.value)}
                rows={5}
                className="w-full bg-white/[0.03] border border-white/10 p-4 rounded-lg text-[10px] leading-relaxed focus:ring-1 focus:ring-accent/50 focus:border-accent/50 focus:outline-none transition-all resize-none font-mono text-foreground/70 placeholder:text-muted/20"
                placeholder="Instructions for the human reviewer..."
              />
            </div>
          </>
        )}
      </div>


      <footer className="px-4 py-3 border-t border-white/5 bg-white/[0.02] italic text-[8px] text-muted/30 text-center tracking-[0.3em] font-mono-data">
        SYSTEM LAYER 3 // ENCRYPTED
      </footer>
    </aside>
  );
}
