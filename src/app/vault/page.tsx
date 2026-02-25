"use client";

import { motion } from "framer-motion";
import { useEffect, useState, useCallback } from "react";
import { usePrivy, useWallets } from "@privy-io/react-auth";
import { ethers } from "ethers";
import SkillCard, { type SkillData } from "@/components/SkillCard";
import Button from "@/components/ui/Button";
import {
  AGENT_SKILLS_MARKET_ABI,
  ERC20_ABI,
  CONTRACT_ADDRESS,
  USDC_ADDRESS,
} from "@/lib/contracts";

export default function VaultPage() {
  const [skills, setSkills] = useState<SkillData[]>([]);
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState<string | null>(null);
  const [purchasedIds, setPurchasedIds] = useState<Set<string>>(new Set());
  const { authenticated, user } = usePrivy();
  const { wallets } = useWallets();

  const fetchSkills = useCallback(async () => {
    try {
      const res = await fetch("/api/skills");
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

  useEffect(() => {
    fetchSkills();
  }, [fetchSkills]);

  const handleBuy = async (skill: SkillData) => {
    if (!authenticated || !wallets[0] || skill.onchainId == null) return;

    setPurchasing(skill.id);
    try {
      const wallet = wallets[0];
      await wallet.switchChain(8453); // Base
      const ethereumProvider = await wallet.getEthereumProvider();
      const provider = new ethers.BrowserProvider(ethereumProvider);
      const signer = await provider.getSigner();

      // Approve USDC
      const usdc = new ethers.Contract(USDC_ADDRESS, ERC20_ABI, signer);
      const priceWei = ethers.parseUnits(skill.price, 6);
      const allowance = await usdc.allowance(await signer.getAddress(), CONTRACT_ADDRESS);
      if (allowance < priceWei) {
        const approveTx = await usdc.approve(CONTRACT_ADDRESS, priceWei);
        await approveTx.wait();
      }

      // Buy skill
      const market = new ethers.Contract(CONTRACT_ADDRESS, AGENT_SKILLS_MARKET_ABI, signer);
      const buyTx = await market.buySkill(skill.onchainId);
      const receipt = await buyTx.wait();

      // Record purchase
      await fetch("/api/purchases", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          skillId: skill.id,
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
    const mcpUri = `${window.location.origin}/api/mcp/skill/${skill.id}`;
    navigator.clipboard.writeText(mcpUri);
    alert(`MCP endpoint copied!\n\n${mcpUri}\n\nAdd this to your AI agent's MCP config.`);
  };

  return (
    <div className="min-h-screen px-6 py-12">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <h1 className="text-4xl md:text-6xl font-bold tracking-tight text-white mb-4">
            The Vault
          </h1>
          <p className="text-lg text-white/40 max-w-lg mx-auto">
            Discover premium AI skills. Each one verified, onchain, and ready to plug into your agent via MCP.
          </p>
        </motion.div>

        {/* Filter bar */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.5 }}
          className="flex flex-wrap items-center justify-center gap-3 mb-12"
        >
          {["All", "CLAUDE", "GPT4", "LLAMA", "GEMINI"].map((tag) => (
            <button
              key={tag}
              className="px-4 py-2 text-xs font-mono border border-white/[0.1] rounded-lg text-white/60 hover:text-white hover:bg-white/[0.06] transition-all duration-200"
            >
              {tag === "All" ? "All Skills" : `[${tag}]`}
            </button>
          ))}
        </motion.div>

        {/* Skills Grid */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div
                key={i}
                className="bg-white/[0.04] backdrop-blur-xl border border-white/[0.08] rounded-2xl h-72 animate-pulse"
              />
            ))}
          </div>
        ) : skills.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {skills.map((skill, i) => (
              <SkillCard
                key={skill.id}
                skill={skill}
                index={i}
                purchased={purchasedIds.has(skill.id)}
                onBuy={handleBuy}
                onConnect={handleConnect}
              />
            ))}
          </div>
        ) : (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-24"
          >
            <div className="text-6xl mb-6 opacity-20">
              <svg className="w-20 h-20 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={0.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
              </svg>
            </div>
            <h3 className="text-xl font-semibold text-white/60 mb-2">
              The Vault is empty
            </h3>
            <p className="text-white/30 mb-6">
              No skills yet. Be the first to launch one.
            </p>
            <a href="/forge">
              <Button variant="primary">Launch a Skill</Button>
            </a>
          </motion.div>
        )}
      </div>
    </div>
  );
}
