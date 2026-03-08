# Build Your Own Nexus Node Mint Agent Bot

## Tutorial Guide for Video — React + Vite + CDP AgentKit

> This guide walks users through building an AI agent bot that can:
> - Solve PoW challenges to mint Nexus Node NFTs
> - Hold a Base wallet (receive/send ETH)
> - Send NFTs to other addresses
> - All through a clean terminal-style UI
> - To create files just make text file in proper repository and rename them using the name provided in this doc. 
> - to open the files to edit use notepad and then the file name with directory next to it .

---

## VIDEO SECTION 1 — Project Setup (~3 min)

### What you're building

Show the finished bot UI briefly — terminal-style dashboard with:
- Wallet panel (address, balance, fund/withdraw)
- PoW solver panel (start/stop, progress, hashrate)
- NFT panel (owned NFTs, send to address)
- Activity log

### Step 1: Create Vite project

```bash
npm create vite@latest nexus-agent -- --template react-ts
cd nexus-agent
npm install
```

### Step 2: Install dependencies

```bash
npm install @coinbase/cdp-sdk ethers@6 crypto-js
npm install -D tailwindcss @tailwindcss/vite
```

### Step 3: Configure Tailwind

**vite.config.ts**
```ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
});
```

**src/index.css**
```css
@import "tailwindcss";

:root {
  --bg: #0a0a0a;
  --fg: #e0e0e0;
  --fg-dim: #555;
  --accent: #00ff88;
  --error: #ff4444;
  --border: #1a1a1a;
}

body {
  background: var(--bg);
  color: var(--fg);
  font-family: "JetBrains Mono", "Fira Code", monospace;
}
```

### Step 4: Get CDP API Key

1. Go to https://portal.cdp.coinbase.com/
2. Create account / sign in
3. Go to **API Keys** section
4. Create a new API key
5. Save the **API Key Name** and **API Key Secret**

Create `.env` file:
```env
VITE_CDP_API_KEY_NAME=your_cdp_api_key_name
VITE_CDP_API_KEY_SECRET=your_cdp_api_key_secret
VITE_MINT_API=https://ffmqlinwuinxzxwfueim.supabase.co/functions/v1/agent-mint
```

---

## VIDEO SECTION 2 — Wallet Manager (~5 min)

> This is the brain of the agent — creates and manages a Base wallet

### Step 5: Create wallet utility

**src/lib/wallet.ts**
```ts
import { ethers } from "ethers";

const RPC = "https://mainnet.base.org";

export interface AgentWallet {
  address: string;
  privateKey: string;
}

// Create a new random wallet
export function createWallet(): AgentWallet {
  const wallet = ethers.Wallet.createRandom();
  return {
    address: wallet.address,
    privateKey: wallet.privateKey,
  };
}

// Load wallet from saved key
export function loadWallet(privateKey: string): AgentWallet {
  const wallet = new ethers.Wallet(privateKey);
  return {
    address: wallet.address,
    privateKey: wallet.privateKey,
  };
}

// Get provider
export function getProvider() {
  return new ethers.JsonRpcProvider(RPC);
}

// Get signer (for sending transactions)
export function getSigner(privateKey: string) {
  return new ethers.Wallet(privateKey, getProvider());
}

// Get ETH balance
export async function getBalance(address: string): Promise<string> {
  const provider = getProvider();
  const balance = await provider.getBalance(address);
  return ethers.formatEther(balance);
}

// Send ETH to an address
export async function sendETH(
  privateKey: string,
  to: string,
  amountEth: string
): Promise<string> {
  const signer = getSigner(privateKey);
  const tx = await signer.sendTransaction({
    to,
    value: ethers.parseEther(amountEth),
  });
  await tx.wait();
  return tx.hash;
}

// Send NFT (ERC-721 transfer)
export async function sendNFT(
  privateKey: string,
  nftContract: string,
  to: string,
  tokenId: number
): Promise<string> {
  const signer = getSigner(privateKey);
  const abi = [
    "function transferFrom(address from, address to, uint256 tokenId)",
    "function ownerOf(uint256 tokenId) view returns (address)",
  ];
  const contract = new ethers.Contract(nftContract, abi, signer);
  const tx = await contract.transferFrom(signer.address, to, tokenId);
  await tx.wait();
  return tx.hash;
}

// Check which Nexus Node NFTs a wallet owns
export async function getOwnedNFTs(address: string): Promise<number[]> {
  const provider = getProvider();
  const NFT_ADDRESS = "0x050bf16a260b3376BFf70aa9E87c95bd965Dc3b4";
  const abi = [
    "function balanceOf(address owner) view returns (uint256)",
    "function tokenOfOwnerByIndex(address owner, uint256 index) view returns (uint256)",
    "function totalSupply() view returns (uint256)",
    "function ownerOf(uint256 tokenId) view returns (address)",
  ];
  const contract = new ethers.Contract(NFT_ADDRESS, abi, provider);

  // Simple approach: check ownership of minted tokens
  const owned: number[] = [];
  try {
    const balance = await contract.balanceOf(address);
    // If the contract supports ERC721Enumerable
    for (let i = 0; i < Number(balance); i++) {
      try {
        const tokenId = await contract.tokenOfOwnerByIndex(address, i);
        owned.push(Number(tokenId));
      } catch {
        break;
      }
    }
  } catch {
    // Fallback: scan first 20 tokens
    for (let id = 0; id < 20; id++) {
      try {
        const owner = await contract.ownerOf(id);
        if (owner.toLowerCase() === address.toLowerCase()) {
          owned.push(id);
        }
      } catch {
        break;
      }
    }
  }

  return owned;
}

// Save wallet to localStorage
export function saveWallet(wallet: AgentWallet) {
  localStorage.setItem("nexus_agent_wallet", JSON.stringify(wallet));
}

// Load saved wallet from localStorage
export function loadSavedWallet(): AgentWallet | null {
  const saved = localStorage.getItem("nexus_agent_wallet");
  if (!saved) return null;
  try {
    return JSON.parse(saved);
  } catch {
    return null;
  }
}
```

