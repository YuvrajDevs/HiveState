-- AI Providers Migration
-- Upgrades settings to support multiple model integrations

-- Create ai_providers table
CREATE TABLE IF NOT EXISTS public.ai_providers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL, -- 'gemini', 'openai', 'anthropic', 'custom'
    label TEXT,        -- Friendly name (e.g. "Primary GPT-4")
    api_key TEXT NOT NULL,
    base_url TEXT,     -- For custom/proxy providers
    rate_limit INTEGER, -- Requests per minute
    is_active BOOLEAN DEFAULT true,
    is_default BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Index for status filtering
CREATE INDEX IF NOT EXISTS idx_ai_providers_active ON public.ai_providers(is_active);

-- Migrate existing gemini key if it exists
INSERT INTO public.ai_providers (name, label, api_key, is_active, is_default)
SELECT 
    provider as name,
    'Default ' || INITCAP(provider) as label,
    key as api_key,
    true as is_active,
    true as is_default
FROM public.api_keys
ON CONFLICT DO NOTHING;

-- Optional: Drop old api_keys table if desired, 
-- but we'll keep it for now just in case.
