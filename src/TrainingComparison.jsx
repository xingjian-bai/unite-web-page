import React, { useEffect, useRef, useState, useCallback } from "react";

/*
 * TrainingComparison — animated canvas comparing two-stage LDM training vs UNITE joint training.
 *
 * Three modes:
 *   Stage 1  "Tokenizer Training"   — blue z₀ dots converge to clusters (encoder/decoder only)
 *   Stage 2  "Denoiser Training"    — orange trajectories bend toward frozen z₀ (generator only)
 *   UNITE    "Joint Training"       — both move simultaneously (weight-shared Generative Encoder)
 */

const CW = 720, CH = 460;
const GCX = CW / 2, GCY = CH / 2, SIG_X = 195, SIG_Y = 130;
const CLUSTERS = [
  { x: 148, y: 112 }, { x: 385, y: 88 }, { x: 572, y: 238 },
  { x: 488, y: 375 }, { x: 228, y: 368 }, { x: 342, y: 228 },
];
const PPC = 7, N_TRAJ = 160;
const S1_FRAMES = 480, S2_FRAMES = 420, S3_FRAMES = 600;

const rnd = (a, b) => a + Math.random() * (b - a);
const lerp = (a, b, t) => a + (b - a) * t;
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const easeO3 = t => 1 - Math.pow(1 - t, 3);
const easeIO = t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
function randn() { return Math.sqrt(-2 * Math.log(Math.random() + 1e-12)) * Math.cos(2 * Math.PI * Math.random()); }

const C_BLUE = [96, 165, 250];
const C_ORANGE = [255, 120, 40];
const C_PURP = [170, 90, 230];
const C_GOLD = [251, 191, 36];

function ztRGB(t) {
  return [
    Math.round(lerp(C_ORANGE[0], C_BLUE[0], t)),
    Math.round(lerp(C_ORANGE[1], C_BLUE[1], t)),
    Math.round(lerp(C_ORANGE[2], C_BLUE[2], t)),
  ];
}

