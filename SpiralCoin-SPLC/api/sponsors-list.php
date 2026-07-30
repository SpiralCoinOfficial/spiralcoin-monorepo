<?php
/**
 * SpiralCoin — sponsor recognition read endpoint
 * -----------------------------------------------------------------
 * GET /api/sponsors-list.php
 *
 * Reads private/sponsor-events.jsonl (written by sponsor-webhook.php),
 * computes the current active sponsor set (events are
 * created/cancelled/tier_changed/edited per GitHub Sponsors spec),
 * and returns a public-safe JSON list for the contributors page.
 *
 * Public output only includes: login, avatar URL, tier name, is_one_time,
 * monthly amount, since (ISO date). No emails, no internal fields,
 * no raw payloads.
 *
 * Caches in memory via 60-second response header for cheap reads.
 * Returns empty array if log doesn't exist yet (pre-launch state).
 * ----------------------------------------------------------------- */

declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: public, max-age=60');
header('X-Content-Type-Options: nosniff');
header('Access-Control-Allow-Origin: https://www.spiralcoin.net');
header('Access-Control-Allow-Methods: GET');

$logPath = __DIR__ . '/../private/sponsor-events.jsonl';
$optoutPath = __DIR__ . '/../private/sponsor-optout.json';

// Load opt-out list (sponsors who asked to be removed from the public wall).
// File format: JSON array of GitHub login strings, e.g.  ["octocat","ghost"]
$optouts = [];
if (is_readable($optoutPath)) {
    $tmp = json_decode((string)file_get_contents($optoutPath), true);
    if (is_array($tmp)) {
        $optouts = array_map('strtolower', $tmp);
    }
}

$current = []; // login => active sponsor record

if (is_readable($logPath)) {
    $handle = @fopen($logPath, 'r');
    if ($handle) {
        while (($line = fgets($handle)) !== false) {
            $line = trim($line);
            if ($line === '') continue;
            $rec = json_decode($line, true);
            if (!is_array($rec)) continue;

            $action = $rec['action'] ?? null;
            $login  = $rec['sponsor'] ?? null;
            if (!$login) continue;

            // GitHub Sponsors actions: created, cancelled, edited,
            // tier_changed, pending_cancellation, pending_tier_change
            if (in_array($action, ['created', 'edited', 'tier_changed'], true)) {
                // Pull avatar from raw payload if available
                $avatar = null;
                if (isset($rec['raw']) && is_array($rec['raw'])) {
                    $avatar = $rec['raw']['sponsorship']['sponsor']['avatar_url'] ?? null;
                }
                $current[$login] = [
                    'login'      => $login,
                    'avatar_url' => $avatar,
                    'tier'       => $rec['tier'] ?? null,
                    'one_time'   => (bool)($rec['one_time'] ?? false),
                    'amount'     => $rec['amount'] ?? null,
                    'since'      => $current[$login]['since'] ?? ($rec['ts'] ?? null),
                ];
            } elseif ($action === 'cancelled') {
                unset($current[$login]);
            }
        }
        fclose($handle);
    }
}

// Sort: one-time + biggest amount first
$list = array_values($current);
usort($list, function ($a, $b) {
    $aw = ($a['one_time'] ? 1_000_000 : 0) + (int)($a['amount'] ?? 0);
    $bw = ($b['one_time'] ? 1_000_000 : 0) + (int)($b['amount'] ?? 0);
    return $bw <=> $aw;
});

// Aggregate goal stats BEFORE applying opt-outs (financial total stays accurate
// even when individual sponsors are hidden from the public wall).
$totalRaised = 0;
$oneTimeCount = 0;
foreach ($list as $s) {
    if ($s['one_time'] && $s['amount']) {
        $totalRaised += (int)$s['amount'];
        $oneTimeCount++;
    }
}

// Apply opt-out filter to the publicly-displayed list only.
if (!empty($optouts)) {
    $list = array_values(array_filter($list, function ($s) use ($optouts) {
        return !in_array(strtolower($s['login']), $optouts, true);
    }));
}

echo json_encode([
    'sponsors'         => $list,
    'total_sponsors'   => count($list),
    'one_time_count'   => $oneTimeCount,
    'total_raised_usd' => $totalRaised,
    'goal_usd'         => 120_000,
    'goal_count'       => 10,
    'updated_at'       => gmdate('c'),
], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
