"use client";

import { motion, useInView } from "framer-motion";
import { useRef } from "react";
import Link from "next/link";
import Button from "@/components/ui/Button";
import GlassCard from "@/components/ui/GlassCard";

const springTransition = {
  type: "spring" as const,
  damping: 25,
  stiffness: 120,
};

const features = [
  {
    title: "MCP Native",
    description:
      "Skills that plug directly into any MCP-compatible AI agent. Instant integration, zero config.",
    icon: (
      <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" />
      </svg>
    ),
  },
  {
    title: "Onchain Payments",
    description:
      "USDC on Base. Instant settlement, transparent splits. 95% goes directly to creators.",
    icon: (
      <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z" />
      </svg>
    ),
  },
  {
    title: "AI Verified",
    description:
      "Every skill verified by our Master AI for MCP compliance before it hits the marketplace.",
    icon: (
      <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
      </svg>
    ),
  },
];

export default function Home() {
  const featuresRef = useRef<HTMLDivElement>(null);
  const isInView = useInView(featuresRef, { once: true, margin: "-100px" });

  return (
    <div className="relative min-h-screen">
      {/* Hero Section */}
      <section className="flex flex-col items-center justify-center min-h-[90vh] px-6 text-center">
        {/* Glowing orb behind hero */}
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] opacity-20 pointer-events-none">
          <div
            className="w-full h-full rounded-full blur-3xl"
            style={{
              background:
                "radial-gradient(ellipse at center, rgba(196,149,106,0.3) 0%, transparent 70%)",
            }}
          />
        </div>

        <motion.div
          className="relative z-10 flex flex-col items-center gap-6 max-w-4xl"
          initial="hidden"
          animate="visible"
          variants={{
            hidden: {},
            visible: { transition: { staggerChildren: 0.15 } },
          }}
        >
          {/* Badge */}
          <motion.div
            variants={{
              hidden: { opacity: 0, y: 20 },
              visible: { opacity: 1, y: 0, transition: springTransition },
            }}
            className="flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/[0.06] border border-white/[0.1] backdrop-blur-sm"
          >
            <div className="w-2 h-2 rounded-full bg-amber-warm animate-pulse" />
            <span className="text-xs font-mono text-white/60 tracking-wider uppercase">
              Powered by MCP Protocol
            </span>
          </motion.div>

          {/* Main heading */}
          <motion.h1
            variants={{
              hidden: { opacity: 0, y: 30 },
              visible: { opacity: 1, y: 0, transition: springTransition },
            }}
            className="text-5xl md:text-7xl lg:text-8xl font-bold tracking-tight leading-[0.95] text-white"
          >
            AI That Thinks{" "}
            <span className="text-white/80">With You,</span>
            <br />
            <span className="text-white/60">Not For You.</span>
          </motion.h1>

          {/* Subtext */}
          <motion.p
            variants={{
              hidden: { opacity: 0, y: 20 },
              visible: { opacity: 1, y: 0, transition: springTransition },
            }}
            className="text-lg md:text-xl text-white/50 max-w-2xl leading-relaxed"
          >
            Equip your AI with premium skills instantly via MCP.
            A decentralized marketplace for the agents of tomorrow.
          </motion.p>

          {/* CTA Buttons */}
          <motion.div
            variants={{
              hidden: { opacity: 0, y: 20 },
              visible: { opacity: 1, y: 0, transition: springTransition },
            }}
            className="flex flex-col sm:flex-row items-center gap-4 mt-4"
          >
            <Link href="/vault">
              <Button variant="primary" size="lg">
                Explore Skills
              </Button>
            </Link>
            <Link href="/forge">
              <Button variant="ghost" size="lg">
                Launch a Skill
              </Button>
            </Link>
          </motion.div>

          {/* Stats row */}
          <motion.div
            variants={{
              hidden: { opacity: 0, y: 20 },
              visible: { opacity: 1, y: 0, transition: springTransition },
            }}
            className="flex items-center gap-8 mt-8 text-center"
          >
            {[
              { value: "100+", label: "Skills Listed" },
              { value: "$50K+", label: "Creator Earnings" },
              { value: "2.5K", label: "Active Agents" },
            ].map((stat) => (
              <div key={stat.label} className="flex flex-col items-center">
                <span className="text-2xl font-bold font-mono text-white">
                  {stat.value}
                </span>
                <span className="text-xs text-white/40 mt-1">{stat.label}</span>
              </div>
            ))}
          </motion.div>
        </motion.div>

        {/* Scroll indicator */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.5, duration: 1 }}
          className="absolute bottom-8 left-1/2 -translate-x-1/2"
        >
          <motion.div
            animate={{ y: [0, 8, 0] }}
            transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
            className="w-6 h-10 rounded-full border border-white/20 flex items-start justify-center p-2"
          >
            <div className="w-1 h-2 rounded-full bg-white/40" />
          </motion.div>
        </motion.div>
      </section>

      {/* Features Section */}
      <section ref={featuresRef} className="relative px-6 py-24 max-w-6xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-white mb-4">
            Built Different
          </h2>
          <p className="text-white/40 max-w-lg mx-auto">
            The infrastructure layer for AI skill distribution. Onchain. Decentralized. Unstoppable.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {features.map((feature, i) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 40 }}
              animate={isInView ? { opacity: 1, y: 0 } : {}}
              transition={{
                delay: i * 0.15,
                duration: 0.6,
                ease: [0.25, 0.46, 0.45, 0.94],
              }}
            >
              <GlassCard className="p-8 h-full">
                <div className="text-amber-warm/80 mb-4">{feature.icon}</div>
                <h3 className="text-xl font-semibold text-white mb-2">
                  {feature.title}
                </h3>
                <p className="text-sm text-white/50 leading-relaxed">
                  {feature.description}
                </p>
              </GlassCard>
            </motion.div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="relative px-6 py-24 max-w-4xl mx-auto">
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-white mb-4">
            Three Steps. Infinite Skills.
          </h2>
        </motion.div>

        <div className="space-y-8">
          {[
            { step: "01", title: "Connect", desc: "Link your wallet through Privy. Works with any EVM wallet or email login." },
            { step: "02", title: "Discover or Create", desc: "Browse The Vault for skills, or forge your own in The Forge. Upload a .md file and pay 0.5 USDC to list." },
            { step: "03", title: "Equip Your Agent", desc: "Purchase skills with USDC and connect via MCP. Your AI agent gets superpowers instantly." },
          ].map((item, i) => (
            <motion.div
              key={item.step}
              initial={{ opacity: 0, x: -30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1, duration: 0.5 }}
              className="flex items-start gap-6"
            >
              <span className="text-4xl font-bold font-mono text-white/10 shrink-0">
                {item.step}
              </span>
              <div>
                <h3 className="text-lg font-semibold text-white mb-1">
                  {item.title}
                </h3>
                <p className="text-sm text-white/40">{item.desc}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* CTA Bottom */}
      <section className="relative px-6 py-32 text-center">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={springTransition}
          className="max-w-2xl mx-auto"
        >
          <h2 className="text-4xl md:text-5xl font-bold tracking-tight text-white mb-6">
            Ready to upgrade your AI?
          </h2>
          <p className="text-white/40 mb-8">
            Join the marketplace. Buy skills. Sell skills. Build the future of AI agents.
          </p>
          <Link href="/vault">
            <Button variant="primary" size="lg">
              Enter The Vault
            </Button>
          </Link>
        </motion.div>
      </section>
    </div>
  );
}
