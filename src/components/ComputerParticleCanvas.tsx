"use client";

import { useEffect, useRef, useCallback } from "react";

interface Particle {
  x: number;
  y: number;
  targetX: number;
  targetY: number;
  vx: number;
  vy: number;
  friction: number;
  ease: number;
  char: string;
  opacity: number;
  region: "monitor" | "keyboard" | "base" | "stand" | "screen";
}

const CHARS = "0123456789".split("");
const CODE_CHARS = "01{}[]<>/;:=()".split("");
const REPULSION_RADIUS = 120;
const REPULSION_FORCE = 6;
const FONT_SIZE = 10;

function generateComputerShape(cx: number, cy: number, w: number, h: number) {
  const particles: { x: number; y: number; region: Particle["region"] }[] = [];

  const monW = w * 0.38;
  const monH = h * 0.32;
  const monX = cx - monW / 2;
  const monY = cy - monH * 0.7;

  const screenPad = 12;
  const kbW = monW * 0.9;
  const kbH = h * 0.08;
  const kbX = cx - kbW / 2;
  const kbY = monY + monH + h * 0.06;

  const standW = monW * 0.12;
  const standH = h * 0.05;
  const standX = cx - standW / 2;
  const standY = monY + monH;

  const baseW = monW * 0.35;
  const baseH = 6;
  const baseX = cx - baseW / 2;
  const baseY = standY + standH;

  // Monitor outline
  const density = 3;
  for (let x = monX; x <= monX + monW; x += density) {
    for (let y = monY; y <= monY + monH; y += density) {
      const isEdge =
        x < monX + 5 || x > monX + monW - 5 ||
        y < monY + 5 || y > monY + monH - 5;

      const isScreen =
        x > monX + screenPad && x < monX + monW - screenPad &&
        y > monY + screenPad && y < monY + monH - screenPad;

      if (isEdge || (isScreen && Math.random() < 0.15)) {
        particles.push({
          x: x + (Math.random() - 0.5) * 2,
          y: y + (Math.random() - 0.5) * 2,
          region: isScreen ? "screen" : "monitor",
        });
      }
    }
  }

  // Screen content particles (denser)
  for (let x = monX + screenPad + 4; x < monX + monW - screenPad - 4; x += 8) {
    for (let y = monY + screenPad + 4; y < monY + monH - screenPad - 4; y += 10) {
      if (Math.random() < 0.6) {
        particles.push({ x, y, region: "screen" });
      }
    }
  }

  // Stand
  for (let x = standX; x <= standX + standW; x += density) {
    for (let y = standY; y <= standY + standH; y += density) {
      if (Math.random() < 0.5) {
        particles.push({ x, y, region: "stand" });
      }
    }
  }

  // Base
  for (let x = baseX; x <= baseX + baseW; x += density) {
    for (let y = baseY; y <= baseY + baseH; y += density) {
      particles.push({ x, y, region: "base" });
    }
  }

  // Keyboard
  for (let x = kbX; x <= kbX + kbW; x += density) {
    for (let y = kbY; y <= kbY + kbH; y += density) {
      const isEdge =
        x < kbX + 4 || x > kbX + kbW - 4 ||
        y < kbY + 4 || y > kbY + kbH - 4;
      if (isEdge || Math.random() < 0.25) {
        particles.push({ x, y, region: "keyboard" });
      }
    }
  }

  return particles;
}

