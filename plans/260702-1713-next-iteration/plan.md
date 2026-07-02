# Next Iteration — hoang.tech

**Status:** draft (from multi-AI brainstorm 260702; Claude + Copilot; Codex hung, Gemini auth-dead)
**Framing:** site = "operator's logbook". Fiction (209 chapters) is the real gravity center; themed worlds are chrome without cargo ("world debt"). Priority: serve real readers first, pay content debt second, differentiate third.

## Phases

| # | Phase | Goal | Effort | Status |
|---|-------|------|--------|--------|
| 1 | [Reader infrastructure](phase-01-reader-infra.md) | Novel search, reading bookmark, per-novel RSS | S-M | implemented (unverified on real build) |
| 2 | [Operator's logbook](phase-02-operators-logbook.md) | Unified log world + build-time self-metrics dashboard | M | implemented (unverified on real build) |
| 3 | [Bridging essays](phase-03-bridging-essays.md) | Cross-domain essay format, first essay scaffold | S | format done; essay content still owed by author |

Dependencies: none between phases; recommended order 1 → 2 → 3.

## Acceptance criteria (plan level)
- All builds pass on GitHub Actions (Jekyll 4, dart-sass, no server-side anything).
- No regressions to theme engine, novel reader, or home.
- Each phase independently shippable/commit-able.

## Key constraints
- Static only (GitHub Pages). Anything "dynamic" must be pre-baked at build or client-side (localStorage/JS).
- Vietnamese text: search must handle diacritics (Pagefind handles Unicode; verify vi segmentation acceptable).
- Keep bundle budgets: novel pages currently JS-light; search UI loads lazily only on library/TOC pages.
- Design laws in force: spacing scale tokens, OKLCH, no em dashes in chrome, reduced-motion respected.

## Unresolved questions
- Route Vietnamese visitors to fiction as alternate front door? (deferred; revisit after phase 1)
- Merge vs keep thin worlds once logbook exists? (decide during phase 2)
