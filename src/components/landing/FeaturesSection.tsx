import { motion, useInView } from "framer-motion";
import { useRef } from "react";

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

export default function FeaturesSection() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-100px" });

  return (
    <section ref={ref} className="py-40 px-6 md:px-16 lg:px-24">
      <div className="max-w-[1400px] mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
          className="mb-24"
        >
          <p className="font-mono text-[9px] tracking-[0.3em] text-fg-dim mb-5">
            [the_protocol]
          </p>
          <h2 className="heading-display text-4xl md:text-6xl text-fg">
            Built Different
          </h2>
          <div className="hr-accent w-16 mt-6 mb-6" style={{ height: 1 }} />
          <p className="text-fg-muted max-w-lg font-light text-sm leading-relaxed">
            The infrastructure layer for AI skill distribution.
            Onchain. Decentralized. Unstoppable.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-px bg-border">
          {features.map((f, i) => (
            <motion.div
              key={f.title}
              initial={{ opacity: 0, y: 40 }}
              animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{ delay: i * 0.15, duration: 0.6 }}
              className="bg-bg p-10 md:p-12 group hover:bg-bg-elevated transition-colors duration-500"
            >
              <p className="font-mono text-[9px] tracking-[0.3em] text-fg-dim mb-8">
                [{f.title.toLowerCase().replace(/\s/g, "_")}]
              </p>
              <h3 className="font-serif text-2xl font-light text-fg mb-4 italic">{f.title}</h3>
              <p className="text-[13px] text-fg-muted leading-relaxed font-light">{f.description}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
