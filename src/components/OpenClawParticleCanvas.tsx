"use client";

import { useEffect, useRef, useCallback } from "react";

/*
 * OpenClaw Particle Canvas
 * Lobster-crab character with:
 * – Round head with ear bumps
 * – One bent antenna with ball tip
 * – Two big dark eyes that blink & track cursor
 * – Body/torso
 * – Two large claws (pincers)
 * – 6 legs underneath
 * – Segmented tail curving right
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
const SPACING = 12;

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

function isNearLine(px: number, py: number, x1: number, y1: number, x2: number, y2: number, thick: number): boolean {
  return distToSegment(px, py, x1, y1, x2, y2) < thick;
}

function isNearCurve(
  px: number, py: number,
  x0: number, y0: number,
  cpx: number, cpy: number,
  x1: number, y1: number,
  thickness: number
): boolean {
  let prevX = x0, prevY = y0;
  for (let i = 1; i <= 8; i++) {
    const t = i / 8;
    const invT = 1 - t;
    const bx = invT * invT * x0 + 2 * invT * t * cpx + t * t * x1;
    const by = invT * invT * y0 + 2 * invT * t * cpy + t * t * y1;
    if (distToSegment(px, py, prevX, prevY, bx, by) < thickness) return true;
    prevX = bx;
    prevY = by;
  }
  return false;
}

/* ── Claw/pincer shape ── */
function isInsideClaw(
  px: number, py: number,
  baseX: number, baseY: number,
  scale: number,
  flipX: boolean
): boolean {
  const f = flipX ? -1 : 1;
  // Upper pincer (arm extending out)
  const armCx = baseX + f * 45 * scale;
  const armCy = baseY;
  if (isInsideEllipse(px, py, armCx, armCy, 30 * scale, 18 * scale)) return true;
  // Upper jaw
  const jawTopCx = armCx + f * 28 * scale;
  const jawTopCy = armCy - 12 * scale;
  if (isInsideEllipse(px, py, jawTopCx, jawTopCy, 22 * scale, 8 * scale)) return true;
  // Lower jaw
  const jawBotCx = armCx + f * 28 * scale;
  const jawBotCy = armCy + 10 * scale;
  if (isInsideEllipse(px, py, jawBotCx, jawBotCy, 20 * scale, 7 * scale)) return true;
  return false;
}