---

## VIDEO SECTION 3 — PoW Solver Engine (~5 min)

> The solver runs in a Web Worker so it doesn't freeze the UI.
> It does NOT solve instantly — shows progress, hashrate, and estimated time.

### Step 6: Create the PoW Web Worker

**src/lib/pow-worker.ts**
```ts
// This runs in a Web Worker thread — won't freeze the UI

self.onmessage = async (e: MessageEvent) => {
  const { prefix, target } = e.data;
  let nonce = 0;
  const startTime = Date.now();
  const reportInterval = 50000; // report progress every 50k hashes

  while (true) {
    // Convert to SHA-256 using SubtleCrypto (available in workers)
    const data = new TextEncoder().encode(`${prefix}${nonce}`);
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hash = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");

    if (hash.startsWith(target)) {
      // Found it!
      const elapsed = (Date.now() - startTime) / 1000;
      self.postMessage({
        type: "solved",
        nonce: String(nonce),
        hash,
        elapsed,
        totalHashes: nonce + 1,
      });
      return;
    }

    // Report progress periodically
    if (nonce % reportInterval === 0 && nonce > 0) {
      const elapsed = (Date.now() - startTime) / 1000;
      const hashrate = Math.floor(nonce / elapsed);
      self.postMessage({
        type: "progress",
        nonce,
        elapsed,
        hashrate,
      });
    }

    nonce++;
  }
};
```

### Step 7: PoW solver hook

