<?php
/**
 * SpiralCoin — Yahoo Finance chart proxy
 *
 * Why this exists:
 *   Direct browser calls to query1.finance.yahoo.com are blocked by CORS, and
 *   the public CORS proxy we used previously (allorigins.win) is rate-limited
 *   and frequently down. This server-side proxy:
 *     - Sends a real browser User-Agent so Yahoo accepts the request
 *     - Caches responses to limit upstream calls
 *     - Restricts ops/symbols to an allow-list (no open passthrough)
 *
 * Front-end calls:
 *   GET /api/yahoo.php?op=chart&symbol=AAPL&interval=1d&range=5d
 *   GET /api/yahoo.php?op=chart&symbol=^GSPC&interval=5m&range=1d
 *
 * Returns: the same JSON shape Yahoo returns, so existing front-end parsers
 * (markets.html) need no schema changes.
 */

declare(strict_types=1);

// ----- CORS / headers (locked to our domain) ---------------------------------
$allowedOrigins = [
    'https://spiralcoin.net',
    'https://www.spiralcoin.net',
];
$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
if (in_array($origin, $allowedOrigins, true)) {
    header('Access-Control-Allow-Origin: ' . $origin);
    header('Vary: Origin');
}
header('Access-Control-Allow-Methods: GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');
header('Content-Type: application/json; charset=utf-8');

if (($_SERVER['REQUEST_METHOD'] ?? '') === 'OPTIONS') {
    http_response_code(204);
    exit;
}

// ----- Referer lock (defense-in-depth) ---------------------------------------
$referer = $_SERVER['HTTP_REFERER'] ?? '';
$refererHost = parse_url($referer, PHP_URL_HOST) ?: '';
$allowedHosts = ['spiralcoin.net', 'www.spiralcoin.net', 'localhost', '127.0.0.1'];
if ($referer !== '' && !in_array($refererHost, $allowedHosts, true)) {
    http_response_code(403);
    echo json_encode(['error' => 'forbidden origin']);
    exit;
}

// ----- Input ----------------------------------------------------------------
$op       = strtolower(trim($_GET['op']       ?? ''));
$symbol   = strtoupper(trim($_GET['symbol']   ?? ''));
$interval = strtolower(trim($_GET['interval'] ?? '1d'));
$range    = strtolower(trim($_GET['range']    ?? '5d'));

if ($op !== 'chart') {
    http_response_code(400);
    echo json_encode(['error' => 'invalid op']);
    exit;
}

// Yahoo symbols include ^ (indices), = (futures/FX), . (foreign exchanges)
if ($symbol === '' || !preg_match('/^[A-Z0-9\.\-\^=]{1,16}$/', $symbol)) {
    http_response_code(400);
    echo json_encode(['error' => 'invalid symbol']);
    exit;
}

$intervalAllow = ['1m','2m','5m','15m','30m','60m','90m','1h','1d','5d','1wk','1mo','3mo'];
$rangeAllow    = ['1d','5d','1mo','3mo','6mo','1y','2y','5y','10y','ytd','max'];
if (!in_array($interval, $intervalAllow, true)) {
    http_response_code(400);
    echo json_encode(['error' => 'invalid interval']);
    exit;
}
if (!in_array($range, $rangeAllow, true)) {
    http_response_code(400);
    echo json_encode(['error' => 'invalid range']);
    exit;
}

// ----- Cache TTL -------------------------------------------------------------
// Intraday ranges refresh fast; daily/longer can cache longer.
$cacheTtl = in_array($range, ['1d','5d'], true) && in_array($interval, ['1m','2m','5m','15m','30m','60m','90m','1h'], true)
    ? 30   // intraday
    : 300; // daily+

// ----- Tiny file cache -------------------------------------------------------
$cacheDir = sys_get_temp_dir() . '/splc_yahoo';
if (!is_dir($cacheDir)) @mkdir($cacheDir, 0700, true);
$cacheKey  = sha1($symbol . '|' . $interval . '|' . $range);
$cacheFile = $cacheDir . '/' . $cacheKey . '.json';

if (is_file($cacheFile) && (time() - filemtime($cacheFile)) < $cacheTtl) {
    header('X-Cache: HIT');
    header('Cache-Control: public, max-age=' . $cacheTtl);
    readfile($cacheFile);
    exit;
}

// ----- Build upstream URL ----------------------------------------------------
$upstream = 'https://query1.finance.yahoo.com/v8/finance/chart/' . rawurlencode($symbol)
          . '?interval=' . rawurlencode($interval)
          . '&range='    . rawurlencode($range)
          . '&includePrePost=false&events=div%7Csplit';

// ----- Fetch (with real browser UA — Yahoo blocks default cURL UAs) ----------
$ch = curl_init($upstream);
curl_setopt_array($ch, [
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_FOLLOWLOCATION => true,
    CURLOPT_MAXREDIRS      => 3,
    CURLOPT_TIMEOUT        => 10,
    CURLOPT_CONNECTTIMEOUT => 5,
    CURLOPT_USERAGENT      => 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    CURLOPT_HTTPHEADER     => [
        'Accept: application/json,text/plain,*/*',
        'Accept-Language: en-US,en;q=0.9',
        'Referer: https://finance.yahoo.com/',
    ],
]);
$body = curl_exec($ch);
$code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
$err  = curl_error($ch);
curl_close($ch);

if ($body === false || $code >= 500) {
    // If upstream is failing, serve a stale cache if we have one — better than nothing.
    if (is_file($cacheFile)) {
        header('X-Cache: STALE');
        header('Cache-Control: public, max-age=5');
        readfile($cacheFile);
        exit;
    }
    http_response_code(502);
    echo json_encode(['error' => 'upstream unavailable', 'code' => $code, 'detail' => $err]);
    exit;
}

if ($code >= 400) {
    // Yahoo returned a 4xx — pass through the body but mark it; don't cache errors.
    http_response_code($code);
    header('X-Cache: BYPASS');
    echo $body;
    exit;
}

// Validate it's JSON before caching
$decoded = json_decode($body, true);
if (!is_array($decoded)) {
    http_response_code(502);
    echo json_encode(['error' => 'invalid upstream response']);
    exit;
}

// ----- Cache + return --------------------------------------------------------
@file_put_contents($cacheFile, $body, LOCK_EX);
header('X-Cache: MISS');
header('Cache-Control: public, max-age=' . $cacheTtl);
echo $body;
