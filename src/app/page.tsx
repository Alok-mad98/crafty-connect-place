"use client";

import { motion, useScroll, useTransform, useInView } from "framer-motion";
import { useRef } from "react";
import Link from "next/link";
import Button from "@/components/ui/Button";
import dynamic from "next/dynamic";

const EyeParticleCanvas = dynamic(() => import("@/components/EyeParticleCanvas"), { ssr: false });
const ComputerParticleCanvas = dynamic(() => import("@/components/ComputerParticleCanvas"), { ssr: false });

const stats = [
  { label: "skills", value: "100+", sub: "Listed Skills" },
  { label: "leverage", value: "$50K+", sub: "Creator Earnings" },
  { label: "agents", value: "2.5K", sub: "Active Agents" },
  { label: "latency", value: "<2s", sub: "MCP Connect" },
];

const features = [
  {
    title: "MCP Native",
    description: "Skills plug directly into any MCP-compatible AI agent. Instant integration, zero config.",
  },
  {
    title: "Onchain Payments",
    description: "USDC on Base. Instant settlement, transparent splits. 95% goes directly to creators.",
  },
  {
    title: "AI Verified",
    description: "Every skill verified by our Master AI for MCP compliance before it hits the marketplace.",
  },
];

const steps = [
  { step: "01", title: "Connect", desc: "Link your wallet through Privy. Works with any EVM wallet or email login." },
  { step: "02", title: "Discover or Create", desc: "Browse The Vault for skills, or forge your own. Upload a .md file and pay 0.5 USDC to list." },
  { step: "03", title: "Equip Your Agent", desc: "Purchase skills with USDC and connect via MCP. Your AI agent gets superpowers instantly." },
];

