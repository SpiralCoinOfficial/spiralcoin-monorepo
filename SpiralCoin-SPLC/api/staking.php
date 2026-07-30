<?php
/**
 * GET /api/staking.php?env=testnet&chain=11155111&address=0x...
 *   -> { chain_id, staker_addr, staked_wei, rewards_wei, last_action_block, updated_at }
 */

declare(strict_types=1);
require __DIR__ . '/_bootstrap.php';

$chainId = api_chain_id();
$addr    = api_address();

$stmt = $pdo->prepare(
    'SELECT chain_id, staker_addr, staked_wei, rewards_wei,
            last_action_block, updated_at
       FROM staking_positions
      WHERE chain_id = :c AND staker_addr = :a'
);
$stmt->execute([':c' => $chainId, ':a' => $addr]);
$row = $stmt->fetch();

if (!$row) {
    api_json([
        'chain_id'          => $chainId,
        'staker_addr'       => $addr,
        'staked_wei'        => '0',
        'rewards_wei'       => '0',
        'last_action_block' => 0,
        'updated_at'        => null,
    ]);
}
api_json($row);
