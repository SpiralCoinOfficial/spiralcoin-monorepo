<?php
/**
 * Governance indexer — ProposalCreated + VoteCast events from `dao` contracts.
 *
 * Writes to:
 *   - proposals (one row per ProposalCreated; description/state filled later)
 *   - votes     (one row per VoteCast)
 *
 * NOTE: ProposalCreated decoding only extracts proposalId + proposer. The
 * dynamic arrays (targets/values/signatures/calldatas/description) are skipped
 * because they vary per OZ Governor version; a follow-up enrichment script
 * can call governor.state(id) / proposalSnapshot(id) / proposalDeadline(id).
 */

declare(strict_types=1);

require_once __DIR__ . '/db.php';
require_once __DIR__ . '/rpc.php';
require_once __DIR__ . '/abi.php';

function index_votes(array $config): void {
    $pdo = splc_db($config);

    $daos = $pdo->query(
        "SELECT chain_id, address, deployed_block
           FROM contracts
          WHERE kind = 'dao'
          ORDER BY chain_id"
    )->fetchAll();

    foreach ($daos as $d) {
        $chainId    = (int)$d['chain_id'];
        $daoAddr    = strtolower($d['address']);
        $startFloor = (int)($d['deployed_block'] ?? 0);

        $rpcUrl = $config['rpc'][$chainId] ?? null;
        if (!$rpcUrl || str_contains($rpcUrl, '__ALCHEMY_KEY__')) continue;

        try { $head = rpc_block_number($rpcUrl, $config['request_timeout']); }
        catch (Throwable $e) { fwrite(STDERR, "[chain {$chainId}] head: {$e->getMessage()}\n"); continue; }

        $processed = 0;
        while ($processed < $config['max_blocks_per_run']) {
            $range = splc_claim_range(
                $pdo, $chainId, 'votes',
                $head, $config['batch_size'], $config['confirmations'],
                $startFloor
            );
            if ($range === null) break;
            [$from, $to] = $range;

            try {
                $logs = rpc_get_logs(
                    $rpcUrl, $from, $to, [$daoAddr],
                    [TOPIC_PROPOSAL_CREATED, TOPIC_VOTE_CAST],
                    $config['request_timeout']
                );

                $insProp = $pdo->prepare(
                    "INSERT INTO proposals (chain_id, proposal_id, proposer, state, created_at)
                     VALUES (:c, :pid, :p, 'pending', CURRENT_TIMESTAMP)
                     ON DUPLICATE KEY UPDATE proposer = VALUES(proposer)"
                );
                // Tally totals on the proposal row
                $tallyProp = $pdo->prepare(
                    "UPDATE proposals
                        SET for_wei     = for_wei     + IF(:sup = 1, CAST(:w AS DECIMAL(65,0)), 0),
                            against_wei = against_wei + IF(:sup = 0, CAST(:w AS DECIMAL(65,0)), 0),
                            abstain_wei = abstain_wei + IF(:sup = 2, CAST(:w AS DECIMAL(65,0)), 0)
                      WHERE chain_id = :c AND proposal_id = :pid"
                );
                $insVote = $pdo->prepare(
                    "INSERT INTO votes
                        (proposal_pk, voter, support, weight_wei, reason, tx_hash, block_number, created_at)
                     VALUES (:pk, :v, :sup, :w, :r, :h, :b, CURRENT_TIMESTAMP)
                     ON DUPLICATE KEY UPDATE
                        weight_wei = VALUES(weight_wei),
                        support    = VALUES(support),
                        reason     = VALUES(reason)"
                );
                $selProp = $pdo->prepare(
                    "SELECT id FROM proposals WHERE chain_id = :c AND proposal_id = :pid"
                );

                foreach ($logs as $log) {
                    $topic0   = strtolower($log['topics'][0]);
                    $data     = substr($log['data'], 2);

                    if ($topic0 === TOPIC_PROPOSAL_CREATED) {
                        // data layout: [0..63]=proposalId, [64..127]=proposer (padded address)
                        $propId   = hex_to_dec(substr($data, 0, 64));
                        $proposer = '0x' . substr(substr($data, 64, 64), -40);
                        $insProp->execute([
                            ':c' => $chainId, ':pid' => $propId,
                            ':p' => strtolower($proposer),
                        ]);
                    } elseif ($topic0 === TOPIC_VOTE_CAST) {
                        // topics[1] = voter (indexed)
                        // data: [0..63]=proposalId, [64..127]=support(uint8 padded),
                        //       [128..191]=weight, [192..255]=offset(0x80),
                        //       [256..319]=reason length, [320..]=reason bytes
                        $voter    = strtolower('0x' . substr($log['topics'][1], -40));
                        $propId   = hex_to_dec(substr($data, 0, 64));
                        $support  = (int)hex_to_dec(substr($data, 64, 64));
                        $weight   = hex_to_dec(substr($data, 128, 64));
                        $reason   = '';
                        if (strlen($data) >= 320) {
                            $rlen = (int)hex_to_dec(substr($data, 256, 64));
                            if ($rlen > 0 && strlen($data) >= 320 + $rlen * 2) {
                                $reason = hex2bin(substr($data, 320, $rlen * 2)) ?: '';
                                $reason = mb_substr($reason, 0, 500); // schema cap
                            }
                        }

                        // Ensure proposal exists (some chains may emit votes
                        // before we've processed ProposalCreated — defensive insert).
                        $insProp->execute([
                            ':c' => $chainId, ':pid' => $propId,
                            ':p' => '0x0000000000000000000000000000000000000000',
                        ]);
                        $selProp->execute([':c' => $chainId, ':pid' => $propId]);
                        $row = $selProp->fetch();
                        if (!$row) continue;
                        $proposalPk = (int)$row['id'];

                        $insVote->execute([
                            ':pk' => $proposalPk, ':v' => $voter,
                            ':sup' => $support, ':w' => $weight, ':r' => $reason,
                            ':h' => strtolower($log['transactionHash']),
                            ':b' => hexdec($log['blockNumber']),
                        ]);
                        $tallyProp->execute([
                            ':c' => $chainId, ':pid' => $propId,
                            ':sup' => $support, ':w' => $weight,
                        ]);
                    }
                }

                splc_advance_cursor($pdo, $chainId, 'votes', $to);
                $pdo->commit();
            } catch (Throwable $e) {
                if ($pdo->inTransaction()) $pdo->rollBack();
                fwrite(STDERR, "[chain {$chainId}] votes batch {$from}-{$to}: {$e->getMessage()}\n");
                break;
            }

            $n = count($logs);
            echo "[chain {$chainId}] votes     {$from}-{$to} : {$n} event(s)\n";
            $processed += ($to - $from + 1);
        }
    }
}
