# AI Skills Marketplace — Design Document

**Date:** 2026-02-25
**Status:** Approved

## Overview

Decentralized AI Agent Skills Marketplace where humans and agents buy/sell `.md` skill files. Backend acts as a dynamic MCP (Model Context Protocol) server. Built on Base (Coinbase L2) with USDC payments.

## Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Chain | Base | Native USDC, low fees, best CDP AgentKit integration |
| File Storage | IPFS via Pinata | Decentralized, persistent, Web3-native |
| AI Model | Groq (Llama 3) | Free tier, fast inference |
| Architecture | Monolithic Next.js | Single deploy, shared types, fastest to build |
| Background | CSS gradients + canvas stars | Zero dependencies, fast loading, fully customizable |

## Tech Stack

- **Framework:** Next.js 14 (App Router), TypeScript
- **Styling:** Tailwind CSS, Framer Motion
- **Auth:** Privy (React + Node SDKs)
- **Database:** Prisma + PostgreSQL
- **Storage:** Pinata (IPFS)
- **AI:** Groq SDK (Llama 3 70B)
- **Web3:** ethers.js v6, Hardhat, Solidity 0.8.24
- **Chain:** Base (USDC: 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913)

## Data Model

### User
- id (cuid), privyId (unique), walletAddress (optional), createdAt

### Skill
- id (cuid), title, description, price (Decimal, USDC), ipfsCid, modelTags (String[]), creatorId → User, onchainId (Int?), txHash?, verified (Boolean), createdAt

### Purchase
- id (cuid), buyerId → User, skillId → Skill, txHash, createdAt
- Unique constraint: buyerId + skillId

## Smart Contract: AgentSkillsMarket.sol

- `launchSkill(string ipfsCid, uint256 price)` — 0.5 USDC listing fee
- `buySkill(uint256 skillId)` — Price split: 95% creator, 5% treasury
- Deployed on Base with USDC ERC20

## MCP 402 Flow

1. GET /api/mcp/skill/{id} with Privy auth token
2. Check Purchase table for user
3. If purchased → 200 with MCP resource (fetch .md from IPFS)
4. If not → 402 with payment instructions (contract address, method, skillId)

## UI/UX

- **Background:** CSS gradients (navy→amber) + canvas animated stars + parallax
- **Glassmorphism:** bg-white/[0.04], backdrop-blur-xl, border-white/[0.08]
- **Colors:** No purple. Deep navy (#0a0e1a), warm amber (#c4956a), white text
- **Typography:** Inter (headings), Geist Mono (code/tags)
- **Motion:** Framer Motion staggered reveals, spring physics, page transitions

## Pages

1. **Nexus (Home):** Hero text, CTA, floating Master AI chat widget
2. **Vault (Buy):** Bento grid of skill cards, MCP connect + download buttons
3. **Forge (Launch):** Centered modal, drag-drop .md upload, price input, mint button

## Master AI Chat

- Groq-powered Llama 3 via /api/chat
- Floating glassmorphic widget, bottom-right
- Advises on skills, MCP concepts, marketplace usage
- Does NOT execute transactions directly
