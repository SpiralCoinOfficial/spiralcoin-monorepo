/* SpiralCoin · live-wire.js
 *
 * Glue layer: scans the DOM for [data-sym][data-field] elements and wires
 * them to the right data source.
 *
 *   Crypto (BTC, ETH, SOL, BNB, XRP, DOGE, ADA, AVAX, MATIC, LINK, DOT, LTC,
 *           ATOM, NEAR, FIL, APT, ARB, OP, INJ, SUI, TRX, BCH, ETC, XLM, ...)
 *     -> Binance.us miniTicker WebSocket (~1 Hz price, 24h change pct)
 *        Real-time. Free. Push-based.
 *
 *   Stocks (AAPL, TSLA, MSFT, GOOGL, AMZN, NVDA, META, etc.)
 *     -> /api/polygon.php?op=quote  (server-side proxied Polygon Basic)
 *        End-of-day close + prev-day close. Polled once at load, then every
 *        15 min (free Polygon plan = 5 calls/min hard cap shared with whole
 *        site, so this is conservative).
 *
 *   Indices / treasuries (SPX, NDX, DJI, US10Y, US30Y, VIX)
 *     -> Marked "Pro tier" / em-dash placeholder until plan upgrade.
 *
 * Compliance: market data is indicative only. Stock data is end-of-day on
 * the current data plan. "Trading involves risk. Past performance does not
 * guarantee future results."
 */
