<?php
/* =============================================================================
 * SpiralCoin — SIWE Nonce Issuer
 * -----------------------------------------------------------------------------
 *  GET /api/wallet-nonce.php
 *  Headers: Authorization: Bearer <Auth0 ID token>
 *
 *  Returns: { "nonce": "<32 hex>", "issued_at": "<ISO8601>", "ttl": 600 }
 *
 *  Persists each issued nonce to /private/wallet-nonces.json with the issuing
 *  Auth0 sub + an expiry. /api/bind-wallet.php cross-checks the nonce in the
 *  signed SIWE message against this store and consumes (deletes) it on use.
 *
 *  Garbage-collects expired nonces opportunistically on every issuance.
 *  TTL: 10 minutes (matches the SIWE Issued-At freshness window).
 * ============================================================================= */

declare(strict_types=1);
header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');
header('Cache-Control: no-store');

require __DIR__ . '/_auth0_verify.php';

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'GET') {
    http_response_code(405);
    echo json_encode(['error' => 'GET only']);
    exit;
}

$claims = splc_verify_auth0_bearer();          // exits 401 on failure
$sub    = $claims['sub'] ?? null;
if (!$sub) {
    http_response_code(401);
    echo json_encode(['error' => 'Missing sub']);
    exit;
}

$store = __DIR__ . '/../private/wallet-nonces.json';
@mkdir(dirname($store), 0750, true);

// ---- Per-sub rate limit -----------------------------------------------------
// Max 5 nonce issuances per Auth0 sub per rolling 60-second window.
// Backed by the same store: counted from `issued` timestamps for this sub.
$RATE_MAX    = 5;
$RATE_WINDOW = 60;

$nonceBin = random_bytes(16);
$nonce    = bin2hex($nonceBin);
$issuedAt = gmdate('c');
$ttl      = 600; // seconds

$fp = fopen($store, 'c+');
if (!$fp) {
    http_response_code(500);
    echo json_encode(['error' => 'Cannot open nonce store']);
    exit;
}
flock($fp, LOCK_EX);

$json = stream_get_contents($fp);
$db   = $json ? json_decode($json, true) : [];
if (!is_array($db)) $db = [];

// GC expired
$now = time();
foreach ($db as $n => $rec) {
    if (($rec['expires'] ?? 0) < $now) unset($db[$n]);
}

// Rate-limit this sub
$windowStart = $now - $RATE_WINDOW;
$recentForSub = 0;
foreach ($db as $rec) {
    if (($rec['sub'] ?? null) === $sub && ($rec['issued'] ?? 0) >= $windowStart) {
        $recentForSub++;
    }
}
if ($recentForSub >= $RATE_MAX) {
    flock($fp, LOCK_UN);
    fclose($fp);
    http_response_code(429);
    header('Retry-After: ' . $RATE_WINDOW);
    echo json_encode(['error' => 'Rate limit exceeded. Try again shortly.']);
    exit;
}

$db[$nonce] = [
    'sub'     => $sub,
    'issued'  => $now,
    'expires' => $now + $ttl,
];

ftruncate($fp, 0);
rewind($fp);
fwrite($fp, json_encode($db, JSON_UNESCAPED_SLASHES));
fflush($fp);
flock($fp, LOCK_UN);
fclose($fp);

echo json_encode([
    'nonce'     => $nonce,
    'issued_at' => $issuedAt,
    'ttl'       => $ttl,
]);
