"use client";

import { useEffect, useRef, useCallback } from "react";

/*
 * OpenClaw Particle Canvas — Lobster character
 * Hand-coded geometry matching Eye/Computer canvas style.
 * Spring physics, eye tracking, blinking, cursor repulsion.
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
  group: "body" | "eye-left" | "eye-right" | "bg";
}

type BlinkState = "OPEN" | "CLOSING" | "CLOSED" | "OPENING";

const CHARS = "0123456789".split("");
const SPACING = 12;

function circle(x: number, y: number, cx: number, cy: number, r: number) {
  return (x - cx) ** 2 + (y - cy) ** 2 < r * r;
}

function ellipse(x: number, y: number, cx: number, cy: number, rx: number, ry: number) {
  return ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 < 1;
}

function line(px: number, py: number, x1: number, y1: number, x2: number, y2: number, t: number) {
  const dx = x2 - x1, dy = y2 - y1;
  const len2 = dx * dx + dy * dy;
  if (len2 === 0) return Math.hypot(px - x1, py - y1) < t;
  const s = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / len2));
  return Math.hypot(px - (x1 + s * dx), py - (y1 + s * dy)) < t;
}

function buildShape(w: number, h: number) {
  const cx = w / 2;
  const cy = h / 2;
  const s = Math.min(w, h) / 500; // scale factor

  // ── BODY ──
  const headRx = 60 * s, headRy = 50 * s;
  const headY = cy - 20 * s;

  const bodyRx = 42 * s, bodyRy = 38 * s;
  const bodyY = cy + 40 * s;

  // ── EARS (bumps on head sides) ──
  const earR = 16 * s;
  const earX = 52 * s;
  const earY = headY - 18 * s;

  // ── ANTENNA ──
  const antBase = { x: cx + 10 * s, y: headY - headRy * 0.85 };
  const antMid = { x: cx + 28 * s, y: antBase.y - 32 * s };
  const antTop = { x: cx + 38 * s, y: antMid.y - 20 * s };
  const antBall = 7 * s;
  const antThick = 4 * s;

  // ── EYES ──
  const eyeR = 14 * s;
  const eyeXoff = 22 * s;
  const eyeY = headY + 2 * s;
  const pupilR = 6 * s;

  // ── CLAWS ──
  // Each claw: arm ellipse + two jaw ellipses
  const clawArmRx = 24 * s, clawArmRy = 14 * s;
  const jawRx = 18 * s, jawRy = 6 * s;

  // ── LEGS ──
  const legThick = 4 * s;
  const legLen = 28 * s;

  // ── TAIL ──
  const tailSegs = 4;
  const tailRx = 18 * s, tailRy = 10 * s;

  const particles: Particle[] = [];
  const cols = Math.ceil(w / SPACING);
  const rows = Math.ceil(h / SPACING);

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x = c * SPACING + (Math.random() - 0.5) * 2;
      const y = r * SPACING + (Math.random() - 0.5) * 2;

      let group: Particle["group"] = "bg";
      let alpha = 0.05 + Math.random() * 0.04;

      // ── Eyes (highest priority) ──
      const inLPupil = circle(x, y, cx - eyeXoff, eyeY, pupilR);
      const inRPupil = circle(x, y, cx + eyeXoff, eyeY, pupilR);
      const inLEye = circle(x, y, cx - eyeXoff, eyeY, eyeR);
      const inREye = circle(x, y, cx + eyeXoff, eyeY, eyeR);

      if (inLPupil) { group = "eye-left"; alpha = 0.9; }
      else if (inRPupil) { group = "eye-right"; alpha = 0.9; }
      else if (inLEye) { group = "eye-left"; alpha = 0.5 + Math.random() * 0.2; }
      else if (inREye) { group = "eye-right"; alpha = 0.5 + Math.random() * 0.2; }

      // ── Antenna ──
      else if (circle(x, y, antTop.x, antTop.y, antBall)) {
        group = "body"; alpha = 0.65;
      }
      else if (
        line(x, y, antBase.x, antBase.y, antMid.x, antMid.y, antThick) ||
        line(x, y, antMid.x, antMid.y, antTop.x, antTop.y, antThick)
      ) {
        group = "body"; alpha = 0.5;
      }

      // ── Ear bumps ──
      else if (circle(x, y, cx - earX, earY, earR) || circle(x, y, cx + earX, earY, earR)) {
        group = "body"; alpha = 0.35 + Math.random() * 0.2;
      }

      // ── Claws (left & right) ──
      else if ((() => {
        for (const flip of [-1, 1]) {
          const armCx = cx + flip * 65 * s;
          const armCy = cy + 8 * s;
          if (ellipse(x, y, armCx, armCy, clawArmRx, clawArmRy)) return true;
          // Upper jaw
          if (ellipse(x, y, armCx + flip * 22 * s, armCy - 10 * s, jawRx, jawRy)) return true;
          // Lower jaw
          if (ellipse(x, y, armCx + flip * 20 * s, armCy + 8 * s, jawRx * 0.9, jawRy)) return true;
        }
        return false;
      })()) {
        group = "body"; alpha = 0.4 + Math.random() * 0.2;
      }

      // ── Legs (3 per side) ──
      else if ((() => {
        for (let li = 0; li < 3; li++) {
          const ly = bodyY - 5 * s + li * 14 * s;
          for (const flip of [-1, 1]) {
            const sx = cx + flip * bodyRx * 0.65;
            const ex = sx + flip * legLen;
            const ey = ly + legLen * 0.45;
            if (line(x, y, sx, ly, ex, ey, legThick)) return true;
          }
        }
        return false;
      })()) {
        group = "body"; alpha = 0.3 + Math.random() * 0.15;
      }

      // ── Tail segments ──
      else if ((() => {
        for (let ti = 0; ti < tailSegs; ti++) {
          const tx = cx + (ti + 1) * 16 * s;
          const ty = bodyY + bodyRy * 0.5 + ti * 11 * s;
          const shrink = 1 - ti * 0.15;
          if (ellipse(x, y, tx, ty, tailRx * shrink, tailRy * shrink)) return true;
        }
        return false;
      })()) {
        group = "body"; alpha = 0.3 + Math.random() * 0.15;
      }

      // ── Head ──
      else if (ellipse(x, y, cx, headY, headRx, headRy)) {
        const dist = Math.hypot((x - cx) / headRx, (y - headY) / headRy);
        group = "body";
        alpha = dist > 0.82 ? 0.5 + Math.random() * 0.25 : 0.15 + Math.random() * 0.1;
      }

      // ── Torso ──
      else if (ellipse(x, y, cx, bodyY, bodyRx, bodyRy)) {
        const dist = Math.hypot((x - cx) / bodyRx, (y - bodyY) / bodyRy);
        group = "body";
        alpha = dist > 0.82 ? 0.4 + Math.random() * 0.2 : 0.12 + Math.random() * 0.08;
      }

      particles.push({
        x: x + (Math.random() - 0.5) * w * 0.5,
        y: y + (Math.random() - 0.5) * h * 0.5,
        baseX: x, baseY: y,
        targetX: x, targetY: y,
        vx: 0, vy: 0,
        friction: 0.82 + Math.random() * 0.06,
        ease: 0.06 + Math.random() * 0.04,
        char: CHARS[Math.floor(Math.random() * CHARS.length)],
        alpha, group,
      });
    }
  }

  return { particles, eyeXoff, eyeY, eyeR, pupilR };
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
  const eyeMetaRef = useRef({ eyeXoff: 0, eyeY: 0, eyeR: 0, pupilR: 0 });

  const init = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;
    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const rect = container.getBoundingClientRect();
    const w = rect.width, h = rect.height;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    sizeRef.current = { w, h };

    const { particles, eyeXoff, eyeY, eyeR, pupilR } = buildShape(w, h);
    particlesRef.current = particles;
    eyeMetaRef.current = { eyeXoff, eyeY, eyeR, pupilR };
    initializedRef.current = true;
  }, []);

  useEffect(() => {
    init();
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!canvas || !container) return;
    const ctx = canvas.getContext("2d", { alpha: true })!;

    const onMM = (e: MouseEvent) => {
      const r = container.getBoundingClientRect();
      mouseRef.current = { x: e.clientX - r.left, y: e.clientY - r.top };
    };
    const onML = () => { mouseRef.current = { x: -9999, y: -9999 }; };
    const onTM = (e: TouchEvent) => {
      if (e.touches.length) {
        const r = container.getBoundingClientRect();
        mouseRef.current = { x: e.touches[0].clientX - r.left, y: e.touches[0].clientY - r.top };
      }
    };
    container.addEventListener("mousemove", onMM);
    container.addEventListener("mouseleave", onML);
    container.addEventListener("touchmove", onTM);
    window.addEventListener("resize", init);

    const scheduleBlink = () => {
      blinkTimerRef.current = setTimeout(() => {
        if (blinkStateRef.current === "OPEN") {
          blinkStateRef.current = "CLOSING";
          blinkProgressRef.current = 0;
        }
        scheduleBlink();
      }, 2500 + Math.random() * 3500);
    };
    scheduleBlink();

    const animate = () => {
      if (!initializedRef.current) { animRef.current = requestAnimationFrame(animate); return; }
      const { w, h } = sizeRef.current;
      ctx.clearRect(0, 0, w, h);
      timeRef.current += 0.012;

      const floatY = Math.sin(timeRef.current) * 4;
      const floatX = Math.cos(timeRef.current * 0.6) * 1.5;
      const centerX = w / 2;
      const mx = mouseRef.current.x, my = mouseRef.current.y;
      const { eyeXoff, eyeY } = eyeMetaRef.current;

      // Pupil offsets
      const maxOff = 7;
      const pupilOff = (ecx: number) => {
        if (mx < -9000) return { ox: 0, oy: 0 };
        const a = Math.atan2(my - eyeY, mx - ecx);
        const d = Math.min(Math.hypot(mx - ecx, my - eyeY) / 300, 1);
        return { ox: Math.cos(a) * d * maxOff, oy: Math.sin(a) * d * maxOff };
      };
      const pL = pupilOff(centerX - eyeXoff);
      const pR = pupilOff(centerX + eyeXoff);

      // Blink
      const bs = 0.1;
      switch (blinkStateRef.current) {
        case "CLOSING":
          blinkProgressRef.current += bs;
          if (blinkProgressRef.current >= 1) {
            blinkProgressRef.current = 1;
            blinkStateRef.current = "CLOSED";
            setTimeout(() => { blinkStateRef.current = "OPENING"; }, 55);
          }
          break;
        case "OPENING":
          blinkProgressRef.current -= bs * 0.8;
          if (blinkProgressRef.current <= 0) {
            blinkProgressRef.current = 0;
            blinkStateRef.current = "OPEN";
          }
          break;
      }
      const blinkT = blinkProgressRef.current;

      ctx.font = "11px monospace";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";

      const particles = particlesRef.current;
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        let tx = p.baseX + (p.group === "bg" ? floatX * 0.2 : floatX);
        let ty = p.baseY + (p.group === "bg" ? floatY * 0.2 : floatY);

        // Eye tracking
        if (p.group === "eye-left") { tx += pL.ox * (1 - blinkT); ty += pL.oy * (1 - blinkT); }
        if (p.group === "eye-right") { tx += pR.ox * (1 - blinkT); ty += pR.oy * (1 - blinkT); }

        // Blink squish
        if ((p.group === "eye-left" || p.group === "eye-right") && blinkT > 0) {
          const ecx = p.group === "eye-left" ? centerX - eyeXoff : centerX + eyeXoff;
          ty += (eyeY + floatY - ty) * blinkT;
          tx += (ecx + floatX - tx) * blinkT * 0.3;
        }

        p.targetX = tx;
        p.targetY = ty;

        // Cursor repulsion
        if (mx > -9000) {
          const dx = p.x - mx, dy = p.y - my;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 100 && dist > 0) {
            const f = (100 - dist) / 100;
            const str = p.group === "bg" ? 2 : 5;
            p.vx += (dx / dist) * f * str;
            p.vy += (dy / dist) * f * str;
          }
        }

        // Spring return
        p.vx += (p.targetX - p.x) * p.ease;
        p.vy += (p.targetY - p.y) * p.ease;
        p.vx *= p.friction;
        p.vy *= p.friction;
        p.x += p.vx;
        p.y += p.vy;

        let a = p.alpha;
        if ((p.group === "eye-left" || p.group === "eye-right") && blinkT > 0.7) {
          a *= 1 - (blinkT - 0.7) / 0.3;
        }
        if (a > 0.02) {
          ctx.fillStyle = `rgba(255,255,255,${Math.min(a, 1)})`;
          ctx.fillText(p.char, p.x, p.y);
        }
      }

      animRef.current = requestAnimationFrame(animate);
    };
    animRef.current = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(animRef.current);
      if (blinkTimerRef.current) clearTimeout(blinkTimerRef.current);
      container.removeEventListener("mousemove", onMM);
      container.removeEventListener("mouseleave", onML);
      container.removeEventListener("touchmove", onTM);
      window.removeEventListener("resize", init);
    };
  }, [init]);

  return (
    <div ref={containerRef} className="relative w-full h-full cursor-crosshair">
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" style={{ background: "transparent" }} />
    </div>
  );
}
