// Convert captured frames to GIF using sharp + gif-encoder-2 (pure Node, no ffmpeg)

import { createRequire } from "node:module";
import { readdirSync, writeFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createWriteStream } from "node:fs";

const require = createRequire(import.meta.url);
const sharp = require("sharp");
const GIFEncoder = require("gif-encoder-2");

const __dirname = dirname(fileURLToPath(import.meta.url));
const FRAMES_DIR = join(__dirname, "frames");
const OUTPUT = join(__dirname, "..", "docs", "demo.gif");
const WIDTH = 720;
const FPS = 2;

async function main() {
  if (!existsSync(FRAMES_DIR)) {
    console.error("No frames directory found. Run record-demo.mjs first.");
    process.exit(1);
  }

  const files = readdirSync(FRAMES_DIR)
    .filter((f) => f.endsWith(".png"))
    .sort();

  console.log(`[GIF] ${files.length} frames found`);

  // Get dimensions from first frame
  const firstMeta = await sharp(join(FRAMES_DIR, files[0])).metadata();
  const scale = WIDTH / firstMeta.width;
  const height = Math.round(firstMeta.height * scale);

  console.log(`[GIF] Output: ${WIDTH}x${height} @ ${FPS}fps`);

  const encoder = new GIFEncoder(WIDTH, height, "neuquant", true);
  encoder.setDelay(1000 / FPS);
  encoder.setRepeat(0); // Loop forever
  encoder.setQuality(10);

  const writeStream = createWriteStream(OUTPUT);
  encoder.createReadStream().pipe(writeStream);
  encoder.start();

  for (let i = 0; i < files.length; i++) {
    const framePath = join(FRAMES_DIR, files[i]);
    const { data } = await sharp(framePath)
      .resize(WIDTH, height)
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    encoder.addFrame(data);

    if ((i + 1) % 10 === 0 || i === files.length - 1) {
      console.log(`[GIF] Processed ${i + 1}/${files.length}`);
    }
  }

  encoder.finish();

  await new Promise((resolve) => writeStream.on("finish", resolve));
  console.log(`[GIF] Saved: ${OUTPUT}`);
}

main().catch((err) => {
  console.error("[GIF] Error:", err);
  process.exit(1);
});
