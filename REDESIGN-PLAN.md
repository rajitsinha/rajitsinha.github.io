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

The rebuild lives on **`rebuild/scroll-scenes`**, not yet merged to `main` and not yet
deployed. Each of the four steps is its own commit and each was verified green before the
next began, so any of them is a safe place to stop:

```
762c3da  step 4  wire-body language kept; Saturn V decode + z-fight fixed
151a40e  step 3  Apollo chapter, NASA's glove beside his
3d865fa  step 2  Draco decoder, texture strip, lazy load, dispose
ea60293  step 1  pin primitive in the scroll engine
e1c3e19          the verification harness, committed as tools/verify.js
```

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
- **His ascent chapter is his.** `#stage-ascent` is the American Rocketry Challenge
  rocket — 470 g, 3D-printed airframe, F50T — and the telemetry beside it is his own
  flight computer's apogee prediction. The plan originally put the Saturn V here; it went
  to `#stage-transit` with the lunar module instead, because flying NASA hardware on his
  numbers misrepresents his project on a site used for college applications. The whole
  chapter is verified byte-identical to `2a70380`; keep it that way.
- **The scene engine stays hand-rolled.** Offered Lenis + GSAP ScrollTrigger, the owner
  chose to extend the native engine. Don't reopen it without asking.

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

## Build plan — status

On branch `rebuild/scroll-scenes`, four commits off `2a70380`, each verified before the
next started. `main` is untouched.

1. **Scroll engine — done** (`ea60293`). *Not* Lenis + ScrollTrigger. The site already
   contained hand-rolled equivalents of both: `Ge` is Lenis (damped smooth scroll, wheel
   ×0.5, `1 − e^(−15·dt)`), and `ee()` is ScrollTrigger (`start`/`end` string syntax,
   scrub via `onUpdate(p)`), *plus* something ScrollTrigger has no equivalent for — the
   `scene:true` arbitration that guarantees exactly one scene handler runs per frame and
   falls back to the nearest preceding scene at p=1. That arbitration is what makes state
   a pure function of scroll, so swapping in ScrollTrigger would have meant rebuilding it
   by hand on top, at a cost of ~110 KB and both "scroll speed stays" constraints. The
   owner was asked and chose to extend the native engine. What was actually missing was a
   general **pin**, which `ee()` now takes as `pin:true`.
2. **Model pipeline — done** (`3d865fa`, corrected in `762c3da`). The plan had this
   backwards: four of the five NASA models were *already* Draco-compressed and the site
   had no decoder, so they could not load at all. See "Model pipeline" below.
3. **Chapters — partly done** (`151a40e`). The Apollo chapter and the glove comparison
   are built. **The full-viewport conversion is NOT done — this is the main thing left.**
   See "What is left" below.
4. **Wire-body language — done** (`762c3da`). Earth and Moon untouched and verified
   byte-identical; `wireModel()` extends the same treatment to loaded geometry.

## What is left

**Convert the remaining chapters to full-viewport pinned scenes.** These four are still
ordinary flowing sections:

| Section | Height | Content that has to survive |
|---|---|---|
| `#sec-rocketry` | ~3400 px | copy, launch + deployment video, avionics photo, code viewer, apogee simulator |
| `#sec-glove` | ~2486 px | copy, JSC poster photo, layer cutaway, the `.v3d` glove viewer |
| `#sec-outreach` | ~2450 px | copy, plus `#hstage` which is already pinned |
| `#sec-awards` | ~1427 px | award list, school/skills panels |

The engine is ready for it — this is a content-layout job, not an engine job:

- `ee(el,{pin:true})` gives a section pinned+scrubbed defaults (`top top` →
  `bottom bottom`). Put the height in the markup as `style="height:NNNlvh"` so the first
  paint is right; the engine only guarantees the sticky `.pin` wrapper exists.
- `docRect()` already resolves elements *inside* a pin to their document-flow position
  rather than their stuck position, so `.rv`/`.fade` triggers on pinned content measure
  correctly. This was built for exactly this step and is currently a no-op.
- **`.pin` is `overflow:hidden` and `height:100lvh`.** Content taller than the viewport
  will be clipped. So each of these needs its content broken into viewport-sized panels
  paged by chapter progress (the `#hstage` horizontal scroller at `#sec-outreach` is the
  worked example already in the file — copy its shape).
- Don't drive panels off element geometry inside a pin; drive them off the chapter's own
  `p`, the way the existing captions do (`I(.06,.2,e)*(1-I(.8,.96,e))`).

Do it one section at a time and run the harness between each. Budget it properly — a
half-converted section clips its own content, which is worse than leaving it flowing.

Two smaller things, both optional:

- `nasa-emu-suit.glb` (3.4 MB) and `nasa-helmet.glb` (232 KB) are still unused. The suit
  is the one from his hero photo; the helmet is the other half of what his TAS team
  designed. Neither is loaded, so neither costs a visitor anything today.
- The NASA glove's left edge just touches the viewport edge at the end of the glove
  chapter (NDC x reaches −1.00). Nudge `o.nglX` if it bothers you.

## Model pipeline — how it actually works now

