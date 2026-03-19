import React, { useEffect, useState, useCallback } from "react";
import LatentAnimation from "./LatentAnimation";

const navItems = [
  { label: "Core Idea", href: "#idea" },
  { label: "Results", href: "#results" },
  { label: "Analysis", href: "#analysis" },
  { label: "Citation", href: "#citation" },
];

const storyCards = [
  {
    eyebrow: "Staged training",
    title: "Freeze a tokenizer. Then train a generator.",
  },
  {
    eyebrow: "Naive end-to-end",
    title: "Naive joint training can still learn weak latents.",
  },
  {
    eyebrow: "UNITE",
    title: "One weight-shared encoder handles both modes.",
  },
];

const loopSteps = [
  {
    number: "01",
    title: "Tokenize",
    body: "The Generative Encoder tokenizes the image into K clean latent tokens z₀.",
  },
  {
    number: "02",
    title: "Detach + noise",
    body: "Detach z₀ from the graph, then add noise to get zₜ. Detach blocks the denoising gradient from taking shortcuts through tokenization.",
  },
  {
    number: "03",
    title: "Denoise",
    body: "The same encoder (no image this time) predicts z₀ from zₜ. Both losses update the shared weights via separate backward passes.",
  },
];

const statCards = [
  { label: "Training", value: "Single-stage", note: "one loop" },
  { label: "Teacher", value: "None", note: "no DINO" },
  { label: "ImageNet FID", value: "2.27", note: "UNITE-B" },
  { label: "Reconstruction", value: "1.01", note: "rFID" },
];

const generationRows = [
  { method: "JiT-B/16", regime: "single-stage", params: "131M", fid: "3.66", is: "275.1", section: "Single-stage" },
  { method: "UNITE-B (Ours)", regime: "single-stage", params: "131M+86M", fid: "2.12", is: "294.1", ours: true },
  { method: "JiT-L/16", regime: "single-stage", params: "459M", fid: "2.36", is: "298.5" },
  { method: "UNITE-L (Ours)", regime: "single-stage", params: "461M+86M", fid: "1.73", is: "296.0", ours: true },
  { method: "PixelFlow-XL/4", regime: "single-stage", params: "677M", fid: "1.98", is: "282.1" },
  { method: "JiT-H/16", regime: "single-stage", params: "953M", fid: "1.86", is: "303.4" },
  { method: "JiT-G/16", regime: "single-stage", params: "2B", fid: "1.82", is: "292.6" },
  { method: "UNITE-XL (Ours)", regime: "single-stage", params: "678M+86M", fid: "1.75", is: "309.9", ours: true },
  { method: "DiT-XL/2", regime: "two-stage", params: "675M+49M", fid: "2.27", is: "278.2", section: "Two-stage", dimmed: true },
  { method: "SiT-XL/2", regime: "two-stage", params: "675M+49M", fid: "2.06", is: "277.5", dimmed: true },
  { method: "REPA-SiT-XL/2", regime: "two-stage + DINOv2", params: "675M+49M", fid: "1.42", is: "305.7", section: "Two-stage + DINOv2", dimmed: true },
  { method: "DDT-XL/2", regime: "two-stage + DINOv2", params: "675M+49M", fid: "1.26", is: "310.6", dimmed: true },
];

const reconstructionRows = [
  { method: "ViTok-B/16", setup: "no adv., no teacher", rfid: "1.63" },
  { method: "UNITE-B", setup: "no adv., no teacher", rfid: "1.01", ours: true },
  { method: "UNITE-B + GAN ft", setup: "decoder-only GAN", rfid: "0.51", ours: true },
  { method: "RAE", setup: "adv. + DINOv2", rfid: "0.58" },
];

const sampleCards = [
  { title: "Class 12: House Finch", image: "./assets/samples-web/house-finch.jpg" },
  { title: "Class 207: Golden Retriever", image: "./assets/samples-web/golden-retriever.jpg" },
  { title: "Class 108: Sea Anemone", image: "./assets/samples-web/sea-anemone.jpg" },
];

