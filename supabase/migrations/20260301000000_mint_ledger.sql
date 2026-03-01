
-- Mint ledger: tracks every successful mint
CREATE TABLE public.mint_ledger (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  token_id INTEGER NOT NULL UNIQUE,
  wallet TEXT NOT NULL,
  tx_hash TEXT NOT NULL,
  pow_time_ms INTEGER,
  free BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Mint config: admin-controlled key/value store
CREATE TABLE public.mint_config (
  key TEXT NOT NULL PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Insert default config
INSERT INTO public.mint_config (key, value) VALUES
  ('mint_active', 'false'),
  ('mint_price_wei', '4000000000000000');

-- Used payment tx hashes (prevent reuse)
CREATE TABLE public.used_payment_txs (
  tx_hash TEXT NOT NULL PRIMARY KEY,
  wallet TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE public.mint_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mint_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.used_payment_txs ENABLE ROW LEVEL SECURITY;

-- Mint ledger: public read, service-role insert
CREATE POLICY "Mint ledger publicly readable" ON public.mint_ledger FOR SELECT USING (true);
CREATE POLICY "Mint ledger service insert" ON public.mint_ledger FOR INSERT WITH CHECK (true);

-- Mint config: public read, service-role update
CREATE POLICY "Mint config publicly readable" ON public.mint_config FOR SELECT USING (true);
CREATE POLICY "Mint config service manage" ON public.mint_config FOR ALL USING (true);

-- Used payment txs: service only
CREATE POLICY "Used txs service manage" ON public.used_payment_txs FOR ALL USING (true);

-- Indexes
CREATE INDEX idx_mint_ledger_wallet ON public.mint_ledger(wallet);
CREATE INDEX idx_mint_ledger_created ON public.mint_ledger(created_at DESC);
