# Wallet Binding (EIP-4361 SIWE)

SpiralCoin lets an authenticated user link a single Ethereum wallet to their
Auth0 identity. The binding is informational — it does **not** authorize fund
movement, custody, or anything value-bearing.

## Flow

```
User clicks "Connect Wallet" (nav button, appears after Auth0 login)
        │
        ├─► window.ethereum.request({method:'eth_requestAccounts'})
        │   └── User picks account in MetaMask
        │
        ├─► Build SIWE message (EIP-4361):
        │       www.spiralcoin.net wants you to sign in with your Ethereum account:
        │       0xABCD…
        │
        │       Bind this wallet to your SpiralCoin account (auth0|...).
        │
        │       URI: https://www.spiralcoin.net
        │       Version: 1
        │       Chain ID: 42161
        │       Nonce: <16-byte hex>
        │       Issued At: 2026-05-28T20:15:00Z
        │
        ├─► window.ethereum.request({method:'personal_sign', params:[msg, addr]})
        │   └── User signs in MetaMask
        │
        ├─► getIdTokenClaims().__raw   (Auth0 ID token, RS256)
        │
        └─► POST /api/bind-wallet.php
                Authorization: Bearer <id token>
                { address, message, signature, chainId: 42161 }
```

## Server validation (`api/bind-wallet.php`)

| Check | Rule |
|---|---|
| HTTP method | POST only |
| Address format | `^0x[a-f0-9]{40}$` |
| Signature format | `^0x[a-f0-9]{130}$` |
| Message length | 40–4000 chars |
| Chain ID | `42161` (Arbitrum One) only |
| Address in message | `stripos($message, $address)` must succeed |
| SIWE domain line | First line host must be in allow-list |
| SIWE Nonce | `Nonce: <hex16+>` present |
| SIWE Issued At | Parseable timestamp, not in future, < 10 min old |
| JWT signature | RS256 verified against Auth0 JWKS |
| JWT `iss` | `https://dev-t6gnxzv48a8g4ny3.us.auth0.com/` |
| JWT `aud` | `hKf1O2BMMiDhlYmwOwaqk4jv07zHVJEB` |
| JWT `exp` | Not expired |
| JWT `iat` | Not in future (>60s skew) |

## Storage

```json
{
  "auth0|65a1b2c3...": {
    "address":   "0xabc...",
    "chain_id":  42161,
    "bound_at":  "2026-05-28T20:15:00+00:00",
    "email":     "user@example.com",
    "ip":        "1.2.3.4",
    "message":   "www.spiralcoin.net wants you to sign in...",
    "signature": "0x...130hex",
    "verified":  "jwt_only"
  }
}
```

File: `/private/wallet-bindings.json` (atomic write, `flock(LOCK_EX)`,
denied to web by `/private/.htaccess`).

## ⚠️ Security note — ECDSA recovery deferred

The current MVP **does not** perform on-chain `ecrecover` to prove the
signature actually corresponds to the claimed address. The trust model is:

> *The Auth0-authenticated user claims this wallet address; the SIWE
> signature is stored verbatim for later re-verification once a pure-PHP
> secp256k1 library (e.g. `simplito/elliptic-php` + `kornrunner/keccak`) is
> vendored into the repo.*

**Do not gate any value-bearing feature** (transfers, votes, withdrawals,
sponsor attribution that affects payouts) on this binding alone until the
`verified` field reads `"ecdsa"` instead of `"jwt_only"`.

Tracking issue: `[#TODO: ECDSA recovery upgrade]`

## Client-side API: `window.SPLCWallet`

```js
SPLCWallet.connect()      // Full flow above. Returns address or null.
SPLCWallet.disconnect()   // Clears local cache, removes nav chip.
SPLCWallet.getAddress()   // Returns cached address or null.
```

## Nav UI behaviour

| State | Nav button |
|---|---|
| Logged out | (none) |
| Logged in, no wallet | "🦊 Connect Wallet" (`btn btn-ghost`) |
| Logged in + bound | "🦊 0xABCD…1234" gold pill chip — click to disconnect |

## Switching account in MetaMask

`window.ethereum.on('accountsChanged')` is wired to auto-disconnect when the
user switches to a different account. The next "Connect Wallet" click forces
a fresh SIWE signature for the new account.
