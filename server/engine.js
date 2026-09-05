// DIVI — the fair-value + dividend engine (price blend forked from MARK). Marks every dividend-paying tokenized stock 24/7 and tracks its next ex-date.
//
// Regimes (NYSE calendar, America/New_York):
//   OPEN   09:30–16:00 weekdays      → mark = official tape (pools/xStocks only tighten confidence)
//   PRE    04:00–09:30 / POST 16:00–20:00 → extended print + pools + xStocks + futures proxy
//   CLOSED overnight, weekends, holidays → pools + xStocks + futures proxy, official close decays
//
// Blend = weighted MEDIAN of the surviving sources (outliers > OUTLIER_BPS from the
// pre-median are rejected and reported). Confidence = max(floor, k·dispersion) + staleness.
// Every published mark is signed (ed25519) with a persistent signer key.
'use strict';
const crypto = require('crypto');
const S = require('./sources');

// ── the board ─────────────────────────────────────────────────────────────────
// rh = the tokenized-stock contract on Robinhood Chain (base token of the pools)
// pyth = { eq: Equity.US feed, x: Crypto.<SYM>X/USD xStock feed } — used only if PYTH_HERMES_URL is set
const BOARD = [
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
];

// ── NYSE calendar ─────────────────────────────────────────────────────────────
// full closures + early (13:00) closes, MMDD, from the exchange calendar (matches Pyth's equity schedule)
const HOLIDAYS = new Set(['0101', '0119', '0216', '0403', '0525', '0619', '0703', '0907', '1126', '1225']);
const HALF_DAYS = new Set(['1127', '1224']);
const NY = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', hour12: false, weekday: 'short', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
function nyParts(t) {
  const o = {};
  for (const p of NY.formatToParts(new Date(t))) o[p.type] = p.value;
  return { wd: o.weekday, mmdd: o.month + o.day, ymd: o.year + '-' + o.month + '-' + o.day, mins: (+o.hour % 24) * 60 + +o.minute };
}
// session for an instant: 'open' | 'pre' | 'post' | 'closed'
function session(t) {
  const p = nyParts(t);
  if (p.wd === 'Sat' || p.wd === 'Sun' || HOLIDAYS.has(p.mmdd)) return 'closed';
  const close = HALF_DAYS.has(p.mmdd) ? 13 * 60 : 16 * 60;
  if (p.mins >= 9 * 60 + 30 && p.mins < close) return 'open';
  if (p.mins >= 4 * 60 && p.mins < 9 * 60 + 30) return 'pre';
  if (p.mins >= close && p.mins < 20 * 60) return 'post';
  return 'closed';
}
// next NYSE open (ms) — for the "Wall Street reopens in" line
function nextOpen(t) {
  let d = new Date(t);
  for (let i = 0; i < 14; i++) {
    const p = nyParts(d.getTime());
    const tradable = !(p.wd === 'Sat' || p.wd === 'Sun' || HOLIDAYS.has(p.mmdd));
    if (tradable && p.mins < 9 * 60 + 30) return d.getTime() + (9 * 60 + 30 - p.mins) * 60000 - (d.getTime() % 60000);
    d = new Date(d.getTime() + (24 * 60 - p.mins) * 60000 - (d.getTime() % 60000) + 1000);
  }
  return null;
}

// ── parameters ────────────────────────────────────────────────────────────────
const OUTLIER_BPS = 800;            // a source more than 8% from the pre-median is rejected
const FLOOR_BPS = { open: 5, pre: 15, post: 15, closed: 25 };
const K_DISP = 1.5;                 // confidence multiplier on source dispersion
const STALE_BPS_PER_H = 3, STALE_CAP = 150;
const W = {                         // base weights by regime
  open:   { tape: 1.00, ext: 0,    pools: 0.15, xstock: 0.10, proxy: 0 },
  pre:    { tape: 0.20, ext: 0.45, pools: 0.30, xstock: 0.20, proxy: 0.10 },
  post:   { tape: 0.20, ext: 0.45, pools: 0.30, xstock: 0.20, proxy: 0.10 },
  closed: { tape: 0.15, ext: 0.10, pools: 0.35, xstock: 0.30, proxy: 0.20 },
};

// ── state ─────────────────────────────────────────────────────────────────────
const F = {};                       // sym → feed state
for (const b of BOARD) F[b.sym] = { cfg: b, tape: null, pools: [], xs: null, xsPx: null, pyth: null, beta: 1, mark: null, seq: 0, hist: [], daily: [], div: null };
const FUT = { 'ES=F': null, 'NQ=F': null };
const STATUS = { tape: 0, pools: 0, xstock: 0, futures: 0, dividends: 0, errors: {} };
let signer = null;                  // { priv, pub } PEM
let seqGlobal = 0;