- `assets/vendor/DRACOLoader.js` (r185, MIT) is vendored, not CDN-linked. Its only edit is
  the import specifier, `'three'` → `'./three.bundle.js'`, which exports all eleven names
  it needs. Decoder wasm is in `assets/vendor/draco/` (340 KB).
- Loader and decoder are built **on first use**, and chapters take models a few viewports
  ahead and release them once well behind. First paint fetches no model and no decoder.
  `window.__models.count()` reports how many are held.
- The models were stripped of textures and UVs, because both places the site loads a
  `.glb` throw the file's materials away and substitute a flat `MeshStandardMaterial` —
  nothing ever samples a texture. `nasa-astronaut-glove` was 646 KB, of which 621 KB was
  WebP for an 842-triangle mesh; it is now 25 KB.
- Only `nasa-saturn-v` was re-encoded (905 → 375 KB). **Do not re-encode the others** —
  DracoPy's encoder is worse than whatever produced them; re-encoding the lunar module
  inflated it from 700 KB to 1017 KB.
- Originals are recoverable: `git show 2a70380:assets/model/<file>`.
- The re-encode script is not in the repo. If you need it again, the one thing that
  matters is that **DracoPy assigns Draco attribute unique ids in the order tex_coord,
  normal, position — position always last — so every id shifts with the number of
  attributes present.** Measure it with a probe; do not assume. Getting it wrong writes
  an id that isn't in the payload, and the mesh decodes to an empty position buffer.

## Traps that cost real time — read before debugging

- **A model that renders nothing but passes every check.** Triangle counts come from the
  index and `geometry.boundingBox` comes from the accessor's own min/max, so both stay
  correct when the position buffer is empty. Any model check must read actual vertex
  data (`geometry.attributes.position.array.length`).
- **`root.traverse()` while re-parenting.** Moving a node out of the tree during traverse
  mutates the array being walked and it starts handing back `undefined`. Collect first,
  mutate after. And re-parenting drops every ancestor transform — bake the old
  `matrixWorld` into the node's local transform.
- **Normalising a group after attaching it.** `Box3.setFromObject` measures *world* space,
  so if the host already carries the chapter's scale it gets folded into the normalisation
  and silently cancels it: the model renders at a fixed size no matter what the scene
  asks. Normalise while the group is still detached.
- **Occluding shell vs. its own edges.** They share a depth value and z-fight, leaving the
  model a faint smudge. `wireBody()` insets its core sphere to `R*.99`; a loaded mesh has
  no radius to inset, so the fill needs `polygonOffset`.
- **Don't `await` between harness probes.** The page's own rAF loop calls `scrollTo()`
  with the scroller's damped position every frame; give it a turn mid-walk and it moves
  the page under the next measurement. It shows up as a single bad sample, usually at
  y=0, that looks exactly like a purity bug and is not one. Do any waiting before the
  walk starts.
- The preview pane reports `visibilityState: "hidden"`, so rAF never runs and screenshots
  are unreliable. Drive frames with `__world.update(1/60)` after each `__harness.go(y)`,
  and read the framebuffer with `gl.readPixels` if you need to see what is on screen.
- **Cache-bust model URLs too**, not just `index.html`. A re-encoded `.glb` at the same
  path will keep serving the old bytes and you will "verify" the file you just replaced.

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

**It is now committed at `tools/verify.js`.** Nothing in `index.html` references it; load
it by hand against a running preview:

```js
fetch('/tools/verify.js').then(r => r.text()).then(eval)
```

Then `__harness.seam({})`, `__harness.purity({n:320})`, and `__harness.fingerprint()` —
the last one snapshots the whole state vector at fixed fractions of the page so a change
meant to alter nothing can be *proved* to alter nothing (`fingerprintDiff`). Resize the
window first, then `__world.resize()` and `__scroller._measure()`.

`window.__world`, `__scroller`, `__applyScroll` and now `__models` are exposed on purpose.

- **Seam check** — walk every scroll pixel, flag second differences
  `|v(y+1) − 2v(y) + v(y−1)|` over a threshold. Isolates true steps from fast ramps;
  a plain first difference gives false positives on legitimate fast motion.
- **Purity check** — snapshot state at N positions in order, revisit in random order,
  diff. Any difference means state depends on scroll history — the bug class that caused
  props to stick.

Gate both on visibility: a value only matters when its `rocketK` / `gloveK` / `earthK` /
`moonK` / `saturnK` / `lmK` / `nglK` is > 0.02. `ve()` resets the K's but deliberately
leaves the parked coordinates behind them, so an off-screen prop's position is undefined
by design and must not be tested. **The gate applies to the purity check too** — without
it, purity reports ~900 false drifts on a healthy page.

Last run at 1440×900, after all four steps: **0 steps across 22,487 pixels, 0 drift over
320 probes**, twice, with different shuffle seeds. Also verified: hero + ascent + flight
computer sampled every 25 px from 0 to 8000 against `2a70380` served side by side, 0
differences over 25 keys; and `gloveK`/`gloveExplode` checked against their original
formulas at 200 positions with progress recovered from `gloveSpin` so pixel rounding
cannot mask a change, 0 mismatches.

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
