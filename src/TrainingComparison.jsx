import React, { useEffect, useRef, useState, useCallback } from "react";

/*
 * TrainingComparison — animated canvas comparing two-stage LDM vs UNITE joint training.
 *
 *   Stage 1  "Tokenizer Training"   — blue z₀ dots converge; recon loss displayed
 *   Stage 2  "Denoiser Training"    — orange trajectories from Gaussian bend toward frozen z₀; flow loss displayed
 *   UNITE    "Joint Training"       — both move simultaneously; both losses displayed
 */

const CW = 720, CH = 460;
const GCX = CW / 2, GCY = CH / 2, SIG_X = 195, SIG_Y = 130;
const CLUSTERS = [
  { x: 148, y: 112 }, { x: 385, y: 88 }, { x: 572, y: 238 },
  { x: 488, y: 375 }, { x: 228, y: 368 }, { x: 342, y: 228 },
];
const PPC = 7, N_TRAJ = 160;
const S1_FRAMES = 360, S2_FRAMES = 400, S3_FRAMES = 500;

const rnd = (a, b) => a + Math.random() * (b - a);
const lerp = (a, b, t) => a + (b - a) * t;
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const easeO3 = t => 1 - Math.pow(1 - t, 3);
const easeIO = t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
function randn() { return Math.sqrt(-2 * Math.log(Math.random() + 1e-12)) * Math.cos(2 * Math.PI * Math.random()); }

const C_BLUE = [59, 130, 246];
const C_ORANGE = [234, 88, 12];
const C_PURP = [140, 70, 210];
const C_GOLD = [180, 120, 10];

function ztRGB(t) {
  return [
    Math.round(lerp(C_ORANGE[0], C_BLUE[0], t)),
    Math.round(lerp(C_ORANGE[1], C_BLUE[1], t)),
    Math.round(lerp(C_ORANGE[2], C_BLUE[2], t)),
  ];
}

