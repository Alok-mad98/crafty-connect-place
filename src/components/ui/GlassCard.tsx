"use client";

import { motion, type HTMLMotionProps } from "framer-motion";
import { forwardRef } from "react";

interface GlassCardProps extends HTMLMotionProps<"div"> {
  children: React.ReactNode;
  className?: string;
  hover?: boolean;
}

const GlassCard = forwardRef<HTMLDivElement, GlassCardProps>(
  ({ children, className = "", hover = true, ...props }, ref) => {
    return (
      <motion.div
        ref={ref}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.25, 0.46, 0.45, 0.94] }}
        whileHover={hover ? { scale: 1.01, borderColor: "rgba(255,255,255,0.15)" } : undefined}
        className={`
          bg-white/[0.04] backdrop-blur-xl
          border border-white/[0.08]
          rounded-2xl shadow-2xl shadow-black/20
          transition-colors duration-300
          ${className}
        `}
        {...props}
      >
        {children}
      </motion.div>
    );
  }
);

GlassCard.displayName = "GlassCard";
export default GlassCard;
