<?php
/* =============================================================================
 * SpiralCoin — Wallet Binding Endpoint  (MVP — see SECURITY NOTE below)
 * -----------------------------------------------------------------------------
 *  POST /api/bind-wallet.php
 *  Headers: Authorization: Bearer <Auth0 ID token (JWT)>
 *  Body:    { address, message, signature, chainId }
 *
 *  Verifies the Auth0 ID token signature against the tenant's JWKS (RS256,
 *  openssl-only — no composer required) and persists
 *  {auth0_sub, address, message, signature, bound_at, chain_id} to
 *  private/wallet-bindings.json  (atomic write, file outside webroot).
 *
 *  ╔══════════════════════════════════════════════════════════════════════╗
 *  ║ SECURITY NOTE — server-side ECDSA recovery is INTENTIONALLY DEFERRED ║
 *  ║                                                                      ║
 *  ║ Right now we trust the JWT-authenticated user to claim its own       ║
 *  ║ wallet address. The signed SIWE message is recorded verbatim so a    ║
 *  ║ future job can re-verify every binding against the on-chain recovery ║
 *  ║ once we add simplito/elliptic-php + kornrunner/keccak via Composer.  ║
 *  ║ Until then, do NOT gate value-bearing features (transfers, votes,    ║
 *  ║ withdrawals) on this binding alone. UI display only.                 ║
 *  ╚══════════════════════════════════════════════════════════════════════╝
 * ============================================================================= */

declare(strict_types=1);
header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');

$BIND_FILE = __DIR__ . '/../private/wallet-bindings.json';

function json_fail(int $code, string $msg): void {
    http_response_code($code);
    echo json_encode(['error' => $msg]);
    exit;
}

// ---- 1. Method + body ------------------------------------------------------
if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') json_fail(405, 'POST only');

$raw  = file_get_contents('php://input');
$body = json_decode($raw, true);
if (!is_array($body)) json_fail(400, 'Invalid JSON body');

$address   = strtolower(trim((string)($body['address']   ?? '')));
$message   = (string)($body['message']   ?? '');
$signature = (string)($body['signature'] ?? '');
$chainId   = (int)($body['chainId'] ?? 0);

if (!preg_match('/^0x[a-f0-9]{40}$/', $address))       json_fail(400, 'Bad address');
if (!preg_match('/^0x[a-f0-9]{130}$/i', $signature))    json_fail(400, 'Bad signature');
if (strlen($message) < 40 || strlen($message) > 4000)  json_fail(400, 'Bad message');
if ($chainId !== 42161)                                 json_fail(400, 'chainId must be 42161 (Arbitrum One)');
if (stripos($message, $address) === false)              json_fail(400, 'Address not in message');
if (!preg_match('/Nonce:\s*[a-f0-9]{16,}/i', $message)) json_fail(400, 'Missing Nonce');

// SIWE domain binding — message must start with the expected host string
$allowedHosts = ['www.spiralcoin.net', 'spiralcoin.net', 'localhost', 'localhost:443'];
if (!preg_match('/^([^\s]+) wants you to sign in/m', $message, $hm)
    || !in_array($hm[1], $allowedHosts, true)) {
    json_fail(400, 'Bad SIWE domain');
}

// SIWE Issued At freshness — message must be < 10 minutes old, not in future
if (!preg_match('/Issued At:\s*(\S+)/i', $message, $im)) json_fail(400, 'Missing Issued At');
$issuedTs = strtotime($im[1]);
if ($issuedTs === false)                  json_fail(400, 'Bad Issued At');
if ($issuedTs > time() + 60)              json_fail(400, 'Issued At in future');
if ($issuedTs < time() - 600)             json_fail(400, 'SIWE message expired');

// ---- 2. Auth0 ID-token verification (shared verifier) ---------------------
require __DIR__ . '/_auth0_verify.php';
$payload   = splc_verify_auth0_bearer();
$auth0_sub = $payload['sub'] ?? null;
if (!$auth0_sub) json_fail(401, 'Missing sub');

// ---- 2a. ECDSA signature recovery (proves caller controls $address) -------
// Soft-fail if vendor/ not yet deployed (e.g. first push) — fall back to
// jwt_only mode and record signature for later re-verification.
$verified_mode = 'jwt_only';
@include_once __DIR__ . '/_ecrecover.php';
if (function_exists('splc_ecrecover')) {
    $recovered = splc_ecrecover($message, $signature);
    if ($recovered === null) {
        json_fail(400, 'Signature recovery failed');
    }
    if (!hash_equals($address, $recovered)) {
        json_fail(401, 'Signature does not match address');
    }
    $verified_mode = 'ecdsa';
}

// ---- 2b. Consume server-issued nonce (replay protection) -------------------
if (!preg_match('/Nonce:\s*([a-f0-9]+)/i', $message, $nm)) json_fail(400, 'Missing Nonce');
$nonce      = strtolower($nm[1]);
$nonceStore = __DIR__ . '/../private/wallet-nonces.json';
$nfp = @fopen($nonceStore, 'c+');
if (!$nfp) json_fail(400, 'Nonce not issued (call /api/wallet-nonce.php first)');
flock($nfp, LOCK_EX);
$ndb = json_decode((string)stream_get_contents($nfp), true);
if (!is_array($ndb)) $ndb = [];
$rec = $ndb[$nonce] ?? null;
if (!$rec) {
    flock($nfp, LOCK_UN); fclose($nfp);
    json_fail(400, 'Unknown or already-used nonce');
}
if (($rec['sub'] ?? null) !== $auth0_sub) {
    flock($nfp, LOCK_UN); fclose($nfp);
    json_fail(400, 'Nonce issued to a different user');
}
if (($rec['expires'] ?? 0) < time()) {
    unset($ndb[$nonce]);
    ftruncate($nfp, 0); rewind($nfp); fwrite($nfp, json_encode($ndb));
    flock($nfp, LOCK_UN); fclose($nfp);
    json_fail(400, 'Nonce expired');
}
unset($ndb[$nonce]); // single-use
ftruncate($nfp, 0); rewind($nfp); fwrite($nfp, json_encode($ndb));
fflush($nfp); flock($nfp, LOCK_UN); fclose($nfp);

// ---- 3. Persist binding (signature stored for future re-verification) ------
$dir = dirname($BIND_FILE);
if (!is_dir($dir)) @mkdir($dir, 0750, true);

$fp = fopen($BIND_FILE, 'c+');
if (!$fp) json_fail(500, 'Cannot open bindings file');
flock($fp, LOCK_EX);
$json = stream_get_contents($fp);
$db   = $json ? json_decode($json, true) : [];
if (!is_array($db)) $db = [];

$db[$auth0_sub] = [
    'address'    => $address,
    'chain_id'   => $chainId,
    'bound_at'   => date('c'),
    'email'      => $payload['email'] ?? null,
    'ip'         => $_SERVER['REMOTE_ADDR'] ?? null,
    'message'    => $message,    // kept for future ECDSA re-verification
    'signature'  => $signature,  // kept for future ECDSA re-verification
    'verified'   => $verified_mode,  // 'ecdsa' once vendor/ deployed, else 'jwt_only'
];

ftruncate($fp, 0);
rewind($fp);
fwrite($fp, json_encode($db, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES));
fflush($fp);
flock($fp, LOCK_UN);
fclose($fp);

echo json_encode(['ok' => true, 'address' => $address, 'sub' => $auth0_sub, 'mode' => 'mvp']);
