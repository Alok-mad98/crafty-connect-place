import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
// Wallet/ethers dependencies removed — stubs used instead
import {
  DATA_MINING_ADDRESS,
  NEXUS_TOKEN_ADDRESS,
  NEXUS_AGENT_NFT_ADDRESS,
  NEXUS_TREASURY_ADDRESS,
  API_BASE,
} from "@/lib/contracts";

const MINING_ABI = [
  "function getGameState() external view returns (uint256 roundId, uint256 startTime, uint256 timeRemaining, bool active, uint256 vault, uint256 rewards)",
  "function getBlockDeployments(uint256 roundId) external view returns (uint256[25] ethBlocks, uint256[25] nexusBlocks)",
  "function getPlayerDeploy(uint256 roundId, address player) external view returns (uint8[] ethBlocks, uint256 ethPerBlock, uint8[] nexusBlocks, uint256 nexusPerBlock, bool claimed)",
  "function getRoundInfo(uint256 roundId) external view returns (uint256 totalETH, uint256 totalNexus, uint8 winningBlock, bool settled, bool vaultTriggered)",
  "function getMultiplier(address player) external view returns (uint256)",
  "function hasStakedNFT(address) external view returns (bool)",
  "function uncooledBalance(address) external view returns (uint256)",
  "function cooledBalance(address) external view returns (uint256)",
  "function totalRoundsPlayed() external view returns (uint256)",
  "function deployETH(uint8[] blocks) external payable",
  "function deployNexus(uint8[] blocks, uint256 perBlock) external",
  "function settleRound() external",
  "function claimRound(uint256 roundId) external",
  "function claimCooled() external",
  "function stakeNFT(uint256 tokenId) external",
  "function unstakeNFT() external",
];

const NEXUS_ABI = [
  "function balanceOf(address) external view returns (uint256)",
  "function approve(address, uint256) external returns (bool)",
  "function allowance(address, address) external view returns (uint256)",
];

const NFT_ABI = [
  "function balanceOf(address) view returns (uint256)",
  "function ownerOf(uint256) view returns (address)",
  "function totalMinted() view returns (uint256)",
  "function setApprovalForAll(address, bool) external",
  "function isApprovedForAll(address, address) view returns (bool)",
];

const TREASURY_ABI = [
  "function totalBurned() external view returns (uint256)",
  "function totalDistributed() external view returns (uint256)",
  "function nftRewardPool() external view returns (uint256)",
  "function coreRewardPool() external view returns (uint256)",
];

// ---------------------------------------------------------------------------
// AI AGENT STRATEGIES
// ---------------------------------------------------------------------------
type Strategy = "conservative" | "balanced" | "aggressive" | "sniper";
interface AgentConfig {
  strategy: Strategy;
  ethPerRound: string;
  nexusPerRound: string;
  maxRounds: number;
  autoSettle: boolean;
  autoClaim: boolean;
  running: boolean;
}

const STRATEGIES: Record<Strategy, { name: string; desc: string; color: string; blocks: number }> = {
  conservative: {
    name: "CONSERVATIVE",
    desc: "Spread across 8-12 blocks. Lower risk, steady gains.",
    color: "text-blue-400",
    blocks: 10,
  },
  balanced: {
    name: "BALANCED",
    desc: "Deploy on 4-6 blocks. Moderate risk, good returns.",
    color: "text-accent",
    blocks: 5,
  },
  aggressive: {
    name: "AGGRESSIVE",
    desc: "Focus on 2-3 blocks. High risk, high reward.",
    color: "text-orange-400",
    blocks: 2,
  },
  sniper: {
    name: "SNIPER",
    desc: "All-in on 1 block. Maximum risk, maximum reward.",
    color: "text-red-400",
    blocks: 1,
  },
};

