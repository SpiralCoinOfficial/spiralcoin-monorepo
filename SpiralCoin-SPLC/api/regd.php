<?php
/**
 * /api/regd.php — SUSPENDED pending securities counsel review.
 *
 * The previous Reg D 506(c) intake handler is preserved in the repository's
 * /private/ folder (gitignored) and on the server outside the webroot.
 * While suspended, this endpoint accepts no submissions and returns HTTP 503
 * for every request.
 */

declare(strict_types=1);

header('Access-Control-Allow-Origin: https://www.spiralcoin.net');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');
header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');
header('Referrer-Policy: no-referrer');
header('Cache-Control: no-store');
header('Retry-After: 604800');

if (($_SERVER['REQUEST_METHOD'] ?? '') === 'OPTIONS') {
    http_response_code(204);
    exit;
}

http_response_code(503);
echo json_encode([
    'error'   => 'service_suspended',
    'message' => 'Accredited-investor intake is paused pending securities counsel review. No submissions are being accepted at this time.',
]);
