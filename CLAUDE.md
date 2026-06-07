# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this repo is

Two things share this repo: **(1)** Sabbir Ahmed's résumé, maintained as one document in four parallel formats, and **(2)** a hand-built personal-brand **website** (`site/` → `dist/`) deployed to GitHub Pages. The résumé `.md` is the single source of truth that feeds both.

- `Sabbir_Ahmed_Resume_2026.md` — human-readable canonical content. Easiest place to read/edit the actual words.
- `Sabbir_Ahmed_Resume_2026.html` — the **layout-of-record**: self-contained HTML with inline CSS tuned for a single Letter page (`@page` margins, point-based font sizes, flexbox job headers). The PDF is rendered from this file.
- `Sabbir_Ahmed_Resume_2026.pdf` — generated from the HTML by headless Chrome (Skia/PDF). This is the file that gets sent out.
- `Sabbir_Ahmed_Resume_2026.docx` — Word version (LibreOffice-authored). Editable in Word, separate render path from the HTML/PDF.

## The one rule that matters: keep all four formats in sync

A content change (a new role, a reworded bullet, updated contact info) must be applied to **every** format, or they drift. The `.md` and `.html` are edited by hand; the `.pdf` and `.docx` are regenerated. When asked to "update the resume," update the source files and regenerate the outputs — don't touch just one.

## Regenerating the outputs

After editing `Sabbir_Ahmed_Resume_2026.html`:

```bash
# HTML -> PDF (matches how the current PDF was produced: HeadlessChrome / Skia)
google-chrome --headless --no-pdf-header-footer \
  --print-to-pdf=Sabbir_Ahmed_Resume_2026.pdf Sabbir_Ahmed_Resume_2026.html

# HTML -> DOCX (LibreOffice is the available converter)
soffice --headless --convert-to docx:"MS Word 2007 XML" Sabbir_Ahmed_Resume_2026.html
```

Available tooling on this machine: `google-chrome` (HTML→PDF) and `libreoffice`/`soffice` (docx conversion). `pandoc`, `wkhtmltopdf`, and `weasyprint` are **not** installed.

## Layout constraints (HTML/PDF)

The HTML is hand-tuned to fit on a **single Letter page** with tight margins and small point sizes. When adding content, verify it still fits one page — prefer trimming wording over loosening the spacing, since the dense layout is intentional. Section accent color is `#1a3e6f`; body font targets Calibri/Carlito with system fallbacks.

## After regenerating, sanity-check

Open or inspect the rendered PDF to confirm it's still one page and nothing overflowed before considering an edit done.

## The website (`site/` → `dist/`)

A personal-brand site whose **thesis is its own craft**: it must stay hand-built, near-zero-weight, and framework-free, because the visitor is meant to *feel* the discipline the copy claims. Do not introduce React/Three.js/bundlers/web fonts/runtime JavaScript — that would contradict the brand on sight. If a change tempts you toward a framework, that's the signal to stop.

- `site/build.mjs` — the entire build: a **zero-dependency** Node script. It renders the curated narrative (hero one-liner, *How I work*, *Selected work*, contact, colophon), converts the résumé `.md` to HTML with a small purpose-built parser, inlines all CSS, copies the PDF/DOCX as download assets, and **measures its own output** to fill the colophon's page-weight figure. No `npm install`, no `node_modules`.
- Output is `dist/` (git-ignored; CI rebuilds it). One HTML file, inline CSS, **no web fonts** (system stack), **no client JS**.
- `og.png` (repo root, **committed**) is the social share card. It's rendered from `site/og.html` with headless Chrome — CI has no browser, so regenerate it locally and commit when the hero copy changes: `google-chrome --headless=new --hide-scrollbars --window-size=1200,630 --force-device-scale-factor=1 --screenshot=og.png "file://$PWD/site/og.html"`. Keep it exactly 1200×630 (the `og:image` meta declares those dims).
- Heading outline is deliberate and must stay un-skipped: hero `h1` → section titles `h2.label` (auto-numbered via CSS counters) → CV name `h3` → CV parts `h4` → job titles `h5`. The full CV lives inside a `<details>` expander so the curated *Selected work* leads.

```bash
node site/build.mjs          # build → dist/
```

### Editing rules

- **Narrative copy** lives in the `content` object at the top of `build.mjs`. Keep it strictly grounded in real résumé facts — this is the founder's own voice; invented specifics betray the brand. The *How I work* section is the differentiator; give it weight but don't fabricate methodology.
- The résumé section is generated from `Sabbir_Ahmed_Resume_2026.md`. The parser only handles the constructs that file uses (`#/##/###`, `**bold**`, `*italic*`, `- ` lists). **If you change the Markdown structure, re-run the build and eyeball the rendered `.cv` block** — correctness of the résumé outranks the zero-dependency flex.
- Asset links are **relative**, so the site works under any base path (`/resume/` project page, root, or Cloudflare). Don't hard-code absolute paths.
- One deliberate motion moment only (a CSS load-reveal, gated behind `prefers-reduced-motion`). Don't add scroll animation or anything animated-for-its-own-sake.

### Deploy

GitHub Actions (`.github/workflows/deploy.yml`) builds and publishes `dist/` to GitHub Pages on every push to `main`. Pages source must be set to **GitHub Actions** in repo settings. Served at `thesabbir.github.io/resume`. Because output is pure static files, Cloudflare Pages is a drop-in alternative (build command `node site/build.mjs`, output dir `dist`).

### Verifying visual changes

Render with headless Chrome and read the screenshot. Note: the CSS load-reveal starts at `opacity:0`, so a plain headless screenshot captures a blank hero — neutralize the reveal rule in a temp copy (or emulate `prefers-reduced-motion: reduce`) before screenshotting, then check both light and dark (`prefers-color-scheme`) palettes.