export default function TrainingComparison() {
  const canvasRef = useRef(null);
  const pipelineRef = useRef(null);
  const stateRef = useRef({ pts: [], trajs: [], gaussDots: [], frame: 0, stage: 1 });
  const [stage, setStage] = useState(1);
  const [bridgeStyle, setBridgeStyle] = useState({});

  // ── helpers ──
  function glowDot(cx, x, y, r, [cr, cg, cb], gs, alpha = 1) {
    const g = cx.createRadialGradient(x, y, 0, x, y, gs);
    g.addColorStop(0, `rgba(${cr},${cg},${cb},${0.45 * alpha})`);
    g.addColorStop(0.4, `rgba(${cr},${cg},${cb},${0.15 * alpha})`);
    g.addColorStop(1, `rgba(${cr},${cg},${cb},0)`);
    cx.fillStyle = g; cx.beginPath(); cx.arc(x, y, gs, 0, Math.PI * 2); cx.fill();
    cx.globalAlpha = alpha;
    cx.fillStyle = `rgb(${cr},${cg},${cb})`;
    cx.beginPath(); cx.arc(x, y, r, 0, Math.PI * 2); cx.fill();
    if (r > 2) { cx.fillStyle = `rgba(255,255,255,.55)`; cx.beginPath(); cx.arc(x, y, r * 0.35, 0, Math.PI * 2); cx.fill(); }
    cx.globalAlpha = 1;
  }

  function cbez(ax, ay, bx, by, cx_, cy, dx, dy, t) {
    const m = 1 - t;
    return {
      x: m * m * m * ax + 3 * m * m * t * bx + 3 * m * t * t * cx_ + t * t * t * dx,
      y: m * m * m * ay + 3 * m * m * t * by + 3 * m * t * t * cy + t * t * t * dy,
    };
  }

  function getCP(sx, sy, ex, ey, off1, off2) {
    const dx = ex - sx, dy = ey - sy, len = Math.hypot(dx, dy) || 1;
    const px = -dy / len, py = dx / len;
    return {
      cp1x: sx + dx * 0.28 + px * off1, cp1y: sy + dy * 0.28 + py * off1,
      cp2x: ex - dx * 0.28 + px * off2, cp2y: ey - dy * 0.28 + py * off2,
    };
  }

  function qbez(ax, ay, bx, by, cx_, cy_, t) {
    const m = 1 - t;
    return { x: m * m * ax + 2 * m * t * bx + t * t * cx_, y: m * m * ay + 2 * m * t * by + t * t * cy_ };
  }

  function makeBezierPt(ci, sx, sy, ex, ey) {
    const mx = (sx + ex) / 2, my = (sy + ey) / 2;
    const len = Math.hypot(ex - sx, ey - sy) || 1;
    const off = rnd(-80, 80);
    return { ci, x: sx, y: sy, sx, sy, cpx: mx + (-(ey - sy) / len) * off, cpy: my + ((ex - sx) / len) * off, z0x: ex, z0y: ey };
  }

  function nearestPt(pts, x, y) {
    let best = 0, bd = Infinity;
    pts.forEach((p, i) => { const d = Math.hypot(x - p.x, y - p.y); if (d < bd) { bd = d; best = i; } });
    return best;
  }

  function rbfTarget(pts, ex, ey, sigma) {
    let wx = 0, wy = 0, wsum = 0;
    pts.forEach(p => {
      const w = Math.exp(-((ex - p.x) ** 2 + (ey - p.y) ** 2) / (2 * sigma * sigma));
      wx += p.x * w; wy += p.y * w; wsum += w;
    });
    return wsum > 1e-12 ? [wx / wsum, wy / wsum] : [pts[0].x, pts[0].y];
  }

  // ── rounded-rect helper ──
  function roundRect(cx, x, y, w, h, r) {
    cx.beginPath();
    cx.moveTo(x + r, y);
    cx.lineTo(x + w - r, y); cx.arcTo(x + w, y, x + w, y + r, r);
    cx.lineTo(x + w, y + h - r); cx.arcTo(x + w, y + h, x + w - r, y + h, r);
    cx.lineTo(x + r, y + h); cx.arcTo(x, y + h, x, y + h - r, r);
    cx.lineTo(x, y + r); cx.arcTo(x, y, x + r, y, r);
    cx.closePath();
  }

  // ── init ──
  const initPts = useCallback(() => {
    const s = stateRef.current;
    s.pts = [];
    CLUSTERS.forEach((c, ci) => {
      for (let i = 0; i < PPC; i++) {
        s.pts.push(makeBezierPt(ci, rnd(50, CW - 50), rnd(50, CH - 50), c.x + rnd(-24, 24), c.y + rnd(-18, 18)));
      }
    });
  }, []);

  const buildGaussDots = useCallback(() => {
    const s = stateRef.current;
    s.gaussDots = [];
    for (let i = 0; i < 240; i++) {
      const x = GCX + randn() * SIG_X, y = GCY + randn() * SIG_Y;
      if (x > 12 && x < CW - 12 && y > 12 && y < CH - 12)
        s.gaussDots.push({ x, y, a: rnd(0.12, 0.45), r: rnd(1.2, 2.5), ph: rnd(0, Math.PI * 2) });
    }
  }, []);

  const initTrajs = useCallback(() => {
    const s = stateRef.current;
    s.trajs = [];
    for (let i = 0; i < N_TRAJ; i++) {
      const sx = clamp(GCX + randn() * SIG_X, 15, CW - 15);
      const sy = clamp(GCY + randn() * SIG_Y, 15, CH - 15);
      const ni = nearestPt(s.pts, sx, sy);
      s.trajs.push({
        sx, sy,
        ex: rnd(40, CW - 40), ey: rnd(40, CH - 40),
        targetIdx: ni,
        off1: rnd(-55, 55), off2: rnd(-55, 55),
        lerpSpd: rnd(0.013, 0.024),
      });
    }
  }, []);

  // ── stage transitions ──
  const goStage1 = useCallback(() => {
    const s = stateRef.current;
    s.stage = 1; s.frame = 0; s.trajs = [];
    initPts(); buildGaussDots();
    setStage(1);
  }, [initPts, buildGaussDots]);

  const goStage2 = useCallback(() => {
    const s = stateRef.current;
    s.stage = 2; s.frame = 0;
    s.pts.forEach(p => { p.x = p.z0x; p.y = p.z0y; });
    initTrajs();
    setStage(2);
  }, [initTrajs]);

  const goStage3 = useCallback(() => {
    const s = stateRef.current;
    s.stage = 3; s.frame = 0;
    s.pts.forEach(p => {
      const ns = makeBezierPt(p.ci, rnd(50, CW - 50), rnd(50, CH - 50), p.z0x, p.z0y);
      Object.assign(p, ns);
    });
    initTrajs();
    // Lock each trajectory's final target to the nearest blue dot at its FINAL position
    // This prevents late target-switching as blue dots move
    s.trajs.forEach(tr => {
      tr.lockedTarget = nearestPt(s.pts.map(p => ({ x: p.z0x, y: p.z0y })), tr.sx, tr.sy);
    });
    setStage(3);
  }, [initTrajs]);

  // ── animation loop ──
  useEffect(() => {
    initPts(); buildGaussDots();
    // HiDPI canvas setup
    const cv = canvasRef.current;
    if (cv) {
      const dpr = window.devicePixelRatio || 1;
      cv.width = CW * dpr;
      cv.height = CH * dpr;
      cv.style.width = "100%";
      cv.style.aspectRatio = `${CW} / ${CH}`;
      const ctx = cv.getContext("2d");
      ctx.scale(dpr, dpr);
    }
    let raf;
    const loop = () => {
      const s = stateRef.current;
      const cv = canvasRef.current;
      if (!cv) return;
      const cx = cv.getContext("2d");

      // ── update ──
      s.frame++;
      if (s.stage === 1) {
        const t = easeIO(clamp(s.frame / S1_FRAMES, 0, 1));
        s.pts.forEach(p => { const pos = qbez(p.sx, p.sy, p.cpx, p.cpy, p.z0x, p.z0y, t); p.x = pos.x; p.y = pos.y; });
      } else if (s.stage === 2) {
        const progress = easeIO(clamp(s.frame / S2_FRAMES, 0, 1));
        const spd2 = progress * 0.04; // ramp up lerp speed with progress
        s.trajs.forEach(tr => {
          const tgt = s.pts[tr.targetIdx];
          tr.ex = lerp(tr.ex, tgt.x, spd2);
          tr.ey = lerp(tr.ey, tgt.y, spd2);
        });
      } else {
        // Blue dots: ease-out (fast start, slow settle)
        const tPts = easeO3(clamp(s.frame / S3_FRAMES, 0, 1));
        s.pts.forEach(p => { const pos = qbez(p.sx, p.sy, p.cpx, p.cpy, p.z0x, p.z0y, tPts); p.x = pos.x; p.y = pos.y; });
        // Trajectories: lerp toward locked target (no RBF recomputation = no late switches)
        const anneal = easeIO(clamp(s.frame / S3_FRAMES, 0, 1));
        const spd3 = anneal * 0.04;
        s.trajs.forEach(tr => {
          const tgt = s.pts[tr.lockedTarget !== undefined ? tr.lockedTarget : tr.targetIdx];
          tr.ex = lerp(tr.ex, tgt.x, spd3);
          tr.ey = lerp(tr.ey, tgt.y, spd3);
        });
      }

      // ── draw background ──
      cx.fillStyle = "#f8f9fb"; cx.fillRect(0, 0, CW, CH);
      cx.strokeStyle = "#e8ecf1"; cx.lineWidth = 1;
      for (let x = 0; x < CW; x += 50) { cx.beginPath(); cx.moveTo(x, 0); cx.lineTo(x, CH); cx.stroke(); }
      for (let y = 0; y < CH; y += 50) { cx.beginPath(); cx.moveTo(0, y); cx.lineTo(CW, y); cx.stroke(); }

      // ── Gaussian cloud (Stage 2 & 3) ──
      if (s.stage >= 2) {
        const fi = clamp(s.frame / 60, 0, 1);
        const bg = cx.createRadialGradient(GCX, GCY, 0, GCX, GCY, 260);
        bg.addColorStop(0, `rgba(140,70,210,${0.06 * fi})`);
        bg.addColorStop(0.6, `rgba(140,70,210,${0.03 * fi})`);
        bg.addColorStop(1, `rgba(140,70,210,0)`);
        cx.fillStyle = bg; cx.fillRect(0, 0, CW, CH);
        s.gaussDots.forEach(d => {
          const b = 0.6 + 0.4 * Math.sin(s.frame * 0.018 + d.ph);
          cx.globalAlpha = d.a * fi * b;
          cx.fillStyle = `rgb(${C_PURP[0]},${C_PURP[1]},${C_PURP[2]})`;
          cx.beginPath(); cx.arc(d.x, d.y, d.r, 0, Math.PI * 2); cx.fill();
        });
        cx.globalAlpha = 1;
      }

      // ── cluster glows ──
      const p1 = s.stage === 1 ? easeIO(clamp(s.frame / S1_FRAMES, 0, 1))
        : s.stage === 3 ? easeIO(clamp(s.frame / S3_FRAMES, 0, 1)) : 1;
      if (p1 >= 0.12) {
        const a = (p1 - 0.12) / 0.88;
        const col = s.stage === 3 ? [180, 130, 20] : [59, 130, 246];
        CLUSTERS.forEach(c => {
          const g = cx.createRadialGradient(c.x, c.y, 0, c.x, c.y, 50);
          g.addColorStop(0, `rgba(${col[0]},${col[1]},${col[2]},${a * 0.10})`);
          g.addColorStop(1, `rgba(${col[0]},${col[1]},${col[2]},0)`);
          cx.fillStyle = g; cx.beginPath(); cx.arc(c.x, c.y, 50, 0, Math.PI * 2); cx.fill();
        });
      }

      // ── trajectories ──
      if (s.stage >= 2) {
        const fi = clamp(s.frame / 50, 0, 1);
        const SEG = 24;
        s.trajs.forEach(tr => {
          const { sx, sy, ex, ey, off1, off2 } = tr;
          const { cp1x, cp1y, cp2x, cp2y } = getCP(sx, sy, ex, ey, off1, off2);
          for (let i = 0; i < SEG - 1; i++) {
            const t1 = i / (SEG - 1), t2 = (i + 1) / (SEG - 1);
            const pp1 = cbez(sx, sy, cp1x, cp1y, cp2x, cp2y, ex, ey, t1);
            const pp2 = cbez(sx, sy, cp1x, cp1y, cp2x, cp2y, ex, ey, t2);
            const [cr, cg, cb] = ztRGB(t2);
            cx.strokeStyle = `rgba(${cr},${cg},${cb},${(0.08 + t2 * 0.45) * fi})`;
            cx.lineWidth = 1.5;
            cx.beginPath(); cx.moveTo(pp1.x, pp1.y); cx.lineTo(pp2.x, pp2.y); cx.stroke();
          }
          // origin dot (Gaussian-sampled)
          glowDot(cx, sx, sy, 1.6, C_ORANGE, 5, 0.25 * fi);
          // endpoint dot — colour shifts toward blue as it nears target
          const tgt = s.stage === 3 ? s.pts[nearestPt(s.pts, ex, ey)] : s.pts[tr.targetIdx];
          const d = Math.hypot(ex - tgt.x, ey - tgt.y);
          const near = clamp(1 - d / 90, 0, 1);
          glowDot(cx, ex, ey, 2.2, ztRGB(near), 7, 0.40 * fi);
        });
      }

      // ── blue dots (image embeddings) ──
      const pulse = s.stage === 2 ? 0.78 + 0.22 * Math.sin(s.frame * 0.065) : 1;
      s.pts.forEach(pt => {
        const settled = easeO3(clamp(p1 * 1.5, 0, 1));
        const alpha = (0.40 + settled * 0.60) * pulse;
        if (s.stage === 3) {
          const g = cx.createRadialGradient(pt.x, pt.y, 0, pt.x, pt.y, 16);
          g.addColorStop(0, `rgba(${C_GOLD[0]},${C_GOLD[1]},${C_GOLD[2]},.08)`);
          g.addColorStop(1, `rgba(${C_GOLD[0]},${C_GOLD[1]},${C_GOLD[2]},0)`);
          cx.fillStyle = g; cx.beginPath(); cx.arc(pt.x, pt.y, 16, 0, Math.PI * 2); cx.fill();
        }
        glowDot(cx, pt.x, pt.y, 4 + settled, C_BLUE, 16 + settled * 12, alpha);
      });

      // ── HUD: title ──
      const titleColor = s.stage === 3 ? "rgba(140,90,5,.65)" : "#8899aa";
      const titleText = s.stage === 1 ? "Latent Space" : s.stage === 2 ? "Latent Space" : "UNITE \u2014 Joint Training";
      cx.fillStyle = titleColor; cx.font = "600 12px -apple-system, sans-serif"; cx.fillText(titleText, 12, 18);

      // ── HUD: loss panel (bottom-left) ──
      if (s.stage === 1) {
        const lp = easeIO(clamp(s.frame / S1_FRAMES, 0, 1));
        const loss = 2.8 * (1 - easeIO(lp)) + 0.06;
        drawLossPanel(cx, 12, CH - 52, 170, 40, "Recon Loss", loss, [59, 130, 246], lp);
      } else if (s.stage === 2) {
        const lp = clamp(s.frame / S2_FRAMES, 0, 1);
        const loss = 2.4 * (1 - easeIO(lp)) + 0.08;
        drawLossPanel(cx, 12, CH - 52, 170, 40, "Flow Loss", loss, [140, 70, 210], lp);
      } else {
        const lp = easeIO(clamp(s.frame / S3_FRAMES, 0, 1));
        const lossR = 2.8 * (1 - easeIO(lp)) + 0.06;
        const lossF = 2.2 * (1 - easeIO(lp * 0.9)) + 0.08;
        // two loss panels side by side
        drawLossPanel(cx, 12, CH - 52, 140, 40, "Recon Loss", lossR, [59, 130, 246], lp);
        drawLossPanel(cx, 160, CH - 52, 140, 40, "Flow Loss", lossF, [140, 70, 210], lp);
      }

      // ── HUD: legend (bottom-right) ──
      drawLegend(cx, s.stage);

      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [initPts, buildGaussDots]);

  // ── draw a loss panel ──
  function drawLossPanel(cx, x, y, w, h, label, value, color, progress) {
    roundRect(cx, x, y, w, h, 5);
    cx.fillStyle = "rgba(255,255,255,0.90)"; cx.fill();
    cx.strokeStyle = `rgba(${color[0]},${color[1]},${color[2]},0.25)`; cx.lineWidth = 1; cx.stroke();
    cx.fillStyle = "#5a6a7a"; cx.font = "500 11px -apple-system, sans-serif";
    cx.fillText(label, x + 10, y + 16);
    cx.fillStyle = `rgb(${color[0]},${color[1]},${color[2]})`; cx.font = "bold 14px -apple-system, sans-serif";
    cx.fillText(value.toFixed(4), x + 10, y + 32);
    // progress bar
    cx.fillStyle = "#e8ecf1"; cx.fillRect(x + 10, y + h - 5, w - 20, 2);
    cx.fillStyle = `rgba(${color[0]},${color[1]},${color[2]},${0.4 + progress * 0.6})`;
    cx.fillRect(x + 10, y + h - 5, (w - 20) * clamp(progress, 0, 1), 2);
  }

  // ── draw legend ──
  function drawLegend(cx, stage) {
    const lx = CW - 205, ly = CH - 58;
    const lw = 193, lh = stage >= 2 ? 48 : 30;
    const boxY = stage >= 2 ? ly : ly + 18;
    roundRect(cx, lx, boxY, lw, lh, 5);
    cx.fillStyle = "rgba(255,255,255,0.90)"; cx.fill();
    cx.strokeStyle = "#d0d8e0"; cx.lineWidth = 1; cx.stroke();

    const font = "11px -apple-system, sans-serif";
    cx.font = font;

    if (stage === 1) {
      glowDot(cx, lx + 15, boxY + 15, 3.5, C_BLUE, 8, 0.9);
      cx.fillStyle = "#4a5a6a";
      cx.fillText("image embedding", lx + 28, boxY + 19);
    } else {
      const blueLabel = stage === 2 ? "image embedding (frozen)" : "image embedding (learnable)";
      glowDot(cx, lx + 15, boxY + 14, 3.5, C_BLUE, 8, 0.9);
      cx.fillStyle = "#4a5a6a";
      cx.fillText(blueLabel, lx + 28, boxY + 18);
      glowDot(cx, lx + 15, boxY + 34, 2.8, C_ORANGE, 7, 0.9);
      cx.fillStyle = "#4a5a6a";
      cx.fillText("Gaussian prior", lx + 28, boxY + 38);
    }
  }

  // ── pipeline node labels ──
  const enc = stage === 3 ? "GE" : "Encoder";
  const den = stage === 3 ? "GE" : "Denoiser";
  const frozenTag = stage !== 3 ? "\u2744" : ""; // snowflake for frozen z₀
  const row1 = ["Image", "\u2192", enc, "\u2192", "z\u2080", "\u2192", "Decoder", "\u2192", "x\u0302", "|", "L_recon"];
  const row2 = ["z\u2080" + frozenTag, "+", "\uD835\uDCA9(0,I)", "\u2192", "z\u209C", "\u2192", den, "\u2192", "z\u2080", "|", "L_flow"];
  const pipeLabels = {
    1: { row1, row2, row1Active: true, row2Active: false },
    2: { row1, row2, row1Active: false, row2Active: true },
    3: { row1, row2, row1Active: true, row2Active: true },
  };

  const pipe = pipeLabels[stage];
  const isJoint = stage === 3;

  // Measure GE node positions to place the bridge
  useEffect(() => {
    if (!isJoint || !pipelineRef.current) return;
    const container = pipelineRef.current;
    const geNodes = container.querySelectorAll("[data-ge]");
    if (geNodes.length < 2) return;
    const containerRect = container.getBoundingClientRect();
    const r0 = geNodes[0].getBoundingClientRect();
    const r1 = geNodes[1].getBoundingClientRect();
    const left = ((r0.left + r1.left) / 2 - containerRect.left) + (r0.width / 2) - 36;
    setBridgeStyle({ left: `${left}px`, width: "72px" });
  }, [isJoint, stage]);

  const stageInfo = {
    1: { badge: "Stage 1: Tokenizer Training", desc: "The encoder maps images to latent embeddings z\u2080, trained with reconstruction loss. Points converge to structured clusters as training progresses." },
    2: { badge: "Stage 2: Denoiser Training", desc: "z\u2080 is frozen. Trajectories start from Gaussian noise and bend toward the nearest z\u2080 \u2014 the denoiser learns to reverse the noising process via flow matching loss." },
    3: { badge: "UNITE: Joint Training", desc: "Both trained simultaneously \u2014 z\u2080 moves as the Generative Encoder trains while denoising trajectories bend toward their nearest z\u2080. One model, one stage." },
  };

  function renderPipeNode(label, i, isActive, isJointMode, rowIdx) {
    if (label === "|") return <span key={i} className="tc-pipe-sep">{label}</span>;
    if (label === "+") return <span key={i} className={`tc-arr ${isJointMode ? "tc-arr-gold" : isActive ? "tc-arr-on" : ""}`}>+</span>;
    if (label === "\u2192") return <span key={i} className={`tc-arr ${isJointMode ? "tc-arr-gold" : isActive ? "tc-arr-on" : ""}`}>{label}</span>;
    if (label.startsWith("L_")) {
      const lossColor = label.includes("recon") ? "tc-node-loss-blue" : "tc-node-loss-purp";
      return <span key={i} className={`tc-node tc-node-loss ${isJointMode ? "tc-node-loss-gold" : lossColor}`}>{label}</span>;
    }
    const baseColor = isJointMode ? "tc-node-gold" : rowIdx === 0 ? "tc-node-blue" : "tc-node-purp";
    const isGE = label === "GE";
    return <span key={i} className={`tc-node ${baseColor}`} {...(isGE ? {"data-ge": "true"} : {})}>{label}</span>;
  }

  return (
    <div className="tc-wrap">
      <div className="tc-controls">
        <button className={stage === 1 ? "tc-btn tc-btn-active-1" : "tc-btn"} onClick={goStage1}>Stage 1</button>
        <button className={stage === 2 ? "tc-btn tc-btn-active-2" : "tc-btn"} onClick={goStage2}>Stage 2</button>
        <div style={{ width: 16 }} />
        <button className={stage === 3 ? "tc-btn tc-btn-active-3" : "tc-btn tc-btn-unite"} onClick={goStage3}>UNITE</button>
      </div>

      <div className={`tc-badge tc-badge-${stage}`}>
        <span className="tc-dot" />
        <span>{stageInfo[stage].badge}</span>
      </div>

      <div className="tc-pipeline">
        <div className="tc-pipeline-rows" ref={pipelineRef}>
          <div className={`tc-prow ${!pipe.row1Active && !isJoint ? "tc-prow-dim" : ""} ${isJoint ? "tc-prow-gold tc-prow-offset-r" : ""}`}>
            {pipe.row1.map((label, i) => renderPipeNode(label, i, pipe.row1Active, isJoint, 0))}
          </div>
          <div className={`tc-prow ${!pipe.row2Active && !isJoint ? "tc-prow-dim" : ""} ${isJoint ? "tc-prow-gold" : ""}`}>
            {pipe.row2.map((label, i) => renderPipeNode(label, i, pipe.row2Active, isJoint, 1))}
          </div>
          {isJoint && <div className="tc-ge-bridge" style={bridgeStyle}><span className="tc-ge-bridge-label">shared</span></div>}
        </div>
      </div>

      <canvas ref={canvasRef} className="tc-canvas" />

      <p className="tc-desc">{stageInfo[stage].desc}</p>
    </div>
  );
}
