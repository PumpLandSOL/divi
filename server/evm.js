// DIVI — EVM side: secp256k1 signing of prices AND dividends for DiviPerps.sol + JSON-RPC reads.
// Price digest:    sha256("DIVIv1"   ‖ sym(bytes32) ‖ price(int64) ‖ conf(uint64) ‖ ts(uint64) ‖ session(uint8))
// Dividend digest: sha256("DIVIdiv1" ‖ sym(bytes32) ‖ amount(int64, USD·1e8) ‖ exTs(uint64))
// The contract ecrecovers over the same digest with v ∈ {27, 28}.
'use strict';
const crypto = require('crypto');
const keccak256 = require('../shared/keccak');

const RPC = process.env.RH_RPC_URL || 'https://rpc.mainnet.chain.robinhood.com';
const USDG = process.env.USDG_ADDR || '0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168';
const PERPS = process.env.DIVI_PERPS || '';
const N = BigInt('0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141');
const SESS = { open: 0, pre: 1, post: 2, closed: 3 };

let key = null;
function init(savedB64) {
  const b64 = process.env.DIVI_EVM_KEY || savedB64;
  let priv;
  if (b64) priv = crypto.createPrivateKey({ key: Buffer.from(b64, 'base64'), format: 'der', type: 'pkcs8' });
  else priv = crypto.generateKeyPairSync('ec', { namedCurve: 'secp256k1' }).privateKey;
  const pub = crypto.createPublicKey(priv).export({ format: 'der', type: 'spki' });
  const xy = pub.subarray(pub.length - 64);
  key = { priv, address: '0x' + keccak256(xy).slice(24) };
  return priv.export({ format: 'der', type: 'pkcs8' }).toString('base64');
}
function address() { return key ? key.address : null; }
function sym32(sym) { const b = Buffer.alloc(32); b.write(sym, 'utf8'); return b; }
function derToRS(der) {
  let i = 2; if (der[1] & 0x80) i += der[1] & 0x7f;
  const rl = der[i + 1]; const r = der.subarray(i + 2, i + 2 + rl); i += 2 + rl;
  const sl = der[i + 1]; const s = der.subarray(i + 2, i + 2 + sl);
  let rv = BigInt('0x' + Buffer.from(r).toString('hex')), sv = BigInt('0x' + Buffer.from(s).toString('hex'));
  if (sv > N / 2n) sv = N - sv;
  return { r: '0x' + rv.toString(16).padStart(64, '0'), s: '0x' + sv.toString(16).padStart(64, '0') };
}
function signBytes(p) { const { r, s } = derToRS(crypto.sign('sha256', p, key.priv)); return { r, s, hash: '0x' + crypto.createHash('sha256').update(p).digest('hex') }; }

function signPrice(m) {
  const price8 = Math.round(m.mark * 1e8), conf8 = Math.round(m.conf * 1e8), ts = Math.floor(m.ts / 1000), session = SESS[m.session];
  const b = Buffer.alloc(6 + 32 + 8 + 8 + 8 + 1); let o = 0;
  b.write('DIVIv1', o); o += 6; sym32(m.sym).copy(b, o); o += 32;
  b.writeBigInt64BE(BigInt(price8), o); o += 8; b.writeBigUInt64BE(BigInt(conf8), o); o += 8; b.writeBigUInt64BE(BigInt(ts), o); o += 8; b.writeUInt8(session, o);
  const sg = signBytes(b);
  return { sym: m.sym, sym32: '0x' + sym32(m.sym).toString('hex'), price: String(price8), conf: String(conf8), ts, session, r: sg.r, s: sg.s, hash: sg.hash, signer: key.address };
}
// sign a CONFIRMED dividend: amount in USD per share, exTs = unix seconds the position must predate
function signDividend(sym, amount, exTs) {
  const amount8 = Math.round(amount * 1e8);
  const b = Buffer.alloc(8 + 32 + 8 + 8); let o = 0;
  b.write('DIVIdiv1', o); o += 8; sym32(sym).copy(b, o); o += 32;
  b.writeBigInt64BE(BigInt(amount8), o); o += 8; b.writeBigUInt64BE(BigInt(exTs), o);
  const sg = signBytes(b);
  return { sym, sym32: '0x' + sym32(sym).toString('hex'), amount: String(amount8), exTs, r: sg.r, s: sg.s, hash: sg.hash, signer: key.address };
}

