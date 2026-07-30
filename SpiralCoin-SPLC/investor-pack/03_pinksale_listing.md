# PinkSale / DXSale — Listing Application Values

> Trading involves risk. Past performance does not guarantee future results.

Paste these values into PinkSale's "Create Sale" wizard (pinksale.finance) or
DXSale's launchpad form. **PinkSale and DXSale do NOT permit US participants.**
If you need US access, use Reg D 506(c) instead (see `07_regd_506c_memo.md`).

## Project information

| Field | Value |
| --- | --- |
| Token name | SpiralCoin |
| Token symbol | SPLC |
| Token address | (paste post-mainnet deploy from contracts/deployments) |
| Decimals | 18 |
| Total supply | 1,000,000,000 |
| Logo URL | <https://www.spiralcoin.net/assets/logo.png> |
| Website | <https://www.spiralcoin.net> |
| Whitepaper | <https://www.spiralcoin.net/whitepaper.pdf> (create + upload) |
| Twitter | (your handle) |
| Telegram | (your community link) |
| Discord | (optional) |
| GitHub | <https://github.com/SpiralCoinOfficial/ionos-migration> |
| Description | "SpiralCoin (SPLC) is a multi-chain ERC-20 governance token powering an institutional-grade market intelligence platform. Real-time market data, DAO-governed treasury, cross-chain native via LayerZero OFT, gasless UX via ERC-4337 paymaster. Trading involves risk; past performance does not guarantee future results." |

## Sale configuration (recommended for fair launch)

| Field | Value | Reasoning |
| --- | --- | --- |
| Sale type | Fair Launch (preferred) or Presale | Fair Launch = no hard cap pressure |
| Tokens for sale | 100,000,000 SPLC | 10% of total supply |
| Currency | ETH (Arbitrum/Base) or USDC | Lower gas than mainnet |
| Soft cap | Set realistically (e.g. $25,000) | Refunds triggered if not met |
| Hard cap | $250,000 – $500,000 | Don't be greedy |
| Min buy | 0.01 ETH | Allows small retail |
| Max buy | 0.5 ETH per wallet | Prevents whale capture |
| Liquidity % | 60% minimum | Goes into Uniswap |
| Liquidity lock | 365 days (12 months) | Builds trust |
| Listing price | (Calculate: must be ≥ presale price; PinkSale enforces) |
| Vesting on contributors | Optional 6-month linear | Reduces dump risk |
| Vesting on team tokens | 12-mo cliff + 36-mo linear | Already enforced on-chain |

## Audit + KYC upgrades (paid, recommended)

| Upgrade | Cost | Why |
| --- | --- | --- |
| KYC verification badge | ~$500 | Founder doxxed via PinkSale |
| Audit badge | $300–$15,000 (varies by auditor) | CertiK, Hacken, SolidProof reports |
| SAFU badge | Varies | Insurance against rug |

## Listing fee

PinkSale charges a small ETH fee to create the sale (typically 1 BNB on BSC, equivalent on
other chains). Budget ~$200–$2,000.

## Pre-flight checklist

- [ ] Contract deployed to mainnet (Arbitrum / Base / BSC)
- [ ] Contract verified on Etherscan/Arbiscan/Basescan
- [ ] Contract audited (at minimum CertiK skynet, ideally Hacken full report)
- [ ] Founder KYC submitted to PinkSale
- [ ] Whitepaper PDF hosted publicly
- [ ] Tokens transferred to PinkSale presale contract (it pulls from your wallet at creation)
- [ ] Liquidity portion held ready in deployer wallet (PinkSale will pull to seed pool)
- [ ] Marketing campaign queued (Twitter, Telegram, CMC/CG application drafts ready)
- [ ] Geo-block US wallets in your dApp frontend before sale opens

## After sale closes

1. PinkSale auto-creates the Uniswap V2 LP with the % you specified
2. PinkSale auto-locks the LP tokens for the duration you specified
3. Contributors claim tokens via PinkSale UI
4. Apply to CoinGecko + CoinMarketCap listings (free, takes 1–4 weeks)
5. Apply to DexTools "Updated info" (paid, fast)
6. Apply to tier-2 CEX listings (Gate.io, MEXC, KuCoin — $20k–$100k each)

## Honest warnings

- PinkSale has hosted many scams. Your KYC + audit badges are what separate you from them.
- Bot snipers will buy in the first block. Use anti-bot settings if available.
- Have your community manager + Telegram admins ready at sale open.
- Refund mechanism activates if soft cap missed — be honest about your goals.
