"use client";

import { getSettingsLocked } from "@/app/actions/governance";
import { useState, useEffect, useCallback } from "react";
import { 
  Plus, 
  ShieldCheck, 
  Activity, 
  
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
  const [locked, setLocked] = useState(false);
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

  // Initial load: state is set only after the request resolves, and not after unmount
  useEffect(() => {
    let live = true;
    getSettingsLocked().then((v) => live && setLocked(v));
    getProviders().then((result) => {
      if (!live) return;
      if (result.success) setProviders(result.providers || []);
      setLoading(false);
    });
    return () => {
      live = false;
    };
  }, []);

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
          <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
          {locked && (
            <p className="mt-2 inline-flex items-center gap-2 rounded-lg bg-surface-2 px-3 py-1.5 text-xs text-muted">
              <span className="h-1.5 w-1.5 rounded-full bg-warning" aria-hidden /> Read-only in the live demo: you can look, but changes are not saved.
            </p>
          )}
          <p className="text-muted/85 text-xs">
            Daily budget, models and AI provider keys. 
          </p>
        </div>
        <button 
          onClick={() => setShowAddForm(true)}
          className="bg-accent hover:bg-accent/90 text-white px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all shadow-lg"
        >
          <Plus className="w-3.5 h-3.5" />
          Add provider
        </button>
      </header>

      {/* Governance & Budget Protocol */}
      <GovernanceCard />

      {/* Main Section: AI Providers */}
      <section className="space-y-6">
        <div className="flex items-center gap-2 text-xs font-semibold text-muted/80 px-1">
          <Settings2 className="w-3.5 h-3.5" />
          AI providers
        </div>

        {loading && providers.length === 0 ? (
          <div className="py-20 flex flex-col items-center justify-center gap-4 opacity-20 bg-white/[0.01] border border-dashed border-white/10 rounded-2xl">
            <Loader2 className="w-8 h-8 animate-spin text-accent" />
            <p className="text-xs font-semibold">Scanning Network...</p>
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
              <Box className="w-8 h-8 text-muted/85" />
            </div>
            <h3 className="text-xs font-semibold text-muted/80">No providers configured</h3>
            <p className="text-xs text-muted/80 mt-2 max-w-xs leading-relaxed">
              Add a provider key. Keys are stored on the server and never sent to the browser.
            </p>
            <button 
              onClick={() => setShowAddForm(true)}
              className="mt-8 px-6 py-2.5 bg-white/5 border border-white/10 rounded-xl text-xs font-semibold text-muted/85 hover:bg-white/10 transition-all"
            >
              Add first provider
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
          <div className="flex items-center gap-2 text-xs font-semibold text-accent">
            <Activity className="w-3.5 h-3.5" /> Security
          </div>
          <p className="text-micro text-muted-foreground/80 leading-relaxed max-w-2xl font-medium">
            All API credentials are encrypted at rest and processed exclusively through isolated server-side environments. 
            HiveState never exposes full security keys to the browser, only a masked hint.
          </p>
          <div className="flex items-center gap-6 pt-2">
            <div className="flex items-center gap-2 text-micro text-muted/80 font-semibold">
              <div className="w-1 h-1 rounded-full bg-success" />
              AES-256 Storage
            </div>
            <div className="flex items-center gap-2 text-micro text-muted/80 font-semibold">
              <div className="w-1 h-1 rounded-full bg-success" />
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