**src/lib/usePowSolver.ts**
```ts
import { useState, useRef, useCallback } from "react";

const MINT_API = import.meta.env.VITE_MINT_API ||
  "https://ffmqlinwuinxzxwfueim.supabase.co/functions/v1/agent-mint";

interface SolverState {
  status: "idle" | "fetching" | "solving" | "verifying" | "minting" | "done" | "error";
  hashrate: number;
  elapsed: number;
  totalHashes: number;
  nonce: string | null;
  hash: string | null;
  error: string | null;
  tokenId: number | null;
  txHash: string | null;
}

export function usePowSolver() {
  const [state, setState] = useState<SolverState>({
    status: "idle",
    hashrate: 0,
    elapsed: 0,
    totalHashes: 0,
    nonce: null,
    hash: null,
    error: null,
    tokenId: null,
    txHash: null,
  });

  const workerRef = useRef<Worker | null>(null);
  const abortRef = useRef(false);

  const log = useRef<string[]>([]);
  const [logs, setLogs] = useState<string[]>([]);

  const addLog = (msg: string) => {
    const ts = new Date().toLocaleTimeString();
    log.current = [...log.current.slice(-50), `[${ts}] ${msg}`];
    setLogs([...log.current]);
  };

  const stop = useCallback(() => {
    abortRef.current = true;
    if (workerRef.current) {
      workerRef.current.terminate();
      workerRef.current = null;
    }
    setState((s) => ({ ...s, status: "idle" }));
    addLog("Solver stopped by user.");
  }, []);

  const solve = useCallback(async (walletAddress: string, privateKey?: string) => {
    abortRef.current = false;
    setState((s) => ({ ...s, status: "fetching", error: null, tokenId: null, txHash: null }));

    try {
      // ── Step 1: Get challenge ──
      addLog("Requesting PoW challenge...");
      const chRes = await fetch(`${MINT_API}/challenge?wallet=${walletAddress}`);
      if (!chRes.ok) {
        const err = await chRes.json().catch(() => ({ error: chRes.statusText }));
        throw new Error(err.error || `Challenge failed: ${chRes.status}`);
      }
      const challenge = await chRes.json();
      addLog(`Challenge received: difficulty=${challenge.difficulty}, prefix=${challenge.prefix.slice(0, 20)}...`);
      addLog(`Target: ${challenge.target} (${challenge.difficulty} leading hex zeros)`);

      if (abortRef.current) return;

      // ── Step 2: Solve PoW in Web Worker ──
      setState((s) => ({ ...s, status: "solving" }));
      addLog("Starting PoW solver...");

      const worker = new Worker(
        new URL("./pow-worker.ts", import.meta.url),
        { type: "module" }
      );
      workerRef.current = worker;

      const solution = await new Promise<{ nonce: string; hash: string; elapsed: number; totalHashes: number }>(
        (resolve, reject) => {
          worker.onmessage = (e) => {
            if (e.data.type === "progress") {
              setState((s) => ({
                ...s,
                hashrate: e.data.hashrate,
                elapsed: e.data.elapsed,
                totalHashes: e.data.nonce,
              }));
              addLog(`Progress: ${(e.data.nonce / 1000000).toFixed(1)}M hashes, ${e.data.hashrate.toLocaleString()} H/s`);
            } else if (e.data.type === "solved") {
              resolve(e.data);
            }
          };
          worker.onerror = (err) => reject(new Error(err.message));
          worker.postMessage({
            prefix: challenge.prefix,
            target: challenge.target,
          });
        }
      );

      if (abortRef.current) return;

      addLog(`SOLVED! Nonce: ${solution.nonce}, Hash: ${solution.hash.slice(0, 16)}...`);
      addLog(`Time: ${solution.elapsed.toFixed(1)}s, Total hashes: ${solution.totalHashes.toLocaleString()}`);
      setState((s) => ({
        ...s,
        nonce: solution.nonce,
        hash: solution.hash,
        elapsed: solution.elapsed,
        totalHashes: solution.totalHashes,
      }));

      // ── Step 3: Verify ──
      setState((s) => ({ ...s, status: "verifying" }));
      addLog("Submitting solution for verification...");

      const verifyRes = await fetch(`${MINT_API}/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: challenge.id,
          prefix: challenge.prefix,
          nonce: solution.nonce,
          target: challenge.target,
          expiresAt: challenge.expiresAt,
          signature: challenge.signature,
          metadata: challenge.metadata,
        }),
      });
      if (!verifyRes.ok) {
        const err = await verifyRes.json().catch(() => ({ error: verifyRes.statusText }));
        throw new Error(err.error || `Verify failed: ${verifyRes.status}`);
      }
      const verify = await verifyRes.json();
      addLog(`Verification: ${verify.valid ? "VALID" : "INVALID"}`);

      if (abortRef.current) return;

      // ── Step 4: Handle payment if required ──
      let paymentTxHash: string | undefined;

      if (verify.payment?.required) {
        addLog(`Payment required: ${verify.payment.amount} wei (~$${verify.payment.amountUsd} USD)`);
        addLog(`Sending ETH to ${verify.payment.recipient}...`);

        if (!privateKey) {
          throw new Error("Payment required but no private key provided for sending ETH.");
        }

        // Import ethers dynamically to keep bundle small
        const { ethers } = await import("ethers");
        const provider = new ethers.JsonRpcProvider("https://mainnet.base.org");
        const signer = new ethers.Wallet(privateKey, provider);

        const tx = await signer.sendTransaction({
          to: verify.payment.recipient,
          value: BigInt(verify.payment.amount),
        });
        await tx.wait();
        paymentTxHash = tx.hash;
        addLog(`Payment sent! Tx: ${tx.hash.slice(0, 16)}...`);
      } else {
        addLog("Free mint — no payment needed!");
      }

      // ── Step 5: Mint ──
      setState((s) => ({ ...s, status: "minting" }));
      addLog("Calling mint endpoint...");

      const mintBody: Record<string, string> = {
        wallet: walletAddress,
        token: verify.token,
      };
      if (paymentTxHash) {
        mintBody.paymentTxHash = paymentTxHash;
      }

      const mintRes = await fetch(`${MINT_API}/mint`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(mintBody),
      });
      if (!mintRes.ok) {
        const err = await mintRes.json().catch(() => ({ error: mintRes.statusText }));
        throw new Error(err.error || `Mint failed: ${mintRes.status}`);
      }
      const mint = await mintRes.json();

      addLog(`MINTED! Token #${mint.tokenId} — Tx: ${mint.txHash}`);
      setState((s) => ({
        ...s,
        status: "done",
        tokenId: mint.tokenId,
        txHash: mint.txHash,
      }));
    } catch (err: any) {
      const msg = err.message || "Unknown error";
      addLog(`ERROR: ${msg}`);
      setState((s) => ({ ...s, status: "error", error: msg }));
    } finally {
      if (workerRef.current) {
        workerRef.current.terminate();
        workerRef.current = null;
      }
    }
  }, []);

  return { state, logs, solve, stop };
}
```

---

## VIDEO SECTION 4 — The Bot UI (~8 min)

> Main dashboard with 3 panels: Wallet, Solver, NFTs

### Step 8: Main App component

**src/App.tsx**
```tsx
import { useState, useEffect } from "react";
import { WalletPanel } from "./components/WalletPanel";
import { SolverPanel } from "./components/SolverPanel";
import { NFTPanel } from "./components/NFTPanel";
import { ActivityLog } from "./components/ActivityLog";
import { loadSavedWallet, createWallet, saveWallet, type AgentWallet } from "./lib/wallet";
import { usePowSolver } from "./lib/usePowSolver";

