// ─── Demo GIF Recorder ───
// Launches proxy (demo mode) + dashboard, captures via Puppeteer, outputs GIF

import puppeteer from "puppeteer";
import { spawn } from "node:child_process";
import { mkdirSync, rmSync, existsSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const FRAMES_DIR = join(ROOT, "scripts", "frames");
const OUTPUT_GIF = join(ROOT, "docs", "demo.gif");

const DASHBOARD_PORT = 3000;
const PROXY_PORT = 18790;
const VIEWPORT = { width: 1280, height: 720 };
const FPS = 2;
const CAPTURE_DURATION_MS = 34000;
const FRAME_INTERVAL = 1000 / FPS;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function waitForPort(port, timeoutMs = 60000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      await fetch(`http://localhost:${port}`);
      return;
    } catch {}
    await sleep(1000);
  }
  throw new Error(`Port ${port} timeout`);
}

const procs = [];
function spawnBg(cmd, args, opts = {}) {
  const p = spawn(cmd, args, { stdio: "pipe", shell: true, ...opts });
  p.stdout?.on("data", (d) => {});
  p.stderr?.on("data", (d) => {});
  procs.push(p);
  return p;
}

function cleanup() {
  for (const p of procs) {
    try { p.kill(); } catch {}
  }
}
process.on("exit", cleanup);
process.on("SIGINT", () => { cleanup(); process.exit(1); });

async function main() {
  console.log("[Recorder] Starting...");

  // Clean frames
  if (existsSync(FRAMES_DIR)) rmSync(FRAMES_DIR, { recursive: true });
  mkdirSync(FRAMES_DIR, { recursive: true });
  mkdirSync(join(ROOT, "docs"), { recursive: true });

  // 1. Start demo-runner (proxy + demo in one) using built JS
  console.log("[Recorder] Starting demo proxy...");
  spawnBg("node", [join(ROOT, "apps/proxy/dist/demo-runner.js")], {
    cwd: ROOT,
    shell: false,
    env: { ...process.env, LENS_DASHBOARD_PORT: String(PROXY_PORT) },
  });

  // 2. Start dashboard
  console.log("[Recorder] Starting dashboard...");
  spawnBg("node", [join(ROOT, "node_modules/.bin/next"), "start", "--port", String(DASHBOARD_PORT)], {
    cwd: join(ROOT, "apps/dashboard"),
    shell: false,
  });

  // Wait for services
  console.log("[Recorder] Waiting for proxy...");
  await waitForPort(PROXY_PORT);
  console.log("[Recorder] Waiting for dashboard...");
  await waitForPort(DASHBOARD_PORT);
  console.log("[Recorder] Services ready.");

  // The demo-runner waits for ENTER in non-TTY mode for 2 seconds, then starts
  await sleep(4000);

  // 3. Capture screenshots
  console.log("[Recorder] Launching browser...");
  const browser = await puppeteer.launch({
    headless: true,
    defaultViewport: VIEWPORT,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-gpu"],
  });

  const page = await browser.newPage();
  await page.goto(`http://localhost:${DASHBOARD_PORT}`, {
    waitUntil: "networkidle2",
    timeout: 30000,
  });

  // Wait for WebSocket to connect and first spans to appear
  await sleep(3000);

  console.log(`[Recorder] Capturing ${CAPTURE_DURATION_MS / 1000}s at ${FPS}fps...`);

  let frameCount = 0;
  const startTime = Date.now();

  while (Date.now() - startTime < CAPTURE_DURATION_MS) {
    const framePath = join(FRAMES_DIR, `frame_${String(frameCount).padStart(4, "0")}.png`);
    await page.screenshot({ path: framePath, type: "png" });
    frameCount++;

    if (frameCount % 10 === 0) {
      console.log(`[Recorder] ${frameCount} frames captured...`);
    }

    // Click the latest span card to show detail panel (every 3 seconds)
    if (frameCount % (FPS * 3) === 0) {
      try {
        const cards = await page.$$("button.w-full");
        if (cards.length > 0) {
          await cards[cards.length - 1].click();
          await sleep(200);
        }
      } catch {}
    }

    const elapsed = Date.now() - startTime;
    const nextFrame = frameCount * FRAME_INTERVAL;
    const waitTime = Math.max(0, nextFrame - elapsed);
    if (waitTime > 0) await sleep(waitTime);
  }

  console.log(`[Recorder] Captured ${frameCount} frames.`);
  await browser.close();

  // 4. Convert to GIF using sharp + gif-encoder-2
  console.log("[Recorder] Converting to GIF...");
  try {
    const sharp = require("sharp");
    const GIFEncoder = require("gif-encoder-2");
    const { createWriteStream: cws } = await import("node:fs");

    const files = readdirSync(FRAMES_DIR).filter((f) => f.endsWith(".png")).sort();
    const firstMeta = await sharp(join(FRAMES_DIR, files[0])).metadata();
    const scale = 720 / firstMeta.width;
    const h = Math.round(firstMeta.height * scale);

    const encoder = new GIFEncoder(720, h, "neuquant", true);
    encoder.setDelay(1000 / FPS);
    encoder.setRepeat(0);
    encoder.setQuality(10);

    const ws = cws(OUTPUT_GIF);
    encoder.createReadStream().pipe(ws);
    encoder.start();

    for (let i = 0; i < files.length; i++) {
      const { data } = await sharp(join(FRAMES_DIR, files[i]))
        .resize(720, h).ensureAlpha().raw()
        .toBuffer({ resolveWithObject: true });
      encoder.addFrame(data);
    }
    encoder.finish();
    await new Promise((resolve) => ws.on("finish", resolve));
    console.log(`[Recorder] GIF saved: ${OUTPUT_GIF}`);
  } catch (err) {
    console.error("[Recorder] GIF conversion failed:", err.message);
    console.log("[Recorder] Frames saved at:", FRAMES_DIR);
  }
  cleanup();

  console.log("[Recorder] Done!");
  process.exit(0);
}

main().catch((err) => {
  console.error("[Recorder] Fatal:", err);
  cleanup();
  process.exit(1);
});
