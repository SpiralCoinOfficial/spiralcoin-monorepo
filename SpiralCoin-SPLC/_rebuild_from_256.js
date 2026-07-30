// Regenerate every SPLC logo variant from the approved source: brand/splc-logo-256.png
const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const SRC = path.join(ROOT, 'brand', 'splc-logo-256.png');

(async () => {
  const src = fs.readFileSync(SRC);
  const meta = await sharp(src).metadata();
  console.log(`Source: brand/splc-logo-256.png  ${meta.width}x${meta.height}`);

  // Upscale once to a clean master for downscaling
  const master = await sharp(src).resize(1024, 1024, { kernel: 'lanczos3' }).png().toBuffer();

  const variants = [
    { out: 'brand/splc-logo-master-512.png',  size:  512 },
    { out: 'brand/splc-logo-512.png',         size:  512 },
    { out: 'brand/splc-logo-256.png',         size:  256 },
    { out: 'brand/splc-logo-128.png',         size:  128 },
    { out: 'brand/splc-logo-64.png',          size:   64 },
    { out: 'brand/splc-logo-explorer-32.png', size:   32 },
    { out: 'brand/splc-android-192.png',      size:  192 },
    { out: 'brand/splc-android-512.png',      size:  512 },
    { out: 'apple-touch-icon.png',            size:  180 },
    { out: 'spiralcoin_logo.png',             size: 1024 },
    { out: 'app/spiralcoin_logo.png',         size: 1024 },
  ];

  for (const v of variants) {
    const target = path.join(ROOT, v.out);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    await sharp(master)
      .resize(v.size, v.size, { fit: 'contain', kernel: 'lanczos3',
        background: { r:0, g:0, b:0, alpha:0 } })
      .png({ compressionLevel: 9 })
      .toFile(target);
    console.log(`  ${v.out.padEnd(36)} ${String(fs.statSync(target).size).padStart(7)} B`);
  }

  // Rebuild unified mark SVG to embed the new 256 PNG (no HTML edits needed)
  const coin256 = await sharp(master).resize(256, 256).png().toBuffer();
  const svg =
`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" aria-hidden="true">
  <title>SpiralCoin (SPLC)</title>
  <image href="data:image/png;base64,${coin256.toString('base64')}" x="0" y="0" width="256" height="256"/>
</svg>
`;
  fs.writeFileSync(path.join(ROOT, 'assets', 'spiralcoin-mark.svg'), svg);
  console.log(`  assets/spiralcoin-mark.svg            ${String(fs.statSync(path.join(ROOT,'assets','spiralcoin-mark.svg')).size).padStart(7)} B`);

  console.log('\nAll variants regenerated from brand/splc-logo-256.png');
})().catch(e => { console.error(e); process.exit(1); });
