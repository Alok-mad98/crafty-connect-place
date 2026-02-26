"use client";

import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { usePrivy, useWallets } from "@privy-io/react-auth";
import { ethers } from "ethers";
import Button from "./ui/Button";
import {
  AGENT_SKILLS_MARKET_ABI,
  ERC20_ABI,
  CONTRACT_ADDRESS,
  USDC_ADDRESS,
} from "@/lib/contracts";

const MODEL_OPTIONS = ["CLAUDE", "GPT4", "LLAMA", "GEMINI"] as const;

interface ForgeState {
  file: File | null;
  title: string;
  description: string;
  price: string;
  modelTags: string[];
}

export default function ForgeModal() {
  const { authenticated, login } = usePrivy();
  const { wallets } = useWallets();
  const [state, setState] = useState<ForgeState>({
    file: null,
    title: "",
    description: "",
    price: "5.00",
    modelTags: [],
  });
  const [isDragging, setIsDragging] = useState(false);
  const [status, setStatus] = useState<"idle" | "uploading" | "approving" | "minting" | "done" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file?.name.endsWith(".md")) {
      setState((s) => ({ ...s, file }));
    }
  }, []);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file?.name.endsWith(".md")) {
      setState((s) => ({ ...s, file }));
    }
  }, []);

  const toggleTag = (tag: string) => {
    setState((s) => ({
      ...s,
      modelTags: s.modelTags.includes(tag)
        ? s.modelTags.filter((t) => t !== tag)
        : [...s.modelTags, tag],
    }));
  };

  const handleSubmit = async () => {
    if (!authenticated || !wallets[0]) {
      login();
      return;
    }

    if (!state.file || !state.title || !state.description) {
      setError("Please fill in all fields and upload a .md file");
      return;
    }

    const price = parseFloat(state.price);
    if (isNaN(price) || price < 2.0) {
      setError("Minimum price is 2.00 USDC");
      return;
    }

    setError(null);
    setStatus("uploading");

    try {
      const formData = new FormData();
      formData.append("file", state.file);
      const SUPABASE_URL = import.meta.env?.VITE_SUPABASE_URL || "";
      const SUPABASE_KEY = import.meta.env?.VITE_SUPABASE_PUBLISHABLE_KEY || "";
      if (!SUPABASE_URL || !SUPABASE_KEY) {
        throw new Error("Backend config missing in preview (VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY)");
      }
      const uploadRes = await fetch(`${SUPABASE_URL}/functions/v1/upload-skill`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${SUPABASE_KEY}`,
        },
        body: formData,
      });

      const uploadPayload: { ipfsCid?: string; error?: string; details?: string } | null = await uploadRes.json().catch(() => null);
      if (!uploadRes.ok) {
        throw new Error(uploadPayload?.error || uploadPayload?.details || `IPFS upload failed (${uploadRes.status})`);
      }
      if (!uploadPayload?.ipfsCid) {
        throw new Error("IPFS upload returned no CID");
      }
      const ipfsCid = uploadPayload.ipfsCid;

      setStatus("approving");
      const wallet = wallets[0];
      await wallet.switchChain(8453);
      const ethereumProvider = await wallet.getEthereumProvider();
      const provider = new ethers.BrowserProvider(ethereumProvider);
      const signer = await provider.getSigner();

      const usdc = new ethers.Contract(USDC_ADDRESS, ERC20_ABI, signer);
      const listingFee = ethers.parseUnits("0.5", 6);
      const allowance = await usdc.allowance(await signer.getAddress(), CONTRACT_ADDRESS);
      if (allowance < listingFee) {
        const approveTx = await usdc.approve(CONTRACT_ADDRESS, listingFee);
        await approveTx.wait();
      }

      setStatus("minting");
      const market = new ethers.Contract(CONTRACT_ADDRESS, AGENT_SKILLS_MARKET_ABI, signer);
      const priceWei = ethers.parseUnits(state.price, 6);
      const mintTx = await market.launchSkill(ipfsCid, priceWei);
      const receipt = await mintTx.wait();

      const iface = new ethers.Interface(AGENT_SKILLS_MARKET_ABI);
      const log = receipt.logs.find((l: ethers.Log) => {
        try {
          return iface.parseLog({ topics: [...l.topics], data: l.data })?.name === "SkillLaunched";
        } catch {
          return false;
        }
      });
      const parsed = log ? iface.parseLog({ topics: [...log.topics], data: log.data }) : null;
      const onchainId = parsed ? Number(parsed.args[0]) : undefined;

      // TODO: Save skill metadata via edge function (skills API not yet migrated)
      console.log("Skill minted onchain:", { ipfsCid, onchainId, txHash: receipt.hash });

      setStatus("done");
    } catch (err) {
      console.error("Forge error:", err);
      setError(err instanceof Error ? err.message : "Something went wrong");
      setStatus("error");
    }
  };

  const statusMessages: Record<string, string> = {
    uploading: "Uploading to IPFS...",
    approving: "Approving USDC...",
    minting: "Minting skill onchain...",
    done: "Skill launched successfully!",
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] }}
      className="w-full bg-bg-card border border-border p-8"
    >
      <p className="font-mono text-[10px] tracking-widest text-fg-dim mb-2">
        [launch_skill]
      </p>
      <h2 className="text-xl font-medium text-fg mb-1">Launch a Skill</h2>
      <p className="text-sm text-fg-muted mb-8">
        Upload your .md skill file, set a price, and mint it onchain.
      </p>

      {/* Drag & Drop Zone */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`
          relative border border-dashed p-8 text-center mb-6 transition-all duration-200 cursor-pointer
          ${isDragging ? "border-accent bg-accent-muted" : "border-border hover:border-border-hover"}
          ${state.file ? "border-success/30 bg-success/5" : ""}
        `}
        onClick={() => document.getElementById("file-input")?.click()}
      >
        <input
          id="file-input"
          type="file"
          accept=".md"
          onChange={handleFileChange}
          className="hidden"
        />
        {state.file ? (
          <div className="flex items-center justify-center gap-3">
            <span className="text-xs font-mono text-fg-muted">{state.file.name}</span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setState((s) => ({ ...s, file: null }));
              }}
              className="text-fg-dim hover:text-fg-muted text-[10px] font-mono"
            >
              [remove]
            </button>
          </div>
        ) : (
          <>
            <p className="text-sm text-fg-muted">
              Drag & drop your <span className="font-mono text-fg">.md</span> skill file
            </p>
            <p className="text-[10px] text-fg-dim mt-1 font-mono">or click to browse</p>
          </>
        )}
      </div>

      {/* Title */}
      <div className="mb-4">
        <label className="text-[10px] font-mono text-fg-dim mb-1.5 block tracking-wider">SKILL TITLE</label>
        <input
          type="text"
          value={state.title}
          onChange={(e) => setState((s) => ({ ...s, title: e.target.value }))}
          placeholder="e.g. Advanced Code Review Agent"
          className="w-full bg-transparent border border-border px-4 py-3 text-sm text-fg placeholder:text-fg-dim focus:outline-none focus:border-border-hover transition-colors font-mono"
        />
      </div>

      {/* Description */}
      <div className="mb-4">
        <label className="text-[10px] font-mono text-fg-dim mb-1.5 block tracking-wider">DESCRIPTION</label>
        <textarea
          value={state.description}
          onChange={(e) => setState((s) => ({ ...s, description: e.target.value }))}
          placeholder="What does this skill do?"
          rows={3}
          className="w-full bg-transparent border border-border px-4 py-3 text-sm text-fg placeholder:text-fg-dim focus:outline-none focus:border-border-hover transition-colors resize-none font-mono"
        />
      </div>

      {/* Model Tags */}
      <div className="mb-4">
        <label className="text-[10px] font-mono text-fg-dim mb-1.5 block tracking-wider">COMPATIBLE MODELS</label>
        <div className="flex flex-wrap gap-2">
          {MODEL_OPTIONS.map((tag) => (
            <button
              key={tag}
              onClick={() => toggleTag(tag)}
              className={`
                px-3 py-1.5 text-[10px] font-mono border transition-all duration-200
                ${
                  state.modelTags.includes(tag)
                    ? "bg-fg-ghost border-border-hover text-fg"
                    : "bg-transparent border-border text-fg-dim hover:text-fg-muted hover:border-border-hover"
                }
              `}
            >
              [{tag}]
            </button>
          ))}
        </div>
      </div>

      {/* Price */}
      <div className="mb-6">
        <label className="text-[10px] font-mono text-fg-dim mb-1.5 block tracking-wider">PRICE (USDC)</label>
        <div className="relative">
          <input
            type="number"
            min="2"
            step="0.01"
            value={state.price}
            onChange={(e) => setState((s) => ({ ...s, price: e.target.value }))}
            className="w-full bg-transparent border border-border px-4 py-3 text-sm text-fg font-mono focus:outline-none focus:border-border-hover transition-colors"
          />
          <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-mono text-fg-dim">
            USDC
          </span>
        </div>
        <p className="text-[10px] text-fg-dim mt-1 font-mono">Minimum 2.00 USDC</p>
      </div>

      {/* Error */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="mb-4 p-3 border border-error/20 bg-error/5 text-xs text-error font-mono"
          >
            {error}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Status */}
      {status !== "idle" && status !== "error" && (
        <div className="mb-4 p-3 border border-accent-muted bg-accent-muted/30 text-xs text-accent font-mono flex items-center gap-2">
          {status !== "done" && (
            <div className="w-3 h-3 border border-accent/40 border-t-accent rounded-full animate-spin" />
          )}
          {statusMessages[status]}
        </div>
      )}

      {/* Submit */}
      <Button
        variant="primary"
        size="lg"
        className="w-full"
        onClick={handleSubmit}
        disabled={status === "uploading" || status === "approving" || status === "minting"}
      >
        {!authenticated
          ? "CONNECT WALLET FIRST"
          : status === "done"
          ? "SKILL LAUNCHED!"
          : "PAY 0.5 USDC TO MINT →"}
      </Button>

      <p className="text-[10px] text-fg-dim text-center mt-4 font-mono">
        0.5 USDC listing fee · 95% of sales go to you · Verified by Master AI
      </p>
    </motion.div>
  );
}
