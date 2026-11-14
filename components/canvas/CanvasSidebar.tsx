"use client";

import { X, Settings2, Code, Box } from "lucide-react";
import type { Node } from "@xyflow/react";
import type { AgentNodeData } from "@/types/domain";

interface CanvasSidebarProps {
  selectedNode: Node<AgentNodeData> | null;
  onUpdate: (nodeId: string, data: Partial<AgentNodeData>) => void;
  onClose: () => void;
}

export default function CanvasSidebar({ selectedNode, onUpdate, onClose }: CanvasSidebarProps) {
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
          <h3 className="text-micro font-semibold shadow-sm">Agent</h3>
        </div>
        <button 
          onClick={onClose}
          className="hover:text-accent transition-all p-1.5 rounded-md hover:bg-accent/10 text-muted/85"
        >
          <X className="w-4 h-4" />
        </button>
      </header>

      <div className="flex-1 overflow-y-auto p-5 space-y-6">
        {/* Node Label */}
        <div className="space-y-2">
          <label className="text-micro text-muted/85 flex items-center gap-2 font-semibold px-1">
            <Box className="w-3 h-3" />
            Name
          </label>
          <input
            type="text"
            value={selectedNode.data.label || ""}
            onChange={(e) => handleChange("label", e.target.value)}
            className="w-full bg-white/[0.03] border border-white/10 p-2.5 rounded-lg text-xs focus:ring-1 focus:ring-accent/50 focus:border-accent/50 focus:outline-none transition-all placeholder:text-muted/80"
            placeholder="e.g. Data_Analyst"
          />
        </div>

        {selectedNode.type === 'AgentNode' ? (
          <>
            {/* Model Selection */}
            <div className="space-y-2">
              <label className="text-micro text-muted/85 flex items-center gap-2 font-semibold px-1">
                <Settings2 className="w-3 h-3" />
                Model
              </label>
              <div className="relative">
                <select
                  value={selectedNode.data.model || "gemini-2.5-flash-lite"}
                  onChange={(e) => handleChange("model", e.target.value)}
                  className="w-full bg-white/[0.03] border border-white/10 p-2.5 rounded-lg text-xs focus:ring-1 focus:ring-accent/50 focus:border-accent/50 focus:outline-none transition-all appearance-none cursor-pointer text-foreground/80 font-bold"
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
              <label className="text-micro text-muted/85 flex items-center gap-2 font-semibold px-1">
                <Code className="w-3 h-3" />
                Instructions
              </label>
              <textarea
                value={selectedNode.data.systemPrompt || ""}
                onChange={(e) => handleChange("systemPrompt", e.target.value)}
                rows={10}
                className="w-full bg-white/[0.03] border border-white/10 p-4 rounded-lg text-xs leading-relaxed focus:ring-1 focus:ring-accent/50 focus:border-accent/50 focus:outline-none transition-all resize-none font-mono text-foreground/70 placeholder:text-muted/80"
                placeholder="DEFINE SYSTEM PROTOCOL..."
              />
            </div>

            {/* HITL Toggle for Agents */}
            <div className="pt-4 border-t border-white/5">
              <label className="flex items-center justify-between cursor-pointer group">
                <div className="space-y-1">
                  <span className="text-xs font-semibold text-foreground/80 group-hover:text-accent transition-colors">Manual review</span>
                  <p className="text-micro text-muted/80">Wait for a person before this agent runs</p>
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
              <label className="text-micro text-muted/85 flex items-center gap-2 font-semibold px-1">
                <Code className="w-3 h-3" />
                Review instructions
              </label>
              <textarea
                value={selectedNode.data.instructions || ""}
                onChange={(e) => handleChange("instructions", e.target.value)}
                rows={5}
                className="w-full bg-white/[0.03] border border-white/10 p-4 rounded-lg text-xs leading-relaxed focus:ring-1 focus:ring-accent/50 focus:border-accent/50 focus:outline-none transition-all resize-none font-mono text-foreground/70 placeholder:text-muted/80"
                placeholder="Instructions for the human reviewer..."
              />
            </div>
          </>
        )}
      </div>


    </aside>
  );
}
