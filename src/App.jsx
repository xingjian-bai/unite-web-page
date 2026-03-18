import { useEffect } from "react";

const navItems = [
  { label: "Story", href: "#story" },
  { label: "Idea", href: "#idea" },
  { label: "Results", href: "#results" },
  { label: "Citation", href: "#citation" },
];

const storyCards = [
  {
    eyebrow: "Staged training",
    title: "Tokenizer first. Generator later.",
    body: "Most latent diffusion pipelines freeze a tokenizer, then train a separate denoiser on top.",
  },
  {
    eyebrow: "Naive end-to-end",
    title: "Backprop through z = E(x) is not enough.",
    body: "Easy-to-denoise latents can be low-information latents. Better denoising loss does not automatically mean better samples.",
  },
  {
    eyebrow: "UNITE",
    title: "One weight-shared encoder for both modes.",
    body: "Tokenization and denoising are two versions of the same latent inference problem, so we train them together from scratch.",
  },
];

const loopSteps = [
  {
    number: "01",
    title: "Tokenize",
    body: "Run the shared encoder on image patches and latent registers to get the clean latent z0.",
  },
  {
    number: "02",
    title: "Detach + noise",
    body: "Stop-gradient on z0, then corrupt it into zt for the denoising objective.",
  },
  {
    number: "03",
    title: "Denoise with the same weights",
    body: "Run the same encoder again, now without image patches, to predict the clean latent.",
  },
];

const statCards = [
  { label: "Training regime", value: "Single-stage", note: "tokenizer + generator together" },
  { label: "External teacher", value: "None", note: "no DINO, train from scratch" },
  { label: "ImageNet FID", value: "2.27", note: "UNITE-B" },
  { label: "Best XL FID", value: "1.82", note: "UNITE-XL-L" },
  { label: "Reconstruction rFID", value: "1.01", note: "no adv., no teacher" },
  { label: "QM9 match", value: "99.37%", note: "single-stage beyond vision" },
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
  { title: "House finch", image: "./assets/samples-web/house-finch.jpg" },
  { title: "Golden retriever", image: "./assets/samples-web/golden-retriever.jpg" },
  { title: "Sea anemone", image: "./assets/samples-web/sea-anemone.jpg" },
];

