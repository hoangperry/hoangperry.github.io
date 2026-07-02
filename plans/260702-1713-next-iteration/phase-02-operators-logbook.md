# Phase 02 — Operator's Logbook

Goal: pay "world debt". Instead of writing 30 posts to fill 3 thin worlds, add one unified **logbook**: short dated entries tagged by world (aviation / electronics / photography / security), plus a build-time self-metrics dashboard. Turns "missing analytics" into content.

## 1. Log collection
- New Jekyll collection `_log/` (`output: false` initially; entries render on a single `/log/` page). Entry front matter: `date, world, title, kind (build|flight|shot|hunt|read), body (short)`.
- `/log/` page: chronological stream, each row styled with its world's accent (theme tokens already exist per `[data-theme=...]`; reuse accents as inline accent-color, not full theme switch).
- World pages (aviation/electronics/photography) embed their filtered slice of the log below the themed hero — the shells stop being empty without new long-form content.
- Files: `_config.yml` (collection), `_pages/log.html`, `_pages/{aviation,electronics,photography}.html` (embed include), `_includes/log-stream.html`, `css/main.scss`.

## 2. Self-metrics dashboard (build-time, "instrument yourself")
- Small Ruby plugin or pre-build script computing counts from repo data: chapters total + added this month (from `_novel/`), log entries per world, posts count, GHSA credits (hand-maintained in `_data/metrics.yml` for non-derivable items).
- Render as a compact instrument strip on `/log/` (and optionally home #worlds section): mono font, tabular numbers, no chart library — text + meter bars in CSS.
- Files: `scripts/build-metrics.rb` (emit `_data/generated-metrics.yml`, run in CI before build), `_data/metrics.yml`, `_includes/instrument-strip.html`.

## 3. Decide thin-world merge (decision gate)
- After log embeds land, review: if a world still feels hollow, demote it from header nav to a card on /log/ rather than deleting. Record decision in plan.

## Validation
- CI green; /log/ renders with ≥5 seeded entries (backfill from real history: site launch, novel milestones, GHSA credits).
- Reduced-motion + both mobile breakpoints checked.

## Risks
- Metrics script must not break build when data absent — default to zeros, never fail.
- Avoid hero-metric AI-slop pattern: instrument strip is dense mono text, not big-number cards.
