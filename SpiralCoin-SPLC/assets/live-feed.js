/* SpiralCoin · live-feed.js
 * Shared WebSocket manager for real-time market data.
 *
 * Design notes (read this before "speeding it up"):
 *  - Binance free REST is hard-capped ~20 req/sec PER IP across the whole site.
 *    Polling at 20 Hz would IP-ban us instantly. Instead we subscribe to push
 *    streams: @trade pushes every executed trade (typically 20-100/sec on
 *    BTCUSDT), @kline_<tf> pushes the in-progress candle, @miniTicker pushes
 *    24h stats every ~1s.
 *  - DOM/canvas repaints are throttled via requestAnimationFrame to ~60 fps
 *    (or whatever the monitor supports). The data buffer fills at full speed;
 *    the paint loop drains the latest value. This is the right pattern for
 *    a "live, smooth" feel without melting CPU.
 *  - Browser tabs throttle JS in the background, so the live update rate only
 *    applies to the active tab. That's a platform constraint, not a bug.
 *  - All claims rendered next to live data should remain framed as indicative
 *    market data, not investment advice.
 *
 * Compliance: Trading involves risk. Past performance does not guarantee
 * future results. Real-time data shown is indicative and may differ from
 * execution-venue prices.
 */
(function (global) {
  'use strict';

  var BINANCE_WS = 'wss://stream.binance.us:9443/stream';
  var BINANCE_REST = 'https://api.binance.us';
  var MAX_BACKOFF_MS = 30000;

  // ---- internal state ------------------------------------------------------
  var socket = null;
  var connected = false;
  var reconnectAttempts = 0;
  var streams = Object.create(null); // streamName -> [callback, ...]
  var statusListeners = [];
  var rafScheduled = false;
  var pendingPaints = Object.create(null); // key -> latest payload

  function setStatus(s) {
    statusListeners.forEach(function (fn) {
      try { fn(s); } catch (e) { /* ignore */ }
    });
  }

  function connect() {
    if (socket && (socket.readyState === 0 || socket.readyState === 1)) return;
    var streamList = Object.keys(streams);
    if (streamList.length === 0) return;
    var url = BINANCE_WS + '?streams=' + streamList.join('/');
    setStatus('connecting');
    try {
      socket = new WebSocket(url);
    } catch (e) {
      scheduleReconnect();
      return;
    }
    socket.onopen = function () {
      connected = true;
      reconnectAttempts = 0;
      setStatus('live');
    };
    socket.onmessage = function (evt) {
      var msg;
      try { msg = JSON.parse(evt.data); } catch (e) { return; }
      var stream = msg.stream;
      var data = msg.data;
      if (!stream || !data) return;
      var cbs = streams[stream];
      if (!cbs) return;
      for (var i = 0; i < cbs.length; i++) {
        try { cbs[i](data); } catch (e) { /* swallow per-subscriber */ }
      }
    };
    socket.onclose = function () {
      connected = false;
      setStatus('offline');
      scheduleReconnect();
    };
    socket.onerror = function () {
      setStatus('offline');
      try { socket.close(); } catch (e) { /* noop */ }
    };
  }

  function scheduleReconnect() {
    reconnectAttempts++;
    var delay = Math.min(MAX_BACKOFF_MS, 500 * Math.pow(2, Math.min(reconnectAttempts, 6)));
    setStatus('reconnecting');
    setTimeout(connect, delay);
  }

  function rebuildSocket() {
    // Binance combined streams are set at connection time, so to add/remove
    // streams cleanly we tear down and reconnect.
    if (socket) {
      try { socket.onclose = null; socket.close(); } catch (e) { /* noop */ }
      socket = null;
    }
    connect();
  }

  // ---- public API ----------------------------------------------------------

  /**
   * Subscribe to a Binance combined stream.
   * @param {string} stream  e.g. "btcusdt@trade", "ethusdt@kline_4h"
   * @param {function} cb    called with the raw payload object
   * @returns {function} unsubscribe
   */
  function subscribe(stream, cb) {
    stream = String(stream).toLowerCase();
    if (!streams[stream]) streams[stream] = [];
    streams[stream].push(cb);
    if (Object.keys(streams).length === 1 || !connected) {
      rebuildSocket();
    } else {
      // Reconnect to pick up the new stream in the combined URL.
      rebuildSocket();
    }
    return function unsubscribe() {
      var list = streams[stream];
      if (!list) return;
      var idx = list.indexOf(cb);
      if (idx >= 0) list.splice(idx, 1);
      if (list.length === 0) {
        delete streams[stream];
        if (Object.keys(streams).length === 0 && socket) {
          try { socket.close(); } catch (e) { /* noop */ }
          socket = null;
        } else {
          rebuildSocket();
        }
      }
    };
  }

  /**
   * Subscribe to socket status changes. Calls fn('live'|'reconnecting'|'offline'|'connecting').
   * @returns {function} unsubscribe
   */
  function onStatus(fn) {
    statusListeners.push(fn);
    return function () {
      var idx = statusListeners.indexOf(fn);
      if (idx >= 0) statusListeners.splice(idx, 1);
    };
  }

  /**
   * Coalesce high-frequency paint requests to the browser's vsync.
   * Same key => only the latest payload is painted per frame.
   * @param {string} key
   * @param {*} payload
   * @param {function} paintFn  receives the latest payload
   */
  function paint(key, payload, paintFn) {
    pendingPaints[key] = { p: payload, fn: paintFn };
    if (rafScheduled) return;
    rafScheduled = true;
    requestAnimationFrame(function () {
      rafScheduled = false;
      var snapshot = pendingPaints;
      pendingPaints = Object.create(null);
      for (var k in snapshot) {
        if (!Object.prototype.hasOwnProperty.call(snapshot, k)) continue;
        var entry = snapshot[k];
        try { entry.fn(entry.p); } catch (e) { /* per-paint isolation */ }
      }
    });
  }

  /**
   * Convenience: subscribe to per-trade ticks for a symbol.
   * Callback receives {price, qty, ts, isBuy}.
   */
  function onTrades(symbol, cb) {
    return subscribe(symbol.toLowerCase() + '@trade', function (d) {
      cb({
        price: parseFloat(d.p),
        qty: parseFloat(d.q),
        ts: d.T,
        isBuy: !d.m
      });
    });
  }

  /**
   * Convenience: subscribe to the live in-progress candle for a symbol/interval.
   * Callback receives {time, open, high, low, close, volume, closed}.
   */
  function onKline(symbol, interval, cb) {
    return subscribe(symbol.toLowerCase() + '@kline_' + interval, function (d) {
      var k = d.k;
      cb({
        time: Math.floor(k.t / 1000),
        open: parseFloat(k.o),
        high: parseFloat(k.h),
        low: parseFloat(k.l),
        close: parseFloat(k.c),
        volume: parseFloat(k.v),
        closed: !!k.x
      });
    });
  }

  /**
   * Convenience: subscribe to 24h rolling mini-ticker (~1 Hz) for a symbol.
   * Callback receives {price, open, high, low, volume, changePct}.
   */
  function onMiniTicker(symbol, cb) {
    return subscribe(symbol.toLowerCase() + '@miniTicker', function (d) {
      var open = parseFloat(d.o);
      var close = parseFloat(d.c);
      cb({
        price: close,
        open: open,
        high: parseFloat(d.h),
        low: parseFloat(d.l),
        volume: parseFloat(d.v),
        changePct: open > 0 ? ((close - open) / open) * 100 : 0
      });
    });
  }

  /**
   * Render a status pill into a container element.
   * Adds: green=live, amber=reconnecting/connecting, red=offline.
   */
  function attachStatusPill(el) {
    if (!el) return function () {};
    el.style.display = 'inline-flex';
    el.style.alignItems = 'center';
    el.style.gap = '6px';
    el.style.fontSize = '0.7rem';
    el.style.fontFamily = 'IBM Plex Mono, monospace';
    el.style.color = '#7a8fa8';
    var dot = document.createElement('span');
    dot.style.width = '8px';
    dot.style.height = '8px';
    dot.style.borderRadius = '50%';
    dot.style.background = '#4a5568';
    dot.style.transition = 'background .2s, box-shadow .2s';
    var label = document.createElement('span');
    label.textContent = 'connecting';
    el.appendChild(dot);
    el.appendChild(label);
    var map = {
      live:         { c: '#00c97a', t: 'live',         glow: '0 0 8px rgba(0,201,122,.6)' },
      connecting:   { c: '#c9a227', t: 'connecting',   glow: 'none' },
      reconnecting: { c: '#c9a227', t: 'reconnecting', glow: 'none' },
      offline:      { c: '#ff3d5a', t: 'offline',      glow: 'none' }
    };
    return onStatus(function (s) {
      var m = map[s] || map.offline;
      dot.style.background = m.c;
      dot.style.boxShadow = m.glow;
      label.textContent = m.t;
    });
  }

  /**
   * One-shot REST fetch of historical klines. Use ONLY at page-load to seed
   * a chart; never poll this on a timer.
   */
  function fetchKlines(symbol, interval, limit) {
    var url = BINANCE_REST + '/api/v3/klines?symbol=' + symbol.toUpperCase() +
              '&interval=' + interval + '&limit=' + (limit || 500);
    return fetch(url).then(function (r) { return r.json(); }).then(function (raw) {
      return raw.map(function (k) {
        return {
          time: Math.floor(k[0] / 1000),
          open: +k[1], high: +k[2], low: +k[3], close: +k[4],
          volume: +k[5]
        };
      });
    });
  }

  // ---- on-chain (Alchemy / Infura WSS) ------------------------------------
  // ERC-20 Transfer(address,address,uint256) topic
  var TRANSFER_TOPIC = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';

  var chainSockets = Object.create(null); // chainKey -> {ws, subId, queue}
  var chainReqId = 1;

  function chainEndpoint(chainKey) {
    var cfg = global.SPIRAL_LIVE_CONFIG || {};
    var prefer = (cfg.preferredProvider || 'auto');
    var a = (cfg.alchemy || {})[chainKey];
    var i = (cfg.infura || {})[chainKey];
    if (prefer === 'alchemy') return a || i;
    if (prefer === 'infura')  return i || a;
    return a || i;
  }

  function openChain(chainKey) {
    if (chainSockets[chainKey]) return chainSockets[chainKey];
    var url = chainEndpoint(chainKey);
    if (!url) return null;
    var state = { ws: null, subs: [], attempts: 0, alive: false };
    chainSockets[chainKey] = state;

    function connectChain() {
      try { state.ws = new WebSocket(url); } catch (e) { reconnectChain(); return; }
      state.ws.onopen = function () {
        state.alive = true;
        state.attempts = 0;
        // Re-subscribe all existing filters
        state.subs.forEach(function (s) { sendSubscribe(s); });
      };
      state.ws.onmessage = function (evt) {
        var msg; try { msg = JSON.parse(evt.data); } catch (e) { return; }
        if (msg.method === 'eth_subscription' && msg.params) {
          var subId = msg.params.subscription;
          var sub = state.subs.find(function (s) { return s.subId === subId; });
          if (sub) { try { sub.cb(msg.params.result); } catch (e) {} }
        } else if (msg.id && msg.result && typeof msg.result === 'string') {
          var pending = state.subs.find(function (s) { return s.reqId === msg.id; });
          if (pending) pending.subId = msg.result;
        }
      };
      state.ws.onclose = function () { state.alive = false; reconnectChain(); };
      state.ws.onerror = function () { try { state.ws.close(); } catch (e) {} };
    }
    function reconnectChain() {
      state.attempts++;
      var delay = Math.min(MAX_BACKOFF_MS, 500 * Math.pow(2, Math.min(state.attempts, 6)));
      setTimeout(connectChain, delay);
    }
    function sendSubscribe(s) {
      if (!state.alive) return;
      s.reqId = chainReqId++;
      try {
        state.ws.send(JSON.stringify({
          jsonrpc: '2.0', id: s.reqId, method: 'eth_subscribe',
          params: ['logs', { address: s.address, topics: s.topics }]
        }));
      } catch (e) { /* will retry on reconnect */ }
    }
    state._send = sendSubscribe;
    connectChain();
    return state;
  }

  /**
   * Subscribe to on-chain logs via Alchemy/Infura WSS.
   * @param {string} chainKey  e.g. 'sepolia', 'arbSepolia'
   * @param {string} address   contract address
   * @param {string[]} topics  topic filter (e.g. [TRANSFER_TOPIC])
   * @param {function} cb      called with the raw log object
   */
  function onChainLogs(chainKey, address, topics, cb) {
    var state = openChain(chainKey);
    if (!state) return function () {};
    var entry = {
      address: address, topics: topics, cb: cb,
      subId: null, reqId: null
    };
    state.subs.push(entry);
    if (state.alive) state._send(entry);
    return function unsubscribe() {
      var idx = state.subs.indexOf(entry);
      if (idx >= 0) state.subs.splice(idx, 1);
      if (entry.subId && state.alive) {
        try {
          state.ws.send(JSON.stringify({
            jsonrpc: '2.0', id: chainReqId++,
            method: 'eth_unsubscribe', params: [entry.subId]
          }));
        } catch (e) {}
      }
    };
  }

  /**
   * Convenience: subscribe to ERC-20 Transfer events for the SPLC token on a chain.
   * Reads contract address from SPIRAL_LIVE_CONFIG.splc[chainKey].token.
   * Callback receives {from, to, value (BigInt-string), txHash, blockNumber}.
   */
  function onSplcTransfers(chainKey, cb) {
    var cfg = global.SPIRAL_LIVE_CONFIG || {};
    var addr = ((cfg.splc || {})[chainKey] || {}).token;
    if (!addr) return function () {};
    return onChainLogs(chainKey, addr, [TRANSFER_TOPIC], function (log) {
      // topics: [sig, from(32), to(32)]; data = uint256 value
      var t = log.topics || [];
      var from = t[1] ? ('0x' + t[1].slice(26)) : null;
      var to   = t[2] ? ('0x' + t[2].slice(26)) : null;
      cb({
        from: from, to: to,
        value: log.data || '0x0',
        txHash: log.transactionHash,
        blockNumber: log.blockNumber
      });
    });
  }

  global.SpiralLive = {
    subscribe: subscribe,
    unsubscribe: function (stream, cb) {
      var list = streams[stream];
      if (!list) return;
      var idx = list.indexOf(cb);
      if (idx >= 0) list.splice(idx, 1);
    },
    onTrades: onTrades,
    onKline: onKline,
    onMiniTicker: onMiniTicker,
    onStatus: onStatus,
    paint: paint,
    attachStatusPill: attachStatusPill,
    fetchKlines: fetchKlines,
    onChainLogs: onChainLogs,
    onSplcTransfers: onSplcTransfers,
    TRANSFER_TOPIC: TRANSFER_TOPIC,
    config: function () { return global.SPIRAL_LIVE_CONFIG || {}; }
  };
})(typeof window !== 'undefined' ? window : this);
