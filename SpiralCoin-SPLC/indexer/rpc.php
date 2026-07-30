<?php
/**
 * Minimal JSON-RPC client for EVM chains. cURL only.
 */

declare(strict_types=1);

class RpcException extends RuntimeException {}

function rpc_call(string $url, string $method, array $params, int $timeout = 30) {
    static $id = 0;
    $payload = json_encode([
        'jsonrpc' => '2.0',
        'id'      => ++$id,
        'method'  => $method,
        'params'  => $params,
    ], JSON_UNESCAPED_SLASHES);

    return _rpc_http($url, $payload, $timeout)['result'] ?? null;
}

/**
 * JSON-RPC batch. $calls = [['method'=>..,'params'=>..], ...]
 * Returns array of results, indexed by the same order as $calls.
 */
function rpc_batch(string $url, array $calls, int $timeout = 30): array {
    if (empty($calls)) return [];
    static $id = 100000;
    $payload = [];
    $idMap = [];
    foreach ($calls as $i => $c) {
        $rid = ++$id;
        $idMap[$rid] = $i;
        $payload[] = [
            'jsonrpc' => '2.0',
            'id'      => $rid,
            'method'  => $c['method'],
            'params'  => $c['params'],
        ];
    }
    $body = json_encode($payload, JSON_UNESCAPED_SLASHES);

    $resp = _rpc_http_raw($url, $body, $timeout);
    $data = json_decode($resp, true);
    if (!is_array($data)) {
        throw new RpcException("Non-JSON batch response: " . substr($resp, 0, 500));
    }
    $out = array_fill(0, count($calls), null);
    foreach ($data as $item) {
        if (!isset($item['id'])) continue;
        $idx = $idMap[$item['id']] ?? null;
        if ($idx === null) continue;
        if (isset($item['error'])) {
            throw new RpcException("RPC error in batch[{$idx}]: " . ($item['error']['message'] ?? 'unknown'));
        }
        $out[$idx] = $item['result'] ?? null;
    }
    return $out;
}

function _rpc_http(string $url, string $payload, int $timeout): array {
    $resp = _rpc_http_raw($url, $payload, $timeout);
    $data = json_decode($resp, true);
    if (!is_array($data)) {
        throw new RpcException("Non-JSON response: " . substr($resp, 0, 500));
    }
    if (isset($data['error'])) {
        $msg = $data['error']['message'] ?? json_encode($data['error']);
        throw new RpcException("RPC error: {$msg}");
    }
    return $data;
}

function _rpc_http_raw(string $url, string $payload, int $timeout): string {
    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_POST           => true,
        CURLOPT_POSTFIELDS     => $payload,
        CURLOPT_HTTPHEADER     => ['Content-Type: application/json', 'Accept: application/json'],
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT        => $timeout,
        CURLOPT_CONNECTTIMEOUT => 10,
        CURLOPT_SSL_VERIFYPEER => true,
        CURLOPT_SSL_VERIFYHOST => 2,
    ]);
    $resp = curl_exec($ch);
    if ($resp === false) {
        $err = curl_error($ch); curl_close($ch);
        throw new RpcException("cURL error: {$err}");
    }
    $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    if ($code < 200 || $code >= 300) {
        throw new RpcException("HTTP {$code}: " . substr($resp, 0, 500));
    }
    return $resp;
}

function rpc_block_number(string $url, int $timeout = 30): int {
    $hex = rpc_call($url, 'eth_blockNumber', [], $timeout);
    return hexdec(substr($hex, 2));
}

/**
 * @param string[] $addresses lowercase 0x-prefixed addresses
 * @param string[] $topic0    event signature hashes
 */
function rpc_get_logs(string $url, int $fromBlock, int $toBlock, array $addresses, array $topic0, int $timeout = 30): array {
    $params = [[
        'fromBlock' => '0x' . dechex($fromBlock),
        'toBlock'   => '0x' . dechex($toBlock),
        'address'   => $addresses,
        'topics'    => [$topic0],
    ]];
    $res = rpc_call($url, 'eth_getLogs', $params, $timeout);
    return is_array($res) ? $res : [];
}

/**
 * Fetch UTC timestamps (unix seconds) for a list of block numbers.
 * Uses a single batched JSON-RPC call. Returns map blockNum => timestamp.
 */
function rpc_block_timestamps(string $url, array $blockNums, int $timeout = 30): array {
    $blockNums = array_values(array_unique(array_map('intval', $blockNums)));
    if (empty($blockNums)) return [];

    $calls = [];
    foreach ($blockNums as $n) {
        $calls[] = [
            'method' => 'eth_getBlockByNumber',
            'params' => ['0x' . dechex($n), false],
        ];
    }
    $results = rpc_batch($url, $calls, $timeout);

    $out = [];
    foreach ($blockNums as $i => $n) {
        $blk = $results[$i] ?? null;
        if (is_array($blk) && isset($blk['timestamp'])) {
            $out[$n] = hexdec(substr($blk['timestamp'], 2));
        }
    }
    return $out;
}
