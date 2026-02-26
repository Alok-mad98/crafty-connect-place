"use client";

import { useEffect, useRef } from "react";

const CHARS = "01アイウエオカキクケコ{}[]<>/:;NEXUS".split("");

interface Particle {
  x: number;
  y: number;
  speed: number;
  char: string;
  opacity: number;
  size: number;
}

export default function CinematicBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>(0);
  const particlesRef = useRef<Particle[]>([]);

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

    // Initialize particles
    const count = Math.floor(window.innerWidth / 18);
    particlesRef.current = Array.from({ length: count }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height * 2 - canvas.height,
      speed: Math.random() * 0.6 + 0.15,
      char: CHARS[Math.floor(Math.random() * CHARS.length)],
      opacity: Math.random() * 0.12 + 0.02,
      size: Math.random() * 4 + 10,
    }));

    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.font = "12px 'Roboto Mono', monospace";

      particlesRef.current.forEach((p) => {
        ctx.fillStyle = `rgba(255, 255, 255, ${p.opacity})`;
        ctx.fillText(p.char, p.x, p.y);

        p.y += p.speed;
        if (p.y > canvas.height) {
          p.y = -20;
          p.x = Math.random() * canvas.width;
          p.char = CHARS[Math.floor(Math.random() * CHARS.length)];
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
    <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
      {/* Base gradient */}
      <div
        className="absolute inset-0"
        style={{
          background: `
            radial-gradient(ellipse 80% 50% at 50% 100%, hsl(35 20% 8% / 0.4) 0%, transparent 70%),
            radial-gradient(ellipse 60% 40% at 20% 80%, hsl(35 15% 6% / 0.2) 0%, transparent 60%),
            hsl(0 0% 4%)
          `,
        }}
      />

      {/* Particle canvas */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full"
        style={{ mixBlendMode: "screen" }}
      />

      {/* Subtle vignette */}
      <div
        className="absolute inset-0"
        style={{
          background: "radial-gradient(ellipse 70% 60% at 50% 50%, transparent 0%, hsl(0 0% 3% / 0.5) 100%)",
        }}
      />
    </div>
  );
}