export default function App() {
  const [wallet, setWallet] = useState<AgentWallet | null>(null);
  const solver = usePowSolver();

  // Load or create wallet on mount
  useEffect(() => {
    const saved = loadSavedWallet();
    if (saved) {
      setWallet(saved);
    }
  }, []);

  const handleCreateWallet = () => {
    const w = createWallet();
    saveWallet(w);
    setWallet(w);
  };

  const handleStartSolver = () => {
    if (!wallet) return;
    solver.solve(wallet.address, wallet.privateKey);
  };

  return (
    <div className="min-h-screen p-4 md:p-8 max-w-6xl mx-auto">
      {/* Header */}
      <header className="mb-8">
        <p className="text-[10px] tracking-[0.4em] text-[var(--fg-dim)] mb-2">
          [NEXUS NODE // AGENT BOT // BASE]
        </p>
        <h1 className="text-2xl md:text-3xl font-light tracking-tight">
          Agent Mint Bot
        </h1>
        <p className="text-xs text-[var(--fg-dim)] mt-1">
          Solve PoW challenges. Mint Nexus Node NFTs. Manage your wallet.
        </p>
      </header>

      {!wallet ? (
        /* ── No wallet — show setup ── */
        <div className="border border-[var(--border)] p-8 text-center">
          <p className="text-sm text-[var(--fg-dim)] mb-4">
            No agent wallet found. Create one to get started.
          </p>
          <button
            onClick={handleCreateWallet}
            className="border border-[var(--accent)] text-[var(--accent)] px-6 py-2 text-xs tracking-widest hover:bg-[var(--accent)]/10 transition-colors cursor-pointer"
          >
            CREATE AGENT WALLET
          </button>
        </div>
      ) : (
        /* ── Main dashboard ── */
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Left column */}
          <div className="space-y-4">
            <WalletPanel wallet={wallet} />
            <SolverPanel
              solver={solver}
              onStart={handleStartSolver}
              onStop={solver.stop}
              walletAddress={wallet.address}
            />
          </div>

          {/* Right column */}
          <div className="space-y-4">
            <NFTPanel wallet={wallet} />
            <ActivityLog logs={solver.logs} />
          </div>
        </div>
      )}
    </div>
  );
}
```

### Step 9: Wallet Panel

**src/components/WalletPanel.tsx**
```tsx
import { useState, useEffect } from "react";
import { getBalance, sendETH, type AgentWallet } from "../lib/wallet";

