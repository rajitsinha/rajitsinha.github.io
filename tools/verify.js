/* ===========================================================================
   Verification harness for the scroll-driven scenes.

   Not part of the site — nothing in index.html references it. Load it by hand
   against a running preview and it installs window.__harness:

     fetch('/tools/verify.js').then(r => r.text()).then(eval)
     __harness.seam({})        // walk every scroll pixel, look for steps
     __harness.purity({n:320}) // is state a pure function of scroll?
     __harness.fingerprint()   // exact state vector, for before/after diffs

   Depends on window.__world / __scroller / __applyScroll, which index.html
   exposes on purpose.

   Note on the preview pane: it often reports a 0x0 viewport with
   visibilityState "hidden", so requestAnimationFrame never runs. Resize the
   window first, then call __world.resize() and __scroller._measure(), then
   drive frames through this harness rather than waiting for rAF.
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
    thrust: "rocketK", chuteK: "rocketK", noseK: "rocketK", trailOn: "rocketK",
    gloveSpin: "gloveK", gloveExplode: "gloveK", gloveScale: "gloveK",
    earthX: "earthK", earthY: "earthK", earthScale: "earthK",
    moonX: "moonK", moonY: "moonK", moonZ: "moonK", moonScale: "moonK"
  };
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
    for (const g of ["rocketK", "gloveK", "earthK", "moonK"]) gate[g] = new Float64Array(N);

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

  window.__harness = { go, snap, seam, purity, fingerprint, fingerprintDiff, keys, GATE, VIS };
  return "harness installed; keys=" + keys().length + " max=" + S.max;
})();
