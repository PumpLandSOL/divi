// End-to-end on a local anvil: deploy MockUSDG + DiviPerps with the server's EVM signer, then
// deposit → provide → open (signed price) → close → liquidate → DIVIDEND settlement (shorts pay, longs receive).
// Usage: anvil &  then  node contracts/test/anvil-e2e.js
'use strict';
const { execSync } = require('child_process');
const path = require('path');
const EVM = require('../../server/evm');
const ROOT = path.join(__dirname, '..', '..');
const RPC = 'http://127.0.0.1:8545';
const A0 = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266';
const A1 = '0x70997970C51812dc3A010C7d01b50e0d17dc79C8';
const A2 = '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC';
const sh = (c) => execSync(c, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
const cast = (c) => sh('cast ' + c + ' --rpc-url ' + RPC).replace(/ \[[^\]]*\]/g, '');
const send = (from, to, sig, args) => cast(`send ${to} "${sig}" ${args} --from ${from} --unlocked --json`);
let fails = 0;
const ok = (label, cond) => { console.log((cond ? 'PASS ' : 'FAIL ') + label); if (!cond) { fails++; process.exitCode = 1; } };

EVM.init(null);
const SIGNER = EVM.address();
const PX_T = '(bytes32,int64,uint64,uint64,uint8,bytes32,bytes32)';
const DV_T = '(bytes32,int64,uint64,bytes32,bytes32)';
const px = (m) => { const p = EVM.signPrice(m); return `(${p.sym32},${p.price},${p.conf},${p.ts},${p.session},${p.r},${p.s})`; };
const dv = (sym, amt, exTs) => { const d = EVM.signDividend(sym, amt, exTs); return `(${d.sym32},${d.amount},${d.exTs},${d.r},${d.s})`; };
const free = (a) => +cast(`call ${PERPS} "free(address)(uint256)" ${a}`) / 1e6;
const pool = () => +cast(`call ${PERPS} "poolBalance()(uint256)"`) / 1e6;
const pos = (i) => cast(`call ${PERPS} "positions(uint256)(address,bytes32,bool,uint8,uint128,uint128,int64,uint64,int64)" ${i}`).split('\n');

const USDG = JSON.parse(sh(`forge create contracts/test/MockUSDG.sol:MockUSDG --rpc-url ${RPC} --from ${A0} --unlocked --broadcast --json`)).deployedTo;
const sym32 = '0x' + Buffer.from('AAPL').toString('hex').padEnd(64, '0');
const PERPS = JSON.parse(sh(`forge create contracts/DiviPerps.sol:DiviPerps --rpc-url ${RPC} --from ${A0} --unlocked --broadcast --json --constructor-args ${USDG} ${SIGNER} "[${sym32}]"`)).deployedTo;
console.log('signer', SIGNER, 'USDG', USDG, 'PERPS', PERPS);

for (const a of [A0, A1, A2]) { send(A0, USDG, 'mint(address,uint256)', `${a} 1000000000000`); send(a, USDG, 'approve(address,uint256)', `${PERPS} 1000000000000`); }
send(A0, PERPS, 'provide(uint256)', '500000000000');
send(A1, PERPS, 'deposit(uint256)', '10000000000');
send(A2, PERPS, 'deposit(uint256)', '10000000000');
ok('pool = 500000', pool() === 500000);
ok('free A1 = 10000', free(A1) === 10000);

// tampered signature
ok('tampered signature reverts', (() => { try { const p = EVM.signPrice({ sym: 'AAPL', mark: 320, conf: 2, ts: Date.now(), session: 'closed' }); send(A1, PERPS, `open(${PX_T},bool,uint256,uint256)`, `"(${p.sym32},${p.price},${p.conf},${p.ts},${p.session},${p.r},${p.r})" true 1000000000 5`); return false; } catch (e) { return /bad sig/.test(e.stderr || e.message); } })());

// A1 long 5x 1000 @ 320±2 → 321 ; A2 short 5x 1000 @ 320±2 → 319
ok('open long ok', JSON.parse(send(A1, PERPS, `open(${PX_T},bool,uint256,uint256)`, `"${px({ sym: 'AAPL', mark: 320, conf: 2, ts: Date.now(), session: 'closed' })}" true 1000000000 5`)).status === '0x1');
ok('open short ok', JSON.parse(send(A2, PERPS, `open(${PX_T},bool,uint256,uint256)`, `"${px({ sym: 'AAPL', mark: 320, conf: 2, ts: Date.now(), session: 'closed' })}" false 1000000000 5`)).status === '0x1');
const p0 = pos(0), p1 = pos(1);
ok('long entry 321', p0[6].startsWith('32100000000'));
ok('short entry 319', p1[6].startsWith('31900000000'));
ok('long margin 996', p0[4].startsWith('996000000'));

