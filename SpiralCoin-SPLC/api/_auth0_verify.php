<?php
/* =============================================================================
 * SpiralCoin — Shared Auth0 JWT verifier
 * -----------------------------------------------------------------------------
 *  Provides splc_verify_auth0_bearer(): validates the Authorization: Bearer
 *  ID token against the Auth0 tenant's JWKS (RS256, openssl-only — no
 *  Composer). On failure, sends an appropriate HTTP error and exit()s.
 *  On success, returns the decoded payload array (claims).
 *
 *  Used by:  api/bind-wallet.php, api/wallet-nonce.php
 * ============================================================================= */

declare(strict_types=1);

const SPLC_AUTH0_DOMAIN    = 'dev-t6gnxzv48a8g4ny3.us.auth0.com';
const SPLC_AUTH0_CLIENT_ID = 'hKf1O2BMMiDhlYmwOwaqk4jv07zHVJEB';
const SPLC_JWKS_TTL        = 86400;

if (!function_exists('splc_b64url_decode')) {
    function splc_b64url_decode(string $s): string {
        $pad = strlen($s) % 4;
        if ($pad) $s .= str_repeat('=', 4 - $pad);
        return base64_decode(strtr($s, '-_', '+/'));
    }
}

if (!function_exists('splc_asn1_len_encode')) {
    function splc_asn1_len_encode(int $n): string {
        if ($n < 0x80) return chr($n);
        $bytes = '';
        while ($n > 0) { $bytes = chr($n & 0xff) . $bytes; $n >>= 8; }
        return chr(0x80 | strlen($bytes)) . $bytes;
    }
}

if (!function_exists('splc_asn1_int')) {
    function splc_asn1_int(string $bin): string {
        if (ord($bin[0]) & 0x80) $bin = "\x00" . $bin;
        return chr(0x02) . splc_asn1_len_encode(strlen($bin)) . $bin;
    }
}

if (!function_exists('splc_jwks_to_pem')) {
    function splc_jwks_to_pem(array $key): string {
        $n_int = splc_asn1_int(splc_b64url_decode($key['n']));
        $e_int = splc_asn1_int(splc_b64url_decode($key['e']));
        $rsaSeq = chr(0x30) . splc_asn1_len_encode(strlen($n_int) + strlen($e_int)) . $n_int . $e_int;
        $algId  = "\x30\x0d\x06\x09\x2a\x86\x48\x86\xf7\x0d\x01\x01\x01\x05\x00";
        $bitStr = chr(0x03) . splc_asn1_len_encode(strlen($rsaSeq) + 1) . "\x00" . $rsaSeq;
        $spki   = chr(0x30) . splc_asn1_len_encode(strlen($algId) + strlen($bitStr)) . $algId . $bitStr;
        return "-----BEGIN PUBLIC KEY-----\n"
             . chunk_split(base64_encode($spki), 64, "\n")
             . "-----END PUBLIC KEY-----\n";
    }
}

if (!function_exists('splc_verify_auth0_bearer')) {
    function splc_verify_auth0_bearer(): array {
        $authz = $_SERVER['HTTP_AUTHORIZATION'] ?? '';
        if (!preg_match('/^Bearer\s+(.+)$/i', $authz, $m)) {
            http_response_code(401);
            echo json_encode(['error' => 'Missing Bearer token']);
            exit;
        }
        $jwt   = trim($m[1]);
        $parts = explode('.', $jwt);
        if (count($parts) !== 3) {
            http_response_code(401);
            echo json_encode(['error' => 'Malformed JWT']);
            exit;
        }

        $header  = json_decode(splc_b64url_decode($parts[0]), true);
        $payload = json_decode(splc_b64url_decode($parts[1]), true);
        $sigBin  = splc_b64url_decode($parts[2]);
        if (!is_array($header) || !is_array($payload)) {
            http_response_code(401);
            echo json_encode(['error' => 'Bad JWT segments']);
            exit;
        }
        if (($header['alg'] ?? '') !== 'RS256') {
            http_response_code(401);
            echo json_encode(['error' => 'Unsupported alg']);
            exit;
        }
        $kid = $header['kid'] ?? null;
        if (!$kid) {
            http_response_code(401);
            echo json_encode(['error' => 'Missing kid']);
            exit;
        }

        // JWKS (cached 24h)
        $cache = __DIR__ . '/../private/auth0-jwks.cache.json';
        $jwks  = null;
        if (is_file($cache) && (time() - filemtime($cache) < SPLC_JWKS_TTL)) {
            $jwks = json_decode((string)file_get_contents($cache), true);
        }
        if (!is_array($jwks)) {
            $ctx  = stream_context_create(['http' => ['timeout' => 5, 'header' => "User-Agent: SpiralCoin/1.0\r\n"]]);
            $resp = @file_get_contents('https://' . SPLC_AUTH0_DOMAIN . '/.well-known/jwks.json', false, $ctx);
            if (!$resp) {
                http_response_code(503);
                echo json_encode(['error' => 'Could not fetch JWKS']);
                exit;
            }
            $jwks = json_decode($resp, true);
            if (!is_array($jwks)) {
                http_response_code(503);
                echo json_encode(['error' => 'Bad JWKS payload']);
                exit;
            }
            @mkdir(dirname($cache), 0750, true);
            @file_put_contents($cache, $resp, LOCK_EX);
        }

        $pem = null;
        foreach (($jwks['keys'] ?? []) as $k) {
            if (($k['kid'] ?? '') === $kid && ($k['kty'] ?? '') === 'RSA') {
                $pem = splc_jwks_to_pem($k);
                break;
            }
        }
        if (!$pem) {
            http_response_code(401);
            echo json_encode(['error' => 'Signing key not found']);
            exit;
        }

        $signingInput = $parts[0] . '.' . $parts[1];
        $ok = openssl_verify($signingInput, $sigBin, $pem, OPENSSL_ALGO_SHA256);
        if ($ok !== 1) {
            http_response_code(401);
            echo json_encode(['error' => 'JWT signature invalid']);
            exit;
        }

        $now = time();
        if (($payload['iss'] ?? '') !== 'https://' . SPLC_AUTH0_DOMAIN . '/') {
            http_response_code(401); echo json_encode(['error' => 'Bad iss']); exit;
        }
        if (($payload['aud'] ?? '') !== SPLC_AUTH0_CLIENT_ID) {
            http_response_code(401); echo json_encode(['error' => 'Bad aud']); exit;
        }
        if (($payload['exp'] ?? 0) < $now) {
            http_response_code(401); echo json_encode(['error' => 'Token expired']); exit;
        }
        if (($payload['iat'] ?? 0) > $now + 60) {
            http_response_code(401); echo json_encode(['error' => 'Token in future']); exit;
        }

        return $payload;
    }
}
