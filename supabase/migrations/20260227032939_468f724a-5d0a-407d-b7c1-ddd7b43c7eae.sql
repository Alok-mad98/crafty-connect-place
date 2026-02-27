
-- Skills table to store marketplace listings
CREATE TABLE public.skills (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  price NUMERIC(12,2) NOT NULL CHECK (price >= 2.00),
  model_tags TEXT[] NOT NULL DEFAULT '{}',
  ipfs_cid TEXT NOT NULL,
  onchain_id INTEGER,
  creator_wallet TEXT NOT NULL,
  tx_hash TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Purchases table
CREATE TABLE public.purchases (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  skill_id UUID NOT NULL REFERENCES public.skills(id) ON DELETE CASCADE,
  buyer_wallet TEXT NOT NULL,
  tx_hash TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(skill_id, buyer_wallet)
);

-- Enable RLS
ALTER TABLE public.skills ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchases ENABLE ROW LEVEL SECURITY;

-- Skills are publicly readable
CREATE POLICY "Skills are publicly readable"
  ON public.skills FOR SELECT USING (true);

-- Anyone can insert skills (wallet-based auth, not supabase auth)
CREATE POLICY "Anyone can insert skills"
  ON public.skills FOR INSERT WITH CHECK (true);

-- Purchases are publicly readable  
CREATE POLICY "Purchases are publicly readable"
  ON public.purchases FOR SELECT USING (true);

-- Anyone can insert purchases
CREATE POLICY "Anyone can insert purchases"
  ON public.purchases FOR INSERT WITH CHECK (true);

-- Updated_at trigger
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_skills_updated_at
  BEFORE UPDATE ON public.skills
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Index for fast lookups
CREATE INDEX idx_skills_active ON public.skills(active);
CREATE INDEX idx_purchases_buyer ON public.purchases(buyer_wallet);
CREATE INDEX idx_purchases_skill ON public.purchases(skill_id);