// close a separate long at a rally to prove pnl path
send(A1, PERPS, `open(${PX_T},bool,uint256,uint256)`, `"${px({ sym: 'AAPL', mark: 320, conf: 2, ts: Date.now(), session: 'closed' })}" true 1000000000 5`);
const c = JSON.parse(send(A1, PERPS, `close(uint256,${PX_T})`, `2 "${px({ sym: 'AAPL', mark: 330, conf: 2, ts: Date.now(), session: 'open' })}"`));
ok('close tx ok', c.status === '0x1');
const f1 = free(A1); console.log('  A1 free after close', f1);
ok('closed long profited ≈ +117 (two longs open, one closed)', f1 > 9110 && f1 < 9125);

// liquidation path: A2 short 10x, mark rips
send(A2, PERPS, `open(${PX_T},bool,uint256,uint256)`, `"${px({ sym: 'AAPL', mark: 320, conf: 2, ts: Date.now(), session: 'closed' })}" false 1000000000 10`);
ok('healthy at 320', cast(`call ${PERPS} "liquidatable(uint256,int64)(bool)" 3 32000000000`) === 'false');
ok('liquidatable at 355', cast(`call ${PERPS} "liquidatable(uint256,int64)(bool)" 3 35500000000`) === 'true');
ok('liquidate ok', JSON.parse(send(A0, PERPS, `liquidate(uint256,${PX_T})`, `3 "${px({ sym: 'AAPL', mark: 355, conf: 2, ts: Date.now(), session: 'open' })}"`)).status === '0x1');
ok('status liquidated', pos(3)[3] === '2');

// ── DIVIDEND: AAPL pays $0.27/share. exTs = now+5; advance chain past it; settle over all positions
const exTs = Math.floor(Date.now() / 1000) + 5;
ok('early settle reverts (before exTs)', (() => { try { send(A0, PERPS, `settleDividend(${DV_T},uint256,uint256)`, `"${dv('AAPL', 0.27, exTs)}" 0 100`); return false; } catch (e) { return /window/.test(e.stderr || e.message); } })());
cast('rpc evm_increaseTime 20'); cast('rpc evm_mine');
const freeA1b = free(A1), freeA0b = free(A0), poolB = pool(), shortMarginB = +pos(1)[4] / 1e6;
const s = JSON.parse(send(A0, PERPS, `settleDividend(${DV_T},uint256,uint256)`, `"${dv('AAPL', 0.27, exTs)}" 0 100`));
ok('settle tx ok', s.status === '0x1');
// long #0: shares = 5000/321 = 15.5763 → cash 4.2056 ; short #1: shares = 5000/319 = 15.6740 → cash 4.2320
const gotLong = free(A1) - freeA1b, paidShort = shortMarginB - +pos(1)[4] / 1e6, bounty = free(A0) - freeA0b;
console.log('  long received', gotLong.toFixed(4), '· short paid', paidShort.toFixed(4), '· settler bounty', bounty.toFixed(4), '· pool Δ', (pool() - poolB).toFixed(4));
ok('long received ≈ 4.2056 USDG', Math.abs(gotLong - 4.2056) < 0.001);
ok('short paid ≈ 4.2320 USDG', Math.abs(paidShort - 4.2320) < 0.001);
ok('settler bounty = 1% of collected', Math.abs(bounty - paidShort * 0.01) < 0.0005);
ok('pool Δ = collected − bounty − paid out', Math.abs((pool() - poolB) - (paidShort - bounty - gotLong)) < 0.001);
ok('lifetime dividendsReceived(A1)', Math.abs(+cast(`call ${PERPS} "dividendsReceived(address)(uint256)" ${A1}`) / 1e6 - gotLong) < 0.001);
ok('double settle pays nothing', (() => { const a = free(A1); send(A0, PERPS, `settleDividend(${DV_T},uint256,uint256)`, `"${dv('AAPL', 0.27, exTs)}" 0 100`); return free(A1) === a; })());
ok('tampered dividend reverts', (() => { try { const d = EVM.signDividend('AAPL', 0.27, exTs + 1); send(A0, PERPS, `settleDividend(${DV_T},uint256,uint256)`, `"(${d.sym32},${d.amount},${d.exTs},${d.r},${d.r})" 0 100`); return false; } catch (e) { return /bad sig/.test(e.stderr || e.message); } })());
// position opened AFTER exTs must not receive the next settlement of the same record
send(A1, PERPS, 'withdraw(uint256)', '1000000000');
ok('withdraw works', free(A1) > 0);
console.log(fails ? `E2E: ${fails} FAILED` : 'E2E: ALL PASS', '· perps=' + PERPS);
