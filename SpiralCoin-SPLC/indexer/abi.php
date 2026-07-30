<?php
/**
 * Event signature hashes (topic0 values) used by the indexer.
 *
 * Each one is keccak256 of the canonical event signature.
 * These are constants of the ABI; do NOT recompute at runtime.
 */

declare(strict_types=1);

// ERC20 Transfer(address indexed from, address indexed to, uint256 value)
const TOPIC_TRANSFER = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';

// SpiralVault Staked(address indexed user, uint256 amount, uint256 lockUntil)
const TOPIC_STAKED = '0x9e71bc8eea02a63969f509818f2dafb9254532904319f9dbda79b67bd34a5f3d';

// SpiralVault Unstaked(address indexed user, uint256 amount)
const TOPIC_UNSTAKED = '0x0f5bb82176feb1b5e747e28471aa92156a04d9f3ab9f45f28e2d704232b93f75';

// Governor ProposalCreated(uint256 proposalId, address proposer, ...)
const TOPIC_PROPOSAL_CREATED = '0x7d84a6263ae0d98d3329bd7b46bb4e8d6f98cd35a7adb45c274c8b7fd5ebd5e0';

// Governor VoteCast(address indexed voter, uint256 proposalId, uint8 support, uint256 weight, string reason)
const TOPIC_VOTE_CAST = '0xb8e138887d0aa13bab447e82de9d5c1777041ecd21ca36ba824ff1e6c07ddda4';

/**
 * Decode an ERC20 Transfer log into [from, to, value_dec_string].
 * `value` is returned as a decimal string (preserves 256-bit precision).
 */
function decode_transfer(array $log): array {
    // topics: [sig, from, to]
    $from  = '0x' . substr($log['topics'][1], -40);
    $to    = '0x' . substr($log['topics'][2], -40);
    $value = hex_to_dec(substr($log['data'], 2));
    return [strtolower($from), strtolower($to), $value];
}

/**
 * Convert arbitrary-length hex (no 0x prefix) to a decimal string.
 * Pure PHP (no GMP/BCMath required by signature, but uses BCMath if available).
 */
function hex_to_dec(string $hex): string {
    if ($hex === '' || $hex === '0') return '0';
    $hex = ltrim($hex, '0');
    if ($hex === '') return '0';

    if (function_exists('bcadd')) {
        $dec = '0';
        $len = strlen($hex);
        for ($i = 0; $i < $len; $i++) {
            $dec = bcmul($dec, '16', 0);
            $dec = bcadd($dec, (string)hexdec($hex[$i]), 0);
        }
        return $dec;
    }
    // Fallback: long division (slow but works)
    $dec = '0';
    foreach (str_split($hex) as $c) {
        $dec = str_mul($dec, '16');
        $dec = str_add($dec, (string)hexdec($c));
    }
    return $dec;
}

function str_add(string $a, string $b): string {
    $i = strlen($a) - 1; $j = strlen($b) - 1; $carry = 0; $out = '';
    while ($i >= 0 || $j >= 0 || $carry) {
        $da = $i >= 0 ? (int)$a[$i--] : 0;
        $db = $j >= 0 ? (int)$b[$j--] : 0;
        $s = $da + $db + $carry;
        $carry = intdiv($s, 10);
        $out = ($s % 10) . $out;
    }
    return $out;
}

function str_mul(string $a, string $m): string {
    $out = ''; $carry = 0; $mi = (int)$m;
    for ($i = strlen($a) - 1; $i >= 0; $i--) {
        $p = ((int)$a[$i]) * $mi + $carry;
        $carry = intdiv($p, 10);
        $out = ($p % 10) . $out;
    }
    while ($carry) { $out = ($carry % 10) . $out; $carry = intdiv($carry, 10); }
    return $out === '' ? '0' : $out;
}
