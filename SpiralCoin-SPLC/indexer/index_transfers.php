<?php
/**
 * ERC20 Transfer indexer.
 *
 * For each `token` contract in the current env:
 *   1. Atomically claims next block range
 *   2. Fetches Transfer logs via eth_getLogs
 *   3. Batch-fetches block timestamps
 *   4. INSERTs rows into `transactions` (idempotent via UNIQUE(chain_id,tx_hash,log_index))
 *   5. UPSERTs `balances` (subtract sender, add recipient, clamp at 0)
 *   6. Advances cursor
 * All within one DB transaction per batch.
 */

declare(strict_types=1);

require_once __DIR__ . '/db.php';
require_once __DIR__ . '/rpc.php';
require_once __DIR__ . '/abi.php';

const ZERO_ADDR = '0x0000000000000000000000000000000000000000';

function index_transfers(array $config): void {
    $pdo = splc_db($config);

    $tokens = $pdo->query(
        "SELECT c.chain_id, c.address, c.deployed_block
           FROM contracts c
           JOIN chains ch ON ch.chain_id = c.chain_id
          WHERE c.kind = 'token'
          ORDER BY c.chain_id"
    )->fetchAll();

    foreach ($tokens as $tok) {
        $chainId   = (int)$tok['chain_id'];
        $tokenAddr = strtolower($tok['address']);
        $startFloor = (int)($tok['deployed_block'] ?? 0);

        $rpcUrl = $config['rpc'][$chainId] ?? null;
        if (!$rpcUrl || str_contains($rpcUrl, '__ALCHEMY_KEY__')) {
            fwrite(STDERR, "[chain {$chainId}] no RPC configured, skipping transfers\n");
            continue;
        }

        try {
            $head = rpc_block_number($rpcUrl, $config['request_timeout']);
        } catch (Throwable $e) {
            fwrite(STDERR, "[chain {$chainId}] head block failed: {$e->getMessage()}\n");
            continue;
        }

        $processed = 0;
        while ($processed < $config['max_blocks_per_run']) {
            $range = splc_claim_range(
                $pdo, $chainId, 'transfers',
                $head, $config['batch_size'], $config['confirmations'],
                $startFloor
            );
            if ($range === null) break;
            [$from, $to] = $range;

            try {
                $logs = rpc_get_logs($rpcUrl, $from, $to, [$tokenAddr], [TOPIC_TRANSFER], $config['request_timeout']);

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
                $balAdd = $pdo->prepare(
                    "INSERT INTO balances (chain_id, address, balance_wei, last_block, updated_at)
                     VALUES (:c, :a, :v, :b, CURRENT_TIMESTAMP)
                     ON DUPLICATE KEY UPDATE
                        balance_wei = CAST(balance_wei AS DECIMAL(65,0)) + CAST(:v2 AS DECIMAL(65,0)),
                        last_block  = GREATEST(last_block, :b2),
                        updated_at  = CURRENT_TIMESTAMP"
                );
                $balSub = $pdo->prepare(
                    "INSERT INTO balances (chain_id, address, balance_wei, last_block, updated_at)
                     VALUES (:c, :a, '0', :b, CURRENT_TIMESTAMP)
                     ON DUPLICATE KEY UPDATE
                        balance_wei = GREATEST(CAST(0 AS DECIMAL(65,0)),
                                       CAST(balance_wei AS DECIMAL(65,0)) - CAST(:v2 AS DECIMAL(65,0))),
                        last_block  = GREATEST(last_block, :b2),
                        updated_at  = CURRENT_TIMESTAMP"
                );

                foreach ($logs as $log) {
                    [$fromAddr, $toAddr, $valueDec] = decode_transfer($log);
                    $txHash   = strtolower($log['transactionHash']);
                    $logIndex = hexdec($log['logIndex']);
                    $blockNum = hexdec($log['blockNumber']);
                    $ts       = $blockTs[$blockNum] ?? time();

                    $isMint = $fromAddr === ZERO_ADDR;
                    $isBurn = $toAddr   === ZERO_ADDR;
                    $kind   = $isMint ? 'mint' : ($isBurn ? 'burn' : 'transfer');

                    $ins->execute([
                        ':c'  => $chainId, ':h'  => $txHash, ':i' => $logIndex,
                        ':b'  => $blockNum, ':ts' => $ts,
                        ':f'  => $fromAddr, ':t' => $toAddr,
                        ':v'  => $valueDec, ':k' => $kind,
                    ]);

                    if (!$isMint) {
                        $balSub->execute([
                            ':c' => $chainId, ':a' => $fromAddr,
                            ':b' => $blockNum, ':b2' => $blockNum,
                            ':v2' => $valueDec,
                        ]);
                    }
                    if (!$isBurn) {
                        $balAdd->execute([
                            ':c' => $chainId, ':a' => $toAddr,
                            ':v' => $valueDec, ':v2' => $valueDec,
                            ':b' => $blockNum, ':b2' => $blockNum,
                        ]);
                    }
                }

                splc_advance_cursor($pdo, $chainId, 'transfers', $to);
                $pdo->commit();
            } catch (Throwable $e) {
                if ($pdo->inTransaction()) $pdo->rollBack();
                fwrite(STDERR, "[chain {$chainId}] transfers batch {$from}-{$to} failed: {$e->getMessage()}\n");
                break;
            }

            $n = count($logs);
            echo "[chain {$chainId}] transfers {$from}-{$to} : {$n} event(s)\n";
            $processed += ($to - $from + 1);
        }
    }
}
