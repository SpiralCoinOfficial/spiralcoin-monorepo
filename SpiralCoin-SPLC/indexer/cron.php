<?php
/**
 * Cron entry point.
 *
 * Run this from IONOS Cron Jobs (or any HTTPS request to a web-exposed copy)
 * every 1-5 minutes per environment.
 *
 * Usage (CLI):
 *   SPLC_ENV=testnet php /path/to/indexer/cron.php
 *   SPLC_ENV=mainnet php /path/to/indexer/cron.php
 *
 * Usage (web hit, requires CRON_SECRET env match):
 *   https://www.spiralcoin.net/indexer/cron.php?env=testnet&secret=XXX
 */

declare(strict_types=1);
ini_set('display_errors', '1');
error_reporting(E_ALL);
set_time_limit(280); // stay under IONOS 5-min cron cap

require_once __DIR__ . '/db.php';
require_once __DIR__ . '/index_transfers.php';
require_once __DIR__ . '/index_staking.php';
require_once __DIR__ . '/index_votes.php';

$config = require __DIR__ . '/config.php';

// --- Web mode: allow ?env=&secret= override ---
if (php_sapi_name() !== 'cli') {
    $secret = $config['cron_secret'] ?? (getenv('CRON_SECRET') ?: '');
    $given  = $_GET['secret'] ?? '';
    if ($secret === '' || !hash_equals($secret, $given)) {
        http_response_code(403);
        exit("forbidden\n");
    }
    if (!empty($_GET['env']) && in_array($_GET['env'], ['testnet', 'mainnet'], true)) {
        $config['env'] = $_GET['env'];
    }
    header('Content-Type: text/plain');
}

$start = microtime(true);
echo "=== SpiralCoin indexer | env={$config['env']} | " . date('c') . " ===\n";

try {
    index_transfers($config);
    index_staking($config);
    index_votes($config);
} catch (Throwable $e) {
    fwrite(STDERR, "FATAL: {$e->getMessage()}\n{$e->getTraceAsString()}\n");
    exit(1);
}

$elapsed = round(microtime(true) - $start, 2);
echo "=== done in {$elapsed}s ===\n";
