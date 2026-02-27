import { motion } from "framer-motion";

const stats = [
  { label: "skills", value: "100+", sub: "Listed Skills" },
  { label: "leverage", value: "$50K+", sub: "Creator Earnings" },
  { label: "agents", value: "2.5K", sub: "Active Agents" },
  { label: "latency", value: "<2s", sub: "MCP Connect" },
];

export default function StatsBar() {
  return (
    <section className="border-y border-border py-12 px-6">
      <div className="max-w-[1400px] mx-auto grid grid-cols-2 md:grid-cols-4 gap-10">
        {stats.map((s, i) => (
          <motion.div
            key={s.label}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: i * 0.1, duration: 0.5 }}
          >
            <p className="font-mono text-[9px] tracking-[0.3em] text-fg-dim mb-3">
              [{s.label}]
            </p>
            <p className="font-serif text-4xl md:text-5xl font-light text-fg tracking-tight">
              {s.value}
            </p>
            <p className="text-[11px] text-fg-muted mt-2 font-light">{s.sub}</p>
          </motion.div>
        ))}
      </div>
    </section>
  );
}
