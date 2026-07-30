<?php
/**
 * GET /api/transactions.php?env=testnet&chain=11155111&address=0x...&limit=50&before_id=123
 *   -> { items: [...], next_before_id: <int|null> }
 *
 * Returns transactions where address is either from_addr or to_addr,
 * newest first, cursor-paginated by `id`.
 */

declare(strict_types=1);
require __DIR__ . '/_bootstrap.php';

$chainId  = api_chain_id();
$addr     = api_address();
$limit    = api_int('limit', 50, 1, 200);
$beforeId = api_int('before_id', PHP_INT_MAX, 1, PHP_INT_MAX);

$stmt = $pdo->prepare(
    'SELECT id, tx_hash, log_index, block_number, block_time,
            from_addr, to_addr, amount_wei, kind
       FROM transactions
      WHERE chain_id = :c
        AND id < :bid
        AND (from_addr = :a OR to_addr = :a)
      ORDER BY id DESC
      LIMIT ' . (int)$limit
);
$stmt->execute([':c' => $chainId, ':bid' => $beforeId, ':a' => $addr]);
$rows = $stmt->fetchAll();

$next = null;
if (count($rows) === $limit) {
    $next = (int)$rows[count($rows) - 1]['id'];
}

api_json([
    'items'          => $rows,
    'next_before_id' => $next,
]);
