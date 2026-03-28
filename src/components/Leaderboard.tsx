import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";

const REWARD_TIERS: Record<number, number> = {
  1: 2000, 2: 1500, 3: 1160, 4: 800, 5: 650,
  6: 550, 7: 475, 8: 425, 9: 375, 10: 325,
  11: 275, 12: 250, 13: 225, 14: 200, 15: 175,
  16: 150, 17: 135, 18: 120, 19: 110, 20: 100,
};

type PnlEntry = {
  id: string;
  wallet: string;
  total_wagered: number;
  total_won: number;
  pnl: number;
  rounds_played: number;
  updated_at: string;
};

export default function Leaderboard() {
  const [entries, setEntries] = useState<PnlEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchLeaderboard = async () => {
    const { data, error } = await supabase
      .from("game_pnl")
      .select("*")
      .order("pnl", { ascending: false })
      .limit(20);

    if (!error && data) {
      setEntries(data as unknown as PnlEntry[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchLeaderboard();

    // Real-time subscription
    const channel = supabase
      .channel("leaderboard-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "game_pnl" },
        () => {
          fetchLeaderboard();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const formatPnl = (val: number) => {
    const sign = val >= 0 ? "+" : "";
    return `${sign}${val.toFixed(4)}`;
  };

  const truncateWallet = (w: string) =>
    `${w.slice(0, 6)}...${w.slice(-4)}`;

  return (
    <div className="w-full max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="font-mono text-lg tracking-wider text-fg">
            🏆 PNL LEADERBOARD
          </h2>
          <p className="font-mono text-[9px] text-fg-dim tracking-widest mt-1">
            TOP 20 TRADERS · 10,000 USDC PRIZE POOL · REAL-TIME
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-block w-2 h-2 bg-success rounded-full animate-pulse" />
          <span className="font-mono text-[9px] text-success tracking-wider">LIVE</span>
        </div>
      </div>

      {/* Table Header */}
      <div className="grid grid-cols-[40px_1fr_100px_100px_90px] md:grid-cols-[50px_1fr_120px_120px_100px] gap-2 px-3 py-2 border-b border-border mb-1">
        <span className="font-mono text-[8px] tracking-widest text-fg-dim">RANK</span>
        <span className="font-mono text-[8px] tracking-widest text-fg-dim">WALLET</span>
        <span className="font-mono text-[8px] tracking-widest text-fg-dim text-right">PNL (ETH)</span>
        <span className="font-mono text-[8px] tracking-widest text-fg-dim text-right">ROUNDS</span>
        <span className="font-mono text-[8px] tracking-widest text-fg-dim text-right">REWARD</span>
      </div>

      {/* Loading */}
      {loading && (
        <div className="py-12 text-center">
          <span className="font-mono text-xs text-fg-dim animate-pulse">Loading leaderboard...</span>
        </div>
      )}

      {/* Empty state */}
      {!loading && entries.length === 0 && (
        <div className="py-12 text-center border border-border/30 rounded-md">
          <p className="font-mono text-xs text-fg-dim">No data yet. Play the grid game to appear here!</p>
        </div>
      )}

      {/* Entries */}
      <AnimatePresence mode="popLayout">
        {entries.map((entry, idx) => {
          const rank = idx + 1;
          const reward = REWARD_TIERS[rank] || 0;
          const isTop3 = rank <= 3;
          const pnlPositive = entry.pnl >= 0;

          return (
            <motion.div
              key={entry.wallet}
              layout
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ duration: 0.3, delay: idx * 0.02 }}
              className={`grid grid-cols-[40px_1fr_100px_100px_90px] md:grid-cols-[50px_1fr_120px_120px_100px] gap-2 px-3 py-2.5 border-b border-border/20 hover:bg-surface/50 transition-colors ${
                isTop3 ? "bg-surface/30" : ""
              }`}
            >
              {/* Rank */}
              <div className="flex items-center">
                <span
                  className={`font-mono text-sm font-bold ${
                    rank === 1
                      ? "text-warning"
                      : rank === 2
                      ? "text-fg-muted"
                      : rank === 3
                      ? "text-accent"
                      : "text-fg-dim"
                  }`}
                >
                  {rank === 1 ? "🥇" : rank === 2 ? "🥈" : rank === 3 ? "🥉" : `#${rank}`}
                </span>
              </div>

              {/* Wallet */}
              <div className="flex items-center">
                <span className="font-mono text-[11px] text-fg tracking-wide">
                  <span className="hidden md:inline">{entry.wallet}</span>
                  <span className="md:hidden">{truncateWallet(entry.wallet)}</span>
                </span>
              </div>

              {/* PnL */}
              <div className="flex items-center justify-end">
                <span
                  className={`font-mono text-[11px] font-semibold ${
                    pnlPositive ? "text-success" : "text-destructive"
                  }`}
                >
                  {formatPnl(entry.pnl)}
                </span>
              </div>

              {/* Rounds */}
              <div className="flex items-center justify-end">
                <span className="font-mono text-[11px] text-fg-muted">
                  {entry.rounds_played}
                </span>
              </div>

              {/* Reward */}
              <div className="flex items-center justify-end">
                <span
                  className={`font-mono text-[11px] font-bold ${
                    isTop3 ? "text-warning" : "text-accent"
                  }`}
                >
                  ${reward.toLocaleString()}
                </span>
              </div>
            </motion.div>
          );
        })}
      </AnimatePresence>

      {/* Prize pool footer */}
      <div className="mt-4 p-3 border border-border/40 rounded-md bg-surface/20">
        <div className="flex justify-between items-center">
          <span className="font-mono text-[9px] text-fg-dim tracking-widest">
            TOTAL PRIZE POOL
          </span>
          <span className="font-mono text-sm text-warning font-bold">
            $10,000 USDC
          </span>
        </div>
        <div className="flex justify-between items-center mt-1">
          <span className="font-mono text-[9px] text-fg-dim tracking-widest">
            MIN REWARD (RANK 20)
          </span>
          <span className="font-mono text-[11px] text-accent">$100 USDC</span>
        </div>
      </div>
    </div>
  );
}
