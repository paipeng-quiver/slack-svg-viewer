const puppeteer = require("puppeteer");
const GIFEncoder = require("gif-encoder-2");
const { PNG } = require("pngjs");

/**
 * Check if an SVG buffer contains animations (SMIL or CSS).
 */
function isAnimatedSvg(svgBuffer) {
  const svg = svgBuffer.toString("utf-8");
  // SMIL animations
  if (/<animate[\s>]/i.test(svg)) return true;
  if (/<animateTransform[\s>]/i.test(svg)) return true;
  if (/<animateMotion[\s>]/i.test(svg)) return true;
  if (/<set\s/i.test(svg)) return true;
  // CSS animations
  if (/@keyframes/i.test(svg)) return true;
  if (/animation\s*:/i.test(svg)) return true;
  if (/animation-name\s*:/i.test(svg)) return true;
  return false;
}

/**
 * Render an animated SVG to a GIF buffer using Puppeteer + gif-encoder-2.
 * @param {Buffer} svgBuffer - The SVG file contents
 * @param {number} width - Viewport width (default 1024)
 * @param {number} durationMs - Animation duration to capture (default 3000)
 * @param {number} fps - Frames per second (default 10)
 * @returns {Promise<Buffer>} GIF buffer
 */
async function svgToGif(svgBuffer, width = 1024, durationMs = 3000, fps = 10) {
  const totalFrames = Math.round((durationMs / 1000) * fps);
  const frameDelay = Math.round(1000 / fps);

  const browser = await puppeteer.launch({
    headless: "new",
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
    ],
  });

  try {
    const page = await browser.newPage();

    // Build a data URL from the SVG
    const svgBase64 = svgBuffer.toString("base64");
    const html = `<!DOCTYPE html>
<html><head><style>
  * { margin: 0; padding: 0; }
  body { background: white; display: flex; align-items: center; justify-content: center; }
  img { max-width: 100%; height: auto; }
</style></head>
<body><img src="data:image/svg+xml;base64,${svgBase64}" /></body></html>`;

    await page.setViewport({ width, height: width, deviceScaleFactor: 1 });
    await page.setContent(html, { waitUntil: "networkidle0" });

    // Get actual content height
    const bodyHeight = await page.evaluate(() => {
      const img = document.querySelector("img");
      return img ? img.offsetHeight : document.body.scrollHeight;
    });
    const height = Math.max(bodyHeight, 100);
    await page.setViewport({ width, height, deviceScaleFactor: 1 });

    // Capture frames
    const frames = [];
    for (let i = 0; i < totalFrames; i++) {
      const screenshot = await page.screenshot({ type: "png" });
      frames.push(screenshot);
      if (i < totalFrames - 1) {
        await new Promise((r) => setTimeout(r, frameDelay));
      }
    }

    // Encode GIF
    const firstPng = PNG.sync.read(frames[0]);
    const encoder = new GIFEncoder(firstPng.width, firstPng.height, "neuquant");
    encoder.setDelay(frameDelay);
    encoder.setRepeat(0); // loop forever
    encoder.setQuality(10);
    encoder.start();

    for (const frame of frames) {
      const png = PNG.sync.read(frame);
      encoder.addFrame(png.data);
    }

    encoder.finish();
    return encoder.out.getData();
  } finally {
    await browser.close();
  }
}

module.exports = { isAnimatedSvg, svgToGif };
