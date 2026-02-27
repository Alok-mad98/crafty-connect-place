
-- Agent wallets: one per user, created on first login
CREATE TABLE public.agent_wallets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_wallet TEXT NOT NULL UNIQUE,
  agent_wallet_address TEXT NOT NULL,
  agent_wallet_id TEXT NOT NULL,
  network TEXT NOT NULL DEFAULT 'base-mainnet',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Agent memory: stores learned data per user
CREATE TABLE public.agent_memory (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_wallet TEXT NOT NULL,
  memory_type TEXT NOT NULL DEFAULT 'interaction',
  content JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Master agent config (singleton for the bot's own wallet)
CREATE TABLE public.agent_config (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  key TEXT NOT NULL UNIQUE,
  value TEXT NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Twitter mentions queue
CREATE TABLE public.twitter_mentions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tweet_id TEXT NOT NULL UNIQUE,
  author_handle TEXT NOT NULL,
  author_id TEXT,
  text TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  response_tweet_id TEXT,
  skill_id UUID REFERENCES public.skills(id),
  processed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE public.agent_wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_memory ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.twitter_mentions ENABLE ROW LEVEL SECURITY;

-- Public read for agent wallets (wallet-based auth, not supabase auth)
CREATE POLICY "Agent wallets publicly readable" ON public.agent_wallets FOR SELECT USING (true);
CREATE POLICY "Agent wallets insertable" ON public.agent_wallets FOR INSERT WITH CHECK (true);

CREATE POLICY "Agent memory readable" ON public.agent_memory FOR SELECT USING (true);
CREATE POLICY "Agent memory insertable" ON public.agent_memory FOR INSERT WITH CHECK (true);

CREATE POLICY "Agent config readable" ON public.agent_config FOR SELECT USING (true);
CREATE POLICY "Agent config manageable" ON public.agent_config FOR ALL USING (true);

CREATE POLICY "Twitter mentions readable" ON public.twitter_mentions FOR SELECT USING (true);
CREATE POLICY "Twitter mentions manageable" ON public.twitter_mentions FOR ALL USING (true);

-- Indexes
CREATE INDEX idx_agent_wallets_user ON public.agent_wallets(user_wallet);
CREATE INDEX idx_agent_memory_user ON public.agent_memory(user_wallet);
CREATE INDEX idx_twitter_mentions_status ON public.twitter_mentions(status);
CREATE INDEX idx_twitter_mentions_tweet ON public.twitter_mentions(tweet_id);
