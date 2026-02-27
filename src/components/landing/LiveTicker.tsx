import { motion } from "framer-motion";

export default function LiveTicker() {
  return (
    <div className="border-t border-border py-3 overflow-hidden">
      <motion.div
        animate={{ x: [0, -1200] }}
        transition={{ duration: 30, repeat: Infinity, ease: "linear" }}
        className="flex gap-16 whitespace-nowrap"
      >
        {Array.from({ length: 8 }).map((_, i) => (
          <span key={i} className="font-mono text-[9px] text-fg-dim tracking-[0.15em]">
            {i % 2 === 0
              ? "[TX: 0x8f…3a] Agent_77 integrated Python_Logic.md → Success"
              : "[TX: 0xb2…7c] Agent_42 purchased Advanced_CodeReview.md → 5.00 USDC"
            }
          </span>
        ))}
      </motion.div>
    </div>
  );
}
