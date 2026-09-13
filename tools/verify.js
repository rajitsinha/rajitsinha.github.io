/* ===========================================================================
   Verification harness for the scroll-driven scenes.

   Not part of the site — nothing in index.html references it. Load it by hand
   against a running preview and it installs window.__harness:

     fetch('/tools/verify.js').then(r => r.text()).then(eval)
     __harness.seam({})        // walk every scroll pixel, look for steps
     __harness.purity({n:320}) // is state a pure function of scroll?
     __harness.fingerprint()   // exact state vector, for before/after diffs
     __harness.occlusion({})   // bright bodies behind unbacked text

   Depends on window.__world / __scroller / __applyScroll, which index.html
   exposes on purpose.

   Note on the preview pane: it often reports a 0x0 viewport with
   visibilityState "hidden", so requestAnimationFrame never runs. Resize the
   window first, then call __world.resize() and __scroller._measure(), then
   drive frames through this harness rather than waiting for rAF.

   seam() and purity() are synchronous and should stay that way, because the
   page's own rAF loop scrolls the page every frame and an await inside a walk
   gives it a turn. But an earlier note here blamed that for a single bad
   sample at y=0 showing the last chapter's state, and it was wrong: that was a
   real bug. Triggers were measured against the scroll that was requested
   rather than where the page actually was, so any scroll clamped at the end of
   the document shifted every trigger by the overshoot. Fixed in docRect();
   clampCheck() below is the regression test.
   =========================================================================== */
