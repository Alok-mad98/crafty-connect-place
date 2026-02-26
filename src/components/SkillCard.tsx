import { motion } from "framer-motion";
import Button from "./ui/Button";
import { PINATA_GATEWAY } from "@/lib/contracts";

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
  const mcpUri = `mcp://nexus/skills/${skill.id}`;

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

      <div className="flex gap-3">
        {purchased ? (
          <>
            <Button
              variant="primary"
              size="sm"
              className="flex-1"
              onClick={() => onConnect?.(skill)}
            >
              CONNECT MCP
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                window.open(
                  `https://${PINATA_GATEWAY}/ipfs/${skill.ipfsCid}`,
                  "_blank"
                );
              }}
            >
              .MD
            </Button>
          </>
        ) : (
          <>
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
              onClick={() => {
                navigator.clipboard.writeText(mcpUri);
              }}
            >
              URI
            </Button>
          </>
        )}
      </div>

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