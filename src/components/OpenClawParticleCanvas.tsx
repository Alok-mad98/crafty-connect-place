import { useEffect, useRef } from "react";

/*
 * OpenClaw Particle Canvas
 * Image-sampled particle lobster with spring physics,
 * eye tracking, blinking, cursor disturbance, idle float.
 */

interface Particle {
  x: number;
  y: number;
  targetX: number;
  targetY: number;
  baseTargetX: number;
  baseTargetY: number;
  vx: number;
  vy: number;
  char: string;
  alpha: number;
}

interface EyeParticle {
  x: number;
  y: number;
  targetX: number;
  targetY: number;
  openX: number;
  openY: number;
  closedX: number;
  closedY: number;
  vx: number;
  vy: number;
  char: string;
  isPupil: boolean;
}

type BlinkState = "OPEN" | "CLOSING" | "CLOSED" | "OPENING";

const CHARS = ["0", "1", "2", "3", "4", "5"];
const SPRING = 0.08;
const FRICTION = 0.88;
const GRID = 7;

function randomChar() {
  return CHARS[Math.floor(Math.random() * CHARS.length)];
}

export default function OpenClawParticleCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const animRef = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;
    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return;

    let destroyed = false;

    // State
    const mouse = { x: -9999, y: -9999 };
    let bodyParticles: Particle[] = [];
    let leftEye: EyeParticle[] = [];
    let rightEye: EyeParticle[] = [];
    let blinkState: BlinkState = "OPEN";
    let blinkT = 0; // 0 = open, 1 = closed
    let time = 0;
    let blinkTimer: ReturnType<typeof setTimeout> | null = null;

    // Eye centers (in canvas coords, set after image load)
    let leftEyeCenter = { x: 0, y: 0 };
    let rightEyeCenter = { x: 0, y: 0 };

    // ── Resize ──
    function resize() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const rect = container!.getBoundingClientRect();
      canvas!.width = rect.width * dpr;
      canvas!.height = rect.height * dpr;
      canvas!.style.width = `${rect.width}px`;
      canvas!.style.height = `${rect.height}px`;
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
      return { w: rect.width, h: rect.height };
    }

    let size = resize();

    // ── Load image and sample ──
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = "/lobster-ref.webp";

    img.onload = () => {
      if (destroyed) return;
      sampleImage();
    };

    function sampleImage() {
      const { w, h } = size;
      // Offscreen canvas to read pixels
      const oc = document.createElement("canvas");
      const octx = oc.getContext("2d")!;
      oc.width = img.naturalWidth;
      oc.height = img.naturalHeight;
      octx.drawImage(img, 0, 0);
      const imgData = octx.getImageData(0, 0, oc.width, oc.height);
      const pixels = imgData.data;
      const iw = oc.width;
      const ih = oc.height;

      // Scale to fit canvas
      const scale = Math.min(w / iw, h / ih) * 0.7;
      const scaledW = iw * scale;
      const scaledH = ih * scale;
      const offsetX = (w - scaledW) / 2;
      const offsetY = (h - scaledH) / 2;

      // Detect eye regions heuristically:
      // Eyes are roughly in upper-middle area of lobster. 
      // We'll define eye circles in image-local coords and create separate particles.
      // Approximate eye positions (relative to image, normalized 0-1):
      const leftEyeNorm = { x: 0.41, y: 0.28, r: 0.035 };
      const rightEyeNorm = { x: 0.59, y: 0.28, r: 0.035 };
      const pupilR = 0.015;

      leftEyeCenter = {
        x: offsetX + leftEyeNorm.x * scaledW,
        y: offsetY + leftEyeNorm.y * scaledH,
      };
      rightEyeCenter = {
        x: offsetX + rightEyeNorm.x * scaledW,
        y: offsetY + rightEyeNorm.y * scaledH,
      };

      const eyeRadiusPx = leftEyeNorm.r * scaledW;
      const pupilRadiusPx = pupilR * scaledW;

      // Sample body particles
      const newBody: Particle[] = [];
      const threshold = 180;

      for (let iy = 0; iy < ih; iy += GRID) {
        for (let ix = 0; ix < iw; ix += GRID) {
          const idx = (iy * iw + ix) * 4;
          const r = pixels[idx];
          const g = pixels[idx + 1];
          const b = pixels[idx + 2];
          const a = pixels[idx + 3];
          if (a < 30) continue;

          const brightness = 0.299 * r + 0.587 * g + 0.114 * b;
          if (brightness > threshold) continue;

          const tx = offsetX + ix * scale;
          const ty = offsetY + iy * scale;

          // Skip eye regions for body
          const dxL = tx - leftEyeCenter.x;
          const dyL = ty - leftEyeCenter.y;
          const dxR = tx - rightEyeCenter.x;
          const dyR = ty - rightEyeCenter.y;
          if (dxL * dxL + dyL * dyL < eyeRadiusPx * eyeRadiusPx * 1.5) continue;
          if (dxR * dxR + dyR * dyR < eyeRadiusPx * eyeRadiusPx * 1.5) continue;

          // Alpha based on brightness
          const alphaVal = 0.3 + (1 - brightness / threshold) * 0.7;

          newBody.push({
            x: tx + (Math.random() - 0.5) * w * 0.5,
            y: ty + (Math.random() - 0.5) * h * 0.5,
            targetX: tx,
            targetY: ty,
            baseTargetX: tx,
            baseTargetY: ty,
            vx: 0,
            vy: 0,
            char: randomChar(),
            alpha: Math.min(alphaVal, 1),
          });
        }
      }

      bodyParticles = newBody;

      // Create eye particles
      leftEye = createEyeParticles(leftEyeCenter, eyeRadiusPx, pupilRadiusPx, w, h);
      rightEye = createEyeParticles(rightEyeCenter, eyeRadiusPx, pupilRadiusPx, w, h);
    }

    function createEyeParticles(
      center: { x: number; y: number },
      radius: number,
      pupilRadius: number,
      _w: number,
      _h: number
    ): EyeParticle[] {
      const particles: EyeParticle[] = [];
      const step = 4;
      // Open: filled circle
      // Closed: thin horizontal line
      for (let dy = -radius; dy <= radius; dy += step) {
        for (let dx = -radius; dx <= radius; dx += step) {
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist > radius) continue;

          const openX = center.x + dx;
          const openY = center.y + dy;
          // Closed: squish Y to 0, keep X
          const closedX = center.x + dx;
          const closedY = center.y;

          const isPupil = dist < pupilRadius;

          particles.push({
            x: openX + (Math.random() - 0.5) * 200,
            y: openY + (Math.random() - 0.5) * 200,
            targetX: openX,
            targetY: openY,
            openX,
            openY,
            closedX,
            closedY,
            vx: 0,
            vy: 0,
            char: randomChar(),
            isPupil,
          });
        }
      }
      return particles;
    }

    // ── Events ──
    const onMouseMove = (e: MouseEvent) => {
      const rect = container!.getBoundingClientRect();
      mouse.x = e.clientX - rect.left;
      mouse.y = e.clientY - rect.top;
    };
    const onMouseLeave = () => {
      mouse.x = -9999;
      mouse.y = -9999;
    };
    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length > 0) {
        const rect = container!.getBoundingClientRect();
        mouse.x = e.touches[0].clientX - rect.left;
        mouse.y = e.touches[0].clientY - rect.top;
      }
    };

    container.addEventListener("mousemove", onMouseMove);
    container.addEventListener("mouseleave", onMouseLeave);
    container.addEventListener("touchmove", onTouchMove);

    const onResize = () => {
      size = resize();
      if (img.complete && img.naturalWidth > 0) sampleImage();
    };
    window.addEventListener("resize", onResize);

    // ── Blink timer ──
    function scheduleBlink() {
      const delay = 3000 + Math.random() * 2000;
      blinkTimer = setTimeout(() => {
        if (blinkState === "OPEN") blinkState = "CLOSING";
        if (!destroyed) scheduleBlink();
      }, delay);
    }
    scheduleBlink();

    // ── Animation ──
    function animate() {
      if (destroyed) return;
      const { w, h } = size;
      ctx!.clearRect(0, 0, w, h);

      time += 0.02;
      const floatY = Math.sin(time) * 4;
      const floatX = Math.cos(time * 0.6) * 1.5;

      // Blink state machine (180ms total, 60ms closed)
      const blinkSpeed = 0.12;
      switch (blinkState) {
        case "CLOSING":
          blinkT += blinkSpeed;
          if (blinkT >= 1) {
            blinkT = 1;
            blinkState = "CLOSED";
            setTimeout(() => {
              if (!destroyed) blinkState = "OPENING";
            }, 60);
          }
          break;
        case "OPENING":
          blinkT -= blinkSpeed * 0.8;
          if (blinkT <= 0) {
            blinkT = 0;
            blinkState = "OPEN";
          }
          break;
      }

      // Pupil tracking
      const mx = mouse.x;
      const my = mouse.y;
      const maxPupilOffset = 6;

      function getPupilOffset(eyeCenter: { x: number; y: number }) {
        if (mx < -9000) return { ox: 0, oy: 0 };
        const angle = Math.atan2(my - eyeCenter.y, mx - eyeCenter.x);
        const dist = Math.hypot(mx - eyeCenter.x, my - eyeCenter.y);
        const t = Math.min(dist / 300, 1);
        return {
          ox: Math.cos(angle) * t * maxPupilOffset,
          oy: Math.sin(angle) * t * maxPupilOffset,
        };
      }

      const pupilOffL = getPupilOffset(leftEyeCenter);
      const pupilOffR = getPupilOffset(rightEyeCenter);

      ctx!.font = "12px monospace";
      ctx!.textAlign = "center";
      ctx!.textBaseline = "middle";

      // ── Update & draw body ──
      for (let i = 0; i < bodyParticles.length; i++) {
        const p = bodyParticles[i];
        p.targetX = p.baseTargetX + floatX;
        p.targetY = p.baseTargetY + floatY;

        // Cursor disturbance
        if (mx > -9000) {
          const dx = p.x - mx;
          const dy = p.y - my;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 120 && dist > 0) {
            const force = (120 - dist) / 120;
            p.vx += (dx / dist) * force * 4;
            p.vy += (dy / dist) * force * 4;
          }
        }

        // Spring physics
        const dx = p.targetX - p.x;
        const dy = p.targetY - p.y;
        p.vx += dx * SPRING;
        p.vy += dy * SPRING;
        p.vx *= FRICTION;
        p.vy *= FRICTION;
        p.x += p.vx;
        p.y += p.vy;

        if (p.alpha > 0.02) {
          ctx!.fillStyle = `rgba(255,255,255,${p.alpha})`;
          ctx!.fillText(p.char, p.x, p.y);
        }
      }

      // ── Update & draw eyes ──
      function updateEyes(eyes: EyeParticle[], pupilOff: { ox: number; oy: number }) {
        for (let i = 0; i < eyes.length; i++) {
          const p = eyes[i];

          // Morph between open and closed based on blinkT
          const baseX = p.openX + (p.closedX - p.openX) * blinkT;
          const baseY = p.openY + (p.closedY - p.openY) * blinkT;

          if (p.isPupil) {
            p.targetX = baseX + pupilOff.ox * (1 - blinkT) + floatX;
            p.targetY = baseY + pupilOff.oy * (1 - blinkT) + floatY;
          } else {
            p.targetX = baseX + floatX;
            p.targetY = baseY + floatY;
          }

          // Cursor disturbance
          if (mx > -9000) {
            const ddx = p.x - mx;
            const ddy = p.y - my;
            const dist = Math.sqrt(ddx * ddx + ddy * ddy);
            if (dist < 120 && dist > 0) {
              const force = (120 - dist) / 120;
              p.vx += (ddx / dist) * force * 4;
              p.vy += (ddy / dist) * force * 4;
            }
          }

          const ddx = p.targetX - p.x;
          const ddy = p.targetY - p.y;
          p.vx += ddx * SPRING;
          p.vy += ddy * SPRING;
          p.vx *= FRICTION;
          p.vy *= FRICTION;
          p.x += p.vx;
          p.y += p.vy;

          const alpha = p.isPupil ? 0.95 : 0.6;
          ctx!.fillStyle = `rgba(255,255,255,${alpha})`;
          ctx!.fillText(p.char, p.x, p.y);
        }
      }

      updateEyes(leftEye, pupilOffL);
      updateEyes(rightEye, pupilOffR);

      animRef.current = requestAnimationFrame(animate);
    }

    animRef.current = requestAnimationFrame(animate);

    return () => {
      destroyed = true;
      cancelAnimationFrame(animRef.current);
      if (blinkTimer) clearTimeout(blinkTimer);
      container.removeEventListener("mousemove", onMouseMove);
      container.removeEventListener("mouseleave", onMouseLeave);
      container.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("resize", onResize);
    };
  }, []);

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
