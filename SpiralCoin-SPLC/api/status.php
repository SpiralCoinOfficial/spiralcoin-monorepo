<?php
/**
 * GET /api/status.php?env=testnet
 *   -> {
 *        env, chains: [{
 *          chain_id, name, indexer_state: [{stream, last_block, updated_at}],
 *          contracts: [...]
 *        }]
 *      }
 *
 * Public health/heartbeat endpoint. Useful to confirm cron is running.
 */

declare(strict_types=1);
require __DIR__ . '/_bootstrap.php';

$chains = $pdo->query(
    'SELECT chain_id, name, short_name, is_testnet, explorer_url
       FROM chains
      ORDER BY chain_id'
)->fetchAll();

$states = $pdo->query(
    'SELECT chain_id, stream, last_block, updated_at FROM indexer_state'
)->fetchAll();
$byChainState = [];
foreach ($states as $s) {
    $byChainState[(int)$s['chain_id']][] = [
        'stream'     => $s['stream'],
        'last_block' => (int)$s['last_block'],
        'updated_at' => $s['updated_at'],
    ];
}

$contracts = $pdo->query(
    'SELECT chain_id, kind, address, deployed_block, version, verified
       FROM contracts'
)->fetchAll();
$byChainCon = [];
foreach ($contracts as $c) {
    $byChainCon[(int)$c['chain_id']][] = $c;
}

foreach ($chains as &$ch) {
    $cid = (int)$ch['chain_id'];
    $ch['indexer_state'] = $byChainState[$cid] ?? [];
    $ch['contracts']     = $byChainCon[$cid] ?? [];
}

api_json([
    'env'        => $config['env'],
    'server_ts'  => date('c'),
    'chains'     => $chains,
]);
