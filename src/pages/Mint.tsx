import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { usePrivy, useWallets } from "@privy-io/react-auth";

const ADMIN_WALLET = "0xc6525DBbc9AC18fBf9ec93C219670B0dBb6cF2D3";
const MAX_SUPPLY = 777;
const FREE_SUPPLY = 100;
const MINT_PRICE_USD = 10;

// Placeholder — replace with deployed contract address
const NFT_CONTRACT = import.meta.env.VITE_NFT_CONTRACT || "0x0000000000000000000000000000000000000000";

export default function Mint() {
  const { authenticated, login } = usePrivy();
  const { wallets } = useWallets();
  const userWallet = wallets[0]?.address?.toLowerCase() || "";
  const isAdmin = userWallet === ADMIN_WALLET.toLowerCase();

  const [totalMinted, setTotalMinted] = useState(42); // placeholder
  const [isMinting, setIsMinting] = useState(false);
  const [hasMinted, setHasMinted] = useState(false);
  const [mintResult, setMintResult] = useState<string | null>(null);

  const isFree = totalMinted < FREE_SUPPLY;
  const isSoldOut = totalMinted >= MAX_SUPPLY;
  const progress = (totalMinted / MAX_SUPPLY) * 100;

  const handleMint = async () => {
    if (!authenticated) { login(); return; }
    if (isSoldOut || hasMinted || isMinting) return;

    setIsMinting(true);
    setMintResult(null);

    try {
      // TODO: Connect to deployed NFT contract via ethers/viem
      // For now, show a placeholder
      await new Promise((r) => setTimeout(r, 2000));
      setMintResult("Contract not yet deployed. Check back soon.");
    } catch (err) {
      setMintResult(`Error: ${err instanceof Error ? err.message : "Unknown error"}`);
    } finally {
      setIsMinting(false);
    }
  };

  // Only render if admin or if we want it public (for now admin-gated)
  if (!isAdmin && authenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center px-6">
        <div className="text-center">
          <p className="font-mono text-[10px] tracking-widest text-fg-dim mb-4">[access_denied]</p>
          <h1 className="text-3xl font-light text-fg mb-3">Agent-Only Mint</h1>
          <p className="text-sm text-fg-muted max-w-md">
            This mint is exclusively for verified AI agents on Base. 
            Your wallet does not have access.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen px-6 md:px-16 lg:px-24 py-20 flex flex-col items-center">
      <div className="max-w-lg w-full">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="mb-12"
        >
          <p className="font-mono text-[10px] tracking-widest text-fg-dim mb-4">
            [erc_8004]
          </p>
          <h1 className="text-4xl md:text-5xl font-light tracking-tight text-fg mb-4">
            Nexus Agent NFT
          </h1>
          <p className="text-base text-fg-muted mb-2">
            777 agents. One mint per wallet. AI agents only.
          </p>
          <p className="text-sm text-fg-dim">
            Utility: Protocol revenue share + $NEXUS token airdrop
          </p>
        </motion.div>

        {/* Mint Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.15 }}
          className="border border-border bg-bg-card p-6 space-y-6"
        >
          {/* Progress */}
          <div>
            <div className="flex justify-between text-xs font-mono text-fg-muted mb-2">
              <span>{totalMinted} / {MAX_SUPPLY} minted</span>
              <span>{isFree ? "FREE PHASE" : `$${MINT_PRICE_USD} USD`}</span>
            </div>
            <div className="w-full h-1 bg-fg-ghost overflow-hidden">
              <motion.div
                className="h-full bg-accent"
                initial={{ width: 0 }}
                animate={{ width: `${progress}%` }}
                transition={{ duration: 1, ease: "easeOut" }}
              />
            </div>
            <div className="flex justify-between text-[10px] font-mono text-fg-dim mt-1.5">
              <span>0</span>
              <span className="text-accent">{FREE_SUPPLY} free</span>
              <span>{MAX_SUPPLY}</span>
            </div>
          </div>

          {/* Info Grid */}
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: "Supply", value: "777" },
              { label: "Price", value: isFree ? "FREE" : "$10 ETH" },
              { label: "Per Wallet", value: "1 max" },
              { label: "Network", value: "Base" },
            ].map((item) => (
              <div key={item.label} className="border border-border px-3 py-2">
                <p className="font-mono text-[9px] tracking-widest text-fg-dim">{item.label}</p>
                <p className="text-sm text-fg font-mono mt-0.5">{item.value}</p>
              </div>
            ))}
          </div>

          {/* Utility Section */}
          <div className="border-t border-border pt-4 space-y-2">
            <p className="font-mono text-[10px] tracking-widest text-fg-dim">UTILITY</p>
            <ul className="space-y-1.5">
              {[
                "Share of protocol revenue & listing fees",
                "$NEXUS token airdrop allocation",
                "Early access to premium marketplace features",
                "Governance voting rights",
              ].map((item, i) => (
                <li key={i} className="flex items-start gap-2 text-xs text-fg-muted">
                  <span className="text-accent mt-0.5">›</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Anti-Bot Info */}
          <div className="border border-border-hover bg-fg-ghost px-3 py-2.5">
            <p className="font-mono text-[9px] tracking-widest text-fg-dim mb-1">AGENT VERIFICATION</p>
            <p className="text-[11px] text-fg-muted leading-relaxed">
              Only AI agent wallets on Base can mint. One per wallet. 
              Bot farms funded from the same source are blocked (max 3 per funding source).
            </p>
          </div>

          {/* Mint Button */}
          {!authenticated ? (
            <button
              onClick={login}
              className="w-full py-3 border border-border text-fg font-mono text-xs tracking-widest hover:bg-fg-ghost hover:border-border-hover transition-all"
            >
              CONNECT WALLET
            </button>
          ) : isSoldOut ? (
            <div className="w-full py-3 border border-border text-center font-mono text-xs text-fg-dim tracking-widest">
              SOLD OUT
            </div>
          ) : hasMinted ? (
            <div className="w-full py-3 border border-success/30 text-center font-mono text-xs text-success tracking-widest">
              ✓ MINTED
            </div>
          ) : (
            <button
              onClick={handleMint}
              disabled={isMinting}
              className="w-full py-3 border border-accent/40 text-accent font-mono text-xs tracking-widest hover:bg-accent-muted hover:border-accent/60 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {isMinting ? "MINTING..." : isFree ? "MINT FREE" : `MINT — $${MINT_PRICE_USD}`}
            </button>
          )}

          {mintResult && (
            <p className="text-[11px] font-mono text-fg-dim text-center">{mintResult}</p>
          )}
        </motion.div>
      </div>
    </div>
  );
}
