-- Phase 9: Governance & Cost Control
-- Implements budget limits, context optimization, and model fallbacks

-- 1. Governance Settings Table (Global)
CREATE TABLE IF NOT EXISTS public.governance_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    daily_spend_limit NUMERIC DEFAULT 100, -- Default 100 INR
    context_optimization_enabled BOOLEAN DEFAULT false,
    primary_model TEXT DEFAULT 'gemini-2.0-flash',
    fallback_model TEXT DEFAULT 'gemini-1.5-flash',
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Seed initial settings
INSERT INTO public.governance_settings (daily_spend_limit, context_optimization_enabled)
VALUES (100, false)
ON CONFLICT DO NOTHING;

-- 2. Update Runs table for optimization tracking
ALTER TABLE public.runs 
ADD COLUMN IF NOT EXISTS tokens_saved INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS is_optimized BOOLEAN DEFAULT false;

-- 3. Update Logs table for fallback tracking
ALTER TABLE public.logs 
ADD COLUMN IF NOT EXISTS model_used TEXT,
ADD COLUMN IF NOT EXISTS fallback_triggered BOOLEAN DEFAULT false;

-- 4. Function to get today's total spend
CREATE OR REPLACE FUNCTION get_today_spend()
RETURNS NUMERIC AS $$
BEGIN
    RETURN (
        SELECT COALESCE(SUM(step_cost), 0)
        FROM public.logs
        WHERE created_at >= CURRENT_DATE
    );
END;
$$ LANGUAGE plpgsql;
