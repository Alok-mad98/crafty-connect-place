"use client";

import { useEffect, useRef, useCallback } from "react";

interface Particle {
  x: number;
  y: number;
  baseX: number;
  baseY: number;
  targetX: number;
  targetY: number;
  vx: number;
  vy: number;
  friction: number;
  ease: number;
  char: string;
  opacity: number;
  group: "white" | "pupil" | "outline" | "iris";
}

type BlinkState = "open" | "closing" | "closed" | "opening";

const CHARS = "0123456789".split("");
const PARTICLE_COUNT = 10000;
const REPULSION_RADIUS = 120;
const REPULSION_FORCE = 6;
const FONT_SIZE = 12;

function generateEyeShape(
  cx: number,
  cy: number,
  w: number,
  h: number,
  count: number
) {
  const particles: { x: number; y: number; group: Particle["group"] }[] = [];

  const eyeW = w * 0.48;
  const eyeH = h * 0.34;
  const pupilR = eyeW * 0.18;
  const irisR = eyeW * 0.32;

  for (let i = 0; i < count; i++) {
    const rx = (Math.random() - 0.5) * 2 * eyeW;
    const ry = (Math.random() - 0.5) * 2 * eyeH;

    const normX = Math.abs(rx / eyeW);
    const topBound = eyeH * (1 - normX * normX);
    const botBound = -eyeH * (1 - normX * normX) * 0.85;

    if (ry < topBound && ry > botBound) {
      const dist = Math.sqrt(rx * rx + ry * ry);
      let group: Particle["group"] = "white";

      if (dist < pupilR) {
        group = "pupil";
      } else if (dist < irisR) {
        group = Math.random() > 0.4 ? "iris" : "white";
      }

      // Outline particles along the edge
      const edgeDist = Math.min(
        Math.abs(ry - topBound),
        Math.abs(ry - botBound)
      );
      if (edgeDist < 8) {
        group = "outline";
      }

      particles.push({ x: cx + rx, y: cy + ry, group });
    }
  }

  return particles;
}

function generateClosedEyeShape(
  cx: number,
  cy: number,
  w: number,
  count: number
) {
  const coords: { x: number; y: number }[] = [];
  const lineW = w * 0.48;

  for (let i = 0; i < count; i++) {
    const rx = (Math.random() - 0.5) * 2 * lineW;
    const normX = rx / lineW;
    const ry = Math.sin(normX * Math.PI) * 10 + (Math.random() - 0.5) * 8;
    coords.push({ x: cx + rx, y: cy + ry });
  }
  return coords;
}

export default function EyeParticleCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particlesRef = useRef<Particle[]>([]);
  const mouseRef = useRef({ x: -9999, y: -9999 });
  const animRef = useRef(0);
  const blinkStateRef = useRef<BlinkState>("open");
  const blinkTimerRef = useRef(0);
  const timeRef = useRef(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const closedMapRef = useRef<{ x: number; y: number }[]>([]);
  const openMapRef = useRef<{ x: number; y: number; group: Particle["group"] }[]>([]);
  const sizeRef = useRef({ w: 0, h: 0 });

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

    const openMap = generateEyeShape(cx, cy, w, h, PARTICLE_COUNT * 1.8);
    const closedMap = generateClosedEyeShape(cx, cy, w, openMap.length);

    openMapRef.current = openMap;
    closedMapRef.current = closedMap;

    particlesRef.current = openMap.map((pt) => ({
      x: cx + (Math.random() - 0.5) * w,
      y: cy + (Math.random() - 0.5) * h,
      baseX: pt.x,
      baseY: pt.y,
      targetX: pt.x,
      targetY: pt.y,
      vx: 0,
      vy: 0,
      friction: 0.85 + Math.random() * 0.04,
      ease: 0.08 + Math.random() * 0.03,
      char: CHARS[Math.floor(Math.random() * CHARS.length)],
      opacity:
        pt.group === "pupil" ? 0.95
        : pt.group === "iris" ? 0.75
        : pt.group === "outline" ? 0.8
        : 0.3 + Math.random() * 0.25,
      group: pt.group,
    }));
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

    // Blink timer
    const scheduleBlink = () => {
      blinkTimerRef.current = window.setTimeout(() => {
        if (blinkStateRef.current === "open") {
          blinkStateRef.current = "closing";
          setTimeout(() => {
            blinkStateRef.current = "closed";
            setTimeout(() => {
              blinkStateRef.current = "opening";
              setTimeout(() => {
                blinkStateRef.current = "open";
              }, 150);
            }, 80);
          }, 120);
        }
        scheduleBlink();
      }, 2000 + Math.random() * 3000);
    };
    scheduleBlink();

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const animate = () => {
      const { w, h } = sizeRef.current;
      ctx.clearRect(0, 0, w, h);
      timeRef.current += 0.02;

      const floatY = Math.sin(timeRef.current) * 8;
      const mx = mouseRef.current.x;
      const my = mouseRef.current.y;

      const isClosed = blinkStateRef.current === "closed" || blinkStateRef.current === "closing";
      const cx = w / 2;
      const cy = h / 2;

      // Pupil tracking offset
      const eyeAngle = Math.atan2(my - cy, mx - cx);
      const pupilDist = Math.min(Math.sqrt((mx - cx) ** 2 + (my - cy) ** 2), 200);
      const pupilOffX = mx > -9000 ? Math.cos(eyeAngle) * Math.min(pupilDist * 0.1, 20) : 0;
      const pupilOffY = mx > -9000 ? Math.sin(eyeAngle) * Math.min(pupilDist * 0.1, 12) : 0;

      const particles = particlesRef.current;
      const openMap = openMapRef.current;
      const closedMap = closedMapRef.current;

      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];

        // Update target based on blink state
        if (isClosed && closedMap[i]) {
          p.targetX = closedMap[i].x;
          p.targetY = closedMap[i].y + floatY;
        } else if (openMap[i]) {
          let tx = openMap[i].x;
          let ty = openMap[i].y + floatY;
          if (p.group === "pupil" || p.group === "iris") {
            tx += pupilOffX;
            ty += pupilOffY;
          }
          p.targetX = tx;
          p.targetY = ty;
        }

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
        const dy = p.targetY - p.y;
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
      clearTimeout(blinkTimerRef.current);
    };
  }, [init]);

  return (
    <div ref={containerRef} className="relative w-full h-full cursor-crosshair">
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />
    </div>
  );
}