(function () {
  const W = window.__world, S = window.__scroller, APPLY = window.__applyScroll;
  if (!W || !S || !APPLY) throw new Error("harness: __world/__scroller/__applyScroll missing");

  /* Drive one scroll position deterministically. The scroller is a damped
     follower, so target/current/_set all have to be pinned together or the
     next frame drags the value somewhere else. */
  const go = y => {
    S.target = y; S.current = y; S._set = Math.round(y);
    scrollTo(0, y);
    APPLY(y);
  };

  /* Which visibility gate makes a key meaningful. ve() resets the K's but
     deliberately leaves the parked coordinates behind them alone, so an
     off-screen prop's position is undefined by design and must not be tested.
     A value only counts when its K is above VIS. */
  const GATE = {
    rocketX: "rocketK", rocketY: "rocketK", rocketZ: "rocketK", rocketTilt: "rocketK",
    thrust: "rocketK", chuteK: "rocketK", sepK: "rocketK", hangK: "rocketK", flightT: "rocketK", trailOn: "rocketK",
    gloveSpin: "gloveK", gloveExplode: "gloveK", gloveScale: "gloveK",
    gloveLift: "gloveK", gloveFade: "gloveK",
    earthX: "earthK", earthY: "earthK", earthScale: "earthK",
    moonX: "moonK", moonY: "moonK", moonZ: "moonK", moonScale: "moonK",
    saturnX: "saturnK", saturnY: "saturnK", saturnZ: "saturnK",
    saturnScale: "saturnK", saturnTilt: "saturnK", saturnSpin: "saturnK",
    saturnThrust: "saturnK", saturnSmoke: "saturnK", saturnShake: "saturnK", saturnPlume: "saturnK",
    saturnSep1: "saturnK", saturnSep2: "saturnK", saturnNozzle: "saturnThrust",
    lmX: "lmK", lmY: "lmK", lmZ: "lmK", lmScale: "lmK", lmSpin: "lmK"
  };
  const GATES = ["rocketK", "gloveK", "earthK", "moonK", "saturnK", "lmK", "saturnThrust"];
  const VIS = 0.02;

  const keys = () => Object.keys(W.state).filter(k => typeof W.state[k] === "number").sort();
  const snap = () => { const s = W.state, o = {}; for (const k of keys()) o[k] = s[k]; return o; };

  /* ---------------------------------------------------------------- seam
     Walk every scroll pixel and look at the SECOND difference,
     |v(y+1) - 2v(y) + v(y-1)|. A real discontinuity shows up at roughly the
     size of the step; a legitimately fast ramp has small curvature per px^2.
     A plain first difference gives false positives on fast motion. */
  function seam(opts) {
    opts = opts || {};
    const step = opts.step || 1;
    const from = opts.from || 0;
    const to = opts.to != null ? opts.to : S.max;
    const K = keys();
    const N = Math.floor((to - from) / step) + 1;
    const track = {}, min = {}, max = {}, gate = {};
    for (const k of K) { track[k] = new Float64Array(N); min[k] = Infinity; max[k] = -Infinity; }
    for (const g of GATES) gate[g] = new Float64Array(N);

    for (let i = 0; i < N; i++) {
      go(from + i * step);
      const s = W.state;
      for (const k of K) {
        const v = s[k]; track[k][i] = v;
        if (v < min[k]) min[k] = v;
        if (v > max[k]) max[k] = v;
      }
      for (const g in gate) gate[g][i] = s[g] || 0;
    }

    const hits = [];
    for (const k of K) {
      const range = max[k] - min[k];
      if (range < 1e-9) continue;
      const thr = Math.max(1e-4, (opts.rel || 0.01) * range);
      const t = track[k], g = GATE[k] ? gate[GATE[k]] : null;
      for (let i = 1; i < N - 1; i++) {
        if (g && (g[i] <= VIS || g[i - 1] <= VIS || g[i + 1] <= VIS)) continue;
        const d2 = Math.abs(t[i + 1] - 2 * t[i] + t[i - 1]);
        if (d2 > thr) hits.push({ key: k, y: from + i * step, d2: +d2.toFixed(5), thr: +thr.toFixed(5) });
      }
    }
    hits.sort((a, b) => b.d2 - a.d2);
    return { walked: N, span: [from, to], steps: hits.length, worst: hits.slice(0, 12) };
  }

  /* -------------------------------------------------------------- purity
     Scene state must be a pure function of scroll. Snapshot N positions in
     order, revisit them in a seeded shuffle, diff. Any difference means state
     depends on scroll history — the bug class that left props on screen. */
  function purity(opts) {
    opts = opts || {};
    const n = opts.n || 320;
    const ys = [];
    for (let i = 0; i < n; i++) ys.push(Math.round(S.max * i / (n - 1)));

    const inOrder = {};
    for (const y of ys) { go(y); inOrder[y] = snap(); }

    let seed = opts.seed || 20260809;           // seeded, so a failure repeats
    const rnd = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296;
    const shuffled = ys.slice();
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(rnd() * (i + 1));
      const t = shuffled[i]; shuffled[i] = shuffled[j]; shuffled[j] = t;
    }

    const drift = [];
    for (const y of shuffled) {
      go(y);
      const now = snap(), was = inOrder[y];
      for (const k in was) {
        const g = GATE[k];
        if (g && (was[g] <= VIS || now[g] <= VIS)) continue;
        const d = Math.abs(now[k] - was[k]);
        if (d > 1e-9) drift.push({ key: k, y, ordered: +was[k].toFixed(5), revisited: +now[k].toFixed(5), d: +d.toFixed(6) });
      }
    }
    drift.sort((a, b) => b.d - a.d);
    return { probes: n, drift: drift.length, worst: drift.slice(0, 12) };
  }

  /* --------------------------------------------------------- fingerprint
     The whole state vector at fixed FRACTIONS of the page, so a refactor that
     is meant to change nothing can be proved to change nothing even when the
     page height moves. Compare with fingerprintDiff. */
  function fingerprint(opts) {
    opts = opts || {};
    const n = opts.n || 200, K = keys(), rows = [];
    for (let i = 0; i < n; i++) {
      const f = i / (n - 1);
      go(Math.round(S.max * f));
      const s = W.state;
      rows.push(K.map(k => {
        const g = GATE[k];
        if (g && (s[g] || 0) <= VIS) return "-";      // gated: not meaningful
        return s[k].toFixed(4);
      }).join(","));
    }
    return { n, keys: K, rows };
  }

  function fingerprintDiff(a, b, tol) {
    tol = tol || 1e-4;
    const out = [];
    if (a.keys.join() !== b.keys.join()) out.push({ note: "key set changed", a: a.keys, b: b.keys });
    const n = Math.min(a.rows.length, b.rows.length);
    for (let i = 0; i < n; i++) {
      const x = a.rows[i].split(","), y = b.rows[i].split(",");
      for (let j = 0; j < x.length; j++) {
        if (x[j] === y[j]) continue;
        if (x[j] === "-" || y[j] === "-") { out.push({ f: +(i / (n - 1)).toFixed(3), key: a.keys[j], a: x[j], b: y[j], note: "visibility changed" }); continue; }
        const d = Math.abs(parseFloat(x[j]) - parseFloat(y[j]));
        if (d > tol) out.push({ f: +(i / (n - 1)).toFixed(3), key: a.keys[j], a: x[j], b: y[j], d: +d.toFixed(5) });
      }
    }
    return { differences: out.length, worst: out.slice(0, 20) };
  }


  /* ----------------------------------------------------------- occlusion
     A bright body sitting behind text that has nothing of its own behind it.

     For every probe, push the state into the scene graph, project each visible
     body onto the screen, grow it by a bloom margin, and intersect it with the
     line boxes of text that is actually showing: effective opacity above a
     floor, on screen, and not on a surface that carries its own wash. Spheres
     project as circles and models as boxes, so a hit is real overlap rather
     than the empty corner of a bounding square. Line boxes rather than element
     rects, so a short last line does not claim the whole width.

     Needs __world.earthGroup / moonGroup for the planets; models come from the
     slots. Synchronous, like the other walks. */
  const BACKED = ".panel,.codecard,.hcard,.hlead";
  function effOpacity(el) {
    let o = 1;
    for (let e = el; e && e.nodeType === 1; e = e.parentElement) {
      const cs = getComputedStyle(e);
      if (cs.display === "none" || cs.visibility === "hidden") return 0;
      o *= parseFloat(cs.opacity);
      if (o < 0.01) return 0;
    }
    return o;
  }
  function tag(el) {
    const host = el.closest("[id]");
    const cls = typeof el.className === "string" && el.className.trim() ? "." + el.className.trim().split(/\s+/)[0] : "";
    return (host ? "#" + host.id + " " : "") + el.tagName.toLowerCase() + cls;
  }
  function textBoxes(sel, floor) {
    const out = [], rng = document.createRange();
    for (const el of document.querySelectorAll(sel)) {
      if (el.closest(BACKED)) continue;
      const op = effOpacity(el);
      if (op < floor) continue;
      /* clip to every ancestor that hides overflow, so text scrolled out of a
         window -- a tape row above the pointer, a panel outside its pin -- is
         not counted as exposed just because it still has a rect */
      let c0 = 0, c1 = 0, c2 = innerWidth, c3 = innerHeight;
      for (let a = el.parentElement; a && a !== document.body; a = a.parentElement) {
        const cs = getComputedStyle(a);
        if (cs.overflowX === "visible" && cs.overflowY === "visible") continue;
        const ar = a.getBoundingClientRect();
        c0 = Math.max(c0, ar.left); c1 = Math.max(c1, ar.top); c2 = Math.min(c2, ar.right); c3 = Math.min(c3, ar.bottom);
      }
      rng.selectNodeContents(el);
      for (const r of rng.getClientRects()) {
        const x0 = Math.max(r.left, c0), y0 = Math.max(r.top, c1), x1 = Math.min(r.right, c2), y1 = Math.min(r.bottom, c3);
        if (x1 - x0 < 2 || y1 - y0 < 2) continue;
        out.push({ label: tag(el), x0, x1, y0, y1 });
      }
    }
    return out;
  }
  function toPx(v) {
    const p = v.clone().project(W.camera);
    return { x: (p.x + 1) / 2 * innerWidth, y: (1 - p.y) / 2 * innerHeight, z: p.z };
  }
  function circleOf(group, radius) {
    group.updateMatrixWorld(true);
    const T = W.THREE, c = new T.Vector3().setFromMatrixPosition(group.matrixWorld);
    const up = new T.Vector3(0, 1, 0).applyQuaternion(W.camera.quaternion);
    const a = toPx(c), b = toPx(c.clone().addScaledVector(up, group.matrixWorld.getMaxScaleOnAxis() * radius));
    if (a.z > 1) return null;
    return { kind: "circle", cx: a.x, cy: a.y, r: Math.hypot(b.x - a.x, b.y - a.y) };
  }
  function rectOf(group) {
    group.updateMatrixWorld(true);
    const T = W.THREE, b = new T.Box3().setFromObject(group);
    if (b.isEmpty()) return null;
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9, behind = 0;
    for (let i = 0; i < 8; i++) {
      const p = toPx(new T.Vector3(i & 1 ? b.max.x : b.min.x, i & 2 ? b.max.y : b.min.y, i & 4 ? b.max.z : b.min.z));
      if (p.z > 1) behind++;
      x0 = Math.min(x0, p.x); x1 = Math.max(x1, p.x); y0 = Math.min(y0, p.y); y1 = Math.max(y1, p.y);
    }
    return behind === 8 ? null : { kind: "rect", x0, y0, x1, y1 };
  }
  function bodies() {
    const slot = s => { const g = W.slotGroup && W.slotGroup(s); return g && g.visible && g.children.length ? rectOf(g) : null; };
    return [
      { name: "earth",  k: "earthK",  shape: () => W.earthGroup && W.earthGroup.visible ? circleOf(W.earthGroup, 9.55) : null },
      { name: "moon",   k: "moonK",   shape: () => W.moonGroup && W.moonGroup.visible ? circleOf(W.moonGroup, 14.1) : null },
      { name: "saturn", k: "saturnK", shape: () => slot("saturn") },
      { name: "lm",     k: "lmK",     shape: () => slot("lm") },
      { name: "glove",  k: "gloveK",  shape: () => W.gloveGroup && W.gloveGroup.visible && W.gloveGroup.children.length ? rectOf(W.gloveGroup) : null }
    ];
  }
  function overlap(sh, t, m) {
    if (sh.kind === "rect") {
      const ox = Math.min(sh.x1 + m, t.x1) - Math.max(sh.x0 - m, t.x0);
      const oy = Math.min(sh.y1 + m, t.y1) - Math.max(sh.y0 - m, t.y0);
      return ox > 0 && oy > 0 ? Math.min(ox, oy) : 0;
    }
    const nx = Math.max(t.x0, Math.min(sh.cx, t.x1)), ny = Math.max(t.y0, Math.min(sh.cy, t.y1));
    const d = Math.hypot(sh.cx - nx, sh.cy - ny);
    return d < sh.r + m ? sh.r + m - d : 0;
  }
  /* Returns every body-behind-text pairing with the scroll range it spans and
     how deep the worst overlap gets, in CSS pixels. */
  function occlusion(opts) {
    opts = opts || {};
    const sel = opts.text || ".card-title .big,.card-title p,.caption .kicker,.caption h2,.caption p,#contact .kicker,#contact h2,#contact .btn,footer span";
    const floor = opts.floor != null ? opts.floor : 0.08, m = opts.margin != null ? opts.margin : 36;
    const list = bodies().filter(b => !opts.bodies || opts.bodies.indexOf(b.name) !== -1);
    const from = opts.from || 0, to = opts.to != null ? opts.to : S.max, step = opts.step || 30;
    const hits = {};
    let probes = 0;
    for (let y = from; y <= to; y += step) {
      go(y); W.update(1 / 60); probes++;
      const text = textBoxes(sel, floor);
      if (!text.length) continue;
      W.camera.updateMatrixWorld(true);
      for (const b of list) {
        if ((W.state[b.k] || 0) <= VIS) continue;
        const sh = b.shape();
        if (!sh) continue;
        for (const t of text) {
          const d = overlap(sh, t, m);
          if (!d) continue;
          const key = b.name + " behind " + t.label;
          const h = hits[key] || (hits[key] = { pair: key, from: y, to: y, probes: 0, worstPx: 0, worstY: y });
          h.to = y; h.probes++;
          if (d > h.worstPx) { h.worstPx = Math.round(d); h.worstY = y; }
        }
      }
    }
    return { probes, step, marginPx: m, overlaps: Object.keys(hits).length,
             list: Object.values(hits).sort((a, b) => b.probes - a.probes) };
  }

  /* ---------------------------------------------------------- clampCheck
     Regression test for triggers measured against a clamped scroll. Mark the
     triggers dirty, apply a scroll past the end of the document (the page
     clamps it and they are re-measured there), then return to the top: the
     state at y=0 must be exactly what it was before. */
  function clampCheck() {
    go(0); const before = snap();
    dispatchEvent(new Event("resize"));
    const past = document.documentElement.scrollHeight;
    S.target = S.current = past; S._set = past; scrollTo(0, past);
    const overshoot = past - Math.round(scrollY);
    APPLY(past);
    go(0); const after = snap(), mismatched = [];
    for (const k in before) {
      const g = GATE[k];
      if (g && (before[g] <= VIS || after[g] <= VIS)) continue;
      if (Math.abs(before[k] - after[k]) > 1e-9) mismatched.push(k);
    }
    dispatchEvent(new Event("resize")); go(0);
    return { overshootPx: overshoot, mismatchedKeys: mismatched };
  }

  window.__harness = { go, snap, seam, purity, fingerprint, fingerprintDiff, occlusion, clampCheck, keys, GATE, VIS };
  return "harness installed; keys=" + keys().length + " max=" + S.max;
})();
