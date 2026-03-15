import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { usePrivy, useWallets } from "@privy-io/react-auth";
import { Link } from "react-router-dom";

const ADMIN_WALLET = "0xc6525dbbc9ac18fbf9ec93c219670b0dbb6cf2d3";
const MAX_SUPPLY = 779;
const AGENT_SUPPLY = 389;
const HUMAN_SUPPLY = 388;
const FREE_HUMAN = 100;
const PAID_HUMAN = 288;
const TREASURY = 2;
const PROJECT_ID = import.meta.env.VITE_SUPABASE_PROJECT_ID || "ffmqlinwuinxzxwfueim";
const API_BASE = `https://${PROJECT_ID}.supabase.co/functions/v1/agent-mint`;

type Tab = "agents" | "humans" | "about";

interface MintEntry {
  token_id: number;
  tx_hash: string;
  wallet: string;
  free: boolean;
}

interface MintState {
  minted: number;
  total: number;
  remaining: number;
  mintActive: boolean;
  phase: string;
  recentMints: MintEntry[];
}

function truncateAddr(addr: string): string {
  if (!addr || addr.length < 10) return addr || "";
  return addr.slice(0, 6) + "..." + addr.slice(-4);
}

function truncateTx(tx: string): string {
  if (!tx || tx.length < 14) return tx || "";
  return tx.slice(0, 10) + "..." + tx.slice(-4);
}

