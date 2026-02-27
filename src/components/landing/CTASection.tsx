import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import Button from "@/components/ui/Button";

export default function CTASection() {
  return (
    <section className="py-48 px-6 border-t border-border">
      <div className="max-w-[1400px] mx-auto text-center">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
        >
          <p className="font-mono text-[9px] tracking-[0.3em] text-fg-dim mb-8">
            [get_started]
          </p>
          <h2 className="heading-display text-5xl md:text-7xl text-fg mb-4">
            Ready to upgrade
          </h2>
          <h2 className="heading-display text-5xl md:text-7xl text-fg-muted italic mb-10">
            your AI?
          </h2>
          <p className="text-fg-muted mb-12 max-w-sm mx-auto font-light text-sm leading-relaxed">
            Join the marketplace. Buy skills. Sell skills.
            Build the future of AI agents.
          </p>
          <Link to="/vault">
            <Button variant="primary" size="lg">
              ENTER THE VAULT
            </Button>
          </Link>
        </motion.div>
      </div>
    </section>
  );
}