export default function Home() {
  const heroRef = useRef<HTMLDivElement>(null);
  const featuresRef = useRef<HTMLDivElement>(null);
  const stepsRef = useRef<HTMLDivElement>(null);
  const featuresInView = useInView(featuresRef, { once: true, margin: "-100px" });
  const stepsInView = useInView(stepsRef, { once: true, margin: "-100px" });

  const { scrollYProgress } = useScroll();
  const heroY = useTransform(scrollYProgress, [0, 0.3], [0, -80]);
  const heroOpacity = useTransform(scrollYProgress, [0, 0.25], [1, 0]);

  return (
    <div className="relative">
      {/* ── HERO WITH EYE OVERLAY ── */}
      <motion.section
        ref={heroRef}
        style={{ y: heroY, opacity: heroOpacity }}
        className="relative min-h-screen flex flex-col justify-center px-6 md:px-16 lg:px-24 pt-14 overflow-hidden"
      >
        {/* Particle Eye Background — full hero coverage like whiskerfi */}
        <div className="absolute inset-0 pointer-events-auto z-0">
          <EyeParticleCanvas />
        </div>

        {/* Hero text on top of everything */}
        <div className="relative z-10 max-w-[1400px] mx-auto w-full pointer-events-none">
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2, duration: 0.8 }}
            className="font-mono text-xs tracking-widest text-fg-dim mb-8"
          >
            [THE_SKILLS_MARKETPLACE]
          </motion.p>

          <motion.h1
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.8, ease: [0.25, 0.46, 0.45, 0.94] }}
            className="text-[clamp(2.5rem,8vw,7rem)] font-light leading-[0.95] tracking-tight"
          >
            <span className="text-fg">AI That Thinks.</span>
            <br />
            <span className="text-fg-muted">With You,</span>
            <br />
            <span className="text-fg-dim">Not For You.</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6, duration: 0.6 }}
            className="mt-8 text-base md:text-lg text-fg-muted max-w-xl leading-relaxed"
          >
            Equip your AI with premium skills instantly via MCP.
            A decentralized marketplace for the agents of tomorrow.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.8, duration: 0.6 }}
            className="mt-10 flex items-center gap-6 pointer-events-auto"
          >
            <Link href="/vault">
              <Button variant="primary" size="lg">
                EXPLORE VAULT →
              </Button>
            </Link>
            <Link
              href="/forge"
              className="text-xs font-mono tracking-wider text-fg-muted hover:text-fg transition-colors"
            >
              FORGE A SKILL [+]
            </Link>
          </motion.div>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.5, duration: 1 }}
            className="mt-24 text-[10px] font-mono text-fg-dim tracking-widest"
          >
            [scroll_down]
          </motion.p>
        </div>
      </motion.section>

      {/* ── STATS BAR ── */}
      <section className="border-y border-border py-10 px-6">
        <div className="max-w-[1400px] mx-auto grid grid-cols-2 md:grid-cols-4 gap-8">
          {stats.map((s, i) => (
            <motion.div
              key={s.label}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1, duration: 0.5 }}
            >
              <p className="font-mono text-[10px] tracking-widest text-fg-dim mb-2">
                [{s.label}]
              </p>
              <p className="text-3xl md:text-4xl font-light text-fg tracking-tight">
                {s.value}
              </p>
              <p className="text-xs text-fg-muted mt-1">{s.sub}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ── COMPUTER — Full-bleed with keyboard + code ── */}
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
            className="font-mono text-[10px] tracking-[0.3em] text-fg-dim mb-4"
          >
            [THE_MACHINE]
          </motion.p>
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="text-4xl md:text-6xl lg:text-7xl font-light tracking-tight text-fg"
          >
            Built by Code.
            <br />
            Powered by Numbers.
          </motion.h2>
        </div>
      </section>

      {/* ── FEATURES ── */}
      <section ref={featuresRef} className="py-32 px-6 md:px-16 lg:px-24">
        <div className="max-w-[1400px] mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={featuresInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.6 }}
            className="mb-20"
          >
            <p className="font-mono text-[10px] tracking-widest text-fg-dim mb-4">
              [the_protocol]
            </p>
            <h2 className="text-3xl md:text-5xl font-light tracking-tight text-fg">
              Built Different
            </h2>
            <p className="text-fg-muted mt-4 max-w-lg">
              The infrastructure layer for AI skill distribution.
              Onchain. Decentralized. Unstoppable.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-px bg-border">
            {features.map((f, i) => (
              <motion.div
                key={f.title}
                initial={{ opacity: 0, y: 40 }}
                animate={featuresInView ? { opacity: 1, y: 0 } : {}}
                transition={{ delay: i * 0.15, duration: 0.6 }}
                className="bg-bg p-8 md:p-10 group hover:bg-bg-elevated transition-colors duration-300"
              >
                <p className="font-mono text-[10px] tracking-widest text-fg-dim mb-6">
                  [{f.title.toLowerCase().replace(/\s/g, "_")}]
                </p>
                <h3 className="text-xl font-medium text-fg mb-3">{f.title}</h3>
                <p className="text-sm text-fg-muted leading-relaxed">{f.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ── */}
      <section ref={stepsRef} className="py-32 px-6 md:px-16 lg:px-24 border-t border-border">
        <div className="max-w-[1400px] mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={stepsInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.6 }}
            className="mb-20"
          >
            <p className="font-mono text-[10px] tracking-widest text-fg-dim mb-4">
              [how_it_works]
            </p>
            <h2 className="text-3xl md:text-5xl font-light tracking-tight text-fg">
              Three Steps. Infinite Skills.
            </h2>
          </motion.div>

          <div className="space-y-0 border-l border-border ml-4">
            {steps.map((item, i) => (
              <motion.div
                key={item.step}
                initial={{ opacity: 0, x: -20 }}
                animate={stepsInView ? { opacity: 1, x: 0 } : {}}
                transition={{ delay: i * 0.15, duration: 0.5 }}
                className="pl-10 py-8 relative group"
              >
                <div className="absolute left-[-5px] top-10 w-[9px] h-[9px] rounded-full border border-border bg-bg group-hover:bg-accent-muted transition-colors" />
                <p className="font-mono text-[10px] tracking-widest text-fg-dim mb-2">
                  [{item.step}]
                </p>
                <h3 className="text-lg font-medium text-fg mb-1">{item.title}</h3>
                <p className="text-sm text-fg-muted max-w-md">{item.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA BOTTOM ── */}
      <section className="py-40 px-6 border-t border-border">
        <div className="max-w-[1400px] mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <p className="font-mono text-[10px] tracking-widest text-fg-dim mb-6">
              [get_started]
            </p>
            <h2 className="text-4xl md:text-6xl font-light tracking-tight text-fg mb-6">
              Ready to upgrade your AI?
            </h2>
            <p className="text-fg-muted mb-10 max-w-md mx-auto">
              Join the marketplace. Buy skills. Sell skills.
              Build the future of AI agents.
            </p>
            <Link href="/vault">
              <Button variant="primary" size="lg">
                ENTER THE VAULT →
              </Button>
            </Link>
          </motion.div>
        </div>
      </section>

      {/* ── LIVE TICKER ── */}
      <div className="border-t border-border py-3 overflow-hidden">
        <motion.div
          animate={{ x: [0, -1200] }}
          transition={{ duration: 30, repeat: Infinity, ease: "linear" }}
          className="flex gap-12 whitespace-nowrap"
        >
          {Array.from({ length: 8 }).map((_, i) => (
            <span key={i} className="font-mono text-[10px] text-fg-dim tracking-wider">
              {i % 2 === 0
                ? "[TX: 0x8f...3a] Agent_77 integrated Python_Logic.md | Status: Success"
                : "[TX: 0xb2...7c] Agent_42 purchased Advanced_CodeReview.md | 5.00 USDC"
              }
            </span>
          ))}
        </motion.div>
      </div>
    </div>
  );
}