(function () {
  'use strict';
  if (window.__SPLC_LIVE_WIRE__) return;
  window.__SPLC_LIVE_WIRE__ = true;

  // ---------- symbol classification ---------------------------------------
  var CRYPTO = {
    BTC:'BTCUSDT', ETH:'ETHUSDT', SOL:'SOLUSDT', BNB:'BNBUSDT', XRP:'XRPUSDT',
    DOGE:'DOGEUSDT', ADA:'ADAUSDT', AVAX:'AVAXUSDT', MATIC:'MATICUSDT',
    LINK:'LINKUSDT', DOT:'DOTUSDT', LTC:'LTCUSDT', ATOM:'ATOMUSDT',
    NEAR:'NEARUSDT', FIL:'FILUSDT', APT:'APTUSDT', ARB:'ARBUSDT',
    OP:'OPUSDT', INJ:'INJUSDT', SUI:'SUIUSDT', TRX:'TRXUSDT',
    BCH:'BCHUSDT', ETC:'ETCUSDT', XLM:'XLMUSDT', ICP:'ICPUSDT'
  };
  // Indices/treasuries require Polygon Indices plan -> placeholder for now.
  var PRO_ONLY = { SPX:1, NDX:1, DJI:1, VIX:1, US10Y:1, US30Y:1, US02Y:1 };

  // Everything else (alpha tickers 1-5 chars) treated as stock/ETF via Polygon.

  // ---------- formatting --------------------------------------------------
  function fmtPrice(p, sym) {
    if (p === null || p === undefined || !isFinite(p)) return '—';
    if (p >= 1000) return '$' + p.toLocaleString('en-US', { maximumFractionDigits: 2 });
    if (p >= 1)    return '$' + p.toFixed(2);
    if (p >= 0.01) return '$' + p.toFixed(4);
    return '$' + p.toPrecision(4);
  }
  function fmtChg(pct) {
    if (pct === null || pct === undefined || !isFinite(pct)) return '—';
    var s = (pct >= 0 ? '+' : '') + pct.toFixed(2) + '%';
    return s;
  }

  // ---------- DOM application --------------------------------------------
  var nodeIndex = {}; // sym -> { price:[el,...], chg:[el,...] }

  function indexNodes() {
    nodeIndex = {};
    var els = document.querySelectorAll('[data-sym][data-field]');
    for (var i = 0; i < els.length; i++) {
      var el = els[i];
      var sym = (el.getAttribute('data-sym') || '').toUpperCase();
      var fld = (el.getAttribute('data-field') || '').toLowerCase();
      if (!sym || !fld) continue;
      if (!nodeIndex[sym]) nodeIndex[sym] = { price: [], chg: [] };
      if (fld === 'price') nodeIndex[sym].price.push(el);
      else if (fld === 'chg' || fld === 'change' || fld === 'pct') nodeIndex[sym].chg.push(el);
    }
  }

  function apply(sym, price, chgPct) {
    var bag = nodeIndex[sym];
    if (!bag) return;
    var pTxt = fmtPrice(price, sym);
    for (var i = 0; i < bag.price.length; i++) {
      var pe = bag.price[i];
      if (pe.textContent !== pTxt) pe.textContent = pTxt;
    }
    // Skip chg update if caller didn't have a value yet — avoids
    // resetting the % column to "—" on every per-trade price tick
    // when the matching miniTicker hasn't arrived yet.
    if (chgPct === undefined || chgPct === null) return;
    var cTxt = fmtChg(chgPct);
    for (var j = 0; j < bag.chg.length; j++) {
      var ce = bag.chg[j];
      if (ce.textContent !== cTxt) ce.textContent = cTxt;
      ce.classList.remove('up','down');
      if (chgPct > 0) ce.classList.add('up');
      else if (chgPct < 0) ce.classList.add('down');
    }
  }

  function applyPlaceholder(sym, label) {
    var bag = nodeIndex[sym];
    if (!bag) return;
    for (var i = 0; i < bag.price.length; i++) {
      bag.price[i].textContent = label;
      bag.price[i].title = 'Available in SpiralCoin Pro (real-time indices)';
      bag.price[i].style.opacity = '0.55';
    }
    for (var j = 0; j < bag.chg.length; j++) {
      bag.chg[j].textContent = '';
    }
  }

  // ---------- crypto via Binance WS --------------------------------------
  // We subscribe to TWO streams per symbol:
  //   * @trade        -> fires on every executed trade (many per second).
  //                      Used to update the displayed PRICE in real time.
  //   * @miniTicker   -> fires ~1 Hz with rolling 24h stats. Used for the
  //                      24h CHANGE % only (which only moves on the 1s tick).
  // Splitting them this way makes the price visibly tick every second
  // (often several times per second) instead of looking static.
  function wireCrypto() {
    if (!window.SpiralLive ||
        typeof window.SpiralLive.onTrades   !== 'function' ||
        typeof window.SpiralLive.onMiniTicker !== 'function') {
      console.warn('[SpiralLive] live-feed.js missing; skipping crypto wire');
      return;
    }
    var lastChg = Object.create(null); // remember last % per symbol
    var syms = Object.keys(nodeIndex).filter(function (s) { return CRYPTO[s]; });
    syms.forEach(function (sym) {
      var pair = CRYPTO[sym];
      // Per-trade tick — drives the visible price movement.
      window.SpiralLive.onTrades(pair, function (t) {
        window.SpiralLive.paint('tr:' + sym, t, function (p) {
          apply(sym, p.price, lastChg[sym]);
        });
      });
      // Mini-ticker — keeps the 24h % column accurate.
      window.SpiralLive.onMiniTicker(pair, function (d) {
        lastChg[sym] = d.changePct;
        window.SpiralLive.paint('mt:' + sym, d, function (p) {
          apply(sym, p.price, p.changePct);
        });
      });
    });
  }

  // ---------- stocks via Polygon proxy -----------------------------------
  // Polygon Basic plan: 5 calls/min site-wide. With ~6 stock tickers and 15-min
  // refresh that's 6/15 = 0.4 calls/min -> safe.
  var POLY_REFRESH_MS = 15 * 60 * 1000;
  var POLY_STAGGER_MS = 1500; // space requests on initial load

  function isStockSym(sym) {
    if (CRYPTO[sym]) return false;
    if (PRO_ONLY[sym]) return false;
    return /^[A-Z]{1,5}$/.test(sym);
  }

  function pollStock(sym) {
    var url = '/api/polygon.php?op=quote&symbol=' + encodeURIComponent(sym);
    fetch(url, { credentials: 'omit' })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (j) {
        if (!j || j.price == null) return;
        var price = +j.price;
        var open  = +j.open;
        var pct   = (isFinite(open) && open > 0) ? ((price - open) / open) * 100 : null;
        apply(sym, price, pct);
      })
      .catch(function () { /* silent; will retry next interval */ });
  }

  function wireStocks() {
    var syms = Object.keys(nodeIndex).filter(isStockSym);
    syms.forEach(function (sym, i) {
      setTimeout(function () { pollStock(sym); }, i * POLY_STAGGER_MS);
      setInterval(function () { pollStock(sym); }, POLY_REFRESH_MS + i * 1000);
    });
  }

  function wirePlaceholders() {
    Object.keys(nodeIndex).forEach(function (sym) {
      if (PRO_ONLY[sym]) applyPlaceholder(sym, 'Pro');
    });
  }

  // ---------- boot --------------------------------------------------------
  function boot() {
    indexNodes();
    if (!Object.keys(nodeIndex).length) return;
    console.info('%c[SpiralLive] wire boot · ' + Object.keys(nodeIndex).length + ' symbols',
                 'color:#c9a227;font-weight:bold');
    wireCrypto();
    wireStocks();
    wirePlaceholders();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
})();
