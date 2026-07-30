<?php
/**
 * Shared bootstrap for /api/* endpoints.
 *
 * Provides:
 *   - $config (from /indexer/config.php)
 *   - $pdo    (PDO handle for the requested env)
 *   - JSON output + CORS helpers
 *   - api_chain_id() / api_address() / api_int() input validators
 */

declare(strict_types=1);

require_once __DIR__ . '/../indexer/db.php';

header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: public, max-age=10');

if (($_SERVER['REQUEST_METHOD'] ?? '') === 'OPTIONS') {
    http_response_code(204);
    exit;
}

set_exception_handler(function (Throwable $e) {
    http_response_code(500);
    echo json_encode(['error' => $e->getMessage()]);
});

function api_json($data, int $code = 200): void {
    http_response_code($code);
    echo json_encode($data, JSON_UNESCAPED_SLASHES);
    exit;
}

function api_fail(string $msg, int $code = 400): void {
    api_json(['error' => $msg], $code);
}

function api_env(): string {
    $e = $_GET['env'] ?? 'testnet';
    if (!in_array($e, ['testnet', 'mainnet'], true)) {
        api_fail('invalid env (must be testnet|mainnet)', 400);
    }
    return $e;
}

function api_chain_id(): int {
    if (!isset($_GET['chain'])) api_fail('missing chain', 400);
    $c = (int)$_GET['chain'];
    if ($c <= 0) api_fail('invalid chain', 400);
    return $c;
}

function api_address(string $field = 'address'): string {
    $a = strtolower(trim($_GET[$field] ?? ''));
    if (!preg_match('/^0x[0-9a-f]{40}$/', $a)) {
        api_fail("invalid {$field}", 400);
    }
    return $a;
}

function api_int(string $field, int $default, int $min, int $max): int {
    $v = isset($_GET[$field]) ? (int)$_GET[$field] : $default;
    return max($min, min($max, $v));
}

$config = require __DIR__ . '/../indexer/config.php';
$config['env'] = api_env();
$pdo = splc_db($config);
