import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { usePrivy, useWallets } from "@privy-io/react-auth";
import { Link } from "react-router-dom";

const ADMIN_WALLET = "0xc6525dbbc9ac18fbf9ec93c219670b0dbb6cf2d3";
const MAX_SUPPLY = 779;
const TREASURY = 2;
const PROJECT_ID = import.meta.env.VITE_SUPABASE_PROJECT_ID || "ffmqlinwuinxzxwfueim";
const API_BASE = `https://${PROJECT_ID}.supabase.co/functions/v1/agent-mint`;

// GTD Phase 1 timing
const GTD_START = new Date("2026-03-19T09:30:00Z");
const GTD_END = new Date("2026-03-19T12:00:00Z");

// Supply breakdown (hardcoded to match contract)
const GTD_PHASE1_COUNT = 109;
const AGENTIC_PUBLIC_SUPPLY = MAX_SUPPLY - TREASURY - GTD_PHASE1_COUNT; // 668

type Tab = "mint" | "agents" | "about";

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
  currentPhase: string;
  phase1Start: number;
  phase1End: number;
  gtdTotal: number;
  gtdMinted: number;
  recentMints: MintEntry[];
}

interface WLStatus {
  whitelisted: boolean;
  minted: boolean;
  canMint: boolean;
  reason: string;
  currentPhase: string;
}

function truncateAddr(addr: string): string {
  if (!addr || addr.length < 10) return addr || "";
  return addr.slice(0, 6) + "..." + addr.slice(-4);
}

function truncateTx(tx: string): string {
  if (!tx || tx.length < 14) return tx || "";
  return tx.slice(0, 10) + "..." + tx.slice(-4);
}

function Countdown({ target, label }: { target: number; label: string }) {
  const [timeLeft, setTimeLeft] = useState("");

  useEffect(() => {
    const tick = () => {
      const diff = target - Date.now();
      if (diff <= 0) { setTimeLeft("NOW"); return; }
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setTimeLeft(`${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`);
    };
    tick();
    const iv = setInterval(tick, 1000);
    return () => clearInterval(iv);
  }, [target]);

  return (
    <div className="text-center">
      <p className="font-mono text-[9px] tracking-widest text-fg-dim mb-1">{label}</p>
      <p className="font-mono text-2xl text-accent font-bold tracking-wider">{timeLeft}</p>
    </div>
  );
}