export default function TrainingComparison() {
  const canvasRef = useRef(null);
  const stateRef = useRef({
    pts: [], trajs: [], gaussDots: [],
    frame: 0, stage: 1,
  });
  const [stage, setStage] = useState(1);

  // ── helpers ──
  function glowDot(cx, x, y, r, [cr, cg, cb], gs, alpha = 1) {
    const g = cx.createRadialGradient(x, y, 0, x, y, gs);
    g.addColorStop(0, `rgba(${cr},${cg},${cb},${0.55 * alpha})`);
    g.addColorStop(0.4, `rgba(${cr},${cg},${cb},${0.20 * alpha})`);
    g.addColorStop(1, `rgba(${cr},${cg},${cb},0)`);
    cx.fillStyle = g; cx.beginPath(); cx.arc(x, y, gs, 0, Math.PI * 2); cx.fill();
    cx.globalAlpha = alpha;
    cx.fillStyle = `rgb(${cr},${cg},${cb})`;
    cx.beginPath(); cx.arc(x, y, r, 0, Math.PI * 2); cx.fill();
    if (r > 2) { cx.fillStyle = `rgba(255,255,255,.6)`; cx.beginPath(); cx.arc(x, y, r * 0.38, 0, Math.PI * 2); cx.fill(); }
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
        s.gaussDots.push({ x, y, a: rnd(0.15, 0.55), r: rnd(1.2, 2.5), ph: rnd(0, Math.PI * 2) });
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
    setStage(3);
  }, [initTrajs]);

  // ── animation loop ──
  useEffect(() => {
    initPts(); buildGaussDots();
    let raf;
    const loop = () => {
      const s = stateRef.current;
      const cv = canvasRef.current;
      if (!cv) return;
      const cx = cv.getContext("2d");

      // update
      s.frame++;
      if (s.stage === 1) {
        const t = easeIO(clamp(s.frame / S1_FRAMES, 0, 1));
        s.pts.forEach(p => { const pos = qbez(p.sx, p.sy, p.cpx, p.cpy, p.z0x, p.z0y, t); p.x = pos.x; p.y = pos.y; });
      } else if (s.stage === 2) {
        s.trajs.forEach(tr => {
          const tgt = s.pts[tr.targetIdx];
          tr.ex = lerp(tr.ex, tgt.x, tr.lerpSpd);
          tr.ey = lerp(tr.ey, tgt.y, tr.lerpSpd);
        });
      } else {
        const t = easeIO(clamp(s.frame / S3_FRAMES, 0, 1));
        s.pts.forEach(p => { const pos = qbez(p.sx, p.sy, p.cpx, p.cpy, p.z0x, p.z0y, t); p.x = pos.x; p.y = pos.y; });
        const anneal = t;
        const sigma = lerp(220, 30, anneal);
        s.trajs.forEach(tr => {
          const [tx, ty] = rbfTarget(s.pts, tr.sx, tr.sy, sigma);
          const spd = tr.lerpSpd * anneal * 4;
          tr.ex = lerp(tr.ex, tx, spd);
          tr.ey = lerp(tr.ey, ty, spd);
        });
      }

      // draw
      cx.fillStyle = "#f8f9fb"; cx.fillRect(0, 0, CW, CH);
      cx.strokeStyle = "#e4e8ee"; cx.lineWidth = 1;
      for (let x = 0; x < CW; x += 50) { cx.beginPath(); cx.moveTo(x, 0); cx.lineTo(x, CH); cx.stroke(); }
      for (let y = 0; y < CH; y += 50) { cx.beginPath(); cx.moveTo(0, y); cx.lineTo(CW, y); cx.stroke(); }

      // gaussian cloud
      if (s.stage >= 2) {
        const fi = clamp(s.frame / 60, 0, 1);
        const bg = cx.createRadialGradient(GCX, GCY, 0, GCX, GCY, 260);
        bg.addColorStop(0, `rgba(140,70,210,${0.08 * fi})`);
        bg.addColorStop(0.6, `rgba(140,70,210,${0.04 * fi})`);
        bg.addColorStop(1, `rgba(140,70,210,0)`);
        cx.fillStyle = bg; cx.fillRect(0, 0, CW, CH);
        [[3, 0.06], [2, 0.11], [1, 0.22]].forEach(([sig, a]) => {
          cx.strokeStyle = `rgba(170,90,230,${a * fi})`; cx.lineWidth = 1; cx.setLineDash([4, 5]);
          cx.beginPath(); cx.ellipse(GCX, GCY, SIG_X * sig, SIG_Y * sig, 0, 0, Math.PI * 2); cx.stroke();
          cx.setLineDash([]);
        });
        if (fi > 0.6) {
          cx.fillStyle = `rgba(170,90,230,${0.4 * fi})`; cx.font = "9px monospace";
          cx.fillText("1\u03C3", GCX + SIG_X + 4, GCY + 4); cx.fillText("2\u03C3", GCX + SIG_X * 2 + 4, GCY + 4);
        }
        cx.fillStyle = `rgba(140,70,210,${0.30 * fi})`; cx.font = "bold 20px serif";
        cx.fillText("\uD835\uDCA9(0, I)", CW - 92, CH - 14);
        s.gaussDots.forEach(d => {
          const b = 0.6 + 0.4 * Math.sin(s.frame * 0.018 + d.ph);
          cx.globalAlpha = d.a * fi * b;
          cx.fillStyle = `rgb(${C_PURP[0]},${C_PURP[1]},${C_PURP[2]})`;
          cx.beginPath(); cx.arc(d.x, d.y, d.r, 0, Math.PI * 2); cx.fill();
        });
        cx.globalAlpha = 1;
      }

      // cluster glows
      const p1 = s.stage === 1 ? easeIO(clamp(s.frame / S1_FRAMES, 0, 1))
        : s.stage === 3 ? easeIO(clamp(s.frame / S3_FRAMES, 0, 1)) : 1;
      if (p1 >= 0.12) {
        const a = (p1 - 0.12) / 0.88;
        const col = s.stage === 3 ? [230, 170, 30] : [59, 130, 246];
        CLUSTERS.forEach(c => {
          const g = cx.createRadialGradient(c.x, c.y, 0, c.x, c.y, 50);
          g.addColorStop(0, `rgba(${col[0]},${col[1]},${col[2]},${a * 0.15})`);
          g.addColorStop(1, `rgba(${col[0]},${col[1]},${col[2]},0)`);
          cx.fillStyle = g; cx.beginPath(); cx.arc(c.x, c.y, 50, 0, Math.PI * 2); cx.fill();
        });
      }

      // trajectories
      if (s.stage >= 2) {
        const fi = clamp(s.frame / 50, 0, 1);
        const SEG = 24;
        s.trajs.forEach(tr => {
          const { sx, sy, ex, ey, off1, off2 } = tr;
          const { cp1x, cp1y, cp2x, cp2y } = getCP(sx, sy, ex, ey, off1, off2);
          for (let i = 0; i < SEG - 1; i++) {
            const t1 = i / (SEG - 1), t2 = (i + 1) / (SEG - 1);
            const p1 = cbez(sx, sy, cp1x, cp1y, cp2x, cp2y, ex, ey, t1);
            const p2 = cbez(sx, sy, cp1x, cp1y, cp2x, cp2y, ex, ey, t2);
            const [cr, cg, cb] = ztRGB(t2);
            cx.strokeStyle = `rgba(${cr},${cg},${cb},${(0.10 + t2 * 0.55) * fi})`;
            cx.lineWidth = 1.5;
            cx.beginPath(); cx.moveTo(p1.x, p1.y); cx.lineTo(p2.x, p2.y); cx.stroke();
          }
          glowDot(cx, sx, sy, 2.2, C_ORANGE, 7, 0.55 * fi);
          const tgt = s.stage === 3 ? s.pts[nearestPt(s.pts, ex, ey)] : s.pts[tr.targetIdx];
          const d = Math.hypot(ex - tgt.x, ey - tgt.y);
          const near = clamp(1 - d / 90, 0, 1);
          glowDot(cx, ex, ey, 2.8, ztRGB(near), 9, 0.70 * fi);
        });
      }

      // blue dots
      const pulse = s.stage === 2 ? 0.78 + 0.22 * Math.sin(s.frame * 0.065) : 1;
      s.pts.forEach(pt => {
        const settled = easeO3(clamp(p1 * 1.5, 0, 1));
        const alpha = (0.40 + settled * 0.60) * pulse;
        if (s.stage === 3) {
          const g = cx.createRadialGradient(pt.x, pt.y, 0, pt.x, pt.y, 18);
          g.addColorStop(0, `rgba(${C_GOLD[0]},${C_GOLD[1]},${C_GOLD[2]},.10)`);
          g.addColorStop(1, `rgba(${C_GOLD[0]},${C_GOLD[1]},${C_GOLD[2]},0)`);
          cx.fillStyle = g; cx.beginPath(); cx.arc(pt.x, pt.y, 18, 0, Math.PI * 2); cx.fill();
        }
        glowDot(cx, pt.x, pt.y, 3.5 + settled, C_BLUE, 10 + settled * 12, alpha);
      });

      // HUD
      if (s.stage === 1) {
        cx.fillStyle = "#8899aa"; cx.font = "11px monospace"; cx.fillText("Latent Space", 12, 16);
        const lp = easeIO(clamp(s.frame / S1_FRAMES, 0, 1));
        const loss = 2.8 * (1 - easeIO(lp)) + 0.06;
        cx.fillStyle = "rgba(255,255,255,0.85)"; cx.fillRect(12, CH - 54, 178, 42);
        cx.strokeStyle = "#d0d8e0"; cx.lineWidth = 1; cx.strokeRect(12, CH - 54, 178, 42);
        cx.fillStyle = "#6b7b8d"; cx.font = "10px monospace"; cx.fillText("Reconstruction Loss", 20, CH - 38);
        cx.fillStyle = "#4ade80"; cx.font = "bold 14px monospace"; cx.fillText(loss.toFixed(4), 20, CH - 20);
        cx.fillStyle = "#e2e8f0"; cx.fillRect(20, CH - 12, 160, 3);
        cx.fillStyle = `rgba(96,165,250,${0.4 + lp * 0.6})`; cx.fillRect(20, CH - 12, 160 * Math.max(0, lp), 3);
        const msgs = ["tokenizing batch\u2026", "z\u2080 \u2190 GE(x)", "update GE, D", "backprop\u2026"];
        const fi = Math.floor(s.frame / 60) % msgs.length;
        const fa = Math.sin((s.frame % 60) / 60 * Math.PI) * 0.5;
        cx.globalAlpha = fa; cx.fillStyle = "#60a5fa"; cx.font = "11px monospace";
        cx.fillText(msgs[fi], CW / 2 - 38, 16); cx.globalAlpha = 1;
      } else if (s.stage === 2) {
        cx.fillStyle = "#8899aa"; cx.font = "11px monospace"; cx.fillText("Latent Space", 12, 16);
        cx.fillStyle = "rgba(255,255,255,0.85)"; cx.fillRect(12, CH - 62, 200, 50);
        cx.strokeStyle = "#d0d8e0"; cx.lineWidth = 1; cx.strokeRect(12, CH - 62, 200, 50);
        glowDot(cx, 28, CH - 44, 4, C_BLUE, 10, 0.9);
        cx.fillStyle = "#556677"; cx.font = "10px monospace"; cx.fillText("z\u2080  frozen (tokenizer)", 40, CH - 40);
        glowDot(cx, 28, CH - 22, 3, C_ORANGE, 8, 0.9);
        cx.fillText("denoising trajectory \u2192 z\u2080", 40, CH - 18);
      } else {
        const lp = easeIO(clamp(s.frame / S3_FRAMES, 0, 1));
        cx.fillStyle = "rgba(180,83,9,.6)"; cx.font = "11px monospace";
        cx.fillText("UNITE \u2014 Joint Training", 12, 16);
        const lossE = 2.8 * (1 - easeIO(lp)) + 0.06;
        const lossG = 2.2 * (1 - easeIO(lp * 0.9)) + 0.08;
        cx.fillStyle = "rgba(255,255,255,0.85)"; cx.fillRect(12, CH - 68, 205, 56);
        cx.strokeStyle = "rgba(202,138,4,.25)"; cx.lineWidth = 1; cx.strokeRect(12, CH - 68, 205, 56);
        cx.fillStyle = "#6b7b8d"; cx.font = "10px monospace";
        cx.fillText("Recon Loss", 20, CH - 52); cx.fillText("Flow Loss", 120, CH - 52);
        cx.fillStyle = "#4ade80"; cx.font = "bold 13px monospace";
        cx.fillText(lossE.toFixed(4), 20, CH - 36); cx.fillText(lossG.toFixed(4), 120, CH - 36);
        cx.fillStyle = "#e2e8f0"; cx.fillRect(20, CH - 24, 175, 3);
        cx.fillStyle = `rgba(202,138,4,${0.45 + lp * 0.55})`; cx.fillRect(20, CH - 24, 175 * Math.max(0, lp), 3);
        cx.fillStyle = "rgba(255,255,255,0.85)"; cx.fillRect(CW - 218, CH - 62, 206, 50);
        cx.strokeStyle = "rgba(202,138,4,.2)"; cx.lineWidth = 1; cx.strokeRect(CW - 218, CH - 62, 206, 50);
        glowDot(cx, CW - 201, CH - 44, 4, C_BLUE, 12, 0.9);
        cx.fillStyle = "#556677"; cx.font = "10px monospace";
        cx.fillText("z\u2080  moving (GE training)", CW - 188, CH - 40);
        glowDot(cx, CW - 201, CH - 22, 3, C_ORANGE, 8, 0.9);
        cx.fillText("denoising \u2192 nearest z\u2080", CW - 188, CH - 18);
      }

      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [initPts, buildGaussDots]);

  // ── pipeline node labels ──
  const pipeLabels = {
    1: {
      row1: ["Image", "\u2192", "GE (tokenize)", "\u2192", "z\u2080", "\u2192", "Decoder", "\u2192", "x\u0302"],
      row2: ["\uD835\uDCA9(0,I)", "\u2192", "Denoiser", "\u2192", "z\u209C", "\u27F6", "z\u2080", "(frozen)"],
      row1Active: true, row2Active: false,
    },
    2: {
      row1: ["Image", "\u2192", "GE (tokenize)", "\u2192", "z\u2080", "\u2192", "Decoder", "\u2192", "x\u0302"],
      row2: ["\uD835\uDCA9(0,I)", "\u2192", "Denoiser", "\u2192", "z\u209C", "\u27F6", "z\u2080", "(frozen)"],
      row1Active: false, row2Active: true,
    },
    3: {
      row1: ["Image", "\u2192", "GE (tokenize)", "\u2192", "z\u2080", "\u2192", "Decoder", "\u2192", "x\u0302"],
      row2: ["\uD835\uDCA9(0,I)", "\u2192", "GE (denoise)", "\u2192", "z\u209C", "\u27F6", "z\u2080", ""],
      row1Active: true, row2Active: true,
    },
  };

  const pipe = pipeLabels[stage];
  const isJoint = stage === 3;
  const colorClass = isJoint ? "tc-gold" : stage === 1 ? "tc-blue" : "tc-purp";

  const stageInfo = {
    1: { badge: "Stage 1: Tokenizer Training", desc: "The Generative Encoder maps images to latent codes z\u2080. Points converge to structured clusters as training progresses." },
    2: { badge: "Stage 2: Denoiser Training", desc: "z\u2080 is frozen. Each trajectory starts from Gaussian noise and bends toward its nearest z\u2080 \u2014 the denoiser learns to reverse the noising process." },
    3: { badge: "UNITE: Joint Training", desc: "Both trained simultaneously \u2014 z\u2080 moves as the Generative Encoder trains, while denoising trajectories bend in real time toward their nearest z\u2080." },
  };

  return (
    <div className="tc-wrap">
      <div className={`tc-badge tc-badge-${stage}`}>
        <span className="tc-dot" />
        <span>{stageInfo[stage].badge}</span>
      </div>

      <div className={`tc-pipeline ${isJoint ? "tc-pipeline-joint" : ""}`}>
        <div className={`tc-prow ${!pipe.row1Active && !isJoint ? "tc-prow-dim" : ""} ${isJoint ? "tc-prow-gold" : ""}`}>
          {pipe.row1.map((label, i) =>
            i % 2 === 1
              ? <span key={i} className={`tc-arr ${isJoint ? "tc-arr-gold" : "tc-arr-on"}`}>{label}</span>
              : <span key={i} className={`tc-node ${isJoint ? "tc-node-gold" : "tc-node-blue"}`}>{label}</span>
          )}
        </div>
        <div className={`tc-prow ${!pipe.row2Active && !isJoint ? "tc-prow-dim" : ""} ${isJoint ? "tc-prow-gold" : ""}`}>
          {pipe.row2.map((label, i) =>
            label === "" ? null
              : label === "(frozen)" ? <span key={i} className="tc-node tc-node-sm">{label}</span>
              : i % 2 === 1 ? <span key={i} className={`tc-arr ${isJoint ? "tc-arr-gold" : pipe.row2Active ? "tc-arr-on" : ""}`}>{label}</span>
              : <span key={i} className={`tc-node ${isJoint ? "tc-node-gold" : "tc-node-purp"}`}>{label}</span>
          )}
        </div>
      </div>

      <canvas ref={canvasRef} width={CW} height={CH} className="tc-canvas" />

      <p className="tc-desc">{stageInfo[stage].desc}</p>

      <div className="tc-controls">
        <button className={stage === 1 ? "tc-btn tc-btn-active-1" : "tc-btn"} onClick={goStage1}>Stage 1</button>
        <button className={stage === 2 ? "tc-btn tc-btn-active-2" : "tc-btn"} onClick={goStage2}>Stage 2</button>
        <div style={{ width: 16 }} />
        <button className={stage === 3 ? "tc-btn tc-btn-active-3" : "tc-btn tc-btn-hi"} onClick={goStage3}>UNITE</button>
      </div>
    </div>
  );
}
