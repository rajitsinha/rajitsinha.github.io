# Redesign plan — handoff

Written at the end of a long session so a fresh one can start without re-deriving
anything. Read this whole file before editing.

## The project

Single-file static site: `index.html` (107 KB, no build step, no dependencies, no
framework). Preview with `python -m http.server 8123` or the `portfolio` entry in
`.claude/launch.json`.

Owner: Rajit Sinha, high-school senior applying to aerospace programmes. This site
is used in college applications, so licensing and professionalism matter.

## Repo state

Live at `github.com/rajitsinha/rajitsinha.github.io` (GitHub Pages), tracked on `main`.

**Checkpoint before the rebuild: `2a70380`.** If the rebuild goes wrong:
`git reset --hard 2a70380`.

`index.html` on the remote is already identical to local — the owner had been
uploading it manually during the session, so all prior work is deployed.

Gitignored on purpose: `index_(25).html` (previous site, reference only, **never
edit**), `threejs-skills/` (separate git clone), `eftgtsetgsetges.html` (byte-identical
duplicate of index.html, safe to delete), `.claude/settings.local.json`.

`core.autocrlf` is set to `false` — leave it, or `altitude_sensor.ino` shows a phantom
316-line diff.

## The brief

Rebuild the presentation into full-viewport, scroll-driven 3D scenes throughout,
inspired by igloo.inc and yatootay.pages.dev. **Keep all existing content**: copy,
photos, videos, the code viewer, the apogee simulator, the glove viewer. The owner
chose "keep content, rebuild presentation" over a blank slate.

## Do not undo these — the owner asked for them specifically

- **The colour palette stays.** He was offered a muted/warmed alternative and said he
  likes the current one. `--blue:#4d8dff`, `--ink:#eef2f8`.
- **Scroll speed is right now.** Halved per wheel notch at his request; damping is
  frame-rate independent (`1 − e^(−15·dt)`). Don't "improve" it without asking.
- **No predicted-flight-path line.** He disliked it; it was also writing depth at zero
  opacity and streaking the glove.
- **No "Now showing / part name" label** on the glove chapter — he called it useless
  because the whole glove is visible anyway.
- **He loves the glove explode animation.** `gloveK` / `gloveSpin` / `gloveExplode` in
  `#stage-glove` are untouched originals. Leave them alone.
- Captions sit middle-left; telemetry mid-right and large.
- Hero proportions copied from `index_(25).html`: `1.08fr .8fr`, `align-items:center`,
  headline inside the left column, `margin:0 0 .9rem` under the h1.
- Photos must not be cropped through their subject (`.shot.full` = `object-fit:contain`).

## Reference sites — what was actually found

Measured over the network (reliable):

| | igloo.inc | yatootay |
|---|---|---|
| Model files | **71** (Draco `.drc`) | **0** |
| Textures | 49 | **0** |
| Transferred | **13.46 MB** | **0.33 MB** |

Read out of their source bundles (inferred, not network-counted):

- **solar-sail** — `TextureLoader: 0`, `GLTFLoader: 0`, one `SphereGeometry`, but 18
  instanced meshes, 18 shader materials, ~428 GLSL lines. Uses **Lenis + ScrollTrigger**
  (`scrub`, `pin`). Tokens: `--bg:#060709`, `--ink:#ece7dc`, `--accent:#e0a458`.
- **nozzlemoc** — 17 KB engine, zero lights, zero PBR materials, zero textures, no
  models. Functions are `lines`, `arcStrip`, `buildGrid`, `updateSkin`, plus bloom.

**The lesson:** igloo's fidelity comes from 71 bespoke modelled assets; the other three
render no photoreal spheres at all, using lines, points, instancing and shaders that
stay crisp at any resolution while bloom does the work. A procedurally-painted lit
sphere lands in the uncanny valley — that was this site's original problem.

## Assets

Owned:
- `assets/model/glove.glb` (563 KB) — his own Fusion 360 lunar EVA glove. **The hero
  asset**, and the one thing here no other portfolio has. Loaded twice: by the
  background world and by the `.v3d` inline viewer.
- `assets/glove.glb` (41 KB) is a smaller orphan copy — nothing references it.
- Photos/videos in `assets/img`, `assets/video`. `hero-portrait-*.jpg` is him beside an
  EMU suit at Johnson Space Center.

From `github.com/nasa/NASA-3D-Resources`, **public domain** (US federal works: no
attribution required, no commercial restriction). Add a courtesy credit anyway.

