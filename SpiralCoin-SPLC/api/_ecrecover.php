<?php
/* =============================================================================
 * SpiralCoin — EIP-191 / personal_sign signature recovery
 * -----------------------------------------------------------------------------
 * Recovers an Ethereum address from a signed message + 65-byte signature.
 * Used by /api/bind-wallet.php to prove the caller controls the wallet they
 * claim to bind.
 *
 * Requires composer deps:
 *   simplito/elliptic-php  (secp256k1)
 *   kornrunner/keccak      (Keccak-256)
 *
 * Public function:
 *   splc_ecrecover(string $message, string $signatureHex): ?string
 *     Returns lowercase 0x-prefixed 40-char address, or null on failure.
 * =============================================================================
 */

declare(strict_types=1);

$autoload = __DIR__ . '/../vendor/autoload.php';
if (!is_file($autoload)) {
    // Vendor not deployed yet — caller should treat this as "ECDSA unavailable".
    return;
}
require_once $autoload;

use Elliptic\EC;
use kornrunner\Keccak;

/**
 * Recover Ethereum address that signed an EIP-191 ("personal_sign") message.
 *
 * @param string $message       The original UTF-8 message that was signed.
 * @param string $signatureHex  65-byte hex signature, with or without 0x prefix
 *                              (r || s || v, where v ∈ {0,1,27,28}).
 * @return ?string Lowercase 0x-prefixed 40-char address, or null on failure.
 */
function splc_ecrecover(string $message, string $signatureHex): ?string
{
    try {
        $sig = strtolower($signatureHex);
        if (strncmp($sig, '0x', 2) === 0) $sig = substr($sig, 2);
        if (strlen($sig) !== 130 || !ctype_xdigit($sig)) return null;

        $r = substr($sig, 0, 64);
        $s = substr($sig, 64, 64);
        $v = hexdec(substr($sig, 128, 2));
        // Normalize recovery id to {0,1}
        if ($v >= 27) $v -= 27;
        if ($v !== 0 && $v !== 1) return null;

        // EIP-191 prefix hash
        $prefixed = "\x19Ethereum Signed Message:\n" . strlen($message) . $message;
        $hash     = Keccak::hash($prefixed, 256);

        $ec  = new EC('secp256k1');
        $key = $ec->recoverPubKey($hash, ['r' => $r, 's' => $s], $v);

        // Uncompressed pubkey: 0x04 || X(32) || Y(32). Drop 0x04 byte, then
        // address = last 20 bytes of keccak256(X||Y).
        $pubHex = $key->encode('hex');
        if (strncmp($pubHex, '04', 2) === 0) $pubHex = substr($pubHex, 2);
        if (strlen($pubHex) !== 128) return null;

        $pubBin   = hex2bin($pubHex);
        if ($pubBin === false) return null;
        $addrHash = Keccak::hash($pubBin, 256);
        $address  = '0x' . substr($addrHash, -40);

        return strtolower($address);
    } catch (\Throwable $e) {
        return null;
    }
}
