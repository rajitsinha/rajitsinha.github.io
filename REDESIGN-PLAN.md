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

**Live: `main` at `a33fd6c`**, tagged `live-before-feedback-fixes`. The rebuild
(`rebuild/scroll-scenes`, four steps off the pre-rebuild checkpoint `2a70380`) and the
full-viewport conversion are merged and deployed. A drawing-sheet re-skin was deployed and
then reverted at the owner's request; that revert is `a33fd6c`.

**Feedback batch: on `fixes/feedback-batch`, not merged, not deployed.** One commit per
item, each verified before the next:

```
7e369f2  outreach on phones: photo beside its caption, clear of the nav
273864f  Apollo chapter: a launch, staging and an orbit instead of a glide
e0cbe5a  Moon and Earth kept off the awards and contact text
659be1f  awards: an instrument tape the scroll reads through
586b0d6  glove section: the Moon fades out through the handover
a983efa  scroll triggers measured against the real scroll position (a real bug)
a77b2ae  outreach: a smaller photo, and a deck the scroll deals through
546a028  glove section: the glove lifts away instead of zooming out
2a98ead  bench-test video: stop the browser freezing
2f8e044  NASA's glove removed
de304b8  harness: occlusion check
```

To deploy: merge into `main` and push. To go back afterwards: `git revert -m 1 <merge>` and
push, or reset `main` to the tag `live-before-feedback-fixes` (that one needs a force-push).

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
- **No NASA glove beside his.** Removed at his request; the chapter shows his glove alone,
  and the footer credit names only the Saturn V and lunar module models.
- **Don't dim the lunar module's light.** When it covered the Apollo title he asked for a
  fix that keeps it at full brightness. It is kept clear by placement instead: it sits
  under the title card, positioned on screen (`apAt`).
- **The Saturn V flies a mission, not a glide.** Ignition, two staging events with each
  stage's own plume, orbit, a translunar burn, then the lunar module into lunar orbit. He
  asked for it to feel like a real launch.
- **The glove does not zoom out** as its detail section arrives. It lifts away and fades
  through `gloveLift`/`gloveFade`, which leave its size alone; `gloveK` only drops once it
  is already invisible.
- **`.shot video{opacity:.999}` stays.** The bench-test video froze his browser until he
  moved the window. That matches Chromium issue 451225677 (a video promoted to a
  DirectComposition overlay stalls on some NVIDIA drivers), and opacity below 1 keeps the
  video off that path. It cannot be reproduced in the preview pane, so it needs confirming
  on his machine.
- The outreach photo stays small (a `26rem` column) and its stats are a deck the scroll
  deals. Awards are an interactive tape, not a list, in one centred column of rounded cards (he
  disliked a square, off-centre first version). In contact, the Moon sits upper right,
  clear of the links.

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
3. **Chapters — done** (`151a40e`, then `400f3e0` → `0ccfb22`). The Apollo chapter and the
   glove comparison first; then every remaining chapter converted to full-viewport, one
   section per commit. See "Decks" below.
4. **Wire-body language — done** (`762c3da`). Earth and Moon untouched and verified
   byte-identical; `wireModel()` extends the same treatment to loaded geometry.

## Decks — how the full-viewport chapters work

`buildDeck(selector, groups, vhPerStep)` turns a chapter into a column of viewport-tall
panels paged inside its own pin. `groups` names which of the chapter's existing top-level
blocks each panel holds, so all the copy, photos and widgets stay the originals — only
the grouping is new.

```js
buildDeck("#sec-rocketry",[[0,1,2],[3],[4],[5],[6]],130);   // 5 panels, 620lvh
buildDeck("#sec-glove",   [[0,1,2],[3],[4]],      130);     // 3 panels, 360lvh
```

Section height is `100 + (panels-1) * vhPerStep` lvh, set by `buildDeck`. `#sec-outreach`
is deliberately **not** a deck: it is one screen of copy plus the card stack, which is
already sticky, and pinning the section would nest that inside another pin's
`overflow:hidden` and stop it working. It uses `.vfull` instead — `min-height:100lvh`, so
a short viewport grows the block rather than clipping it.

The card stack inside it (`#hstage`, 300lvh) is now a deal: `deckAt()` gives it the same
dwell, the top card tips back and flies up past the viewer, and each card's figures count
up as it arrives (`hTitle`). `#sec-awards` is no longer a deck either: `buildTape()` makes
it an instrument tape (`#tstage`, 320lvh) laid out as one centred column: the heading, a pill readout (year drum,
rail, count) and a window of rounded cards. The card being read lights up and the list
slides to keep it mid-window without ever showing empty space, so at the ends the
highlight travels instead. Cards are clickable and keyboard-focusable.

Things worth knowing before changing any of it:

- **Panels dwell.** `DWELL` (0.42) is the fraction of each step's scroll spent parked
  before any travel begins. That is what keeps the code viewer and the simulator still
  while you read or drag them. Lower it and widgets start sliding under the pointer.
- **Reveal cannot come from element geometry inside a deck** — every panel sits at the
  same place on screen. It comes from how near the deck is to that panel, and the global
  `.rv`/`.fade` passes skip anything inside one. Without that skip they sit at opacity 0
  forever, because their triggers can never fire in a pinned chapter.
