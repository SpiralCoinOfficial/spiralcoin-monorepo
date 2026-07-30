<?php
/**
 * SpiralCoin indexer config
 *
 * SECURITY: This file is gitignored. Copy config.example.php to config.php
 * on the IONOS host, fill in the secrets, and never commit it.
 *
 * The indexer auto-detects which DB to use based on SPLC_ENV:
 *   - "testnet" -> connects to dbs15711921, indexes Sepolia + Arb Sepolia
 *   - "mainnet" -> connects to dbs15711971, indexes Ethereum + Arbitrum + Polygon + Base
 */

return [
    // ============================================================
    // Environment switch: 'testnet' or 'mainnet'
    // ============================================================
    'env' => getenv('SPLC_ENV') ?: 'testnet',

    // ============================================================
    // Database connections (one per env)
    // ============================================================
    'databases' => [
        'testnet' => [
            'host'     => 'db5020529487.hosting-data.io',
            'port'     => 3306,
            'name'     => 'dbs15711921',
            'user'     => 'dbu1479504',
            'password' => '__FILL_IN__',
        ],
        'mainnet' => [
            'host'     => 'db5020529589.hosting-data.io',
            'port'     => 3306,
            'name'     => 'dbs15711971',
            'user'     => 'dbu4105523',
            'password' => '__FILL_IN__',
        ],
    ],

    // ============================================================
    // RPC endpoints (one per chain_id)
    // Use Alchemy / Infura / public RPC. HTTPS only.
    // ============================================================
    'rpc' => [
        // --- Testnets ---
        11155111 => 'https://eth-sepolia.g.alchemy.com/v2/__ALCHEMY_KEY__',
        421614   => 'https://arb-sepolia.g.alchemy.com/v2/__ALCHEMY_KEY__',
        // --- Mainnets ---
        1     => 'https://eth-mainnet.g.alchemy.com/v2/__ALCHEMY_KEY__',
        42161 => 'https://arb-mainnet.g.alchemy.com/v2/__ALCHEMY_KEY__',
        137   => 'https://polygon-mainnet.g.alchemy.com/v2/__ALCHEMY_KEY__',
        8453  => 'https://base-mainnet.g.alchemy.com/v2/__ALCHEMY_KEY__',
    ],

    // ============================================================
    // Indexer tuning
    // ============================================================
    'batch_size'        => 1000,   // blocks per getLogs call (Alchemy max 10k, but stay safe)
    'confirmations'     => 5,      // wait N blocks behind head for reorg safety
    'max_blocks_per_run' => 50000, // hard cap per cron invocation
    'request_timeout'   => 30,     // seconds per RPC call

    // Required when calling cron.php via HTTPS (?secret=...).
    // Generate with: php -r "echo bin2hex(random_bytes(32));"
    'cron_secret'       => '__FILL_IN_LONG_RANDOM__',
];
