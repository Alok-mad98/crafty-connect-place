import { motion, type MotionValue } from "framer-motion";
import { Link } from "react-router-dom";
import Button from "@/components/ui/Button";
import EyeParticleCanvas from "@/components/EyeParticleCanvas";

interface HeroSectionProps {
  heroY: MotionValue<number>;
  heroOpacity: MotionValue<number>;
  heroScale: MotionValue<number>;
}

export default function HeroSection({ heroY, heroOpacity, heroScale }: HeroSectionProps) {
  return (
    <motion.section
      style={{ y: heroY, opacity: heroOpacity, scale: heroScale }}
      className="relative min-h-screen flex flex-col justify-center px-6 md:px-16 lg:px-24 pt-16 overflow-hidden"
    >
      <div className="absolute inset-0 pointer-events-auto z-0">
        <EyeParticleCanvas />
      </div>

      <div className="relative z-10 max-w-[1400px] mx-auto w-full pointer-events-none">
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2, duration: 1 }}
          className="font-mono text-[10px] tracking-[0.3em] text-fg-dim mb-10"
        >
          [THE_SKILLS_MARKETPLACE]
        </motion.p>

        <motion.h1
          initial={{ opacity: 0, y: 50 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 1, ease: [0.25, 0.46, 0.45, 0.94] }}
          className="heading-display text-[clamp(3rem,9vw,8rem)]"
        >
          <span className="text-fg">AI That Thinks.</span>
          <br />
          <span className="text-fg-muted italic">With You,</span>
          <br />
          <span className="text-fg-dim">Not For You.</span>
        </motion.h1>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8, duration: 0.8 }}
          className="mt-10"
        >
          <div className="hr-accent w-20 mb-8" style={{ height: 1 }} />
          <p className="text-sm md:text-base text-fg-muted max-w-lg leading-relaxed font-light">
            Equip your AI with premium skills instantly via MCP.
            <br />
            A decentralized marketplace for the agents of tomorrow.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.1, duration: 0.6 }}
          className="mt-12 flex items-center gap-8 pointer-events-auto"
        >
          <Link to="/vault">
            <Button variant="primary" size="lg">
              EXPLORE VAULT
            </Button>
          </Link>
          <Link
            to="/forge"
            className="text-[10px] font-mono tracking-[0.2em] text-fg-dim hover:text-fg-muted transition-colors duration-300 border-b border-fg-ghost hover:border-fg-dim pb-1"
          >
            FORGE A SKILL [+]
          </Link>
        </motion.div>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 2, duration: 1 }}
          className="mt-32 text-[9px] font-mono text-fg-dim tracking-[0.4em]"
        >
          ↓ SCROLL
        </motion.p>
      </div>
    </motion.section>
  );
}