export function WalletPanel({ wallet }: { wallet: AgentWallet }) {
  const [balance, setBalance] = useState("...");
  const [sendTo, setSendTo] = useState("");
  const [sendAmount, setSendAmount] = useState("");
  const [sending, setSending] = useState(false);
  const [txResult, setTxResult] = useState("");
  const [showKey, setShowKey] = useState(false);

  const refreshBalance = async () => {
    try {
      const bal = await getBalance(wallet.address);
      setBalance(parseFloat(bal).toFixed(6));
    } catch {
      setBalance("error");
    }
  };

  useEffect(() => {
    refreshBalance();
    const interval = setInterval(refreshBalance, 15000);
    return () => clearInterval(interval);
  }, [wallet.address]);

  const handleSend = async () => {
    if (!sendTo || !sendAmount) return;
    setSending(true);
    setTxResult("");
    try {
      const hash = await sendETH(wallet.privateKey, sendTo, sendAmount);
      setTxResult(`Sent! Tx: ${hash.slice(0, 16)}...`);
      setSendTo("");
      setSendAmount("");
      refreshBalance();
    } catch (err: any) {
      setTxResult(`Error: ${err.message}`);
    }
    setSending(false);
  };

  return (
    <div className="border border-[var(--border)]">
      {/* Header */}
      <div className="px-4 py-2 border-b border-[var(--border)] flex items-center justify-between">
        <span className="text-[10px] tracking-widest text-[var(--fg-dim)]">AGENT WALLET</span>
        <span className="text-[10px] text-[var(--accent)]">BASE MAINNET</span>
      </div>

      <div className="p-4 space-y-3">
        {/* Address */}
        <div>
          <p className="text-[9px] tracking-widest text-[var(--fg-dim)] mb-1">ADDRESS</p>
          <p
            className="text-xs text-[var(--fg)] cursor-pointer hover:text-[var(--accent)] transition-colors break-all"
            onClick={() => navigator.clipboard.writeText(wallet.address)}
            title="Click to copy"
          >
            {wallet.address}
          </p>
        </div>

        {/* Balance */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[9px] tracking-widest text-[var(--fg-dim)] mb-1">BALANCE</p>
            <p className="text-lg text-[var(--fg)]">{balance} <span className="text-xs text-[var(--fg-dim)]">ETH</span></p>
          </div>
          <button
            onClick={refreshBalance}
            className="text-[9px] tracking-widest text-[var(--fg-dim)] hover:text-[var(--fg)] cursor-pointer"
          >
            REFRESH
          </button>
        </div>

        {/* Fund instructions */}
        <div className="border border-[var(--border)] p-3 bg-[#0f0f0f]">
          <p className="text-[9px] tracking-widest text-[var(--accent)] mb-1">TO FUND THIS WALLET</p>
          <p className="text-[10px] text-[var(--fg-dim)]">
            Send ETH on Base network to the address above.
            Copy address → open your wallet → send ETH on Base.
          </p>
        </div>

        {/* Send ETH */}
        <div className="border-t border-[var(--border)] pt-3">
          <p className="text-[9px] tracking-widest text-[var(--fg-dim)] mb-2">SEND ETH</p>
          <input
            type="text"
            placeholder="Recipient address (0x...)"
            value={sendTo}
            onChange={(e) => setSendTo(e.target.value)}
            className="w-full bg-transparent border border-[var(--border)] px-3 py-2 text-xs text-[var(--fg)] placeholder:text-[var(--fg-dim)] mb-2 outline-none focus:border-[var(--accent)]"
          />
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Amount in ETH"
              value={sendAmount}
              onChange={(e) => setSendAmount(e.target.value)}
              className="flex-1 bg-transparent border border-[var(--border)] px-3 py-2 text-xs text-[var(--fg)] placeholder:text-[var(--fg-dim)] outline-none focus:border-[var(--accent)]"
            />
            <button
              onClick={handleSend}
              disabled={sending || !sendTo || !sendAmount}
              className="border border-[var(--accent)] text-[var(--accent)] px-4 py-2 text-[10px] tracking-widest hover:bg-[var(--accent)]/10 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
            >
              {sending ? "SENDING..." : "SEND"}
            </button>
          </div>
          {txResult && (
            <p className={`text-[10px] mt-2 ${txResult.startsWith("Error") ? "text-[var(--error)]" : "text-[var(--accent)]"}`}>
              {txResult}
            </p>
          )}
        </div>

        {/* Private key toggle */}
        <div className="border-t border-[var(--border)] pt-3">
          <button
            onClick={() => setShowKey(!showKey)}
            className="text-[9px] tracking-widest text-[var(--fg-dim)] hover:text-[var(--error)] cursor-pointer"
          >
            {showKey ? "HIDE PRIVATE KEY" : "SHOW PRIVATE KEY"}
          </button>
          {showKey && (
            <p
              className="text-[10px] text-[var(--error)] mt-1 break-all cursor-pointer"
              onClick={() => navigator.clipboard.writeText(wallet.privateKey)}
              title="Click to copy"
            >
              {wallet.privateKey}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
```

### Step 10: Solver Panel

**src/components/SolverPanel.tsx**
```tsx
import { usePowSolver } from "../lib/usePowSolver";

interface SolverPanelProps {
  solver: ReturnType<typeof usePowSolver>;
  onStart: () => void;
  onStop: () => void;
  walletAddress: string;
}

export function SolverPanel({ solver, onStart, onStop, walletAddress }: SolverPanelProps) {
  const { state } = solver;
  const isRunning = ["fetching", "solving", "verifying", "minting"].includes(state.status);

  const statusColor = {
    idle: "text-[var(--fg-dim)]",
    fetching: "text-yellow-400",
    solving: "text-yellow-400",
    verifying: "text-blue-400",
    minting: "text-purple-400",
    done: "text-[var(--accent)]",
    error: "text-[var(--error)]",
  }[state.status];

  return (
    <div className="border border-[var(--border)]">
      <div className="px-4 py-2 border-b border-[var(--border)] flex items-center justify-between">
        <span className="text-[10px] tracking-widest text-[var(--fg-dim)]">POW SOLVER</span>
        <span className={`text-[10px] tracking-widest ${statusColor}`}>
          {state.status.toUpperCase()}
        </span>
      </div>

      <div className="p-4 space-y-3">
        {/* Stats */}
        {isRunning && state.status === "solving" && (
          <div className="grid grid-cols-3 gap-2">
            <div>
              <p className="text-[9px] tracking-widest text-[var(--fg-dim)]">HASHRATE</p>
              <p className="text-sm text-[var(--fg)]">{state.hashrate.toLocaleString()} H/s</p>
            </div>
            <div>
              <p className="text-[9px] tracking-widest text-[var(--fg-dim)]">ELAPSED</p>
              <p className="text-sm text-[var(--fg)]">{state.elapsed.toFixed(1)}s</p>
            </div>
            <div>
              <p className="text-[9px] tracking-widest text-[var(--fg-dim)]">HASHES</p>
              <p className="text-sm text-[var(--fg)]">{(state.totalHashes / 1000000).toFixed(1)}M</p>
            </div>
          </div>
        )}

        {/* Result */}
        {state.status === "done" && state.tokenId !== null && (
          <div className="border border-[var(--accent)] p-3">
            <p className="text-[10px] tracking-widest text-[var(--accent)] mb-1">MINT SUCCESSFUL</p>
            <p className="text-xs text-[var(--fg)]">Token #{state.tokenId}</p>
            <p className="text-[10px] text-[var(--fg-dim)] break-all mt-1">Tx: {state.txHash}</p>
          </div>
        )}

        {/* Error */}
        {state.error && (
          <div className="border border-[var(--error)] p-3">
            <p className="text-[10px] text-[var(--error)]">{state.error}</p>
          </div>
        )}

        {/* Controls */}
        <div className="flex gap-2">
          <button
            onClick={onStart}
            disabled={isRunning}
            className="flex-1 border border-[var(--accent)] text-[var(--accent)] py-2 text-[10px] tracking-widest hover:bg-[var(--accent)]/10 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
          >
            {isRunning ? "RUNNING..." : "START SOLVER"}
          </button>
          <button
            onClick={onStop}
            disabled={!isRunning}
            className="border border-[var(--error)] text-[var(--error)] px-4 py-2 text-[10px] tracking-widest hover:bg-[var(--error)]/10 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
          >
            STOP
          </button>
        </div>

        <p className="text-[9px] text-[var(--fg-dim)]">
          Solving for: {walletAddress.slice(0, 8)}...{walletAddress.slice(-6)}
        </p>
      </div>
    </div>
  );
}
```

### Step 11: NFT Panel

**src/components/NFTPanel.tsx**
```tsx
import { useState, useEffect } from "react";
import { getOwnedNFTs, sendNFT, type AgentWallet } from "../lib/wallet";

const NFT_CONTRACT = "0x050bf16a260b3376BFf70aa9E87c95bd965Dc3b4";
const IPFS_GATEWAY = "https://ipfs.io/ipfs";
const IMAGE_CID = "QmWPaAqeVcX14BkoifjmRwnfKnsD3oKeyjM8MxpPk8R8JA";

export function NFTPanel({ wallet }: { wallet: AgentWallet }) {
  const [ownedTokens, setOwnedTokens] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);
  const [sendTokenId, setSendTokenId] = useState("");
  const [sendTo, setSendTo] = useState("");
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState("");

  const loadNFTs = async () => {
    setLoading(true);
    try {
      const tokens = await getOwnedNFTs(wallet.address);
      setOwnedTokens(tokens);
    } catch {
      setOwnedTokens([]);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadNFTs();
  }, [wallet.address]);

  const handleSendNFT = async () => {
    if (!sendTokenId || !sendTo) return;
    setSending(true);
    setResult("");
    try {
      const hash = await sendNFT(wallet.privateKey, NFT_CONTRACT, sendTo, parseInt(sendTokenId));
      setResult(`NFT sent! Tx: ${hash.slice(0, 16)}...`);
      setSendTokenId("");
      setSendTo("");
      loadNFTs();
    } catch (err: any) {
      setResult(`Error: ${err.message}`);
    }
    setSending(false);
  };

  return (
    <div className="border border-[var(--border)]">
      <div className="px-4 py-2 border-b border-[var(--border)] flex items-center justify-between">
        <span className="text-[10px] tracking-widest text-[var(--fg-dim)]">YOUR NEXUS NODES</span>
        <button
          onClick={loadNFTs}
          className="text-[9px] tracking-widest text-[var(--fg-dim)] hover:text-[var(--fg)] cursor-pointer"
        >
          REFRESH
        </button>
      </div>

      <div className="p-4 space-y-3">
        {loading ? (
          <p className="text-[10px] text-[var(--fg-dim)]">Loading NFTs...</p>
        ) : ownedTokens.length === 0 ? (
          <p className="text-[10px] text-[var(--fg-dim)]">No Nexus Node NFTs found. Run the solver to mint one!</p>
        ) : (
          <div className="grid grid-cols-3 gap-2">
            {ownedTokens.map((id) => (
              <div key={id} className="border border-[var(--border)] p-2 text-center">
                <img
                  src={`${IPFS_GATEWAY}/${IMAGE_CID}/${id + 1}.png`}
                  alt={`Nexus Node #${id}`}
                  className="w-full aspect-square object-cover mb-1"
                  loading="lazy"
                />
                <p className="text-[10px] text-[var(--fg)]">#{id}</p>
              </div>
            ))}
          </div>
        )}

        {/* Send NFT */}
        {ownedTokens.length > 0 && (
          <div className="border-t border-[var(--border)] pt-3">
            <p className="text-[9px] tracking-widest text-[var(--fg-dim)] mb-2">SEND NFT</p>
            <div className="flex gap-2 mb-2">
              <select
                value={sendTokenId}
                onChange={(e) => setSendTokenId(e.target.value)}
                className="bg-transparent border border-[var(--border)] px-3 py-2 text-xs text-[var(--fg)] outline-none"
              >
                <option value="">Token ID</option>
                {ownedTokens.map((id) => (
                  <option key={id} value={id}>#{id}</option>
                ))}
              </select>
              <input
                type="text"
                placeholder="Recipient address (0x...)"
                value={sendTo}
                onChange={(e) => setSendTo(e.target.value)}
                className="flex-1 bg-transparent border border-[var(--border)] px-3 py-2 text-xs text-[var(--fg)] placeholder:text-[var(--fg-dim)] outline-none focus:border-[var(--accent)]"
              />
            </div>
            <button
              onClick={handleSendNFT}
              disabled={sending || !sendTokenId || !sendTo}
              className="w-full border border-[var(--accent)] text-[var(--accent)] py-2 text-[10px] tracking-widest hover:bg-[var(--accent)]/10 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
            >
              {sending ? "SENDING..." : "SEND NFT"}
            </button>
            {result && (
              <p className={`text-[10px] mt-2 ${result.startsWith("Error") ? "text-[var(--error)]" : "text-[var(--accent)]"}`}>
                {result}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
```

### Step 12: Activity Log

**src/components/ActivityLog.tsx**
```tsx
import { useEffect, useRef } from "react";

export function ActivityLog({ logs }: { logs: string[] }) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs.length]);

  return (
    <div className="border border-[var(--border)]">
      <div className="px-4 py-2 border-b border-[var(--border)]">
        <span className="text-[10px] tracking-widest text-[var(--fg-dim)]">ACTIVITY LOG</span>
      </div>
      <div className="h-64 overflow-y-auto p-3 bg-[#050505]">
        {logs.length === 0 ? (
          <p className="text-[10px] text-[var(--fg-dim)]">Waiting for activity...</p>
        ) : (
          logs.map((line, i) => (
            <p key={i} className="text-[10px] text-[var(--fg-dim)] leading-relaxed font-mono">
              {line}
            </p>
          ))
        )}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
```

---

## VIDEO SECTION 5 — Running the Bot (~3 min)

### Step 13: Start the app

```bash
npm run dev
```

### How to use (walkthrough for video):

1. **Open the app** — you'll see the "Create Agent Wallet" screen
2. **Click "Create Agent Wallet"** — a new Base wallet is generated
3. **Copy the wallet address** — click on it to copy
4. **Fund the wallet** — open MetaMask / Coinbase Wallet, send some ETH on Base to the address
5. **Wait for balance to show** — refreshes every 15 seconds
6. **Click "Start Solver"** — the PoW solver begins
7. **Watch the progress** — hashrate, elapsed time, total hashes all update live
8. **Wait for solve** — takes ~30 seconds to a few minutes depending on your machine
9. **Automatic mint** — once solved, it verifies and mints automatically
10. **NFT appears** — your Nexus Node shows up in the NFT panel
11. **Send NFT** — select token ID, paste recipient, click send
12. **Send ETH** — use the wallet panel to send remaining ETH back to your main wallet

### What the bot does (NOT instant):
- The solver runs in a Web Worker (background thread)
- It tries nonces one by one: SHA256(prefix + 0), SHA256(prefix + 1), ...
- With 6 leading zeros, it typically takes **millions of hashes**
- On a regular laptop: ~30s to 3 minutes
- The progress updates show it's actually working

---

## File Structure (Final)

```
nexus-agent/
├── .env                          # CDP keys + mint API URL
├── index.html
├── package.json
├── vite.config.ts
├── src/
│   ├── index.css                 # Tailwind + theme vars
│   ├── main.tsx                  # Entry point
│   ├── App.tsx                   # Main dashboard
│   ├── lib/
│   │   ├── wallet.ts             # Wallet create/load/send/NFT
│   │   ├── pow-worker.ts         # Web Worker for PoW solving
│   │   └── usePowSolver.ts       # React hook for solver flow
│   └── components/
│       ├── WalletPanel.tsx        # Balance, fund, send ETH
│       ├── SolverPanel.tsx        # Start/stop, hashrate, result
│       ├── NFTPanel.tsx           # View & send NFTs
│       └── ActivityLog.tsx        # Live log feed
```

---

## Notes for Video

- **Intro**: Show the finished UI, explain what it does
- **Section 1**: Fast-forward through project setup (npm create, install deps)
- **Section 2**: Code the wallet manager, explain ethers.js basics
- **Section 3**: Code the PoW solver, explain the Web Worker concept
- **Section 4**: Build the UI panels, show each one working
- **Section 5**: Live demo — create wallet, fund it, run solver, mint, send NFT

### Video placement for your 4 videos:
- **Video 1** (intro teaser): Show the finished bot solving a challenge + minting
- **Video 2** (wallet setup): Show creating wallet, copying address, funding from MetaMask
- **Video 3** (solver in action): Show the solver running with hashrate + progress updating
- **Video 4** (NFT transfer): Show the minted NFT and sending it to another address

### Important reminders for viewers:
- This is a **real wallet** — protect your private key
- Fund with small amounts for testing
- The solver is NOT optimized — it's single-threaded in the browser
- For production agents, use a Node.js server with multi-threading
- The NFT contract is on **Base mainnet** — uses real ETH
- Each wallet can only mint **1 NFT** total
