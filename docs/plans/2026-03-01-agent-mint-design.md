# Nexus Node Agent Mint — Design Document

**Date:** 2026-03-01
**Chain:** Base Mainnet (8453)
**IPFS CID:** QmPcU97STF7X5LnNnMb238Frmy6WcmecYAqcCXGMf8wTii

---

## Overview

Agent-only NFT mint inspired by bloks.art. AI agents solve SHA-256 proof-of-work challenges via API to mint. No human wallet-connect minting. Server mints on behalf of agents.

## Supply

| Category | Count | Price |
|----------|-------|-------|
| Treasury | 2 | Free (minted on deploy to admin) |
| Free public | 100 | Free (first 100 agents to solve PoW) |
| Paid public | 677 | 10 USD in Base ETH |
| **Total** | **779** | |

Admin wallet: `0xc6525DBbc9AC18fBf9ec93C219670B0dBb6cF2D3`

## Smart Contract (NexusAgentNFT.sol)

- ERC-721 on Base mainnet, Solidity 0.8.24
- `constructor(mintPrice)` — mints 2 treasury NFTs to owner, sets ETH price
- `mintTo(address to)` — onlyOwner, server calls after PoW verification
- `setMintPrice(uint256)` — owner updates ETH price as market moves
- `toggleMint(bool)` — owner controls active/inactive
- `withdraw()` — owner pulls accidental ETH from contract
- `tokenURI(tokenId)` — returns `ipfs://CID/tokenId`
- 1 mint per wallet enforced
- No direct public mint function (removed)

Deploy via Remix. Set minter = deployer wallet (server holds this key).

## Backend (Supabase Edge Functions)

### agent-mint edge function

**GET /challenge?wallet=0x...**
- Rate limit: 20/hr per IP
- Returns: `{id, prefix, target:"000000", expiresAt, signature, difficulty:6, metadata:{wallet}}`
- Challenge TTL: 5 minutes
- HMAC-signed with SUPABASE_SERVICE_ROLE_KEY

**POST /verify**
- Validates HMAC signature, expiry, replay protection
- Verifies SHA-256(prefix + nonce) starts with target
- Returns: `{valid, token, hash, payment:{required, amount, amountUsd, recipient}}`
- payment.required = true when totalMinted >= 102 (2 treasury + 100 free)

**POST /mint**
- Free: `{wallet, token}`
- Paid: `{wallet, token, paymentTxHash}`
- For paid: verifies ETH tx on-chain (amount, recipient=admin wallet, sender=agent wallet)
- Calls mintTo(wallet) via server minter private key
- Logs to mint_ledger table
- Returns: `{success, tokenId, txHash, message}`

**GET /state**
- Reads totalMinted from contract on-chain
- Reads recent mints from mint_ledger table
- Returns: `{minted, total:779, remaining, phase, recentMints:[...]}`

### Database Tables

**mint_ledger** (new table):
- id (UUID)
- token_id (integer)
- wallet (text)
- tx_hash (text)
- pow_time_ms (integer, optional)
- free (boolean)
- created_at (timestamptz)

**mint_config** (new table):
- key (text, PK)
- value (text)
- Keys: "mint_active" (true/false), "mint_price_wei" (string)

### Transaction Signing

Use ethers.js via esm.sh import in Deno edge function:
- Import ethers Wallet + JsonRpcProvider
- Sign and send mintTo(address) transaction
- Return tx hash to agent

### Payment Verification (for paid mints)

- Agent sends ETH to admin wallet `0xc6525DBbc9AC18fBf9ec93C219670B0dBb6cF2D3`
- Agent provides paymentTxHash to /mint
- Server fetches tx receipt via eth_getTransactionReceipt
- Verifies: tx.to == admin wallet, tx.value >= mintPrice, tx.from == agent wallet, tx confirmed
- Each paymentTxHash can only be used once (stored in mint_ledger)

## Frontend

### /mint page (bloks.art style)

Simple, dark, minimal:
- Collection name "NEXUS NODE" centered
- Mint progress: "142 / 779 MINTED" with yellow progress bar
- LIVE badge (or SOLD OUT when complete)
- Three tabs: HUMANS | AGENTS | ABOUT
  - HUMANS: "Biological entities blocked" message
  - AGENTS: Brief description + "AGENT DOCS" button linking to /mint/docs
  - ABOUT: Collection description
- Real-time mint ledger: polls /state every 10s, shows recent mints
- Bottom bar: supply, chain, verification status
- Admin features (only for admin wallet):
  - "GO LIVE" toggle (writes to mint_config table)
  - Visible only when admin wallet connected

### /mint/docs page

Full API documentation:
- All endpoints with request/response examples
- Python + Node.js code snippets
- Rate limits table
- Payment flow explanation
- Quick start guide
- Always accessible (agents/developers need this)

### Visibility rules

| State | Non-auth | Auth (non-admin) | Auth (admin) |
|-------|----------|-------------------|--------------|
| Mint OFF | "Coming Soon" | "Coming Soon" | Full page + GO LIVE toggle |
| Mint ON | Full page | Full page | Full page + toggle |
| Sold Out | Full page + SOLD OUT | Full page + SOLD OUT | Full page + SOLD OUT |

/mint/docs is always accessible regardless of mint state.

## Environment Variables (Supabase Edge Function Secrets)

- `DEPLOYER_PRIVATE_KEY` — minter wallet private key (signs mintTo txs)
- `NFT_CONTRACT` — deployed contract address
- `RPC_URL` — Base mainnet RPC (https://mainnet.base.org or Alchemy)
- `SUPABASE_URL` — auto-provided
- `SUPABASE_SERVICE_ROLE_KEY` — auto-provided (used for HMAC + DB access)
- `ADMIN_WALLET` — 0xc6525DBbc9AC18fBf9ec93C219670B0dBb6cF2D3
- `MINT_PRICE_USD` — 10 (for reference, actual price in wei set on contract)
