import { useEffect } from "react";

const navItems = [
  { label: "Opening", href: "#story" },
  { label: "Method", href: "#idea" },
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

const sampleMontages = [
  { title: "Common iguana", image: "./assets/samples/summary_039_common_iguana.png" },
  { title: "Goose", image: "./assets/samples/summary_099_goose.png" },
  { title: "Pelican", image: "./assets/samples/summary_144_pelican.png" },
  { title: "Bee", image: "./assets/samples/summary_309_bee.png" },
  { title: "Candle", image: "./assets/samples/summary_470_candle.png" },
  { title: "Plane", image: "./assets/samples/summary_725_plane.png" },
  { title: "Ice cream", image: "./assets/samples/summary_930_ice_cream.png" },
  { title: "Cauliflower", image: "./assets/samples/summary_947_cauliflower.png" },
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
          <div className="hero-shell">
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
              <p className="hero-meta">
                Massachusetts Institute of Technology · Adobe · * equal contribution
              </p>
              <div className="hero-actions">
                <a className="button primary" href="./assets/docs/unite-paper.pdf">
                  Paper PDF
                </a>
                <a className="button" href="#results">
                  Key Results
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
          <SectionHeading
            kicker="Opening"
            title="From staged latent diffusion to one shared encoder"
            subtitle="The argument is simple: staged pipelines are unsatisfying, naive end-to-end is unstable, and weight sharing gives a cleaner solution."
          />

          <div className="narrative-band reveal">
            {storyCards.map((card) => (
              <article className="narrative-step" key={card.title}>
                <p className="card-kicker">{card.eyebrow}</p>
                <h3>{card.title}</h3>
                <p>{card.body}</p>
              </article>
            ))}
          </div>

          <div className="thesis-panel" id="idea">
            <div className="thesis-copy reveal">
              <p className="card-kicker">Core idea</p>
              <h3>Tokenization is generation with strong observability.</h3>
              <p>
                With an image, latent inference is tightly constrained. With
                noise, the same problem becomes weakly conditioned. UNITE uses
                one shared Generative Encoder for both regimes.
              </p>
              <p className="thesis-note">
                Not a larger pipeline. Not a stronger teacher. A simpler latent
                diffusion recipe where tokenization and denoising co-design the
                same latent space from scratch.
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
              <h3>One encoder. Two passes. One loop.</h3>
              <p>
                Tokenize the image, stop-gradient and noise the latent, then
                denoise with the same shared weights.
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
                  <p>{step.body}</p>
                </article>
              ))}
            </div>

            <div className="detach-note reveal">
              <span>Detach matters</span>
              <p>
                It blocks the shortcut through the clean latent, while both
                objectives still update the same shared weights.
              </p>
            </div>
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

          <div className="sample-header reveal sample-header-secondary">
            <p className="card-kicker">More classes</p>
            <h3>Additional class montages from the same jointly trained model</h3>
          </div>

          <div className="montage-grid">
            {sampleMontages.map((card) => (
              <article className="card montage-card reveal" key={card.title}>
                <div className="montage-frame">
                  <img src={card.image} alt={card.title} loading="lazy" />
                </div>
                <p>{card.title}</p>
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