function weightedMedian(items) {   // items: [{price, w}]
  const a = items.filter((i) => i.w > 0 && i.price > 0).sort((x, y) => x.price - y.price);
  const tot = a.reduce((s, i) => s + i.w, 0);
  if (!tot) return null;
  let c = 0;
  for (const i of a) { c += i.w; if (c >= tot / 2) return i.price; }
  return a[a.length - 1].price;
}
const bps = (a, b) => (a / b - 1) * 1e4;

// build the source list for one symbol, then blend
function compute(sym, t) {
  const f = F[sym];
  const sess = session(t);
  const w = W[sess];
  const src = [];
  const tp = f.tape;
  if (tp && tp.official && tp.official.price > 0) {
    const ageH = (t - tp.official.ts) / 3.6e6;
    const decay = sess === 'open' ? 1 : Math.max(0.25, 1 - ageH / 72);            // an official print fades over 3 days
    src.push({ src: 'tape', label: 'Official tape', venue: 'NYSE / Nasdaq', price: tp.official.price, ts: tp.official.ts, w: w.tape * decay });
    if (tp.ext && w.ext > 0) src.push({ src: 'ext', label: 'Extended-hours print', venue: 'US extended session', price: tp.ext.price, ts: tp.ext.ts, w: w.ext * Math.max(0.3, 1 - (t - tp.ext.ts) / 3.6e6 / 12) });
  }
  // Robinhood Chain pools — each deep pool is its own vote; weight ∝ liquidity, halved if no trades in the last hour
  const liqTot = f.pools.reduce((s, p) => s + p.liq, 0);
  if (liqTot > 0 && w.pools > 0) {
    for (const p of f.pools.slice(0, 6)) {
      const share = p.liq / liqTot, act = p.txns1h > 0 ? 1 : 0.5;
      src.push({ src: 'pool', label: 'RH pool ' + p.quote, venue: p.dex, pair: p.pair, price: p.price, ts: t, liq: p.liq, txns1h: p.txns1h, w: w.pools * Math.min(1, liqTot / 1.5e6) * share * act });
    }
  }
  if (f.xsPx && w.xstock > 0) src.push({ src: 'xstock', label: sym + 'x (xStocks)', venue: 'Solana · Jupiter', mint: f.xs.mint, price: f.xsPx.price, ts: f.xsPx.ts, liq: f.xsPx.liq, w: w.xstock * Math.min(1, f.xsPx.liq / 8e5) });
  // futures proxy: official close × (1 + β · futures move since that close)
  const fut = FUT[f.cfg.fut];
  if (tp && fut && w.proxy > 0) {
    const b0 = S.barAt(fut, tp.official.ts);
    if (b0 && fut.price > 0 && b0[1] > 0 && t - fut.ts < 3 * 3.6e6) {
      const move = fut.price / b0[1] - 1;
      const px = tp.official.price * (1 + f.beta * move);
      src.push({ src: 'proxy', label: f.cfg.fut.replace('=F', '') + ' futures × β ' + f.beta.toFixed(2), venue: 'CME (via cash close)', price: px, ts: fut.ts, move, beta: f.beta, w: w.proxy });
    }
  }
  if (!src.length) return null;
  // outlier rejection against the preliminary median
  const pre = weightedMedian(src);
  const rejected = [];
  const kept = src.filter((s) => { const ok = Math.abs(bps(s.price, pre)) <= OUTLIER_BPS; if (!ok) rejected.push(Object.assign({}, s, { devBps: bps(s.price, pre) })); return ok; });
  const mark = weightedMedian(kept);
  if (!mark) return null;
  const tot = kept.reduce((s, i) => s + i.w, 0);
  const disp = kept.reduce((s, i) => s + i.w * Math.abs(bps(i.price, mark)), 0) / tot;   // weighted mean abs dev, bps
  let confBps = Math.max(FLOOR_BPS[sess], K_DISP * disp);
  let staleH = 0;
  if (sess !== 'open' && tp) { staleH = (t - tp.official.ts) / 3.6e6; confBps += Math.min(STALE_CAP, STALE_BPS_PER_H * staleH); }
  const poolPx = weightedMedian(kept.filter((s) => s.src === 'pool').map((s) => ({ price: s.price, w: s.liq || 1 })));
  const xsPx = f.xsPx ? f.xsPx.price : null;
  const official = tp ? tp.official : null;
  return {
    sym, name: f.cfg.name, mark, conf: mark * confBps / 1e4, confBps, session: sess, ts: t,
    official: official ? { price: official.price, ts: official.ts, ageH: (t - official.ts) / 3.6e6 } : null,
    ext: tp && tp.ext ? tp.ext : null,
    prevClose: tp ? tp.prevClose : null,
    basis: {
      vsOfficial: official ? bps(mark, official.price) : null,       // where MARK sits vs the last official print
      pool: poolPx ? bps(poolPx, mark) : null,                        // RH pools rich(+)/cheap(−) vs MARK
      xstock: xsPx ? bps(xsPx, mark) : null,
    },
    poolLiq: liqTot, poolCount: f.pools.length,
    sources: kept.map((s) => Object.assign({}, s, { w: +(s.w / tot).toFixed(4), devBps: +bps(s.price, mark).toFixed(1) })),
    rejected,
    beta: f.beta,
  };
}

