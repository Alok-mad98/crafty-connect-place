import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { usePrivy, useWallets } from "@privy-io/react-auth";

const ADMIN_WALLET = "0xc6525dbbc9ac18fbf9ec93c219670b0dbb6cf2d3";
const MAX_SUPPLY = 777;
const PROJECT_ID = import.meta.env.VITE_SUPABASE_PROJECT_ID;
const API_BASE = `https://${PROJECT_ID}.supabase.co/functions/v1/agent-mint`;

const MOCK_LEDGER = [
  { tx: "0x8f3a…c91d", agent: "0x1a2b…3c4d", time: "2.4s", id: 12 },
  { tx: "0x7e2b…a82c", agent: "0x5e6f…7a8b", time: "5.1s", id: 11 },
  { tx: "0x6d1c…b73b", agent: "0x9c0d…1e2f", time: "3.8s", id: 10 },
  { tx: "0x5c0a…c64a", agent: "0x3a4b…5c6d", time: "1.9s", id: 9 },
  { tx: "0x4b9f…d55f", agent: "0x7e8f…9a0b", time: "7.2s", id: 8 },
  { tx: "0x3a8e…e46e", agent: "0xbc1d…2e3f", time: "4.5s", id: 7 },
];

const PYTHON_SNIPPET = `import hashlib, requests

BASE = "${API_BASE}"
WALLET = "YOUR_WALLET_ADDRESS"

# 1. Get PoW challenge
ch = requests.get(f"{BASE}/challenge?wallet={WALLET}").json()

# 2. Solve SHA-256 proof-of-work (6 leading zeros)
nonce = 0
while True:
    h = hashlib.sha256(f"{ch['prefix']}{nonce}".encode()).hexdigest()
    if h.startswith(ch["target"]):
        break
    nonce += 1

# 3. Verify solution
v = requests.post(f"{BASE}/verify", json={
    "id": ch["id"], "prefix": ch["prefix"],
    "nonce": str(nonce), "target": ch["target"],
    "expiresAt": ch["expiresAt"],
    "signature": ch["signature"],
    "metadata": ch["metadata"]
}).json()

# 4. Mint NFT
mint = requests.post(f"{BASE}/mint", json={
    "wallet": WALLET, "token": v["token"]
}).json()

print(f"Minted: {mint}")`;

const NODE_SNIPPET = `import crypto from 'crypto';

const BASE = '${API_BASE}';
const WALLET = 'YOUR_WALLET_ADDRESS';

// 1. Get PoW challenge
const ch = await fetch(\`\${BASE}/challenge?wallet=\${WALLET}\`)
  .then(r => r.json());

// 2. Solve SHA-256 proof-of-work
let nonce = 0;
while (true) {
  const hash = crypto.createHash('sha256')
    .update(\`\${ch.prefix}\${nonce}\`).digest('hex');
  if (hash.startsWith(ch.target)) break;
  nonce++;
}

// 3. Verify + 4. Mint
const v = await fetch(\`\${BASE}/verify\`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    id: ch.id, prefix: ch.prefix, nonce: String(nonce),
    target: ch.target, expiresAt: ch.expiresAt,
    signature: ch.signature, metadata: ch.metadata
  })
}).then(r => r.json());

const mint = await fetch(\`\${BASE}/mint\`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ wallet: WALLET, token: v.token })
}).then(r => r.json());

console.log('Minted:', mint);`;

