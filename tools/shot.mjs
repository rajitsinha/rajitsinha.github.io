// Headless screenshots of the scroll-driven site, since the preview pane is hidden
// and cannot capture. Usage: node shot.mjs config.json
// config: { url, width, height, prelude?, shots: [{ out, expr, wait?, clip? }] }
// Each expr is evaluated in the page (may return a promise), then the frame is captured.
import { spawn } from "node:child_process";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";

const CHROME = "C:/Program Files/Google/Chrome/Application/chrome.exe";
const cfg = JSON.parse(readFileSync(process.argv[2], "utf8"));
const sleep = ms => new Promise(r => setTimeout(r, ms));
const port = 9400 + Math.floor(Math.random() * 400);
const prof = path.join(path.dirname(process.argv[2]), "chrome-prof-" + port);
mkdirSync(prof, { recursive: true });

// gpu:true renders on the real graphics card, so the page's frame-time governor keeps
// bloom on and the capture matches what a visitor sees; the default is software GL.
const glFlags = cfg.gpu
  ? ["--use-angle=d3d11", "--enable-gpu", "--ignore-gpu-blocklist", "--enable-gpu-rasterization"]
  : ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"];
const chrome = spawn(CHROME, [
  "--headless=new", `--remote-debugging-port=${port}`, `--user-data-dir=${prof}`,
  ...glFlags, "--hide-scrollbars",
  "--no-first-run", "--no-default-browser-check", "--mute-audio",
  `--window-size=${cfg.width},${cfg.height}`, "about:blank"
], { stdio: "ignore" });

try {
  let ok = false;
  for (let i = 0; i < 75 && !ok; i++) {
    try { await (await fetch(`http://127.0.0.1:${port}/json/version`)).json(); ok = true; } catch { await sleep(200); }
  }
  if (!ok) throw new Error("chrome did not start");
  const page = (await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()).find(t => t.type === "page");
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  let id = 0;
  const pending = new Map(), listeners = [];
  ws.onmessage = ev => {
    const m = JSON.parse(ev.data);
    if (m.id && pending.has(m.id)) { const p = pending.get(m.id); pending.delete(m.id); m.error ? p.rej(new Error(m.error.message)) : p.res(m.result); }
    else if (m.method) for (const l of listeners) l(m);
  };
  await new Promise(r => (ws.onopen = r));
  const send = (method, params = {}) => new Promise((res, rej) => { const i = ++id; pending.set(i, { res, rej }); ws.send(JSON.stringify({ id: i, method, params })); });
  const evaluate = async expr => {
    const r = await send("Runtime.evaluate", { expression: expr, awaitPromise: true, returnByValue: true });
    if (r.exceptionDetails) return "EXCEPTION: " + (r.exceptionDetails.exception && r.exceptionDetails.exception.description || r.exceptionDetails.text);
    return r.result.value;
  };

  await send("Page.enable");
  await send("Runtime.enable");
  const errors = [];
  listeners.push(m => { if (m.method === "Runtime.exceptionThrown") errors.push(m.params.exceptionDetails.text); });
  await send("Emulation.setDeviceMetricsOverride", { width: cfg.width, height: cfg.height, deviceScaleFactor: 1, mobile: cfg.width < 700 });
  const loaded = new Promise(r => listeners.push(m => m.method === "Page.loadEventFired" && r()));
  await send("Page.navigate", { url: cfg.url });
  await loaded;
  await sleep(800);
  if (cfg.prelude) console.log("prelude:", JSON.stringify(await evaluate(cfg.prelude)));
  for (const s of cfg.shots) {
    const v = await evaluate(s.expr);
    await sleep(s.wait || 500);
    // clip: { x, y, width, height, scale? } captures just that part of the viewport
    // (CDP measures a clip from the top of the document, so add the scroll)
    let clip = null;
    if (s.clip) {
      const [sx, sy] = await evaluate("[scrollX, scrollY]");
      clip = { scale: 1, ...s.clip, x: s.clip.x + sx, y: s.clip.y + sy };
    }
    const shot = await send("Page.captureScreenshot", clip ? { format: "png", clip } : { format: "png" });
    mkdirSync(path.dirname(s.out), { recursive: true });
    writeFileSync(s.out, Buffer.from(shot.data, "base64"));
    console.log(path.basename(s.out), JSON.stringify(v));
  }
  if (errors.length) console.log("page exceptions:", JSON.stringify(errors.slice(0, 5)));
  ws.close();
} finally {
  chrome.kill();
}
