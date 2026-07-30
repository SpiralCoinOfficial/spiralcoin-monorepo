<?php
/* =============================================================================
 * SpiralCoin — Public site status / aggregate stats
 * -----------------------------------------------------------------------------
 *  GET /api/site-status.php
 *
 *  Single read-only endpoint for the home page hero, embed widgets, and
 *  external monitoring. Aggregates publicly safe numbers only.
 *
 *  No SQL dependency (works on IONOS shared hosting). Reads:
 *    - private/sponsor-events.jsonl  (replayed for active sponsors / raised)
 *    - private/wallet-bindings.json  (count only — no PII surfaced)
 *
 *  Optional inline cache: 60s public.
 * ============================================================================= */

declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: public, max-age=60');
header('X-Content-Type-Options: nosniff');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET');

$root = __DIR__ . '/..';

// ---- Sponsors ---------------------------------------------------------------
$sponsorsLog = $root . '/private/sponsor-events.jsonl';
$optoutFile  = $root . '/private/sponsor-optout.json';
$optouts     = [];
if (is_readable($optoutFile)) {
    $tmp = json_decode((string)file_get_contents($optoutFile), true);
    if (is_array($tmp)) $optouts = array_map('strtolower', $tmp);
}

$active = [];
if (is_readable($sponsorsLog)) {
    $h = @fopen($sponsorsLog, 'r');
    if ($h) {
        while (($line = fgets($h)) !== false) {
            $line = trim($line);
            if ($line === '') continue;
            $rec = json_decode($line, true);
            if (!is_array($rec)) continue;

            $action = $rec['action'] ?? null;
            $login  = $rec['sponsor'] ?? null;
            if (!$login) continue;

            if (in_array($action, ['created', 'edited', 'tier_changed'], true)) {
                $active[$login] = [
                    'amount'   => $rec['amount']   ?? null,
                    'one_time' => (bool)($rec['one_time'] ?? false),
                ];
            } elseif ($action === 'cancelled') {
                unset($active[$login]);
            }
        }
        fclose($h);
    }
}

$totalSponsors = count($active);
$publicSponsors = 0;
$raisedUsd = 0;
foreach ($active as $login => $s) {
    if (!in_array(strtolower($login), $optouts, true)) {
        $publicSponsors++;
    }
    if ($s['one_time'] && $s['amount']) {
        $raisedUsd += (int)$s['amount'];
    }
}

// ---- Wallets (count only) ---------------------------------------------------
$walletFile  = $root . '/private/wallet-bindings.json';
$walletCount = 0;
if (is_readable($walletFile)) {
    $w = json_decode((string)file_get_contents($walletFile), true);
    if (is_array($w)) $walletCount = count($w);
}

// ---- Output -----------------------------------------------------------------
echo json_encode([
    'site' => [
        'name'       => 'SpiralCoin',
        'env'        => 'production',
        'phase'      => 'pre-launch',
        'updated_at' => gmdate('c'),
    ],
    'sponsors' => [
        'public'             => $publicSponsors,
        'total'              => $totalSponsors,
        'raised_usd'         => $raisedUsd,
        'goal_usd'           => 120_000,
        'goal_count'         => 10,
        'percent_to_goal'    => $raisedUsd ? round(($raisedUsd / 120_000) * 100, 2) : 0,
        'tier_amount_usd'    => 12_000,
    ],
    'wallets' => [
        'bound_count' => $walletCount,
    ],
    'chain' => [
        'network'         => 'arbitrum-one',
        'chain_id'        => 42161,
        'splc_token'      => null, // populated post-deploy
        'lp_pool'         => null,
        'lock_contract'   => null,
    ],
], JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT);