// ── signing ───────────────────────────────────────────────────────────────────
function initSigner(saved) {
  if (process.env.DIVI_SIGNER_PRIV) {
    const priv = crypto.createPrivateKey({ key: Buffer.from(process.env.DIVI_SIGNER_PRIV, 'base64'), format: 'der', type: 'pkcs8' });
    signer = { priv, pub: crypto.createPublicKey(priv) };
  } else if (saved && saved.priv) {
    const priv = crypto.createPrivateKey({ key: Buffer.from(saved.priv, 'base64'), format: 'der', type: 'pkcs8' });
    signer = { priv, pub: crypto.createPublicKey(priv) };
  } else {
    const kp = crypto.generateKeyPairSync('ed25519');
    signer = { priv: kp.privateKey, pub: kp.publicKey };
  }
  return { priv: signer.priv.export({ format: 'der', type: 'pkcs8' }).toString('base64') };
}
function pubkeyHex() { return signer.pub.export({ format: 'der', type: 'spki' }).subarray(-32).toString('hex'); }
// canonical payload: fixed-point 1e8 integers so any consumer (Solidity, Rust, JS) rebuilds the exact bytes
function payloadOf(m) {
  return ['DIVI', m.sym, Math.round(m.mark * 1e8), Math.round(m.conf * 1e8), Math.round(m.ts / 1000), m.session.toUpperCase(), m.seq].join('|');
}
function sign(m) {
  const payload = payloadOf(m);
  const sig = crypto.sign(null, Buffer.from(payload), signer.priv).toString('hex');
  return { payload, sig, pub: pubkeyHex(), alg: 'ed25519' };
}
function verify(payload, sigHex, pubHex) {
  try {
    const pub = pubHex ? crypto.createPublicKey({ key: Buffer.concat([Buffer.from('302a300506032b6570032100', 'hex'), Buffer.from(pubHex, 'hex')]), format: 'der', type: 'spki' }) : signer.pub;
    return crypto.verify(null, Buffer.from(payload), pub, Buffer.from(sigHex, 'hex'));
  } catch (e) { return false; }
}

