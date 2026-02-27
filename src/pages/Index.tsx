import { motion, useScroll, useTransform } from "framer-motion";
import { useRef } from "react";
import { Link } from "react-router-dom";
import Button from "@/components/ui/Button";
import EyeParticleCanvas from "@/components/EyeParticleCanvas";
import ComputerParticleCanvas from "@/components/ComputerParticleCanvas";
import OpenClawParticleCanvas from "@/components/OpenClawParticleCanvas";
import HeroSection from "@/components/landing/HeroSection";
import DepthSection from "@/components/landing/DepthSection";
import StatsBar from "@/components/landing/StatsBar";
import FeaturesSection from "@/components/landing/FeaturesSection";
import StepsSection from "@/components/landing/StepsSection";
import CTASection from "@/components/landing/CTASection";
import LiveTicker from "@/components/landing/LiveTicker";

export default function Index() {
  const { scrollYProgress } = useScroll();
  const heroY = useTransform(scrollYProgress, [0, 0.15], [0, -60]);
  const heroOpacity = useTransform(scrollYProgress, [0, 0.12], [1, 0]);
  const heroScale = useTransform(scrollYProgress, [0, 0.15], [1, 1.15]);

  return (
    <div className="relative overflow-x-hidden">
      {/* Hero gets the "fly past" treatment — scales UP and fades as you scroll away */}
      <HeroSection heroY={heroY} heroOpacity={heroOpacity} heroScale={heroScale} />

      <DepthSection intensity={0.08} flyPast={false}>
        <StatsBar />
      </DepthSection>

      {/* ── COMPUTER ── */}
      <DepthSection intensity={0.18}>
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
      </DepthSection>

      {/* ── OPENCLAW ── */}
      <DepthSection intensity={0.18}>
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
      </DepthSection>

      <DepthSection intensity={0.12}>
        <FeaturesSection />
      </DepthSection>

      <DepthSection intensity={0.12}>
        <StepsSection />
      </DepthSection>

      <DepthSection intensity={0.1} flyPast={false}>
        <CTASection />
      </DepthSection>

      <LiveTicker />
    </div>
  );
}
