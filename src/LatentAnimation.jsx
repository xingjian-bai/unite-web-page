import { useEffect, useRef, useCallback, useState } from "react";

/*  ============================================================
    UNITE Latent Space Animation — React Component
    Stage-decoupled: each phase has independent timing config.
    ============================================================ */

// ── CONFIG ─────────────────────────────────────────────────────
const CFG = {
  layout: {
    leftX: 0.08,
    rightX: 0.92,
    encoderX: 0.29,
    decoderX: 0.71,
    rowYs: [0.22, 0.375, 0.53, 0.685],
    imgSize: 0.08,
    boxHalf: 0.022,
  },
  blueDots: [
    { x: 0.525, y: 0.395 },
    { x: 0.465, y: 0.425 },
    { x: 0.515, y: 0.470 },
    { x: 0.475, y: 0.500 },
  ],
  genFinal: [
    { x: 0.545, y: 0.410 },
    { x: 0.485, y: 0.380 },
    { x: 0.535, y: 0.480 },
    { x: 0.455, y: 0.510 },
  ],
  genAngles: [0.05 * Math.PI, 0.75 * Math.PI, 1.25 * Math.PI, 1.85 * Math.PI],
  colors: {
    steelBlue: "#2c6faa",
    iceBue: "#7bb8d9",
    burntOrange: "#c04800",
    trajGrad: ["#e8780a", "#d46a08", "#c05d06", "#a85004", "#8f4303", "#6b3202"],
    gaussian: "#bbb",
    bg: "transparent",
  },
  // ── Stage timing (ms) — tune independently ──
  phase1: { rowDelay: 1400, encDelay: 250, dotDelay: 550, lblDelay: 650, decDelay: 850, fadeIn: 450, freeze: 550 },
  trans12: { duration: 750 },
  phase2: { trajDelay: 2400, trajDur: 1800, decDelay: 180, fadeIn: 400, freeze: 700 },
  trans23: { duration: 1100 },
  phase3: { hold: 7000, breathMs: 3000 },
};

// Pre-compute trajectories
function buildTrajectories() {
  const out = [];
  for (let i = 0; i < 4; i++) {
    const a = CFG.genAngles[i];
    const ep = CFG.genFinal[i];
    const r = 0.25;
    const sx = 0.5 + r * Math.cos(a), sy = 0.45 + r * Math.sin(a);
    const bo = 0.04;
    const mx = (sx + ep.x) / 2 + bo * Math.sin(a);
    const my = (sy + ep.y) / 2 - bo * Math.cos(a);
    const wps = [];
    for (let t = 0; t <= 1.001; t += 0.2) {
      const tt = Math.min(t, 1);
      wps.push({
        x: (1 - tt) ** 2 * sx + 2 * (1 - tt) * tt * mx + tt ** 2 * ep.x,
        y: (1 - tt) ** 2 * sy + 2 * (1 - tt) * tt * my + tt ** 2 * ep.y,
      });
    }
    out.push(wps);
  }
  return out;
}
const TRAJS = buildTrajectories();

// Timing helpers
function totalP1() { return 3 * CFG.phase1.rowDelay + CFG.phase1.decDelay + CFG.phase1.fadeIn + CFG.phase1.freeze; }
function totalP2() { return 3 * CFG.phase2.trajDelay + CFG.phase2.trajDur + CFG.phase2.decDelay + CFG.phase2.fadeIn + CFG.phase2.freeze; }
const easeIO = (t) => { const c = Math.max(0, Math.min(1, t)); return c * c * (3 - 2 * c); };

function lerpColor(a, b, t) {
  const p = (s, i) => parseInt(s.slice(i, i + 2), 16);
  const r = Math.round(p(a, 1) + (p(b, 1) - p(a, 1)) * t);
  const g = Math.round(p(a, 3) + (p(b, 3) - p(a, 3)) * t);
  const bl = Math.round(p(a, 5) + (p(b, 5) - p(a, 5)) * t);
  return `rgb(${r},${g},${bl})`;
}

