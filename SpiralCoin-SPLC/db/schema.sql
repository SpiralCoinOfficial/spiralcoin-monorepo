-- ============================================================
-- SpiralCoin platform schema (chain-agnostic)
-- Target: MySQL 8.0 (IONOS) / also works on MariaDB 10.5+
-- Charset: utf8mb4 / utf8mb4_unicode_ci
-- Import via phpMyAdmin: select DB -> Import -> upload this file
-- ============================================================

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- chains: networks this platform indexes
CREATE TABLE IF NOT EXISTS chains (
  chain_id        INT UNSIGNED      NOT NULL,
  name            VARCHAR(64)       NOT NULL,
  short_name      VARCHAR(32)       NOT NULL,
  is_testnet      TINYINT(1)        NOT NULL DEFAULT 0,
  explorer_url    VARCHAR(255)      NOT NULL,
  rpc_url         VARCHAR(255)      DEFAULT NULL,
  created_at      TIMESTAMP         NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (chain_id),
  UNIQUE KEY uq_chain_short (short_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- contracts: deployed SPLC / Vault / Timelock / DAO addresses per chain
CREATE TABLE IF NOT EXISTS contracts (
  id              BIGINT UNSIGNED   NOT NULL AUTO_INCREMENT,
  chain_id        INT UNSIGNED      NOT NULL,
  kind            ENUM('token','vault','timelock','dao') NOT NULL,
  address         CHAR(42)          NOT NULL,
  deployed_block  BIGINT UNSIGNED   DEFAULT NULL,
  deployed_tx     CHAR(66)          DEFAULT NULL,
  version         VARCHAR(16)       NOT NULL DEFAULT 'v2',
  verified        TINYINT(1)        NOT NULL DEFAULT 0,
  created_at      TIMESTAMP         NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_contract (chain_id, address),
  KEY idx_contract_kind (chain_id, kind),
  CONSTRAINT fk_contract_chain FOREIGN KEY (chain_id) REFERENCES chains(chain_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- users: platform accounts
CREATE TABLE IF NOT EXISTS users (
  id              BIGINT UNSIGNED   NOT NULL AUTO_INCREMENT,
  email           VARCHAR(190)      DEFAULT NULL,
  password_hash   VARCHAR(255)      DEFAULT NULL,
  display_name    VARCHAR(64)       DEFAULT NULL,
  kyc_status      ENUM('none','pending','approved','rejected') NOT NULL DEFAULT 'none',
  role            ENUM('user','admin','founder') NOT NULL DEFAULT 'user',
  is_active       TINYINT(1)        NOT NULL DEFAULT 1,
  created_at      TIMESTAMP         NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP         NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_user_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- wallets: addresses linked to a user
CREATE TABLE IF NOT EXISTS wallets (
  id              BIGINT UNSIGNED   NOT NULL AUTO_INCREMENT,
  user_id         BIGINT UNSIGNED   NOT NULL,
  address         CHAR(42)          NOT NULL,
  label           VARCHAR(64)       DEFAULT NULL,
  is_primary      TINYINT(1)        NOT NULL DEFAULT 0,
  verified_at     TIMESTAMP         NULL DEFAULT NULL,
  created_at      TIMESTAMP         NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_wallet_user_addr (user_id, address),
  KEY idx_wallet_address (address),
  CONSTRAINT fk_wallet_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- balances: cached SPLC balance per (chain, address)
CREATE TABLE IF NOT EXISTS balances (
  chain_id        INT UNSIGNED      NOT NULL,
  address         CHAR(42)          NOT NULL,
  balance_wei     DECIMAL(65,0)     NOT NULL DEFAULT 0,
  votes_wei       DECIMAL(65,0)     NOT NULL DEFAULT 0,
  delegate_to     CHAR(42)          DEFAULT NULL,
  last_block      BIGINT UNSIGNED   NOT NULL DEFAULT 0,
  updated_at      TIMESTAMP         NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (chain_id, address),
  KEY idx_bal_address (address),
  CONSTRAINT fk_bal_chain FOREIGN KEY (chain_id) REFERENCES chains(chain_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- transactions: indexed SPLC transfer log
CREATE TABLE IF NOT EXISTS transactions (
  id              BIGINT UNSIGNED   NOT NULL AUTO_INCREMENT,
  chain_id        INT UNSIGNED      NOT NULL,
  tx_hash         CHAR(66)          NOT NULL,
  log_index       INT UNSIGNED      NOT NULL,
  block_number    BIGINT UNSIGNED   NOT NULL,
  block_time      TIMESTAMP         NOT NULL,
  from_addr       CHAR(42)          NOT NULL,
  to_addr         CHAR(42)          NOT NULL,
  amount_wei      DECIMAL(65,0)     NOT NULL,
  kind            ENUM('transfer','mint','burn','stake','unstake','reward') NOT NULL DEFAULT 'transfer',
  PRIMARY KEY (id),
  UNIQUE KEY uq_tx_log (chain_id, tx_hash, log_index),
  KEY idx_tx_from (chain_id, from_addr, block_number),
  KEY idx_tx_to   (chain_id, to_addr, block_number),
  KEY idx_tx_block (chain_id, block_number),
  CONSTRAINT fk_tx_chain FOREIGN KEY (chain_id) REFERENCES chains(chain_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- staking_positions: per-user vault position
CREATE TABLE IF NOT EXISTS staking_positions (
  id              BIGINT UNSIGNED   NOT NULL AUTO_INCREMENT,
  chain_id        INT UNSIGNED      NOT NULL,
  staker_addr     CHAR(42)          NOT NULL,
  staked_wei      DECIMAL(65,0)     NOT NULL DEFAULT 0,
  rewards_wei     DECIMAL(65,0)     NOT NULL DEFAULT 0,
  last_action_block BIGINT UNSIGNED NOT NULL DEFAULT 0,
  updated_at      TIMESTAMP         NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_stake (chain_id, staker_addr),
  CONSTRAINT fk_stake_chain FOREIGN KEY (chain_id) REFERENCES chains(chain_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- proposals: DAO proposals
CREATE TABLE IF NOT EXISTS proposals (
  id              BIGINT UNSIGNED   NOT NULL AUTO_INCREMENT,
  chain_id        INT UNSIGNED      NOT NULL,
  proposal_id     VARCHAR(80)       NOT NULL,
  proposer        CHAR(42)          NOT NULL,
  title           VARCHAR(255)      DEFAULT NULL,
  description     MEDIUMTEXT        DEFAULT NULL,
  start_ts        TIMESTAMP         NULL DEFAULT NULL,
  end_ts          TIMESTAMP         NULL DEFAULT NULL,
  state           ENUM('pending','active','canceled','defeated','succeeded','queued','expired','executed') NOT NULL DEFAULT 'pending',
  for_wei         DECIMAL(65,0)     NOT NULL DEFAULT 0,
  against_wei     DECIMAL(65,0)     NOT NULL DEFAULT 0,
  abstain_wei     DECIMAL(65,0)     NOT NULL DEFAULT 0,
  created_at      TIMESTAMP         NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_prop (chain_id, proposal_id),
  CONSTRAINT fk_prop_chain FOREIGN KEY (chain_id) REFERENCES chains(chain_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- votes: individual vote receipts
CREATE TABLE IF NOT EXISTS votes (
  id              BIGINT UNSIGNED   NOT NULL AUTO_INCREMENT,
  proposal_pk     BIGINT UNSIGNED   NOT NULL,
  voter           CHAR(42)          NOT NULL,
  support         TINYINT UNSIGNED  NOT NULL,
  weight_wei      DECIMAL(65,0)     NOT NULL,
  reason          VARCHAR(500)      DEFAULT NULL,
  tx_hash         CHAR(66)          NOT NULL,
  block_number    BIGINT UNSIGNED   NOT NULL,
  created_at      TIMESTAMP         NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_vote (proposal_pk, voter),
  CONSTRAINT fk_vote_proposal FOREIGN KEY (proposal_pk) REFERENCES proposals(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- price_history: SPLC price points
CREATE TABLE IF NOT EXISTS price_history (
  id              BIGINT UNSIGNED   NOT NULL AUTO_INCREMENT,
  chain_id        INT UNSIGNED      NOT NULL,
  quote_ccy       VARCHAR(8)        NOT NULL DEFAULT 'USD',
  price           DECIMAL(36,18)    NOT NULL,
  source          VARCHAR(32)       NOT NULL,
  ts              TIMESTAMP         NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_price (chain_id, quote_ccy, source, ts),
  KEY idx_price_ts (ts),
  CONSTRAINT fk_price_chain FOREIGN KEY (chain_id) REFERENCES chains(chain_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- audit_log: admin / system events
CREATE TABLE IF NOT EXISTS audit_log (
  id              BIGINT UNSIGNED   NOT NULL AUTO_INCREMENT,
  actor_user_id   BIGINT UNSIGNED   DEFAULT NULL,
  actor_addr      CHAR(42)          DEFAULT NULL,
  action          VARCHAR(64)       NOT NULL,
  detail          JSON              DEFAULT NULL,
  ip              VARCHAR(45)       DEFAULT NULL,
  created_at      TIMESTAMP         NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_audit_actor (actor_user_id, created_at),
  KEY idx_audit_action (action, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- indexer_state: cursor tracking for the on-chain indexer
CREATE TABLE IF NOT EXISTS indexer_state (
  chain_id        INT UNSIGNED      NOT NULL,
  stream          VARCHAR(32)       NOT NULL,
  last_block      BIGINT UNSIGNED   NOT NULL DEFAULT 0,
  updated_at      TIMESTAMP         NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (chain_id, stream),
  CONSTRAINT fk_idx_chain FOREIGN KEY (chain_id) REFERENCES chains(chain_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET FOREIGN_KEY_CHECKS = 1;
