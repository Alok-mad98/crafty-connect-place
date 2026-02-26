"use client";

import { useEffect, useRef } from "react";
import { motion, useScroll, useTransform } from "framer-motion";

interface Star {
  x: number;
  y: number;
  size: number;
  speed: number;
  opacity: number;
}

export default function CinematicBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const starsRef = useRef<Star[]>([]);
  const animationRef = useRef<number>(0);
  const { scrollY } = useScroll();

  const skyY = useTransform(scrollY, [0, 1000], [0, -150]);
  const fieldY = useTransform(scrollY, [0, 1000], [0, -50]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener("resize", resize);

    // Initialize stars
    starsRef.current = Array.from({ length: 250 }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height * 0.65,
      size: Math.random() * 2.5 + 0.5,
      speed: Math.random() * 0.5 + 0.2,
      opacity: Math.random(),
    }));

    const animate = (time: number) => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      starsRef.current.forEach((star) => {
        const twinkle = Math.sin(time * 0.001 * star.speed + star.x) * 0.5 + 0.5;
        const alpha = star.opacity * twinkle;

        ctx.beginPath();
        ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
        ctx.fill();

        // Glow effect for larger stars
        if (star.size > 1.5) {
          ctx.beginPath();
          ctx.arc(star.x, star.y, star.size * 3, 0, Math.PI * 2);
          const gradient = ctx.createRadialGradient(
            star.x, star.y, 0,
            star.x, star.y, star.size * 3
          );
          gradient.addColorStop(0, `rgba(255, 255, 255, ${alpha * 0.3})`);
          gradient.addColorStop(1, "rgba(255, 255, 255, 0)");
          ctx.fillStyle = gradient;
          ctx.fill();
        }
      });

      animationRef.current = requestAnimationFrame(animate);
    };

    animationRef.current = requestAnimationFrame(animate);

    return () => {
      window.removeEventListener("resize", resize);
      cancelAnimationFrame(animationRef.current);
    };
  }, []);

  return (
    <div className="fixed inset-0 -z-10 overflow-hidden">
      {/* Sky gradient layer */}
      <motion.div
        style={{ y: skyY }}
        className="absolute inset-0"
      >
        <div
          className="absolute inset-0"
          style={{
            background: `
              radial-gradient(ellipse 120% 60% at 50% 100%, rgba(196, 149, 106, 0.15) 0%, transparent 70%),
              radial-gradient(ellipse 80% 50% at 30% 80%, rgba(196, 149, 106, 0.08) 0%, transparent 60%),
              linear-gradient(180deg,
                #050810 0%,
                #0a0e1a 15%,
                #0d1225 35%,
                #111a30 55%,
                #1a1f2e 70%,
                #2a2520 82%,
                #3d3225 88%,
                #4a3d2a 92%,
                #3d3225 96%,
                #1a1510 100%
              )
            `,
          }}
        />
      </motion.div>

      {/* Horizon warm glow */}
      <motion.div
        style={{ y: fieldY }}
        className="absolute inset-0"
      >
        <div
          className="absolute bottom-0 left-0 right-0 h-[45%]"
          style={{
            background: `
              linear-gradient(180deg,
                transparent 0%,
                rgba(196, 149, 106, 0.06) 30%,
                rgba(196, 149, 106, 0.12) 50%,
                rgba(140, 100, 60, 0.08) 70%,
                rgba(30, 25, 15, 0.9) 85%,
                rgba(15, 12, 8, 0.95) 100%
              )
            `,
          }}
        />
        {/* Subtle grass-field texture suggestion */}
        <div
          className="absolute bottom-0 left-0 right-0 h-[20%] opacity-30"
          style={{
            background: `
              repeating-linear-gradient(
                85deg,
                transparent,
                transparent 2px,
                rgba(100, 120, 50, 0.05) 2px,
                rgba(100, 120, 50, 0.05) 4px
              )
            `,
          }}
        />
      </motion.div>

      {/* Star canvas */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full"
        style={{ mixBlendMode: "screen" }}
      />

      {/* Atmospheric haze */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: `
            radial-gradient(ellipse 100% 40% at 50% 75%, rgba(196, 149, 106, 0.04) 0%, transparent 70%),
            radial-gradient(circle at 20% 50%, rgba(196, 149, 106, 0.02) 0%, transparent 50%),
            radial-gradient(circle at 80% 40%, rgba(150, 130, 100, 0.02) 0%, transparent 50%)
          `,
        }}
      />

      {/* Vignette */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: "radial-gradient(ellipse 70% 60% at 50% 50%, transparent 0%, rgba(5, 8, 16, 0.4) 100%)",
        }}
      />
    </div>
  );
}
