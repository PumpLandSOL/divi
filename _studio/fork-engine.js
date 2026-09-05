// one-shot: fork ../mark/server/engine.js → server/engine.js with the DIVI roster + dividend poller
const fs = require('fs'); const path = require('path');
let e = fs.readFileSync(path.join(__dirname, '..', '..', 'mark', 'server', 'engine.js'), 'utf8');
e = e.replace('// MARK — the fair-value engine. Marks every tokenized stock to market, 24/7.', '// DIVI — the fair-value + dividend engine (price blend forked from MARK). Marks every dividend-paying tokenized stock 24/7 and tracks its next ex-date.');
const start = e.indexOf('const BOARD = ['), end = e.indexOf('];', start) + 2;
const board = `const BOARD = [
  { sym: 'AAPL',  name: 'Apple',              rh: '0xaF3D76f1834A1d425780943C99Ea8A608f8a93f9', fut: 'NQ=F' },
  { sym: 'MSFT',  name: 'Microsoft',          rh: '0xe93237C50D904957Cf27E7B1133b510C669c2e74', fut: 'NQ=F' },
  { sym: 'NVDA',  name: 'NVIDIA',             rh: '0xd0601CE157Db5bdC3162BbaC2a2C8aF5320D9EEC', fut: 'NQ=F' },
  { sym: 'META',  name: 'Meta',               rh: '0xc0D6457C16Cc70d6790Dd43521C899C87ce02f35', fut: 'NQ=F' },
  { sym: 'GOOGL', name: 'Alphabet',           rh: '0x2e0847E8910a9732eB3fb1bb4b70a580ADAD4FE3', fut: 'NQ=F' },
  { sym: 'SPY',   name: 'S&P 500 ETF',        rh: '0x117cc2133c37B721F49dE2A7a74833232B3B4C0C', fut: 'ES=F', etf: true },
  { sym: 'QQQ',   name: 'Nasdaq-100 ETF',     rh: '0xD5f3879160bc7c32ebb4dC785F8a4F505888de68', fut: 'NQ=F', etf: true },
  { sym: 'JNJ',   name: 'Johnson & Johnson',  rh: '0x03DfbBE0AC4E7bCDaFd08eD41A400326B77D8c80', fut: 'ES=F' },
  { sym: 'IBM',   name: 'IBM',                rh: '0x980dcf6766FA79f5Cf0c4AAdb3ab477ff15a9619', fut: 'ES=F' },
  { sym: 'COST',  name: 'Costco',             rh: '0x4EA005168D7F09a7A0Ba9D1DEf21a479950E44C2', fut: 'ES=F' },
  { sym: 'MCD',   name: "McDonald's",         rh: '0x08E91b659a545Bfb52F1a5e588Bf6Dc2FA85DE7A', fut: 'ES=F' },
];`;
e = e.slice(0, start) + board + e.slice(end);
e = e.replace(/  if \(f\.pyth\) \{[\s\S]*?\n  \}\n  if \(!src\.length\)/, '  if (!src.length)');
e = e.replace(/async function pollPyth\(\) \{[\s\S]*?\n\}\n/, 'async function pollPyth() {}\n');
e = e.replace("const STATUS = { tape: 0, pools: 0, xstock: 0, futures: 0, pyth: S.PYTH_URL ? 0 : -1, errors: {} };", 'const STATUS = { tape: 0, pools: 0, xstock: 0, futures: 0, dividends: 0, errors: {} };');
e = e.replace('hist: [], daily: [] };', 'hist: [], daily: [], div: null };');
e = e.replace("return ['MARK', m.sym,", "return ['DIVI', m.sym,");
e = e.split('MARK_SIGNER_PRIV').join('DIVI_SIGNER_PRIV');
const divCode = `
// ── dividends ─────────────────────────────────────────────────────────────────
// Confirmed record = Nasdaq-declared ex-date + cash amount (this is what gets signed for the contract). If the last
// declared ex-date has passed and nothing new is declared yet, the NEXT one is PROJECTED from the cadence (shown, not signed).
const EX_OFFSET_S = 13.5 * 3600;   // ex-date takes effect at the 09:30 ET open ≈ 13:30 UTC
function exTsOf(exMidnightUtcMs) { return Math.floor(exMidnightUtcMs / 1000) + EX_OFFSET_S; }
function buildDiv(nd, hist, t) {
  const rows = (nd && nd.rows && nd.rows.length ? nd.rows.map((r) => ({ ex: r.ex, pay: r.pay, amount: r.amount })) : hist.map((h) => ({ ex: h.ex, pay: null, amount: h.amount }))).sort((a, b) => b.ex - a.ex);
  if (!rows.length) return null;
  const last = rows[0];
  const gaps = []; for (let i = 0; i + 1 < Math.min(rows.length, 6); i++) gaps.push(rows[i].ex - rows[i + 1].ex);
  const gap = gaps.length ? gaps.sort((a, b) => a - b)[Math.floor(gaps.length / 2)] : 91 * 86400e3;
  const perYear = Math.max(1, Math.round(365 * 86400e3 / gap));
  const annual = (nd && nd.annual) || +rows.slice(0, perYear).reduce((s, r) => s + r.amount, 0).toFixed(4);
  let next;
  if (nd && nd.ex && exTsOf(nd.ex) * 1000 > t - 86400e3) next = { ex: nd.ex, pay: nd.pay, amount: (rows.find((r) => r.ex === nd.ex) || last).amount, exTs: exTsOf(nd.ex), confirmed: true, source: 'nasdaq' };
  else { let ex = last.ex + gap; while (ex < t - 86400e3) ex += gap; next = { ex, pay: null, amount: last.amount, exTs: exTsOf(ex), confirmed: false, source: 'projected from cadence' }; }
  return { next, last, annual, perYear, history: rows.slice(0, 8), updated: t };
}
async function pollDividends() {
  const t = Date.now();
  for (const b of BOARD) {
    let nd = null, hist = [];
    try { nd = await S.nasdaqDividends(b.sym, !!b.etf); } catch (e) { STATUS.errors.nasdaq = e.message; }
    try { hist = await S.yahooDividends(b.sym); } catch (e) { STATUS.errors.yahooDiv = e.message; }
    const d = buildDiv(nd, hist, t);
    if (d) { F[b.sym].div = d; STATUS.dividends = Date.now(); }
    await new Promise((r) => setTimeout(r, 400));
  }
}
function dividend(sym) { return F[sym] ? F[sym].div : null; }
function dividends() { const o = {}; for (const b of BOARD) o[b.sym] = F[b.sym].div; return o; }
function importDiv(d) { if (!d) return; for (const b of BOARD) if (d[b.sym]) F[b.sym].div = d[b.sym]; }
`;
e = e.replace('// ── publish tick', divCode + '\n// ── publish tick');
e = e.replace('await Promise.all([pollTape(), pollFutures(), pollPools(), resolveXStocks().then(pollXStocks), pollPyth()]);', 'await Promise.all([pollTape(), pollFutures(), pollPools(), resolveXStocks().then(pollXStocks), pollDividends()]);');
e = e.replace('  setInterval(pollPyth, 10e3);\n', '  setInterval(pollDividends, 30 * 60e3);\n');
e = e.replace('module.exports = { BOARD, start,', 'module.exports = { BOARD, start, dividend, dividends, importDiv, exTsOf,');
fs.writeFileSync(path.join(__dirname, '..', 'server', 'engine.js'), e);
const E = require('../server/engine.js');
console.log('engine ok · board', E.BOARD.length, '· dividend export', typeof E.dividend, '· pyth refs left', (e.match(/pyth/gi) || []).length);
