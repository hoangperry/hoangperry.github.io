# Phase 03 — Bridging Essays

Goal: differentiation content — essays connecting two domains (the moat no single-domain specialist has). Ship the format + one real essay.

## 1. Essay format
- New post layout variant `bridging` (front matter: `worlds: [security, aviation]`): header shows both world glyphs/accents, body uses standard post prose.
- Featured placement: bridging posts pinned atop the home featured log (`site.tags.featured` already exists — tag `featured` + `bridging`).
- Files: `_layouts/post.html` or a `_includes/bridging-header.html` conditional, `css/main.scss` (dual-accent header, small scope).

## 2. First essay (content, user-authored)
- Candidate topics (from brainstorm): threat-modeling frameworks from aviation safety applied to ML bug hunting; checklists/CRM (crew resource management) applied to incident response; narrative structure (fiction) applied to vulnerability write-ups.
- Claude drafts outline + skeleton; user writes/edits body (voice must be his).

## 3. Cadence
- Target 1-2 per quarter. No automation needed; just the format existing lowers friction.

## Validation
- One bridging essay live, featured on home, correct dual-world header on desktop + mobile.

## Risks
- Content quality is the whole point — do not ship a filler essay to "complete the phase"; phase stays open until the essay is real.
