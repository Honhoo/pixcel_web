import { memo, useEffect, useRef } from "react";
import "./DotField.css";

type DotFieldProps = {
  dotRadius?: number;
  dotSpacing?: number;
  cursorRadius?: number;
  cursorForce?: number;
  bulgeOnly?: boolean;
  bulgeStrength?: number;
  glowRadius?: number;
  sparkle?: boolean;
  waveAmplitude?: number;
  gradientFrom?: string;
  gradientTo?: string;
  glowColor?: string;
  className?: string;
};

type Dot = {
  ax: number;
  ay: number;
  sx: number;
  sy: number;
  vx: number;
  vy: number;
  x: number;
  y: number;
};

const twoPi = Math.PI * 2;

const DotField = memo(function DotField({
  dotRadius = 1.7,
  dotSpacing = 17,
  cursorRadius = 440,
  cursorForce = 0.1,
  bulgeOnly = true,
  bulgeStrength = 62,
  glowRadius = 220,
  sparkle = false,
  waveAmplitude = 1.2,
  gradientFrom = "rgba(182, 255, 0, 0.36)",
  gradientTo = "rgba(54, 120, 0, 0.18)",
  glowColor = "rgba(182, 255, 0, 0.24)",
  className = "",
}: DotFieldProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const glowRef = useRef<SVGCircleElement | null>(null);
  const dotsRef = useRef<Dot[]>([]);
  const mouseRef = useRef({ x: -9999, y: -9999, prevX: -9999, prevY: -9999, speed: 0 });
  const frameRef = useRef(0);
  const sizeRef = useRef({ w: 0, h: 0, offsetX: 0, offsetY: 0 });
  const glowOpacityRef = useRef(0);
  const engagementRef = useRef(0);
  const rebuildRef = useRef<(() => void) | null>(null);
  const glowIdRef = useRef(`dot-field-glow-${Math.random().toString(36).slice(2, 9)}`);

  useEffect(() => {
    const canvas = canvasRef.current;
    const glow = glowRef.current;
    const parent = canvas?.parentElement;
    if (!canvas || !parent) return;

    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let resizeTimer = 0;
    let speedTimer = 0;
    let frameCount = 0;

    const buildDots = (w: number, h: number) => {
      const step = dotRadius + dotSpacing;
      const cols = Math.max(1, Math.floor(w / step));
      const rows = Math.max(1, Math.floor(h / step));
      const padX = (w % step) / 2;
      const padY = (h % step) / 2;
      const dots: Dot[] = [];

      for (let row = 0; row < rows; row += 1) {
        for (let col = 0; col < cols; col += 1) {
          const ax = padX + col * step + step / 2;
          const ay = padY + row * step + step / 2;
          dots.push({ ax, ay, sx: ax, sy: ay, vx: 0, vy: 0, x: ax, y: ay });
        }
      }

      dotsRef.current = dots;
    };

    const doResize = () => {
      const rect = parent.getBoundingClientRect();
      const w = Math.max(1, rect.width);
      const h = Math.max(1, rect.height);

      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      sizeRef.current = {
        w,
        h,
        offsetX: rect.left + window.scrollX,
        offsetY: rect.top + window.scrollY,
      };

      buildDots(w, h);
    };

    const resize = () => {
      window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(doResize, 100);
    };

    const onMouseMove = (event: MouseEvent) => {
      const s = sizeRef.current;
      mouseRef.current.x = event.pageX - s.offsetX;
      mouseRef.current.y = event.pageY - s.offsetY;
    };

    const updateMouseSpeed = () => {
      const mouse = mouseRef.current;
      const dx = mouse.prevX - mouse.x;
      const dy = mouse.prevY - mouse.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      mouse.speed += (dist - mouse.speed) * 0.5;
      if (mouse.speed < 0.001) mouse.speed = 0;
      mouse.prevX = mouse.x;
      mouse.prevY = mouse.y;
    };

    const tick = () => {
      frameCount += 1;
      const dots = dotsRef.current;
      const mouse = mouseRef.current;
      const { w, h } = sizeRef.current;
      const time = frameCount * 0.02;

      const targetEngagement = Math.min(mouse.speed / 5, 1);
      engagementRef.current += (targetEngagement - engagementRef.current) * 0.06;
      if (engagementRef.current < 0.001) engagementRef.current = 0;
      const engagement = engagementRef.current;

      glowOpacityRef.current += (engagement - glowOpacityRef.current) * 0.08;
      if (glow) {
        glow.setAttribute("cx", String(mouse.x));
        glow.setAttribute("cy", String(mouse.y));
        glow.style.opacity = String(glowOpacityRef.current);
      }

      ctx.clearRect(0, 0, w, h);
      const grad = ctx.createLinearGradient(0, 0, w, h);
      grad.addColorStop(0, gradientFrom);
      grad.addColorStop(1, gradientTo);
      ctx.fillStyle = grad;

      const cursorRadiusSq = cursorRadius * cursorRadius;
      const radius = dotRadius / 2;
      ctx.beginPath();

      for (let i = 0; i < dots.length; i += 1) {
        const dot = dots[i];
        const dx = mouse.x - dot.ax;
        const dy = mouse.y - dot.ay;
        const distSq = dx * dx + dy * dy;

        if (distSq < cursorRadiusSq && engagement > 0.01) {
          const dist = Math.sqrt(distSq);
          if (bulgeOnly) {
            const t = 1 - dist / cursorRadius;
            const push = t * t * bulgeStrength * engagement;
            const angle = Math.atan2(dy, dx);
            dot.sx += (dot.ax - Math.cos(angle) * push - dot.sx) * 0.15;
            dot.sy += (dot.ay - Math.sin(angle) * push - dot.sy) * 0.15;
          } else {
            const angle = Math.atan2(dy, dx);
            const move = (500 / Math.max(dist, 1)) * (mouse.speed * cursorForce);
            dot.vx += Math.cos(angle) * -move;
            dot.vy += Math.sin(angle) * -move;
          }
        } else if (bulgeOnly) {
          dot.sx += (dot.ax - dot.sx) * 0.1;
          dot.sy += (dot.ay - dot.sy) * 0.1;
        }

        if (!bulgeOnly) {
          dot.vx *= 0.9;
          dot.vy *= 0.9;
          dot.x = dot.ax + dot.vx;
          dot.y = dot.ay + dot.vy;
          dot.sx += (dot.x - dot.sx) * 0.1;
          dot.sy += (dot.y - dot.sy) * 0.1;
        }

        let drawX = dot.sx;
        let drawY = dot.sy;
        if (waveAmplitude > 0) {
          drawY += Math.sin(dot.ax * 0.03 + time) * waveAmplitude;
          drawX += Math.cos(dot.ay * 0.03 + time * 0.7) * waveAmplitude * 0.5;
        }

        if (sparkle) {
          const hash = ((i * 2654435761) ^ (frameCount >> 3)) >>> 0;
          const sparkleRadius = hash % 100 < 3 ? radius * 1.8 : radius;
          ctx.moveTo(drawX + sparkleRadius, drawY);
          ctx.arc(drawX, drawY, sparkleRadius, 0, twoPi);
        } else {
          ctx.moveTo(drawX + radius, drawY);
          ctx.arc(drawX, drawY, radius, 0, twoPi);
        }
      }

      ctx.fill();
      frameRef.current = requestAnimationFrame(tick);
    };

    doResize();
    speedTimer = window.setInterval(updateMouseSpeed, 20);
    window.addEventListener("resize", resize);
    window.addEventListener("mousemove", onMouseMove, { passive: true });
    frameRef.current = requestAnimationFrame(tick);
    rebuildRef.current = () => buildDots(sizeRef.current.w, sizeRef.current.h);

    return () => {
      cancelAnimationFrame(frameRef.current);
      window.clearInterval(speedTimer);
      window.clearTimeout(resizeTimer);
      window.removeEventListener("resize", resize);
      window.removeEventListener("mousemove", onMouseMove);
    };
  }, [
    bulgeOnly,
    bulgeStrength,
    cursorForce,
    cursorRadius,
    dotRadius,
    dotSpacing,
    gradientFrom,
    gradientTo,
    sparkle,
    waveAmplitude,
  ]);

  useEffect(() => {
    rebuildRef.current?.();
  }, [dotRadius, dotSpacing]);

  return (
    <div className={`dot-field-container ${className}`}>
      <canvas ref={canvasRef} />
      <svg aria-hidden="true" className="dot-field-glow">
        <defs>
          <radialGradient id={glowIdRef.current}>
            <stop offset="0%" stopColor={glowColor} />
            <stop offset="100%" stopColor="transparent" />
          </radialGradient>
        </defs>
        <circle ref={glowRef} cx="-9999" cy="-9999" r={glowRadius} fill={`url(#${glowIdRef.current})`} />
      </svg>
    </div>
  );
});

export default DotField;