// ── JSON-RPC reads ─────────────────────────────────────────────────────────────
async function rpc(method, params) {
  const r = await fetch(RPC, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }) });
  const j = await r.json(); if (j.error) throw new Error(j.error.message); return j.result;
}
const sel = (sig) => '0x' + keccak256(sig).slice(0, 8);
const word = (v) => BigInt(v).toString(16).padStart(64, '0');
const addrWord = (a) => a.toLowerCase().replace('0x', '').padStart(64, '0');
async function call(to, sig, args) { return rpc('eth_call', [{ to, data: sel(sig) + (args || []).join('') }, 'latest']); }
const u = (hex, i) => BigInt('0x' + hex.slice(2 + i * 64, 2 + (i + 1) * 64));
const i64 = (hex, i) => { let v = u(hex, i); if (v > (1n << 255n)) v -= (1n << 256n); return v; };
const parsePos = (id, h) => ({ id, owner: '0x' + h.slice(26, 66), sym: Buffer.from(h.slice(66, 130), 'hex').toString('utf8').replace(/\0+$/, ''), isLong: u(h, 2) === 1n, status: Number(u(h, 3)), margin: Number(u(h, 4)) / 1e6, size: Number(u(h, 5)) / 1e6, entry: Number(i64(h, 6)) / 1e8, openedAt: Number(u(h, 7)) * 1000, exit: Number(i64(h, 8)) / 1e8 });

async function state(wallet) {
  if (!PERPS) return { deployed: false, usdg: USDG, signer: key.address };
  const out = { deployed: true, perps: PERPS, usdg: USDG, signer: key.address };
  const [pool, oi, shares, feeBps, maxLev, maint, bounty] = await Promise.all([
    call(PERPS, 'poolBalance()'), call(PERPS, 'openInterest()'), call(PERPS, 'totalShares()'), call(PERPS, 'feeBps()'), call(PERPS, 'maxLev()'), call(PERPS, 'maintBps()'), call(PERPS, 'settleBountyBps()'),
  ]);
  out.pool = Number(u(pool, 0)) / 1e6; out.openInterest = Number(u(oi, 0)) / 1e6; out.totalShares = Number(u(shares, 0)) / 1e6;
  out.feeBps = Number(u(feeBps, 0)); out.maxLev = Number(u(maxLev, 0)); out.maintBps = Number(u(maint, 0)); out.settleBountyBps = Number(u(bounty, 0));
  if (wallet && /^0x[a-fA-F0-9]{40}$/.test(wallet)) {
    const [free, bal, allow, sh, ids, recv, paid] = await Promise.all([
      call(PERPS, 'free(address)', [addrWord(wallet)]), call(USDG, 'balanceOf(address)', [addrWord(wallet)]), call(USDG, 'allowance(address,address)', [addrWord(wallet), addrWord(PERPS)]),
      call(PERPS, 'shares(address)', [addrWord(wallet)]), call(PERPS, 'idsOf(address)', [addrWord(wallet)]), call(PERPS, 'dividendsReceived(address)', [addrWord(wallet)]), call(PERPS, 'dividendsPaid(address)', [addrWord(wallet)]),
    ]);
    out.me = { free: Number(u(free, 0)) / 1e6, usdg: Number(u(bal, 0)) / 1e6, allowance: Number(u(allow, 0)) / 1e6, shares: Number(u(sh, 0)) / 1e6, dividendsReceived: Number(u(recv, 0)) / 1e6, dividendsPaid: Number(u(paid, 0)) / 1e6, positions: [] };
    const n = Number(u(ids, 1)); const idList = []; for (let i = 0; i < n; i++) idList.push(Number(u(ids, 2 + i)));
    const ps = await Promise.all(idList.slice(-40).map((id) => call(PERPS, 'positions(uint256)', [word(id)]).then((h) => parsePos(id, h))));
    out.me.positions = ps;
  }
  return out;
}
async function openPositions() {
  if (!PERPS) return [];
  const n = Number(u(await call(PERPS, 'count()'), 0)); const out = [];
  for (let i = Math.max(0, n - 400); i < n; i++) { const h = await call(PERPS, 'positions(uint256)', [word(i)]); if (Number(u(h, 3)) !== 0) continue; out.push(parsePos(i, h)); }
  return out;
}
module.exports = { init, address, signPrice, signDividend, state, openPositions, sel, RPC, USDG, PERPS, SESS };