// ── Component ──────────────────────────────────────────────────
export default function LatentAnimation() {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const stateRef = useRef({ phase: 0, t0: 0, running: true, raf: null, size: 0 });
  const [phaseLabel, setPhaseLabel] = useState("Phase 1 / 3");

  // Image refs
  const imgs = useRef({ input: [], gen: [] });
  const loaded = useRef(false);

  // Load images once
  useEffect(() => {
    const load = (src) =>
      new Promise((res) => {
        const img = new Image();
        img.onload = () => res(img);
        img.onerror = () => res(null);
        img.src = src;
      });
    Promise.all([
      ...Array.from({ length: 4 }, (_, i) => load(`./assets/animation/input_${i}.png`)),
      ...Array.from({ length: 4 }, (_, i) => load(`./assets/animation/gen_${i}.png`)),
    ]).then((all) => {
      imgs.current.input = all.slice(0, 4);
      imgs.current.gen = all.slice(4, 8);
      loaded.current = true;
    });
  }, []);

  // Resize
  useEffect(() => {
    function onResize() {
      const el = containerRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const s = Math.min(rect.width, rect.height);
      stateRef.current.size = s;
      const c = canvasRef.current;
      if (c) {
        c.width = s * window.devicePixelRatio;
        c.height = s * window.devicePixelRatio;
        c.style.width = s + "px";
        c.style.height = s + "px";
      }
    }
    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // ── Drawing helpers ──────────────────────────────────────────
  const px = useCallback((frac) => frac * stateRef.current.size, []);

  const drawGaussian = useCallback((ctx, alpha) => {
    const s = stateRef.current.size;
    const cx = s * 0.5, cy = s * 0.45;
    const radii = [0.28, 0.22, 0.17, 0.12, 0.08, 0.05];
    const as = [0.03, 0.05, 0.07, 0.09, 0.11, 0.13];
    for (let i = 0; i < radii.length; i++) {
      ctx.beginPath();
      ctx.arc(cx, cy, radii[i] * s, 0, Math.PI * 2);
      ctx.strokeStyle = CFG.colors.gaussian;
      ctx.lineWidth = 1;
      ctx.globalAlpha = as[i] * (alpha / 0.12);
      ctx.stroke();
      ctx.fillStyle = CFG.colors.gaussian;
      ctx.globalAlpha = as[i] * 0.3 * (alpha / 0.12);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }, []);

  const drawImg = useCallback((ctx, img, cx, cy, size, alpha, borderColor) => {
    if (!img || alpha < 0.01) return;
    const s = stateRef.current.size;
    const half = size * s / 2;
    const x = cx * s - half, y = cy * s - half, w = size * s, h = size * s;
    ctx.globalAlpha = alpha;
    // Border
    if (borderColor) {
      ctx.fillStyle = borderColor;
      ctx.fillRect(x - 3, y - 3, w + 6, h + 6);
    }
    ctx.drawImage(img, x, y, w, h);
    ctx.globalAlpha = 1;
  }, []);

  const drawBox = useCallback((ctx, text, cx, cy, color, alpha) => {
    if (alpha < 0.01) return;
    const s = stateRef.current.size;
    const bw = 0.036 * s, bh = 0.036 * s;
    const x = cx * s - bw / 2, y = cy * s - bh / 2;
    ctx.globalAlpha = alpha;
    ctx.fillStyle = "#fff";
    ctx.strokeStyle = color;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.roundRect(x, y, bw, bh, 6);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = color;
    ctx.font = `bold ${0.018 * s}px Inter, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(text, cx * s, cy * s);
    ctx.globalAlpha = 1;
  }, []);

  const drawArrow = useCallback((ctx, x1, y1, x2, y2, color, alpha, curve) => {
    if (alpha < 0.02) return;
    const s = stateRef.current.size;
    const ax = x1 * s, ay = y1 * s, bx = x2 * s, by = y2 * s;
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = color;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    if (curve) {
      const mx = (ax + bx) / 2, my = (ay + by) / 2;
      const dx = bx - ax, dy = by - ay;
      const len = Math.sqrt(dx * dx + dy * dy);
      const nx = -dy / len * curve * s, ny = dx / len * curve * s;
      const cpx = mx + nx, cpy = my + ny;
      ctx.moveTo(ax, ay);
      ctx.quadraticCurveTo(cpx, cpy, bx, by);
    } else {
      ctx.moveTo(ax, ay);
      ctx.lineTo(bx, by);
    }
    ctx.stroke();
    // Arrowhead
    const angle = Math.atan2(by - ay, bx - ax);
    // For curved arrows, recalculate angle at endpoint
    let endAngle = angle;
    if (curve) {
      const mx = (ax + bx) / 2, my = (ay + by) / 2;
      const dx2 = bx - ax, dy2 = by - ay;
      const len = Math.sqrt(dx2 * dx2 + dy2 * dy2);
      const nx = -dy2 / len * curve * s, ny = dx2 / len * curve * s;
      const cpx = mx + nx, cpy = my + ny;
      // Tangent at t=1: derivative of quadratic bezier
      const tdx = 2 * (bx - cpx), tdy = 2 * (by - cpy);
      endAngle = Math.atan2(tdy, tdx);
    }
    const hs = 8;
    ctx.beginPath();
    ctx.moveTo(bx, by);
    ctx.lineTo(bx - hs * Math.cos(endAngle - 0.4), by - hs * Math.sin(endAngle - 0.4));
    ctx.lineTo(bx - hs * Math.cos(endAngle + 0.4), by - hs * Math.sin(endAngle + 0.4));
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
    ctx.globalAlpha = 1;
  }, []);

  const drawDot = useCallback((ctx, cx, cy, color, alpha, radius) => {
    if (alpha < 0.01) return;
    const s = stateRef.current.size;
    ctx.beginPath();
    ctx.arc(cx * s, cy * s, (radius || 0.007) * s, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.globalAlpha = alpha;
    ctx.fill();
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.globalAlpha = 1;
  }, []);

  const drawText = useCallback((ctx, text, cx, cy, color, alpha, size, weight) => {
    if (alpha < 0.01) return;
    const s = stateRef.current.size;
    ctx.globalAlpha = alpha;
    ctx.fillStyle = color;
    ctx.font = `${weight || "600"} ${(size || 0.022) * s}px Inter, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(text, cx * s, cy * s);
    ctx.globalAlpha = 1;
  }, []);

  const drawTraj = useCallback((ctx, idx, progress, alpha) => {
    const wps = TRAJS[idx];
    const n = wps.length - 1;
    const cur = progress * n;
    for (let j = 0; j < n; j++) {
      if (j > cur) break;
      const sp = Math.min(1, cur - j);
      const ci = Math.min(j, CFG.colors.trajGrad.length - 1);
      const col = CFG.colors.trajGrad[ci];
      const s = stateRef.current.size;
      const p0x = wps[j].x * s, p0y = wps[j].y * s;
      const p1x = wps[j + 1].x * s, p1y = wps[j + 1].y * s;
      const ex = p0x + (p1x - p0x) * sp, ey = p0y + (p1y - p0y) * sp;
      ctx.beginPath();
      ctx.moveTo(p0x, p0y);
      ctx.lineTo(ex, ey);
      ctx.strokeStyle = col;
      ctx.lineWidth = 2.5;
      ctx.globalAlpha = alpha * 0.7;
      ctx.stroke();
      // Waypoint dot
      ctx.beginPath();
      ctx.arc(p0x, p0y, 4, 0, Math.PI * 2);
      ctx.fillStyle = col;
      ctx.globalAlpha = alpha * 0.6;
      ctx.fill();
      // Leading dot
      if (j === Math.floor(cur) && sp < 1) {
        ctx.beginPath();
        ctx.arc(ex, ey, 8, 0, Math.PI * 2);
        ctx.fillStyle = CFG.colors.burntOrange;
        ctx.globalAlpha = alpha;
        ctx.fill();
        ctx.strokeStyle = "#fff";
        ctx.lineWidth = 2;
        ctx.stroke();
      }
    }
    if (progress >= 1) {
      const last = wps[wps.length - 1];
      const s = stateRef.current.size;
      ctx.beginPath();
      ctx.arc(last.x * s, last.y * s, 8, 0, Math.PI * 2);
      ctx.fillStyle = CFG.colors.burntOrange;
      ctx.globalAlpha = alpha;
      ctx.fill();
      ctx.strokeStyle = "#fff";
      ctx.lineWidth = 2;
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }, []);

  // ── Phase runners ────────────────────────────────────────────
  const runP1 = useCallback((ctx, el) => {
    const c = CFG.phase1;
    const L = CFG.layout;
    drawGaussian(ctx, 0.12);
    // Title + headers
    drawText(ctx, "Phase 1: Tokenization", 0.5, 0.04, CFG.colors.steelBlue, 1, 0.03, "800");
    drawText(ctx, "Input", L.leftX, 0.10, CFG.colors.steelBlue, 1, 0.02, "600");
    drawText(ctx, "Reconstructed", L.rightX, 0.10, CFG.colors.steelBlue, 1, 0.02, "600");

    const arrowRads = [0.015, 0.03, -0.015, -0.03];

    for (let i = 0; i < 4; i++) {
      const rs = i * c.rowDelay;
      const re = el - rs;
      if (re < 0) continue;
      const y = L.rowYs[i];
      const bd = CFG.blueDots[i];
      const fadeA = (d) => Math.min(1, Math.max(0, easeIO((re - d) / c.fadeIn)));

      // Input
      drawImg(ctx, imgs.current.input[i], L.leftX, y, L.imgSize, fadeA(0), CFG.colors.steelBlue);
      // E + arrow
      if (re >= c.encDelay) {
        const a = fadeA(c.encDelay);
        drawBox(ctx, "E", L.encoderX, y, CFG.colors.steelBlue, a);
        drawArrow(ctx, L.leftX + L.imgSize / 2 + 0.01, y, L.encoderX - L.boxHalf - 0.01, y, CFG.colors.steelBlue, a);
      }
      // Blue dot + arrow
      if (re >= c.dotDelay) {
        const a = fadeA(c.dotDelay);
        drawDot(ctx, bd.x, bd.y, CFG.colors.steelBlue, a);
        drawArrow(ctx, L.encoderX + L.boxHalf + 0.01, y, bd.x - 0.015, bd.y, CFG.colors.steelBlue, a, 0.015);
      }
      // "1 pass"
      if (re >= c.lblDelay) {
        const a = fadeA(c.lblDelay);
        drawText(ctx, "1 pass", L.leftX + 0.05, y - 0.035, CFG.colors.iceBue, a * 0.85, 0.016, "italic 500");
      }
      // D + arrow + output
      if (re >= c.decDelay) {
        const a = fadeA(c.decDelay);
        drawBox(ctx, "D", L.decoderX, y, CFG.colors.steelBlue, a);
        drawArrow(ctx, bd.x + 0.015, bd.y, L.decoderX - L.boxHalf - 0.01, y, CFG.colors.steelBlue, a, arrowRads[i]);
        drawArrow(ctx, L.decoderX + L.boxHalf + 0.01, y, L.rightX - L.imgSize / 2 - 0.01, y, CFG.colors.steelBlue, a);
        drawImg(ctx, imgs.current.input[i], L.rightX, y, L.imgSize, a, CFG.colors.steelBlue);
      }
    }
    return el >= totalP1();
  }, [drawGaussian, drawImg, drawBox, drawArrow, drawDot, drawText]);

  const runT12 = useCallback((ctx, el) => {
    const dur = CFG.trans12.duration;
    const t = easeIO(Math.min(1, el / dur));
    const L = CFG.layout;
    drawGaussian(ctx, 0.12);
    const titleCol = lerpColor("#2c6faa", "#c04800", t);
    const titleText = t < 0.5 ? "Phase 1: Tokenization" : "Phase 2: Generation";
    drawText(ctx, titleText, 0.5, 0.04, titleCol, 1, 0.03, "800");
    const hdrCol = lerpColor("#2c6faa", "#555555", t);
    drawText(ctx, "Input", L.leftX, 0.10, hdrCol, 1, 0.02, "600");
    const rightText = t < 0.5 ? "Reconstructed" : "Generated";
    drawText(ctx, rightText, L.rightX, 0.10, hdrCol, 1, 0.02, "600");

    const dim = 1 - t * 0.7;
    for (let i = 0; i < 4; i++) {
      const y = L.rowYs[i];
      drawImg(ctx, imgs.current.input[i], L.leftX, y, L.imgSize, dim, CFG.colors.steelBlue);
      drawImg(ctx, imgs.current.input[i], L.rightX, y, L.imgSize, dim * 0.3, CFG.colors.steelBlue);
      drawBox(ctx, "E", L.encoderX, y, CFG.colors.steelBlue, dim * 0.3);
      drawBox(ctx, "D", L.decoderX, y, CFG.colors.steelBlue, dim * 0.3);
      drawDot(ctx, CFG.blueDots[i].x, CFG.blueDots[i].y, CFG.colors.steelBlue, 0.3 + 0.7 * (1 - t));
    }
    return el >= dur;
  }, [drawGaussian, drawImg, drawBox, drawDot, drawText]);

  const runP2 = useCallback((ctx, el) => {
    const c = CFG.phase2;
    const L = CFG.layout;
    drawGaussian(ctx, 0.12);
    drawText(ctx, "Phase 2: Generation", 0.5, 0.04, CFG.colors.burntOrange, 1, 0.03, "800");
    drawText(ctx, "Input", L.leftX, 0.10, "#555", 1, 0.02, "600");
    drawText(ctx, "Generated", L.rightX, 0.10, "#555", 1, 0.02, "600");

    // Dimmed Phase 1
    for (let i = 0; i < 4; i++) {
      drawImg(ctx, imgs.current.input[i], L.leftX, L.rowYs[i], L.imgSize, 0.3, CFG.colors.steelBlue);
      drawDot(ctx, CFG.blueDots[i].x, CFG.blueDots[i].y, CFG.colors.steelBlue, 0.3);
    }

    const arrowRads = [0.015, 0.03, -0.015, -0.03];
    const activeIdx = Math.min(3, Math.floor(el / c.trajDelay));

    for (let i = 0; i < 4; i++) {
      const ts = i * c.trajDelay;
      const te = el - ts;
      if (te < 0) continue;
      const y = L.rowYs[i];
      const prog = Math.min(1, te / c.trajDur);
      const done = prog >= 1;

      // Completed trajs
      if (i < activeIdx) {
        drawTraj(ctx, i, 1, 0.35);
        const da = 0.5;
        drawBox(ctx, "D", L.decoderX, y, CFG.colors.burntOrange, da);
        drawImg(ctx, imgs.current.gen[i], L.rightX, y, L.imgSize, da, CFG.colors.burntOrange);
      } else {
        // Active traj
        drawTraj(ctx, i, prog, 0.9);

        // Timestep labels
        const tsIdx = [0, 3, 5];
        const tsText = ["t=1.0", "t=0.5", "t=0.0"];
        for (let j = 0; j < tsIdx.length; j++) {
          const wpProg = tsIdx[j] / 5;
          if (prog >= wpProg) {
            const wp = TRAJS[i][tsIdx[j]];
            const offX = (i % 2 === 0) ? 0.03 : -0.06;
            const offY = (i < 2) ? -0.02 : 0.025;
            drawText(ctx, tsText[j], wp.x + offX, wp.y + offY, CFG.colors.burntOrange, 0.85, 0.014, "bold 700");
          }
        }

        // After done: decoder + gen image
        if (done && te >= c.trajDur + c.decDelay) {
          const a = Math.min(1, easeIO((te - c.trajDur - c.decDelay) / c.fadeIn));
          const gf = CFG.genFinal[i];
          drawBox(ctx, "D", L.decoderX, y, CFG.colors.burntOrange, a);
          drawArrow(ctx, gf.x + 0.015, gf.y, L.decoderX - L.boxHalf - 0.01, y, CFG.colors.burntOrange, a, arrowRads[i]);
          drawArrow(ctx, L.decoderX + L.boxHalf + 0.01, y, L.rightX - L.imgSize / 2 - 0.01, y, CFG.colors.burntOrange, a);
          drawImg(ctx, imgs.current.gen[i], L.rightX, y, L.imgSize, a, CFG.colors.burntOrange);
        }
      }
    }
    return el >= totalP2();
  }, [drawGaussian, drawImg, drawBox, drawArrow, drawDot, drawText, drawTraj]);

  const runT23 = useCallback((ctx, el) => {
    const dur = CFG.trans23.duration;
    const t = easeIO(Math.min(1, el / dur));
    const L = CFG.layout;
    drawGaussian(ctx, 0.12 + t * 0.03);

    // Fade title
    drawText(ctx, "Phase 2: Generation", 0.5, 0.04, CFG.colors.burntOrange, 1 - t, 0.03, "800");

    // Fade in input
    for (let i = 0; i < 4; i++) {
      const y = L.rowYs[i];
      drawImg(ctx, imgs.current.input[i], L.leftX, y, L.imgSize, 0.3 + t * 0.5, CFG.colors.steelBlue);
      drawDot(ctx, CFG.blueDots[i].x, CFG.blueDots[i].y, CFG.colors.steelBlue, 0.3 + t * 0.45);
      // Fading gen output
      drawImg(ctx, imgs.current.gen[i], L.rightX, y, L.imgSize, (1 - t) * 0.5, CFG.colors.burntOrange);
      // Fading trajectories
      drawTraj(ctx, i, 1, 0.35 * (1 - t * 0.5));
      drawDot(ctx, CFG.genFinal[i].x, CFG.genFinal[i].y, CFG.colors.burntOrange, 0.8 * (1 - t * 0.3));
      // Phase 3 side-by-side
      drawImg(ctx, imgs.current.input[i], 0.83, y, 0.06, t * 0.85, CFG.colors.steelBlue);
      drawImg(ctx, imgs.current.gen[i], 0.93, y, 0.06, t, CFG.colors.burntOrange);
    }
    // Sub-headers
    drawText(ctx, "Input", L.leftX, 0.10, "#555", t * 0.8, 0.02, "600");
    drawText(ctx, "Recon", 0.83, 0.155, CFG.colors.steelBlue, t * 0.85, 0.016, "600");
    drawText(ctx, "Gen", 0.93, 0.155, CFG.colors.burntOrange, t * 0.85, 0.016, "600");
    // Bottom text
    drawText(ctx, "A Single Latent Space", 0.5, 0.82, "#1a1a1a", t, 0.026, "800");
    drawText(ctx, "Tokenization produces z in one deterministic step", 0.5, 0.86, CFG.colors.steelBlue, t * 0.9, 0.016, "500");
    drawText(ctx, "Generation recovers z through learned iterative denoising", 0.5, 0.895, CFG.colors.burntOrange, t * 0.9, 0.016, "500");
    drawText(ctx, "UNITE: jointly optimized, from scratch, without external supervision", 0.5, 0.94, "#888", t * 0.8, 0.013, "400");
    return el >= dur;
  }, [drawGaussian, drawImg, drawDot, drawText, drawTraj]);

  const runP3 = useCallback((ctx, el) => {
    const c = CFG.phase3;
    const L = CFG.layout;
    const bt = (el % c.breathMs) / c.breathMs;
    drawGaussian(ctx, 0.10 + 0.05 * Math.sin(bt * Math.PI * 2));

    for (let i = 0; i < 4; i++) {
      const y = L.rowYs[i];
      drawImg(ctx, imgs.current.input[i], L.leftX, y, L.imgSize, 0.8, CFG.colors.steelBlue);
      drawDot(ctx, CFG.blueDots[i].x, CFG.blueDots[i].y, CFG.colors.steelBlue, 0.75);
      drawTraj(ctx, i, 1, 0.25);
      drawDot(ctx, CFG.genFinal[i].x, CFG.genFinal[i].y, CFG.colors.burntOrange, 0.8);
      drawImg(ctx, imgs.current.input[i], 0.83, y, 0.06, 0.85, CFG.colors.steelBlue);
      drawImg(ctx, imgs.current.gen[i], 0.93, y, 0.06, 1, CFG.colors.burntOrange);
    }
    drawText(ctx, "Input", L.leftX, 0.10, "#555", 0.8, 0.02, "600");
    drawText(ctx, "Recon", 0.83, 0.155, CFG.colors.steelBlue, 0.85, 0.016, "600");
    drawText(ctx, "Gen", 0.93, 0.155, CFG.colors.burntOrange, 0.85, 0.016, "600");
    drawText(ctx, "A Single Latent Space", 0.5, 0.82, "#1a1a1a", 1, 0.026, "800");
    drawText(ctx, "Tokenization produces z in one deterministic step", 0.5, 0.86, CFG.colors.steelBlue, 0.9, 0.016, "500");
    drawText(ctx, "Generation recovers z through learned iterative denoising", 0.5, 0.895, CFG.colors.burntOrange, 0.9, 0.016, "500");
    drawText(ctx, "UNITE: jointly optimized, from scratch, without external supervision", 0.5, 0.94, "#888", 0.8, 0.013, "400");
    return el >= c.hold;
  }, [drawGaussian, drawImg, drawDot, drawText, drawTraj]);

  // ── Main loop ────────────────────────────────────────────────
  const phases = useRef([
    { name: "p1", run: null, label: "Phase 1 / 3" },
    { name: "t12", run: null, label: "Transition" },
    { name: "p2", run: null, label: "Phase 2 / 3" },
    { name: "t23", run: null, label: "Transition" },
    { name: "p3", run: null, label: "Phase 3 / 3" },
  ]);
  // Update run functions on every render
  phases.current[0].run = runP1;
  phases.current[1].run = runT12;
  phases.current[2].run = runP2;
  phases.current[3].run = runT23;
  phases.current[4].run = runP3;

  useEffect(() => {
    const S = stateRef.current;
    S.phase = 0;
    S.t0 = performance.now();
    S.running = true;

    function tick() {
      if (!canvasRef.current) return;
      const ctx2 = canvasRef.current.getContext("2d");
      const s = S.size;
      if (!s || !loaded.current) {
        S.raf = requestAnimationFrame(tick);
        return;
      }
      ctx2.setTransform(window.devicePixelRatio, 0, 0, window.devicePixelRatio, 0, 0);
      ctx2.clearRect(0, 0, s, s);

      if (S.running) {
        const el = performance.now() - S.t0;
        const p = phases.current[S.phase];
        const done = p.run(ctx2, el);
        if (done && S.phase < phases.current.length - 1) {
          S.phase++;
          S.t0 = performance.now();
          setPhaseLabel(phases.current[S.phase].label);
        } else if (done) {
          // Loop
          S.phase = 0;
          S.t0 = performance.now();
          setPhaseLabel(phases.current[0].label);
        }
      } else {
        // Paused — still draw current state
        const el = performance.now() - S.t0;
        phases.current[S.phase].run(ctx2, el);
      }
      S.raf = requestAnimationFrame(tick);
    }

    S.raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(S.raf);
  }, [runP1, runT12, runP2, runT23, runP3]);

  // Controls
  const restart = () => {
    stateRef.current.phase = 0;
    stateRef.current.t0 = performance.now();
    stateRef.current.running = true;
    setPhaseLabel("Phase 1 / 3");
  };

  return (
    <div
      ref={containerRef}
      style={{
        position: "relative",
        width: "100%",
        maxWidth: 700,
        aspectRatio: "1",
        margin: "0 auto",
        background: "rgba(248,246,241,0.5)",
        borderRadius: 24,
        overflow: "hidden",
      }}
    >
      <canvas
        ref={canvasRef}
        style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%" }}
      />
      <div
        style={{
          position: "absolute",
          bottom: 12,
          left: "50%",
          transform: "translateX(-50%)",
          display: "flex",
          gap: 6,
          background: "rgba(255,255,255,0.85)",
          padding: "5px 10px",
          borderRadius: 16,
          fontSize: 12,
          zIndex: 10,
        }}
      >
        <button onClick={() => { stateRef.current.running = true; }} style={btnStyle}>Play</button>
        <button onClick={() => { stateRef.current.running = false; }} style={btnStyle}>Pause</button>
        <button onClick={restart} style={btnStyle}>Restart</button>
        <span style={{ padding: "4px 8px", color: "#555", fontWeight: 600, fontSize: 11 }}>{phaseLabel}</span>
      </div>
    </div>
  );
}

const btnStyle = {
  background: "#2c6faa",
  color: "#fff",
  border: "none",
  padding: "4px 10px",
  borderRadius: 8,
  cursor: "pointer",
  fontWeight: 600,
  fontSize: 11,
  fontFamily: "inherit",
};
