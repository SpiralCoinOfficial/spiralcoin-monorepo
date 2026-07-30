/* ============================================================
   SpiralCoin live cosmos
   Photoreal animated deep-space backdrop.
   - Canvas covers the viewport (position:fixed, z-index:-1)
   - ~600 stars with depth-sorted parallax + per-star twinkle
   - 4 procedural nebula clouds (depth-sorted, drifting)
   - One large spiral galaxy with rotating arms
   - Random meteor streaks
   - Auto-pauses when tab is hidden or user prefers reduced motion
   - Auto-degrades on small / low-DPI / low-RAM devices
   ============================================================ */
(function () {
  'use strict';

  console.info('%c[SpiralCoin] cosmos boot v2', 'color:#c9a227;font-weight:bold');

  // ---- Reduced motion: keep the cosmos still (still visible) ----
  var REDUCED = window.matchMedia &&
                window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ---- Build the canvas ----
  var c = document.createElement('canvas');
  c.id = 'splc-cosmos';
  c.style.cssText =
    'position:fixed;inset:0;width:100vw;height:100vh;' +
    'z-index:-1;pointer-events:none;display:block;' +
    'background:radial-gradient(ellipse at 50% 45%,' +
      '#0a0a22 0%,#04051a 45%,#01020a 80%,#000004 100%);';
  // Insert as first child of body so existing content sits above
  function attach() {
    if (!document.body) return;
    document.body.insertBefore(c, document.body.firstChild);
    init();
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', attach, { once: true });
  } else { attach(); }

  var ctx, W, H, DPR, running = true, t0 = performance.now();

  // ----------------- Scene objects -----------------
  var stars = [];        // background star field
  var bigStars = [];     // foreground bright stars with diffraction spikes
  var nebulae = [];      // soft glowing clouds
  var meteors = [];      // streaks
  var galaxy;            // single hero spiral
  var farGalaxies = [];  // tiny background galaxies

  function rand(a, b) { return a + Math.random() * (b - a); }
  function pick(arr) { return arr[(Math.random() * arr.length) | 0]; }

  // ----------------- Init / resize -----------------
  function size() {
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    W = c.clientWidth = window.innerWidth;
    H = c.clientHeight = window.innerHeight;
    c.width  = (W * DPR) | 0;
    c.height = (H * DPR) | 0;
    ctx = c.getContext('2d');
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  }

  function init() {
    size();

    // Star count scaled by viewport area so phones don't melt
    var area = W * H;
    var STAR_COUNT = Math.max(200, Math.min(900, (area / 2200) | 0));

    // B-V colour palette: blue-white, white, yellow-white, amber, red dwarf
    var palette = [
      'rgba(178,210,255,', // O/B - hot blue
      'rgba(220,235,255,', // A - blue-white
      'rgba(255,255,240,', // F/G - white-yellow (sun-like)
      'rgba(255,220,170,', // K - amber
      'rgba(255,170,130,'  // M - cool red
    ];

    stars.length = 0;
    for (var i = 0; i < STAR_COUNT; i++) {
      var depth = Math.random();               // 0=far, 1=near
      stars.push({
        x: Math.random() * W,
        y: Math.random() * H,
        r: 0.3 + depth * depth * 1.6,          // bigger when near
        c: pick(palette),                       // colour family
        a: 0.35 + depth * 0.65,                // brightness
        tw: rand(0.5, 2.5),                    // twinkle speed
        ph: Math.random() * Math.PI * 2,       // twinkle phase
        z: depth                                // parallax depth
      });
    }

    // Bright foreground stars w/ diffraction spikes (cinematic)
    bigStars.length = 0;
    var BIG = Math.max(6, Math.min(14, (area / 160000) | 0));
    for (var b = 0; b < BIG; b++) {
      bigStars.push({
        x: Math.random() * W,
        y: Math.random() * H,
        r: rand(1.6, 3.2),
        c: pick(palette),
        ph: Math.random() * Math.PI * 2,
        tw: rand(0.6, 1.6),
        spk: rand(14, 28)                       // spike length
      });
    }

    // Procedural nebula clouds (soft radial gradients we re-blit)
    nebulae.length = 0;
    var nebColors = [
      ['255,90,120', '120,30,80'],   // hydrogen-alpha red/magenta
      ['80,180,255', '20,60,150'],   // oxygen-III blue/cyan
      ['255,170,80', '160,80,30'],   // sulfur orange
      ['180,100,255', '60,20,120']   // violet
    ];
    var NEB = 4;
    for (var n = 0; n < NEB; n++) {
      var col = nebColors[n % nebColors.length];
      nebulae.push({
        x: Math.random() * W,
        y: Math.random() * H,
        rx: rand(W * 0.25, W * 0.55),
        ry: rand(H * 0.2,  H * 0.5),
        rot: Math.random() * Math.PI * 2,
        c1: col[0],
        c2: col[1],
        a: rand(0.18, 0.38),
        vx: rand(-0.04, 0.04),
        vy: rand(-0.03, 0.03)
      });
    }

    // Tiny far-distance galaxies (just elliptical glows)
    farGalaxies.length = 0;
    var FG = 5;
    for (var g = 0; g < FG; g++) {
      farGalaxies.push({
        x: Math.random() * W,
        y: Math.random() * H,
        rx: rand(20, 60),
        ry: rand(8, 22),
        rot: Math.random() * Math.PI,
        a: rand(0.25, 0.55)
      });
    }

    // Hero spiral galaxy
    galaxy = buildGalaxy();

    meteors.length = 0;
  }

  // Build the hero spiral galaxy data (positions of HII regions + dust lanes)
  function buildGalaxy() {
    // Place hero galaxy at roughly 70% across, 38% down for cinematic comp
    var cx = W * 0.72;
    var cy = H * 0.38;
    var radius = Math.min(W, H) * 0.42;

    // 4 logarithmic spiral arms — pre-compute thousands of star points
    var arms = 4;
    var pts = [];
    var armStars = 1800;
    for (var i = 0; i < armStars; i++) {
      var arm = i % arms;
      // theta from 0 to ~3*PI (1.5 turns)
      var theta = (i / armStars) * Math.PI * 3.2 + (arm * Math.PI * 2 / arms);
      // logarithmic radial growth
      var r = 0.06 * Math.exp(0.22 * theta) * radius;
      if (r > radius) continue;
      // Scatter perpendicular to arm
      var scatter = (Math.random() - 0.5) * radius * 0.08 * (1 - r / radius * 0.4);
      var x = Math.cos(theta) * r + Math.cos(theta + Math.PI / 2) * scatter;
      var y = Math.sin(theta) * r * 0.6 + Math.sin(theta + Math.PI / 2) * scatter * 0.6; // squash for tilt
      pts.push({ x: x, y: y, b: Math.random(), col: Math.random() });
    }

    return {
      cx: cx,
      cy: cy,
      r: radius,
      tilt: -0.32,        // ~ -18 deg
      pts: pts,
      angle: 0            // rotates over time
    };
  }

  window.addEventListener('resize', function () {
    if (!ctx) return;
    init();
  });

  // ----------------- Render loop -----------------
  function drawNebula(n, time) {
    // Drift
    n.x += n.vx; n.y += n.vy;
    if (n.x < -n.rx) n.x = W + n.rx;
    if (n.x > W + n.rx) n.x = -n.rx;
    if (n.y < -n.ry) n.y = H + n.ry;
    if (n.y > H + n.ry) n.y = -n.ry;

    ctx.save();
    ctx.translate(n.x, n.y);
    ctx.rotate(n.rot + time * 0.00002);
    var g = ctx.createRadialGradient(0, 0, 0, 0, 0, Math.max(n.rx, n.ry));
    g.addColorStop(0,    'rgba(' + n.c1 + ',' + (n.a)        + ')');
    g.addColorStop(0.45, 'rgba(' + n.c2 + ',' + (n.a * 0.45) + ')');
    g.addColorStop(1,    'rgba(' + n.c2 + ',0)');
    ctx.globalCompositeOperation = 'lighter';   // additive light
    ctx.fillStyle = g;
    ctx.scale(n.rx / Math.max(n.rx, n.ry), n.ry / Math.max(n.rx, n.ry));
    ctx.beginPath();
    ctx.arc(0, 0, Math.max(n.rx, n.ry), 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawFarGalaxy(g) {
    ctx.save();
    ctx.translate(g.x, g.y);
    ctx.rotate(g.rot);
    var grd = ctx.createRadialGradient(0, 0, 0, 0, 0, g.rx);
    grd.addColorStop(0,   'rgba(255,240,210,' + g.a + ')');
    grd.addColorStop(0.4, 'rgba(255,200,150,' + (g.a * 0.5) + ')');
    grd.addColorStop(1,   'rgba(180,140,255,0)');
    ctx.fillStyle = grd;
    ctx.globalCompositeOperation = 'lighter';
    ctx.scale(1, g.ry / g.rx);
    ctx.beginPath();
    ctx.arc(0, 0, g.rx, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawHeroGalaxy(time) {
    var gx = galaxy;
    if (REDUCED) {
      gx.angle = 0;
    } else {
      // Real spiral galaxies rotate VERY slowly. We exaggerate slightly
      // so the motion is perceivable but never distracting.
      gx.angle = time * 0.000018;
    }

    ctx.save();
    ctx.translate(gx.cx, gx.cy);
    ctx.rotate(gx.tilt);
    ctx.rotate(gx.angle);

    // ---- Halo + outer glow ----
    var halo = ctx.createRadialGradient(0, 0, 0, 0, 0, gx.r * 1.1);
    halo.addColorStop(0,    'rgba(255,220,180,0.35)');
    halo.addColorStop(0.18, 'rgba(220,180,255,0.20)');
    halo.addColorStop(0.55, 'rgba(80,90,180,0.08)');
    halo.addColorStop(1,    'rgba(20,10,60,0)');
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = halo;
    ctx.beginPath();
    ctx.ellipse(0, 0, gx.r * 1.1, gx.r * 0.7, 0, 0, Math.PI * 2);
    ctx.fill();

    // ---- Spiral arms: drawn as thousands of HII region points ----
    var pts = gx.pts, p, col;
    for (var i = 0; i < pts.length; i++) {
      p = pts[i];
      // Distance from core for color grading: hot blue arms, warm core
      var d = Math.sqrt(p.x * p.x + p.y * p.y) / gx.r;
      var brightness = (1 - d * 0.7) * (0.5 + p.b * 0.5);
      if (brightness <= 0) continue;
      if (d < 0.18) {
        col = 'rgba(255,240,200,';        // bright warm core
      } else if (p.col < 0.35) {
        col = 'rgba(180,210,255,';        // hot blue arm
      } else if (p.col < 0.7) {
        col = 'rgba(255,200,140,';        // amber dust
      } else {
        col = 'rgba(255,120,150,';        // pink HII region
      }
      ctx.fillStyle = col + (brightness * 0.65) + ')';
      ctx.fillRect(p.x, p.y, 1.4, 1.4);
    }

    // ---- Bright core ----
    var core = ctx.createRadialGradient(0, 0, 0, 0, 0, gx.r * 0.22);
    core.addColorStop(0,    'rgba(255,250,220,1)');
    core.addColorStop(0.18, 'rgba(255,220,150,0.9)');
    core.addColorStop(0.55, 'rgba(255,160,80,0.35)');
    core.addColorStop(1,    'rgba(80,40,80,0)');
    ctx.fillStyle = core;
    ctx.beginPath();
    ctx.ellipse(0, 0, gx.r * 0.22, gx.r * 0.18, 0, 0, Math.PI * 2);
    ctx.fill();

    // ---- Tiny nucleus point ----
    ctx.fillStyle = 'rgba(255,255,240,0.95)';
    ctx.beginPath();
    ctx.arc(0, 0, 2.5, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  function drawStars(time) {
    // Parallax: subtle drift across full sky based on time + depth
    for (var i = 0; i < stars.length; i++) {
      var s = stars[i];
      // Twinkle: per-star sine oscillation of alpha
      var tw = REDUCED ? 1 : (0.6 + 0.4 * Math.sin(time * 0.001 * s.tw + s.ph));
      ctx.fillStyle = s.c + (s.a * tw) + ')';
      // Parallax drift (only meaningful for foreground stars)
      var dx = REDUCED ? 0 : (Math.sin(time * 0.00003) * 6 * s.z);
      var dy = REDUCED ? 0 : (Math.cos(time * 0.00002) * 4 * s.z);
      ctx.beginPath();
      ctx.arc(s.x + dx, s.y + dy, s.r * tw, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawBigStars(time) {
    for (var i = 0; i < bigStars.length; i++) {
      var s = bigStars[i];
      var tw = REDUCED ? 1 : (0.7 + 0.3 * Math.sin(time * 0.0015 * s.tw + s.ph));
      // Bloom
      var bloom = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, s.r * 6);
      bloom.addColorStop(0, s.c + (0.9 * tw) + ')');
      bloom.addColorStop(0.4, s.c + (0.25 * tw) + ')');
      bloom.addColorStop(1, s.c + '0)');
      ctx.fillStyle = bloom;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r * 6, 0, Math.PI * 2);
      ctx.fill();
      // Diffraction spikes (4-point)
      ctx.strokeStyle = s.c + (0.7 * tw) + ')';
      ctx.lineWidth = 0.9;
      ctx.beginPath();
      ctx.moveTo(s.x - s.spk * tw, s.y); ctx.lineTo(s.x + s.spk * tw, s.y);
      ctx.moveTo(s.x, s.y - s.spk * tw); ctx.lineTo(s.x, s.y + s.spk * tw);
      ctx.stroke();
      // Core
      ctx.fillStyle = 'rgba(255,255,255,' + (0.95 * tw) + ')';
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r * tw, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // ----- Meteors -----
  function spawnMeteor() {
    var fromTop = Math.random() < 0.5;
    var len = rand(120, 260);
    var ang = rand(Math.PI * 0.15, Math.PI * 0.35); // shallow diagonal
    meteors.push({
      x:  fromTop ? rand(W * 0.1, W * 0.9) : -20,
      y:  fromTop ? -20 : rand(H * 0.1, H * 0.5),
      vx: Math.cos(ang) * rand(6, 11),
      vy: Math.sin(ang) * rand(6, 11),
      len: len,
      life: 0,
      maxLife: rand(60, 120),
      col: 'rgba(255,240,220,'
    });
  }

  function drawMeteors() {
    for (var i = meteors.length - 1; i >= 0; i--) {
      var m = meteors[i];
      m.x += m.vx; m.y += m.vy; m.life++;
      var fade = 1 - (m.life / m.maxLife);
      if (fade <= 0 || m.x > W + 80 || m.y > H + 80) {
        meteors.splice(i, 1);
        continue;
      }
      // Trail
      var gx = m.x - m.vx * (m.len / 10);
      var gy = m.y - m.vy * (m.len / 10);
      var grd = ctx.createLinearGradient(m.x, m.y, gx, gy);
      grd.addColorStop(0, m.col + (fade) + ')');
      grd.addColorStop(1, m.col + '0)');
      ctx.strokeStyle = grd;
      ctx.lineWidth = 2.4;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(m.x, m.y);
      ctx.lineTo(gx, gy);
      ctx.stroke();
      // Bright head
      ctx.fillStyle = 'rgba(255,255,240,' + fade + ')';
      ctx.beginPath();
      ctx.arc(m.x, m.y, 1.6, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // ----------------- Main animation loop -----------------
  function frame(now) {
    if (!running) return;
    if (!ctx) { requestAnimationFrame(frame); return; }
    var t = now - t0;

    // Clear with deep space colour (gradient lives on the canvas's CSS bg)
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = 'rgba(2,3,12,1)';
    ctx.fillRect(0, 0, W, H);

    // 1. Nebulae behind everything
    for (var i = 0; i < nebulae.length; i++) drawNebula(nebulae[i], t);

    // 2. Far galaxies (background depth)
    for (var f = 0; f < farGalaxies.length; f++) drawFarGalaxy(farGalaxies[f]);

    // 3. Star field
    ctx.globalCompositeOperation = 'lighter';
    drawStars(t);

    // 4. Hero spiral galaxy
    drawHeroGalaxy(t);

    // 5. Bright foreground stars w/ spikes
    drawBigStars(t);

    // 6. Meteors
    ctx.globalCompositeOperation = 'lighter';
    drawMeteors();

    // 7. Occasionally spawn a meteor (~1/sec average)
    if (!REDUCED && Math.random() < 0.012 && meteors.length < 3) spawnMeteor();

    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  // ----- Auto-pause when tab is hidden (saves battery) -----
  document.addEventListener('visibilitychange', function () {
    running = !document.hidden;
    if (running) { t0 = performance.now() - (t0 || 0); requestAnimationFrame(frame); }
  });
})();