const analysisCards = [
  {
    title: "Weight sharing gives the best reconstruction / generation tradeoff",
    image: "./assets/figures/stop_grad_ablations_sep_vs_ours.png",
    body: "The shared setting improves sampleability without giving up reconstruction quality.",
  },
  {
    title: "Tokenizer and denoiser already want similar representations",
    image: "./assets/figures/cka_ablation_plot_v2.png",
    body: "Layer-wise similarity helps explain why one encoder can serve both roles.",
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
        <h3>Competitive latent diffusion, trained jointly from scratch</h3>
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
        <h3>Strong tokenizer quality without an external teacher</h3>
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

function App() {
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
      <header className="site-header">
        <a className="brand" href="#top">
          UNITE
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
          <div className="hero-copy">
            <p className="hero-kicker">ICML 2026 · MIT & Adobe</p>
            <h1>UNITE</h1>
            <p className="hero-title">
              End-to-End Training for Unified Tokenization and Latent Denoising
            </p>
            <p className="hero-summary">
              A single-stage latent diffusion model where one weight-shared
              Generative Encoder acts as both tokenizer and denoiser.
            </p>
            <div className="hero-tags">
              <span>Single-stage</span>
              <span>From scratch</span>
              <span>No external teacher</span>
              <span>Shared weights</span>
            </div>
            <p className="hero-authors">
              Shivam Duggal*, Xingjian Bai*, Zongze Wu, Richard Zhang, Eli
              Shechtman, Antonio Torralba, Phillip Isola, William T. Freeman
            </p>
            <p className="hero-meta">Massachusetts Institute of Technology · Adobe · * equal contribution</p>
            <div className="hero-actions">
              <a className="button primary" href="./assets/docs/unite-paper.pdf">
                Paper PDF
              </a>
              <a className="button" href="#results">
                Key Results
              </a>
            </div>
          </div>

          <div className="hero-figure card">
            <img src="./assets/figures/teaser2.png" alt="UNITE teaser figure" />
          </div>
        </section>

        <section className="section proof-strip reveal">
          {statCards.map((item) => (
            <article className="stat-card" key={item.label}>
              <span>{item.label}</span>
              <strong>{item.value}</strong>
              <small>{item.note}</small>
            </article>
          ))}
        </section>

        <section className="section" id="story">
          <SectionHeading
            kicker="Story"
            title="The whole pitch in three steps"
            subtitle="This page follows the thread version of the paper: staged training, naive end-to-end failure, and the shared-weight fix."
          />

          <div className="story-grid">
            {storyCards.map((card) => (
              <article className="card story-card reveal" key={card.title}>
                <p className="card-kicker">{card.eyebrow}</p>
                <h3>{card.title}</h3>
                <p>{card.body}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="section concept-section" id="idea">
          <div className="concept-copy">
            <SectionHeading
              kicker="Core Idea"
              title="Tokenization is generation with strong observability"
              subtitle="With an image, latent inference is tightly constrained. With noise, the same inference problem becomes weakly conditioned. UNITE uses one shared encoder for both."
            />

            <div className="idea-note reveal">
              <p>
                This is the main claim we are selling. Not a bigger pipeline.
                Not a better teacher. A simpler latent diffusion recipe:
                weight sharing lets tokenization and denoising co-design the
                same latent space from scratch.
              </p>
            </div>
          </div>

          <div className="card figure-card reveal">
            <img
              src="./assets/figures/shared_latent_space5.png"
              alt="Shared latent space figure"
              loading="lazy"
            />
          </div>
        </section>

        <section className="section" id="loop">
          <SectionHeading
            kicker="Training Loop"
            title="One encoder. Two passes. One loop."
            subtitle="Tokenize, detach and noise, then denoise with the same weights."
          />

          <div className="card figure-card loop-figure reveal">
            <img
              src="./assets/figures/architecture_uldae_v3.png"
              alt="UNITE training architecture"
              loading="lazy"
            />
          </div>

          <div className="loop-steps">
            {loopSteps.map((step) => (
              <article className="card loop-step reveal" key={step.number}>
                <span>{step.number}</span>
                <h3>{step.title}</h3>
                <p>{step.body}</p>
              </article>
            ))}

            <article className="card detach-card reveal">
              <p className="card-kicker">Detach matters</p>
              <h3>It keeps joint training stable.</h3>
              <p>
                Denoising no longer shortcuts through the clean latent, while
                both objectives still update the same shared weights.
              </p>
            </article>
          </div>
        </section>

        <section className="section" id="results">
          <SectionHeading
            kicker="Results"
            title="From scratch. No DINO. Competitive ImageNet."
            subtitle="UNITE is concise in design and strong in practice."
          />

          <div className="results-grid">
            <GenerationTable />
            <ReconstructionTable />
          </div>

          <div className="sample-header reveal">
            <p className="card-kicker">Qualitative samples</p>
            <h3>Jointly trained latents still generate clean, diverse images</h3>
          </div>

          <div className="sample-grid">
            {sampleCards.map((card) => (
              <article className="card sample-card reveal" key={card.title}>
                <div className="sample-frame">
                  <img src={card.image} alt={card.title} loading="lazy" />
                </div>
                <h3>{card.title}</h3>
              </article>
            ))}
          </div>
        </section>

        <section className="section">
          <SectionHeading
            kicker="Why Weight Sharing Works"
            title="Cleaner idea, better tradeoff"
            subtitle="The shared encoder is not only conceptually simpler. It also gives a strong reconstruction-generation balance."
          />

          <div className="analysis-grid">
            {analysisCards.map((card) => (
              <article className="card analysis-card reveal" key={card.title}>
                <div className="analysis-frame">
                  <img src={card.image} alt={card.title} loading="lazy" />
                </div>
                <h3>{card.title}</h3>
                <p>{card.body}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="section citation-grid" id="citation">
          <article className="card citation-card reveal">
            <p className="card-kicker">Paper</p>
            <h3>Resources</h3>
            <div className="resource-links">
              <a className="button primary" href="./assets/docs/unite-paper.pdf">
                Open PDF
              </a>
              <a className="button" href="#results">
                View Results
              </a>
            </div>
          </article>

          <article className="card citation-card reveal">
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
