import { motion, useScroll, useTransform } from "framer-motion";
import { useRef, type ReactNode } from "react";

interface DepthSectionProps {
  children: ReactNode;
  className?: string;
  /** How aggressively the section scales (default 0.15 = scales from 0.85 → 1.0 → 1.15) */
  intensity?: number;
  /** Whether to include the "fly past" scale-up on exit (default true) */
  flyPast?: boolean;
}

/**
 * Wraps a section in a scroll-driven 3D depth effect.
 * As you scroll, the section scales up from the distance (small) to full size,
 * then continues scaling past you (large + fading), creating a "camera diving in" feel.
 */
export default function DepthSection({
  children,
  className = "",
  intensity = 0.15,
  flyPast = true,
}: DepthSectionProps) {
  const ref = useRef<HTMLDivElement>(null);

  const { scrollYProgress } = useScroll({
    target: ref,
    // start = section top hits bottom of viewport, end = section bottom hits top of viewport
    offset: ["start end", "end start"],
  });

  // Scale: starts small (far away), reaches 1.0 at center, optionally grows past 1.0 (flying past camera)
  const scale = useTransform(
    scrollYProgress,
    [0, 0.4, 0.6, 1],
    flyPast
      ? [1 - intensity, 1, 1, 1 + intensity * 0.6]
      : [1 - intensity, 1, 1, 1]
  );

  // Opacity: fades in from distance, fully visible in center, fades out as it flies past
  const opacity = useTransform(
    scrollYProgress,
    [0, 0.2, 0.75, 1],
    [0, 1, 1, 0]
  );

  // Subtle Y translation for parallax depth feel
  const y = useTransform(
    scrollYProgress,
    [0, 0.5, 1],
    [60, 0, -40]
  );

  return (
    <div ref={ref} className={`relative ${className}`} style={{ perspective: "1200px" }}>
      <motion.div
        style={{
          scale,
          opacity,
          y,
          transformOrigin: "center center",
        }}
      >
        {children}
      </motion.div>
    </div>
  );
}
