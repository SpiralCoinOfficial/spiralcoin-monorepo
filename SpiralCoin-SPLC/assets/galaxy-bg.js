/* ============================================================
   SpiralCoin cosmos — realistic procedural starfield (Canvas 2D)

   Original work, no third-party imagery. Renders a clean,
   professional, photoreal-feeling deep-space backdrop:

     * ~1,800 stars with realistic size + brightness distribution
       (power-law: many faint, few bright), stellar color
       temperatures (blue / white / yellow / orange / red).
     * Sub-pixel anti-aliased disk + radial glow halo on the
       brighter stars (gives the JWST diffraction-spike feel
       without faking diffraction spikes).
     * Independent slow twinkle per star (sinusoidal brightness
       jitter, not synchronized).
     * Multi-layer parallax drift (3 depth bands move at
       different speeds — creates real depth perception).
     * Far-distance "milky way" band painted as low-opacity
       offscreen noise, drifted with the parallax.
     * Mouse parallax (tiny influence, optional, disabled on
       touch / reduced-motion).
     * DPR-aware, resize-aware, tab-hidden pause, reduced-motion
       respected.
   ============================================================ */
(function () {
  'use strict';

  if (window.__SPLC_COSMOS_V4__) return;
  window.__SPLC_COSMOS_V4__ = true;

  console.info('%c[SpiralCoin] cosmos v4 — procedural realistic starfield',
               'color:#c9a227;font-weight:bold');

  var prefersReducedMotion =
    window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // --------------------------------------------------------------
  // PRNG (deterministic) — same field every load, so site feels
  // stable instead of randomly different on every refresh.
  // --------------------------------------------------------------
  function mulberry32(seed) {
    return function () {
      seed = (seed + 0x6D2B79F5) | 0;
      var t = seed;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // --------------------------------------------------------------
  // Stellar color temperature -> rgb, approximated.
  // --------------------------------------------------------------
  function pickStarColor(rand) {
    // Real stellar class population is heavily weighted toward
    // cool red dwarfs, but visually we want a few prominent
    // blue / white anchors. Tuned to look like a real deep-sky
    // photo, not like a Christmas tree.
    var r = rand();
    if (r < 0.62) return [255, 244, 222]; // warm white (most stars)
    if (r < 0.80) return [255, 224, 178]; // pale yellow / G-type
    if (r < 0.90) return [255, 196, 145]; // amber / K-type
    if (r < 0.96) return [184, 208, 255]; // bluish-white / A-type
    if (r < 0.99) return [255, 168, 132]; // orange / M-type
    return [148, 184, 255];               // hot blue / O/B-type (rare)
  }

  // Power-law star size: most are tiny, a few are bright.
  function sampleSize(rand) {
    var u = rand();
    // Inverse-power so distribution is heavy-tailed.
    // 95% of stars: radius 0.3-0.9 px. 5%: up to ~2.2 px.
    var r = 0.30 + Math.pow(u, 5.5) * 1.95;
    return r;
  }

  // --------------------------------------------------------------
  // Star field generation
  // --------------------------------------------------------------
  function buildStars(width, height, density) {
    var rand = mulberry32(0x5C0FFEE);
    var count = Math.round(width * height * density);
    var stars = new Array(count);
    for (var i = 0; i < count; i++) {
      var depth = rand();          // 0 (far) .. 1 (near)
      var radius = sampleSize(rand) * (0.65 + depth * 0.6);
      var color  = pickStarColor(rand);
      // Brighter when nearer + bigger
      var base   = 0.35 + depth * 0.55 + (radius - 0.3) * 0.18;
      stars[i] = {
        x: rand() * width,
        y: rand() * height,
        r: radius,
        depth: depth,
        baseAlpha: Math.min(1, base),
        color: color,
        // Twinkle phase + speed per star (so it isn't synchronized)
        tPhase: rand() * Math.PI * 2,
        tSpeed: 0.4 + rand() * 1.2,      // Hz-ish
        tAmp:   0.10 + rand() * 0.22,    // brightness wobble
        // Halo only for the brightest ~6%
        halo: radius > 1.55
      };
    }
    return stars;
  }

  // --------------------------------------------------------------
  // Build offscreen "milky way" nebula band — soft, low-opacity
  // value-noise streak diagonally across the field. Painted once
  // then translated by parallax.
  // --------------------------------------------------------------
  function buildNebula(width, height) {
    var w = Math.max(512, Math.round(width  * 0.6));
    var h = Math.max(512, Math.round(height * 0.6));
    var c = document.createElement('canvas');
    c.width = w; c.height = h;
    var ctx = c.getContext('2d');
    if (!ctx) return null;

    // Black base
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, w, h);

    // Build a diagonal soft band using stacked low-opacity radial
    // gradients of muted color (cool blue, warm gold, magenta dust).
    var rand = mulberry32(0xC051C);
    var palette = [
      'rgba(120, 150, 220, ',  // cool dust blue
      'rgba(200, 168, 110, ',  // warm gold dust
      'rgba(150, 110, 180, ',  // magenta/violet
      'rgba(110, 170, 200, '   // cyan
    ];
    var bandAngle = -0.28; // radians, gentle diagonal
    var bandCx = w * 0.5;
    var bandCy = h * 0.55;
    var blobs = 220;
    ctx.globalCompositeOperation = 'lighter';
    for (var i = 0; i < blobs; i++) {
      var t = (rand() - 0.5) * w * 1.3;          // along band
      var n = (rand() - 0.5) * h * 0.45;          // across band (narrow)
      // Bias n toward 0 so the band stays a band
      n *= Math.pow(rand(), 0.7);
      var x = bandCx + Math.cos(bandAngle) * t - Math.sin(bandAngle) * n;
      var y = bandCy + Math.sin(bandAngle) * t + Math.cos(bandAngle) * n;
      var rad = 40 + rand() * 180;
      var col = palette[(i * 7) % palette.length];
      var a   = 0.012 + rand() * 0.026;          // very subtle
      var g = ctx.createRadialGradient(x, y, 0, x, y, rad);
      g.addColorStop(0, col + a + ')');
      g.addColorStop(1, col + '0)');
      ctx.fillStyle = g;
      ctx.fillRect(x - rad, y - rad, rad * 2, rad * 2);
    }
    ctx.globalCompositeOperation = 'source-over';
    return c;
  }

  // --------------------------------------------------------------
  // Emission nebula — one dense, colorful gas cloud (think Orion /
  // Carina / Eagle). Painted once offscreen, then drifted slowly.
  // --------------------------------------------------------------
  function buildEmissionNebula(seed) {
    var size = 900;
    var c = document.createElement('canvas');
    c.width = size; c.height = size;
    var ctx = c.getContext('2d');
    if (!ctx) return null;

    var rand = mulberry32(seed >>> 0);

    // Emission-line palette: Hα red/pink, OIII teal, dust violet,
    // hot core white-blue. Tuned to look like a real telescope image.
    var palette = [
      'rgba(238, 110, 168, ',  // hydrogen pink (Hα)
      'rgba(196,  74, 138, ',  // deeper magenta
      'rgba( 84, 196, 220, ',  // OIII teal
      'rgba(110, 130, 220, ',  // hot blue
      'rgba(240, 200, 150, ',  // dust warm
      'rgba(180, 110, 200, '   // violet dust
    ];

    var cx = size * (0.45 + (rand() - 0.5) * 0.1);
    var cy = size * (0.5  + (rand() - 0.5) * 0.1);

    ctx.globalCompositeOperation = 'lighter';

    // Bright dense core — fewer, larger, more opaque blobs.
    var coreBlobs = 60;
    for (var i = 0; i < coreBlobs; i++) {
      // Concentrate near center with Gaussian-ish bias.
      var ang = rand() * Math.PI * 2;
      var dist = Math.pow(rand(), 1.6) * size * 0.30;
      var x = cx + Math.cos(ang) * dist;
      var y = cy + Math.sin(ang) * dist * 0.75; // slightly squashed
      var rad = 60 + rand() * 180;
      var col = palette[(i * 3) % palette.length];
      var a = 0.05 + rand() * 0.12;
      var g = ctx.createRadialGradient(x, y, 0, x, y, rad);
      g.addColorStop(0,   col + a + ')');
      g.addColorStop(0.5, col + (a * 0.4) + ')');
      g.addColorStop(1,   col + '0)');
      ctx.fillStyle = g;
      ctx.fillRect(x - rad, y - rad, rad * 2, rad * 2);
    }

    // Outer wisps — many small low-opacity blobs in a wider envelope.
    var wisps = 280;
    for (var j = 0; j < wisps; j++) {
      var ang2 = rand() * Math.PI * 2;
      var dist2 = Math.pow(rand(), 0.6) * size * 0.48;
      var x2 = cx + Math.cos(ang2) * dist2;
      var y2 = cy + Math.sin(ang2) * dist2 * 0.85;
      var rad2 = 25 + rand() * 110;
      var col2 = palette[(j * 5) % palette.length];
      var a2 = 0.014 + rand() * 0.036;
      var g2 = ctx.createRadialGradient(x2, y2, 0, x2, y2, rad2);
      g2.addColorStop(0, col2 + a2 + ')');
      g2.addColorStop(1, col2 + '0)');
      ctx.fillStyle = g2;
      ctx.fillRect(x2 - rad2, y2 - rad2, rad2 * 2, rad2 * 2);
    }

    // Dark-dust silhouettes — a few destination-out blobs to give
    // the cloud structure instead of looking like a fuzzy ball.
    ctx.globalCompositeOperation = 'destination-out';
    var dust = 24;
    for (var k = 0; k < dust; k++) {
      var dx = cx + (rand() - 0.5) * size * 0.7;
      var dy = cy + (rand() - 0.5) * size * 0.55;
      var dr = 40 + rand() * 140;
      var dg = ctx.createRadialGradient(dx, dy, 0, dx, dy, dr);
      dg.addColorStop(0, 'rgba(0,0,0,' + (0.18 + rand() * 0.22) + ')');
      dg.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = dg;
      ctx.fillRect(dx - dr, dy - dr, dr * 2, dr * 2);
    }

    ctx.globalCompositeOperation = 'source-over';
    return c;
  }

  // --------------------------------------------------------------
  // Distant galaxy — small spiral (~200px) seen face-on at angle.
  // Painted once, drawn very small in a fixed location.
  // --------------------------------------------------------------
  function buildDistantGalaxy(seed) {
    var size = 360;
    var c = document.createElement('canvas');
    c.width = size; c.height = size;
    var ctx = c.getContext('2d');
    if (!ctx) return null;

    var rand = mulberry32(seed >>> 0);
    var cx = size / 2;
    var cy = size / 2;
    var tilt = 0.55; // y-axis squash to fake inclination

    ctx.globalCompositeOperation = 'lighter';

    // Central bulge — bright warm yellow-white core with halo.
    var bulgeR = size * 0.18;
    var bg = ctx.createRadialGradient(cx, cy, 0, cx, cy, bulgeR);
    bg.addColorStop(0,   'rgba(255, 240, 210, 0.95)');
    bg.addColorStop(0.3, 'rgba(255, 220, 170, 0.55)');
    bg.addColorStop(0.7, 'rgba(255, 200, 140, 0.18)');
    bg.addColorStop(1,   'rgba(255, 200, 140, 0)');
    ctx.fillStyle = bg;
    ctx.fillRect(cx - bulgeR, cy - bulgeR, bulgeR * 2, bulgeR * 2);

    // Faint outer halo (whole disk glow)
    var haloR = size * 0.46;
    var hg = ctx.createRadialGradient(cx, cy, bulgeR * 0.5, cx, cy, haloR);
    hg.addColorStop(0, 'rgba(220, 215, 240, 0.22)');
    hg.addColorStop(1, 'rgba(220, 215, 240, 0)');
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(1, tilt);
    ctx.translate(-cx, -cy);
    ctx.fillStyle = hg;
    ctx.fillRect(cx - haloR, cy - haloR, haloR * 2, haloR * 2);
    ctx.restore();

    // Spiral arms — many tiny blobs traced along a logarithmic spiral,
    // tilted with the disk. 2 main arms + light scatter.
    function arm(startAngle, color, count, jitter) {
      for (var i = 0; i < count; i++) {
        var u = i / count;                 // 0..1 along arm
        // log spiral r = a * e^(b*theta)
        var theta = startAngle + u * Math.PI * 3.2;
        var r = size * 0.06 * Math.exp(0.32 * (theta - startAngle));
        if (r > size * 0.45) break;
        var jx = (rand() - 0.5) * jitter;
        var jy = (rand() - 0.5) * jitter;
        var x  = cx + (Math.cos(theta) * r) + jx;
        // tilt: y compressed
        var y  = cy + (Math.sin(theta) * r * tilt) + jy * tilt;
        var br = 1.4 + rand() * 3.5 * (1 - u * 0.6); // blobs shrink outward
        var a  = (0.22 + rand() * 0.35) * (1 - u * 0.65);
        var g = ctx.createRadialGradient(x, y, 0, x, y, br * 4);
        g.addColorStop(0, color.replace('A', String(a)));
        g.addColorStop(1, color.replace('A', '0'));
        ctx.fillStyle = g;
        ctx.fillRect(x - br * 4, y - br * 4, br * 8, br * 8);
      }
    }
    // 2 main arms, opposite sides
    arm(0,                'rgba(200, 215, 255, A)', 220, 4);
    arm(Math.PI,          'rgba(200, 215, 255, A)', 220, 4);
    // Warmer dust between
    arm(Math.PI * 0.5,    'rgba(255, 200, 160, A)', 90,  3);
    arm(Math.PI * 1.5,    'rgba(255, 200, 160, A)', 90,  3);

    // A few tiny pin stars sprinkled across the disk
    ctx.globalCompositeOperation = 'source-over';
    for (var p = 0; p < 18; p++) {
      var pa = rand() * Math.PI * 2;
      var pr = Math.pow(rand(), 0.6) * size * 0.42;
      var px = cx + Math.cos(pa) * pr;
      var py = cy + Math.sin(pa) * pr * tilt;
      ctx.fillStyle = 'rgba(255,255,255,' + (0.5 + rand() * 0.4) + ')';
      ctx.beginPath();
      ctx.arc(px, py, 0.5 + rand() * 0.6, 0, Math.PI * 2);
      ctx.fill();
    }

    return c;
  }

  // --------------------------------------------------------------
  // Realistic Andromeda-style galaxy — built from thousands of
  // sharp pin stars in a strongly-tilted disk, with a bright
  // warm core, dark dust lanes, and pink Hα emission knots.
  // No fuzzy blob shortcuts — every feature is real point detail.
  // --------------------------------------------------------------
  function buildCrispGalaxy(seed, size) {
    var c = document.createElement('canvas');
    c.width = size; c.height = size;
    var ctx = c.getContext('2d');
    if (!ctx) return null;

    var rand = mulberry32(seed >>> 0);
    var cx = size / 2;
    var cy = size / 2;

    // Strong inclination — Andromeda-like, ~25° from edge-on
    var tilt = 0.32;
    var rotZ = -0.45 + rand() * 0.25;       // gentle tilt of major axis
    var cosR = Math.cos(rotZ);
    var sinR = Math.sin(rotZ);

    function project(rx, ry) {
      var sy = ry * tilt;
      return { x: cx + rx * cosR - sy * sinR,
               y: cy + rx * sinR + sy * cosR };
    }

    function dot(x, y, r, rgba) {
      ctx.fillStyle = rgba;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }

    // ============================================================
    // 1. SOFT DISK HALO — very faint, just to suggest the disk shape
    // ============================================================
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(rotZ);
    ctx.scale(1, tilt);
    var diskGrad = ctx.createRadialGradient(0, 0, size * 0.04, 0, 0, size * 0.48);
    diskGrad.addColorStop(0,    'rgba(255,236,200,0.32)');
    diskGrad.addColorStop(0.18, 'rgba(255,220,170,0.16)');
    diskGrad.addColorStop(0.55, 'rgba(190,200,235,0.06)');
    diskGrad.addColorStop(1,    'rgba(160,180,225,0)');
    ctx.fillStyle = diskGrad;
    ctx.beginPath();
    ctx.arc(0, 0, size * 0.48, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // ============================================================
    // 2. BACKGROUND DISK STARS — diffuse fill across the disk
    //    so the spiral arms ride on top of a populated background
    // ============================================================
    var bgCount = 1400;
    var maxR    = size * 0.46;
    for (var i = 0; i < bgCount; i++) {
      // r distribution skewed to center
      var ru = Math.pow(rand(), 0.85);
      var rr = ru * maxR;
      var a  = rand() * Math.PI * 2;
      var p  = project(Math.cos(a) * rr, Math.sin(a) * rr);
      // brightness falls off outward
      var fade = 1 - ru * 0.85;
      var br = 0.45 + rand() * 0.45;
      var al = (0.25 + rand() * 0.35) * fade;
      if (al < 0.05) continue;
      // mostly warm-white populus, hint of cool
      var col = rand() < 0.78 ? '255,235,200' : '215,225,245';
      dot(p.x, p.y, br, 'rgba(' + col + ',' + al.toFixed(2) + ')');
    }

    // ============================================================
    // 3. CENTRAL BULGE — dense warm-yellow pin-star cluster
    // ============================================================
    var bulgeR = size * 0.13;
    for (var b1 = 0; b1 < 380; b1++) {
      var u = (rand() + rand() + rand() + rand()) / 4;  // tight gaussian
      var rr1 = Math.pow(u, 1.4) * bulgeR;
      var a1  = rand() * Math.PI * 2;
      var p1  = project(Math.cos(a1) * rr1, Math.sin(a1) * rr1);
      var br1 = 0.55 + rand() * 0.7;
      var al1 = 0.55 + rand() * 0.4;
      dot(p1.x, p1.y, br1, 'rgba(255,228,168,' + al1.toFixed(2) + ')');
    }

    // ============================================================
    // 4. BRIGHT NUCLEUS — sharp core with tight halo
    // ============================================================
    var nucP = project(0, 0);
    var nG = ctx.createRadialGradient(nucP.x, nucP.y, 0, nucP.x, nucP.y, size * 0.045);
    nG.addColorStop(0,   'rgba(255,250,228,0.98)');
    nG.addColorStop(0.4, 'rgba(255,228,168,0.45)');
    nG.addColorStop(1,   'rgba(255,210,140,0)');
    ctx.fillStyle = nG;
    ctx.beginPath();
    ctx.arc(nucP.x, nucP.y, size * 0.045, 0, Math.PI * 2);
    ctx.fill();
    dot(nucP.x, nucP.y, 2.0, 'rgba(255,252,235,1)');

    // ============================================================
    // 5. SPIRAL ARMS — patchy, irregular, blue-white young stars
    //    Two main arms, broken into segments with density bursts
    // ============================================================
    var emissionKnots = []; // pink HII regions seeded along arms
    var armCount = 2;
    var perArm   = 900;
    var bSpiral  = 0.30;
    var armWidth = 0.13;

    for (var arm = 0; arm < armCount; arm++) {
      var phase = (arm / armCount) * Math.PI * 2;
      for (var j = 0; j < perArm; j++) {
        var u2 = j / perArm;
        var rr2 = Math.pow(u2, 0.58) * maxR;
        if (rr2 < bulgeR * 0.75) continue;
        var theta = phase + Math.log(rr2 / (size * 0.025) + 1) / bSpiral;

        // Density burst pattern along the arm — fakes star-forming regions
        var burst = 0.5 + 0.5 * Math.sin(u2 * Math.PI * 6 + arm * 1.7);
        burst = Math.pow(burst, 1.6);
        if (rand() > 0.35 + burst * 0.55) continue;

        theta += (rand() - 0.5) * armWidth;
        var radJitter = (rand() - 0.5) * size * 0.018;
        var rJ = rr2 + radJitter;
        var pp = project(Math.cos(theta) * rJ, Math.sin(theta) * rJ);

        var fade2 = 1 - Math.pow(u2, 1.35);
        var al2 = (0.45 + rand() * 0.5) * fade2 * (0.6 + burst * 0.5);
        if (al2 < 0.06) continue;
        var rad = 0.5 + rand() * (0.85 + (1 - u2) * 0.55);

        // Color: dominantly blue-white young stars, with hot blue popups
        var col2;
        var k2 = rand();
        if (k2 < 0.68) col2 = '180,210,255';
        else if (k2 < 0.86) col2 = '232,242,255';
        else if (k2 < 0.94) col2 = '150,185,255';   // hot blue
        else col2 = '255,222,170';                  // occasional warm
        dot(pp.x, pp.y, rad, 'rgba(' + col2 + ',' + al2.toFixed(2) + ')');

        // Seed an Hα knot in dense burst regions
        if (burst > 0.78 && rand() < 0.025) {
          emissionKnots.push({ x: pp.x, y: pp.y });
        }
      }
    }

    // ============================================================
    // 6. DARK DUST LANE — a thin destination-out arc cutting the
    //    near side of the disk. Looks like Andromeda / NGC 891.
    // ============================================================
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(rotZ);
    ctx.scale(1, tilt);
    ctx.globalCompositeOperation = 'destination-out';
    // Multiple thin lanes at slightly different radii / offsets
    var lanes = [
      { r: size * 0.22, off:  size * 0.02, w: size * 0.012, a: 0.55 },
      { r: size * 0.30, off:  size * 0.03, w: size * 0.010, a: 0.42 },
      { r: size * 0.38, off:  size * 0.04, w: size * 0.008, a: 0.32 }
    ];
    for (var L = 0; L < lanes.length; L++) {
      var ln = lanes[L];
      ctx.strokeStyle = 'rgba(0,0,0,' + ln.a + ')';
      ctx.lineWidth = ln.w;
      ctx.beginPath();
      ctx.ellipse(0, ln.off, ln.r, ln.r * 0.95, 0, Math.PI * 0.05, Math.PI * 0.95);
      ctx.stroke();
    }
    ctx.restore();

    // ============================================================
    // 7. HII EMISSION KNOTS — small pink Hα regions along arms
    // ============================================================
    ctx.globalCompositeOperation = 'lighter';
    var maxKnots = Math.min(emissionKnots.length, 22);
    for (var h = 0; h < maxKnots; h++) {
      var kn = emissionKnots[h];
      var kr = 2.5 + rand() * 2.8;
      var kg = ctx.createRadialGradient(kn.x, kn.y, 0, kn.x, kn.y, kr * 2.2);
      kg.addColorStop(0,   'rgba(255,150,180,0.85)');
      kg.addColorStop(0.5, 'rgba(220,100,160,0.30)');
      kg.addColorStop(1,   'rgba(180,80,150,0)');
      ctx.fillStyle = kg;
      ctx.beginPath();
      ctx.arc(kn.x, kn.y, kr * 2.2, 0, Math.PI * 2);
      ctx.fill();
      dot(kn.x, kn.y, 0.9, 'rgba(255,210,225,0.95)');
    }
    ctx.globalCompositeOperation = 'source-over';

    // ============================================================
    // 8. ANCHOR PIN STARS — 18 bright haloed stars across disk
    // ============================================================
    for (var k = 0; k < 18; k++) {
      var aa = rand() * Math.PI * 2;
      var rr3 = (0.16 + rand() * 0.30) * size;
      var pp3 = project(Math.cos(aa) * rr3, Math.sin(aa) * rr3);
      var hg2 = ctx.createRadialGradient(pp3.x, pp3.y, 0, pp3.x, pp3.y, 7);
      hg2.addColorStop(0,   'rgba(225,238,255,0.95)');
      hg2.addColorStop(0.5, 'rgba(180,210,255,0.28)');
      hg2.addColorStop(1,   'rgba(180,210,255,0)');
      ctx.fillStyle = hg2;
      ctx.beginPath();
      ctx.arc(pp3.x, pp3.y, 7, 0, Math.PI * 2);
      ctx.fill();
      dot(pp3.x, pp3.y, 1.2, 'rgba(248,252,255,1)');
    }

    return c;
  }

  // --------------------------------------------------------------
  // Main renderer
  // --------------------------------------------------------------
  function start() {
    // Remove any stale legacy nodes from previous cosmos versions
    ['splc-cosmos-style','splc-cosmos-photoreal']
      .forEach(function (id) {
        var e = document.getElementById(id);
        if (e && e.parentNode) e.parentNode.removeChild(e);
      });
    document.querySelectorAll('.splc-cosmos-layer,.splc-cosmos-stars,.splc-cosmos-aurora')
      .forEach(function (e) { e.parentNode && e.parentNode.removeChild(e); });

    // Mount or find canvas
    var canvas = document.getElementById('splc-cosmos');
    if (!canvas) {
      canvas = document.createElement('canvas');
      canvas.id = 'splc-cosmos';
      document.body.insertBefore(canvas, document.body.firstChild);
    }
    var ctx = canvas.getContext('2d');
    if (!ctx) {
      console.warn('[SpiralCoin] cosmos: 2D canvas unavailable');
      return;
    }

    var dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
    var cssW = 0, cssH = 0;
    var stars = [];
    var galaxy = null;            // crisp pin-star spiral galaxy
    var galaxyPos = { x: 0, y: 0, size: 0 };
    var meteors = [];             // active shooting stars
    var nextMeteorAt = 0;         // next launch time (seconds since start)
    var mouseX = 0, mouseY = 0;
    var targetMouseX = 0, targetMouseY = 0;

    function resize() {
      cssW = window.innerWidth;
      cssH = window.innerHeight;
      canvas.width  = Math.round(cssW * dpr);
      canvas.height = Math.round(cssH * dpr);
      canvas.style.width  = cssW + 'px';
      canvas.style.height = cssH + 'px';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      // Density: tuned so a 1080p screen gets ~1600-1800 stars.
      // Lighter on tiny mobile so we don't tax low-end GPUs.
      var density = cssW < 600 ? 0.0010 : 0.00085;
      stars = buildStars(cssW, cssH, density);

      // Realistic Andromeda-style galaxy, lower-left, larger and
      // partially off the left edge for a cinematic deep-space framing.
      var gSize = Math.round(Math.min(cssW, cssH) * (cssW < 600 ? 0.85 : 0.62));
      gSize = Math.max(320, Math.min(720, gSize));
      galaxy = buildCrispGalaxy(0x6A1AC79, gSize);
      galaxyPos.size = gSize;
      // Center is just outside the left edge, vertically below middle.
      galaxyPos.x = cssW * -0.05 - gSize * 0.5;
      galaxyPos.y = cssH * 0.78 - gSize * 0.5;
    }

    resize();
    window.addEventListener('resize', resize, { passive: true });

    // Mouse parallax — extremely subtle, never on touch / reduced-motion
    if (!prefersReducedMotion && !('ontouchstart' in window)) {
      window.addEventListener('mousemove', function (e) {
        targetMouseX = (e.clientX / cssW - 0.5) * 2;  // -1..1
        targetMouseY = (e.clientY / cssH - 0.5) * 2;
      }, { passive: true });
    }

    var t0 = performance.now();
    var lastT = t0;
    var driftX = 0, driftY = 0;
    var running = true;
    var meteorRand = mulberry32(0xBADCAFE);

    function scheduleNextMeteor(t) {
      // 4-12s gap between launches.
      nextMeteorAt = t + 4 + meteorRand() * 8;
    }
    scheduleNextMeteor(0);

    function spawnMeteor() {
      // Launch from the upper portion of the sky, traveling down-and-out.
      var startSide = meteorRand() < 0.5 ? 'top' : 'left';
      var sx, sy, angle;
      if (startSide === 'top') {
        sx = cssW * (0.05 + meteorRand() * 0.85);
        sy = -20;
        // shoot diagonally down — angle in radians (0 = right)
        angle = Math.PI * (0.18 + meteorRand() * 0.22); // 32°-72°
      } else {
        sx = -20;
        sy = cssH * (0.05 + meteorRand() * 0.4);
        angle = Math.PI * (0.05 + meteorRand() * 0.18); // 9°-41°
      }
      var speed = 900 + meteorRand() * 700;  // px/sec
      var life  = 0.6 + meteorRand() * 0.8;  // seconds
      var lenScale = 0.85 + meteorRand() * 0.6;
      // Tint — mostly white-blue, occasionally warm.
      var tint = meteorRand() < 0.78
                 ? [220, 235, 255]
                 : [255, 218, 170];
      meteors.push({
        x: sx, y: sy,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        age: 0,
        life: life,
        lenScale: lenScale,
        tint: tint
      });
    }

    function frame(now) {
      if (!running) return;
      var t  = (now - t0) / 1000;          // seconds since start
      var dt = Math.min(0.05, (now - lastT) / 1000);
      lastT = now;

      // Glide mouse smoothly toward target (low-pass)
      mouseX += (targetMouseX - mouseX) * 0.04;
      mouseY += (targetMouseY - mouseY) * 0.04;

      // Slow autonomous drift (very gentle continuous pan)
      driftX += dt * 1.2;   // px / sec, scaled by depth later
      driftY += dt * 0.4;

      // Clear
      ctx.clearRect(0, 0, cssW, cssH);

      // Distant galaxy — realistic Andromeda-style. Very slow rotation.
      if (galaxy) {
        var gSize = galaxyPos.size;
        var gx = galaxyPos.x + gSize * 0.5
                 + Math.sin(t * 0.015) * 4
                 + mouseX * 3;
        var gy = galaxyPos.y + gSize * 0.5
                 + Math.cos(t * 0.012) * 3
                 + mouseY * 2;
        ctx.save();
        ctx.globalAlpha = 0.88;
        ctx.globalCompositeOperation = 'lighter';
        ctx.translate(gx, gy);
        ctx.rotate(t * 0.004);          // ~1 rev / 26 min — barely perceptible
        ctx.drawImage(galaxy, -gSize / 2, -gSize / 2);
        ctx.restore();
        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = 'source-over';
      }

      // Stars
      for (var i = 0; i < stars.length; i++) {
        var s = stars[i];
        // Twinkle: sinusoidal brightness around baseAlpha
        var tw = Math.sin(t * s.tSpeed + s.tPhase) * s.tAmp;
        var a  = Math.max(0.05, Math.min(1, s.baseAlpha + tw));

        // Parallax: deeper stars move less. Wrap around screen.
        var par = 0.15 + s.depth * 1.85;
        var px = (s.x + driftX * par * 0.18 + mouseX * par * 8) % cssW;
        var py = (s.y + driftY * par * 0.18 + mouseY * par * 6) % cssH;
        if (px < 0) px += cssW;
        if (py < 0) py += cssH;

        var c = s.color;

        // Halo for the brightest stars
        if (s.halo) {
          var haloR = s.r * 6;
          var g = ctx.createRadialGradient(px, py, 0, px, py, haloR);
          g.addColorStop(0,    'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + (a * 0.35) + ')');
          g.addColorStop(0.35, 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + (a * 0.10) + ')');
          g.addColorStop(1,    'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',0)');
          ctx.fillStyle = g;
          ctx.beginPath();
          ctx.arc(px, py, haloR, 0, Math.PI * 2);
          ctx.fill();
        }

        // Core disk
        ctx.fillStyle =
          'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + a + ')';
        ctx.beginPath();
        ctx.arc(px, py, s.r, 0, Math.PI * 2);
        ctx.fill();
      }

      // Shooting stars — spawn and animate. Suppressed under reduced-motion.
      if (!prefersReducedMotion) {
        if (t >= nextMeteorAt) {
          spawnMeteor();
          scheduleNextMeteor(t);
        }
        for (var m = meteors.length - 1; m >= 0; m--) {
          var me = meteors[m];
          me.age += dt;
          me.x += me.vx * dt;
          me.y += me.vy * dt;
          // Life envelope: fade in fast, hold, fade out.
          var k = me.age / me.life;
          if (k >= 1
              || me.x > cssW + 100 || me.y > cssH + 100
              || me.x < -200 || me.y < -200) {
            meteors.splice(m, 1);
            continue;
          }
          var envelope =
              k < 0.12 ? (k / 0.12) :
              k > 0.75 ? (1 - (k - 0.75) / 0.25) : 1;

          // Trail = a tapered streak behind the head, opposite of velocity.
          var len = 220 * me.lenScale;
          var ux = -me.vx, uy = -me.vy;
          var mag = Math.sqrt(ux * ux + uy * uy) || 1;
          ux /= mag; uy /= mag;
          var tailX = me.x + ux * len;
          var tailY = me.y + uy * len;

          var col = me.tint;
          var headRgb = 'rgba(' + col[0] + ',' + col[1] + ',' + col[2] + ',';

          var grad = ctx.createLinearGradient(me.x, me.y, tailX, tailY);
          grad.addColorStop(0,    headRgb + (0.95 * envelope) + ')');
          grad.addColorStop(0.25, headRgb + (0.55 * envelope) + ')');
          grad.addColorStop(1,    headRgb + '0)');
          ctx.strokeStyle = grad;
          ctx.lineWidth = 1.8;
          ctx.lineCap = 'round';
          ctx.beginPath();
          ctx.moveTo(me.x, me.y);
          ctx.lineTo(tailX, tailY);
          ctx.stroke();

          // Bright head glow
          var hr = 6;
          var hg = ctx.createRadialGradient(me.x, me.y, 0, me.x, me.y, hr * 3);
          hg.addColorStop(0,   headRgb + (0.95 * envelope) + ')');
          hg.addColorStop(0.4, headRgb + (0.35 * envelope) + ')');
          hg.addColorStop(1,   headRgb + '0)');
          ctx.fillStyle = hg;
          ctx.beginPath();
          ctx.arc(me.x, me.y, hr * 3, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      window.requestAnimationFrame(frame);
    }

    // Kick off
    window.requestAnimationFrame(function (now) {
      frame(now);
      // Fade canvas in once first frame is on screen
      canvas.classList.add('is-ready');
    });

    // Pause when tab hidden — save battery, no off-screen work
    document.addEventListener('visibilitychange', function () {
      if (document.hidden) {
        running = false;
      } else if (!running) {
        running = true;
        lastT = performance.now();
        window.requestAnimationFrame(frame);
      }
    });

    // Reduced motion: render exactly one frame, then stop.
    if (prefersReducedMotion) {
      running = false;
      // Still need a static paint — schedule one and exit.
      window.requestAnimationFrame(function (now) {
        running = true;
        frame(now);
        running = false;
        canvas.classList.add('is-ready');
      });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once: true });
  } else {
    start();
  }
})();
