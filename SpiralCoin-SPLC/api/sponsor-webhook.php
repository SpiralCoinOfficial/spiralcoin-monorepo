<?php
/**
 * SpiralCoin — GitHub Sponsors webhook receiver
 * ------------------------------------------------------------------
 *  Endpoint: https://www.spiralcoin.net/api/sponsor-webhook.php
 *  Triggered by: GitHub Sponsors → sponsorship.created / cancelled /
 *                tier_changed / edited / pending_cancellation /
 *                pending_tier_change events.
 *
 *  Security:
 *    - Validates X-Hub-Signature-256 using HMAC-SHA256 with the secret
 *      stored in /private/sponsor-webhook-secret.txt (chmod 600, NOT
 *      in git).
 *    - Constant-time comparison (hash_equals) to prevent timing attacks.
 *    - Rejects requests larger than 1 MB (DoS guard).
 *    - Logs every accepted event as one line of JSON in
 *      /private/sponsor-events.jsonl for later processing.
 *    - Does NOT execute any business logic on the payload — pure
 *      capture endpoint. Display / tier-recognition is a separate
 *      script that reads the JSONL.
 *
 *  HTTP responses:
 *    202 Accepted  — signature verified, event logged
 *    400 Bad Req   — malformed
 *    401 Unauth    — signature invalid or missing
 *    405 Method    — anything other than POST
 *    413 Too Large — payload exceeds 1 MB
 *    500 Internal  — secret file missing or write failed (admin only)
 * ------------------------------------------------------------------ */

declare(strict_types=1);

header('Content-Type: text/plain; charset=utf-8');
header('X-Content-Type-Options: nosniff');
header('Cache-Control: no-store');

// 1. Method guard
if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    http_response_code(405);
    echo "405 Method Not Allowed\n";
    exit;
}

// 2. Size guard (1 MB)
$contentLength = (int)($_SERVER['CONTENT_LENGTH'] ?? 0);
if ($contentLength > 1_048_576) {
    http_response_code(413);
    echo "413 Payload Too Large\n";
    exit;
}

// 3. Load secret (server-side only — never in git)
$secretPath = __DIR__ . '/../private/sponsor-webhook-secret.txt';
if (!is_readable($secretPath)) {
    http_response_code(500);
    error_log('[sponsor-webhook] Missing secret file at ' . $secretPath);
    echo "500 Endpoint not configured\n";
    exit;
}
$secret = trim((string)file_get_contents($secretPath));
if ($secret === '' || strlen($secret) < 32) {
    http_response_code(500);
    error_log('[sponsor-webhook] Secret too short or empty');
    echo "500 Endpoint not configured\n";
    exit;
}

// 4. Read raw body
$body = (string)file_get_contents('php://input');
if ($body === '') {
    http_response_code(400);
    echo "400 Empty body\n";
    exit;
}

// 5. Verify signature (HMAC-SHA256, constant time)
$signatureHeader = $_SERVER['HTTP_X_HUB_SIGNATURE_256'] ?? '';
if (!str_starts_with($signatureHeader, 'sha256=')) {
    http_response_code(401);
    error_log('[sponsor-webhook] Missing or malformed signature header');
    echo "401 Missing signature\n";
    exit;
}
$expected = 'sha256=' . hash_hmac('sha256', $body, $secret);
if (!hash_equals($expected, $signatureHeader)) {
    http_response_code(401);
    error_log('[sponsor-webhook] Signature mismatch from ' . ($_SERVER['REMOTE_ADDR'] ?? '?'));
    echo "401 Invalid signature\n";
    exit;
}

// 6. Parse payload (best-effort — log even if not JSON)
$event = $_SERVER['HTTP_X_GITHUB_EVENT'] ?? 'unknown';
$delivery = $_SERVER['HTTP_X_GITHUB_DELIVERY'] ?? '';
$decoded = json_decode($body, true);

// 7. Append to JSONL log
$logDir = __DIR__ . '/../private';
$logPath = $logDir . '/sponsor-events.jsonl';
if (!is_dir($logDir)) {
    @mkdir($logDir, 0750, true);
}
$record = [
    'ts'        => gmdate('c'),
    'event'     => $event,
    'delivery'  => $delivery,
    'action'    => is_array($decoded) ? ($decoded['action'] ?? null) : null,
    'sponsor'   => is_array($decoded) ? ($decoded['sponsorship']['sponsor']['login'] ?? null) : null,
    'tier'      => is_array($decoded) ? ($decoded['sponsorship']['tier']['name'] ?? null) : null,
    'amount'   => is_array($decoded) ? ($decoded['sponsorship']['tier']['monthly_price_in_dollars'] ?? null) : null,
    'one_time'  => is_array($decoded) ? ($decoded['sponsorship']['tier']['is_one_time'] ?? null) : null,
    'raw'       => $decoded ?? $body,
];
$line = json_encode($record, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE) . "\n";
$ok = @file_put_contents($logPath, $line, FILE_APPEND | LOCK_EX);
if ($ok === false) {
    http_response_code(500);
    error_log('[sponsor-webhook] Failed to append to ' . $logPath);
    echo "500 Log write failed\n";
    exit;
}

// 8. Success
http_response_code(202);
echo "202 Accepted\n";
