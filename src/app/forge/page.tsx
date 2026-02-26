"use client";

import { motion } from "framer-motion";
import ForgeModal from "@/components/ForgeModal";

export default function ForgePage() {
  return (
    <div className="min-h-screen px-6 md:px-16 lg:px-24 py-20 flex flex-col items-center">
      <div className="max-w-xl w-full">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="mb-12"
        >
          <p className="font-mono text-[10px] tracking-widest text-fg-dim mb-4">
            [the_forge]
          </p>
          <h1 className="text-4xl md:text-5xl font-light tracking-tight text-fg mb-4">
            The Forge
          </h1>
          <p className="text-base text-fg-muted">
            Craft and launch your AI skill to the marketplace.
            Upload, price, mint.
          </p>
        </motion.div>

        {/* Forge Modal */}
        <ForgeModal />
      </div>
    </div>
  );
}
