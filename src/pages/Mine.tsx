import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { usePrivy, useWallets } from "@privy-io/react-auth";
import { ethers } from "ethers";
import {
  DATA_MINING_ADDRESS,
  NEXUS_TOKEN_ADDRESS,
  NEXUS_AGENT_NFT_ADDRESS,
  CHAIN_ID,
} from "@/lib/contracts";

const MINING_ABI = [
  "function deployETH(uint8[] blocks) external payable",
  "function deployNexus(uint8[] blocks, uint256 perBlock) external",
  "function settleRound() external",
  "function claimRound(uint256 roundId) external",
  "function claimCooled() external",
  "function stakeNFT(uint256 tokenId) external",
  "function unstakeNFT() external",
  "function getGameState() external view returns (uint256 roundId, uint256 startTime, uint256 timeRemaining, bool active, uint256 vault, uint256 rewards)",
  "function getRoundInfo(uint256 roundId) external view returns (uint256 totalETH, uint256 totalNexus, uint8 winningBlock, bool settled, bool vaultTriggered)",
  "function getBlockDeployments(uint256 roundId) external view returns (uint256[25] ethBlocks, uint256[25] nexusBlocks)",
  "function getPlayerDeploy(uint256 roundId, address player) external view returns (uint8[] ethBlocks, uint256 ethPerBlock, uint8[] nexusBlocks, uint256 nexusPerBlock, bool claimed)",
  "function getMultiplier(address player) external view returns (uint256)",
  "function getPlayerRarity(address player) external view returns (uint8)",
  "function uncooledBalance(address) external view returns (uint256)",
  "function cooledBalance(address) external view returns (uint256)",
  "function nexusVault() external view returns (uint256)",
  "function currentRoundId() external view returns (uint256)",
  "function hasStakedNFT(address) external view returns (bool)",
  "function totalRoundsPlayed() external view returns (uint256)",
  "function totalETHFees() external view returns (uint256)",
  "function totalNexusBurned() external view returns (uint256)",
];

const NEXUS_ABI = [
  "function approve(address spender, uint256 amount) external returns (bool)",
  "function allowance(address owner, address spender) external view returns (uint256)",
  "function balanceOf(address) external view returns (uint256)",
];

const RARITY_NAMES = ["NONE", "COMMON", "RARE", "ULTRA RARE"];
const RARITY_COLORS = ["text-fg-dim", "text-fg-muted", "text-accent", "text-success"];
const MULT_DISPLAY = ["1.0x", "1.3x", "1.8x", "2.5x"];

