<?php
/**
 * Database connection helper + cursor management.
 *
 * splc_claim_range() opens a DB transaction and SELECT...FOR UPDATEs the
 * indexer_state row. Caller MUST either splc_advance_cursor() + $pdo->commit(),
 * or $pdo->rollBack() on error. The lock prevents two cron runs colliding.
 */

declare(strict_types=1);

function splc_db(array $config): PDO {
    static $pdo = null;
    if ($pdo !== null) return $pdo;

    $env = $config['env'];
    if (!isset($config['databases'][$env])) {
        throw new RuntimeException("Unknown SPLC_ENV: {$env}");
    }
    $db = $config['databases'][$env];

    $dsn = sprintf(
        'mysql:host=%s;port=%d;dbname=%s;charset=utf8mb4',
        $db['host'], $db['port'], $db['name']
    );
    $pdo = new PDO($dsn, $db['user'], $db['password'], [
        PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES   => false,
        PDO::MYSQL_ATTR_INIT_COMMAND => "SET NAMES utf8mb4, time_zone = '+00:00'",
    ]);
    return $pdo;
}

/**
 * Atomically claim the next [from,to] block range for (chain, stream).
 * Opens a transaction and holds a row lock.
 *
 * Returns null if nothing to do (no open txn in that case).
 * On success, caller owns the open transaction.
 */
function splc_claim_range(PDO $pdo, int $chainId, string $stream, int $headBlock, int $batchSize, int $confirmations, int $startFloor = 0): ?array {
    $safeHead = $headBlock - $confirmations;
    if ($safeHead < 0) return null;

    $pdo->beginTransaction();
    try {
        $sel = $pdo->prepare(
            'SELECT last_block FROM indexer_state
              WHERE chain_id = :c AND stream = :s
              FOR UPDATE'
        );
        $sel->execute([':c' => $chainId, ':s' => $stream]);
        $cur = $sel->fetch();
        if (!$cur) {
            $pdo->rollBack();
            return null;
        }
        $lastBlock = (int)$cur['last_block'];
        $from = max($lastBlock + 1, $startFloor);
        if ($from > $safeHead) {
            $pdo->commit();
            return null;
        }
        $to = min($from + $batchSize - 1, $safeHead);
        return [$from, $to];
    } catch (Throwable $e) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        throw $e;
    }
}

/**
 * Advance the cursor (call inside the same txn opened by splc_claim_range).
 */
function splc_advance_cursor(PDO $pdo, int $chainId, string $stream, int $toBlock): void {
    $stmt = $pdo->prepare(
        'UPDATE indexer_state
            SET last_block = :b, updated_at = CURRENT_TIMESTAMP
          WHERE chain_id = :c AND stream = :s'
    );
    $stmt->execute([':b' => $toBlock, ':c' => $chainId, ':s' => $stream]);
}
