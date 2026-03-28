
CREATE TABLE public.game_pnl (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet text NOT NULL UNIQUE,
  total_wagered numeric NOT NULL DEFAULT 0,
  total_won numeric NOT NULL DEFAULT 0,
  pnl numeric NOT NULL DEFAULT 0,
  rounds_played integer NOT NULL DEFAULT 0,
  last_round_id integer,
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.game_pnl ENABLE ROW LEVEL SECURITY;

CREATE POLICY "game_pnl_readable" ON public.game_pnl FOR SELECT TO public USING (true);
CREATE POLICY "game_pnl_insertable" ON public.game_pnl FOR INSERT TO public WITH CHECK (true);
CREATE POLICY "game_pnl_updatable" ON public.game_pnl FOR UPDATE TO public USING (true);

ALTER PUBLICATION supabase_realtime ADD TABLE public.game_pnl;