const sampleMontages = [
  { title: "Class 12: House Finch", image: "./assets/samples/summary_012_house_finch.png" },
  { title: "Class 39: Common Iguana", image: "./assets/samples/summary_039_common_iguana.png" },
  { title: "Class 99: Goose", image: "./assets/samples/summary_099_goose.png" },
  { title: "Class 108: Sea Anemone", image: "./assets/samples/summary_108_sea_anemone.png" },
  { title: "Class 144: Pelican", image: "./assets/samples/summary_144_pelican.png" },
  { title: "Class 207: Golden Retriever", image: "./assets/samples/summary_207_golden_retriever.png" },
  { title: "Class 309: Bee", image: "./assets/samples/summary_309_bee.png" },
  { title: "Class 470: Candle", image: "./assets/samples/summary_470_candle.png" },
  { title: "Class 725: Pitcher", image: "./assets/samples/summary_725_plane.png" },
  { title: "Class 930: French Loaf", image: "./assets/samples/summary_930_ice_cream.png" },
];

const analysisCards = [
  {
    title: "Weight sharing gives the best rFID / gFID tradeoff",
    body: "No-sharing performs well, but weight sharing yields the best combination. More flow iterations per tokenization step make the latents more sampleable (better gFID) without hurting rFID.",
    image: "./assets/figures/stop_grad_ablations_sep_vs_ours.png",
  },
  {
    title: "Tokenization and denoising are intrinsically aligned",
    body: "High layer-wise CKA between encoder and denoiser in both shared and non-shared settings — the two tasks naturally learn similar representations even without forcing them to share weights.",
    image: "./assets/figures/cka_ablation_plot_v2.png",
  },
];

const bibtex = `@article{duggal2026unite,
  title   = {End-to-End Training for Unified Tokenization and Latent Denoising},
  author  = {Shivam Duggal and Xingjian Bai and Zongze Wu and Richard Zhang and Eli Shechtman and Antonio Torralba and Phillip Isola and William T. Freeman},
  journal = {arXiv preprint arXiv:XXXX.XXXXX},
  year    = {2026}
}`;

function SectionHeading({ kicker, title, subtitle, small }) {
  return (
    <div className={`section-heading reveal${small ? " section-heading-sm" : ""}`}>
      <p className="section-kicker">{kicker}</p>
      <h2>{title}</h2>
      {subtitle ? <p className="section-subtitle">{subtitle}</p> : null}
    </div>
  );
}

function GenerationTable() {
  return (
      <div className="table-card reveal">
      <div className="table-title">
        <p className="card-kicker">ImageNet-256 generation</p>
        <h3>Strong ImageNet generation</h3>
      </div>
      <div className="table-wrap">
        <div className="result-table table-five">
          <div className="table-head">
            <span>Method</span>
            <span>Params</span>
            <span>Regime</span>
            <span>FID ↓</span>
            <span>IS ↑</span>
          </div>
          {generationRows.map((row) => (
            <React.Fragment key={row.method}>
              {row.section && (
                <div className="table-section-header">
                  <span>{row.section}</span>
                </div>
              )}
              <div className={`table-row ${row.ours ? "table-row-ours" : ""} ${row.dimmed ? "table-row-dimmed" : ""}`}>
                <span className="cell cell-primary" data-label="Method">
                  {row.method}
                </span>
                <span className="cell" data-label="Params">
                  {row.params}
                </span>
                <span className="cell" data-label="Regime">
                  {row.regime}
                </span>
                <strong className="cell cell-strong" data-label="FID ↓">
                  {row.fid}
                </strong>
                <span className="cell" data-label="IS ↑">
                  {row.is}
                </span>
              </div>
            </React.Fragment>
          ))}
        </div>
      </div>
    </div>
  );
}

