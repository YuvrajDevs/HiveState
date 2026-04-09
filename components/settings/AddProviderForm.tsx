"use client";

import { useState, useEffect } from "react";
import { 
  X, 
  Plus, 
  ShieldCheck, 
  Activity, 
  Database, 
  Globe, 
  Loader2, 
  ShieldAlert,
  Save,
  Box
} from "lucide-react";
import { saveProvider, AIProvider } from "@/app/actions/providers";

type FormProps = {
  editingProvider: AIProvider | null;
  onClose: () => void;
  onSuccess: () => void;
};

export default function AddProviderForm({ editingProvider, onClose, onSuccess }: FormProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form State
  const [formData, setFormData] = useState({
    name: "gemini",
    label: "",
    api_key: "",
    base_url: "",
    rate_limit: "",
    is_default: false,
    is_active: true,
  });

  useEffect(() => {
    if (editingProvider) {
      setFormData({
        name: editingProvider.name || "gemini",
        label: editingProvider.label || "",
        api_key: "", // Don't pre-fill existing keys
        base_url: editingProvider.base_url || "",
        rate_limit: editingProvider.rate_limit?.toString() || "",
        is_default: editingProvider.is_default || false,
        is_active: editingProvider.is_active ?? true,
      });
    }
  }, [editingProvider]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const result = await saveProvider({
        ...formData,
        id: editingProvider?.id,
        rate_limit: formData.rate_limit ? parseInt(formData.rate_limit) : null,
      });

      if (result.success) {
        onSuccess();
        onClose();
      } else {
        setError(result.error || "Failed to save provider.");
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-lg bg-surface border border-white/5 rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
        
        <div className="p-6 border-b border-white/5 flex items-center justify-between bg-white/[0.02]">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-accent/10 rounded-lg">
              <Plus className="w-4 h-4 text-accent" />
            </div>
            <div>
              <h2 className="text-sm font-bold uppercase tracking-widest">
                {editingProvider ? "Edit Provider" : "Register Cluster"}
              </h2>
              <p className="text-[10px] text-muted/40 uppercase tracking-tighter mt-0.5">
                Configure AI system endpoints and credentials
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 hover:bg-white/5 rounded-full text-muted/40 hover:text-foreground transition-all"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-[9px] font-bold text-muted/40 uppercase tracking-widest px-1">Provider Engine</label>
              <select 
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-xs font-bold uppercase tracking-wider outline-none focus:ring-1 focus:ring-accent/50 transition-all cursor-pointer"
              >
                <option value="gemini">Google Gemini</option>
                <option value="openai">OpenAI (O-Series)</option>
                <option value="anthropic">Anthropic (Claude)</option>
                <option value="custom">Custom Proxy / Local</option>
              </select>
            </div>
            
            <div className="space-y-2">
              <label className="text-[9px] font-bold text-muted/40 uppercase tracking-widest px-1">Identification Label</label>
              <input 
                type="text"
                placeholder="e.g. Primary Production"
                value={formData.label}
                onChange={(e) => setFormData({ ...formData, label: e.target.value })}
                className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-xs outline-none focus:ring-1 focus:ring-accent/50 transition-all placeholder:text-muted/10 font-bold uppercase tracking-wider"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-[9px] font-bold text-muted/40 uppercase tracking-widest px-1 flex items-center justify-between">
               API Credentials
               <div className="flex items-center gap-1 text-[8px] text-accent/40 lowercase italic font-normal tracking-normal">
                  <ShieldCheck className="w-2.5 h-2.5" /> End-to-end encrypted
               </div>
            </label>
            <input 
              required={!editingProvider}
              type="password"
              placeholder={editingProvider ? "••••••••••••••••••••" : "AIzaSy... or sk-..."}
              value={formData.api_key}
              onChange={(e) => setFormData({ ...formData, api_key: e.target.value })}
              className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-xs font-mono-data outline-none focus:ring-1 focus:ring-accent/50 transition-all placeholder:text-muted/10"
            />
          </div>

          {(formData.name === 'custom' || formData.name === 'openai') && (
            <div className="space-y-2 animate-in slide-in-from-top-2 duration-200">
              <label className="text-[9px] font-bold text-muted/40 uppercase tracking-widest px-1">Base Endpoint (Optional)</label>
              <input 
                type="url"
                placeholder="https://api.openai.com/v1"
                value={formData.base_url}
                onChange={(e) => setFormData({ ...formData, base_url: e.target.value })}
                className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-xs font-mono-data outline-none focus:ring-1 focus:ring-accent/50 transition-all placeholder:text-muted/10"
              />
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-[9px] font-bold text-muted/40 uppercase tracking-widest px-1">Rate Limit (RPM)</label>
              <input 
                type="number"
                placeholder="Unlimited"
                value={formData.rate_limit}
                onChange={(e) => setFormData({ ...formData, rate_limit: e.target.value })}
                className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-xs font-mono-data outline-none focus:ring-1 focus:ring-accent/50 transition-all placeholder:text-muted/10"
              />
            </div>
            
            <div className="flex items-center gap-3 pt-6 px-1">
              <input 
                id="is_default"
                type="checkbox"
                checked={formData.is_default}
                onChange={(e) => setFormData({ ...formData, is_default: e.target.checked })}
                className="w-4 h-4 rounded border-white/10 bg-black/40 text-accent focus:ring-accent/50 transition-all"
              />
              <label htmlFor="is_default" className="text-[9px] font-bold text-muted/60 uppercase tracking-widest cursor-pointer">Set as Primary</label>
            </div>
          </div>

          {error && (
            <div className="flex items-start gap-3 p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-500 text-[10px] font-bold uppercase tracking-widest">
              <ShieldAlert className="w-4 h-4 shrink-0" />
              {error}
            </div>
          )}

          <div className="flex items-center gap-3 pt-4">
            <button 
              type="button"
              onClick={onClose}
              className="flex-1 py-3 border border-white/5 rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-white/5 transition-all"
            >
              Cancel
            </button>
            <button 
              type="submit"
              disabled={loading}
              className="flex-[2] py-3 bg-accent hover:bg-accent/90 text-white font-bold rounded-xl text-[10px] tracking-widest transition-all flex items-center justify-center gap-2 shadow-lg shadow-accent/20 disabled:opacity-50"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {editingProvider ? "Update Provider" : "Register Cluster"}
            </button>
          </div>
        </form>

      </div>
    </div>
  );
}
