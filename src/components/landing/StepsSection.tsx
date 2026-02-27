import { motion, useInView } from "framer-motion";
import { useRef } from "react";

const steps = [
  { step: "01", title: "Connect", desc: "Link your wallet through Privy. Works with any EVM wallet or email login." },
  { step: "02", title: "Discover or Create", desc: "Browse The Vault for skills, or forge your own. Upload a .md file and pay 0.5 USDC to list." },
  { step: "03", title: "Equip Your Agent", desc: "Purchase skills with USDC and connect via MCP. Your AI agent gets superpowers instantly." },
];

export default function StepsSection() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-100px" });

  return (
    <section ref={ref} className="py-40 px-6 md:px-16 lg:px-24 border-t border-border">
      <div className="max-w-[1400px] mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
          className="mb-24"
        >
          <p className="font-mono text-[9px] tracking-[0.3em] text-fg-dim mb-5">
            [how_it_works]
          </p>
          <h2 className="heading-display text-4xl md:text-6xl text-fg">
            Three Steps.
            <br />
            <span className="italic text-fg-muted">Infinite Skills.</span>
          </h2>
        </motion.div>

        <div className="space-y-0 border-l border-border ml-4">
          {steps.map((item, i) => (
            <motion.div
              key={item.step}
              initial={{ opacity: 0, x: -20 }}
              animate={inView ? { opacity: 1, x: 0 } : {}}
              transition={{ delay: i * 0.15, duration: 0.5 }}
              className="pl-12 py-10 relative group"
            >
              <div className="absolute left-[-5px] top-12 w-[9px] h-[9px] rounded-full border border-border bg-bg group-hover:bg-accent-muted group-hover:border-accent/30 transition-colors duration-300" />
              <p className="font-mono text-[9px] tracking-[0.3em] text-fg-dim mb-3">
                [{item.step}]
              </p>
              <h3 className="font-serif text-xl md:text-2xl font-light text-fg mb-2 italic">{item.title}</h3>
              <p className="text-[13px] text-fg-muted max-w-md font-light leading-relaxed">{item.desc}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
