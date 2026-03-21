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
    title: "Encode",
    body: "The Generative Encoder maps the input image to clean latent tokens. To unify the input format across pathways, we represent the latent as a fixed set of 1-D register tokens.",
  },
  {
    number: "02",
    title: "Denoise",
    body: "The latents are detached from the graph and noised. The same Generative Encoder then denoises them via flow matching, producing the diffusion loss.",
  },
  {
    number: "03",
    title: "Decode",
    body: "The decoder reconstructs the image from the clean latents, producing the reconstruction loss. Both losses jointly update the shared encoder.",
  },
];

const statCards = [
  { label: "Training", value: "Single-stage", note: "one loop" },
  { label: "Teacher", value: "None", note: "no DINO" },
  { label: "ImageNet FID", value: "2.12", note: "UNITE-B" },
  { label: "Reconstruction", value: "1.01", note: "rFID" },
];

const generationRows = [
  { method: "JiT-B/16", pipeline: "single-stage", params: "131M", fid: "3.66", is: "275.1", section: "Single-stage" },
  { method: "UNITE-B (Ours)", pipeline: "single-stage", params: "217M", fid: "2.12", is: "294.1", ours: true },
  { method: "JiT-L/16", pipeline: "single-stage", params: "459M", fid: "2.36", is: "298.5" },
  { method: "UNITE-L (Ours)", pipeline: "single-stage", params: "589M", fid: "1.73", is: "296.0", ours: true },
  { method: "PixelFlow-XL/4", pipeline: "single-stage", params: "677M", fid: "1.98", is: "282.1" },
  { method: "PixNerd-XL/16", pipeline: "single-stage", params: "700M", fid: "2.15", is: "297" },
  { method: "UNITE-XL (Ours)", pipeline: "single-stage", params: "806M", fid: "1.75", is: "309.9", ours: true },
  { method: "JiT-H/16", pipeline: "single-stage", params: "953M", fid: "1.86", is: "303.4" },
  { method: "SiD", pipeline: "single-stage", params: "2B", fid: "2.44", is: "256.3" },
  { method: "JiT-G/16", pipeline: "single-stage", params: "2B", fid: "1.82", is: "292.6" },
  { method: "DiT-XL/2", pipeline: "two-stage", params: "675M+49M", fid: "2.27", is: "278.2", section: "Two-stage", dimmed: true },
  { method: "SiT-XL/2", pipeline: "two-stage", params: "675M+49M", fid: "2.06", is: "277.5", dimmed: true },
  { method: "REPA-SiT-XL/2", pipeline: "two-stage + DINOv2", params: "675M+49M", fid: "1.42", is: "305.7", section: "Two-stage + DINOv2", dimmed: true },
  { method: "DDT-XL/2", pipeline: "two-stage + DINOv2", params: "675M+49M", fid: "1.26", is: "310.6", dimmed: true },
];

const reconstructionRows = [
  { method: "ViTok-B/16", setup: "no adv., no teacher", rfid: "1.63" },
  { method: "UNITE-B", setup: "no adv., no teacher", rfid: "1.01", ours: true },
  { method: "UNITE-B + GAN ft", setup: "decoder-only GAN", rfid: "0.51", ours: true },
  { method: "RAE", setup: "adv. + DINOv2", rfid: "0.58" },
];

const featuredSamples = [
  { title: "Class 108: Sea Anemone", image: "./assets/samples/summary_108_sea_anemone.png" },
  { title: "Class 309: Bee", image: "./assets/samples/summary_309_bee.png" },
];

const gridSamples = [
  { title: "Class 12: House Finch", image: "./assets/samples/summary_012_house_finch.png" },
  { title: "Class 39: Common Iguana", image: "./assets/samples/summary_039_common_iguana.png" },
  { title: "Class 99: Goose", image: "./assets/samples/summary_099_goose.png" },
  { title: "Class 144: Pelican", image: "./assets/samples/summary_144_pelican.png" },
  { title: "Class 207: Golden Retriever", image: "./assets/samples/summary_207_golden_retriever.png" },
  { title: "Class 470: Candle", image: "./assets/samples/summary_470_candle.png" },
  { title: "Class 725: Pitcher", image: "./assets/samples/summary_725_plane.png" },
  { title: "Class 930: French Loaf", image: "./assets/samples/summary_930_ice_cream.png" },
];