export default function Mint() {
  const { authenticated } = usePrivy();
  const { wallets } = useWallets();
  const userWallet = wallets[0]?.address?.toLowerCase() || "";
  const isAdmin = userWallet === ADMIN_WALLET;

  const [tab, setTab] = useState<Tab>("humans");
  const [mintState, setMintState] = useState<MintState>({
    minted: 0,
    total: MAX_SUPPLY,
    remaining: MAX_SUPPLY,
    mintActive: false,
    phase: "free",
    recentMints: [],
  });
  const [toggling, setToggling] = useState(false);
  const ledgerRef = useRef<HTMLDivElement>(null);

  const soldOut = mintState.minted >= MAX_SUPPLY;
  const isLive = mintState.mintActive && !soldOut;
  const progress = (mintState.minted / mintState.total) * 100;

  // Fetch state on mount + poll every 10s
  useEffect(() => {
    let active = true;

    const fetchState = () => {
      fetch(`${API_BASE}/state`)
        .then((r) => r.json())
        .then((d) => {
          if (active && d.total) {
            setMintState({
              minted: d.minted ?? 0,
              total: d.total ?? MAX_SUPPLY,
              remaining: d.remaining ?? MAX_SUPPLY,
              mintActive: d.mintActive ?? false,
              phase: d.phase ?? "free",
              recentMints: Array.isArray(d.recentMints) ? d.recentMints : [],
            });
          }
        })
        .catch(() => {});
    };

    fetchState();
    const interval = setInterval(fetchState, 10000);

    return () => {
      active = false;
      clearInterval(interval);
    };
  }, []);

  // Admin toggle handler
  const handleToggle = async () => {
    if (!wallets[0] || toggling) return;
    setToggling(true);
    try {
      const provider = await wallets[0].getEthereumProvider();
      const address = wallets[0].address;
      const newActive = !mintState.mintActive;
      const timestamp = Date.now();
      const message = `nexus:toggle:${newActive}:${timestamp}`;
      const signature = await provider.request({
        method: "personal_sign",
        params: [message, address],
      });
      const res = await fetch(`${API_BASE}/admin/toggle`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: newActive, adminSignature: signature, message }),
      });
      if (res.ok) {
        setMintState((prev) => ({ ...prev, mintActive: newActive }));
      }
    } catch {
      // silently fail
    } finally {
      setToggling(false);
    }
  };

  // Visibility: not active, not admin, not sold out => "COMING SOON"
  if (!mintState.mintActive && !isAdmin && !soldOut) {
    return (
      <div className="min-h-screen flex items-center justify-center px-6 bg-bg">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-center"
        >
          <p className="font-mono text-[10px] tracking-[0.3em] text-fg-dim mb-4">
            NEXUS NODE
          </p>
          <h1 className="text-3xl font-bold font-mono text-fg mb-4 tracking-tight">
            COMING SOON
          </h1>
          <p className="font-mono text-[11px] text-fg-muted max-w-sm mx-auto leading-relaxed">
            A {MAX_SUPPLY}-piece AI agent NFT collection on Base.
            Minting has not started yet.
          </p>

          {/* Game CTA */}
          <Link
            to="/game"
            className="inline-block mt-6 font-mono text-[11px] tracking-widest border border-success text-success px-6 py-2.5 hover:bg-success/10 transition-colors"
          >
            PLAY GAME — EARN PHASE 2 GTD
          </Link>

          <div className="mt-8 flex items-center justify-center gap-4 font-mono text-[9px] tracking-widest text-fg-dim">
            <span>SUPPLY {MAX_SUPPLY}</span>
            <span className="text-border">|</span>
            <span>CHAIN BASE</span>
            <span className="text-border">|</span>
            <span>SHA-256 POW</span>
          </div>
        </motion.div>
      </div>
    );
  }

  const tabs: Tab[] = ["humans", "agents", "about"];

  return (
    <div className="min-h-screen px-4 py-12 md:py-20 bg-bg">
      <div className="max-w-[700px] mx-auto">

        {/* ─── Admin Toggle ─── */}
        {isAdmin && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mb-4 flex justify-center"
          >
            <button
              onClick={handleToggle}
              disabled={toggling}
              className={`font-mono text-[10px] tracking-widest px-5 py-2 border transition-colors cursor-pointer ${
                mintState.mintActive
                  ? "border-error text-error hover:bg-error/10"
                  : "border-success text-success hover:bg-success/10"
              } ${toggling ? "opacity-50 cursor-not-allowed" : ""}`}
            >
              {toggling
                ? "SIGNING..."
                : mintState.mintActive
                ? "PAUSE MINT"
                : "GO LIVE"}
            </button>
          </motion.div>
        )}

        {/* ─── Terminal Window ─── */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="border border-border bg-bg-card"
        >
          {/* Terminal Header Bar */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-[#ff5f57]" />
              <div className="w-2 h-2 rounded-full bg-[#febc2e]" />
              <div className="w-2 h-2 rounded-full bg-[#28c840]" />
              <span className="font-mono text-[10px] tracking-widest text-fg-dim ml-3">
                MINTSTATION {MAX_SUPPLY}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  soldOut
                    ? "bg-error"
                    : isLive
                    ? "bg-success animate-pulse"
                    : "bg-fg-dim"
                }`}
              />
              <span
                className={`font-mono text-[9px] tracking-widest ${
                  soldOut
                    ? "text-error"
                    : isLive
                    ? "text-success"
                    : "text-fg-dim"
                }`}
              >
                {soldOut ? "SOLD OUT" : isLive ? "LIVE" : "PAUSED"}
              </span>
            </div>
          </div>

          {/* ─── Mint Counter ─── */}
          <div className="px-6 pt-8 pb-6">
            <div className="flex items-baseline justify-center gap-2 mb-4">
              <span className="font-mono text-6xl md:text-7xl font-bold text-fg tracking-tight">
                {mintState.minted}
              </span>
              <span className="font-mono text-[13px] text-fg-dim">
                / {MAX_SUPPLY} MINTED
              </span>
            </div>

            {/* Progress Bar */}
            <div className="w-full h-2 bg-border overflow-hidden mb-4">
              <motion.div
                className="h-full bg-accent"
                initial={{ width: 0 }}
                animate={{ width: `${progress}%` }}
                transition={{ duration: 1.2, ease: "easeOut" }}
              />
            </div>

            {/* Supply Breakdown */}
            <div className="grid grid-cols-3 gap-3 mb-4">
              <div className="border border-border px-3 py-2 text-center">
                <p className="font-mono text-[9px] tracking-widest text-fg-dim">AI AGENTS</p>
                <p className="font-mono text-lg text-fg font-bold">{AGENT_SUPPLY}</p>
              </div>
              <div className="border border-border px-3 py-2 text-center">
                <p className="font-mono text-[9px] tracking-widest text-fg-dim">HUMANS FREE</p>
                <p className="font-mono text-lg text-success font-bold">{FREE_HUMAN}</p>
                <p className="font-mono text-[8px] text-fg-dim">PHASE 1 GTD</p>
              </div>
              <div className="border border-border px-3 py-2 text-center">
                <p className="font-mono text-[9px] tracking-widest text-fg-dim">HUMANS $10</p>
                <p className="font-mono text-lg text-accent font-bold">{PAID_HUMAN}</p>
                <p className="font-mono text-[8px] text-fg-dim">PHASE 2 GTD</p>
              </div>
            </div>

            {/* Status Badge */}
            <div className="flex justify-center">
              {soldOut ? (
                <span className="font-mono text-[10px] tracking-widest border border-error text-error px-3 py-1">
                  SOLD OUT
                </span>
              ) : isLive ? (
                <span className="font-mono text-[10px] tracking-widest border border-success text-success px-3 py-1">
                  LIVE
                </span>
              ) : (
                <span className="font-mono text-[10px] tracking-widest border border-fg-dim text-fg-dim px-3 py-1">
                  COMING SOON
                </span>
              )}
            </div>
          </div>

          {/* ─── Tabs ─── */}
          <div className="flex border-t border-b border-border">
            {tabs.map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`flex-1 px-4 py-2.5 font-mono text-[10px] tracking-widest transition-colors cursor-pointer border-b-2 ${
                  tab === t
                    ? "text-fg border-accent"
                    : "text-fg-dim hover:text-fg-muted border-transparent"
                }`}
              >
                {t.toUpperCase()}
              </button>
            ))}
          </div>

          {/* ─── Tab Content ─── */}
          <AnimatePresence mode="wait">
            <motion.div
              key={tab}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="px-6 py-6"
            >
              {tab === "humans" && (
                <div className="font-mono text-[11px] text-fg-muted leading-relaxed space-y-4">
                  <div className="border border-border px-4 py-3">
                    <p className="text-success text-[10px] tracking-widest mb-1">PHASE 1 — FREE MINT</p>
                    <p>First {FREE_HUMAN} GTD spots for humans. Free mint — no cost.</p>
                  </div>
                  <div className="border border-border px-4 py-3">
                    <p className="text-accent text-[10px] tracking-widest mb-1">PHASE 2 — PAID MINT ($10 USD)</p>
                    <p>{PAID_HUMAN} spots available. Earn your GTD by scoring 1000+ in the Space Defender game.</p>
                    <Link
                      to="/game"
                      className="inline-block mt-3 font-mono text-[10px] tracking-widest border border-success text-success px-5 py-2 hover:bg-success/10 transition-colors"
                    >
                      PLAY GAME — EARN GTD
                    </Link>
                  </div>
                </div>
              )}

              {tab === "agents" && (
                <div>
                  <p className="font-mono text-[11px] text-fg-muted leading-relaxed mb-3">
                    {AGENT_SUPPLY} slots reserved for AI agents. Agents mint by solving
                    SHA-256 proof-of-work challenges via our API. First {FREE_HUMAN} free,
                    then $10 USD in ETH.
                  </p>
                  <Link
                    to="/mint/docs"
                    className="inline-block font-mono text-[11px] tracking-widest border border-accent text-accent px-6 py-2.5 hover:bg-accent/10 transition-colors"
                  >
                    AGENT DOCS
                  </Link>
                </div>
              )}

              {tab === "about" && (
                <div className="font-mono text-[11px] text-fg-muted leading-relaxed space-y-3">
                  <p>
                    Nexus Node is a {MAX_SUPPLY}-piece AI agent NFT collection on Base.
                  </p>
                  <div className="border border-border px-4 py-3 space-y-1 text-[10px]">
                    <p className="text-fg-dim tracking-widest mb-2">SUPPLY BREAKDOWN</p>
                    <p>Treasury: {TREASURY}</p>
                    <p>AI Agents: {AGENT_SUPPLY}</p>
                    <p>Humans — Phase 1 Free GTD: {FREE_HUMAN}</p>
                    <p>Humans — Phase 2 Paid GTD ($10): {PAID_HUMAN}</p>
                    <p className="text-fg-dim border-t border-border pt-1 mt-2">Total: {MAX_SUPPLY}</p>
                  </div>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </motion.div>

        {/* ─── Recent Mints Ledger ─── */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="border border-border bg-bg-card mt-6"
        >
          <div className="px-4 py-2.5 border-b border-border flex items-center justify-between">
            <p className="font-mono text-[10px] tracking-widest text-fg-dim">
              RECENT MINTS
            </p>
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
              <span className="font-mono text-[9px] tracking-widest text-success">
                LIVE
              </span>
            </div>
          </div>
          <div ref={ledgerRef} className="max-h-52 overflow-y-auto">
            {mintState.recentMints.length === 0 ? (
              <div className="px-4 py-6 text-center">
                <span className="font-mono text-[10px] text-fg-dim">
                  No mints yet
                </span>
              </div>
            ) : (
              mintState.recentMints.map((entry, i) => (
                <div
                  key={entry.tx_hash || i}
                  className="flex items-center gap-3 px-4 py-2 border-b border-border last:border-b-0 font-mono text-[10px]"
                >
                  <span className="text-fg-dim">#{entry.token_id}</span>
                  <span className="text-fg-dim">|</span>
                  <span className="text-accent">
                    {truncateTx(entry.tx_hash)}
                  </span>
                  <span className="text-fg-dim">|</span>
                  <span className="text-fg-muted">
                    {truncateAddr(entry.wallet)}
                  </span>
                  <span
                    className={`ml-auto text-[9px] tracking-widest px-1.5 py-0.5 border ${
                      entry.free
                        ? "border-success text-success"
                        : "border-accent text-accent"
                    }`}
                  >
                    {entry.free ? "FREE" : "PAID"}
                  </span>
                </div>
              ))
            )}
          </div>
        </motion.div>

        {/* ─── Bottom Stats Bar ─── */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="mt-8 flex items-center justify-center gap-4 font-mono text-[9px] tracking-widest text-fg-dim"
        >
          <span>SUPPLY {MAX_SUPPLY}</span>
          <span className="text-border">|</span>
          <span>CHAIN BASE</span>
          <span className="text-border">|</span>
          <span>SHA-256 POW</span>
        </motion.div>
      </div>
    </div>
  );
}
