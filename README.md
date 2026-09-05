# DIVI ($DIVI) — perps that pay dividends

Perpetuals on tokenized stocks on Robinhood Chain with one difference from every other perp: **the dividend actually moves.** On the ex-dividend date the contract takes shares × dividend from every short and pays it to every long, pro rata by shares, exactly like a stock loan. Longs are made whole for the ex-date gap; shorts owe what a real short owes. Nothing is minted, nothing is subsidised.

Prices are a 24/7 fair value (tape + every Robinhood Chain pool + xStocks + index futures × β, weighted median with a confidence band), so it works all weekend.

The whole product is a spreadsheet. Every number has a formula.

## Layout
- `server/engine.js` — 24/7 price blend + dividend records. Declared records (Nasdaq: ex-date, pay date, cash amount) are signed; projected ones (from the payout cadence) are shown, never signed.
- `server/evm.js` — secp256k1 signing of the `Px` price struct and the `Div` dividend struct; JSON-RPC reads of the venue.
- `contracts/DiviPerps.sol` — USDG perps venue: LP pool counterparty, ≤10×, fills at mark ± conf/2, 8 bp per side, 5% maintenance, liquidator bounty, and `settleDividend(Div, from, to)`.
- `contracts/test/anvil-e2e.js` — Foundry/anvil end-to-end (27 checks incl. dividend settlement, tampered signatures, double settlement).
- `client/` — Board, Trade, Calendar, Practice, Docs, per-symbol feed sheet. No framework, hand-rolled ABI encoding, `shared/keccak.js`.

## Run
```
node server/index.js            # http://localhost:8196
anvil &  node contracts/test/anvil-e2e.js
```

## Deploy the venue
1. Set `DIVI_EVM_KEY` and `DIVI_SIGNER_PRIV` on the host so the oracle signer is stable (`node -e "const d=require('./data.json');console.log(d.evm);console.log(d.signer.priv)"`). Read the signer address at `/api/config` (`evmSigner`).
2. `forge create contracts/DiviPerps.sol:DiviPerps --rpc-url https://rpc.mainnet.chain.robinhood.com --private-key <DEPLOYER> --broadcast --constructor-args 0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168 <EVM_SIGNER> "[<sym32 list from /api/config board>]"`
3. Set `DIVI_PERPS` to the deployed address. Seed the pool with Provide.

USDG on Robinhood Chain: `0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168` (6 decimals). Chain id 4663.

## Env
`PORT` · `DATA_PATH` · `DIVI_MINT` ($DIVI CA) · `DIVI_PERPS` · `DIVI_EVM_KEY` · `DIVI_SIGNER_PRIV` · `RH_RPC_URL`

MIT.