// ── pollers ───────────────────────────────────────────────────────────────────
async function pollTape() {
  for (const b of BOARD) {
    try { const t = await S.tape(b.sym); if (t) { F[b.sym].tape = t; STATUS.tape = Date.now(); } }
    catch (e) { STATUS.errors.tape = e.message; }
    await new Promise((r) => setTimeout(r, 250));
  }
}
async function pollFutures() {
  for (const k of Object.keys(FUT)) {
    try { const f = await S.futures(k); if (f) { FUT[k] = f; STATUS.futures = Date.now(); } } catch (e) { STATUS.errors.futures = e.message; }
  }
}
async function pollPools() {
  for (const b of BOARD) {
    try { F[b.sym].pools = await S.pools(b.rh); STATUS.pools = Date.now(); } catch (e) { STATUS.errors.pools = e.message; }
    await new Promise((r) => setTimeout(r, 120));
  }
}
async function resolveXStocks() {
  for (const b of BOARD) {
    if (F[b.sym].xs) continue;
    try { F[b.sym].xs = await S.resolveXStock(b.sym); } catch (e) { STATUS.errors.xstock = e.message; }
    await new Promise((r) => setTimeout(r, 150));
  }
}
async function pollXStocks() {
  const mints = BOARD.filter((b) => F[b.sym].xs).map((b) => F[b.sym].xs.mint);
  try {
    const px = await S.xstockPrices(mints);
    for (const b of BOARD) if (F[b.sym].xs && px[F[b.sym].xs.mint]) F[b.sym].xsPx = px[F[b.sym].xs.mint];
    STATUS.xstock = Date.now();
  } catch (e) { STATUS.errors.xstock = e.message; }
}
async function pollPyth() {}
// β to the index that proxies the name (ES for SPY-beta names, NQ for tech) from 3 months of daily returns
async function computeBetas() {
  const idx = {};
  try { idx['ES=F'] = await S.dailyCloses('SPY'); idx['NQ=F'] = await S.dailyCloses('QQQ'); } catch (e) { STATUS.errors.beta = e.message; return; }
  const rets = (c) => { const r = []; for (let i = 1; i < c.close.length; i++) if (c.close[i] && c.close[i - 1]) r.push([c.ts[i], c.close[i] / c.close[i - 1] - 1]); return r; };
  for (const b of BOARD) {
    try {
      const d = await S.dailyCloses(b.sym);
      if (!d || !idx[b.fut]) continue;
      F[b.sym].daily = d.close.map((c, i) => [d.ts[i] * 1000, c]).filter((x) => x[1]);
      const rs = rets(d), ri = new Map(rets(idx[b.fut]).map((x) => [Math.floor(x[0] / 86400), x[1]]));
      let sxy = 0, sxx = 0, n = 0, mx = 0, my = 0;
      const pairs = rs.map((x) => [ri.get(Math.floor(x[0] / 86400)), x[1]]).filter((p) => p[0] != null);
      for (const p of pairs) { mx += p[0]; my += p[1]; n++; }
      if (n < 20) continue;
      mx /= n; my /= n;
      for (const p of pairs) { sxy += (p[0] - mx) * (p[1] - my); sxx += (p[0] - mx) * (p[0] - mx); }
      const beta = sxx > 0 ? sxy / sxx : 1;
      F[b.sym].beta = Math.max(0.2, Math.min(3.5, beta));
    } catch (e) { STATUS.errors.beta = e.message; }
    await new Promise((r) => setTimeout(r, 200));
  }
}


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

// ── publish tick ──────────────────────────────────────────────────────────────
function tick(t) {
  const out = [];
  for (const b of BOARD) {
    const f = F[b.sym];
    const m = compute(b.sym, t);
    if (!m) { if (f.mark) out.push(f.mark); continue; }
    m.seq = ++seqGlobal; f.seq = m.seq;
    m.dir = f.mark ? Math.sign(m.mark - f.mark.mark) : 0;
    m.signed = sign(m);
    f.mark = m;
    // history: 20s cadence → keep 6h fine + hourly for 7d
    const last = f.hist[f.hist.length - 1];
    if (!last || t - last[0] >= 20e3) f.hist.push([t, +m.mark.toFixed(4), +m.conf.toFixed(4), m.session[0]]);
    if (f.hist.length > 1100) f.hist.splice(0, f.hist.length - 1100);
    out.push(m);
  }
  return out;
}

function snapshot() { return BOARD.map((b) => F[b.sym].mark).filter(Boolean); }
function feed(sym) { return F[sym] ? F[sym].mark : null; }
function history(sym) { return F[sym] ? F[sym].hist : []; }
function daily(sym) { return F[sym] ? F[sym].daily : []; }
function xsOf(sym) { return F[sym] ? F[sym].xs : null; }
function exportHist() { const o = {}; for (const b of BOARD) o[b.sym] = F[b.sym].hist.slice(-400); return o; }
function importHist(h) { if (!h) return; for (const b of BOARD) if (Array.isArray(h[b.sym])) F[b.sym].hist = h[b.sym]; }

async function start() {
  await Promise.all([pollTape(), pollFutures(), pollPools(), resolveXStocks().then(pollXStocks), pollDividends()]);
  computeBetas();
  setInterval(pollTape, 45e3);
  setInterval(pollFutures, 60e3);
  setInterval(pollPools, 20e3);
  setInterval(pollXStocks, 15e3);
  setInterval(pollDividends, 30 * 60e3);
  setInterval(computeBetas, 6 * 3.6e6);
  setInterval(resolveXStocks, 3.6e6);
}

module.exports = { BOARD, start, dividend, dividends, importDiv, exTsOf, tick, snapshot, feed, history, daily, xsOf, session, nextOpen, initSigner, pubkeyHex, sign, verify, payloadOf, STATUS, FUT, exportHist, importHist, W, FLOOR_BPS, OUTLIER_BPS };
