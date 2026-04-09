"use client";

import { useState, useEffect } from "react";
import { ShieldAlert, Zap, Coins, Check, Loader2, Save } from "lucide-react";
import { getGovernanceSettings, updateGovernanceSettings } from "@/app/actions/governance";

export default function GovernanceCard() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState({
    daily_spend_limit: 100,
    context_optimization_enabled: false,
    primary_model: "gemini-2.5-flash",
    fallback_model: "gemini-2.5-flash"
  });
  const [showSaved, setShowSaved] = useState(false);

  useEffect(() => {
    async function init() {
      const res = await getGovernanceSettings();
      if (res.success && res.settings) {
        setSettings(res.settings);
      }
      setLoading(false);
    }
    init();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    const res = await updateGovernanceSettings(settings);
    if (res.success) {
      setShowSaved(true);
      setTimeout(() => setShowSaved(false), 2000);
    }
    setSaving(false);
  };

  if (loading) {
    return (
      <div className="modern-card p-12 flex flex-col items-center justify-center opacity-40">
        <Loader2 className="w-6 h-6 animate-spin text-accent mb-4" />
        <p className="text-[10px] font-bold uppercase tracking-widest">Loading Protocol...</p>
      </div>
    );
  }

  return (
    <section className="modern-card p-6 border-white/5 bg-white/[0.01] space-y-8 relative overflow-hidden">
      <div className="absolute top-0 left-0 w-1 h-full bg-accent/20" />
      
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-[10px] font-bold text-accent uppercase tracking-widest">
            <ShieldAlert className="w-3.5 h-3.5" />
            Network Governance & Budget
          </div>
          <p className="text-[11px] text-muted/40 max-w-sm uppercase font-mono-data leading-relaxed">
            Configure system-wide cost caps and intelligent context propagation models.
          </p>
        </div>
        
        <button 
          onClick={handleSave}
          disabled={saving}
          className={`px-4 py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest flex items-center gap-2 transition-all ${
            showSaved ? 'bg-green-500/20 text-green-500 border border-green-500/30' : 'bg-white/5 hover:bg-white/10 text-muted/60 border border-white/10'
          }`}
        >
          {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : showSaved ? <Check className="w-3.5 h-3.5" /> : <Save className="w-3.5 h-3.5" />}
          {showSaved ? 'Protocol Applied' : 'Commit Changes'}
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Cost Controls */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-[9px] font-bold text-muted/60 uppercase tracking-tighter">
            <Coins className="w-3 h-3" /> Cost Enforcement
          </div>
          
          <div className="space-y-4 pt-2">
            <div className="group">
              <label className="text-[10px] text-muted/40 uppercase font-black tracking-widest mb-2 block">Daily Spend Limit (₹)</label>
              <div className="relative">
                <input 
                  type="number"
                  value={settings.daily_spend_limit}
                  onChange={(e) => setSettings({ ...settings, daily_spend_limit: Number(e.target.value) })}
                  className="w-full bg-white/[0.02] border border-white/5 rounded-xl px-4 py-3 text-xs font-bold text-foreground focus:outline-none focus:border-accent/40 transition-all font-mono-data"
                  placeholder="0.00"
                />
                <div className="absolute right-4 top-1/2 -translate-y-1/2 text-[9px] text-muted/20 font-bold uppercase">INR / DAY</div>
              </div>
              <p className="text-[8px] text-muted/20 mt-2 uppercase">Workflow execution stops immediately upon reaching this threshold.</p>
            </div>
          </div>
        </div>

        {/* Intelligence Controls */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-[9px] font-bold text-muted/60 uppercase tracking-tighter">
            <Zap className="w-3 h-3" /> Input Optimization
          </div>
          
          <div className="space-y-6 pt-2">
            <div className="flex items-start justify-between gap-4 p-4 bg-white/[0.02] border border-white/5 rounded-2xl group hover:border-accent/20 transition-all cursor-pointer"
                 onClick={() => setSettings({ ...settings, context_optimization_enabled: !settings.context_optimization_enabled })}>
              <div className="space-y-1">
                <h4 className="text-[10px] font-bold uppercase tracking-wider text-muted/80">Context Summarization</h4>
                <p className="text-[8px] text-muted/20 uppercase leading-relaxed font-mono-data">Compress large initial inputs into a semantic summary to save ~40% tokens on downstream nodes.</p>
              </div>
              <div className={`w-10 h-5 rounded-full relative transition-all ${settings.context_optimization_enabled ? 'bg-accent/40' : 'bg-white/10'}`}>
                <div className={`absolute top-1 w-3 h-3 rounded-full bg-white transition-all ${settings.context_optimization_enabled ? 'right-1' : 'left-1'}`} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-[9px] text-muted/30 uppercase font-bold tracking-widest">Primary Model</label>
                <select 
                  value={settings.primary_model}
                  onChange={(e) => setSettings({ ...settings, primary_model: e.target.value })}
                  className="w-full bg-white/[0.02] border border-white/5 rounded-lg px-3 py-2 text-[10px] font-bold text-foreground focus:outline-none focus:border-accent/40 transition-all uppercase tracking-tighter"
                >
                  <option value="gemini-2.5-flash">Gemini 2.5 Flash</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-[9px] text-muted/30 uppercase font-bold tracking-widest">Fallback Model</label>
                <select 
                   value={settings.fallback_model}
                   onChange={(e) => setSettings({ ...settings, fallback_model: e.target.value })}
                   className="w-full bg-white/[0.02] border border-white/5 rounded-lg px-3 py-2 text-[10px] font-bold text-foreground focus:outline-none focus:border-accent/40 transition-all uppercase tracking-tighter"
                >
                  <option value="gemini-2.5-flash">Gemini 2.5 Flash</option>
                </select>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
