<?php
/**
 * Staking indexer — Staked / Unstaked events from `vault` contracts.
 *
 * Writes to:
 *   - transactions (kind='stake' or 'unstake')
 *   - staking_positions (cumulative staked_wei per (chain_id, staker_addr))
 */

declare(strict_types=1);

require_once __DIR__ . '/db.php';
require_once __DIR__ . '/rpc.php';
require_once __DIR__ . '/abi.php';

function index_staking(array $config): void {
    $pdo = splc_db($config);

    $vaults = $pdo->query(
        "SELECT chain_id, address, deployed_block
           FROM contracts
          WHERE kind = 'vault'
          ORDER BY chain_id"
    )->fetchAll();

    foreach ($vaults as $v) {
        $chainId    = (int)$v['chain_id'];
        $vaultAddr  = strtolower($v['address']);
        $startFloor = (int)($v['deployed_block'] ?? 0);

        $rpcUrl = $config['rpc'][$chainId] ?? null;
        if (!$rpcUrl || str_contains($rpcUrl, '__ALCHEMY_KEY__')) continue;

        try { $head = rpc_block_number($rpcUrl, $config['request_timeout']); }
        catch (Throwable $e) { fwrite(STDERR, "[chain {$chainId}] head: {$e->getMessage()}\n"); continue; }

        $processed = 0;
        while ($processed < $config['max_blocks_per_run']) {
            $range = splc_claim_range(
                $pdo, $chainId, 'staking',
                $head, $config['batch_size'], $config['confirmations'],
                $startFloor
            );
            if ($range === null) break;
            [$from, $to] = $range;

            try {
                $logs = rpc_get_logs(
                    $rpcUrl, $from, $to, [$vaultAddr],
                    [TOPIC_STAKED, TOPIC_UNSTAKED],
                    $config['request_timeout']
                );

                $blockNums = [];
                foreach ($logs as $log) $blockNums[] = hexdec($log['blockNumber']);
                $blockTs = $blockNums ? rpc_block_timestamps($rpcUrl, $blockNums, $config['request_timeout']) : [];

                $ins = $pdo->prepare(
                    "INSERT INTO transactions
                        (chain_id, tx_hash, log_index, block_number, block_time,
                         from_addr, to_addr, amount_wei, kind)
                     VALUES (:c, :h, :i, :b, FROM_UNIXTIME(:ts), :f, :t, :v, :k)
                     ON DUPLICATE KEY UPDATE block_number = VALUES(block_number)"
                );
                $stakeAdd = $pdo->prepare(
                    "INSERT INTO staking_positions
                        (chain_id, staker_addr, staked_wei, last_action_block, updated_at)
                     VALUES (:c, :a, :v, :b, CURRENT_TIMESTAMP)
                     ON DUPLICATE KEY UPDATE
                        staked_wei = CAST(staked_wei AS DECIMAL(65,0)) + CAST(:v2 AS DECIMAL(65,0)),
                        last_action_block = GREATEST(last_action_block, :b2),
                        updated_at = CURRENT_TIMESTAMP"
                );
                $stakeSub = $pdo->prepare(
                    "INSERT INTO staking_positions
                        (chain_id, staker_addr, staked_wei, last_action_block, updated_at)
                     VALUES (:c, :a, '0', :b, CURRENT_TIMESTAMP)
                     ON DUPLICATE KEY UPDATE
                        staked_wei = GREATEST(CAST(0 AS DECIMAL(65,0)),
                                       CAST(staked_wei AS DECIMAL(65,0)) - CAST(:v2 AS DECIMAL(65,0))),
                        last_action_block = GREATEST(last_action_block, :b2),
                        updated_at = CURRENT_TIMESTAMP"
                );

                foreach ($logs as $log) {
                    $topic0   = strtolower($log['topics'][0]);
                    $user     = '0x' . substr($log['topics'][1], -40);
                    $user     = strtolower($user);
                    $data     = substr($log['data'], 2); // strip 0x
                    $amount   = hex_to_dec(substr($data, 0, 64));
                    $txHash   = strtolower($log['transactionHash']);
                    $logIndex = hexdec($log['logIndex']);
                    $blockNum = hexdec($log['blockNumber']);
                    $ts       = $blockTs[$blockNum] ?? time();

                    $isStake = $topic0 === TOPIC_STAKED;
                    $kind = $isStake ? 'stake' : 'unstake';

                    // transactions: vault <-> user
                    $ins->execute([
                        ':c'  => $chainId, ':h'  => $txHash, ':i' => $logIndex,
                        ':b'  => $blockNum, ':ts' => $ts,
                        ':f'  => $isStake ? $user : $vaultAddr,
                        ':t'  => $isStake ? $vaultAddr : $user,
                        ':v'  => $amount, ':k' => $kind,
                    ]);

                    if ($isStake) {
                        $stakeAdd->execute([
                            ':c' => $chainId, ':a' => $user,
                            ':v' => $amount, ':v2' => $amount,
                            ':b' => $blockNum, ':b2' => $blockNum,
                        ]);
                    } else {
                        $stakeSub->execute([
                            ':c' => $chainId, ':a' => $user,
                            ':v2' => $amount,
                            ':b' => $blockNum, ':b2' => $blockNum,
                        ]);
                    }
                }

                splc_advance_cursor($pdo, $chainId, 'staking', $to);
                $pdo->commit();
            } catch (Throwable $e) {
                if ($pdo->inTransaction()) $pdo->rollBack();
                fwrite(STDERR, "[chain {$chainId}] staking batch {$from}-{$to}: {$e->getMessage()}\n");
                break;
            }

            $n = count($logs);
            echo "[chain {$chainId}] staking   {$from}-{$to} : {$n} event(s)\n";
            $processed += ($to - $from + 1);
        }
    }
}
