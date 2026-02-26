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
  group: "eye" | "pupil" | "background";
  alpha: number;
}

type BlinkState = "OPEN" | "CLOSING" | "CLOSED" | "OPENING";

function isInsideEye(x: number, y: number, cx: number, cy: number, rx: number, ry: number): boolean {
  const topArc = cy - ry * Math.pow(1 - Math.pow((x - cx) / rx, 2), 0.6) * 1.0;
  const bottomArc = cy + ry * Math.pow(1 - Math.pow((x - cx) / rx, 2), 0.6) * 1.0;
  if (Math.abs(x - cx) > rx) return false;
  return y > topArc && y < bottomArc;
}

function isInsidePupil(x: number, y: number, cx: number, cy: number, r: number): boolean {
  const dx = x - cx;
  const dy = y - cy;
  return dx * dx + dy * dy < r * r;
}

function isInsideIris(x: number, y: number, cx: number, cy: number, r: number): boolean {
  const dx = x - cx;
  const dy = y - cy;
  return dx * dx + dy * dy < r * r;
}

export default function EyeParticleCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const animRef = useRef<number>(0);
  const mouseRef = useRef({ x: -9999, y: -9999 });
  const particlesRef = useRef<Particle[]>([]);
  const blinkStateRef = useRef<BlinkState>("OPEN");
  const blinkProgressRef = useRef(0);
  const timeRef = useRef(0);
  const blinkTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const initializedRef = useRef(false);
  const sizeRef = useRef({ w: 0, h: 0 });

  const initParticles = useCallback((width: number, height: number) => {
    const particles: Particle[] = [];
    const chars = ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"];

    const cx = width / 2;
    const cy = height / 2;
    const eyeRx = Math.min(width * 0.32, 420);
    const eyeRy = Math.min(height * 0.22, 180);
    const irisR = eyeRy * 0.72;
    const pupilR = eyeRy * 0.35;

    const spacing = 14;
    const cols = Math.ceil(width / spacing);
    const rows = Math.ceil(height / spacing);

    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const x = col * spacing + (Math.random() - 0.5) * 4;
        const y = row * spacing + (Math.random() - 0.5) * 4;

        const inEye = isInsideEye(x, y, cx, cy, eyeRx, eyeRy);
        const inIris = isInsideIris(x, y, cx, cy, irisR);
        const inPupil = isInsidePupil(x, y, cx, cy, pupilR);

        let group: "eye" | "pupil" | "background" = "background";
        let alpha = 0.08 + Math.random() * 0.06;

        if (inEye) {
          if (inPupil) {
            group = "pupil";
            alpha = 0.7 + Math.random() * 0.3;
          } else if (inIris) {
            group = "eye";
            alpha = 0.3 + Math.random() * 0.4;
          } else {
            group = "eye";
            alpha = 0.15 + Math.random() * 0.2;
          }
        }

        particles.push({
          x: x + (Math.random() - 0.5) * width * 0.5,
          y: y + (Math.random() - 0.5) * height * 0.5,
          baseX: x,
          baseY: y,
          targetX: x,
          targetY: y,
          vx: 0,
          vy: 0,
          friction: 0.82 + Math.random() * 0.06,
          ease: 0.06 + Math.random() * 0.04,
          char: chars[Math.floor(Math.random() * chars.length)],
          group,
          alpha,
        });
      }
    }

    return particles;
  }, []);

  const getClosedTarget = useCallback(
    (p: Particle, cx: number, cy: number, eyeRx: number) => {
      if (p.group === "background") return { x: p.baseX, y: p.baseY };
      const relX = p.baseX - cx;
      const normalizedX = relX / eyeRx;
      const lineThickness = 3;
      return {
        x: p.baseX,
        y: cy + (Math.random() - 0.5) * lineThickness + Math.sin(normalizedX * Math.PI) * 2,
      };
    },
    []
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return;

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const rect = container.getBoundingClientRect();
      const w = rect.width;
      const h = rect.height;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      sizeRef.current = { w, h };

      particlesRef.current = initParticles(w, h);
      initializedRef.current = true;
    };

    resize();

    const onMouseMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      mouseRef.current.x = e.clientX - rect.left;
      mouseRef.current.y = e.clientY - rect.top;
    };
    const onMouseLeave = () => {
      mouseRef.current.x = -9999;
      mouseRef.current.y = -9999;
    };
    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length > 0) {
        const rect = canvas.getBoundingClientRect();
        mouseRef.current.x = e.touches[0].clientX - rect.left;
        mouseRef.current.y = e.touches[0].clientY - rect.top;
      }
    };

    container.addEventListener("mousemove", onMouseMove);
    container.addEventListener("mouseleave", onMouseLeave);
    container.addEventListener("touchmove", onTouchMove);
    window.addEventListener("resize", resize);

    // Blink system
    const scheduleBlink = () => {
      const delay = 2000 + Math.random() * 4000;
      blinkTimerRef.current = setTimeout(() => {
        if (blinkStateRef.current === "OPEN") {
          blinkStateRef.current = "CLOSING";
          blinkProgressRef.current = 0;
        }
        scheduleBlink();
      }, delay);
    };
    scheduleBlink();

    const animate = () => {
      if (!initializedRef.current) {
        animRef.current = requestAnimationFrame(animate);
        return;
      }

      const { w: width, h: height } = sizeRef.current;
      ctx.clearRect(0, 0, width, height);

      timeRef.current += 0.015;
      const floatY = Math.sin(timeRef.current) * 6;
      const floatX = Math.cos(timeRef.current * 0.7) * 3;

      const cx = width / 2;
      const cy = height / 2;
      const eyeRx = Math.min(width * 0.32, 420);
      const eyeRy = Math.min(height * 0.22, 180);

      const mx = mouseRef.current.x;
      const my = mouseRef.current.y;

      // Pupil tracking
      const angleToCursor = Math.atan2(my - cy, mx - cx);
      const distToCursor = Math.hypot(mx - cx, my - cy);
      const maxPupilOffset = 18;
      const pupilOffsetFactor = Math.min(distToCursor / 400, 1);
      const pupilOffsetX = Math.cos(angleToCursor) * maxPupilOffset * pupilOffsetFactor;
      const pupilOffsetY = Math.sin(angleToCursor) * maxPupilOffset * pupilOffsetFactor;

      // Blink state machine
      const blinkSpeed = 0.08;
      switch (blinkStateRef.current) {
        case "CLOSING":
          blinkProgressRef.current += blinkSpeed;
          if (blinkProgressRef.current >= 1) {
            blinkProgressRef.current = 1;
            blinkStateRef.current = "CLOSED";
            setTimeout(() => {
              blinkStateRef.current = "OPENING";
            }, 60 + Math.random() * 40);
          }
          break;
        case "OPENING":
          blinkProgressRef.current -= blinkSpeed * 0.7;
          if (blinkProgressRef.current <= 0) {
            blinkProgressRef.current = 0;
            blinkStateRef.current = "OPEN";
          }
          break;
      }

      const blinkT = blinkProgressRef.current;
      const particles = particlesRef.current;

      ctx.font = '11px monospace';
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";

      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];

        let tx: number, ty: number;

        if (p.group === "background") {
          tx = p.baseX + floatX * 0.3;
          ty = p.baseY + floatY * 0.3;
        } else if (blinkT > 0) {
          const closed = getClosedTarget(p, cx, cy, eyeRx);
          tx = p.baseX + (closed.x - p.baseX) * blinkT + floatX;
          ty = p.baseY + (closed.y - p.baseY) * blinkT + floatY;
          if (p.group === "pupil") {
            tx += pupilOffsetX * (1 - blinkT);
            ty += pupilOffsetY * (1 - blinkT);
          }
        } else {
          tx = p.baseX + floatX;
          ty = p.baseY + floatY;
          if (p.group === "pupil") {
            tx += pupilOffsetX;
            ty += pupilOffsetY;
          }
        }

        p.targetX = tx;
        p.targetY = ty;

        // Cursor repulsion
        const dx = p.x - mx;
        const dy = p.y - my;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const repulsionRadius = 120;

        if (dist < repulsionRadius && dist > 0) {
          const force = (repulsionRadius - dist) / repulsionRadius;
          const angle = Math.atan2(dy, dx);
          const strength = p.group === "background" ? 3 : 6;
          p.vx += Math.cos(angle) * force * strength;
          p.vy += Math.sin(angle) * force * strength;
        }

        // Elastic return
        const ddx = p.targetX - p.x;
        const ddy = p.targetY - p.y;
        p.vx += ddx * p.ease;
        p.vy += ddy * p.ease;
        p.vx *= p.friction;
        p.vy *= p.friction;
        p.x += p.vx;
        p.y += p.vy;

        // Draw
        const alpha = p.alpha * (blinkT > 0.8 && p.group !== "background" ? 1 - (blinkT - 0.8) * 5 : 1);
        if (alpha > 0.02) {
          ctx.fillStyle = `rgba(255, 255, 255, ${Math.min(alpha, 1)})`;
          ctx.fillText(p.char, p.x, p.y);
        }
      }

      animRef.current = requestAnimationFrame(animate);
    };

    animRef.current = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(animRef.current);
      if (blinkTimerRef.current) clearTimeout(blinkTimerRef.current);
      container.removeEventListener("mousemove", onMouseMove);
      container.removeEventListener("mouseleave", onMouseLeave);
      container.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("resize", resize);
    };
  }, [initParticles, getClosedTarget]);

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full cursor-crosshair"
    >
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full"
        style={{ background: "transparent" }}
      />
    </div>
  );
}