| File | MB | Intended use |
|---|---|---|
| `nasa-astronaut-glove.glb` | 0.63 | Beside his own glove — his design vs NASA's |
| `nasa-helmet.glb` | 0.22 | His TAS team designed helmet **and** gloves; only the glove is shown today |
| `nasa-saturn-v.glb` | 0.88 | Rocketry chapter |
| `nasa-lunar-module.glb` | 0.68 | Transit chapter |
| `nasa-emu-suit.glb` | 3.29 | The suit from his hero photo, in 3D. Biggest file — lazy-load or drop if weight matters |

## Three.js reference material available locally

- `threejs-skills/` — clone of `github.com/cloudai-x/threejs-skills`, 10 folders:
  `threejs-fundamentals`, `-geometry`, `-materials`, `-lighting`, `-textures`,
  `-shaders`, `-postprocessing`, `-loaders`, `-animation`, `-interaction`.
  Read these before writing scene code.
- `ui-ux-pro-max` plugin has a 53-rule Three.js stack table:
  `python "<plugin>/.claude/skills/ui-ux-pro-max/scripts/search.py" "<query>" --stack threejs`
  Notable rules: use `scrub:1` for scroll-driven cameras (never `onEnter`); GSAP
  timelines for 3+ step sequences; dispose geometry **and** material **and** every
  texture on removal; `InstancedMesh` for repeats; cap pixel ratio.
- Plugins added mid-session are **not invocable via the Skill tool** in the session they
  were installed — read their `SKILL.md` from
  `~/.claude/plugins/cache/<marketplace>/<plugin>/<version>/` directly.

## Build plan

1. **Scroll engine** — replace the hand-rolled scroller with Lenis + GSAP ScrollTrigger;
   every scene pinned and scrubbed. This is the structural thing the references do that
   this site doesn't. **Highest risk step — it drives every animation.** Do it first, on
   a branch, and verify with the harness below before going further.
2. **Model pipeline** — Draco-compress the five NASA models, lazy-load per chapter,
   dispose on exit.
3. **Chapters, all full-viewport** — hero → Saturn V ascent → apogee/telemetry → transit
   to the Moon with the Lunar Module → glove chapter with his model and NASA's side by
   side → outreach → contact.
4. **Keep** the wire-body language for Earth and Moon.

## Already fixed — don't regress

- **Scene state is a pure function of scroll.** Every handler starts from `ve()`, which
  resets the full baseline; `$e()` falls back to the nearest preceding scene at p=1 so
  gaps between chapters hold deterministically. This fixed props from one chapter staying
  on screen after a fast scroll.
- **One trajectory function** `ascentPath(f)` places the rocket, supplies its tilt, and
  the exhaust spawns at the *rotated* nozzle (it used to emit straight down in world
  space, so the plume came out of the fins once the rocket leaned).
- **Wire bodies** — `wireBody()` builds an occluded lat/long cage plus point-cloud
  surface. Earth points masked to continents (`onLand`); Moon points masked *out* of
  maria (`inMaria`) plus 64 crater rings (`lunarRings`), which is what finally made it
  read as the Moon rather than a generic sphere.
- Nose cone separation is monotonic — once gone, it stays gone.
- Atmosphere shader scatters by sun angle and warms at the terminator.

## Verification harness — reuse this, it caught every bug

`window.__world`, `window.__scroller`, `window.__applyScroll` are exposed on purpose.

```js
const go = y => { const s = window.__scroller;
  s.target = y; s.current = y; s._set = Math.round(y);
  scrollTo(0, y); window.__applyScroll(y); };
```

- **Seam check** — walk every scroll pixel, flag second differences
  `|v(y+1) − 2v(y) + v(y−1)|` over a threshold. Isolates true steps from fast ramps;
  a plain first difference gives false positives on legitimate fast motion.
- **Purity check** — snapshot state at N positions in order, revisit in random order,
  diff. Any difference means state depends on scroll history — the bug class that caused
  props to stick.

Gate both on visibility: a value only matters when its `rocketK` / `gloveK` / `earthK` /
`moonK` is > 0.02. Last run: 0 steps, 0 drift across ~21,500 pixels at 1440×900.

## Environment notes

- The in-app browser pane frequently reports a **0×0 viewport** with
  `visibilityState: "hidden"`, so `requestAnimationFrame`, IntersectionObserver and
  screenshots do not work. Call `resize_window` first, then `__world.resize()`, then
  drive frames manually with the harness above. GL "framebuffer has zero size" warnings
  come from this, not from the code.
- Cache-bust with `?v=N` after every edit or you will test a stale file.
- Editing `index.html`: the JS is minified onto a few very long lines. Anchor edits on
  unique substrings and assert `count == 1` before replacing. Never inject a `let` into
  the middle of a comma expression — that broke the page once.