/* Analysis figures and text are rendered inline below for clearer figure–text pairing */

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
            <span>Pipeline</span>
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
                <span className="cell" data-label="Pipeline">
                  {row.pipeline}
                </span>
                {row.ours ? (
                  <strong className="cell cell-strong" data-label="FID ↓">{row.fid}</strong>
                ) : (
                  <span className="cell" data-label="FID ↓">{row.fid}</span>
                )}
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
              {row.ours ? (
                <strong className="cell cell-strong" data-label="rFID ↓">{row.rfid}</strong>
              ) : (
                <span className="cell" data-label="rFID ↓">{row.rfid}</span>
              )}
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
                <a href="https://shivamduggal4.github.io/" target="_blank" rel="noopener noreferrer">Shivam Duggal*</a><sup>1</sup>,{" "}
                <a href="https://xingjianbai.com/" target="_blank" rel="noopener noreferrer">Xingjian Bai*</a><sup>1</sup>,{" "}
                <a href="https://betterze.github.io/website/" target="_blank" rel="noopener noreferrer">Zongze Wu</a><sup>2</sup>,{" "}
                <a href="https://richzhang.github.io/" target="_blank" rel="noopener noreferrer">Richard Zhang</a><sup>2</sup>,{" "}
                <a href="https://scholar.google.com/citations?user=B_FTboQAAAAJ" target="_blank" rel="noopener noreferrer">Eli Shechtman</a><sup>2</sup>,
                <br />
                <a href="https://groups.csail.mit.edu/vision/torralbalab/" target="_blank" rel="noopener noreferrer">Antonio Torralba</a><sup>1</sup>,{" "}
                <a href="https://web.mit.edu/phillipi/" target="_blank" rel="noopener noreferrer">Phillip Isola</a><sup>1</sup>,{" "}
                <a href="https://billf.mit.edu/" target="_blank" rel="noopener noreferrer">William T. Freeman</a><sup>1</sup>
              </p>
              <p className="hero-meta">
                <sup>1</sup>Massachusetts Institute of Technology &nbsp; <sup>2</sup>Adobe
              </p>
              <div className="hero-actions">
                <a className="button primary" href="./assets/docs/unite-paper.pdf">
                  Paper PDF
                </a>
                <a className="button" href="https://github.com/ShivamDuggal4/united-dev/" target="_blank" rel="noopener noreferrer">
                  GitHub
                </a>
              </div>
            </div>

            <div className="hero-figure">
              <img src="./assets/figures/teaser2.png" alt="UNITE teaser figure" loading="lazy" />
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
              UNITE learns a <em>common latent language</em> for tokenization and generation.
            </p>
          </div>

          <div className="thesis-panel" id="idea">
            <div className="thesis-copy reveal">
              <p className="card-kicker">Core idea</p>
              <h3>Tokenization is generation with strong observability</h3>
              <p>
                Tokenization infers latents from a fully observed image;
                generation infers them from noise. Same inference problem, different conditioning.
                One weight-shared <strong>Generative Encoder</strong> handles both modes,
                learning a common latent language where the same attention and MLP weights
                support both — conditioning on an image yields a near-deterministic latent,
                while starting from noise yields a broader distribution for sampling.
              </p>
            </div>
            <div className="loop-panel-figure reveal">
              <LatentAnimation />
            </div>
          </div>

          <div className="loop-panel" id="loop">
            <div className="loop-intro reveal">
              <p className="card-kicker">Training</p>
              <h3>Two forward passes, one Generative Encoder</h3>
              <p className="loop-desc">
                The Generative Encoder tokenizes an image into clean latent tokens, which the decoder maps back to pixels to compute a <strong>reconstruction loss</strong>.
                The same latents are then detached and noised, and the <em>same</em> Generative Encoder denoises them to compute a <strong>flow-matching loss</strong>.
                Both losses update the shared encoder weights, jointly shaping a latent space that serves both tokenization and generation.
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
                  <div>
                    <h3>{step.title}</h3>
                    {step.body ? <p>{step.body}</p> : null}
                  </div>
                  <span>{step.number}</span>
                </article>
              ))}
            </div>

          </div>

          <div className="animation-panel reveal" id="animation">
            <div className="loop-intro">
              <p className="card-kicker">Inference</p>
              <h3>Tokenization and generation using the same model</h3>
              <p className="loop-desc">
                For tokenization, the Generative Encoder maps an image to latents in a single forward pass.
                For generation, we start from Gaussian noise and iteratively denoise through multiple passes of the Generative Encoder.
              </p>
            </div>
            <div className="loop-panel-figure">
              <img src="./assets/figures/shared_latent_space5.png" alt="Tokenization and generation as the same latent inference problem" loading="lazy" />
            </div>
          </div>
        </section>

        <section className="section" id="results">
          <div className="loop-intro reveal">
            <p className="card-kicker">Results</p>
            <h3>Single-stage, end-to-end — no pre-trained DINO, no adversarial loss</h3>
          </div>

          <div className="results-grid">
            <GenerationTable />
          </div>

          <div className="sample-header reveal">
            <p className="card-kicker">Samples from ImageNet 256×256</p>
          </div>

          <div className="samples-featured">
            {featuredSamples.map((card) => (
              <article className="sample-card reveal clickable" key={card.title} onClick={() => openLightbox(card.image, card.title)}>
                <div className="sample-frame">
                  <img src={card.image} alt={card.title} loading="lazy" />
                </div>
                <p>{card.title}</p>
              </article>
            ))}
          </div>

          <div className="samples-grid-small">
            {gridSamples.map((card) => (
              <article className="sample-card reveal clickable" key={card.title} onClick={() => openLightbox(card.image, card.title)}>
                <div className="sample-frame">
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
            title="Analyzing the Generative Encoder"
            subtitle="Parameter tying suggests the model may develop a common latent language — shared internal features and transformations that simultaneously support reconstruction and generation. We study two ablations to isolate the roles of weight sharing and gradient flow, and analyse them from rFID/gFID metrics and representation alignment. See paper Sec. 4 for a compression (compressed weight entropy) analysis."
            small
          />

          <div className="analysis-grid">
            <article className="analysis-card reveal">
              <h3>Weight sharing yields the best reconstruction–generation trade-off</h3>
              <p>
                While a separate encoder–denoiser ablation is competitive, parameter tying yields the best overall rFID / gFID trade-off.
                Under weight sharing, increasing the number of flow iterations consistently improves generation fidelity — reducing gFID from 3.33 to 2.12 when performing 14x more flow steps per single reconstruction step — while maintaining or slightly improving reconstruction, suggesting the latent space becomes more sampleable without sacrificing information.
              </p>
              <div className="analysis-frame analysis-frame-narrow">
                <img src="./assets/figures/stop_grad_ablations_sep_vs_ours_latest.png" alt="Weight-shared vs separate encoder-denoiser training" loading="lazy" />
              </div>
            </article>

            <hr className="analysis-divider" />

            <article className="analysis-card reveal">
              <h3>Tokenization and denoising are intrinsically aligned</h3>
              <p>
                We measure alignment between tokenization and denoising activations using CKA and cosine similarity. Given an input image, we first record intermediate activations along the tokenization pathway, then corrupt the encoded latent and record the corresponding denoising-pathway activations.
                <strong> Left:</strong> both the weight-shared UNITE model and the separate encoder–denoiser ablation exhibit strong alignment, especially in later layers, indicating that <em>tokenization and denoising are intrinsically aligned tasks</em>.
              </p>
              <div className="analysis-frame">
                <img src="./assets/figures/cka_analysis_final_v3.png" alt="Representation alignment between tokenization and generation" loading="lazy" />
              </div>
            </article>

            <hr className="analysis-divider" />

            <article className="analysis-card reveal">
              <h3>Backpropagating denoising gradients through to the encoder</h3>
              <p>
                In UNITE, we stop denoising gradients from flowing through the clean latent into the tokenization pathway. After the tokenization pass produces z₀ = GE(x), we apply stop-gradient before constructing the noised latent z_t used in the denoising pass. As a result, the flow-matching objective updates GE only through the second (denoising) forward pass, rather than also directly shaping tokenization through gradients flowing into z₀.
              </p>
              <p>
                Importantly, this does <em>not</em> decouple tokenization and generation: in the weight-shared Generative Encoder, reconstruction and denoising still act on the same set of network parameters, so both objectives jointly shape the learned representation. The stop-gradient only removes the more direct route in which denoising gradients also flow through the clean latent itself.
              </p>
              <p>
                Looking at rFID/gFID, removing the stop-gradient improves the separate encoder–denoiser ablation from 2.60/1.30 to 2.24/0.85 (gFID/rFID), indicating that end-to-end joint training of tokenization and generation is promising. As noted in the concurrent Unified Latents (their Appendix B), obtaining the best performance in the no-stop-gradient setting requires tuning the denoising-to-reconstruction loss ratio. By contrast, for UNITE, we obtain the best performance (gFID = 2.12, rFID = 1.1) with stop-gradient in place.
              </p>
            </article>

            <hr className="analysis-divider" />

            <article className="analysis-card reveal">
              <h3>Backpropagating denoising hurts representation alignment</h3>
              <p>
                As shown in the alignment figure above:
                <strong> Left:</strong> removing the stop-gradient and backpropagating denoising gradients through the latent <em>weakens late-layer alignment</em>, even though the denoising objective still matches the final latent target.
                <strong> Right:</strong> cosine similarity on the final latents decreases at lower denoising timesteps in the no-stop-gradient setting, suggesting that direct gradient backpropagation from denoising into tokenization leads to a less cleanly shared representation.
              </p>
            </article>

            <hr className="analysis-divider" />

            <article className="analysis-card reveal">
              <h3>Stop-gradient preserves cleaner denoising trajectories</h3>
              <p>
                We encode an image into latents, corrupt the latent with noise, and decode the denoised prediction at different noise levels.
                Although all four ablations achieve competitive rFID/gFID, the stop-gradient variants (top two rows) exhibit markedly cleaner intermediate denoising, with higher PSNR to the input across all noise levels — consistent with the representation alignment analysis above.
              </p>
              <div className="analysis-frame">
                <img src="./assets/figures/denoising_analysis_v3.png" alt="Denoising trajectory analysis" loading="lazy" />
              </div>
            </article>
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
