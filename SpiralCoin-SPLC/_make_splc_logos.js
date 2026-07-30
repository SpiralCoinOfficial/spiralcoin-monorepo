// Unify all SpiralCoin logo assets across the website.
// One source of truth: spiralcoin_logo.png (1200x1200 photoreal gold coin
// with SPIRALCOIN + SPLC arch text). Generates every variant the site +
// social platforms + iOS/Android need, replaces the legacy SVG so that
// every existing /assets/spiralcoin-mark.svg reference renders the
// unified artwork, and builds a 1200x630 og:image with the brand cosmos
// background.

const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const SRC = path.join(ROOT, 'spiralcoin_logo.png');
const BRAND_DIR = path.join(ROOT, 'brand');
if (!fs.existsSync(BRAND_DIR)) fs.mkdirSync(BRAND_DIR, { recursive: true });

// We need to read the ORIGINAL source before we overwrite it.
// Snapshot the original bytes into memory first.
const originalBytes = fs.readFileSync(SRC);

(async () => {
  const meta = await sharp(originalBytes).metadata();
  console.log(`Source: ${meta.width}x${meta.height}`);

  // 1) Crop the round coin out of the dark 1200x1200 canvas
  const COIN = 660;
  const off = Math.round((meta.width - COIN) / 2);
  const cropped = await sharp(originalBytes)
    .extract({ left: off, top: off, width: COIN, height: COIN })
    .toBuffer();

  // 2) Mask to a circle so corners are transparent
  const circleMask = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${COIN}" height="${COIN}">
       <circle cx="${COIN/2}" cy="${COIN/2}" r="${COIN/2}" fill="#fff"/>
     </svg>`
  );
  const coinTransparent = await sharp(cropped)
    .composite([{ input: circleMask, blend: 'dest-in' }])
    .png()
    .toBuffer();

  // 3) Master + every size the ecosystem asks for
  const variants = [
    // Website assets (OVERWRITE legacy dark-bg copies)
    { out: 'spiralcoin_logo.png',                 size: 1200 },
    { out: 'app/spiralcoin_logo.png',             size: 1200 },
    // Brand kit
    { out: 'brand/splc-logo-512.png',             size:  512 },
    { out: 'brand/splc-logo-256.png',             size:  256 },
    { out: 'brand/splc-logo-128.png',             size:  128 },
    { out: 'brand/splc-logo-64.png',              size:   64 },
    // Block-explorer mandated
    { out: 'brand/splc-logo-explorer-32.png',     size:   32 },
    // Mobile / PWA
    { out: 'apple-touch-icon.png',                size:  180 },
    { out: 'brand/splc-android-192.png',          size:  192 },
    { out: 'brand/splc-android-512.png',          size:  512 },
  ];
  for (const v of variants) {
    const target = path.join(ROOT, v.out);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    await sharp(coinTransparent)
      .resize(v.size, v.size, { fit: 'contain', background: { r:0,g:0,b:0,alpha:0 } })
      .png({ compressionLevel: 9 })
      .toFile(target);
    console.log(`  ${v.out.padEnd(36)} ${String(fs.statSync(target).size).padStart(7)} B`);
  }

  // 4) 1200x630 og:image social card on the SpiralCoin deep-space gradient
  const OG_W = 1200, OG_H = 630;
  const ogBg = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${OG_W}" height="${OG_H}">
       <defs>
         <radialGradient id="g" cx="50%" cy="40%" r="75%">
           <stop offset="0%"   stop-color="#1a1230"/>
           <stop offset="55%"  stop-color="#0a0518"/>
           <stop offset="100%" stop-color="#000000"/>
         </radialGradient>
       </defs>
       <rect width="100%" height="100%" fill="url(#g)"/>
       <g fill="#fff" opacity="0.55">
         <circle cx="140"  cy="90"  r="1.6"/>
         <circle cx="280"  cy="220" r="1.0"/>
         <circle cx="430"  cy="55"  r="2.2"/>
         <circle cx="640"  cy="180" r="1.0"/>
         <circle cx="820"  cy="80"  r="1.4"/>
         <circle cx="1040" cy="150" r="1.8"/>
         <circle cx="1130" cy="400" r="1.2"/>
         <circle cx="980"  cy="540" r="1.6"/>
         <circle cx="720"  cy="580" r="1.0"/>
         <circle cx="540"  cy="500" r="1.4"/>
         <circle cx="320"  cy="540" r="1.0"/>
         <circle cx="120"  cy="430" r="1.8"/>
         <circle cx="60"   cy="300" r="1.2"/>
       </g>
       <text x="660" y="295"
             font-family="Inter, Segoe UI, Helvetica, Arial, sans-serif"
             font-size="92" font-weight="800" fill="#FFD15C">SpiralCoin</text>
       <text x="660" y="358"
             font-family="Inter, Segoe UI, Helvetica, Arial, sans-serif"
             font-size="32" font-weight="600" fill="#cfd8e6"
             letter-spacing="5">$SPLC TRADING PLATFORM</text>
       <text x="660" y="418"
             font-family="Inter, Segoe UI, Helvetica, Arial, sans-serif"
             font-size="22" font-weight="500" fill="#8e9bb3">spiralcoin.net</text>
     </svg>`
  );
  const coinForOg = await sharp(coinTransparent).resize(460, 460).png().toBuffer();
  await sharp(ogBg)
    .composite([{ input: coinForOg, left: 100, top: 85 }])
    .png({ compressionLevel: 9 })
    .toFile(path.join(ROOT, 'spiralcoin_og_1200x630.png'));
  const ogBytes = fs.statSync(path.join(ROOT,'spiralcoin_og_1200x630.png')).size;
  console.log(`  spiralcoin_og_1200x630.png            ${String(ogBytes).padStart(7)} B  (social card)`);

  // 5) Replace assets/spiralcoin-mark.svg with an SVG that embeds the
  //    transparent coin PNG. Every existing reference (50+ HTML files)
  //    now renders the unified mark with NO HTML edits required.
  const coin256 = await sharp(coinTransparent).resize(256, 256).png().toBuffer();
  const coinB64 = coin256.toString('base64');
  const wrappedSvg =
`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" aria-hidden="true">
  <title>SpiralCoin (SPLC)</title>
  <image href="data:image/png;base64,${coinB64}" x="0" y="0" width="256" height="256"/>
</svg>
`;
  fs.writeFileSync(path.join(ROOT, 'assets', 'spiralcoin-mark.svg'), wrappedSvg);
  console.log(`  assets/spiralcoin-mark.svg            ${String(fs.statSync(path.join(ROOT,'assets','spiralcoin-mark.svg')).size).padStart(7)} B  (replaced - now renders unified PNG)`);

  console.log('\nAll logo assets unified. One source of truth.');
})().catch((e) => { console.error(e); process.exit(1); });