export default function Mint() {
  const { authenticated, login } = usePrivy();
  const { wallets } = useWallets();
  const userWallet = wallets[0]?.address?.toLowerCase() || "";
  const isAdmin = userWallet === ADMIN_WALLET;

  const [tab, setTab] = useState<Tab>("mint");
  const [mintState, setMintState] = useState<MintState>({
    minted: 0, total: MAX_SUPPLY, remaining: MAX_SUPPLY,
    mintActive: false, currentPhase: "waiting",
    phase1Start: 0, phase1End: 0,
    gtdTotal: 0, gtdMinted: 0, recentMints: [],
  });
  const [wlStatus, setWlStatus] = useState<WLStatus | null>(null);
  const [minting, setMinting] = useState(false);
  const [mintResult, setMintResult] = useState<{ success: boolean; message: string; txHash?: string } | null>(null);
  const [toggling, setToggling] = useState(false);
  const ledgerRef = useRef<HTMLDivElement>(null);

  const soldOut = mintState.minted >= MAX_SUPPLY;
  const isLive = mintState.mintActive && !soldOut;
  const progress = (mintState.minted / mintState.total) * 100;

  // Eligibility from backend /check-wl response
  const now = Date.now();
  const gtdStart = GTD_START.getTime();
  const gtdEnd = GTD_END.getTime();
  const inGtdWindow = now >= gtdStart && now <= gtdEnd;
  const afterGtd = now > gtdEnd;
  const isGtdWallet = wlStatus?.whitelisted ?? false;
  const canMintGtd = isGtdWallet && inGtdWindow;
  const canMintPublic = afterGtd;
  const canMint = isAdmin || canMintGtd || canMintPublic;

  function getEligibilityStatus(): { text: string; color: string } {
    if (!authenticated) return { text: "Connect wallet to check eligibility", color: "text-fg-dim" };
    if (isAdmin) return { text: "ADMIN — ELIGIBLE TO MINT (TESTING)", color: "text-accent" };
    if (wlStatus?.minted) return { text: "ALREADY MINTED", color: "text-fg-dim" };
    if (soldOut) return { text: "SOLD OUT", color: "text-error" };
    if (inGtdWindow && isGtdWallet) return { text: "GTD PHASE 1 — YOU'RE WHITELISTED!", color: "text-success" };
    if (inGtdWindow && !isGtdWallet) return { text: "NOT WHITELISTED — PUBLIC MINT OPENS AFTER 12:00 UTC", color: "text-fg-muted" };
    if (afterGtd) return { text: "PUBLIC MINT — FREE FOR ALL!", color: "text-success" };
    return { text: `GTD PHASE 1 OPENS AT 09:30 UTC TODAY`, color: "text-fg-muted" };
  }

  // Fetch state
  useEffect(() => {
    let active = true;
    const fetchState = () => {
      fetch(`${API_BASE}/state`)
        .then((r) => r.json())
        .then((d) => {
          if (active && d.total) {
            setMintState({
              minted: d.minted ?? 0, total: d.total ?? MAX_SUPPLY,
              remaining: d.remaining ?? MAX_SUPPLY, mintActive: d.mintActive ?? false,
              currentPhase: d.currentPhase ?? "waiting",
              phase1Start: d.phase1Start ?? 0, phase1End: d.phase1End ?? 0,
              gtdTotal: d.gtdTotal ?? 0, gtdMinted: d.gtdMinted ?? 0,
              recentMints: Array.isArray(d.recentMints) ? d.recentMints : [],
            });
          }
        })
        .catch(() => {});
    };
    fetchState();
    const interval = setInterval(fetchState, 10000);
    return () => { active = false; clearInterval(interval); };
  }, []);

  // Check whitelist status
  useEffect(() => {
    if (!userWallet) { setWlStatus(null); return; }
    fetch(`${API_BASE}/check-wl?wallet=${userWallet}`)
      .then(r => r.json())
      .then(d => setWlStatus(d))
      .catch(() => {});
  }, [userWallet, mintState.minted]);

  // Admin toggle
  const handleToggle = async () => {
    if (!wallets[0] || toggling) return;
    setToggling(true);
    try {
      const provider = await wallets[0].getEthereumProvider();
      const address = wallets[0].address;
      const newActive = !mintState.mintActive;
      const message = `nexus:toggle:${newActive}:${Date.now()}`;
      const signature = await provider.request({ method: "personal_sign", params: [message, address] });
      const res = await fetch(`${API_BASE}/admin/toggle`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: newActive, adminSignature: signature, message }),
      });
      if (res.ok) setMintState(prev => ({ ...prev, mintActive: newActive }));
    } catch {} finally { setToggling(false); }
  };

  // Human mint
  const handleMint = useCallback(async () => {
    if (!wallets[0] || minting) return;
    setMinting(true);
    setMintResult(null);
    try {
      const provider = await wallets[0].getEthereumProvider();
      const address = wallets[0].address;
      const message = `nexus:human-mint:${address}:${Date.now()}`;
      const signature = await provider.request({ method: "personal_sign", params: [message, address] });

      const res = await fetch(`${API_BASE}/human-mint`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ wallet: address, signature, message }),
      });
      const data = await res.json();

      if (data.success) {
        setMintResult({ success: true, message: data.message, txHash: data.txHash });
        setWlStatus(prev => prev ? { ...prev, canMint: false, minted: true, reason: "Already minted" } : prev);
      } else {
        setMintResult({ success: false, message: data.error || "Mint failed" });
      }
    } catch (e) {
      setMintResult({ success: false, message: e instanceof Error ? e.message : "Mint failed" });
    } finally { setMinting(false); }
  }, [wallets, minting]);

  const eligibility = getEligibilityStatus();

  const tabs: Tab[] = ["mint", "agents", "about"];
  const isPhase1 = mintState.currentPhase === "phase1" || inGtdWindow;
  const isPublic = mintState.currentPhase === "public" || afterGtd;

  return (
    <div className="min-h-screen px-4 py-12 md:py-20 bg-bg">
      <div className="max-w-[700px] mx-auto">

        {/* Admin Toggle */}
        {isAdmin && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mb-4 flex justify-center">
            <button onClick={handleToggle} disabled={toggling}
              className={`font-mono text-[10px] tracking-widest px-5 py-2 border transition-colors cursor-pointer ${
                mintState.mintActive ? "border-error text-error hover:bg-error/10" : "border-success text-success hover:bg-success/10"
              } ${toggling ? "opacity-50 cursor-not-allowed" : ""}`}>
              {toggling ? "SIGNING..." : mintState.mintActive ? "PAUSE MINT" : "GO LIVE"}
            </button>
          </motion.div>
        )}

        {/* Terminal Window */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="border border-border bg-bg-card">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-[#ff5f57]" />
              <div className="w-2 h-2 rounded-full bg-[#febc2e]" />
              <div className="w-2 h-2 rounded-full bg-[#28c840]" />
              <span className="font-mono text-[10px] tracking-widest text-fg-dim ml-3">NEXUS NODE — FREE MINT</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className={`w-1.5 h-1.5 rounded-full ${soldOut ? "bg-error" : isLive ? "bg-success animate-pulse" : "bg-fg-dim"}`} />
              <span className={`font-mono text-[9px] tracking-widest ${soldOut ? "text-error" : isLive ? "text-success" : "text-fg-dim"}`}>
                {soldOut ? "SOLD OUT" : isLive ? "LIVE" : "PAUSED"}
              </span>
            </div>
          </div>

          {/* Mint Counter */}
          <div className="px-6 pt-8 pb-6">
            <div className="flex items-baseline justify-center gap-2 mb-4">
              <span className="font-mono text-6xl md:text-7xl font-bold text-fg tracking-tight">{mintState.minted}</span>
              <span className="font-mono text-[13px] text-fg-dim">/ {MAX_SUPPLY} MINTED</span>
            </div>

            <div className="w-full h-2 bg-border overflow-hidden mb-4">
              <motion.div className="h-full bg-accent" initial={{ width: 0 }} animate={{ width: `${progress}%` }} transition={{ duration: 1.2, ease: "easeOut" }} />
            </div>

            {/* Phase Info */}
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className={`border px-3 py-2 text-center ${isPhase1 ? "border-success" : "border-border"}`}>
                <p className="font-mono text-[9px] tracking-widest text-fg-dim">GTD PHASE 1</p>
                <p className="font-mono text-lg text-success font-bold">{GTD_PHASE1_COUNT}</p>
                <p className="font-mono text-[8px] text-fg-dim">WHITELISTED • FREE</p>
                <p className="font-mono text-[8px] text-fg-dim mt-1">09:30 — 12:00 UTC</p>
              </div>
              <div className={`border px-3 py-2 text-center ${isPublic ? "border-accent" : "border-border"}`}>
                <p className="font-mono text-[9px] tracking-widest text-fg-dim">PUBLIC + AGENTIC</p>
                <p className="font-mono text-lg text-accent font-bold">{AGENTIC_PUBLIC_SUPPLY}</p>
                <p className="font-mono text-[8px] text-fg-dim">OPEN • FREE</p>
                <p className="font-mono text-[8px] text-fg-dim mt-1">AFTER 12:00 UTC</p>
              </div>
            </div>

            {/* Countdown or Phase Badge */}
            <div className="flex justify-center mb-2">
              {!isPhase1 && !isPublic && gtdStart > 0 && now < gtdStart ? (
                <Countdown target={gtdStart} label="GTD PHASE 1 OPENS IN" />
              ) : isPhase1 && gtdEnd > 0 ? (
                <Countdown target={gtdEnd} label="PHASE 1 ENDS IN" />
              ) : isPublic ? (
                <span className="font-mono text-[10px] tracking-widest border border-accent text-accent px-3 py-1">PUBLIC MINT LIVE</span>
              ) : null}
            </div>
          </div>

          {/* Tabs */}
          <div className="flex border-t border-b border-border">
            {tabs.map((t) => (
              <button key={t} onClick={() => setTab(t)}
                className={`flex-1 px-4 py-2.5 font-mono text-[10px] tracking-widest transition-colors cursor-pointer border-b-2 ${
                  tab === t ? "text-fg border-accent" : "text-fg-dim hover:text-fg-muted border-transparent"
                }`}>
                {t.toUpperCase()}
              </button>
            ))}
          </div>

          {/* Tab Content */}
          <AnimatePresence mode="wait">
            <motion.div key={tab} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }} className="px-6 py-6">

              {tab === "mint" && (
                <div className="space-y-4">
                  {/* Eligibility Status */}
                  <div className={`border px-4 py-3 ${canMint ? "border-success" : "border-border"}`}>
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`w-2 h-2 rounded-full ${canMint ? "bg-success" : wlStatus?.minted ? "bg-fg-dim" : "bg-fg-dim"}`} />
                      <p className={`font-mono text-[10px] tracking-widest ${eligibility.color}`}>
                        {eligibility.text}
                      </p>
                    </div>
                    {authenticated && (
                      <p className="font-mono text-[9px] text-fg-dim mt-1">{truncateAddr(userWallet)}</p>
                    )}
                  </div>

                  {/* Connect Wallet */}
                  {!authenticated && (
                    <div className="text-center">
                      <button onClick={login}
                        className="font-mono text-[11px] tracking-widest border border-accent text-accent px-6 py-2.5 hover:bg-accent/10 transition-colors cursor-pointer">
                        CONNECT WALLET
                      </button>
                    </div>
                  )}

                  {/* Mint Button — visible when eligible */}
                  {authenticated && canMint && !wlStatus?.minted && !mintResult?.success && (
                    <button onClick={handleMint} disabled={minting || (!isLive && !isAdmin)}
                      className={`w-full font-mono text-[12px] tracking-widest border-2 border-success text-success px-6 py-4 hover:bg-success/10 transition-colors cursor-pointer ${
                        minting ? "opacity-50 cursor-not-allowed animate-pulse" : ""
                      } ${!isLive && !isAdmin ? "opacity-40 cursor-not-allowed" : ""}`}>
                      {minting ? "MINTING..." : !isLive && !isAdmin ? "MINT PAUSED" : "MINT FREE NFT"}
                    </button>
                  )}

                  {/* Result */}
                  {mintResult && (
                    <div className={`border px-4 py-3 ${mintResult.success ? "border-success" : "border-error"}`}>
                      <p className={`font-mono text-[11px] ${mintResult.success ? "text-success" : "text-error"}`}>
                        {mintResult.message}
                      </p>
                      {mintResult.txHash && (
                        <a href={`https://basescan.org/tx/${mintResult.txHash}`} target="_blank" rel="noopener noreferrer"
                          className="font-mono text-[10px] text-accent hover:underline mt-1 block">
                          View on BaseScan →
                        </a>
                      )}
                    </div>
                  )}

                  {/* Info */}
                  <div className="border border-border px-4 py-3 font-mono text-[10px] text-fg-dim space-y-1">
                    <p>• All human mints are <span className="text-success">FREE</span></p>
                    <p>• 1 mint per wallet</p>
                    <p>• GTD Phase 1: {GTD_PHASE1_COUNT} wallets — 09:30 AM to 12:00 PM UTC</p>
                    <p>• Public + Agentic: {AGENTIC_PUBLIC_SUPPLY} remaining — after 12:00 PM UTC</p>
                  </div>
                </div>
              )}

              {tab === "agents" && (
                <div>
                  <p className="font-mono text-[11px] text-fg-muted leading-relaxed mb-3">
                    Remaining supply is reserved for AI agents. Agents mint by solving SHA-256 proof-of-work challenges via our API. All mints are free.
                  </p>
                  <Link to="/mint/docs"
                    className="inline-block font-mono text-[11px] tracking-widest border border-accent text-accent px-6 py-2.5 hover:bg-accent/10 transition-colors">
                    AGENT DOCS
                  </Link>
                </div>
              )}

              {tab === "about" && (
                <div className="font-mono text-[11px] text-fg-muted leading-relaxed space-y-3">
                  <p>Nexus Node is a {MAX_SUPPLY}-piece AI agent NFT collection on Base.</p>
                  <div className="border border-border px-4 py-3 space-y-1 text-[10px]">
                    <p className="text-fg-dim tracking-widest mb-2">SUPPLY BREAKDOWN</p>
                    <p>Treasury: {TREASURY}</p>
                    <p>GTD Phase 1 (Whitelisted Free): {GTD_PHASE1_COUNT}</p>
                    <p>Public + Agentic Mint (Free): {AGENTIC_PUBLIC_SUPPLY}</p>
                    <p className="text-fg-dim border-t border-border pt-1 mt-2">Total: {MAX_SUPPLY}</p>
                  </div>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </motion.div>

        {/* Recent Mints */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }} className="border border-border bg-bg-card mt-6">
          <div className="px-4 py-2.5 border-b border-border flex items-center justify-between">
            <p className="font-mono text-[10px] tracking-widest text-fg-dim">RECENT MINTS</p>
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
              <span className="font-mono text-[9px] tracking-widest text-success">LIVE</span>
            </div>
          </div>
          <div ref={ledgerRef} className="max-h-52 overflow-y-auto">
            {mintState.recentMints.length === 0 ? (
              <div className="px-4 py-6 text-center">
                <span className="font-mono text-[10px] text-fg-dim">No mints yet</span>
              </div>
            ) : (
              mintState.recentMints.map((entry, i) => (
                <div key={entry.tx_hash || i} className="flex items-center gap-3 px-4 py-2 border-b border-border last:border-b-0 font-mono text-[10px]">
                  <span className="text-fg-dim">#{entry.token_id}</span>
                  <span className="text-fg-dim">|</span>
                  <span className="text-accent">{truncateTx(entry.tx_hash)}</span>
                  <span className="text-fg-dim">|</span>
                  <span className="text-fg-muted">{truncateAddr(entry.wallet)}</span>
                  <span className="ml-auto text-[9px] tracking-widest px-1.5 py-0.5 border border-success text-success">FREE</span>
                </div>
              ))
            )}
          </div>
        </motion.div>

        {/* Bottom Stats */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }}
          className="mt-8 flex items-center justify-center gap-4 font-mono text-[9px] tracking-widest text-fg-dim">
          <span>SUPPLY {MAX_SUPPLY}</span>
          <span className="text-border">|</span>
          <span>FREE MINT</span>
          <span className="text-border">|</span>
          <span>CHAIN BASE</span>
        </motion.div>
      </div>
    </div>
  );
}
