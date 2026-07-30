<?php
/**
 * SpiralCoin — Polygon.io REST proxy
 *
 * Why this exists:
 *   The Polygon API key is a paid credential and MUST NOT appear in the
 *   browser. This script holds the key server-side and forwards a small
 *   allow-listed set of read-only quote/snapshot/candle calls.
 *
 * Front-end calls:
 *   GET /api/polygon.php?op=quote&symbol=AAPL
 *   GET /api/polygon.php?op=snapshot&symbol=AAPL
 *   GET /api/polygon.php?op=candles&symbol=AAPL&tf=1m&limit=120
 *   GET /api/polygon.php?op=indices&symbol=I:SPX
 *
 * Security:
 *   - Key loaded from /api/.env (gitignored, denied by .htaccess)
 *   - Origin/Referer must be spiralcoin.net (loose lock against drive-by abuse)
 *   - Allow-listed ops only; arbitrary path passthrough is rejected
 *   - Short file cache reduces quota burn under traffic spikes
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

// ----- Load API key from .env (server-side only) -----------------------------
function load_env(string $path): array {
    $out = [];
    if (!is_file($path)) return $out;
    foreach (file($path, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) as $line) {
        if ($line === '' || $line[0] === '#') continue;
        $eq = strpos($line, '=');
        if ($eq === false) continue;
        $k = trim(substr($line, 0, $eq));
        $v = trim(substr($line, $eq + 1));
        $v = trim($v, "\"' \t\r\n");
        $out[$k] = $v;
    }
    return $out;
}

$env = load_env(__DIR__ . '/.env');
$KEY = $env['POLYGON_KEY'] ?? '';
if ($KEY === '') {
    http_response_code(500);
    echo json_encode(['error' => 'server misconfigured: missing POLYGON_KEY']);
    exit;
}

// ----- Input ----------------------------------------------------------------
$op     = strtolower(trim($_GET['op']     ?? ''));
$symbol = strtoupper(trim($_GET['symbol'] ?? ''));
$tf     = strtolower(trim($_GET['tf']     ?? '1m'));
$limit  = max(1, min(500, (int)($_GET['limit'] ?? 120)));

if ($symbol === '' || !preg_match('/^[A-Z0-9:\.\-]{1,16}$/', $symbol)) {
    http_response_code(400);
    echo json_encode(['error' => 'invalid symbol']);
    exit;
}

// ----- Timeframe map (candles) ----------------------------------------------
$tfMap = [
    '1s' => ['1','second'],   '5s' => ['5','second'],
    '15s'=> ['15','second'],  '30s'=> ['30','second'],
    '45s'=> ['45','second'],
    '1m' => ['1','minute'],   '5m' => ['5','minute'],
    '15m'=> ['15','minute'],  '30m'=> ['30','minute'],
    '1h' => ['1','hour'],     '4h' => ['4','hour'],
    '1d' => ['1','day'],      '1w' => ['1','week'],
    '1mo'=> ['1','month'],    '1y' => ['1','year'],
];

// ----- Build upstream URL ---------------------------------------------------
$upstream = null;
$cacheTtl = 2; // seconds; raised for slower-changing endpoints

switch ($op) {
    case 'quote':
        // Free Basic Polygon plan = end-of-day only. Use the most recent daily
        // bar as the "quote" price. Front-end labels this as delayed.
        // Polygon also exposes /prev which returns yesterday's close in one shot.
        $upstream = "https://api.polygon.io/v2/aggs/ticker/" . rawurlencode($symbol)
                  . "/prev?adjusted=true";
        $cacheTtl = 30;
        break;

    case 'snapshot':
        if (strpos($symbol, 'I:') === 0) {
            $upstream = "https://api.polygon.io/v3/snapshot/indices?ticker.any_of=" . rawurlencode($symbol);
        } else {
            $upstream = "https://api.polygon.io/v2/snapshot/locale/us/markets/stocks/tickers/" . rawurlencode($symbol);
        }
        $cacheTtl = 2;
        break;

    case 'candles':
        if (!isset($tfMap[$tf])) {
            http_response_code(400);
            echo json_encode(['error' => 'invalid tf']);
            exit;
        }
        [$mult, $span] = $tfMap[$tf];
        $to   = (int)round(microtime(true) * 1000);
        $from = $to - candleWindowMs($tf, $limit);
        $upstream = "https://api.polygon.io/v2/aggs/ticker/" . rawurlencode($symbol)
                  . "/range/{$mult}/{$span}/{$from}/{$to}"
                  . "?adjusted=true&sort=asc&limit={$limit}";
        $cacheTtl = ($span === 'second') ? 1 : 5;
        break;

    case 'indices':
        $upstream = "https://api.polygon.io/v3/snapshot/indices?ticker.any_of=" . rawurlencode($symbol);
        $cacheTtl = 3;
        break;

    case 'gainers':
        $upstream = "https://api.polygon.io/v2/snapshot/locale/us/markets/stocks/gainers";
        $cacheTtl = 15;
        break;

    case 'losers':
        $upstream = "https://api.polygon.io/v2/snapshot/locale/us/markets/stocks/losers";
        $cacheTtl = 15;
        break;

    default:
        http_response_code(400);
        echo json_encode(['error' => 'invalid op']);
        exit;
}

function candleWindowMs(string $tf, int $limit): int {
    $sec = [
        '1s'=>1,'5s'=>5,'15s'=>15,'30s'=>30,'45s'=>45,
        '1m'=>60,'5m'=>300,'15m'=>900,'30m'=>1800,
        '1h'=>3600,'4h'=>14400,'1d'=>86400,'1w'=>604800,
        '1mo'=>2592000,'1y'=>31536000,
    ][$tf] ?? 60;
    // Pull enough history to satisfy `limit`, with 4x safety margin for market gaps
    return $sec * $limit * 4 * 1000;
}

// ----- Append key (server-side only) ----------------------------------------
$sep = (strpos($upstream, '?') === false) ? '?' : '&';
$upstreamFull = $upstream . $sep . 'apiKey=' . urlencode($KEY);

// ----- Tiny file cache (per op+symbol+tf+limit) -----------------------------
$cacheDir = sys_get_temp_dir() . '/splc_polygon';
if (!is_dir($cacheDir)) @mkdir($cacheDir, 0700, true);
$cacheKey = sha1($op . '|' . $symbol . '|' . $tf . '|' . $limit);
$cacheFile = $cacheDir . '/' . $cacheKey . '.json';

if (is_file($cacheFile) && (time() - filemtime($cacheFile)) < $cacheTtl) {
    header('X-Cache: HIT');
    header('Cache-Control: public, max-age=' . $cacheTtl);
    readfile($cacheFile);
    exit;
}

// ----- Fetch -----------------------------------------------------------------
$ch = curl_init($upstreamFull);
curl_setopt_array($ch, [
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_TIMEOUT        => 10,
    CURLOPT_CONNECTTIMEOUT => 5,
    CURLOPT_USERAGENT      => 'SpiralCoin/1.0 (+https://spiralcoin.net)',
    CURLOPT_HTTPHEADER     => ['Accept: application/json'],
]);
$body = curl_exec($ch);
$code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
$err  = curl_error($ch);
curl_close($ch);

if ($body === false || $code === 0) {
    http_response_code(502);
    echo json_encode(['error' => 'upstream unreachable', 'detail' => $err]);
    exit;
}

if ($code >= 200 && $code < 300) {
    // For op=quote, normalize the aggs response into a small {price, t, symbol} envelope
    if ($op === 'quote') {
        $decoded = json_decode($body, true);
        $r = $decoded['results'][0] ?? null;
        if ($r) {
            $body = json_encode([
                'symbol' => $symbol,
                'price'  => $r['c'] ?? null,  // close of last 1m bar
                'open'   => $r['o'] ?? null,
                'high'   => $r['h'] ?? null,
                'low'    => $r['l'] ?? null,
                'volume' => $r['v'] ?? null,
                't'      => $r['t'] ?? null,
                'src'    => 'aggs-1m',
                'delayed'=> true,
            ]);
        }
    }
    @file_put_contents($cacheFile, $body, LOCK_EX);
}

header('X-Cache: MISS');
header('Cache-Control: public, max-age=' . $cacheTtl);
http_response_code($code);
echo $body;
