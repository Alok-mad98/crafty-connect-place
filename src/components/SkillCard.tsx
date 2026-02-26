import { motion } from "framer-motion";
import Button from "./ui/Button";

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
      whileHover={{ y: -4, transition: { duration: 0.2 } }}
      className="group relative bg-white/[0.04] backdrop-blur-xl border border-white/[0.08] rounded-2xl shadow-2xl shadow-black/20 p-6 flex flex-col hover:border-white/[0.15] transition-colors duration-300"
    >
      <div className="absolute top-4 right-4">
        <div className="w-2 h-2 rounded-full bg-emerald-400/80" title="Verified" />
      </div>

      <h3 className="text-lg font-semibold text-white mb-2 pr-6">{skill.title}</h3>
      <p className="text-sm text-white/50 leading-relaxed mb-4 line-clamp-2 flex-grow">
        {skill.description}
      </p>

      <div className="flex flex-wrap gap-2 mb-4">
        {skill.modelTags.map((tag) => (
          <span
            key={tag}
            className="px-2.5 py-1 text-xs font-mono bg-white/[0.08] border border-white/[0.06] rounded-md text-white/70"
          >
            [{tag}]
          </span>
        ))}
      </div>

      <div className="flex items-baseline gap-2 mb-5">
        <span className="text-xl font-mono font-bold text-amber-warm">
          {parseFloat(skill.price).toFixed(2)}
        </span>
        <span className="text-xs font-mono text-white/40">USDC</span>
      </div>

      <div className="flex gap-3">
        {purchased ? (
          <>
            <Button variant="primary" size="sm" className="flex-1 text-xs" onClick={() => onConnect?.(skill)}>
              Connect via MCP
            </Button>
            <Button variant="ghost" size="sm" className="text-xs" onClick={() => {
              navigator.clipboard.writeText(skill.ipfsCid);
            }}>
              Copy CID
            </Button>
          </>
        ) : (
          <>
            <Button variant="primary" size="sm" className="flex-1 text-xs" onClick={() => onBuy?.(skill)}>
              Buy Skill
            </Button>
            <Button variant="ghost" size="sm" className="text-xs" onClick={() => {
              navigator.clipboard.writeText(mcpUri);
            }}>
              Copy MCP URI
            </Button>
          </>
        )}
      </div>

      {skill.creator?.walletAddress && (
        <div className="mt-4 pt-3 border-t border-white/[0.06]">
          <span className="text-[10px] font-mono text-white/30">
            by {skill.creator.walletAddress.slice(0, 6)}...
            {skill.creator.walletAddress.slice(-4)}
          </span>
        </div>
      )}
    </motion.div>
  );
}
