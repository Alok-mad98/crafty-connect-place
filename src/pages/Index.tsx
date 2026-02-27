import { motion, useScroll, useTransform, useInView } from "framer-motion";
import { useRef } from "react";
import { Link } from "react-router-dom";
import Button from "@/components/ui/Button";
import EyeParticleCanvas from "@/components/EyeParticleCanvas";
import ComputerParticleCanvas from "@/components/ComputerParticleCanvas";
import OpenClawParticleCanvas from "@/components/OpenClawParticleCanvas";
import HeroSection from "@/components/landing/HeroSection";
import StatsBar from "@/components/landing/StatsBar";
import FeaturesSection from "@/components/landing/FeaturesSection";
import StepsSection from "@/components/landing/StepsSection";
import CTASection from "@/components/landing/CTASection";
import LiveTicker from "@/components/landing/LiveTicker";

export default function Index() {
  const { scrollYProgress } = useScroll();
  const heroY = useTransform(scrollYProgress, [0, 0.3], [0, -80]);
  const heroOpacity = useTransform(scrollYProgress, [0, 0.25], [1, 0]);

  return (
    <div className="relative">
      <HeroSection heroY={heroY} heroOpacity={heroOpacity} />
      <StatsBar />

      {/* ── COMPUTER ── */}
      <section className="relative w-full min-h-screen flex flex-col items-center justify-center overflow-hidden">
        <div className="absolute inset-0">
          <ComputerParticleCanvas />
        </div>
        <div className="relative z-10 text-center pointer-events-none px-6">
          <motion.p
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
            className="font-mono text-[10px] tracking-[0.3em] text-fg-dim mb-6"
          >
            [THE_MACHINE]
          </motion.p>
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="heading-display text-5xl md:text-7xl lg:text-8xl text-fg"
          >
            Built by Code.
            <br />
            <span className="text-fg-muted italic">Powered by Numbers.</span>
          </motion.h2>
        </div>
      </section>

      {/* ── OPENCLAW ── */}
      <section className="relative w-full min-h-screen flex flex-col items-center justify-center overflow-hidden">
        <div className="absolute inset-0 pointer-events-auto">
          <OpenClawParticleCanvas />
        </div>
        <div className="relative z-10 text-center pointer-events-none px-6">
          <motion.p
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
            className="font-mono text-[10px] tracking-[0.3em] text-fg-dim mb-6"
          >
            [OPEN_CLAW]
          </motion.p>
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="heading-display text-5xl md:text-7xl lg:text-8xl text-fg"
          >
            Security First.
            <br />
            <span className="text-fg-muted italic">Always Watching.</span>
          </motion.h2>
        </div>
      </section>

      <FeaturesSection />
      <StepsSection />
      <CTASection />
      <LiveTicker />
    </div>
  );
}