/* ── Build shape ── */
function buildClawShape(width: number, height: number) {
  const cx = width / 2;
  const cy = height / 2;
  const scale = Math.min(width, height) / 650;

  // HEAD — wide round, slightly flat on top
  const headRx = 85 * scale;
  const headRy = 70 * scale;
  const headY = cy - 45 * scale;

  // EAR BUMPS — on sides of head
  const earR = 22 * scale;
  const earOffX = headRx * 0.82;
  const earY = headY - 15 * scale;

  // EYES — big round dark with white pupil highlight
  const eyeR = 18 * scale;
  const eyeOffX = 30 * scale;
  const eyeY = headY + 5 * scale;
  const pupilR = 8 * scale;

  // ANTENNA — one bent antenna on top-right with ball
  const antBaseX = cx + 15 * scale;
  const antBaseY = headY - headRy * 0.85;
  const antMidX = cx + 30 * scale;
  const antMidY = antBaseY - 40 * scale;
  const antTopX = cx + 45 * scale;
  const antTopY = antMidY - 25 * scale;
  const antBallR = 10 * scale;
  const antThick = 5 * scale;

  // BODY/TORSO — below head, slightly narrower
  const bodyRx = 55 * scale;
  const bodyRy = 50 * scale;
  const bodyY = cy + 35 * scale;

  // CLAWS — two big pincers
  const clawLBaseX = cx - headRx * 0.6;
  const clawLBaseY = cy + 10 * scale;
  const clawRBaseX = cx + headRx * 0.6;
  const clawRBaseY = cy + 10 * scale;

  // LEGS — 6 legs (3 per side), angled downward
  const legThick = 5 * scale;
  const legLen = 35 * scale;
  const legStartY = bodyY;
  const legSpacingY = 18 * scale;

  // TAIL — segmented, curving to the right
  const tailSegments = 4;
  const tailSegRx = 22 * scale;
  const tailSegRy = 12 * scale;

  const particles: Particle[] = [];
  const cols = Math.ceil(width / SPACING);
  const rows = Math.ceil(height / SPACING);

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const x = col * SPACING + (Math.random() - 0.5) * 2;
      const y = row * SPACING + (Math.random() - 0.5) * 2;

      let group: Particle["group"] = "bg";
      let alpha = 0.05 + Math.random() * 0.04;

      // ── EYES (check first for layering priority) ──

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
      // Left eye socket
      else if (isInsideCircle(x, y, cx - eyeOffX, eyeY, eyeR)) {
        group = "eye-left";
        alpha = 0.45 + Math.random() * 0.3;
      }
      // Right eye socket
      else if (isInsideCircle(x, y, cx + eyeOffX, eyeY, eyeR)) {
        group = "eye-right";
        alpha = 0.45 + Math.random() * 0.3;
      }

      // ── ANTENNA — bent line with ball tip ──
      else if (isInsideCircle(x, y, antTopX, antTopY, antBallR)) {
        group = "antenna";
        alpha = 0.7 + Math.random() * 0.2;
      }
      else if (
        isNearLine(x, y, antBaseX, antBaseY, antMidX, antMidY, antThick) ||
        isNearLine(x, y, antMidX, antMidY, antTopX, antTopY, antThick)
      ) {
        group = "antenna";
        alpha = 0.55 + Math.random() * 0.2;
      }

      // ── EAR BUMPS ──
      else if (isInsideCircle(x, y, cx - earOffX, earY, earR)) {
        group = "body";
        alpha = 0.4 + Math.random() * 0.25;
      }
      else if (isInsideCircle(x, y, cx + earOffX, earY, earR)) {
        group = "body";
        alpha = 0.4 + Math.random() * 0.25;
      }

      // ── CLAWS ──
      else if (isInsideClaw(x, y, clawLBaseX, clawLBaseY, scale, false)) {
        group = "arm";
        alpha = 0.45 + Math.random() * 0.25;
      }
      else if (isInsideClaw(x, y, clawRBaseX, clawRBaseY, scale, true)) {
        group = "arm";
        alpha = 0.45 + Math.random() * 0.25;
      }

      // ── LEGS — 3 per side, angled outward ──
      else {
        let isLeg = false;
        for (let li = 0; li < 3; li++) {
          const ly = legStartY + li * legSpacingY;
          // Left legs (angled down-left)
          const lx1 = cx - bodyRx * 0.7;
          const ly1 = ly;
          const lx2 = lx1 - legLen;
          const ly2 = ly + legLen * 0.5;
          if (isNearLine(x, y, lx1, ly1, lx2, ly2, legThick)) {
            isLeg = true;
            break;
          }
          // Right legs (angled down-right)
          const rx1 = cx + bodyRx * 0.7;
          const ry1 = ly;
          const rx2 = rx1 + legLen;
          const ry2 = ly + legLen * 0.5;
          if (isNearLine(x, y, rx1, ry1, rx2, ry2, legThick)) {
            isLeg = true;
            break;
          }
        }
        if (isLeg) {
          group = "leg";
          alpha = 0.35 + Math.random() * 0.2;
        }

        // ── TAIL — segmented curve to the right ──
        else {
          let isTail = false;
          for (let si = 0; si < tailSegments; si++) {
            const segX = cx + (si + 1) * 20 * scale;
            const segY = bodyY + bodyRy * 0.6 + si * 14 * scale;
            const shrink = 1 - si * 0.12;
            if (isInsideEllipse(x, y, segX, segY, tailSegRx * shrink, tailSegRy * shrink)) {
              isTail = true;
              break;
            }
          }
          if (isTail) {
            group = "body";
            alpha = 0.35 + Math.random() * 0.2;
          }

          // ── HEAD ──
          else if (isInsideEllipse(x, y, cx, headY, headRx, headRy)) {
            group = "body";
            const dist = Math.hypot((x - cx) / headRx, (y - headY) / headRy);
            if (dist > 0.82) {
              alpha = 0.5 + Math.random() * 0.3; // edge outline
            } else {
              alpha = 0.18 + Math.random() * 0.12; // inner fill
            }
          }

          // ── BODY/TORSO ──
          else if (isInsideEllipse(x, y, cx, bodyY, bodyRx, bodyRy)) {
            group = "body";
            const dist = Math.hypot((x - cx) / bodyRx, (y - bodyY) / bodyRy);
            if (dist > 0.82) {
              alpha = 0.45 + Math.random() * 0.25;
            } else {
              alpha = 0.15 + Math.random() * 0.1;
            }
          }
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
