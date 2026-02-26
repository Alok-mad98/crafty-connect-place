"use client";

import { useEffect, useRef, useCallback } from "react";

/*
 * OpenClaw Logo Particle Canvas
 * – Round body with antennae, arms, legs
 * – Two small eyes that blink & track the cursor
 * – Number-based particles, same aesthetic as EyeParticleCanvas
 */

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
  alpha: number;
  group: "body" | "eye-left" | "eye-right" | "antenna" | "arm" | "leg" | "bg";
}

type BlinkState = "OPEN" | "CLOSING" | "CLOSED" | "OPENING";

const CHARS = "0123456789".split("");
const SPACING = 13;

/* ── Shape helpers ── */

function isInsideCircle(x: number, y: number, cx: number, cy: number, r: number): boolean {
  const dx = x - cx;
  const dy = y - cy;
  return dx * dx + dy * dy < r * r;
}

function isInsideEllipse(x: number, y: number, cx: number, cy: number, rx: number, ry: number): boolean {
  const nx = (x - cx) / rx;
  const ny = (y - cy) / ry;
  return nx * nx + ny * ny < 1;
}

function distToSegment(px: number, py: number, x1: number, y1: number, x2: number, y2: number): number {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return Math.hypot(px - x1, py - y1);
  let t = ((px - x1) * dx + (py - y1) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
}

function isNearCurve(
  px: number, py: number,
  x0: number, y0: number,
  cx: number, cy: number,
  x1: number, y1: number,
  thickness: number
): boolean {
  // Approximate quadratic bezier with 5 segments
  let prevX = x0, prevY = y0;
  for (let i = 1; i <= 5; i++) {
    const t = i / 5;
    const invT = 1 - t;
    const bx = invT * invT * x0 + 2 * invT * t * cx + t * t * x1;
    const by = invT * invT * y0 + 2 * invT * t * cy + t * t * y1;
    if (distToSegment(px, py, prevX, prevY, bx, by) < thickness) return true;
    prevX = bx;
    prevY = by;
  }
  return false;
}

/* ── Build OpenClaw shape ── */
function buildClawShape(width: number, height: number) {
  const cx = width / 2;
  const cy = height / 2;

  // Scale based on canvas size
  const scale = Math.min(width, height) / 600;
  const bodyR = 110 * scale;

  // Eye positions & sizes
  const eyeR = 12 * scale;
  const eyeOffX = 28 * scale;
  const eyeY = cy - 18 * scale;
  const pupilR = 6 * scale;

  // Antenna
  const antennaLen = 50 * scale;
  const antennaSpread = 25 * scale;
  const antennaThick = 6 * scale;

  // Arms (small round bumps on sides)
  const armR = 28 * scale;
  const armOffX = bodyR * 0.85;
  const armY = cy + 10 * scale;

  // Legs
  const legW = 10 * scale;
  const legH = 30 * scale;
  const legSpread = 30 * scale;
  const legTop = cy + bodyR * 0.75;

  const particles: Particle[] = [];
  const cols = Math.ceil(width / SPACING);
  const rows = Math.ceil(height / SPACING);

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const x = col * SPACING + (Math.random() - 0.5) * 3;
      const y = row * SPACING + (Math.random() - 0.5) * 3;

      let group: Particle["group"] = "bg";
      let alpha = 0.06 + Math.random() * 0.04;

      // Left eye pupil
      if (isInsideCircle(x, y, cx - eyeOffX, eyeY, pupilR)) {
        group = "eye-left";
        alpha = 0.85 + Math.random() * 0.15;
      }
      // Right eye pupil
      else if (isInsideCircle(x, y, cx + eyeOffX, eyeY, pupilR)) {
        group = "eye-right";
        alpha = 0.85 + Math.random() * 0.15;
      }
      // Left eye socket (iris ring)
      else if (isInsideCircle(x, y, cx - eyeOffX, eyeY, eyeR)) {
        group = "eye-left";
        alpha = 0.5 + Math.random() * 0.3;
      }
      // Right eye socket
      else if (isInsideCircle(x, y, cx + eyeOffX, eyeY, eyeR)) {
        group = "eye-right";
        alpha = 0.5 + Math.random() * 0.3;
      }
      // Left antenna (curved line going up-left)
      else if (
        isNearCurve(
          x, y,
          cx - antennaSpread * 0.5, cy - bodyR * 0.85,
          cx - antennaSpread * 1.2, cy - bodyR - antennaLen * 0.6,
          cx - antennaSpread, cy - bodyR - antennaLen,
          antennaThick
        )
      ) {
        group = "antenna";
        alpha = 0.6 + Math.random() * 0.2;
      }
      // Right antenna
      else if (
        isNearCurve(
          x, y,
          cx + antennaSpread * 0.5, cy - bodyR * 0.85,
          cx + antennaSpread * 1.2, cy - bodyR - antennaLen * 0.6,
          cx + antennaSpread, cy - bodyR - antennaLen,
          antennaThick
        )
      ) {
        group = "antenna";
        alpha = 0.6 + Math.random() * 0.2;
      }
      // Left arm
      else if (isInsideEllipse(x, y, cx - armOffX, armY, armR, armR * 0.8)) {
        group = "arm";
        alpha = 0.4 + Math.random() * 0.25;
      }
      // Right arm
      else if (isInsideEllipse(x, y, cx + armOffX, armY, armR, armR * 0.8)) {
        group = "arm";
        alpha = 0.4 + Math.random() * 0.25;
      }
      // Legs (3 small rectangles)
      else if (
        y > legTop && y < legTop + legH &&
        (
          (Math.abs(x - (cx - legSpread)) < legW) ||
          (Math.abs(x - cx) < legW) ||
          (Math.abs(x - (cx + legSpread)) < legW)
        )
      ) {
        group = "leg";
        alpha = 0.35 + Math.random() * 0.2;
      }
      // Body (main round shape, slightly taller than wide)
      else if (isInsideEllipse(x, y, cx, cy, bodyR, bodyR * 1.15)) {
        group = "body";
        // Denser near edges for outline effect
        const dist = Math.hypot((x - cx) / bodyR, (y - cy) / (bodyR * 1.15));
        if (dist > 0.85) {
          alpha = 0.5 + Math.random() * 0.3;
        } else {
          alpha = 0.2 + Math.random() * 0.15;
        }
      }

      particles.push({
        x: x + (Math.random() - 0.5) * width * 0.6,
        y: y + (Math.random() - 0.5) * height * 0.6,
        baseX: x,
        baseY: y,
        targetX: x,
        targetY: y,
        vx: 0,
        vy: 0,
        friction: 0.82 + Math.random() * 0.06,
        ease: 0.06 + Math.random() * 0.04,
        char: CHARS[Math.floor(Math.random() * CHARS.length)],
        alpha,
        group,
      });
    }
  }

  return { particles, eyeOffX, eyeY, eyeR, pupilR };
}

