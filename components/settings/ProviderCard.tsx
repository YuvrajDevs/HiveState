"use client";

import { useState } from "react";
import { 
  ShieldCheck, 
  Trash2, 
  CheckCircle2, 
  Circle, 
  MoreVertical,
  Activity,
  Globe,
  Database,
  Lock,
  Loader2,
  AlertTriangle
} from "lucide-react";
import { deleteProvider, setDefaultProvider, toggleProviderStatus, AIProvider } from "@/app/actions/providers";

type ProviderProps = {
  provider: AIProvider;
  onEdit: (provider: AIProvider) => void;
};

export default function ProviderCard({ provider, onEdit }: ProviderProps) {
  const [loading, setLoading] = useState(false);

  const handleDelete = async () => {
    if (!confirm(`Are you sure you want to delete ${provider.label || provider.name}?`)) return;
    setLoading(true);
    await deleteProvider(provider.id);
    setLoading(false);
  };

  const handleToggle = async () => {
    setLoading(true);
    await toggleProviderStatus(provider.id, !provider.is_active);
    setLoading(false);
  };

  const handleSetDefault = async () => {
    setLoading(true);
    await setDefaultProvider(provider.id);
    setLoading(false);
  };

  return (
    <div className={`group modern-card p-4 flex flex-col gap-4 border transition-all ${
      provider.is_active ? "border-white/5 bg-white/[0.01]" : "border-white/5 opacity-40 grayscale bg-transparent"
    } ${provider.is_default ? "ring-1 ring-accent/30 border-accent/20 bg-accent/[0.02]" : ""}`}>
      
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg ${
            provider.is_active 
              ? provider.name === 'gemini' ? "bg-blue-500/10 text-blue-400" :
                provider.name === 'openai' ? "bg-emerald-500/10 text-emerald-400" :
                provider.name === 'anthropic' ? "bg-orange-500/10 text-orange-400" :
                "bg-accent/10 text-accent"
              : "bg-muted/10 text-muted"
          }`}>
             {provider.name === 'gemini' ? <ShieldCheck className="w-4 h-4" /> : 
              provider.name === 'openai' ? <Activity className="w-4 h-4" /> : 
              provider.name === 'anthropic' ? <Database className="w-4 h-4" /> : 
              <Globe className="w-4 h-4" />}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold uppercase tracking-tight">{provider.label || provider.name}</h3>
              {provider.is_default && (
                <span className="px-1.5 py-0.5 bg-accent/20 text-accent text-[8px] font-bold uppercase tracking-widest rounded-sm border border-accent/20">
                  Default
                </span>
              )}
            </div>
            <div className="text-[10px] text-muted/40 font-mono-data uppercase tracking-widest mt-0.5">
              Provider: {provider.name}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button 
            disabled={loading}
            onClick={() => onEdit(provider)}
            className="p-1.5 hover:bg-white/5 rounded-md text-muted/60 hover:text-foreground transition-all"
            title="Edit Configuration"
          >
            <MoreVertical className="w-3.5 h-3.5" />
          </button>
          <button 
            disabled={loading}
            onClick={handleDelete}
            className="p-1.5 hover:bg-red-500/10 rounded-md text-red-500/40 hover:text-red-500 transition-all"
            title="Delete Provider"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 py-2 border-y border-white/5">
        <div className="space-y-1">
          <div className="text-[9px] text-muted/30 uppercase font-bold tracking-widest flex items-center gap-1.5">
            <Lock className="w-2.5 h-2.5" /> Credentials
          </div>
          <div className="text-[10px] font-mono-data text-foreground/60">{provider.api_key || "••••••••"}</div>
        </div>
        <div className="space-y-1">
          <div className="text-[9px] text-muted/30 uppercase font-bold tracking-widest flex items-center gap-1.5">
            <Activity className="w-2.5 h-2.5" /> Rate Limit
          </div>
          <div className="text-[10px] font-mono-data text-foreground/60">
             {provider.rate_limit ? `${provider.rate_limit} RPM` : "Unlimited"}
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between mt-1">
        <div className="flex items-center gap-4">
          <button 
            onClick={handleToggle}
            disabled={loading}
            className={`flex items-center gap-2 text-[9px] font-bold uppercase tracking-widest transition-all ${
              provider.is_active ? "text-green-500/60 hover:text-green-500" : "text-muted/40 hover:text-muted"
            }`}
          >
            {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : provider.is_active ? <CheckCircle2 className="w-3 h-3" /> : <Circle className="w-3 h-3" />}
            {provider.is_active ? "Active" : "Disabled"}
          </button>
          
          {!provider.is_default && provider.is_active && (
            <button 
              onClick={handleSetDefault}
              disabled={loading}
              className="text-[9px] font-bold uppercase tracking-widest text-muted/40 hover:text-accent transition-all"
            >
              Set Default
            </button>
          )}
        </div>
        
        {provider.base_url && (
           <div className="text-[8px] text-muted/20 uppercase font-mono-data flex items-center gap-1">
             <Globe className="w-2 h-2 opacity-50" /> {new URL(provider.base_url).hostname}
           </div>
        )}
      </div>

    </div>
  );
}
