"use client";

import { useState, useEffect, useCallback } from "react";
import { 
  Plus, 
  ShieldCheck, 
  Activity, 
  AlertCircle, 
  Loader2,
  Settings2,
  Box
} from "lucide-react";
import { getProviders, AIProvider } from "@/app/actions/providers";
import ProviderCard from "@/components/settings/ProviderCard";
import AddProviderForm from "@/components/settings/AddProviderForm";
import GovernanceCard from "@/components/settings/GovernanceCard";

export default function SettingsPage() {
  const [providers, setProviders] = useState<AIProvider[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingProvider, setEditingProvider] = useState<AIProvider | null>(null);

  const fetchProviders = useCallback(async () => {
    setLoading(true);
    const result = await getProviders();
    if (result.success) {
      setProviders(result.providers || []);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchProviders();
  }, [fetchProviders]);

  const handleEdit = (provider: AIProvider) => {
    setEditingProvider(provider);
    setShowAddForm(true);
  };

  const handleFormClose = () => {
    setShowAddForm(false);
    setEditingProvider(null);
  };

  return (
    <div className="max-w-4xl space-y-8 pb-20">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight uppercase tracking-wider">Infrastructure Control</h1>
          <p className="text-muted/60 text-xs">
            Manage autonomous agent clusters and AI provider credentials across your network. 
          </p>
        </div>
        <button 
          onClick={() => setShowAddForm(true)}
          className="bg-accent hover:bg-accent/90 text-white px-4 py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest flex items-center gap-2 transition-all shadow-lg shadow-accent/10"
        >
          <Plus className="w-3.5 h-3.5" />
          Register Provider
        </button>
      </header>

      {/* Governance & Budget Protocol */}
      <GovernanceCard />

      {/* Main Section: AI Providers */}
      <section className="space-y-6">
        <div className="flex items-center gap-2 text-[10px] font-bold text-muted/30 uppercase tracking-[0.2em] px-1">
          <Settings2 className="w-3.5 h-3.5" />
          AI Providers & Clusters
        </div>

        {loading && providers.length === 0 ? (
          <div className="py-20 flex flex-col items-center justify-center gap-4 opacity-20 bg-white/[0.01] border border-dashed border-white/10 rounded-2xl">
            <Loader2 className="w-8 h-8 animate-spin text-accent" />
            <p className="text-[10px] uppercase font-bold tracking-[0.3em]">Scanning Network...</p>
          </div>
        ) : providers.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {providers.map((provider) => (
              <ProviderCard 
                key={provider.id} 
                provider={provider} 
                onEdit={handleEdit}
              />
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-20 bg-white/[0.01] border border-dashed border-white/10 rounded-3xl text-center px-6">
            <div className="w-16 h-16 bg-white/[0.02] rounded-full flex items-center justify-center mb-6">
              <Box className="w-8 h-8 text-muted/10" />
            </div>
            <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-muted/40">No Providers Configured</h3>
            <p className="text-[10px] text-muted/20 mt-2 max-w-xs uppercase leading-relaxed font-mono-data">
              Connect your first LLM cluster to enable autonomous sequence execution.
            </p>
            <button 
              onClick={() => setShowAddForm(true)}
              className="mt-8 px-6 py-2.5 bg-white/5 border border-white/10 rounded-xl text-[10px] font-bold text-muted/60 uppercase tracking-widest hover:bg-white/10 transition-all"
            >
              Add First Provider
            </button>
          </div>
        )}
      </section>

      {/* Security Info Card */}
      <section className="p-6 modern-card border-accent/10 bg-accent/[0.02] relative overflow-hidden group">
        <div className="absolute top-0 right-0 p-4 opacity-[0.03] text-accent group-hover:scale-110 transition-transform">
          <ShieldCheck className="w-24 h-24" />
        </div>
        
        <div className="relative z-10 space-y-4">
          <div className="flex items-center gap-2 text-[10px] font-bold text-accent uppercase tracking-widest">
            <Activity className="w-3.5 h-3.5" /> Security Protocol V2
          </div>
          <p className="text-[11px] text-muted-foreground/80 leading-relaxed max-w-2xl font-medium">
            All API credentials are encrypted at rest and processed exclusively through isolated server-side environments. 
            HiveState never exposes full security keys to the browser, ensuring your cluster metrics remain confidential.
          </p>
          <div className="flex items-center gap-6 pt-2">
            <div className="flex items-center gap-2 text-[9px] text-muted/40 font-bold uppercase tracking-tighter">
              <div className="w-1 h-1 rounded-full bg-green-500" />
              AES-256 Storage
            </div>
            <div className="flex items-center gap-2 text-[9px] text-muted/40 font-bold uppercase tracking-tighter">
              <div className="w-1 h-1 rounded-full bg-green-500" />
              Zero-Exposure Client
            </div>
          </div>
        </div>
      </section>

      {/* Add/Edit Form Overlay */}
      {showAddForm && (
        <AddProviderForm 
          editingProvider={editingProvider}
          onClose={handleFormClose}
          onSuccess={fetchProviders}
        />
      )}
    </div>
  );
}
