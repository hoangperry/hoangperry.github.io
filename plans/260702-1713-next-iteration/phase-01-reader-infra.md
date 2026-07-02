# Phase 01 — Reader Infrastructure (Novel)

Goal: serve the site's real audience (Vietnamese fiction readers) with search, position memory, and feeds. No visual redesign.

## 1. Novel full-text search (Pagefind)
- Add Pagefind to CI: after `jekyll build`, run `npx pagefind --site _site --glob "novel/**/*.html"` in `.github/workflows/jekyll.yml` (index novels only, per brainstorm: site-wide search of a dozen posts serves nobody).
- Search UI on `_pages/novel.html` (library) and `_layouts/novel-home.html` (per-novel TOC): lazy-load Pagefind JS only on these pages; style results with reading-theme tokens.
- Verify Vietnamese diacritics matching ("mã nguồn" vs "ma nguon"); if needed enable Pagefind's `forceLanguage: "vi"` on the chapter layout via `data-pagefind-meta`.
- Files: `.github/workflows/jekyll.yml`, `_pages/novel.html`, `_layouts/novel-home.html`, `css/main.scss` (search UI block, reading theme scope).

## 2. Reading position bookmark (localStorage, client-only)
- On chapter pages: store `{novel, chapter, scrollY, ts}` under `hoang.tech:reading:<slug>` on scroll (throttled, reuse existing rAF progress-bar loop in `_layouts/novel.html`).
- On novel-home: if bookmark exists, show "Đọc tiếp — Chương N" button above TOC (replaces/augments "Bắt đầu đọc").
- Respect privacy: localStorage only, no network.
- Files: `_layouts/novel.html` (extend existing inline script), `_layouts/novel-home.html`, `css/main.scss`.

## 3. Per-novel RSS feed
- Jekyll template `feed-novel.xml` generated per novel from `_data/novels.yml` + `site.novel` collection (latest N chapters, lastBuildDate). Static-friendly: one output per novel via a small generator include or per-novel feed page with `permalink: /novel/<slug>/feed.xml`.
- Link `<link rel="alternate">` in head for novel pages; visible feed icon on novel-home.
- Files: new `_pages/novel-feeds/` (or per-novel feed stub committed by `scripts/ingest-novel.rb` — extend ingest to also emit feed stub), `_includes/head.html`.

## Validation
- CI green; Pagefind index size sane (<5MB).
- Manual: search "mã nguồn" returns chapters; bookmark survives reload; feed validates (W3C validator).

## Risks
- Pagefind adds a CI step + JS payload: mitigate with lazy load, novels-only glob.
- Ingest script must stay idempotent when emitting feed stubs.
