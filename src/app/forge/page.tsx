"use client";

import { motion } from "framer-motion";
import ForgeModal from "@/components/ForgeModal";

export default function ForgePage() {
  return (
    <div className="min-h-screen px-6 py-12 flex flex-col items-center">
      <div className="max-w-7xl w-full">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-center mb-12"
        >
          <h1 className="text-4xl md:text-6xl font-bold tracking-tight text-white mb-4">
            The Forge
          </h1>
          <p className="text-lg text-white/40 max-w-lg mx-auto">
            Craft and launch your AI skill to the marketplace. Upload, price, mint.
          </p>
        </motion.div>

        {/* Forge Modal */}
        <ForgeModal />
      </div>
    </div>
  );
}
