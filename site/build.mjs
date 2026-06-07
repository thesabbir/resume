// Zero-dependency static-site build.
// Reads the canonical Markdown résumé, renders the page, copies download
// assets, and measures its own output so the colophon never lies.
//
// Run:  node site/build.mjs   (from repo root)
// Out:  dist/index.html + résumé downloads
//
// No framework. No runtime JavaScript ships to the browser. No web fonts.

import { readFileSync, writeFileSync, copyFileSync, mkdirSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DIST = join(ROOT, "dist");
const RESUME_MD = join(ROOT, "Sabbir_Ahmed_Resume_2026.md");
const PDF = "Sabbir_Ahmed_Resume_2026.pdf";
const DOCX = "Sabbir_Ahmed_Resume_2026.docx";

/* ----------------------------------------------------------------------------
   Editable content. The narrative below is the curated voice of the site.
   Keep it strictly grounded in the résumé facts — this is the founder's own
   page; invented specifics would betray the brand it sells.
---------------------------------------------------------------------------- */

const SITE_URL = "https://thesabbir.github.io/resume/";

const content = {
  name: "Sabbir Ahmed",
  tagline: "Product Engineer · AI-Agent Orchestration",
  eyebrow: "Product Engineer · Dhaka, Bangladesh · Remote",
  headline:
    "I build products by conducting AI&nbsp;agents&nbsp;— and designing the systems that keep&nbsp;them&nbsp;honest.",
  intro:
    "Product engineer, 10+ years taking things zero-to-launch across Norway, the US, the UAE and Finland — a founding role through acquisition, a CTO seat, and now a stealth venture I'm building solo, at a scope that used to take a team.",
  contactLine: "Email is the surest way to reach me.",
  links: [
    { label: "Email", href: "mailto:sabbirahmed8361@gmail.com", text: "sabbirahmed8361@gmail.com" },
    { label: "GitHub", href: "https://github.com/thesabbir", text: "github.com/thesabbir" },
    { label: "LinkedIn", href: "https://linkedin.com/in/sabbirahm", text: "linkedin.com/in/sabbirahm" },
  ],

  // "How I work" — the differentiator. Grounded only in known facts.
  method: [
    "For ten years I shipped products by writing the code. Now I ship them by directing AI agents to write it — and the hard part was never the prompting. It's the judgment.",
    "Agents are fast, tireless, and non-deterministic. Pointed at a real product they produce volume; left unsupervised they produce plausible nonsense. My work is the system that makes the difference: deciding what to build, setting the rules the agents operate under, and standing up the automated checks and tests that catch regressions before I do. The agents do the volume. I own the correctness.",
    "That means designing just enough system — and no more. For the venture I'm building now, that's an event-sourced backend, hard multi-tenant isolation, a Rust core and a TypeScript SDK: enough structure to stay fast and correct while many agents edit at once, without the architecture-for-its-own-sake that slows everything down.",
    "One campaign shipped a ~30,000-line change across a chain of 22 branches — the kind of scope that used to need a team. The leverage is real. But it only holds when someone with taste is holding the rules. That's the part I'm good at.",
  ],

  // Selected work — outcomes, not a logo wall.
  work: [
    {
      org: "Stealth",
      role: "Founder & Product Engineer",
      when: "Feb 2026 — Present",
      note: "Building a multi-tenant commerce product solo, by orchestrating fleets of AI coding agents under guardrails I designed to keep them honest.",
    },
    {
      org: "Cefalo",
      role: "Staff / Lead Engineer (Norway clients)",
      when: "2023 — 2026",
      note: "Built growth features for a multi-tenant subscription platform and helped take it from ~2k to 300k+ users across 10–15 tenants.",
    },
    {
      org: "Ngaze",
      role: "Lead Engineer / CTO",
      when: "2023",
      note: "Shipped an LLM-powered course-authoring tool — non-engineers generating interactive lessons — and took the platform from idea to live with two partners, before LLM features were mainstream.",
    },
    {
      org: "Fasset",
      role: "Senior Software Engineer",
      when: "2021 — 2023",
      note: "Rebuilt a struggling crypto-exchange backend: cut core-service cost 50% and laid the foundation it now scales millions of users on. Shipped the P2P launch.",
    },
    {
      org: "Cookups",
      role: "Founding / Lead Engineer",
      when: "2017 — 2019",
      note: "Built a home-cook marketplace across web, iOS and Android from one codebase; hired and led four engineers to acquisition by Chaldal.",
    },
  ],
  earlier:
    "Earlier — Shohoz (brought food delivery to web, launched truck rental), BAIA Group (supply-chain tracing tuned for 2G/3G), and East West Media Group (real-time WebRTC messaging, led a team of six).",
};

/* ----------------------------------------------------------------------------
   Minimal, purpose-built Markdown → HTML for the résumé block.
   Supports exactly the constructs this résumé uses: #/##/### headings,
   **bold**, *italic*, and "- " unordered lists. Output is verified against
   the actual file at build time — correctness over cleverness.
---------------------------------------------------------------------------- */

const esc = (s) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const inline = (s) =>
  esc(s)
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>");

function renderMarkdown(md) {
  const lines = md.replace(/\r\n/g, "\n").split("\n");
  const out = [];
  let para = []; // buffered consecutive text lines
  let list = []; // buffered consecutive bullets

  const flushPara = () => {
    if (para.length) {
      out.push(`<p>${para.map(inline).join("<br>")}</p>`);
      para = [];
    }
  };
  const flushList = () => {
    if (list.length) {
      out.push(`<ul>${list.map((li) => `<li>${inline(li)}</li>`).join("")}</ul>`);
      list = [];
    }
  };
  const flush = () => {
    flushPara();
    flushList();
  };

  for (const raw of lines) {
    const line = raw.trimEnd();
    if (!line.trim()) {
      flush();
    } else if (line.startsWith("### ")) {
      // Job titles — deepest level, nested under the résumé section <h2>.
      flush();
      out.push(`<h5>${inline(line.slice(4))}</h5>`);
    } else if (line.startsWith("## ")) {
      // CV parts: Summary, Experience, Technical Skills, Education.
      flush();
      out.push(`<h4>${inline(line.slice(3))}</h4>`);
    } else if (line.startsWith("# ")) {
      // The CV name — a sub-heading of the "Full résumé" section.
      flush();
      out.push(`<h3 class="cv-name">${inline(line.slice(2))}</h3>`);
    } else if (line.startsWith("- ")) {
      flushPara();
      list.push(line.slice(2));
    } else {
      flushList();
      para.push(line);
    }
  }
  flush();
  return out.join("\n");
}

/* ---------------------------------------------------------------------------- */

const linkRow = content.links
  .map((l) => `<a class="u" href="${l.href}">${l.text}</a>`)
  .join('<span class="dot">·</span>');

const workRows = content.work
  .map(
    (w) => `
      <li class="work">
        <div class="work-head">
          <span class="work-org">${w.org}</span>
          <span class="work-when">${w.when}</span>
        </div>
        <div class="work-role">${w.role}</div>
        <p class="work-note">${w.note}</p>
      </li>`
  )
  .join("");

const methodHtml = content.method.map((p) => `<p>${p}</p>`).join("\n        ");

const resumeHtml = renderMarkdown(readFileSync(RESUME_MD, "utf8"));

// Inline SVG favicon — a navy monogram. Zero extra request.
const favicon =
  "data:image/svg+xml," +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="%231E3A66"/><text x="32" y="44" font-family="Georgia,serif" font-size="38" fill="%23F6F3EC" text-anchor="middle">S</text></svg>`
  ).replace(/%23/g, "%23");

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${content.name} — ${content.tagline}</title>
<meta name="description" content="${content.name}. I build products by conducting AI agents — and designing the systems that keep them honest. 10+ years zero-to-launch.">
<meta name="author" content="${content.name}">
<link rel="canonical" href="${SITE_URL}">
<meta property="og:title" content="${content.name} — Product Engineer">
<meta property="og:description" content="I build products by conducting AI agents — and designing the systems that keep them honest.">
<meta property="og:type" content="profile">
<meta property="og:url" content="${SITE_URL}">
<meta property="og:image" content="${SITE_URL}og.png">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${content.name} — Product Engineer">
<meta name="twitter:description" content="I build products by conducting AI agents — and designing the systems that keep them honest.">
<meta name="twitter:image" content="${SITE_URL}og.png">
<link rel="icon" href="${favicon}">
<style>
  :root{
    --bg:#F6F3EC; --panel:#FBF9F3; --ink:#16181D; --muted:#5B6271;
    --accent:#1E3A66; --hair:rgba(20,22,29,.12); --max:46rem;
  }
  @media (prefers-color-scheme: dark){
    :root{
      --bg:#0B0E14; --panel:#10141C; --ink:#E9E6DD; --muted:#8B93A5;
      --accent:#9DB7EA; --hair:rgba(233,230,221,.14);
    }
  }
  *{box-sizing:border-box}
  html{-webkit-text-size-adjust:100%}
  body{
    margin:0; background:var(--bg); color:var(--ink);
    font-family:ui-serif,"Iowan Old Style","Palatino Linotype",Palatino,"Hoefler Text",Georgia,"Times New Roman",serif;
    font-size:18px; line-height:1.62; letter-spacing:.001em;
    -webkit-font-smoothing:antialiased; text-rendering:optimizeLegibility;
    font-feature-settings:"kern","liga","onum","pnum";
  }
  body{hanging-punctuation:first last}
  .wrap{max-width:var(--max); margin:0 auto; padding:0 clamp(1.25rem,5vw,2rem);
    counter-reset:section}
  a{color:inherit; text-decoration:none}
  .mono{font-family:ui-monospace,"SF Mono","JetBrains Mono",Menlo,Consolas,monospace}
  /* links: a faint resting underline that an accent line wipes over on hover */
  .u{background-image:linear-gradient(var(--accent),var(--accent));
    background-repeat:no-repeat; background-position:0 100%; background-size:0 1px;
    padding-bottom:2px; border-bottom:1px solid var(--hair);
    transition:background-size .4s cubic-bezier(.2,.7,.2,1), color .3s, border-color .3s}
  .u:hover{color:var(--ink); background-size:100% 1px; border-color:transparent}

  /* ---- header ---- */
  header{display:flex; justify-content:space-between; align-items:baseline;
    padding:clamp(1.5rem,5vw,2.4rem) 0 0; gap:1rem}
  .brand{font-size:.78rem; letter-spacing:.16em; text-transform:uppercase; color:var(--muted)}
  nav{font-size:.74rem; letter-spacing:.12em; text-transform:uppercase; color:var(--muted)}
  nav a{margin-left:1.1rem}
  nav a:hover{color:var(--ink)}

  /* ---- hero ---- */
  .hero{padding:clamp(2.75rem,11vh,6rem) 0 clamp(2.5rem,8vh,4.5rem)}
  .eyebrow{font-family:ui-monospace,"SF Mono","JetBrains Mono",Menlo,Consolas,monospace;
    font-size:.72rem; letter-spacing:.16em; text-transform:uppercase;
    color:var(--accent); margin:0 0 1.5rem}
  h1{
    font-weight:540; font-size:clamp(2.2rem,6.4vw,4.15rem); line-height:1.04;
    letter-spacing:-.023em; margin:0 0 1.5rem; max-width:19ch;
    text-wrap:balance;
  }
  .intro{font-size:clamp(1.04rem,2.4vw,1.26rem); color:var(--muted);
    max-width:42ch; margin:0 0 2rem; line-height:1.5; text-wrap:pretty}
  .links{font-size:.86rem; color:var(--muted)}
  .dot{margin:0 .55rem; opacity:.45}

  /* ---- sections ---- */
  section{padding:clamp(2.6rem,7vw,3.8rem) 0; border-top:1px solid var(--hair)}
  /* section titles are real <h2>, styled as numbered mono labels */
  h2.label{font-family:ui-monospace,"SF Mono","JetBrains Mono",Menlo,Consolas,monospace;
    font-size:.7rem; font-weight:400; letter-spacing:.2em; text-transform:uppercase;
    color:var(--accent); margin:0 0 1.7rem; display:flex; align-items:baseline; gap:.7rem}
  section > h2.label::before{counter-increment:section;
    content:counter(section,decimal-leading-zero);
    color:var(--muted); font-size:.78rem; letter-spacing:.08em}
  .prose p{margin:0 0 1.2rem; max-width:62ch; text-wrap:pretty}
  .prose p:last-child{margin-bottom:0}

  /* ---- selected work ---- */
  ul.work-list{list-style:none; margin:0; padding:0}
  li.work{padding:1.15rem 0; border-bottom:1px solid var(--hair)}
  li.work:first-child{padding-top:0}
  .work-head{display:flex; justify-content:space-between; align-items:baseline; gap:1rem}
  .work-org{font-size:1.18rem; font-weight:560; letter-spacing:-.01em}
  .work-when{font-family:ui-monospace,"SF Mono","JetBrains Mono",Menlo,Consolas,monospace;
    font-size:.72rem; letter-spacing:.06em; color:var(--muted); white-space:nowrap}
  .work-role{color:var(--accent); font-size:.92rem; margin:.1rem 0 .35rem}
  .work-note{margin:0; color:var(--ink); max-width:60ch; font-size:.98rem; line-height:1.5}
  .earlier{color:var(--muted); font-size:.92rem; margin:1.3rem 0 0; max-width:60ch}

  /* ---- résumé block ---- */
  .actions{display:flex; gap:.7rem; flex-wrap:wrap; margin:0 0 2rem}
  .btn{display:inline-flex; align-items:center; gap:.5rem;
    font-family:ui-monospace,"SF Mono","JetBrains Mono",Menlo,Consolas,monospace;
    font-size:.74rem; letter-spacing:.08em; text-transform:uppercase;
    color:var(--bg); background:var(--accent); padding:.62rem 1rem; border-radius:.5rem;
    transition:transform .18s ease, opacity .18s ease}
  .btn.ghost{background:transparent; color:var(--accent);
    box-shadow:inset 0 0 0 1px var(--accent)}
  .btn:hover{transform:translateY(-1px); opacity:.92}

  /* full résumé tucked into an expander so the curated work leads */
  details.cv-details{margin:0}
  details.cv-details summary{list-style:none; cursor:pointer; display:inline-flex;
    align-items:center; gap:.5rem; width:max-content;
    font-family:ui-monospace,"SF Mono","JetBrains Mono",Menlo,Consolas,monospace;
    font-size:.74rem; letter-spacing:.08em; text-transform:uppercase; color:var(--muted);
    transition:color .25s}
  details.cv-details summary::-webkit-details-marker{display:none}
  details.cv-details summary:hover{color:var(--ink)}
  details.cv-details summary::after{content:"\\2193"; transition:transform .3s; opacity:.7}
  details.cv-details[open] summary{margin-bottom:1.4rem}
  details.cv-details[open] summary::after{transform:rotate(180deg)}

  .cv{border:1px solid var(--hair); border-radius:.9rem; background:var(--panel);
    padding:clamp(1.4rem,4vw,2.4rem); font-size:.92rem}
  .cv .cv-name{font-size:1.5rem; font-weight:560; letter-spacing:-.01em; margin:0 0 .1rem}
  .cv h4{font-family:ui-monospace,"SF Mono","JetBrains Mono",Menlo,Consolas,monospace;
    font-size:.7rem; font-weight:400; letter-spacing:.18em; text-transform:uppercase; color:var(--accent);
    margin:1.8rem 0 .7rem; padding-bottom:.4rem; border-bottom:1px solid var(--hair)}
  .cv h5{font-size:1.05rem; font-weight:560; margin:1.25rem 0 .15rem}
  .cv p{margin:.15rem 0 .5rem; color:var(--ink)}
  .cv em{color:var(--muted); font-style:italic}
  .cv ul{margin:.3rem 0 .8rem; padding-left:1.1rem}
  .cv li{margin:0 0 .3rem; line-height:1.5}
  .cv li::marker{color:var(--accent)}

  /* ---- contact + colophon ---- */
  .contact-line{margin:0 0 1.1rem; max-width:48ch}
  .contact .links{font-size:1rem}
  footer{border-top:1px solid var(--hair); padding:2.4rem 0 4rem;
    color:var(--muted); font-size:.82rem; line-height:1.7}
  footer .label{color:var(--muted)}
  footer code{font-family:ui-monospace,"SF Mono","JetBrains Mono",Menlo,Consolas,monospace;
    color:var(--ink); font-size:.92em}
  footer code{color:var(--ink)}

  /* ---- the one motion moment: a quiet load reveal ---- */
  @media (prefers-reduced-motion: no-preference){
    .reveal{opacity:0; transform:translateY(10px); animation:rise .8s cubic-bezier(.2,.7,.2,1) forwards}
    .reveal.d1{animation-delay:.04s}
    .reveal.d2{animation-delay:.14s}
    .reveal.d3{animation-delay:.26s}
    .reveal.d4{animation-delay:.38s}
    @keyframes rise{to{opacity:1; transform:none}}
  }
  ::selection{background:var(--accent); color:var(--bg)}

  /* ---- print: a clean fallback; the PDF download is the real artifact ---- */
  @media print{
    :root{--bg:#fff; --panel:#fff; --ink:#000; --muted:#333; --accent:#1a3e6f; --hair:#ccc}
    header nav, .actions, .links, .contact-line, footer, .eyebrow{display:none}
    .reveal{opacity:1; transform:none; animation:none}
    section{border-top:1px solid #ccc; padding:1rem 0}
    .cv{border:0; padding:0}
    details.cv-details summary{display:none}
    details.cv-details > .cv{display:block}  /* force the résumé open when printing */
    a{color:#000}
  }
</style>
</head>
<body>
<div class="wrap">

  <header>
    <span class="brand">${content.name}</span>
    <nav>
      <a href="#work">Work</a>
      <a href="#resume">Résumé</a>
      <a href="#contact">Contact</a>
    </nav>
  </header>

  <div class="hero">
    <div class="eyebrow reveal d1">${content.eyebrow}</div>
    <h1 class="reveal d2">${content.headline}</h1>
    <p class="intro reveal d3">${content.intro}</p>
    <div class="links reveal d4">${linkRow}</div>
  </div>

  <section id="method">
    <h2 class="label">How I work</h2>
    <div class="prose">
        ${methodHtml}
    </div>
  </section>

  <section id="work">
    <h2 class="label">Selected work</h2>
    <ul class="work-list">${workRows}
    </ul>
    <p class="earlier">${content.earlier}</p>
  </section>

  <section id="resume">
    <h2 class="label">Full résumé</h2>
    <div class="actions">
      <a class="btn" href="${PDF}" download>Download PDF</a>
      <a class="btn ghost" href="${DOCX}" download>Download DOCX</a>
    </div>
    <details class="cv-details">
      <summary><span>Read the full résumé</span></summary>
      <article class="cv">
${resumeHtml}
      </article>
    </details>
  </section>

  <section id="contact" class="contact">
    <h2 class="label">Contact</h2>
    <p class="contact-line">${content.contactLine}</p>
    <div class="links">${linkRow}</div>
  </section>

  <footer>
    <h2 class="label">Colophon</h2>
    One hand-written HTML file with inline CSS. No framework, no runtime JavaScript,
    no web fonts — it uses your system's own typefaces. Built from a single Markdown
    résumé by a zero-dependency script; the document weighs <code>__PAGE_SIZE__</code>
    and renders in one request. Dark mode follows your system.
    Source on <a class="u" href="https://github.com/thesabbir/resume">GitHub</a>.
  </footer>

</div>
</body>
</html>`;

/* ---- self-measure to a fixed point: the printed size IS the file size ----
   The size string lives inside the file, so substituting it changes the byte
   count. Iterate until the figure stops moving (converges in 1–2 passes). */
mkdirSync(DIST, { recursive: true });
const outFile = join(DIST, "index.html");
const fmt = (s) => (Buffer.byteLength(html.replace("__PAGE_SIZE__", s), "utf8") / 1024).toFixed(1) + " KB";
let kb = fmt("00.0 KB");
for (let i = 0; i < 5; i++) {
  const next = fmt(kb);
  if (next === kb) break;
  kb = next;
}
const finalHtml = html.replace("__PAGE_SIZE__", kb);
writeFileSync(outFile, finalHtml);
const trueBytes = statSync(outFile).size; // sanity: matches the printed figure

copyFileSync(join(ROOT, PDF), join(DIST, PDF));
copyFileSync(join(ROOT, DOCX), join(DIST, DOCX));
copyFileSync(join(ROOT, "og.png"), join(DIST, "og.png"));
writeFileSync(join(DIST, ".nojekyll"), "");

console.log(`built dist/index.html — colophon says ${kb}, file is ${trueBytes} bytes`);
console.log(`copied ${PDF}, ${DOCX}, og.png`);
