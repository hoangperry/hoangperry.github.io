# Multi-theme site review (direct, evidence-backed)

**Date:** 2026-06-30
**Scope:** the multi-theme redesign (engine, hub, security/aviation/electronics worlds).
**Method:** the multi-agent workflow hit session/rate limits and produced nothing, so this review was done directly with grep/curl/read against the running site and source.

## Verdict

Healthy. No P0/P1 blockers: every page returns 200 (`/`, `/aviation/`, `/electronics/`, `/resume/`, `/works/`, `/topics/`, a sample post, `/contact/`), the GitHub Actions + dart-sass pipeline is green, and the YAML colon trap that broke a page earlier is now gone (scan found no other unquoted-colon front matter). The remaining issues are P2 polish: a handful of hardcoded accent colors that do not re-theme, home redundancy, font/perf and minor a11y contrast, plus dead IE files. Nothing urgent.

## Findings (severity ordered)

| Sev | Dimension | Issue | Where | Fix |
| --- | --- | --- | --- | --- |
| P2 | theme-integrity | Hardcoded phosphor-green/amber accents that do NOT re-theme (stay green on aviation/electronics/photography) | main.scss: link underline (l.277), index/log row hover (l.852/901), post-note variants (l.1115-1117), green bg/shadow (l.450/484/639), table stripe white-alpha (l.421) | Replace literals with `var(--phosphor)` / `var(--amber)` / `var(--glow-*)` / `var(--line)` so they follow the active world |
| P2 | a11y | electronics `--fg-dim oklch(46% ...)` on `--bg oklch(20%)` is only ~26 L apart (est < 3:1); an outlier vs other dark themes whose fg-dim is 68-77% | main.scss l.134 | Lift electronics `--fg-dim` to ~70% L (match the other dark worlds) |
| P2 | a11y | photography `--fg-faint oklch(60%)` on cream `--bg oklch(96%)` is low contrast for small labels (est ~2.5:1) | main.scss l.192 | Darken photography `--fg-faint` to ~48-52% L |
| P2 | design | Home lists Aviation + Electronics TWICE: once in the `#worlds` portal and again in the landing index | landing index vs #worlds | Add `options: nolanding` to aviation/electronics front matter so the index shows Works/Topics/Resume and the portal owns the worlds |
| P2 | performance | All 4 webfont families (JetBrains Mono, Martian Mono, Chakra Petch, Sometype Mono) load on EVERY page, even though Chakra (aviation) and Sometype (electronics) are only used on their world pages | _includes/head.html | Load the world display fonts only on their pages (per-page `<link>` via front matter / a head conditional), or accept the cost (all are light mono-ish faces) |
| P2 | cleanup | `css/ie8.scss` / `ie9.scss` still import the dead Spectral `libs/_skel` and emit a wall of dart-sass deprecation warnings every build; referenced via dead IE conditional comments | head.html l.14-15 + css/ie8.scss, ie9.scss, _sass/libs/* | Delete the two IE `<link>` lines, the ie8/ie9 scss, and the orphaned `_sass/libs` Spectral leftovers. Kills the warnings and dead weight |
| P2 | security | `target="_blank"` links missing `rel="noopener noreferrer"` (footer + greeting social, resume external links, author-block) | footer.html, landing.html, resume.html, author-block.html | Add `rel="noopener noreferrer"`. Low risk (modern browsers imply noopener) but best practice |
| P3 | security | three.js imported from `unpkg.com/three@0.160.0` with no SRI (version IS pinned) | js/hero-scene.js l.25 | Optional: self-host three.module.js under /js or accept the pinned-CDN risk. SRI on a bare module specifier is not straightforward |
| P3 | ux | The theme switcher cycles into `photography`, which has no page yet; it just recolors the current page | scripts.html l.24 | Either drop photography from the cycle until the world ships, or leave it as a palette preview |
| P3 | theme-integrity | Code-syntax-highlight colors are hardcoded (theme-independent); fine on dark worlds, slightly off on photography (light) where code-bg stays dark | main.scss l.373-378 | Acceptable; revisit when building photography |

## P2 detail: hardcoded accent leaks (the one worth doing first)

The token system is sound: components reference palette custom properties, so swapping `data-theme` re-skins the site. But a few component rules bypass the tokens with literal `oklch(82% 0.15 150 ...)` (security green) or amber. Those elements keep security colors on every world. Most visible on the aviation/electronics showcase pages (the logbook `.index-row` hover glows green instead of cyan/gold) and on the light photography palette (green/white-alpha tints look foreign). Fix is mechanical: route each literal through the matching `var(--...)`. ~10 sites.

## Quick wins (cheap, high value)
1. Replace the ~10 hardcoded accent literals with tokens (re-themes the leaks).
2. `options: nolanding` on aviation + electronics (kills home redundancy).
3. Bump electronics `--fg-dim` and photography `--fg-faint` lightness (a11y contrast).
4. Delete ie8/ie9 scss + IE `<link>` lines (removes build warnings + dead code).
5. Add `rel="noopener noreferrer"` to external `target="_blank"` links.

## Non-issues confirmed
- Build/deploy: all pages 200, pipeline green, no YAML traps remain.
- `main.css` is 64 KB uncompressed (well within budget gzipped).
- reduced-motion: 7 CSS guards plus every hero JS renders a static frame under reduced motion.
- three.js version is pinned; the three hero loops are correctly pause-gated (IntersectionObserver + visibility) and each loads only on its page.
- CRT/grain overlays are correctly gated to the security world only.

## Note
The multi-agent review workflow failed entirely on session/rate limits (resets 06:40 Asia/Saigon). This direct pass covers the same dimensions. If a fresh adversarial agent pass is wanted later, re-run after the limit resets.