function ReconstructionTable() {
  return (
      <div className="table-card reveal">
      <div className="table-title">
        <p className="card-kicker">Reconstruction</p>
        <h3>Strong tokenizer quality</h3>
      </div>
      <div className="table-wrap">
        <div className="result-table table-three">
          <div className="table-head">
            <span>Tokenizer</span>
            <span>Setup</span>
            <span>rFID ↓</span>
          </div>
          {reconstructionRows.map((row) => (
            <div className={`table-row ${row.ours ? "table-row-ours" : ""}`} key={row.method}>
              <span className="cell cell-primary" data-label="Tokenizer">
                {row.method}
              </span>
              <span className="cell" data-label="Setup">
                {row.setup}
              </span>
              <strong className="cell cell-strong" data-label="rFID ↓">
                {row.rfid}
              </strong>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Lightbox({ image, title, onClose }) {
  useEffect(() => {
    const handleKey = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handleKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handleKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  return (
    <div className="lightbox-overlay" onClick={onClose}>
      <div className="lightbox-content" onClick={(e) => e.stopPropagation()}>
        <img src={image} alt={title} />
        <p className="lightbox-caption">{title}</p>
        <button className="lightbox-close" onClick={onClose} aria-label="Close">&times;</button>
      </div>
    </div>
  );
}

function App() {
  const [lightbox, setLightbox] = useState(null);

  const openLightbox = useCallback((image, title) => {
    setLightbox({ image, title });
  }, []);

  const closeLightbox = useCallback(() => {
    setLightbox(null);
  }, []);

  useEffect(() => {
    const nodes = document.querySelectorAll(".reveal");
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12 }
    );

    nodes.forEach((node) => observer.observe(node));

    return () => observer.disconnect();
  }, []);

  async function copyBibtex() {
    try {
      await navigator.clipboard.writeText(bibtex);
    } catch (error) {
      console.error("Failed to copy citation", error);
    }
  }

  return (
    <div className="shell">
      {lightbox && <Lightbox image={lightbox.image} title={lightbox.title} onClose={closeLightbox} />}
      <header className="site-header">
        <a className="brand" href="#top">
          UNITE: Unified Tokenization and Latent Denoising
        </a>
        <nav className="site-nav">
          {navItems.map((item) => (
            <a key={item.href} href={item.href}>
              {item.label}
            </a>
          ))}
        </nav>
      </header>

      <main className="page" id="top">
        <section className="hero reveal">
          <div className="hero-shell">
            <div className="hero-copy">
              <h1>UNITE: End-to-End Training for Unified Tokenization and Latent Denoising</h1>
              <p className="hero-authors">
                Shivam Duggal*<sup>1</sup>, Xingjian Bai*<sup>1</sup>, Zongze Wu<sup>2</sup>, Richard Zhang<sup>2</sup>, Eli Shechtman<sup>2</sup>,
                <br />
                Antonio Torralba<sup>1</sup>, Phillip Isola<sup>1</sup>, William T. Freeman<sup>1</sup>
              </p>
              <p className="hero-meta">
                <sup>1</sup>Massachusetts Institute of Technology &nbsp; <sup>2</sup>Adobe
              </p>
              <div className="hero-actions">
                <a className="button primary" href="./assets/docs/unite-paper.pdf">
                  Paper PDF
                </a>
                <a className="button" href="https://github.com/ShivamDuggal4/UNITE" target="_blank" rel="noopener noreferrer">
                  GitHub
                </a>
              </div>
            </div>

            <div className="hero-figure">
              <LatentAnimation />
            </div>

          </div>
        </section>

        <section className="section opening-section" id="story">
          <div className="abstract-block reveal">
            <h2 className="abstract-heading">Abstract</h2>
            <p className="abstract-text">
              Training state-of-the-art latent diffusion models requires complex staging:
              a tokenizer must first be trained before a diffusion model can operate in its frozen latent space.
              We propose <strong>UNITE</strong> — an architecture for <em>unified tokenization and latent diffusion</em>.
              A single <strong>Generative Encoder</strong> serves as both image tokenizer and latent generator
              via weight sharing, trained in a single stage that jointly optimizes both tasks.
              UNITE learns a <em>common latent language</em> for reconstruction and generation.
            </p>
          </div>

          <div className="thesis-panel" id="idea">
            <div className="thesis-copy reveal">
              <p className="card-kicker">Core idea</p>
              <h3>Tokenization is generation with strong observability.</h3>
              <p>
                Tokenization infers latents from a fully observed image;
                generation infers them from noise. Same inference problem, different conditioning.
                One weight-shared <strong>Generative Encoder</strong> handles both modes,
                learning a common latent language where the same attention and MLP weights
                support both — conditioning on an image yields a near-deterministic latent,
                while starting from noise yields a broader distribution for sampling.
              </p>
            </div>
          </div>

          <div className="loop-panel" id="loop">
            <div className="loop-intro reveal">
              <p className="card-kicker">Training</p>
              <h3>One encoder. Two forward passes. One loop.</h3>
              <p className="loop-desc">
                Our approach: the Generative Encoder tokenizes an image, then denoises its own noised latents — all in a single training step.
              </p>
            </div>

            <div className="loop-panel-figure reveal">
              <img
                src="./assets/figures/architecture_uldae_v3.png"
                alt="UNITE training architecture"
                loading="lazy"
              />
            </div>

            <div className="loop-sequence">
              {loopSteps.map((step) => (
                <article className="sequence-step reveal" key={step.number}>
                  <span>{step.number}</span>
                  <h3>{step.title}</h3>
                  {step.body ? <p>{step.body}</p> : null}
                </article>
              ))}
            </div>

          </div>

          <div className="animation-panel reveal" id="animation">
            <div className="section-heading">
              <p className="card-kicker">Inference</p>
              <h3>Both reconstruction and generation</h3>
              <p className="section-desc">
                Our model: the same encoder either tokenizes an image for reconstruction
                or iteratively denoises from pure noise for generation — two modes from one model.
              </p>
            </div>
            <div className="hero-figure">
              <img src="./assets/figures/teaser2.png" alt="UNITE teaser figure" loading="lazy" />
            </div>
          </div>
        </section>

        <section className="section" id="results">
          <SectionHeading
            kicker="Results"
            title="No DINO, no adversarial loss."
            small
          />

          <div className="results-grid">
            <GenerationTable />
          </div>

          <div className="sample-header reveal">
            <p className="card-kicker">Qualitative samples</p>
            <h3>Samples</h3>
          </div>

          <div className="sample-grid">
            {sampleCards.map((card) => (
              <article className="sample-card reveal clickable" key={card.title} onClick={() => openLightbox(card.image, card.title)}>
                <div className="sample-frame">
                  <img src={card.image} alt={card.title} loading="lazy" />
                </div>
                <h3>{card.title}</h3>
              </article>
            ))}
          </div>

          <div className="montage-grid">
            {sampleMontages.map((card) => (
              <article className="montage-card reveal clickable" key={card.title} onClick={() => openLightbox(card.image, card.title)}>
                <div className="montage-frame">
                  <img src={card.image} alt={card.title} loading="lazy" />
                </div>
                <p>{card.title}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="section" id="analysis">
          <SectionHeading
            kicker="Analysis"
            title="Diving deeper into encoder-denoiser weight sharing"
            subtitle="Our insight: tokenization and denoising are intrinsically aligned — even without shared weights, the two pathways learn similar representations."
            small
          />

          <div className="analysis-grid">
            {analysisCards.map((card) => (
              <article className="analysis-card reveal" key={card.title}>
                <div className="analysis-frame">
                  <img src={card.image} alt={card.title} loading="lazy" />
                </div>
                <h3>{card.title}</h3>
                {card.body ? <p>{card.body}</p> : null}
              </article>
            ))}
          </div>
        </section>

        <section className="section citation-section" id="citation">
          <article className="citation-card reveal">
            <div className="citation-head">
              <div>
                <p className="card-kicker">Citation</p>
                <h3>BibTeX</h3>
              </div>
              <button className="button" type="button" onClick={copyBibtex}>
                Copy
              </button>
            </div>
            <pre>{bibtex}</pre>
          </article>
        </section>
      </main>
    </div>
  );
}

export default App;
