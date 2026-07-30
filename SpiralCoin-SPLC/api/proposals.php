<?php
/**
 * GET /api/proposals.php?env=testnet&chain=11155111&state=active&limit=20
 *   -> { items: [...] }
 *
 * Optional ?id=<proposal_id> returns a single proposal with its votes.
 */

declare(strict_types=1);
require __DIR__ . '/_bootstrap.php';

$chainId = api_chain_id();
$limit   = api_int('limit', 20, 1, 100);

if (!empty($_GET['id'])) {
    $pid = trim((string)$_GET['id']);
    if (!preg_match('/^[0-9a-zA-Z_\-]{1,80}$/', $pid)) api_fail('invalid id', 400);

    $stmt = $pdo->prepare(
        'SELECT * FROM proposals WHERE chain_id = :c AND proposal_id = :p'
    );
    $stmt->execute([':c' => $chainId, ':p' => $pid]);
    $prop = $stmt->fetch();
    if (!$prop) api_fail('proposal not found', 404);

    $vstmt = $pdo->prepare(
        'SELECT voter, support, weight_wei, reason, tx_hash, block_number, created_at
           FROM votes
          WHERE proposal_pk = :pk
          ORDER BY block_number DESC, id DESC
          LIMIT 200'
    );
    $vstmt->execute([':pk' => (int)$prop['id']]);
    $prop['votes'] = $vstmt->fetchAll();
    api_json($prop);
}

$state = $_GET['state'] ?? null;
$allowedStates = ['pending','active','canceled','defeated','succeeded','queued','expired','executed'];
$where = 'chain_id = :c';
$params = [':c' => $chainId];
if ($state && in_array($state, $allowedStates, true)) {
    $where .= ' AND state = :s';
    $params[':s'] = $state;
}

$stmt = $pdo->prepare(
    "SELECT id, proposal_id, proposer, title, state,
            for_wei, against_wei, abstain_wei,
            start_ts, end_ts, created_at
       FROM proposals
      WHERE {$where}
      ORDER BY id DESC
      LIMIT " . (int)$limit
);
$stmt->execute($params);
api_json(['items' => $stmt->fetchAll()]);