export default function ComputerParticleCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particlesRef = useRef<Particle[]>([]);
  const mouseRef = useRef({ x: -9999, y: -9999 });
  const animRef = useRef(0);
  const timeRef = useRef(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const sizeRef = useRef({ w: 0, h: 0 });
  const screenParticleIndicesRef = useRef<number[]>([]);

  const init = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const rect = container.getBoundingClientRect();
    const w = rect.width;
    const h = rect.height;
    canvas.width = w;
    canvas.height = h;
    sizeRef.current = { w, h };

    const cx = w / 2;
    const cy = h / 2;

    const shape = generateComputerShape(cx, cy, w, h);
    const screenIndices: number[] = [];

    particlesRef.current = shape.map((pt, i) => {
      if (pt.region === "screen") screenIndices.push(i);
      return {
        x: cx + (Math.random() - 0.5) * w * 0.8,
        y: cy + (Math.random() - 0.5) * h * 0.8,
        targetX: pt.x,
        targetY: pt.y,
        vx: 0,
        vy: 0,
        friction: 0.82 + Math.random() * 0.06,
        ease: 0.06 + Math.random() * 0.04,
        char: pt.region === "screen"
          ? CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]
          : CHARS[Math.floor(Math.random() * CHARS.length)],
        opacity: pt.region === "screen" ? 0.6 + Math.random() * 0.3 : 0.3 + Math.random() * 0.3,
        region: pt.region,
      };
    });

    screenParticleIndicesRef.current = screenIndices;
  }, []);

  useEffect(() => {
    init();

    const handleResize = () => init();
    window.addEventListener("resize", handleResize);

    const handleMouse = (e: MouseEvent) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      mouseRef.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    };

    const handleLeave = () => {
      mouseRef.current = { x: -9999, y: -9999 };
    };

    const container = containerRef.current;
    container?.addEventListener("mousemove", handleMouse);
    container?.addEventListener("mouseleave", handleLeave);

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Code rain: periodically change screen particle chars
    const codeInterval = setInterval(() => {
      const particles = particlesRef.current;
      const indices = screenParticleIndicesRef.current;
      // Cycle ~20% of screen particles
      const changeCount = Math.floor(indices.length * 0.2);
      for (let i = 0; i < changeCount; i++) {
        const idx = indices[Math.floor(Math.random() * indices.length)];
        if (particles[idx]) {
          particles[idx].char = CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
        }
      }
    }, 200);

    const animate = () => {
      const { w, h } = sizeRef.current;
      ctx.clearRect(0, 0, w, h);
      timeRef.current += 0.015;

      const floatY = Math.sin(timeRef.current) * 4;
      const mx = mouseRef.current.x;
      const my = mouseRef.current.y;

      const particles = particlesRef.current;

      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];

        const ty = p.targetY + floatY;

        // Cursor repulsion
        if (mx > -9000) {
          const dx = p.x - mx;
          const dy = p.y - my;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < REPULSION_RADIUS) {
            const force = (REPULSION_RADIUS - dist) / REPULSION_RADIUS;
            const angle = Math.atan2(dy, dx);
            p.vx += Math.cos(angle) * force * REPULSION_FORCE;
            p.vy += Math.sin(angle) * force * REPULSION_FORCE;
          }
        }

        // Elastic return
        const dx = p.targetX - p.x;
        const dy = ty - p.y;
        p.vx += dx * p.ease;
        p.vy += dy * p.ease;
        p.vx *= p.friction;
        p.vy *= p.friction;
        p.x += p.vx;
        p.y += p.vy;

        // Draw
        ctx.globalAlpha = p.opacity;
        ctx.fillStyle = "#ffffff";
        ctx.font = `${FONT_SIZE}px monospace`;
        ctx.fillText(p.char, p.x, p.y);
      }

      ctx.globalAlpha = 1;
      animRef.current = requestAnimationFrame(animate);
    };

    animRef.current = requestAnimationFrame(animate);

    return () => {
      window.removeEventListener("resize", handleResize);
      container?.removeEventListener("mousemove", handleMouse);
      container?.removeEventListener("mouseleave", handleLeave);
      cancelAnimationFrame(animRef.current);
      clearInterval(codeInterval);
    };
  }, [init]);

  return (
    <div ref={containerRef} className="relative w-full h-full min-h-screen cursor-crosshair">
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />
    </div>
  );
}
