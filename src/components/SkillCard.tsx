import { motion } from "framer-motion";
import { useState } from "react";
import Button from "./ui/Button";
import { IPFS_GATEWAY } from "@/lib/contracts";

export interface SkillData {
  id: string;
  title: string;
  description: string;
  price: string;
  modelTags: string[];
  ipfsCid: string;
  onchainId?: number;
  creator?: {
    walletAddress?: string | null;
  };
}

interface SkillCardProps {
  skill: SkillData;
  index?: number;
  onBuy?: (skill: SkillData) => void;
  onConnect?: (skill: SkillData) => void;
  purchased?: boolean;
}

export default function SkillCard({
  skill,
  index = 0,
  onBuy,
  onConnect,
  purchased = false,
}: SkillCardProps) {
  const [showConnect, setShowConnect] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || "https://xiofvutfjujnzdzlgmyc.supabase.co";
  const mcpEndpoint = `${supabaseUrl}/functions/v1/skill-mcp/${skill.id}`;
  const fileUrl = `https://${IPFS_GATEWAY}/ipfs/${skill.ipfsCid}`;

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopied(label);
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 40 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        delay: index * 0.1,
        duration: 0.6,
        ease: [0.25, 0.46, 0.45, 0.94],
      }}
      className="group bg-bg-card border border-border p-6 flex flex-col hover:bg-bg-elevated hover:border-border-hover transition-colors duration-300"
    >
      <div className="flex items-center justify-between mb-4">
        <p className="font-mono text-[10px] tracking-widest text-fg-dim">
          [skill_{String(index).padStart(2, "0")}]
        </p>
        <div className="w-2 h-2 rounded-full bg-success/60" title="Verified" />
      </div>

      <h3 className="text-base font-medium text-fg mb-2">{skill.title}</h3>

      <p className="text-sm text-fg-muted leading-relaxed mb-4 line-clamp-2 flex-grow">
        {skill.description}
      </p>

      <div className="flex flex-wrap gap-2 mb-4">
        {skill.modelTags.map((tag) => (
          <span
            key={tag}
            className="px-2 py-0.5 text-[10px] font-mono bg-fg-ghost border border-border text-fg-muted"
          >
            [{tag}]
          </span>
        ))}
      </div>

      <div className="flex items-baseline gap-2 mb-5">
        <span className="text-xl font-mono font-light text-fg">
          {parseFloat(skill.price).toFixed(2)}
        </span>
        <span className="text-[10px] font-mono text-fg-dim">USDC</span>
      </div>

      {purchased ? (
        <div className="space-y-3">
          {/* Primary actions */}
          <div className="flex gap-2">
            <Button
              variant="primary"
              size="sm"
              className="flex-1"
              onClick={() => setShowConnect(!showConnect)}
            >
              {showConnect ? "CLOSE" : "CONNECT TO AGENT"}
            </Button>
            <a
              href={fileUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex"
            >
              <Button variant="ghost" size="sm">
                ↓ .MD
              </Button>
            </a>
          </div>

          {/* Connect panel */}
          {showConnect && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="border border-border bg-bg p-4 space-y-3"
            >
              <p className="text-[10px] font-mono text-fg-dim tracking-wider">
                [connect_options]
              </p>

              {/* MCP Endpoint for AI agents */}
              <div>
                <label className="text-[10px] font-mono text-fg-muted block mb-1">
                  MCP ENDPOINT (for AI agents)
                </label>
                <div className="flex gap-1">
                  <input
                    readOnly
                    value={mcpEndpoint}
                    className="flex-1 bg-bg-card border border-border px-2 py-1.5 text-[10px] font-mono text-fg truncate"
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => copyToClipboard(mcpEndpoint, "mcp")}
                  >
                    {copied === "mcp" ? "✓" : "COPY"}
                  </Button>
                </div>
                <p className="text-[9px] font-mono text-fg-dim mt-1">
                  Add this URL to your agent's MCP config
                </p>
              </div>

              {/* Direct file URL */}
              <div>
                <label className="text-[10px] font-mono text-fg-muted block mb-1">
                  DIRECT FILE URL
                </label>
                <div className="flex gap-1">
                  <input
                    readOnly
                    value={fileUrl}
                    className="flex-1 bg-bg-card border border-border px-2 py-1.5 text-[10px] font-mono text-fg truncate"
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => copyToClipboard(fileUrl, "file")}
                  >
                    {copied === "file" ? "✓" : "COPY"}
                  </Button>
                </div>
                <p className="text-[9px] font-mono text-fg-dim mt-1">
                  Fetch this URL directly for the .md skill file
                </p>
              </div>

              {/* Workspace connect buttons */}
              <div className="border-t border-border pt-3">
                <label className="text-[10px] font-mono text-fg-muted block mb-2">
                  QUICK CONNECT
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {skill.modelTags.map((tag) => (
                    <Button
                      key={tag}
                      variant="ghost"
                      size="sm"
                      className="text-[9px]"
                      onClick={() => {
                        copyToClipboard(mcpEndpoint, tag);
                        onConnect?.(skill);
                      }}
                    >
                      → {tag} WORKSPACE
                    </Button>
                  ))}
                </div>
              </div>
            </motion.div>
          )}
        </div>
      ) : (
        <div className="flex gap-3">
          <Button
            variant="primary"
            size="sm"
            className="flex-1"
            onClick={() => onBuy?.(skill)}
          >
            BUY SKILL
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => copyToClipboard(`mcp://nexus/skills/${skill.id}`, "uri")}
          >
            {copied === "uri" ? "✓" : "URI"}
          </Button>
        </div>
      )}

      {skill.creator?.walletAddress && (
        <div className="mt-4 pt-3 border-t border-border">
          <span className="text-[10px] font-mono text-fg-dim">
            by {skill.creator.walletAddress.slice(0, 6)}...
            {skill.creator.walletAddress.slice(-4)}
          </span>
        </div>
      )}
    </motion.div>
  );
}
