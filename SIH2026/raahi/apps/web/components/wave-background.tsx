"use client";
import { useEffect, useRef } from "react";

// A sheet of violet dots rolling into a wave, with a spray of particles over
// its crest, drawn on a canvas behind the top of every page. It drifts slowly,
// pauses when it is off screen or the tab is hidden, and holds still for
// people who prefer reduced motion.

const TAU = Math.PI * 2;
const LOW: [number, number, number] = [167, 139, 250];   // violet-400
const HIGH: [number, number, number] = [91, 33, 182];    // violet-800
const SPRAY = ["139,92,246", "167,139,250", "232,121,249"];   // violet-500, violet-400, fuchsia-400
const SHADES = 8;
const ALPHAS = 16;
const FPS = 24;
const ROWS = 60;

function smooth(a: number, b: number, x: number) {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

/** A small seeded generator, so the spray looks the same on every visit. */
function seeded(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// The wave's shape for the current screen: on narrow screens it sits lower and
// flatter, under the page title, with fewer rows and smaller dots.
const SHAPE = { base: 0.48, amp: 0.34, rise: 0.26, rows: ROWS, dot: 1 };
function fitShape(width: number) {
  const narrow = width < 640;
  SHAPE.base = narrow ? 0.58 : 0.48;
  SHAPE.amp = narrow ? 0.22 : 0.34;
  SHAPE.rise = narrow ? 0.16 : 0.26;
  SHAPE.rows = narrow ? 44 : ROWS;
  SHAPE.dot = narrow ? 0.8 : 1;
}

// Where the sheet is at (u across, v from far to near) at time t, written
// into P to avoid allocating thousands of objects per frame.
const P = { x: 0, y: 0, lift: 0 };
function surface(u: number, v: number, t: number, w: number, h: number) {
  const crest = Math.exp(-((u - 0.72) ** 2) / 0.05) * (1 - 0.55 * v);   // the lifted far edge
  const lobe = Math.exp(-((u - 0.24) ** 2) / 0.03) * (1 - 0.6 * v);     // a smaller swell on the left
  const swell = Math.sin(TAU * (u * 0.75 - v * 0.55) + t * 0.35);
  const ripple = Math.sin(TAU * (u * 2.2 + v * 1.6) - t * 0.6);
  const chop = Math.sin(TAU * (u * 3.7 - v * 0.9) + t * 0.8);
  const height = 0.72 * crest + 0.12 * lobe + 0.12 * swell + 0.045 * ripple + 0.03 * chop + 0.18 * u;
  P.x = w * 0.5 + (u - 0.5) * w * (1.1 + 0.3 * v);
  P.y = h * (SHAPE.base + 0.49 * v ** 0.9) - height * h * SHAPE.amp;   // kept low on the left, under page titles
  P.lift = Math.min(1, Math.max(0, height + 0.1));
}

type Particle = { u: number; v: number; rise: number; size: number; alpha: number; color: string; phase: number; dx: number };

function makeSpray(): { spray: Particle[]; glints: Particle[] } {
  const rand = seeded(7);
  const gauss = (mean: number, sd: number) =>
    mean + sd * Math.sqrt(-2 * Math.log(1 - rand())) * Math.cos(TAU * rand());
  const spray = Array.from({ length: 760 }, (_, i) => ({
    u: Math.min(0.99, Math.max(0.3, gauss(0.72, 0.13))),
    v: rand() * 0.4,
    rise: rand() ** 1.7,
    size: 1 + rand() * 1.7,
    alpha: 0.35 + 0.55 * rand(),
    color: SPRAY[i % 7 === 0 ? 2 : i % 2],
    phase: rand() * TAU,
    dx: (rand() - 0.5) * 16,
  }));
  const glints = Array.from({ length: 220 }, (_, i) => ({
    u: Math.min(0.99, Math.max(0.05, gauss(0.66, 0.2))),
    v: rand() * 0.8,
    rise: 0,
    size: 1.6 + rand() * 1.2,
    alpha: 0.35 + 0.5 * rand(),
    color: SPRAY[i % 2],
    phase: rand() * TAU,
    dx: 0,
  }));
  return { spray, glints };
}

export function WaveBackground() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    // fill styles for the sheet: SHADES colours × ALPHAS opacities
    const styles: string[] = [];
    for (let s = 0; s < SHADES; s++) {
      const k = s / (SHADES - 1);
      const rgb = LOW.map((c, i) => Math.round(c + (HIGH[i] - c) * k)).join(",");
      for (let a = 1; a <= ALPHAS; a++) styles.push(`rgba(${rgb},${(a / ALPHAS).toFixed(3)})`);
    }
    const { spray, glints } = makeSpray();
    let w = 0, h = 0, dpr = 1;

    function draw(t: number) {
      ctx!.clearRect(0, 0, canvas!.width, canvas!.height);
      const cols = Math.min(300, Math.round(w / 5.5));
      const rows = SHAPE.rows;
      let last = "";
      for (let r = 0; r < rows; r++) {
        const v = r / (rows - 1);
        const nearFade = 1 - 0.8 * smooth(0.6, 1, v);
        for (let c = 0; c < cols; c++) {
          const u = c / (cols - 1);
          surface(u, v, t, w, h);
          if (P.x < -4 || P.x > w + 4 || P.y < -4 || P.y > h + 4) continue;
          const fade = nearFade * (0.3 + 0.7 * smooth(-0.15, 0.4, u));
          const alpha = (0.22 + 0.68 * P.lift ** 1.1) * fade;
          const a = Math.min(ALPHAS, Math.round(alpha * ALPHAS));
          if (a < 1) continue;
          const shade = Math.round(Math.min(1, P.lift ** 1.1) * (SHADES - 1));
          const style = styles[shade * ALPHAS + a - 1];
          // neighbouring dots mostly share a style: only switch when it changes
          if (style !== last) {
            ctx!.fillStyle = style;
            last = style;
          }
          const size = (1 + 0.9 * (1 - v) * P.lift + 0.5 * v) * SHAPE.dot * dpr;
          ctx!.fillRect(Math.round(P.x * dpr - size / 2), Math.round(P.y * dpr - size / 2), size, size);
        }
      }
      // highlights on the sheet, then the spray above the crest
      for (const g of glints) {
        surface(g.u, g.v, t, w, h);
        ctx!.fillStyle = `rgba(${g.color},${(g.alpha * (0.3 + 0.7 * P.lift)).toFixed(3)})`;
        const size = g.size * SHAPE.dot * dpr;
        ctx!.fillRect(P.x * dpr - size / 2, P.y * dpr - size / 2, size, size);
      }
      for (const p of spray) {
        surface(p.u, p.v, t, w, h);
        const rise = p.rise * h * SHAPE.rise + 4 * Math.sin(t * 0.5 + p.phase);
        const alpha = p.alpha * (1 - Math.min(1, rise / (h * (SHAPE.rise + 0.04)))) * (0.55 + 0.45 * P.lift);
        if (alpha <= 0.01) continue;
        ctx!.fillStyle = `rgba(${p.color},${alpha.toFixed(3)})`;
        const size = p.size * SHAPE.dot * dpr;
        const x = P.x + p.dx + 5 * Math.sin(t * 0.3 + p.phase);
        ctx!.fillRect(x * dpr - size / 2, (P.y - rise) * dpr - size / 2, size, size);
      }
    }

    // ---- sizing, and when to animate ----
    const still = window.matchMedia("(prefers-reduced-motion: reduce)");
    let frame = 0;
    let visible = true;
    let lastDraw = 0;
    let t = 0;

    function resize() {
      dpr = Math.min(2, window.devicePixelRatio || 1);
      w = canvas!.clientWidth;
      h = canvas!.clientHeight;
      fitShape(w);
      canvas!.width = Math.round(w * dpr);
      canvas!.height = Math.round(h * dpr);
      draw(t);
    }

    function tick(now: number) {
      frame = requestAnimationFrame(tick);
      if (now - lastDraw < 1000 / FPS) return;
      t += (Math.min(now - lastDraw, 100) / 1000) * 0.6;   // seconds, gently slowed
      lastDraw = now;
      draw(t);
    }

    function update() {
      const run = visible && !document.hidden && !still.matches;
      if (run && !frame) {
        lastDraw = performance.now();
        frame = requestAnimationFrame(tick);
      } else if (!run && frame) {
        cancelAnimationFrame(frame);
        frame = 0;
      }
    }

    resize();
    const sizes = new ResizeObserver(resize);
    sizes.observe(canvas);
    const seen = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      update();
    });
    seen.observe(canvas);
    document.addEventListener("visibilitychange", update);
    still.addEventListener("change", update);
    update();

    return () => {
      cancelAnimationFrame(frame);
      sizes.disconnect();
      seen.disconnect();
      document.removeEventListener("visibilitychange", update);
      still.removeEventListener("change", update);
    };
  }, []);

  return <canvas ref={ref} aria-hidden="true" className="wave-bg" />;
}