export default function OpenClawParticleCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const animRef = useRef(0);
  const mouseRef = useRef({ x: -9999, y: -9999 });
  const particlesRef = useRef<Particle[]>([]);
  const blinkStateRef = useRef<BlinkState>("OPEN");
  const blinkProgressRef = useRef(0);
  const timeRef = useRef(0);
  const blinkTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const initializedRef = useRef(false);
  const sizeRef = useRef({ w: 0, h: 0 });
  const eyeMetaRef = useRef({ eyeOffX: 0, eyeY: 0, eyeR: 0, pupilR: 0 });

  const init = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return;

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

    const { particles, eyeOffX, eyeY, eyeR, pupilR } = buildClawShape(w, h);
    particlesRef.current = particles;
    eyeMetaRef.current = { eyeOffX, eyeY, eyeR, pupilR };
    initializedRef.current = true;
  }, []);

  useEffect(() => {
    init();

    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!canvas || !container) return;

    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return;

    const onMouseMove = (e: MouseEvent) => {
      const rect = container.getBoundingClientRect();
      mouseRef.current.x = e.clientX - rect.left;
      mouseRef.current.y = e.clientY - rect.top;
    };
    const onMouseLeave = () => {
      mouseRef.current = { x: -9999, y: -9999 };
    };
    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length > 0) {
        const rect = container.getBoundingClientRect();
        mouseRef.current.x = e.touches[0].clientX - rect.left;
        mouseRef.current.y = e.touches[0].clientY - rect.top;
      }
    };

    container.addEventListener("mousemove", onMouseMove);
    container.addEventListener("mouseleave", onMouseLeave);
    container.addEventListener("touchmove", onTouchMove);
    window.addEventListener("resize", init);

    // Blink timer
    const scheduleBlink = () => {
      const delay = 2500 + Math.random() * 3500;
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

      const { w, h } = sizeRef.current;
      ctx.clearRect(0, 0, w, h);

      timeRef.current += 0.012;
      const floatY = Math.sin(timeRef.current) * 5;
      const floatX = Math.cos(timeRef.current * 0.6) * 2;

      const centerX = w / 2;
      const centerY = h / 2;
      const mx = mouseRef.current.x;
      const my = mouseRef.current.y;

      // Eye tracking
      const { eyeOffX, eyeY } = eyeMetaRef.current;
      const leftEyeCx = centerX - eyeOffX;
      const rightEyeCx = centerX + eyeOffX;

      const angleToCursorL = Math.atan2(my - eyeY, mx - leftEyeCx);
      const angleToCursorR = Math.atan2(my - eyeY, mx - rightEyeCx);
      const distL = Math.hypot(mx - leftEyeCx, my - eyeY);
      const distR = Math.hypot(mx - rightEyeCx, my - eyeY);
      const maxOffset = 8;
      const pupilOffLX = Math.cos(angleToCursorL) * Math.min(distL / 300, 1) * maxOffset;
      const pupilOffLY = Math.sin(angleToCursorL) * Math.min(distL / 300, 1) * maxOffset;
      const pupilOffRX = Math.cos(angleToCursorR) * Math.min(distR / 300, 1) * maxOffset;
      const pupilOffRY = Math.sin(angleToCursorR) * Math.min(distR / 300, 1) * maxOffset;

      // Blink state machine
      const blinkSpeed = 0.1;
      switch (blinkStateRef.current) {
        case "CLOSING":
          blinkProgressRef.current += blinkSpeed;
          if (blinkProgressRef.current >= 1) {
            blinkProgressRef.current = 1;
            blinkStateRef.current = "CLOSED";
            setTimeout(() => {
              blinkStateRef.current = "OPENING";
            }, 50 + Math.random() * 40);
          }
          break;
        case "OPENING":
          blinkProgressRef.current -= blinkSpeed * 0.8;
          if (blinkProgressRef.current <= 0) {
            blinkProgressRef.current = 0;
            blinkStateRef.current = "OPEN";
          }
          break;
      }

      const blinkT = blinkProgressRef.current;
      const particles = particlesRef.current;

      ctx.font = "11px monospace";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";

      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];

        let tx = p.baseX + floatX;
        let ty = p.baseY + floatY;

        if (p.group === "bg") {
          tx = p.baseX + floatX * 0.2;
          ty = p.baseY + floatY * 0.2;
        }

        // Eye pupil tracking
        if (p.group === "eye-left" && mx > -9000) {
          tx += pupilOffLX * (1 - blinkT);
          ty += pupilOffLY * (1 - blinkT);
        } else if (p.group === "eye-right" && mx > -9000) {
          tx += pupilOffRX * (1 - blinkT);
          ty += pupilOffRY * (1 - blinkT);
        }

        // Blink: eyes squish to horizontal line
        if ((p.group === "eye-left" || p.group === "eye-right") && blinkT > 0) {
          const eyeCx = p.group === "eye-left" ? leftEyeCx : rightEyeCx;
          const closedY = eyeY + floatY;
          ty = ty + (closedY - ty) * blinkT;
          tx = tx + (eyeCx + floatX - tx) * blinkT * 0.3;
        }

        p.targetX = tx;
        p.targetY = ty;

        // Cursor repulsion
        if (mx > -9000) {
          const dx = p.x - mx;
          const dy = p.y - my;
          const dist = Math.sqrt(dx * dx + dy * dy);
          const repulsionRadius = 100;

          if (dist < repulsionRadius && dist > 0) {
            const force = (repulsionRadius - dist) / repulsionRadius;
            const angle = Math.atan2(dy, dx);
            const strength = p.group === "bg" ? 2 : 5;
            p.vx += Math.cos(angle) * force * strength;
            p.vy += Math.sin(angle) * force * strength;
          }
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
        let drawAlpha = p.alpha;
        // Fade eyes during blink
        if ((p.group === "eye-left" || p.group === "eye-right") && blinkT > 0.7) {
          drawAlpha *= 1 - (blinkT - 0.7) / 0.3;
        }

        if (drawAlpha > 0.02) {
          ctx.fillStyle = `rgba(255, 255, 255, ${Math.min(drawAlpha, 1)})`;
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
      window.removeEventListener("resize", init);
    };
  }, [init]);

  return (
    <div ref={containerRef} className="relative w-full h-full cursor-crosshair">
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full"
        style={{ background: "transparent" }}
      />
    </div>
  );
}
