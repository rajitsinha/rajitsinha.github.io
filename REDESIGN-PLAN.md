# Redesign plan — handoff

Written at the end of a long session. Everything a fresh session needs to start the
rebuild without re-deriving anything.

## The project

Single-file static site: `index.html` (~104 KB, no build step, no dependencies).
`index_(25).html` is the OLD site — **never edit it**, it's reference only.
Preview: `python -m http.server 8123`, or the `portfolio` entry in `.claude/launch.json`.

## The brief

Rebuild the presentation into full-viewport, scroll-driven 3D scenes throughout —
inspired by igloo.inc and yatootay.pages.dev. **Keep all existing content**: copy,
photos, videos, the code viewer, the apogee simulator, the glove viewer.

## What was measured about the reference sites (don't re-derive)

| | igloo.inc | yatootay | solar-sail | nozzlemoc |
|---|---|---|---|---|
| Model files | **71** (Draco `.drc`) | 0 | 0 | 0 |
| Textures | 49 | 0 | 0 | 0 |
| Transferred | 13.46 MB | **0.33 MB** | — | — |
| Scroll | GSAP | — | **Lenis + ScrollTrigger** | custom |
| Notable | modelled their *text* as geometry | 100% procedural | 18 instanced meshes, 428 GLSL lines | zero lights/materials, pure line-art + bloom |

**The lesson that matters:** none of these render a photoreal textured sphere. They use
lines, points, instancing and custom shaders — which stay crisp at any resolution and
let bloom do the work. A procedurally-painted lit sphere lands in the uncanny valley.
The Earth/Moon in this project were already rebuilt on that principle (see below).

## Assets

Owned:
- `assets/model/glove.glb` — Rajit's own Fusion 360 lunar EVA glove. The hero asset.
- Photos/videos in `assets/img`, `assets/video`. `hero-portrait-*.jpg` is him beside an EMU suit.

Downloaded this session from `github.com/nasa/NASA-3D-Resources` — **public domain**
(US federal works; no attribution required, no commercial restriction). Add a courtesy
credit line anyway.

| File | MB | Intended use |
|---|---|---|
| `nasa-astronaut-glove.glb` | 0.63 | Beside Rajit's own glove — his design vs NASA's |
| `nasa-helmet.glb` | 0.22 | His TAS team designed helmet **and** gloves; only the glove is shown today |
| `nasa-saturn-v.glb` | 0.88 | Rocketry chapter |
| `nasa-lunar-module.glb` | 0.68 | Moon transit chapter |
| `nasa-emu-suit.glb` | 3.29 | The suit from his hero photo, in 3D |

## Build plan

1. **Scroll engine** — replace the hand-rolled scroller with Lenis + GSAP ScrollTrigger.
   Every scene pinned and scrubbed. This is the structural thing the references do that
   this site doesn't. Highest risk step: it drives every animation.
2. **Model pipeline** — Draco-compress the five NASA models, lazy-load per chapter,
   dispose geometry + material + textures on exit (Three.js never frees GPU memory itself).
3. **Chapters, all full-viewport** — hero → Saturn V ascent → apogee/telemetry →
   transit to Moon with the Lunar Module → glove chapter with his model and NASA's
   side by side → outreach → contact.
4. **Keep** the wire-body visual language for Earth/Moon (already matches the references).

## Already done — do not undo

- **Scene state is a pure function of scroll.** Every handler starts from `ve()`, which
  resets the full baseline. `$e()` falls back to the nearest preceding scene at p=1 so
  chapter gaps hold deterministically. Verified: 0 history-dependent drift.
- **One trajectory function** `ascentPath(f)` places the rocket and supplies its tilt.
- **Wire bodies** — `wireBody()` builds an occluded lat/long cage + point-cloud surface.
  Earth points masked to continents (`onLand`), Moon points masked *out* of maria
  (`inMaria`) plus 64 crater rings (`lunarRings`).
- Smoke spawns at the rotated nozzle, not straight below the rocket.
- Hero proportions match `index_(25).html` (`1.08fr .8fr`, `align-items:center`).
- Nose cone separation is monotonic — once gone, it stays gone.

## Verification harness (reuse this — it caught everything)

`window.__world`, `window.__scroller`, `window.__applyScroll` are exposed on purpose.

```js
const go = y => { const s=window.__scroller;
  s.target=y; s.current=y; s._set=Math.round(y);
  scrollTo(0,y); window.__applyScroll(y); };
```

Two checks worth keeping:
- **Seam check** — walk every scroll pixel, flag second differences
  `|v(y+1) − 2v(y) + v(y−1)|` above a threshold. Isolates true steps from fast ramps.
- **Purity check** — snapshot state at N positions in order, revisit in random order,
  diff. Any difference means state depends on scroll history, which is the bug class
  that caused props to stay on screen.

Gate both on visibility: a value only matters if `rocketK`/`gloveK`/`earthK`/`moonK` > 0.02.

## Environment notes

- The in-app browser pane often reports a **0×0 viewport** and `visibilityState: "hidden"`,
  so `requestAnimationFrame` and IntersectionObserver never fire and screenshots fail.
  Call `resize_window` first, then `__world.resize()`, then drive frames manually.
- Cache-bust with `?v=N` after every edit or you'll test a stale file.
