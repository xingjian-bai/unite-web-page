import { useEffect, useState, useCallback } from "react";
import LatentAnimation from "./LatentAnimation";

const navItems = [
  { label: "Idea", href: "#story" },
  { label: "Results", href: "#results" },
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
    title: "Image -> clean latent z0",
  },
  {
    number: "02",
    title: "Detach + noise -> zt",
  },
  {
    number: "03",
    title: "Same encoder predicts z0",
  },
];

const statCards = [
  { label: "Training", value: "Single-stage", note: "one loop" },
  { label: "Teacher", value: "None", note: "no DINO" },
  { label: "ImageNet FID", value: "2.27", note: "UNITE-B" },
  { label: "Reconstruction", value: "1.01", note: "rFID" },
];

const generationRows = [
  { method: "JiT-B/16", regime: "single-stage pixel", fid: "3.66", is: "275.1" },
  { method: "UNITE-B", regime: "single-stage latent", fid: "2.27", is: "311.8", ours: true },
  { method: "DiT-XL/2", regime: "two-stage latent", fid: "2.27", is: "278.2" },
  { method: "UNITE-XL-L", regime: "single-stage latent", fid: "1.82", is: "303.8", ours: true },
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
  { title: "Class 725: Plane", image: "./assets/samples/summary_725_plane.png" },
  { title: "Class 930: Ice Cream", image: "./assets/samples/summary_930_ice_cream.png" },
];

const analysisCards = [
  {
    title: "Best reconstruction / generation tradeoff",
    image: "./assets/figures/stop_grad_ablations_sep_vs_ours.png",
  },
  {
    title: "Tokenizer and denoiser align across layers",
    image: "./assets/figures/cka_ablation_plot_v2.png",
  },
];

const bibtex = `@inproceedings{duggal2026unite,
  title     = {End-to-End Training for Unified Tokenization and Latent Denoising},
  author    = {Shivam Duggal and Xingjian Bai and Zongze Wu and Richard Zhang and Eli Shechtman and Antonio Torralba and Phillip Isola and William T. Freeman},
  booktitle = {International Conference on Machine Learning},
  year      = {2026}
}`;

function SectionHeading({ kicker, title, subtitle }) {
  return (
    <div className="section-heading reveal">
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
        <div className="result-table table-four">
          <div className="table-head">
            <span>Method</span>
            <span>Regime</span>
            <span>FID ↓</span>
            <span>IS ↑</span>
          </div>
          {generationRows.map((row) => (
            <div className={`table-row ${row.ours ? "table-row-ours" : ""}`} key={row.method}>
              <span className="cell cell-primary" data-label="Method">
                {row.method}
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
                <a className="button" href="#story">
                  Main Idea
                </a>
                <a className="button" href="https://github.com/ShivamDuggal4/UNITE" target="_blank" rel="noopener noreferrer">
                  GitHub
                </a>
              </div>
            </div>

            <div className="hero-figure">
              <img src="./assets/figures/teaser2.png" alt="UNITE teaser figure" />
            </div>

            <div className="proof-strip">
              {statCards.map((item) => (
                <article className="stat-card" key={item.label}>
                  <span>{item.label}</span>
                  <strong>{item.value}</strong>
                  <small>{item.note}</small>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="section opening-section" id="story">
          <div className="abstract-block reveal">
            <h2 className="abstract-heading">Abstract</h2>
            <p className="abstract-text">
              Latent diffusion models enable high-fidelity synthesis by operating in learned latent spaces.
              However, training state-of-the-art models requires complex staging: a tokenizer must first be trained,
              before a diffusion model can operate in its frozen latent space.
              We propose <strong>UNITE</strong> — an architecture for <em>unified tokenization and latent diffusion</em>.
              UNITE uses a single <strong>Generative Encoder</strong> that serves as both image tokenizer and latent
              generator via weight sharing. Our key insight is that tokenization and generation are the same latent
              inference problem under different conditioning: tokenization infers latents from fully observed images,
              whereas generation infers them from noise with class or text conditioning.
              We introduce a single-stage training procedure that jointly optimizes both tasks via two forward passes
              through the shared encoder. Across image and molecule modalities, UNITE achieves near state-of-the-art
              performance <em>without</em> adversarial losses or pretrained encoders (e.g., DINO), reaching
              FID <strong>2.27</strong> and <strong>1.82</strong> for Base and XL models on ImageNet 256×256.
            </p>
          </div>

          <div className="thesis-panel" id="idea">
            <div className="thesis-copy reveal">
              <p className="card-kicker">Core idea</p>
              <h3>Tokenization is generation with strong observability.</h3>
              <p>
                UNITE uses one encoder for image-conditioned inference and
                noise-conditioned inference.
              </p>
            </div>

            <div className="thesis-figure reveal">
              <img
                src="./assets/figures/shared_latent_space5.png"
                alt="Shared latent space figure"
                loading="lazy"
              />
            </div>
          </div>

          <div className="loop-panel" id="loop">
            <div className="loop-intro reveal">
              <p className="card-kicker">Training loop</p>
              <h3>One encoder. Two passes.</h3>
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

            <div className="detach-note reveal">
              <span>Detach matters</span>
              <p>It blocks the shortcut through the clean latent.</p>
            </div>
          </div>

          <div className="animation-panel reveal" id="animation">
            <div className="section-heading">
              <p className="card-kicker">Inference: both reconstruction and generation</p>
              <h3>One latent space, two modes</h3>
            </div>
            <LatentAnimation />
          </div>
        </section>

        <section className="section" id="results">
          <SectionHeading
            kicker="Results"
            title="From scratch, with strong generation and reconstruction"
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
            kicker="Why Weight Sharing Works"
            title="Why sharing helps"
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
