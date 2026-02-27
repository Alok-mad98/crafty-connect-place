import { motion } from "framer-motion";
import { useEffect, useState, useCallback } from "react";
import { usePrivy, useWallets } from "@privy-io/react-auth";
import { ethers } from "ethers";
import { Link } from "react-router-dom";
import SkillCard, { type SkillData } from "@/components/SkillCard";
import Button from "@/components/ui/Button";
import {
  AGENT_SKILLS_MARKET_ABI,
  ERC20_ABI,
  CONTRACT_ADDRESS,
  USDC_ADDRESS,
} from "@/lib/contracts";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || "https://xiofvutfjujnzdzlgmyc.supabase.co";
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inhpb2Z2dXRmanVqbnpkemxnbXljIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIxMDcyNzQsImV4cCI6MjA4NzY4MzI3NH0.8a7yzvhXTYqHFXacCBvT3lCUiJRBkYAQ3kmDLYv2QX8";

export default function Vault() {
  const [skills, setSkills] = useState<SkillData[]>([]);
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState<string | null>(null);
  const [purchasedIds, setPurchasedIds] = useState<Set<string>>(new Set());
  const { authenticated, user } = usePrivy();
  const { wallets } = useWallets();

  const fetchSkills = useCallback(async () => {
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/skills-api`, {
        headers: { Authorization: `Bearer ${SUPABASE_KEY}` },
      });
      if (res.ok) {
        const data = await res.json();
        setSkills(data.skills || []);
      }
    } catch (err) {
      console.error("Failed to fetch skills:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchPurchases = useCallback(async () => {
    if (!wallets[0]) return;
    try {
      const wallet = wallets[0].address?.toLowerCase();
      if (!wallet) return;
      const res = await fetch(
        `${SUPABASE_URL}/functions/v1/skills-api/purchases/${wallet}`,
        {
          headers: {
            Authorization: `Bearer ${SUPABASE_KEY}`,
          },
        }
      );
      if (res.ok) {
        const data = await res.json();
        setPurchasedIds(new Set(data.purchasedSkillIds || []));
      }
    } catch (err) {
      console.error("Failed to fetch purchases:", err);
    }
  }, [wallets]);

  useEffect(() => {
    fetchSkills();
  }, [fetchSkills]);

  useEffect(() => {
    if (authenticated && wallets[0]) {
      fetchPurchases();
    }
  }, [authenticated, wallets, fetchPurchases]);

  const handleBuy = async (skill: SkillData) => {
    if (!authenticated || !wallets[0] || skill.onchainId == null) return;
    setPurchasing(skill.id);
    try {
      const wallet = wallets[0];
      await wallet.switchChain(8453);
      const ethereumProvider = await wallet.getEthereumProvider();
      const provider = new ethers.BrowserProvider(ethereumProvider);
      const signer = await provider.getSigner();
      const usdc = new ethers.Contract(USDC_ADDRESS, ERC20_ABI, signer);
      const priceWei = ethers.parseUnits(skill.price, 6);
      const allowance = await usdc.allowance(await signer.getAddress(), CONTRACT_ADDRESS);
      if (allowance < priceWei) {
        const approveTx = await usdc.approve(CONTRACT_ADDRESS, priceWei);
        await approveTx.wait();
      }
      const market = new ethers.Contract(CONTRACT_ADDRESS, AGENT_SKILLS_MARKET_ABI, signer);
      const buyTx = await market.buySkill(skill.onchainId);
      const receipt = await buyTx.wait();

      // Record purchase in DB
      await fetch(`${SUPABASE_URL}/functions/v1/skills-api/purchase`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${SUPABASE_KEY}`,
        },
        body: JSON.stringify({
          skillId: skill.id,
          buyerWallet: wallet.address?.toLowerCase(),
          txHash: receipt.hash,
        }),
      });

      setPurchasedIds((prev) => new Set(prev).add(skill.id));
    } catch (err) {
      console.error("Purchase failed:", err);
    } finally {
      setPurchasing(null);
    }
  };

  const handleConnect = (skill: SkillData) => {
    const mcpEndpoint = `${SUPABASE_URL}/functions/v1/skill-mcp/${skill.id}`;
    navigator.clipboard.writeText(mcpEndpoint);
    alert(`MCP endpoint copied!\n\n${mcpEndpoint}\n\nAdd this to your AI agent's MCP config.`);
  };

  return (
    <div className="min-h-screen px-6 md:px-16 lg:px-24 py-20">
      <div className="max-w-[1400px] mx-auto">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }} className="mb-16">
          <p className="font-mono text-[10px] tracking-widest text-fg-dim mb-4">[the_vault]</p>
          <h1 className="text-4xl md:text-6xl font-light tracking-tight text-fg mb-4">The Vault</h1>
          <p className="text-base text-fg-muted max-w-lg">Discover premium AI skills. Each one verified, onchain, and ready to plug into your agent via MCP.</p>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2, duration: 0.5 }} className="flex flex-wrap items-center gap-3 mb-12 border-b border-border pb-6">
          {["All", "CLAUDE", "GPT4", "LLAMA", "GEMINI"].map((tag) => (
            <button key={tag} className="px-4 py-1.5 text-[10px] font-mono tracking-wider border border-border text-fg-muted hover:text-fg hover:border-border-hover transition-all duration-200">
              {tag === "All" ? "ALL SKILLS" : `[${tag}]`}
            </button>
          ))}
        </motion.div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-px bg-border">
            {[1, 2, 3, 4, 5, 6].map((i) => (<div key={i} className="bg-bg h-72 animate-shimmer" />))}
          </div>
        ) : skills.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-px bg-border">
            {skills.map((skill, i) => (
              <SkillCard key={skill.id} skill={skill} index={i} purchased={purchasedIds.has(skill.id)} onBuy={handleBuy} onConnect={handleConnect} />
            ))}
          </div>
        ) : (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-32 border border-border">
            <p className="font-mono text-[10px] tracking-widest text-fg-dim mb-6">[empty_state]</p>
            <h3 className="text-xl font-light text-fg-muted mb-2">The Vault is empty</h3>
            <p className="text-sm text-fg-dim mb-8">No skills yet. Be the first to launch one.</p>
            <Link to="/forge"><Button variant="primary">LAUNCH A SKILL →</Button></Link>
          </motion.div>
        )}
      </div>
    </div>
  );
}