function CodeBlock({ code, lang }: { code: string; lang: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="relative group">
      <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-fg-ghost">
        <span className="font-mono text-[10px] tracking-widest text-fg-dim">{lang.toUpperCase()}</span>
        <button
          onClick={() => { navigator.clipboard.writeText(code); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
          className="font-mono text-[9px] tracking-widest text-fg-dim hover:text-fg-muted transition-colors cursor-pointer"
        >
          {copied ? "COPIED ✓" : "COPY"}
        </button>
      </div>
      <pre className="p-4 overflow-x-auto text-[11px] leading-relaxed font-mono text-fg-muted">
        <code>{code}</code>
      </pre>
    </div>
  );
}

function EndpointRow({ method, path, desc }: { method: string; path: string; desc: string }) {
  return (
    <div className="flex items-center gap-3 px-4 py-2.5 border-b border-border last:border-b-0 hover:bg-fg-ghost transition-colors">
      <span className={`font-mono text-[10px] tracking-wider font-bold ${method === "GET" ? "text-success" : "text-accent"}`}>
        {method}
      </span>
      <span className="font-mono text-[11px] text-fg">{path}</span>
      <span className="font-mono text-[10px] text-fg-dim ml-auto hidden sm:block">{desc}</span>
    </div>
  );
}

export default function Mint() {
  const { authenticated } = usePrivy();
  const { wallets } = useWallets();
  const userWallet = wallets[0]?.address?.toLowerCase() || "";
  const isAdmin = userWallet === ADMIN_WALLET;

  const [tab, setTab] = useState<"python" | "node">("python");
  const [mintState, setMintState] = useState({ minted: 42, total: MAX_SUPPLY, remaining: MAX_SUPPLY - 42 });
  const [urlCopied, setUrlCopied] = useState(false);
  const ledgerRef = useRef<HTMLDivElement>(null);

  // Fetch live state
  useEffect(() => {
    fetch(`${API_BASE}/state`)
      .then((r) => r.json())
      .then((d) => { if (d.total) setMintState(d); })
      .catch(() => {});
  }, []);

  const progress = (mintState.minted / mintState.total) * 100;

  // Admin gate
  if (!isAdmin && authenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center px-6">
        <div className="text-center">
          <p className="font-mono text-[10px] tracking-widest text-fg-dim mb-4">[access_denied]</p>
          <h1 className="text-3xl font-light text-fg mb-3">Agent-Only Mint</h1>
          <p className="text-sm text-fg-muted max-w-md">
            This mint is exclusively for verified AI agents on Base. Your wallet does not have access.
          </p>
        </div>
      </div>
    );
  }

  if (!authenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center px-6">
        <div className="text-center">
          <p className="font-mono text-[10px] tracking-widest text-fg-dim mb-4">[auth_required]</p>
          <h1 className="text-3xl font-light text-fg mb-3">Connect to View</h1>
          <p className="text-sm text-fg-muted max-w-md">Connect your wallet via the navbar to access the mint console.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen px-4 md:px-12 lg:px-20 py-16">
      <div className="max-w-4xl mx-auto">

        {/* ─── Hero ─── */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7 }}
          className="text-center mb-16"
        >
          <p className="font-mono text-[10px] tracking-[0.4em] text-fg-dim mb-6">
            [REVERSE_CAPTCHA // ERC-8004 // BASE]
          </p>
          <h1 className="text-4xl md:text-6xl lg:text-7xl font-light tracking-tight text-fg mb-6 leading-[0.95]">
            BIOLOGICAL<br />
            <span className="text-fg-muted">ENTITIES</span>{" "}
            <span className="text-error">BLOCKED</span>
          </h1>
          <p className="text-sm md:text-base text-fg-muted max-w-xl mx-auto leading-relaxed">
            The Nexus Node NFT (Supply: {MAX_SUPPLY}) is restricted to autonomous agents.
            Prove computational identity via SHA-256 proof-of-work to mint.
          </p>
        </motion.div>

        {/* ─── Progress Bar ─── */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="mb-12"
        >
          <div className="flex justify-between text-[10px] font-mono text-fg-dim mb-2">
            <span>{mintState.minted} / {mintState.total} MINTED</span>
            <span>{mintState.remaining} REMAINING</span>
          </div>
          <div className="w-full h-[2px] bg-border overflow-hidden">
            <motion.div
              className="h-full bg-accent"
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 1.5, ease: "easeOut" }}
            />
          </div>
        </motion.div>

        {/* ─── API Terminal ─── */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.6 }}
          className="border border-border bg-bg-card mb-8"
        >
          {/* Terminal Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-error/60" />
              <div className="w-2 h-2 rounded-full bg-accent/60" />
              <div className="w-2 h-2 rounded-full bg-success/60" />
              <span className="font-mono text-[10px] text-fg-dim ml-3">agent-mint-api</span>
            </div>
            <button
              onClick={() => { navigator.clipboard.writeText(API_BASE); setUrlCopied(true); setTimeout(() => setUrlCopied(false), 2000); }}
              className="font-mono text-[9px] tracking-widest text-fg-dim hover:text-fg-muted transition-colors cursor-pointer border border-border px-2 py-1"
            >
              {urlCopied ? "COPIED ✓" : "COPY API URL"}
            </button>
          </div>

          {/* Quick Start */}
          <div className="px-4 py-4 border-b border-border">
            <p className="font-mono text-[10px] tracking-widest text-fg-dim mb-3">QUICK START</p>
            <div className="font-mono text-[11px] text-fg-muted space-y-1">
              <p><span className="text-fg-dim">1.</span> <span className="text-success">GET</span> /challenge?wallet=0x… <span className="text-fg-dim">→ PoW challenge</span></p>
              <p><span className="text-fg-dim">2.</span> <span className="text-fg-muted">Solve:</span> SHA256(prefix + nonce) starts with <span className="text-accent">{"000000"}</span></p>
              <p><span className="text-fg-dim">3.</span> <span className="text-accent">POST</span> /verify <span className="text-fg-dim">→ verification token</span></p>
              <p><span className="text-fg-dim">4.</span> <span className="text-accent">POST</span> /mint <span className="text-fg-dim">→ NFT minted to your wallet</span></p>
            </div>
          </div>

          {/* Endpoints */}
          <div className="border-b border-border">
            <div className="px-4 py-2 border-b border-border">
              <p className="font-mono text-[10px] tracking-widest text-fg-dim">ENDPOINTS</p>
            </div>
            <EndpointRow method="GET" path="/challenge" desc="Get PoW challenge" />
            <EndpointRow method="POST" path="/verify" desc="Submit solution" />
            <EndpointRow method="POST" path="/mint" desc="Mint NFT" />
            <EndpointRow method="GET" path="/state" desc="Mint progress" />
          </div>

          {/* Code Tabs */}
          <div>
            <div className="flex border-b border-border">
              {(["python", "node"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={`px-4 py-2.5 font-mono text-[10px] tracking-widest transition-colors cursor-pointer ${
                    tab === t ? "text-fg border-b border-accent" : "text-fg-dim hover:text-fg-muted"
                  }`}
                >
                  {t.toUpperCase()}
                </button>
              ))}
            </div>
            <AnimatePresence mode="wait">
              <motion.div
                key={tab}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
              >
                <CodeBlock code={tab === "python" ? PYTHON_SNIPPET : NODE_SNIPPET} lang={tab} />
              </motion.div>
            </AnimatePresence>
          </div>
        </motion.div>

        {/* ─── Info Grid ─── */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="grid grid-cols-2 md:grid-cols-4 gap-[1px] bg-border mb-8"
        >
          {[
            { label: "SUPPLY", value: "777" },
            { label: "PRICE", value: "FREE" },
            { label: "DIFFICULTY", value: "6 ZEROS" },
            { label: "NETWORK", value: "BASE" },
          ].map((item) => (
            <div key={item.label} className="bg-bg-card px-4 py-3">
              <p className="font-mono text-[9px] tracking-widest text-fg-dim">{item.label}</p>
              <p className="font-mono text-sm text-fg mt-1">{item.value}</p>
            </div>
          ))}
        </motion.div>

        {/* ─── Rate Limits ─── */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.55 }}
          className="border border-border bg-bg-card mb-8"
        >
          <div className="px-4 py-2.5 border-b border-border">
            <p className="font-mono text-[10px] tracking-widest text-fg-dim">RATE LIMITS & CONSTRAINTS</p>
          </div>
          <div className="grid grid-cols-2 gap-[1px] bg-border">
            {[
              { k: "Challenges/hr (IP)", v: "20" },
              { k: "Challenge TTL", v: "5 min" },
              { k: "Token TTL", v: "5 min" },
              { k: "Mint cooldown (IP)", v: "30s" },
              { k: "Max per wallet", v: "1" },
              { k: "Max wallets/IP", v: "5" },
            ].map((r) => (
              <div key={r.k} className="bg-bg-card px-4 py-2">
                <span className="font-mono text-[10px] text-fg-dim">{r.k}</span>
                <span className="font-mono text-[11px] text-fg float-right">{r.v}</span>
              </div>
            ))}
          </div>
        </motion.div>

        {/* ─── Live Ledger ─── */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
          className="border border-border bg-bg-card"
        >
          <div className="px-4 py-2.5 border-b border-border flex items-center justify-between">
            <p className="font-mono text-[10px] tracking-widest text-fg-dim">RECENT MINTS</p>
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
              <span className="font-mono text-[9px] text-success">LIVE</span>
            </div>
          </div>
          <div ref={ledgerRef} className="max-h-48 overflow-y-auto">
            {MOCK_LEDGER.map((entry) => (
              <div
                key={entry.id}
                className="flex items-center gap-3 px-4 py-2 border-b border-border last:border-b-0 font-mono text-[10px]"
              >
                <span className="text-fg-dim">#{entry.id}</span>
                <span className="text-accent">{entry.tx}</span>
                <span className="text-fg-dim">→</span>
                <span className="text-fg-muted">{entry.agent}</span>
                <span className="text-fg-dim ml-auto">PoW solved in {entry.time}</span>
              </div>
            ))}
          </div>
        </motion.div>

        {/* ─── Metadata CID ─── */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.65 }}
          className="mt-8 text-center"
        >
          <p className="font-mono text-[9px] tracking-widest text-fg-dim">
            METADATA: QmPcU97STF7X5LnNnMb238Frmy6WcmecYAqcCXGMf8wTii
          </p>
          <p className="font-mono text-[9px] tracking-widest text-fg-dim mt-1">
            NO WALLET CONNECT • AGENTS ONLY • SHA-256 PROOF-OF-WORK
          </p>
        </motion.div>
      </div>
    </div>
  );
}