// ---------------------------------------------------------------------------
// COMPONENT
// ---------------------------------------------------------------------------
export default function Mine() {
  const { authenticated, login } = usePrivy();
  const { wallets } = useWallets();

  // Game state
  const [roundId, setRoundId] = useState(0);
  const [timeLeft, setTimeLeft] = useState(60);
  const [gameActive, setGameActive] = useState(false);
  const roundEndTimeRef = useRef<number>(0); // epoch seconds when round ends
  const [vaultAmount, setVaultAmount] = useState("0");
  const [totalRounds, setTotalRounds] = useState(0);
  const [totalFees, setTotalFees] = useState("0");
  const [totalBurned, setTotalBurned] = useState("0");

  // Grid state
  const [selectedBlocks, setSelectedBlocks] = useState<Set<number>>(new Set());
  const [blockDeploymentsETH, setBlockDeploymentsETH] = useState<string[]>(Array(25).fill("0"));
  const [blockDeploymentsNexus, setBlockDeploymentsNexus] = useState<string[]>(Array(25).fill("0"));
  const [winningBlock, setWinningBlock] = useState<number | null>(null);
  const [roundSettled, setRoundSettled] = useState(false);
  const [vaultTriggered, setVaultTriggered] = useState(false);

  // Player state
  const [currency, setCurrency] = useState<"ETH" | "NEXUS">("ETH");
  const [amount, setAmount] = useState("");
  const [deployed, setDeployed] = useState(false);
  const [playerRarity, setPlayerRarity] = useState(0);
  const [playerMult, setPlayerMult] = useState("1.0x");
  const [hasNFTStaked, setHasNFTStaked] = useState(false);
  const [uncooled, setUncooled] = useState("0");
  const [cooled, setCooled] = useState("0");
  const [nexusBalance, setNexusBalance] = useState("0");

  // NFT selector state
  const [ownedNFTs, setOwnedNFTs] = useState<Array<{ tokenId: number; tier: string; image: string }>>([]);
  const [selectedNFTId, setSelectedNFTId] = useState<number | null>(null);
  const [showNFTSelector, setShowNFTSelector] = useState(false);
  const [loadingNFTs, setLoadingNFTs] = useState(false);

  // Round tracking
  const autoSettling = false; // Settlement handled by VPS agent
  const [prevRoundId, setPrevRoundId] = useState(0);

  // UI state
  const [tab, setTab] = useState<"play" | "rewards" | "stats">("play");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // History of recent rounds
  const [recentRounds, setRecentRounds] = useState<Array<{
    id: number; winBlock: number; totalETH: string; totalNexus: string; vaultTriggered: boolean;
  }>>([]);

  // Accumulated unclaimed rounds
  const [unclaimedRounds, setUnclaimedRounds] = useState<Array<{
    id: number; wonETH: boolean; wonNexus: boolean;
  }>>([]);
  const [claimingAll, setClaimingAll] = useState(false);

  // ---------------------------------------------------------------------------
  // CONTRACT HELPERS
  // ---------------------------------------------------------------------------
  const getProvider = useCallback(async () => {
    const wallet = wallets[0];
    if (!wallet) throw new Error("No wallet");
    await wallet.switchChain(CHAIN_ID);
    const ethereumProvider = await wallet.getEthereumProvider();
    return new ethers.BrowserProvider(ethereumProvider);
  }, [wallets]);

  const getMiningContract = useCallback(async (withSigner = false) => {
    const provider = await getProvider();
    const signerOrProvider = withSigner ? await provider.getSigner() : provider;
    return new ethers.Contract(DATA_MINING_ADDRESS, MINING_ABI, signerOrProvider);
  }, [getProvider]);

  const getNexusContract = useCallback(async (withSigner = false) => {
    const provider = await getProvider();
    const signerOrProvider = withSigner ? await provider.getSigner() : provider;
    return new ethers.Contract(NEXUS_TOKEN_ADDRESS, NEXUS_ABI, signerOrProvider);
  }, [getProvider]);

  // ---------------------------------------------------------------------------
  // POLL GAME STATE
  // ---------------------------------------------------------------------------
  const fetchGameState = useCallback(async () => {
    if (!DATA_MINING_ADDRESS || !wallets[0]) return;
    try {
      const contract = await getMiningContract();
      const [rId, startTime, timeRem, active, vault, ] = await contract.getGameState();
      setRoundId(Number(rId));
      setGameActive(active);

      // Use chain startTime to compute a stable end time (no jitter from RPC latency)
      // roundEndTime = startTime + 60 (ROUND_DURATION) — this is constant for a given round
      const chainStartTime = Number(startTime);
      const roundEndTime = chainStartTime + 60;
      roundEndTimeRef.current = roundEndTime;
      // Derive timeLeft from local clock vs chain end time
      const now = Math.floor(Date.now() / 1000);
      setTimeLeft(Math.max(0, roundEndTime - now));
      setVaultAmount(ethers.formatEther(vault));

      const totalR = await contract.totalRoundsPlayed();
      setTotalRounds(Number(totalR));
      const fees = await contract.totalETHFees();
      setTotalFees(ethers.formatEther(fees));
      const burned = await contract.totalNexusBurned();
      setTotalBurned(ethers.formatEther(burned));

      // Block deployments for current round
      if (Number(rId) > 0) {
        const [ethBlocks, nexusBlocks] = await contract.getBlockDeployments(rId);
        setBlockDeploymentsETH(ethBlocks.map((b: bigint) => ethers.formatEther(b)));
        setBlockDeploymentsNexus(nexusBlocks.map((b: bigint) => ethers.formatEther(b)));

        const info = await contract.getRoundInfo(rId);
        setRoundSettled(info.settled);
        if (info.settled) {
          setWinningBlock(Number(info.winningBlock));
          setVaultTriggered(info.vaultTriggered);
        } else {
          setWinningBlock(null);
          setVaultTriggered(false);
        }
      }

      // Player state
      const addr = wallets[0].address;
      const rarity = await contract.getPlayerRarity(addr);
      setPlayerRarity(Number(rarity));
      setPlayerMult(MULT_DISPLAY[Number(rarity)] || "1.0x");
      const staked = await contract.hasStakedNFT(addr);
      setHasNFTStaked(staked);
      const unc = await contract.uncooledBalance(addr);
      setUncooled(ethers.formatEther(unc));
      const cool = await contract.cooledBalance(addr);
      setCooled(ethers.formatEther(cool));

      // NEXUS balance
      if (NEXUS_TOKEN_ADDRESS) {
        const nexus = await getNexusContract();
        const bal = await nexus.balanceOf(addr);
        setNexusBalance(ethers.formatEther(bal));
      }
    } catch (e) {
      console.error("fetchGameState error:", e);
    }
  }, [wallets, getMiningContract, getNexusContract]);

  // Poll faster when waiting for settlement (1s), normal pace otherwise (3s)
  useEffect(() => {
    fetchGameState();
    const pollInterval = (timeLeft === 0 && gameActive && !roundSettled) ? 1000 : 3000;
    const interval = setInterval(fetchGameState, pollInterval);
    return () => clearInterval(interval);
  }, [fetchGameState, timeLeft === 0 && gameActive && !roundSettled]);

  // Countdown timer — derives from roundEndTimeRef for smooth ticking
  useEffect(() => {
    if (!gameActive) return;
    const timer = setInterval(() => {
      const now = Math.floor(Date.now() / 1000);
      const remaining = Math.max(0, roundEndTimeRef.current - now);
      setTimeLeft(remaining);
    }, 1000);
    return () => clearInterval(timer);
  }, [gameActive]);

  // Settlement is handled by VPS agent (agent.js) — no frontend settle calls needed.
  // Frontend just polls game state every 5s and detects when round is settled.

  // New round detected — reset state instantly (no buffer delay)
  useEffect(() => {
    if (roundId > 0 && roundId !== prevRoundId && prevRoundId > 0) {
      setDeployed(false);
      setSelectedBlocks(new Set());
      setWinningBlock(null);
      setVaultTriggered(false);
      setSuccess("");
      setError("");
    }
    setPrevRoundId(roundId);
  }, [roundId, prevRoundId]);

  // ---------------------------------------------------------------------------
  // ACTIONS
  // ---------------------------------------------------------------------------
  const canInteract = timeLeft > 0 && !deployed && !roundSettled && !autoSettling;

  const toggleBlock = (idx: number) => {
    if (!canInteract) return;
    setSelectedBlocks((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  const selectAllBlocks = () => {
    if (!canInteract) return;
    setSelectedBlocks(new Set(Array.from({ length: 25 }, (_, i) => i)));
  };

  const clearBlocks = () => {
    if (!canInteract) return;
    setSelectedBlocks(new Set());
  };

  const handleDeploy = async () => {
    if (selectedBlocks.size === 0 || !amount) return;
    setLoading(true);
    setError("");
    setSuccess("");

    try {
      const contract = await getMiningContract(true);
      const blocks = Array.from(selectedBlocks);

      if (currency === "ETH") {
        const perBlock = ethers.parseEther(amount);
        const total = perBlock * BigInt(blocks.length);
        const tx = await contract.deployETH(blocks, { value: total });
        await tx.wait();
      } else {
        const perBlock = ethers.parseEther(amount);
        // Approve if needed
        const nexus = await getNexusContract(true);
        const total = perBlock * BigInt(blocks.length);
        const allowance = await nexus.allowance(wallets[0].address, DATA_MINING_ADDRESS);
        if (allowance < total) {
          const approveTx = await nexus.approve(DATA_MINING_ADDRESS, ethers.MaxUint256);
          await approveTx.wait();
        }
        const tx = await contract.deployNexus(blocks, perBlock);
        await tx.wait();
      }

      setDeployed(true);
      setSuccess(`Deployed ${amount} ${currency} on ${blocks.length} blocks!`);
      fetchGameState();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message.slice(0, 100) : "Deploy failed");
    }
    setLoading(false);
  };

  // Settlement is server-side only — no handleSettle needed

  const handleClaimCooled = async () => {
    setLoading(true);
    setError("");
    try {
      const contract = await getMiningContract(true);
      const tx = await contract.claimCooled();
      await tx.wait();
      setSuccess("Claimed cooling rewards!");
      fetchGameState();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message.slice(0, 100) : "Claim failed");
    }
    setLoading(false);
  };

  const handleClaimRound = async (rid: number) => {
    setLoading(true);
    setError("");
    try {
      const contract = await getMiningContract(true);
      const tx = await contract.claimRound(rid);
      await tx.wait();
      setSuccess(`Claimed round ${rid} winnings!`);
      fetchGameState();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message.slice(0, 100) : "Claim failed");
    }
    setLoading(false);
  };

  // Scan for unclaimed winning rounds
  const fetchUnclaimedRounds = useCallback(async () => {
    if (!wallets[0] || roundId <= 0) return;
    try {
      const contract = await getMiningContract();
      const addr = wallets[0].address;
      const unclaimed: Array<{ id: number; wonETH: boolean; wonNexus: boolean }> = [];
      // Scan last 50 rounds (or all if fewer)
      const startRound = Math.max(1, roundId - 50);
      for (let rid = startRound; rid <= roundId; rid++) {
        try {
          const info = await contract.getRoundInfo(rid);
          if (!info.settled) continue;
          const playerDeploy = await contract.getPlayerDeploy(rid, addr);
          if (playerDeploy.claimed) continue;
          // Check if player deployed on winning block
          const winBlock = Number(info.winningBlock);
          const ethBlocks: number[] = playerDeploy.ethBlocks.map((b: bigint | number) => Number(b));
          const nexusBlocks: number[] = playerDeploy.nexusBlocks.map((b: bigint | number) => Number(b));
          const wonETH = ethBlocks.includes(winBlock) && Number(playerDeploy.ethPerBlock) > 0;
          const wonNexus = nexusBlocks.includes(winBlock) && Number(playerDeploy.nexusPerBlock) > 0;
          // Only if they actually deployed in this round
          if (ethBlocks.length > 0 || nexusBlocks.length > 0) {
            unclaimed.push({ id: rid, wonETH, wonNexus });
          }
        } catch { continue; }
      }
      setUnclaimedRounds(unclaimed);
    } catch (e) {
      console.error("fetchUnclaimedRounds error:", e);
    }
  }, [wallets, roundId, getMiningContract]);

  // Fetch unclaimed rounds when tab changes to rewards or when roundId changes
  useEffect(() => {
    if (tab === "rewards") fetchUnclaimedRounds();
  }, [tab, roundId, fetchUnclaimedRounds]);

  // Claim all unclaimed rounds in sequence
  const handleClaimAllRounds = async () => {
    if (unclaimedRounds.length === 0) return;
    setClaimingAll(true);
    setError("");
    setSuccess("");
    try {
      const contract = await getMiningContract(true);
      let claimed = 0;
      for (const round of unclaimedRounds) {
        try {
          const tx = await contract.claimRound(round.id);
          await tx.wait();
          claimed++;
        } catch { /* skip failed claims */ }
      }
      setSuccess(`Claimed ${claimed} round${claimed !== 1 ? "s" : ""}!`);
      fetchGameState();
      fetchUnclaimedRounds();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message.slice(0, 100) : "Claim failed");
    }
    setClaimingAll(false);
  };

  // Scan for all NFTs owned by user
  const fetchOwnedNFTs = async () => {
    if (!wallets[0]) return;
    setLoadingNFTs(true);
    try {
      const provider = await getProvider();
      const addr = wallets[0].address;
      const nft = new ethers.Contract(NEXUS_AGENT_NFT_ADDRESS, [
        "function balanceOf(address) view returns (uint256)",
        "function ownerOf(uint256) view returns (address)",
        "function totalMinted() view returns (uint256)",
        "function tokenURI(uint256) view returns (string)",
      ], provider);
      const balance = Number(await nft.balanceOf(addr));
      if (balance === 0) {
        setOwnedNFTs([]);
        setLoadingNFTs(false);
        return;
      }
      const totalMinted = Number(await nft.totalMinted());
      const found: Array<{ tokenId: number; tier: string; image: string }> = [];
      for (let i = 0; i < totalMinted && found.length < balance; i++) {
        try {
          const owner = await nft.ownerOf(i);
          if (owner.toLowerCase() === addr.toLowerCase()) {
            // Fetch metadata to get tier
            let tier = "Unknown";
            let image = "";
            try {
              const uri = await nft.tokenURI(i);
              const metaUrl = uri.replace("ipfs://", "https://ipfs.filebase.io/ipfs/");
              const res = await fetch(metaUrl);
              const meta = await res.json();
              const tierAttr = meta.attributes?.find((a: { trait_type: string }) => a.trait_type === "Tier");
              tier = tierAttr?.value || "Unknown";
              image = meta.image?.replace("ipfs://", "https://ipfs.filebase.io/ipfs/") || "";
            } catch { /* skip metadata errors */ }
            found.push({ tokenId: i, tier, image });
          }
        } catch { continue; }
      }
      setOwnedNFTs(found);
      if (found.length === 1) setSelectedNFTId(found[0].tokenId);
    } catch (e) {
      console.error("Failed to fetch NFTs:", e);
    }
    setLoadingNFTs(false);
  };

  const handleStakeNFT = async (tokenId?: number) => {
    const stakeId = tokenId ?? selectedNFTId;
    if (stakeId === null || stakeId === undefined) {
      // Show selector first
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
      const nft = new ethers.Contract(NEXUS_AGENT_NFT_ADDRESS, [
        "function setApprovalForAll(address, bool) external",
        "function isApprovedForAll(address, address) view returns (bool)",
      ], signer);
      // Approve DataMining contract
      const isApproved = await nft.isApprovedForAll(addr, DATA_MINING_ADDRESS);
      if (!isApproved) {
        const approveTx = await nft.setApprovalForAll(DATA_MINING_ADDRESS, true);
        await approveTx.wait();
      }
      // Stake
      const contract = await getMiningContract(true);
      const tx = await contract.stakeNFT(stakeId);
      await tx.wait();
      setSuccess(`Staked NFT #${stakeId}!`);
      setSelectedNFTId(null);
      fetchGameState();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message.slice(0, 100) : "Stake failed");
    }
    setLoading(false);
  };

  const handleUnstakeNFT = async () => {
    setLoading(true);
    setError("");
    try {
      const contract = await getMiningContract(true);
      const tx = await contract.unstakeNFT();
      await tx.wait();
      setSuccess("NFT unstaked!");
      fetchGameState();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message.slice(0, 100) : "Unstake failed");
    }
    setLoading(false);
  };

  // ---------------------------------------------------------------------------
  // RENDER
  // ---------------------------------------------------------------------------
  const formatNum = (n: string, decimals = 4) => {
    const f = parseFloat(n);
    return f === 0 ? "0" : f < 0.0001 ? "<0.0001" : f.toFixed(decimals);
  };

  return (
    <div className="min-h-screen px-4 md:px-16 lg:px-24 py-20">
      <div className="max-w-[1200px] mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="mb-10"
        >
          <p className="font-mono text-[10px] tracking-widest text-fg-dim mb-3">
            [DATA_MINING]
          </p>
          <h1 className="text-4xl md:text-6xl font-light tracking-tight text-fg mb-3">
            Mine
          </h1>
          <p className="text-sm text-fg-muted max-w-xl">
            Deploy ETH or $NEXUS on the 5×5 grid. One block wins each round.
            Winners take the losers' funds. NFT holders earn multiplied payouts.
          </p>
        </motion.div>

        {/* Top Stats Bar */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.5 }}
          className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8"
        >
          <StatBox label="ROUND" value={`#${roundId}`} />
          <StatBox
            label="NEXUS VAULT"
            value={`${formatNum(vaultAmount, 1)} NEXUS`}
            accent
          />
          <StatBox label="YOUR MULTIPLIER" value={playerMult} />
          <StatBox
            label="STATUS"
            value={gameActive ? (timeLeft > 0 ? "DEPLOYING" : "SETTLING") : "PAUSED"}
            live={gameActive}
          />
        </motion.div>

        {/* Timer */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="text-center mb-6"
        >
          <p className="font-mono text-[10px] tracking-widest text-fg-dim mb-1">
            {timeLeft > 0
              ? "ROUND ENDS IN"
              : roundSettled
                ? "ROUND COMPLETE"
                : "SETTLING ROUND..."
            }
          </p>
          <p className={`font-mono text-4xl md:text-5xl font-light ${
            timeLeft <= 10 && timeLeft > 0
              ? "text-error"
              : timeLeft === 0 && !roundSettled
                ? "text-orange-400 animate-pulse"
                : "text-accent"
          }`}>
            {`${String(Math.floor(timeLeft / 60)).padStart(2, "0")}:${String(timeLeft % 60).padStart(2, "0")}`}
          </p>
        </motion.div>

        {/* Tabs */}
        <div className="flex gap-6 mb-6 border-b border-border">
          {(["play", "rewards", "stats"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`pb-3 px-1 text-[10px] font-mono tracking-widest transition-colors cursor-pointer ${
                tab === t ? "text-fg border-b border-accent" : "text-fg-dim hover:text-fg-muted"
              }`}
            >
              {t.toUpperCase()}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <AnimatePresence mode="wait">
          {tab === "play" && (
            <motion.div
              key="play"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
            >
              {!authenticated ? (
                <div className="text-center py-20">
                  <p className="text-fg-muted mb-4">Connect your wallet to play</p>
                  <button
                    onClick={login}
                    className="px-8 py-3 border border-accent text-accent text-[10px] font-mono tracking-widest hover:bg-accent/10 transition-colors cursor-pointer"
                  >
                    CONNECT WALLET
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-8">
                  {/* 5x5 Grid */}
                  <div>
                    <div className="grid grid-cols-5 gap-2 max-w-[500px] mx-auto lg:mx-0">
                      {Array.from({ length: 25 }, (_, i) => {
                        const isSelected = selectedBlocks.has(i) && !deployed;
                        const isWinner = winningBlock === i && roundSettled;
                        const ethDep = parseFloat(blockDeploymentsETH[i] || "0");
                        const nexDep = parseFloat(blockDeploymentsNexus[i] || "0");
                        const hasDeployments = ethDep > 0 || nexDep > 0;
                        const isDisabled = !canInteract;

                        return (
                          <motion.button
                            key={i}
                            onClick={() => toggleBlock(i)}
                            whileHover={canInteract ? { scale: 1.05 } : {}}
                            whileTap={canInteract ? { scale: 0.95 } : {}}
                            className={`
                              aspect-square rounded-md border transition-all duration-200 flex flex-col items-center justify-center gap-1 relative
                              ${isDisabled && !isWinner ? "opacity-60 cursor-default" : "cursor-pointer"}
                              ${isWinner
                                ? "border-accent bg-accent/20 ring-2 ring-accent shadow-[0_0_30px_rgba(200,170,100,0.4)] z-10"
                                : isSelected
                                  ? "border-accent bg-accent/10"
                                  : hasDeployments
                                    ? "border-border bg-bg-elevated/50"
                                    : "border-border/50 bg-bg-card hover:border-border"
                              }
                            `}
                          >
                            <span className="font-mono text-[9px] text-fg-dim">
                              {String(i + 1).padStart(2, "0")}
                            </span>
                            {hasDeployments && (
                              <>
                                {ethDep > 0 && (
                                  <span className="font-mono text-[8px] text-fg-muted">
                                    {ethDep < 0.001 ? "<.001" : ethDep.toFixed(3)}Ξ
                                  </span>
                                )}
                                {nexDep > 0 && (
                                  <span className="font-mono text-[8px] text-accent">
                                    {nexDep < 1 ? "<1" : Math.floor(nexDep)}N
                                  </span>
                                )}
                              </>
                            )}
                            {isWinner && (
                              <>
                                <span className="absolute -top-1 -right-1 w-4 h-4 bg-accent rounded-full animate-pulse" />
                                <span className="absolute -bottom-2 left-1/2 -translate-x-1/2 bg-accent text-bg text-[7px] font-bold px-1.5 py-0.5 rounded tracking-wider">
                                  WINNER
                                </span>
                              </>
                            )}
                          </motion.button>
                        );
                      })}
                    </div>

                    {/* Quick Actions under grid */}
                    <div className="flex gap-3 mt-4 max-w-[500px] mx-auto lg:mx-0">
                      <button
                        onClick={selectAllBlocks}
                        disabled={deployed}
                        className="flex-1 py-2 text-[9px] font-mono tracking-widest border border-border text-fg-dim hover:text-fg-muted hover:border-border transition-colors cursor-pointer disabled:opacity-30"
                      >
                        SELECT ALL (25)
                      </button>
                      <button
                        onClick={clearBlocks}
                        disabled={deployed}
                        className="flex-1 py-2 text-[9px] font-mono tracking-widest border border-border text-fg-dim hover:text-fg-muted hover:border-border transition-colors cursor-pointer disabled:opacity-30"
                      >
                        CLEAR
                      </button>
                    </div>
                  </div>

                  {/* Controls Panel */}
                  <div className="space-y-4">
                    {/* Currency Toggle */}
                    <div className="border border-border rounded-md p-4">
                      <p className="font-mono text-[9px] tracking-widest text-fg-dim mb-3">CURRENCY</p>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          onClick={() => setCurrency("ETH")}
                          className={`py-2 text-[10px] font-mono tracking-widest rounded transition-colors cursor-pointer ${
                            currency === "ETH"
                              ? "bg-fg/10 text-fg border border-fg/20"
                              : "text-fg-dim border border-border hover:border-border"
                          }`}
                        >
                          ETH
                        </button>
                        <button
                          onClick={() => setCurrency("NEXUS")}
                          className={`py-2 text-[10px] font-mono tracking-widest rounded transition-colors cursor-pointer ${
                            currency === "NEXUS"
                              ? "bg-accent/10 text-accent border border-accent/30"
                              : "text-fg-dim border border-border hover:border-border"
                          }`}
                        >
                          $NEXUS <span className="text-[8px] text-success">1.2x</span>
                        </button>
                      </div>
                      {currency === "NEXUS" && (
                        <p className="font-mono text-[8px] text-fg-dim mt-2">
                          Balance: {formatNum(nexusBalance, 0)} NEXUS
                        </p>
                      )}
                    </div>

                    {/* Amount Input */}
                    <div className="border border-border rounded-md p-4">
                      <p className="font-mono text-[9px] tracking-widest text-fg-dim mb-2">
                        PER BLOCK AMOUNT
                      </p>
                      <input
                        type="text"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        placeholder={currency === "ETH" ? "0.001" : "100"}
                        className="w-full bg-transparent border border-border rounded px-3 py-2 font-mono text-sm text-fg placeholder:text-fg-dim/40 focus:outline-none focus:border-accent/50"
                      />
                      <div className="flex justify-between mt-2">
                        <span className="font-mono text-[8px] text-fg-dim">
                          {selectedBlocks.size} blocks selected
                        </span>
                        <span className="font-mono text-[8px] text-fg-muted">
                          Total: {amount && selectedBlocks.size > 0
                            ? (parseFloat(amount || "0") * selectedBlocks.size).toFixed(
                                currency === "ETH" ? 6 : 0
                              )
                            : "0"} {currency}
                        </span>
                      </div>
                    </div>

                    {/* NFT Status + Stake/Unstake */}
                    <div className="border border-border rounded-md p-4">
                      <p className="font-mono text-[9px] tracking-widest text-fg-dim mb-2">NFT BOOST</p>
                      <div className="flex items-center justify-between">
                        <span className={`font-mono text-xs ${RARITY_COLORS[playerRarity]}`}>
                          {hasNFTStaked ? RARITY_NAMES[playerRarity] : "NO NFT STAKED"}
                        </span>
                        <span className="font-mono text-xs text-accent">
                          {playerMult}
                        </span>
                      </div>
                      {hasNFTStaked ? (
                        <button
                          onClick={handleUnstakeNFT}
                          disabled={loading}
                          className="w-full mt-3 py-2 font-mono text-[9px] tracking-widest border border-border text-fg-dim hover:text-error hover:border-error/50 rounded transition-colors cursor-pointer disabled:opacity-30"
                        >
                          UNSTAKE NFT
                        </button>
                      ) : (
                        <button
                          onClick={() => handleStakeNFT()}
                          disabled={loading || loadingNFTs}
                          className="w-full mt-3 py-2 font-mono text-[9px] tracking-widest border border-accent/50 text-accent hover:bg-accent/10 rounded transition-colors cursor-pointer disabled:opacity-30"
                        >
                          {loadingNFTs ? "SCANNING NFTs..." : "STAKE NFT FOR BOOST"}
                        </button>
                      )}

                      {/* NFT Selector Modal */}
                      <AnimatePresence>
                        {showNFTSelector && !hasNFTStaked && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: "auto" }}
                            exit={{ opacity: 0, height: 0 }}
                            className="mt-3 overflow-hidden"
                          >
                            {ownedNFTs.length === 0 ? (
                              <p className="font-mono text-[9px] text-error">
                                No Nexus Node NFTs found. <a href="/mint" className="underline">Mint one</a>
                              </p>
                            ) : (
                              <div className="space-y-2">
                                <p className="font-mono text-[9px] text-fg-dim">SELECT NFT TO STAKE:</p>
                                {ownedNFTs.map((nft) => (
                                  <button
                                    key={nft.tokenId}
                                    onClick={() => handleStakeNFT(nft.tokenId)}
                                    disabled={loading}
                                    className={`w-full flex items-center gap-3 p-2 border rounded transition-colors cursor-pointer disabled:opacity-30 ${
                                      selectedNFTId === nft.tokenId
                                        ? "border-accent bg-accent/10"
                                        : "border-border hover:border-accent/50"
                                    }`}
                                  >
                                    {nft.image && (
                                      <img
                                        src={nft.image}
                                        alt={`NFT #${nft.tokenId}`}
                                        className="w-10 h-10 rounded object-cover"
                                      />
                                    )}
                                    <div className="text-left">
                                      <p className="font-mono text-[10px] text-fg">
                                        Nexus Node #{nft.tokenId}
                                      </p>
                                      <p className={`font-mono text-[9px] ${
                                        nft.tier === "Ultra-Rare" ? "text-success" :
                                        nft.tier === "Rare" ? "text-accent" : "text-fg-muted"
                                      }`}>
                                        {nft.tier} — {
                                          nft.tier === "Ultra-Rare" ? "2.5x" :
                                          nft.tier === "Rare" ? "1.8x" : "1.3x"
                                        } boost
                                      </p>
                                    </div>
                                  </button>
                                ))}
                                <button
                                  onClick={() => setShowNFTSelector(false)}
                                  className="w-full py-1 font-mono text-[8px] text-fg-dim hover:text-fg cursor-pointer"
                                >
                                  CANCEL
                                </button>
                              </div>
                            )}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>

                    {/* Deploy Button + Round Status */}
                    {!gameActive ? (
                      <div className="w-full py-3 font-mono text-[11px] tracking-widest rounded border border-fg-dim/30 text-fg-dim text-center bg-bg-card">
                        GAME NOT ACTIVE — WAITING FOR START
                      </div>
                    ) : roundSettled ? (
                      <div className="w-full py-3 font-mono text-[11px] tracking-widest rounded border border-success/30 text-success text-center bg-success/5">
                        BLOCK {winningBlock !== null ? winningBlock + 1 : "?"} WON! — Rewards accumulate in REWARDS tab
                      </div>
                    ) : timeLeft === 0 ? (
                      <div className="w-full py-3 font-mono text-[11px] tracking-widest rounded border border-orange-400/30 text-orange-400 text-center bg-orange-400/5 animate-pulse">
                        SETTLING ROUND...
                      </div>
                    ) : (
                      <motion.button
                        onClick={handleDeploy}
                        disabled={loading || deployed || selectedBlocks.size === 0 || !amount}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        className={`w-full py-3 font-mono text-[11px] tracking-widest rounded transition-all cursor-pointer ${
                          deployed
                            ? "border border-success/30 text-success bg-success/5"
                            : "border border-accent text-accent hover:bg-accent/10 disabled:opacity-30"
                        }`}
                      >
                        {loading ? "DEPLOYING..." : deployed ? "DEPLOYED — WAITING..." : `DEPLOY ${currency}`}
                      </motion.button>
                    )}

                    {/* Vault Trigger Banner */}
                    {vaultTriggered && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="border border-accent bg-accent/10 rounded-md p-4 text-center"
                      >
                        <p className="font-mono text-[10px] tracking-widest text-accent mb-1">
                          NEXUS VAULT TRIGGERED!
                        </p>
                        <p className="font-mono text-2xl text-accent">
                          {formatNum(vaultAmount, 1)} NEXUS
                        </p>
                      </motion.div>
                    )}

                    {/* Error / Success */}
                    {error && (
                      <p className="font-mono text-[9px] text-error">{error}</p>
                    )}
                    {success && (
                      <p className="font-mono text-[9px] text-success">{success}</p>
                    )}
                  </div>
                </div>
              )}
            </motion.div>
          )}

          {tab === "rewards" && (
            <motion.div
              key="rewards"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="max-w-lg"
            >
              <div className="space-y-4">
                {/* Accumulated Round Winnings */}
                <div className="border border-border rounded-md p-6">
                  <p className="font-mono text-[10px] tracking-widest text-fg-dim mb-4">
                    ROUND WINNINGS
                  </p>
                  {unclaimedRounds.length > 0 ? (
                    <>
                      <div className="grid grid-cols-2 gap-6 mb-4">
                        <div>
                          <p className="font-mono text-[9px] text-fg-dim mb-1">UNCLAIMED ROUNDS</p>
                          <p className="font-mono text-xl text-fg">{unclaimedRounds.length}</p>
                        </div>
                        <div>
                          <p className="font-mono text-[9px] text-fg-dim mb-1">WINNING ROUNDS</p>
                          <p className="font-mono text-xl text-success">
                            {unclaimedRounds.filter(r => r.wonETH || r.wonNexus).length}
                          </p>
                        </div>
                      </div>
                      <div className="space-y-1 mb-4 max-h-32 overflow-y-auto">
                        {unclaimedRounds.map((r) => (
                          <div key={r.id} className="flex items-center justify-between py-1 border-b border-border/20">
                            <span className="font-mono text-[9px] text-fg-muted">Round #{r.id}</span>
                            <span className={`font-mono text-[9px] ${r.wonETH || r.wonNexus ? "text-success" : "text-fg-dim"}`}>
                              {r.wonETH && r.wonNexus ? "WON ETH + NEXUS" : r.wonETH ? "WON ETH" : r.wonNexus ? "WON NEXUS" : "DEPLOYED"}
                            </span>
                          </div>
                        ))}
                      </div>
                      <button
                        onClick={handleClaimAllRounds}
                        disabled={claimingAll}
                        className="w-full py-3 font-mono text-[10px] tracking-widest border border-success text-success hover:bg-success/10 rounded transition-colors cursor-pointer disabled:opacity-30"
                      >
                        {claimingAll ? "CLAIMING ALL..." : `CLAIM ALL ${unclaimedRounds.length} ROUNDS`}
                      </button>
                    </>
                  ) : (
                    <p className="font-mono text-[9px] text-fg-dim">
                      No unclaimed rounds. Play rounds to accumulate winnings.
                    </p>
                  )}
                </div>

                {/* Cooling Balances */}
                <div className="border border-border rounded-md p-6">
                  <p className="font-mono text-[10px] tracking-widest text-fg-dim mb-4">
                    COOLING REWARDS
                  </p>
                  <div className="grid grid-cols-2 gap-6">
                    <div>
                      <p className="font-mono text-[9px] text-fg-dim mb-1">UNCOOLED</p>
                      <p className="font-mono text-xl text-fg">{formatNum(uncooled, 2)}</p>
                      <p className="font-mono text-[8px] text-fg-dim">$NEXUS</p>
                    </div>
                    <div>
                      <p className="font-mono text-[9px] text-fg-dim mb-1">COOLED (BONUS)</p>
                      <p className="font-mono text-xl text-success">{formatNum(cooled, 2)}</p>
                      <p className="font-mono text-[8px] text-fg-dim">$NEXUS</p>
                    </div>
                  </div>

                  <div className="mt-4 p-3 bg-bg-card rounded border border-border/50">
                    <p className="font-mono text-[8px] text-fg-dim leading-relaxed">
                      Uncooled $NEXUS earns bonus when others claim (10% fee redistributed).
                      The longer you wait, the more cooled bonus you accumulate.
                      Claiming charges 10% on uncooled balance only.
                    </p>
                  </div>

                  <button
                    onClick={handleClaimCooled}
                    disabled={loading || (parseFloat(uncooled) === 0 && parseFloat(cooled) === 0)}
                    className="w-full mt-4 py-3 font-mono text-[10px] tracking-widest border border-accent text-accent hover:bg-accent/10 rounded transition-colors cursor-pointer disabled:opacity-30"
                  >
                    {loading ? "CLAIMING..." : "CLAIM ALL (10% FEE ON UNCOOLED)"}
                  </button>
                </div>

                {/* NFT Multiplier Info */}
                <div className="border border-border rounded-md p-6">
                  <p className="font-mono text-[10px] tracking-widest text-fg-dim mb-4">
                    NFT MULTIPLIER TIERS
                  </p>
                  <div className="space-y-3">
                    {[
                      { name: "NO NFT", mult: "1.0x", bonus: "1.2x", vault: "No", color: "text-fg-dim" },
                      { name: "COMMON", mult: "1.3x", bonus: "1.4x", vault: "Yes", color: "text-fg-muted" },
                      { name: "RARE", mult: "1.8x", bonus: "1.6x", vault: "1.5x", color: "text-accent" },
                      { name: "ULTRA RARE", mult: "2.5x", bonus: "2.0x", vault: "2.0x", color: "text-success" },
                    ].map((tier) => (
                      <div key={tier.name} className="flex items-center justify-between py-2 border-b border-border/30 last:border-0">
                        <span className={`font-mono text-[10px] ${tier.color}`}>{tier.name}</span>
                        <div className="flex gap-4">
                          <span className="font-mono text-[9px] text-fg-dim">
                            Payout {tier.mult}
                          </span>
                          <span className="font-mono text-[9px] text-fg-dim">
                            NEXUS {tier.bonus}
                          </span>
                          <span className="font-mono text-[9px] text-fg-dim">
                            Vault {tier.vault}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {tab === "stats" && (
            <motion.div
              key="stats"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-2xl">
                <div className="border border-border rounded-md p-6">
                  <p className="font-mono text-[10px] tracking-widest text-fg-dim mb-4">PROTOCOL</p>
                  <div className="space-y-3">
                    <StatRow label="Total Rounds" value={String(totalRounds)} />
                    <StatRow label="ETH Fees Collected" value={`${formatNum(totalFees)} ETH`} />
                    <StatRow label="$NEXUS Burned" value={`${formatNum(totalBurned, 0)} NEXUS`} />
                    <StatRow label="Nexus Vault" value={`${formatNum(vaultAmount, 1)} NEXUS`} />
                  </div>
                </div>

                <div className="border border-border rounded-md p-6">
                  <p className="font-mono text-[10px] tracking-widest text-fg-dim mb-4">HOW IT WORKS</p>
                  <div className="space-y-2">
                    {[
                      "Pick blocks on the 5×5 grid",
                      "Deploy ETH or $NEXUS per block",
                      "Round settles after 60 seconds",
                      "1 winning block chosen on-chain",
                      "Winners take losers' funds (minus fees)",
                      "1% admin + 10% vault fee → Treasury",
                      "Treasury buys & burns $NEXUS",
                      "NFT holders earn multiplied payouts",
                      "Nexus Vault jackpot: 1-in-777 trigger",
                    ].map((step, i) => (
                      <div key={i} className="flex gap-2">
                        <span className="font-mono text-[9px] text-accent">{i + 1}.</span>
                        <span className="font-mono text-[9px] text-fg-muted leading-relaxed">{step}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// SUB-COMPONENTS
// ---------------------------------------------------------------------------
function StatBox({ label, value, accent, live }: {
  label: string; value: string; accent?: boolean; live?: boolean;
}) {
  return (
    <div className="border border-border rounded-md px-4 py-3">
      <p className="font-mono text-[8px] tracking-widest text-fg-dim mb-1">{label}</p>
      <p className={`font-mono text-sm ${accent ? "text-accent" : "text-fg"}`}>
        {value}
        {live && <span className="inline-block w-1.5 h-1.5 bg-success rounded-full ml-2 animate-pulse" />}
      </p>
    </div>
  );
}

function StatRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-center">
      <span className="font-mono text-[9px] text-fg-dim">{label}</span>
      <span className="font-mono text-[10px] text-fg">{value}</span>
    </div>
  );
}
