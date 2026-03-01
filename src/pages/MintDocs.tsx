import { useState } from "react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";

const PROJECT_ID = import.meta.env.VITE_SUPABASE_PROJECT_ID || "xiofvutfjujnzdzlgmyc";
const API_BASE = `https://${PROJECT_ID}.supabase.co/functions/v1/agent-mint`;

/* ─── Reusable CodeBlock ─── */
function CodeBlock({ code, lang }: { code: string; lang: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="relative group border border-border bg-bg-card overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-fg-ghost">
        <span className="font-mono text-[10px] tracking-widest text-fg-dim">{lang.toUpperCase()}</span>
        <button
          onClick={() => { navigator.clipboard.writeText(code); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
          className="font-mono text-[9px] tracking-widest text-fg-dim hover:text-fg-muted transition-colors cursor-pointer"
        >
          {copied ? "COPIED \u2713" : "COPY"}
        </button>
      </div>
      <pre className="p-4 overflow-x-auto text-[11px] leading-relaxed font-mono text-fg-muted">
        <code>{code}</code>
      </pre>
    </div>
  );
}

/* ─── Section wrapper with entrance animation ─── */
function Section({ children, delay = 0, className = "" }: { children: React.ReactNode; delay?: number; className?: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

/* ─── Endpoint card ─── */
function EndpointCard({
  method,
  path,
  description,
  children,
  delay = 0,
}: {
  method: string;
  path: string;
  description: string;
  children: React.ReactNode;
  delay?: number;
}) {
  const methodColor = method === "GET" ? "text-success" : "text-accent";
  return (
    <Section delay={delay} className="border border-border bg-bg-card">
      <div className="px-4 py-3 border-b border-border flex items-center gap-3">
        <span className={`font-mono text-[11px] tracking-wider font-bold ${methodColor}`}>{method}</span>
        <span className="font-mono text-[12px] text-fg">{path}</span>
        <span className="font-mono text-[10px] text-fg-dim ml-auto hidden sm:block">{description}</span>
      </div>
      <div className="px-4 py-4 space-y-4">{children}</div>
    </Section>
  );
}

/* ─── Inline label ─── */
function Label({ children }: { children: React.ReactNode }) {
  return <p className="font-mono text-[10px] tracking-widest text-fg-dim mb-2">{children}</p>;
}

/* ─── Code snippets ─── */
const PYTHON_EXAMPLE = `import hashlib, requests

BASE = "${API_BASE}"
WALLET = "YOUR_WALLET_ADDRESS"

# 1. Check mint state
state = requests.get(f"{BASE}/state").json()
print(f"Phase: {state['phase']}, Remaining: {state['remaining']}")

# 2. Get challenge
ch = requests.get(f"{BASE}/challenge?wallet={WALLET}").json()

# 3. Solve PoW (6 leading zeros)
nonce = 0
while True:
    h = hashlib.sha256(f"{ch['prefix']}{nonce}".encode()).hexdigest()
    if h.startswith(ch["target"]):
        break
    nonce += 1

print(f"Solved! Nonce: {nonce}")

# 4. Verify
v = requests.post(f"{BASE}/verify", json={
    "id": ch["id"], "prefix": ch["prefix"],
    "nonce": str(nonce), "target": ch["target"],
    "expiresAt": ch["expiresAt"],
    "signature": ch["signature"],
    "metadata": ch["metadata"]
}).json()

# 5. Mint
mint_body = {"wallet": WALLET, "token": v["token"]}

# If paid mint required:
if v["payment"]["required"]:
    # Send ETH to v["payment"]["recipient"] first
    # Then add: mint_body["paymentTxHash"] = "0x..."
    pass

mint = requests.post(f"{BASE}/mint", json=mint_body).json()
print(f"Minted! Token: {mint['tokenId']}, Tx: {mint['txHash']}")`;

const NODE_EXAMPLE = `import crypto from 'crypto';

const BASE = '${API_BASE}';
const WALLET = 'YOUR_WALLET_ADDRESS';

// 1. Check state
const state = await fetch(\`\${BASE}/state\`).then(r => r.json());
console.log(\`Phase: \${state.phase}, Remaining: \${state.remaining}\`);

// 2. Get challenge
const ch = await fetch(\`\${BASE}/challenge?wallet=\${WALLET}\`).then(r => r.json());

// 3. Solve PoW
let nonce = 0;
while (true) {
  const hash = crypto.createHash('sha256')
    .update(\`\${ch.prefix}\${nonce}\`).digest('hex');
  if (hash.startsWith(ch.target)) break;
  nonce++;
}

// 4. Verify
const v = await fetch(\`\${BASE}/verify\`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    id: ch.id, prefix: ch.prefix, nonce: String(nonce),
    target: ch.target, expiresAt: ch.expiresAt,
    signature: ch.signature, metadata: ch.metadata
  })
}).then(r => r.json());

// 5. Mint
const mintBody = { wallet: WALLET, token: v.token };
if (v.payment.required) {
  // Send ETH to v.payment.recipient first, then:
  // mintBody.paymentTxHash = '0x...';
}

const mint = await fetch(\`\${BASE}/mint\`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(mintBody)
}).then(r => r.json());

console.log(\`Minted! Token: \${mint.tokenId}, Tx: \${mint.txHash}\`);`;

/* ─── JSON snippets ─── */
const CHALLENGE_RESPONSE = `{
  "id": "nxa_abc123def456",
  "prefix": "nexus_1708123456_a1b2c3d4_",
  "target": "000000",
  "expiresAt": 1708123756,
  "signature": "hmac_signature_here",
  "difficulty": 6,
  "metadata": { "wallet": "YOUR_WALLET" }
}`;

const VERIFY_REQUEST = `{
  "id": "nxa_abc123def456",
  "prefix": "nexus_1708123456_a1b2c3d4_",
  "nonce": "your_found_nonce",
  "target": "000000",
  "expiresAt": 1708123756,
  "signature": "hmac_signature_here",
  "metadata": { "wallet": "YOUR_WALLET" }
}`;

const VERIFY_RESPONSE = `{
  "valid": true,
  "token": "verification_token_here",
  "hash": "sha256_hash_of_solution",
  "payment": {
    "required": false,
    "amount": "0",
    "amountUsd": 0,
    "recipient": "0xc6525dbbc9ac18fbf9ec93c219670b0dbb6cf2d3"
  }
}`;

const MINT_FREE_BODY = `{
  "wallet": "YOUR_WALLET_ADDRESS",
  "token": "verification_token_from_verify"
}`;

const MINT_PAID_BODY = `{
  "wallet": "YOUR_WALLET_ADDRESS",
  "token": "verification_token_from_verify",
  "paymentTxHash": "0x_your_eth_payment_tx_hash"
}`;

const MINT_RESPONSE = `{
  "success": true,
  "mode": "agent",
  "tokenId": 42,
  "txHash": "0x_mint_transaction_hash",
  "free": true,
  "message": "Free mint successful!"
}`;

const STATE_RESPONSE = `{
  "minted": 150,
  "total": 779,
  "remaining": 629,
  "phase": "paid",
  "mintActive": true,
  "mintPrice": "4000000000000000",
  "difficulty": 6,
  "recentMints": [...]
}`;

/* ─── Main Page ─── */
export default function MintDocs() {
  return (
    <div className="min-h-screen px-4 md:px-12 lg:px-20 py-16 font-mono">
      <div className="max-w-4xl mx-auto">

        {/* ─── Back Link ─── */}
        <Section delay={0}>
          <Link
            to="/mint"
            className="inline-flex items-center gap-2 font-mono text-[10px] tracking-widest text-fg-dim hover:text-fg-muted transition-colors mb-12"
          >
            <span>&larr;</span> BACK TO MINT
          </Link>
        </Section>

        {/* ─── Header ─── */}
        <Section delay={0.05} className="mb-12">
          <p className="font-mono text-[10px] tracking-[0.4em] text-fg-dim mb-4">
            [DOCUMENTATION // AGENT API // BASE]
          </p>
          <h1 className="text-3xl md:text-4xl lg:text-5xl font-light tracking-tight text-fg mb-4 leading-[0.95]">
            NEXUS NODE
            <br />
            <span className="text-fg-muted">Agent Mint API</span>
          </h1>
          <p className="text-sm text-fg-muted max-w-2xl leading-relaxed">
            779-piece NFT collection on Base. Agents mint by solving SHA-256
            proof-of-work challenges. First 100 free, then $10 USD in ETH.
          </p>
        </Section>

        {/* ─── Quick Start ─── */}
        <Section delay={0.1} className="border border-border bg-bg-card mb-8">
          <div className="px-4 py-2.5 border-b border-border">
            <p className="font-mono text-[10px] tracking-widest text-fg-dim">QUICK START</p>
          </div>
          <div className="px-4 py-4 space-y-1.5">
            <p className="text-[11px] text-fg-muted">
              <span className="text-fg-dim">1.</span>{" "}
              <span className="text-success font-bold">GET</span>{" "}
              /challenge?wallet=YOUR_WALLET{" "}
              <span className="text-fg-dim">&rarr; PoW challenge</span>
            </p>
            <p className="text-[11px] text-fg-muted">
              <span className="text-fg-dim">2.</span>{" "}
              Solve: find nonce where SHA256(prefix + nonce) starts with{" "}
              <span className="text-accent">000000</span>
            </p>
            <p className="text-[11px] text-fg-muted">
              <span className="text-fg-dim">3.</span>{" "}
              <span className="text-accent font-bold">POST</span>{" "}
              /verify{" "}
              <span className="text-fg-dim">&rarr; verification token</span>
            </p>
            <p className="text-[11px] text-fg-muted">
              <span className="text-fg-dim">4.</span>{" "}
              <span className="text-accent font-bold">POST</span>{" "}
              /mint{" "}
              <span className="text-fg-dim">&rarr; NFT minted to your wallet</span>
            </p>
          </div>
          <div className="px-4 py-3 border-t border-border">
            <p className="text-[10px] text-fg-dim">
              <span className="text-accent">NOTE:</span> First 100 agent mints are FREE. After that, send $10 USD in ETH to the admin wallet before calling /mint.
            </p>
          </div>
        </Section>

        {/* ─── Endpoints Title ─── */}
        <Section delay={0.15} className="mb-4">
          <p className="font-mono text-[10px] tracking-[0.3em] text-fg-dim">ENDPOINTS</p>
          <div className="w-10 h-[1px] bg-accent/40 mt-2" />
        </Section>

        {/* ─── GET /challenge ─── */}
        <div className="space-y-8 mb-12">
          <EndpointCard method="GET" path="/challenge" description="Get PoW challenge" delay={0.2}>
            <div>
              <Label>QUERY PARAMS</Label>
              <div className="border border-border">
                <div className="flex items-center gap-3 px-4 py-2 text-[11px]">
                  <span className="text-accent">wallet</span>
                  <span className="text-fg-dim">string, optional</span>
                  <span className="text-fg-muted ml-auto hidden sm:block">Ethereum wallet address</span>
                </div>
              </div>
            </div>
            <div>
              <Label>RESPONSE 200</Label>
              <CodeBlock code={CHALLENGE_RESPONSE} lang="json" />
            </div>
            <div className="text-[11px] text-fg-muted space-y-1">
              <p><span className="text-accent">Important:</span> Save <span className="text-fg">id</span>, <span className="text-fg">signature</span>, and <span className="text-fg">metadata</span> -- needed for /verify.</p>
              <p><span className="text-error">429</span> = rate limited (max 20 challenges/hr per IP)</p>
            </div>
          </EndpointCard>

          {/* ─── POST /verify ─── */}
          <EndpointCard method="POST" path="/verify" description="Submit PoW solution" delay={0.25}>
            <div>
              <Label>REQUEST BODY</Label>
              <CodeBlock code={VERIFY_REQUEST} lang="json" />
            </div>
            <div className="border border-border bg-bg px-4 py-3">
              <Label>HOW TO SOLVE</Label>
              <p className="text-[11px] text-fg-muted leading-relaxed">
                Find a nonce string such that <span className="text-fg">SHA256(prefix + nonce)</span> starts with
                target (<span className="text-accent">"000000"</span> = 6 leading hex zeros). The nonce can be any string.
              </p>
            </div>
            <div>
              <Label>RESPONSE 200</Label>
              <CodeBlock code={VERIFY_RESPONSE} lang="json" />
            </div>
            <div className="text-[11px] text-fg-muted space-y-1">
              <p>If <span className="text-fg">payment.required</span> is <span className="text-accent">true</span>, you must send ETH before calling /mint.</p>
              <p><span className="text-error">400</span> = bad request (invalid solution, expired challenge, replay detected)</p>
            </div>
          </EndpointCard>

          {/* ─── POST /mint ─── */}
          <EndpointCard method="POST" path="/mint" description="Mint NFT" delay={0.3}>
            <div>
              <Label>FREE MINT BODY (first 100)</Label>
              <CodeBlock code={MINT_FREE_BODY} lang="json" />
            </div>
            <div>
              <Label>PAID MINT BODY (after first 100)</Label>
              <CodeBlock code={MINT_PAID_BODY} lang="json" />
            </div>
            <div className="border border-border bg-bg px-4 py-3">
              <p className="text-[11px] text-fg-muted leading-relaxed">
                <span className="text-accent">For paid mints:</span> Send exact ETH amount from{" "}
                <span className="text-fg">payment.amount</span> to{" "}
                <span className="text-fg">payment.recipient</span> BEFORE calling /mint.
              </p>
            </div>
            <div>
              <Label>RESPONSE 200</Label>
              <CodeBlock code={MINT_RESPONSE} lang="json" />
            </div>
            <div>
              <Label>ERRORS</Label>
              <div className="border border-border text-[11px]">
                <div className="flex gap-3 px-4 py-2 border-b border-border">
                  <span className="text-error w-8">400</span>
                  <span className="text-fg-muted">Invalid input, expired token, replay, sold out</span>
                </div>
                <div className="flex gap-3 px-4 py-2 border-b border-border">
                  <span className="text-error w-8">403</span>
                  <span className="text-fg-muted">Wallet limit (1) reached</span>
                </div>
                <div className="flex gap-3 px-4 py-2 border-b border-border">
                  <span className="text-error w-8">429</span>
                  <span className="text-fg-muted">Cooldown -- too many requests</span>
                </div>
                <div className="flex gap-3 px-4 py-2">
                  <span className="text-error w-8">500</span>
                  <span className="text-fg-muted">Server error</span>
                </div>
              </div>
            </div>
          </EndpointCard>

          {/* ─── GET /state ─── */}
          <EndpointCard method="GET" path="/state" description="Mint progress" delay={0.35}>
            <div>
              <Label>PARAMS</Label>
              <p className="text-[11px] text-fg-dim">No parameters required.</p>
            </div>
            <div>
              <Label>RESPONSE 200</Label>
              <CodeBlock code={STATE_RESPONSE} lang="json" />
            </div>
          </EndpointCard>
        </div>

        {/* ─── Rate Limits ─── */}
        <Section delay={0.4} className="border border-border bg-bg-card mb-8">
          <div className="px-4 py-2.5 border-b border-border">
            <p className="font-mono text-[10px] tracking-widest text-fg-dim">RATE LIMITS & CONSTRAINTS</p>
          </div>
          <div className="grid grid-cols-2 gap-[1px] bg-border">
            {[
              { k: "Challenges/hr (per IP)", v: "20" },
              { k: "Challenge TTL", v: "5 minutes" },
              { k: "Token TTL", v: "5 minutes" },
              { k: "Max per wallet", v: "1" },
              { k: "Max wallets/IP", v: "5" },
              { k: "PoW difficulty", v: "6 leading zeros" },
            ].map((r) => (
              <div key={r.k} className="bg-bg-card px-4 py-2.5">
                <span className="font-mono text-[10px] text-fg-dim">{r.k}</span>
                <span className="font-mono text-[11px] text-fg float-right">{r.v}</span>
              </div>
            ))}
          </div>
        </Section>

        {/* ─── Examples Title ─── */}
        <Section delay={0.45} className="mb-4">
          <p className="font-mono text-[10px] tracking-[0.3em] text-fg-dim">FULL EXAMPLES</p>
          <div className="w-10 h-[1px] bg-accent/40 mt-2" />
        </Section>

        {/* ─── Python Example ─── */}
        <Section delay={0.5} className="mb-4">
          <CodeBlock code={PYTHON_EXAMPLE} lang="python" />
        </Section>

        {/* ─── Node.js Example ─── */}
        <Section delay={0.55} className="mb-8">
          <CodeBlock code={NODE_EXAMPLE} lang="javascript" />
        </Section>

        {/* ─── Error Codes ─── */}
        <Section delay={0.6} className="border border-border bg-bg-card mb-8">
          <div className="px-4 py-2.5 border-b border-border">
            <p className="font-mono text-[10px] tracking-widest text-fg-dim">ERROR CODES</p>
          </div>
          <div>
            {[
              { code: "400", meaning: "Bad request -- invalid input, expired challenge, replay, sold out" },
              { code: "403", meaning: "Forbidden -- wallet limit (1) reached" },
              { code: "429", meaning: "Too many requests -- rate limited" },
              { code: "500", meaning: "Server error" },
            ].map((e, i, arr) => (
              <div
                key={e.code}
                className={`flex items-center gap-4 px-4 py-2.5 ${i < arr.length - 1 ? "border-b border-border" : ""}`}
              >
                <span className="font-mono text-[11px] text-error w-8">{e.code}</span>
                <span className="font-mono text-[11px] text-fg-muted">{e.meaning}</span>
              </div>
            ))}
          </div>
        </Section>

        {/* ─── Notes Footer ─── */}
        <Section delay={0.65} className="border border-border bg-bg-card mb-12">
          <div className="px-4 py-2.5 border-b border-border">
            <p className="font-mono text-[10px] tracking-widest text-fg-dim">NOTES</p>
          </div>
          <div className="px-4 py-4 space-y-2">
            {[
              "Agent mints are free for first 100, then $10 USD in ETH.",
              "Each challenge can only be used once (replay protection).",
              "Verification tokens expire after 5 minutes.",
              "The PoW uses SHA-256 -- any standard library works.",
              "All wallet addresses must be valid Ethereum addresses (0x + 40 hex chars).",
              "The server mints on your behalf -- no wallet signature needed.",
              "Check /state to confirm mint is active before starting.",
            ].map((note) => (
              <p key={note} className="font-mono text-[11px] text-fg-muted flex items-start gap-2">
                <span className="text-fg-dim mt-0.5">-</span>
                <span>{note}</span>
              </p>
            ))}
          </div>
        </Section>

        {/* ─── Footer stamp ─── */}
        <Section delay={0.7} className="text-center mb-8">
          <p className="font-mono text-[9px] tracking-widest text-fg-dim">
            NEXUS NODE // AGENT MINT API // SHA-256 PROOF-OF-WORK // BASE MAINNET
          </p>
        </Section>
      </div>
    </div>
  );
}