- **Panels measure themselves and scale down what does not fit.** `.pin` clips, so an
  overrunning block would simply be lost. Transforms do not affect layout, so the panel
  stays exactly one viewport. At 1440×900 all eight panels fit unscaled; at 1280×680 they
  scale to ~0.75–0.8 and still land exactly on the available height.
- Two blocks needed sizing to fit a viewport at all: the `.v3d` glove viewer
  (`min(72lvh,760px)` inside decks) and the apogee plot (width-capped to 800px, which
  keeps its 700×236 ratio and takes the card from 886 to 771).
- Decks pause video in panels that are scrolled away, toggled on the edge.
- `docRect()` resolves elements inside a pin to their document-flow position. Decks do
  not rely on it — they drive everything off chapter progress — but it is what makes any
  geometry-based trigger inside a pin measure sanely.

Optional leftovers:

- `nasa-emu-suit.glb` (3.4 MB) and `nasa-helmet.glb` (232 KB) are still unused. The suit
  is the one from his hero photo; the helmet is the other half of what his TAS team
  designed. Neither is loaded, so neither costs a visitor anything today.

Known and not fixed yet:

- **The Moon sits behind the `#gloveCap` caption** in `#stage-glove` (occlusion: ~160 px
  deep, across the whole caption window). Not a regression: that chapter's Moon code is
  identical on live `a33fd6c`. Moving it means moving the Apollo end pose (`mEnd`) and the
  `#sec-glove` start pose with it, or the handover steps.
- **Phones: the deck fit guard shrinks panels** to 0.56-0.88 at 375x812 (rocketry
  `[.56,.88,1,.64,.79]`, glove `[.61,.82,1]`), so body text gets small. It needs panels
  that pan through tall content, or a flowing layout below ~700 px.

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
- **`lvh` does not follow a programmatic resize in the preview pane.** Resize, then
  *reload*, then check that a `height:100lvh` probe equals `innerHeight` before trusting
  any measurement. Get this wrong and panels report the wrong available height, the fit
  guard scales things that did not need scaling, and section heights look invented.
- **A marginal seam hit at short viewports is expected.** At 720 px the check reports
  `rocketTilt` at y=1176, d2 0.00884 against a 0.00736 threshold. The same hit appears on
  every commit back through the rebuild, identical to five decimals: it is the ascent
  trajectory's tangent pitching over across fewer pixels, marginally crossing a threshold
  set at 1% of the key's range. Before chasing a seam hit, A/B it against the previous
  commit at the same viewport — that takes one minute and settles it.
- **A single bad sample at y=0 showing the last chapter's state is a real bug, not a
  harness artifact.** An earlier version of this note blamed awaiting between probes; that
  was wrong. Triggers were measured against the scroll that was *requested* rather than
  where the page actually was, so any scroll clamped at the end of the document shifted
  every trigger by the overshoot, and whole chapters answered for the wrong range: after
  one clamped jump the top of the page drew the contact chapter. Fixed in `docRect()`,
  which now measures against `scrollY`; `__harness.clampCheck()` is the regression test.
  Keep the walks synchronous anyway -- an await gives the page's own rAF loop a turn.
- The preview pane reports `visibilityState: "hidden"`, so rAF never runs and screenshots
  are unreliable. Drive frames with `__world.update(1/60)` after each `__harness.go(y)`,
  and read the framebuffer with `gl.readPixels` if you need to see what is on screen.
- **Cache-bust model URLs too**, not just `index.html`. A re-encoded `.glb` at the same
  path will keep serving the old bytes and you will "verify" the file you just replaced.
- **The preview's `navigate` can hand back a cached `index.html`** right after an edit.
  Before trusting a run, check that a substring you just added is in `document.scripts` or
  the `<style>`; if it is not, navigate again with a new `?fresh=` query.
- **Blend on screen, not in the world, when the camera is moving.** Blending the lunar
  module's world position during the camera's swing flung it off the corner of the screen
  and back, and no state seam flagged it, because every key was smooth. Project, blend in
  NDC, unproject (`apAt`).

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
- **Occlusion check**: `occlusion({from,to,step})` projects each visible body (Earth and
  Moon as circles; Saturn V, LM and glove as boxes), grows it by a 36 px bloom margin, and
  intersects it with the line boxes of text that is showing and not on a backed surface
  (`.panel,.codecard,.hcard,.hlead`), clipped to overflow ancestors. The target is 0.
  **Run it with the models mounted.** Seam and purity walk the whole page, chapters release
  their models behind them, and the Saturn V and LM boxes then come back null without any
  error. Park inside the chapter, poll `__world.slotGroup('saturn').children.length`, then
  run it.
- **clampCheck()**: the regression test for the `docRect()` bug described under Traps.

Gate both on visibility: a value only matters when its `rocketK` / `gloveK` / `earthK` /
`moonK` / `saturnK` / `lmK` is > 0.02 (`saturnNozzle` gates on `saturnThrust`). `ve()` resets the K's but deliberately
leaves the parked coordinates behind them, so an off-screen prop's position is undefined
by design and must not be tested. **The gate applies to the purity check too** — without
it, purity reports ~900 false drifts on a healthy page.

Last run at 1440×900, on `273864f`: **0 steps across 30,904 pixels, 0 drift over 320
probes**, clampCheck clean, occlusion 0 across the Apollo chapter at 5 px steps (the whole
page at 30 px reports only the known Moon behind `#gloveCap`). At the end of the rebuild,
also verified: hero + ascent + flight
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
