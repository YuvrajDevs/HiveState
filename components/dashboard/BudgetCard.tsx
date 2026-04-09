"use client";

import { useEffect, useState } from "react";
import { Coins, Loader2, Wallet } from "lucide-react";
import { motion } from "framer-motion";
import { getGovernanceSettings, getTodaySpend } from "@/app/actions/governance";

export function BudgetCard() {
  const [data, setData] = useState<{ spend: number; limit: number } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      const [settingsRes, spendRes] = await Promise.all([
        getGovernanceSettings(),
        getTodaySpend()
      ]);

      if (settingsRes.success && spendRes.success) {
        setData({
          spend: Number(spendRes.spend) || 0,
          limit: Number(settingsRes.settings?.daily_spend_limit) || 0
        });
      }
      setLoading(false);
    }

    fetchData();
    // Refresh every 30 seconds
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="modern-card p-5 border-white/5 bg-white/[0.01] rounded-xl flex items-center justify-center min-h-[140px]">
        <Loader2 className="w-4 h-4 animate-spin text-accent/40" />
      </div>
    );
  }

  const spend = data?.spend || 0;
  const limit = data?.limit || 0;
  const percentage = limit > 0 ? Math.min((spend / limit) * 100, 100) : 0;
  const isExceeded = limit > 0 && spend >= limit;

  return (
    <div className="modern-card p-5 space-y-4 rounded-xl border-white/5 bg-white/[0.01] relative overflow-hidden group">
      <div className="flex items-center justify-between border-b border-white/5 pb-2">
        <h3 className="text-[9px] font-bold text-muted/40 uppercase tracking-[0.2em] flex items-center gap-2">
          <Coins className="w-3 h-3 text-accent" />
          Budget Protocol
        </h3>
        <span className={`text-[8px] font-bold px-2 py-0.5 rounded-full uppercase tracking-tighter ${
          isExceeded ? 'bg-red-500/20 text-red-500 border border-red-500/20' : 'bg-accent/10 text-accent/60 border border-accent/10'
        }`}>
          {isExceeded ? 'Limit Reached' : 'Quota Active'}
        </span>
      </div>

      <div className="space-y-4 pt-1">
        <div className="flex items-end justify-between">
          <div className="space-y-1">
            <span className="text-[10px] uppercase text-muted/30 font-bold tracking-widest block">Today's Spend</span>
            <div className="flex items-baseline gap-1">
              <span className={`text-xl font-bold font-mono-data tabular-nums ${isExceeded ? 'text-red-500' : 'text-foreground/80'}`}>
                ₹{spend.toFixed(2)}
              </span>
              <span className="text-[10px] text-muted/20 font-bold uppercase tracking-tighter">/ ₹{limit}</span>
            </div>
          </div>
          <Wallet className={`w-8 h-8 opacity-[0.03] absolute right-4 bottom-8 ${isExceeded ? 'text-red-500 opacity-[0.1]' : 'text-accent'}`} />
        </div>

        <div className="space-y-2">
          <div className="h-1.5 w-full bg-white/[0.03] rounded-full overflow-hidden border border-white/5">
            <motion.div 
              className={`h-full ${isExceeded ? 'bg-red-500' : 'bg-accent'}`}
              initial={{ width: 0 }}
              animate={{ width: `${percentage}%` }}
              transition={{ duration: 1, ease: "easeOut" }}
            />
          </div>
          <div className="flex justify-between items-center text-[8px] font-mono-data uppercase text-muted/20 tracking-widest">
            <span>Utilization</span>
            <span>{percentage.toFixed(1)}%</span>
          </div>
        </div>
      </div>

      <div className={`absolute bottom-0 left-0 h-0.5 bg-accent/20 transition-all duration-500 ${isExceeded ? 'w-full bg-red-500/40' : 'w-0 group-hover:w-full'}`} />
    </div>
  );
}