// ---------------------------------------------------------------------------
// COMPONENT
// ---------------------------------------------------------------------------
export default function Agents() {
  const authenticated = false;
  const login = () => alert("Wallet connection required.");
  const wallets: any[] = [];

  // Balances
  const [ethBalance, setEthBalance] = useState("0");
  const [nexusBalance, setNexusBalance] = useState("0");
  const [uncooled, setUncooled] = useState("0");
  const [cooled, setCooled] = useState("0");
  const [hasNFT, setHasNFT] = useState(false);
  const [multiplier, setMultiplier] = useState("1.0x");
  const [nftStaked, setNftStaked] = useState(false);

  // Game state
  const [roundId, setRoundId] = useState(0);
  const [timeLeft, setTimeLeft] = useState(60);
  const [gameActive, setGameActive] = useState(false);
  const [totalRounds, setTotalRounds] = useState(0);

  // Agent state
  const [agent, setAgent] = useState<AgentConfig>({
    strategy: "balanced",
    ethPerRound: "0.0001",
    nexusPerRound: "0",
    maxRounds: 100,
    autoSettle: true,
    autoClaim: true,
    running: false,
  });
  const [agentLog, setAgentLog] = useState<string[]>([]);
  const [roundsPlayed, setRoundsPlayed] = useState(0);
  const [wins, setWins] = useState(0);
  const [losses, setLosses] = useState(0);
  const [totalEarned, setTotalEarned] = useState("0");

  // NFT selector
  const [ownedNFTs, setOwnedNFTs] = useState<Array<{ tokenId: number; tier: string; image: string }>>([]);
  const [showNFTSelector, setShowNFTSelector] = useState(false);
  const [loadingNFTs, setLoadingNFTs] = useState(false);

  // UI
  const [tab, setTab] = useState<"deploy" | "rewards" | "staking" | "stats">("deploy");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Helpers
  const getProvider = useCallback(async () => {
    const w = wallets[0];
    await w.switchChain(8453);
    const raw = await w.getEthereumProvider();
    return new ethers.BrowserProvider(raw);
  }, [wallets]);

  const getContract = useCallback(
    async (signer = false) => {
      const p = await getProvider();
      return new ethers.Contract(DATA_MINING_ADDRESS, MINING_ABI, signer ? await p.getSigner() : p);
    },
    [getProvider]
  );

  // Fetch data
  const fetchData = useCallback(async () => {
    if (!wallets[0]) return;
    try {
      const p = await getProvider();
      const addr = wallets[0].address;
      const mining = new ethers.Contract(DATA_MINING_ADDRESS, MINING_ABI, p);
      const nexus = new ethers.Contract(NEXUS_TOKEN_ADDRESS, NEXUS_ABI, p);

      const [gs, mult, staked, unc, cool, nexBal, ethBal, rounds] = await Promise.all([
        mining.getGameState(),
        mining.getMultiplier(addr),
        mining.hasStakedNFT(addr),
        mining.uncooledBalance(addr),
        mining.cooledBalance(addr),
        nexus.balanceOf(addr),
        p.getBalance(addr),
        mining.totalRoundsPlayed(),
      ]);

      setRoundId(Number(gs[0]));
      setTimeLeft(Number(gs[2]));
      setGameActive(gs[3]);
      setNftStaked(staked);
      setMultiplier((Number(mult) / 10000).toFixed(1) + "x");
      setUncooled(ethers.formatEther(unc));
      setCooled(ethers.formatEther(cool));
      setNexusBalance(ethers.formatEther(nexBal));
      setEthBalance(ethers.formatEther(ethBal));
      setTotalRounds(Number(rounds));

      // Check if user owns NFT
      const nft = new ethers.Contract(NEXUS_AGENT_NFT_ADDRESS, NFT_ABI, p);
      const nftBal = await nft.balanceOf(addr);
      setHasNFT(Number(nftBal) > 0 || staked);
    } catch (e) {
      console.error("Fetch error:", e);
    }
  }, [wallets, getProvider]);

  useEffect(() => {
    if (authenticated && wallets[0]) fetchData();
    const iv = setInterval(() => {
      if (authenticated && wallets[0]) fetchData();
    }, 10000);
    return () => clearInterval(iv);
  }, [authenticated, wallets, fetchData]);

  // Countdown
  useEffect(() => {
    const iv = setInterval(() => setTimeLeft((t) => Math.max(0, t - 1)), 1000);
    return () => clearInterval(iv);
  }, []);

  // Agent log helper
  const log = (msg: string) => {
    const ts = new Date().toLocaleTimeString();
    setAgentLog((prev) => [`[${ts}] ${msg}`, ...prev.slice(0, 49)]);
  };

  // ---------------------------------------------------------------------------
  // AGENT ACTIONS
  // ---------------------------------------------------------------------------
  const pickBlocks = (strategy: Strategy): number[] => {
    const count = STRATEGIES[strategy].blocks;
    const all = Array.from({ length: 25 }, (_, i) => i);
    const shuffled = all.sort(() => Math.random() - 0.5);
    return shuffled.slice(0, count);
  };

  const runAgentRound = useCallback(async () => {
    if (!agent.running || !wallets[0]) return;
    try {
      const contract = await getContract(true);
      const blocks = pickBlocks(agent.strategy);

      // Deploy ETH
      if (parseFloat(agent.ethPerRound) > 0) {
        const total = ethers.parseEther(agent.ethPerRound) * BigInt(blocks.length);
        log(`Deploying ${agent.ethPerRound} ETH × ${blocks.length} blocks = ${ethers.formatEther(total)} ETH`);
        const tx = await contract.deployETH(blocks, { value: total });
        await tx.wait();
        log(`ETH deployed on blocks: [${blocks.join(", ")}]`);
      }

      // Deploy NEXUS
      if (parseFloat(agent.nexusPerRound) > 0) {
        const perBlock = ethers.parseEther(agent.nexusPerRound);
        const p = await getProvider();
        const signer = await p.getSigner();
        const nexus = new ethers.Contract(NEXUS_TOKEN_ADDRESS, NEXUS_ABI, signer);
        const allow = await nexus.allowance(wallets[0].address, DATA_MINING_ADDRESS);
        if (allow < perBlock * BigInt(blocks.length)) {
          log("Approving NEXUS spend...");
          const atx = await nexus.approve(DATA_MINING_ADDRESS, ethers.MaxUint256);
          await atx.wait();
        }
        log(`Deploying ${agent.nexusPerRound} NEXUS × ${blocks.length} blocks`);
        const tx = await contract.deployNexus(blocks, perBlock);
        await tx.wait();
        log(`NEXUS deployed on blocks: [${blocks.join(", ")}]`);
      }

      setRoundsPlayed((p) => p + 1);
      log("Waiting for round to end...");
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message.slice(0, 80) : "Deploy failed";
      log(`ERROR: ${msg}`);
    }
  }, [agent, wallets, getContract, getProvider]);

  // Auto-settle and claim
  const checkAndSettle = useCallback(async () => {
    if (!agent.running || !agent.autoSettle) return;
    try {
      const contract = await getContract(true);
      const gs = await contract.getGameState();
      if (Number(gs[2]) === 0 && gs[3]) {
        log("Round ended. Settling...");
        const tx = await contract.settleRound();
        await tx.wait();
        log("Round settled!");

        if (agent.autoClaim) {
          const rid = Number(gs[0]);
          const info = await contract.getRoundInfo(rid);
          if (info[2] !== undefined) {
            try {
              const pd = await contract.getPlayerDeploy(rid, wallets[0].address);
              if (!pd[4]) {
                log(`Claiming round ${rid}...`);
                const ctx = await contract.claimRound(rid);
                await ctx.wait();
                const winBlock = Number(info[2]);
                const myBlocks = pd[0].map(Number);
                const won = myBlocks.includes(winBlock);
                if (won) {
                  setWins((w) => w + 1);
                  log(`WIN! Block ${winBlock} was in our picks!`);
                } else {
                  setLosses((l) => l + 1);
                  log(`LOSS. Winning block: ${winBlock}`);
                }
              }
            } catch { /* not deployed this round */ }
          }
        }
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message.slice(0, 80) : "Settle failed";
      log(`Settle error: ${msg}`);
    }
  }, [agent, wallets, getContract]);

  // Agent loop
  useEffect(() => {
    if (!agent.running) return;
    const iv = setInterval(() => {
      checkAndSettle();
    }, 15000);
    return () => clearInterval(iv);
  }, [agent.running, checkAndSettle]);

  // Start/stop agent
  const toggleAgent = () => {
    if (agent.running) {
      setAgent((a) => ({ ...a, running: false }));
      log("Agent STOPPED");
    } else {
      setAgent((a) => ({ ...a, running: true }));
      log("Agent STARTED with " + STRATEGIES[agent.strategy].name + " strategy");
      // Run first round immediately
      setTimeout(() => runAgentRound(), 500);
    }
  };

  // ---------------------------------------------------------------------------
  // NFT STAKING
  // ---------------------------------------------------------------------------
  const fetchOwnedNFTs = async () => {
    if (!wallets[0]) return;
    setLoadingNFTs(true);
    try {
      const provider = await getProvider();
      const addr = wallets[0].address;
      const nft = new ethers.Contract(NEXUS_AGENT_NFT_ADDRESS, [
        ...NFT_ABI,
        "function tokenURI(uint256) view returns (string)",
      ], provider);
      const balance = Number(await nft.balanceOf(addr));
      if (balance === 0) { setOwnedNFTs([]); setLoadingNFTs(false); return; }
      const totalMinted = Number(await nft.totalMinted());
      const found: Array<{ tokenId: number; tier: string; image: string }> = [];
      for (let i = 0; i < totalMinted && found.length < balance; i++) {
        try {
          const owner = await nft.ownerOf(i);
          if (owner.toLowerCase() === addr.toLowerCase()) {
            let tier = "Unknown", image = "";
            try {
              const uri = await nft.tokenURI(i);
              const res = await fetch(uri.replace("ipfs://", "https://ipfs.filebase.io/ipfs/"));
              const meta = await res.json();
              tier = meta.attributes?.find((a: { trait_type: string }) => a.trait_type === "Tier")?.value || "Unknown";
              image = meta.image?.replace("ipfs://", "https://ipfs.filebase.io/ipfs/") || "";
            } catch { /* skip */ }
            found.push({ tokenId: i, tier, image });
          }
        } catch { continue; }
      }
      setOwnedNFTs(found);
    } catch (e) { console.error(e); }
    setLoadingNFTs(false);
  };

  const handleStakeNFT = async (tokenId?: number) => {
    if (tokenId === undefined) {
      await fetchOwnedNFTs();
      setShowNFTSelector(true);
      return;
    }
    setLoading(true);
    setError("");
    setShowNFTSelector(false);
    try {
      const provider = await getProvider();
      const signer = await provider.getSigner();
      const addr = wallets[0].address;
      const nft = new ethers.Contract(NEXUS_AGENT_NFT_ADDRESS, NFT_ABI, signer);
      const isApproved = await nft.isApprovedForAll(addr, DATA_MINING_ADDRESS);
      if (!isApproved) {
        const atx = await nft.setApprovalForAll(DATA_MINING_ADDRESS, true);
        await atx.wait();
      }
      const contract = await getContract(true);
      const tx = await contract.stakeNFT(tokenId);
      await tx.wait();
      setSuccess(`Staked NFT #${tokenId}!`);
      log(`NFT #${tokenId} staked — multiplier active`);
      fetchData();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message.slice(0, 100) : "Stake failed");
    }
    setLoading(false);
  };

  const handleUnstakeNFT = async () => {
    setLoading(true);
    setError("");
    try {
      const contract = await getContract(true);
      const tx = await contract.unstakeNFT();
      await tx.wait();
      setSuccess("NFT unstaked!");
      log("NFT unstaked — multiplier removed");
      fetchData();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message.slice(0, 100) : "Unstake failed");
    }
    setLoading(false);
  };

  // Claim cooled tokens
  const handleClaimCooled = async () => {
    setLoading(true);
    setError("");
    try {
      const contract = await getContract(true);
      const tx = await contract.claimCooled();
      await tx.wait();
      setSuccess("Cooled NEXUS claimed!");
      log(`Claimed ${cooled} cooled NEXUS`);
      fetchData();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message.slice(0, 100) : "Claim failed");
    }
    setLoading(false);
  };

  // ---------------------------------------------------------------------------
  // RENDER
  // ---------------------------------------------------------------------------
  const box = "border border-border bg-bg/60 backdrop-blur-sm p-4 md:p-6";
  const tabs = ["deploy", "rewards", "staking", "stats"] as const;

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 font-mono">
      {/* Header */}
      <div className="text-center mb-8">
        <h1 className="text-2xl md:text-3xl font-serif tracking-[0.15em] text-fg mb-2">
          AI AGENT MINING
        </h1>
        <p className="text-[10px] tracking-[0.3em] text-fg-dim">
          DEPLOY AUTONOMOUS AGENTS TO MINE ETH + $NEXUS
        </p>
      </div>

      {!authenticated ? (
        <div className="text-center py-20">
          <p className="text-fg-dim mb-6 text-sm">Connect wallet to deploy your agent</p>
          <button onClick={login} className={`${box} px-8 py-3 hover:border-accent transition-colors cursor-pointer`}>
            CONNECT WALLET
          </button>
        </div>
      ) : (
        <>
          {/* Status Bar */}
          <div className={`${box} mb-6 flex flex-wrap gap-6 items-center justify-between`}>
            <div>
              <span className="text-[9px] text-fg-dim tracking-wider">ROUND</span>
              <p className="text-lg text-fg">{roundId}</p>
            </div>
            <div>
              <span className="text-[9px] text-fg-dim tracking-wider">TIME LEFT</span>
              <p className="text-lg text-accent">{timeLeft}s</p>
            </div>
            <div>
              <span className="text-[9px] text-fg-dim tracking-wider">ETH BALANCE</span>
              <p className="text-lg text-fg">{parseFloat(ethBalance).toFixed(6)}</p>
            </div>
            <div>
              <span className="text-[9px] text-fg-dim tracking-wider">$NEXUS</span>
              <p className="text-lg text-fg">{parseFloat(nexusBalance).toFixed(2)}</p>
            </div>
            <div>
              <span className="text-[9px] text-fg-dim tracking-wider">MULTIPLIER</span>
              <p className={`text-lg ${nftStaked ? "text-accent" : "text-fg-dim"}`}>{multiplier}</p>
            </div>
            <div>
              <span className="text-[9px] text-fg-dim tracking-wider">AGENT</span>
              <p className={`text-lg ${agent.running ? "text-green-400" : "text-fg-dim"}`}>
                {agent.running ? "RUNNING" : "STOPPED"}
              </p>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-0 mb-6 border-b border-border">
            {tabs.map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`px-6 py-3 text-[10px] tracking-[0.2em] transition-colors cursor-pointer ${
                  tab === t ? "text-fg border-b-2 border-accent" : "text-fg-dim hover:text-fg-muted"
                }`}
              >
                {t.toUpperCase()}
              </button>
            ))}
          </div>

          {/* Error/Success */}
          {error && <div className="mb-4 p-3 border border-red-500/30 text-red-400 text-xs">{error}</div>}
          {success && <div className="mb-4 p-3 border border-green-500/30 text-green-400 text-xs">{success}</div>}

          {/* ─── Deploy Tab ─── */}
          {tab === "deploy" && (
            <div className="grid md:grid-cols-2 gap-6">
              {/* Agent Config */}
              <div className={box}>
                <h3 className="text-xs tracking-[0.2em] text-fg-muted mb-4">AGENT CONFIGURATION</h3>

                {/* Strategy */}
                <div className="mb-4">
                  <label className="text-[9px] text-fg-dim tracking-wider block mb-2">STRATEGY</label>
                  <div className="grid grid-cols-2 gap-2">
                    {(Object.keys(STRATEGIES) as Strategy[]).map((s) => (
                      <button
                        key={s}
                        onClick={() => setAgent((a) => ({ ...a, strategy: s }))}
                        className={`p-3 text-left border transition-colors cursor-pointer ${
                          agent.strategy === s
                            ? "border-accent bg-accent/5"
                            : "border-border hover:border-border-hover"
                        }`}
                      >
                        <span className={`text-[10px] font-bold ${STRATEGIES[s].color}`}>
                          {STRATEGIES[s].name}
                        </span>
                        <p className="text-[8px] text-fg-dim mt-1">{STRATEGIES[s].desc}</p>
                        <p className="text-[8px] text-fg-muted mt-1">{STRATEGIES[s].blocks} blocks/round</p>
                      </button>
                    ))}
                  </div>
                </div>

                {/* ETH per round */}
                <div className="mb-3">
                  <label className="text-[9px] text-fg-dim tracking-wider block mb-1">
                    ETH PER BLOCK (per round)
                  </label>
                  <input
                    type="text"
                    value={agent.ethPerRound}
                    onChange={(e) => setAgent((a) => ({ ...a, ethPerRound: e.target.value }))}
                    className="w-full bg-transparent border border-border px-3 py-2 text-sm text-fg font-mono focus:border-accent outline-none"
                    disabled={agent.running}
                  />
                  <p className="text-[8px] text-fg-dim mt-1">
                    Total: {(parseFloat(agent.ethPerRound || "0") * STRATEGIES[agent.strategy].blocks).toFixed(6)} ETH
                  </p>
                </div>

                {/* NEXUS per round */}
                <div className="mb-4">
                  <label className="text-[9px] text-fg-dim tracking-wider block mb-1">
                    $NEXUS PER BLOCK (per round)
                  </label>
                  <input
                    type="text"
                    value={agent.nexusPerRound}
                    onChange={(e) => setAgent((a) => ({ ...a, nexusPerRound: e.target.value }))}
                    className="w-full bg-transparent border border-border px-3 py-2 text-sm text-fg font-mono focus:border-accent outline-none"
                    disabled={agent.running}
                  />
                </div>

                {/* Toggles */}
                <div className="flex gap-4 mb-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={agent.autoSettle}
                      onChange={(e) => setAgent((a) => ({ ...a, autoSettle: e.target.checked }))}
                      disabled={agent.running}
                      className="accent-accent"
                    />
                    <span className="text-[9px] text-fg-dim">AUTO-SETTLE</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={agent.autoClaim}
                      onChange={(e) => setAgent((a) => ({ ...a, autoClaim: e.target.checked }))}
                      disabled={agent.running}
                      className="accent-accent"
                    />
                    <span className="text-[9px] text-fg-dim">AUTO-CLAIM</span>
                  </label>
                </div>

                {/* Start/Stop */}
                <button
                  onClick={toggleAgent}
                  disabled={loading}
                  className={`w-full py-3 text-xs tracking-[0.2em] border transition-all cursor-pointer ${
                    agent.running
                      ? "border-red-500/50 text-red-400 hover:bg-red-500/10"
                      : "border-accent text-accent hover:bg-accent/10"
                  }`}
                >
                  {agent.running ? "STOP AGENT" : "START AGENT"}
                </button>
              </div>

              {/* Agent Log */}
              <div className={box}>
                <h3 className="text-xs tracking-[0.2em] text-fg-muted mb-4">AGENT LOG</h3>
                <div className="h-[400px] overflow-y-auto space-y-1 text-[9px]">
                  {agentLog.length === 0 ? (
                    <p className="text-fg-dim">Start the agent to see activity...</p>
                  ) : (
                    agentLog.map((line, i) => (
                      <p
                        key={i}
                        className={`font-mono ${
                          line.includes("WIN") ? "text-green-400" :
                          line.includes("LOSS") ? "text-red-400" :
                          line.includes("ERROR") ? "text-red-400" :
                          line.includes("STARTED") ? "text-accent" :
                          line.includes("STOPPED") ? "text-orange-400" :
                          "text-fg-dim"
                        }`}
                      >
                        {line}
                      </p>
                    ))
                  )}
                </div>

                {/* Quick stats */}
                <div className="mt-4 pt-4 border-t border-border grid grid-cols-3 gap-4 text-center">
                  <div>
                    <span className="text-[8px] text-fg-dim">ROUNDS</span>
                    <p className="text-sm text-fg">{roundsPlayed}</p>
                  </div>
                  <div>
                    <span className="text-[8px] text-fg-dim">WINS</span>
                    <p className="text-sm text-green-400">{wins}</p>
                  </div>
                  <div>
                    <span className="text-[8px] text-fg-dim">LOSSES</span>
                    <p className="text-sm text-red-400">{losses}</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ─── Rewards Tab ─── */}
          {tab === "rewards" && (
            <div className="grid md:grid-cols-2 gap-6">
              <div className={box}>
                <h3 className="text-xs tracking-[0.2em] text-fg-muted mb-4">UNCOOLED $NEXUS</h3>
                <p className="text-[8px] text-fg-dim mb-2">
                  Newly earned tokens. Must cool for 10 rounds before claiming (10% early exit fee).
                </p>
                <p className="text-3xl text-accent mb-4">{parseFloat(uncooled).toFixed(4)}</p>
                <div className="w-full bg-border/30 h-1 mb-2">
                  <div className="bg-accent/50 h-1" style={{ width: "60%" }} />
                </div>
                <p className="text-[8px] text-fg-dim">Cooling progress...</p>
              </div>

              <div className={box}>
                <h3 className="text-xs tracking-[0.2em] text-fg-muted mb-4">COOLED $NEXUS</h3>
                <p className="text-[8px] text-fg-dim mb-2">
                  Ready to claim. No fee — these tokens are fully matured.
                </p>
                <p className="text-3xl text-green-400 mb-4">{parseFloat(cooled).toFixed(4)}</p>
                <button
                  onClick={handleClaimCooled}
                  disabled={loading || parseFloat(cooled) === 0}
                  className="w-full py-3 text-xs tracking-[0.2em] border border-green-500/50 text-green-400 hover:bg-green-500/10 transition-all cursor-pointer disabled:opacity-30"
                >
                  CLAIM {parseFloat(cooled).toFixed(2)} $NEXUS
                </button>
              </div>

              <div className={`${box} md:col-span-2`}>
                <h3 className="text-xs tracking-[0.2em] text-fg-muted mb-4">HOW REWARDS WORK</h3>
                <div className="grid md:grid-cols-3 gap-4 text-[9px] text-fg-dim">
                  <div className="p-3 border border-border">
                    <p className="text-accent text-[10px] mb-2">1. WIN ETH</p>
                    <p>Deploy ETH on blocks. If your block wins, you take all losers' ETH (proportional to your stake).</p>
                  </div>
                  <div className="p-3 border border-border">
                    <p className="text-accent text-[10px] mb-2">2. EARN $NEXUS</p>
                    <p>Every round emits 1 NEXUS split among winners. NFT stakers get a bigger share via multiplier.</p>
                  </div>
                  <div className="p-3 border border-border">
                    <p className="text-accent text-[10px] mb-2">3. COOL & CLAIM</p>
                    <p>NEXUS goes to uncooled balance first. After 10 rounds it becomes cooled and claimable.</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ─── Staking Tab ─── */}
          {tab === "staking" && (
            <div className="grid md:grid-cols-2 gap-6">
              <div className={box}>
                <h3 className="text-xs tracking-[0.2em] text-fg-muted mb-4">NFT STAKING</h3>
                <p className="text-[8px] text-fg-dim mb-4">
                  Stake your Nexus Node NFT to boost NEXUS emission multiplier and access vault jackpots.
                </p>

                {nftStaked ? (
                  <div>
                    <div className="p-4 border border-accent/30 bg-accent/5 mb-4">
                      <p className="text-accent text-sm mb-1">NFT STAKED</p>
                      <p className="text-2xl text-fg">{multiplier}</p>
                      <p className="text-[8px] text-fg-dim mt-1">EMISSION MULTIPLIER ACTIVE</p>
                    </div>
                    <button
                      onClick={handleUnstakeNFT}
                      disabled={loading}
                      className="w-full py-3 text-xs tracking-[0.2em] border border-border text-fg-dim hover:border-red-500/50 hover:text-red-400 transition-all cursor-pointer"
                    >
                      UNSTAKE NFT
                    </button>
                  </div>
                ) : (
                  <div>
                    <div className="p-4 border border-border mb-4">
                      <p className="text-fg-dim text-sm mb-1">NO NFT STAKED</p>
                      <p className="text-2xl text-fg-dim">1.0x</p>
                      <p className="text-[8px] text-fg-dim mt-1">BASE MULTIPLIER</p>
                    </div>
                    {hasNFT ? (
                      <>
                        <button
                          onClick={() => handleStakeNFT()}
                          disabled={loading || loadingNFTs}
                          className="w-full py-3 text-xs tracking-[0.2em] border border-accent text-accent hover:bg-accent/10 transition-all cursor-pointer disabled:opacity-30"
                        >
                          {loadingNFTs ? "SCANNING NFTs..." : loading ? "STAKING..." : "SELECT NFT TO STAKE"}
                        </button>
                        {showNFTSelector && ownedNFTs.length > 0 && (
                          <div className="mt-3 space-y-2">
                            {ownedNFTs.map((n) => (
                              <button
                                key={n.tokenId}
                                onClick={() => handleStakeNFT(n.tokenId)}
                                disabled={loading}
                                className="w-full flex items-center gap-3 p-3 border border-border hover:border-accent/50 transition-colors cursor-pointer disabled:opacity-30"
                              >
                                {n.image && <img src={n.image} alt={`#${n.tokenId}`} className="w-10 h-10 rounded object-cover" />}
                                <div className="text-left">
                                  <p className="text-[10px] text-fg">Nexus Node #{n.tokenId}</p>
                                  <p className={`text-[9px] ${n.tier === "Ultra-Rare" ? "text-green-400" : n.tier === "Rare" ? "text-accent" : "text-fg-muted"}`}>
                                    {n.tier} — {n.tier === "Ultra-Rare" ? "2.5x" : n.tier === "Rare" ? "1.8x" : "1.3x"} boost
                                  </p>
                                </div>
                              </button>
                            ))}
                            <button onClick={() => setShowNFTSelector(false)} className="w-full py-1 text-[8px] text-fg-dim hover:text-fg cursor-pointer">CANCEL</button>
                          </div>
                        )}
                      </>
                    ) : (
                      <a
                        href="/mint"
                        className={`block text-center w-full py-3 text-xs tracking-[0.2em] border border-border text-fg-dim hover:text-accent transition-colors`}
                      >
                        MINT NFT FIRST →
                      </a>
                    )}
                  </div>
                )}
              </div>

              <div className={box}>
                <h3 className="text-xs tracking-[0.2em] text-fg-muted mb-4">MULTIPLIER TIERS</h3>
                <div className="space-y-3">
                  {[
                    { tier: "COMMON", mult: "1.3x", color: "text-fg-muted", count: 529 },
                    { tier: "RARE", mult: "1.8x", color: "text-accent", count: 200 },
                    { tier: "ULTRA-RARE", mult: "2.5x", color: "text-green-400", count: 49 },
                  ].map((r) => (
                    <div key={r.tier} className="flex items-center justify-between p-3 border border-border">
                      <div>
                        <span className={`text-[10px] ${r.color}`}>{r.tier}</span>
                        <p className="text-[8px] text-fg-dim">{r.count} NFTs</p>
                      </div>
                      <span className={`text-lg ${r.color}`}>{r.mult}</span>
                    </div>
                  ))}
                </div>
                <p className="text-[8px] text-fg-dim mt-4">
                  Multiplier applies to NEXUS emission share only. ETH winnings are always proportional to your stake.
                </p>
              </div>
            </div>
          )}

          {/* ─── Stats Tab ─── */}
          {tab === "stats" && (
            <div className="grid md:grid-cols-3 gap-6">
              <div className={box}>
                <span className="text-[9px] text-fg-dim tracking-wider">TOTAL ROUNDS</span>
                <p className="text-3xl text-fg mt-2">{totalRounds}</p>
              </div>
              <div className={box}>
                <span className="text-[9px] text-fg-dim tracking-wider">YOUR WIN RATE</span>
                <p className="text-3xl text-accent mt-2">
                  {roundsPlayed > 0 ? ((wins / roundsPlayed) * 100).toFixed(1) : "0.0"}%
                </p>
              </div>
              <div className={box}>
                <span className="text-[9px] text-fg-dim tracking-wider">GAME STATUS</span>
                <p className={`text-3xl mt-2 ${gameActive ? "text-green-400" : "text-red-400"}`}>
                  {gameActive ? "ACTIVE" : "PAUSED"}
                </p>
              </div>
              <div className={box}>
                <span className="text-[9px] text-fg-dim tracking-wider">UNCOOLED NEXUS</span>
                <p className="text-2xl text-accent mt-2">{parseFloat(uncooled).toFixed(4)}</p>
              </div>
              <div className={box}>
                <span className="text-[9px] text-fg-dim tracking-wider">COOLED NEXUS</span>
                <p className="text-2xl text-green-400 mt-2">{parseFloat(cooled).toFixed(4)}</p>
              </div>
              <div className={box}>
                <span className="text-[9px] text-fg-dim tracking-wider">ETH BALANCE</span>
                <p className="text-2xl text-fg mt-2">{parseFloat(ethBalance).toFixed(6)}</p>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
