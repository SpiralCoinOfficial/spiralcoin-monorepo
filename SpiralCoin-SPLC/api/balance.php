<?php
/**
 * GET /api/balance.php?env=testnet&chain=11155111&address=0x...
 *   -> { chain_id, address, balance_wei, votes_wei, delegate_to, last_block, updated_at }
 */

declare(strict_types=1);
require __DIR__ . '/_bootstrap.php';

$chainId = api_chain_id();
$addr    = api_address();

$stmt = $pdo->prepare(
    'SELECT chain_id, address, balance_wei, votes_wei, delegate_to,
            last_block, updated_at
       FROM balances
      WHERE chain_id = :c AND address = :a'
);
$stmt->execute([':c' => $chainId, ':a' => $addr]);
$row = $stmt->fetch();

if (!$row) {
    api_json([
        'chain_id'    => $chainId,
        'address'     => $addr,
        'balance_wei' => '0',
        'votes_wei'   => '0',
        'delegate_to' => null,
        'last_block'  => 0,
        'updated_at'  => null,
    ]);
}
api_json($row);
