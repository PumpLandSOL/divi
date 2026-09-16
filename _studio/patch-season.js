// THE PAYDAY SEASON: points on every payday (DRIP 2x, streak multiplier), $DIVI holder tiers read on-chain (points boost + fee rebate), leaderboard, landing section, docs.
const fs = require('fs'), path = require('path');
const R = (f) => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
const Wr = (f, s) => fs.writeFileSync(path.join(__dirname, '..', f), s);
const rep = (s, a, b, f) => { if (!s.includes(a)) throw new Error(f + ' miss: ' + a.slice(0, 80)); return s.split(a).join(b); };

// ── server ──
let s = R('server/index.js');
s = rep(s, "const DESK_START = 10000, DESK_MAX_LEV = 10, DESK_MAINT = 0.05, DESK_FEE_BPS = 8;",
`const DESK_START = 10000, DESK_MAX_LEV = 10, DESK_MAINT = 0.05, DESK_FEE_BPS = 8;

// ── THE PAYDAY SEASON: points for every payday, $DIVI holder tiers read on-chain ──
const SEASON = { n: 1, name: 'Payday Season 1', start: Date.parse(process.env.SEASON_START || '2026-09-16T00:00:00Z'), end: Date.parse(process.env.SEASON_END || '2026-10-31T23:59:59Z'), pool: +(process.env.SEASON_POOL || 20000000), token: '$DIVI' };
const TIERS = [ // $DIVI held (1B supply): 0.1% / 0.5% / 1%
  { name: 'Holder', min: 1000000, boost: 1.10, rebate: 0.25 },
  { name: 'Shareholder', min: 5000000, boost: 1.25, rebate: 0.50 },
  { name: 'Board', min: 10000000, boost: 1.50, rebate: 0.75 },
];
const PTS = { perUsdReceived: 100, perUsdPaid: 25, dripMult: 2, streakStep: 0.10, streakCap: 5, perUsdNotional: 0.01 };
const seasonOpen = () => Date.now() >= SEASON.start && Date.now() <= SEASON.end;
function tierOf(bal) { let t = null; for (const x of TIERS) if (bal >= x.min) t = x; return t; }
function streakMult(n) { return 1 + PTS.streakStep * Math.min(Math.max(n - 1, 0), PTS.streakCap); }
const BAL = {}; // wallet → { bal, at }
async function diviBalance(w) {
  if (!DIVI_MINT || !/^0x[a-f0-9]{40}$/.test(w)) return 0;
  const c = BAL[w]; if (c && Date.now() - c.at < 60e3) return c.bal;
  try { const h = await EVM.call(DIVI_MINT, 'balanceOf(address)', [w.replace('0x', '').padStart(64, '0')]); const bal = Number(BigInt(h)) / 1e18; BAL[w] = { bal, at: Date.now() }; return bal; } catch (e) { return c ? c.bal : 0; }
}
async function refreshTier(w) { const a = acct(w); if (!a) return null; const bal = await diviBalance(w); const t = tierOf(bal); a.divi = bal; a.tier = t ? t.name : null; a.boost = t ? t.boost : 1; a.rebate = t ? t.rebate : 0; dirty = true; return a; }
async function refreshTiers() { for (const w of Object.keys(DB.desk)) { if (!/^0x/.test(w)) continue; await refreshTier(w); await new Promise((r) => setTimeout(r, 80)); } }
setInterval(refreshTiers, 90e3);
function award(a, pts, why, extra) { if (!seasonOpen()) return 0; pts = Math.round(pts); a.pts = (a.pts || 0) + pts; (a.ptsLog = a.ptsLog || []).unshift(Object.assign({ t: Date.now(), pts, why }, extra || {})); a.ptsLog = a.ptsLog.slice(0, 40); dirty = true; return pts; }
function seasonView(w) {
  const rows = Object.entries(DB.desk).filter(([, a]) => (a.pts || 0) > 0).map(([w, a]) => ({ w, pts: a.pts || 0, streak: a.streak || 0, tier: a.tier || null, divReceived: a.divReceived || 0, dripped: a.dripped || 0 })).sort((x, y) => y.pts - x.pts);
  const total = rows.reduce((s, r) => s + r.pts, 0);
  const me = w && DB.desk[String(w).toLowerCase()] ? DB.desk[String(w).toLowerCase()] : null;
  const rank = me ? rows.findIndex((r) => r.w === String(w).toLowerCase()) + 1 : 0;
  return { season: Object.assign({}, SEASON, { open: seasonOpen(), msLeft: Math.max(0, SEASON.end - Date.now()), players: rows.length, totalPts: total }), tiers: TIERS, pts: PTS,
    leaderboard: rows.slice(0, 25).map((r, i) => Object.assign({ rank: i + 1, share: total ? r.pts / total : 0, est: total ? SEASON.pool * r.pts / total : 0 }, r)),
    me: me ? { w: String(w).toLowerCase(), pts: me.pts || 0, rank, share: total ? (me.pts || 0) / total : 0, est: total ? SEASON.pool * (me.pts || 0) / total : 0, streak: me.streak || 0, tier: me.tier || null, boost: me.boost || 1, rebate: me.rebate || 0, divi: me.divi || 0, log: (me.ptsLog || []).slice(0, 12) } : null };
}`, 'season consts');
// dividend settlement → points + streak
s = rep(s, "        if (p.side === 'long') {\n          a.divReceived += cash; p.divReceived = (p.divReceived || 0) + cash;",
`        if (p.side === 'long') {
          a.divReceived += cash; p.divReceived = (p.divReceived || 0) + cash;
          p.streak = (p.streak || 0) + 1; a.streak = Math.max(a.streak || 0, p.streak);
          award(a, cash * PTS.perUsdReceived * (p.drip ? PTS.dripMult : 1) * streakMult(p.streak) * (a.boost || 1), 'payday', { sym: p.sym, cash, drip: !!p.drip, streak: p.streak, boost: a.boost || 1 });`, 'season long');
s = rep(s, "        else { const c = Math.min(cash, p.margin); p.margin -= c; a.divPaid += c; p.divPaid = (p.divPaid || 0) + c; }",
  "        else { const c = Math.min(cash, p.margin); p.margin -= c; a.divPaid += c; p.divPaid = (p.divPaid || 0) + c; award(a, c * PTS.perUsdPaid * (a.boost || 1), 'paid the dividend', { sym: p.sym, cash: c }); }", 'season short');
// fee rebate by tier + notional points
s = rep(s, "  const notional = margin * lev, fee = notional * DESK_FEE_BPS / 1e4;",
  "  const notional = margin * lev, fee = notional * DESK_FEE_BPS / 1e4 * (1 - (a.rebate || 0));\n  award(a, notional * PTS.perUsdNotional * (a.boost || 1), 'trade', { sym, notional });", 'season open');
s = rep(s, "  const pnl = (exit - p.entry) * p.qty * (p.side === 'long' ? 1 : -1) - p.notional * DESK_FEE_BPS / 1e4;",
  "  const pnl = (exit - p.entry) * p.qty * (p.side === 'long' ? 1 : -1) - p.notional * DESK_FEE_BPS / 1e4 * (1 - (a.rebate || 0));", 'season close');
// streak resets when the long is closed or liquidated → handled implicitly (position gone). Account streak is the best live position streak; recompute on view.
s = rep(s, "  return { cash: a.cash, equity, positions, closed: a.closed.slice(0, 20), events: (a.events || []).slice(0, 12), divReceived: a.divReceived || 0, divPaid: a.divPaid || 0, dripped: a.dripped || 0,",
  "  a.streak = a.positions.reduce((m, p) => Math.max(m, p.streak || 0), 0);\n  return { cash: a.cash, equity, positions, closed: a.closed.slice(0, 20), events: (a.events || []).slice(0, 12), divReceived: a.divReceived || 0, divPaid: a.divPaid || 0, dripped: a.dripped || 0, season: { pts: a.pts || 0, streak: a.streak, tier: a.tier || null, boost: a.boost || 1, rebate: a.rebate || 0, divi: a.divi || 0, open: seasonOpen(), end: SEASON.end },", 'season view');
s = rep(s, "  if (u === '/api/leaderboard') return json(res, 200, { rows: leaderboard() });",
`  if (u === '/api/leaderboard') return json(res, 200, { rows: leaderboard() });
  if (u === '/api/season') { const w = url.searchParams.get('w'); if (w && /^0x[a-f0-9]{40}$/i.test(w)) await refreshTier(w.toLowerCase()); return json(res, 200, seasonView(w)); }
  if (u === '/api/dev/payday' && process.env.DEV === '1' && req.method === 'POST') { // simulate an ex-date on every open position of a wallet (dev only)
    const b = await body(req); const a = acct(b.w); if (!a) return json(res, 400, { error: 'bad wallet' }); const amt = +b.amount || 0.25; const t = Date.now();
    for (const p of a.positions) { const m = E.feed(p.sym); if (!m) continue; const cash = p.qty * amt;
      if (p.side === 'long') { a.divReceived += cash; p.divReceived = (p.divReceived || 0) + cash; p.streak = (p.streak || 0) + 1; a.streak = Math.max(a.streak || 0, p.streak); if (p.drip) { const add = cash * p.lev; p.margin += cash; p.notional += add; p.qty += add / m.mark; p.dripped = (p.dripped || 0) + cash; p.drips = (p.drips || 0) + 1; a.dripped = (a.dripped || 0) + cash; } else a.cash += cash; award(a, cash * PTS.perUsdReceived * (p.drip ? PTS.dripMult : 1) * streakMult(p.streak) * (a.boost || 1), 'payday', { sym: p.sym, cash, drip: !!p.drip, streak: p.streak, boost: a.boost || 1 }); }
      else { const c = Math.min(cash, p.margin); p.margin -= c; a.divPaid += c; p.divPaid = (p.divPaid || 0) + c; award(a, c * PTS.perUsdPaid * (a.boost || 1), 'paid the dividend', { sym: p.sym, cash: c }); }
      (a.events = a.events || []).unshift({ t, sym: p.sym, side: p.side, cash, exTs: Math.floor(t / 1000), drip: !!(p.side === 'long' && p.drip) }); }
    dirty = true; return json(res, 200, { ok: true, account: deskView(b.w) }); }`, 'season routes');
s = rep(s, "  if (u === '/api/config') return json(res, 200, { token: '$DIVI',", "  if (u === '/api/config') return json(res, 200, { season: Object.assign({}, SEASON, { open: seasonOpen() }), tiers: TIERS, token: '$DIVI',", 'season config');
Wr('server/index.js', s);

// evm.js: export call
let ev = R('server/evm.js');
ev = rep(ev, "module.exports = { init, address, signPrice, signDividend, state, openPositions, sel, RPC, USDG, PERPS, SESS };", "module.exports = { init, address, signPrice, signDividend, state, openPositions, sel, call, RPC, USDG, PERPS, SESS };", 'evm export');
Wr('server/evm.js', ev);

// ── desk: season row ──
let d = R('client/desk.html');
d = rep(d, "    R.push('spacer');\n    R.push([{v:'Open positions',cls:'hd',span:11}]);",
`    const sn=A.season||{};R.push([{v:'Payday Season',cls:'hd',span:11}]);
    R.push([{v:'Points',cls:'h'},{v:fmt(sn.pts||0,0),cls:'r b',f:'=$received×100 ×DRIP2 ×streak ×tier'},{v:'Streak',cls:'h'},{v:(sn.streak||0)+' payday'+(sn.streak===1?'':'s'),cls:'r',note:'consecutive ex-dates held through, +10% each up to 5'},{v:'Tier',cls:'h'},{v:sn.tier?sn.tier+' · '+sn.boost+'×':'none · hold $DIVI',cls:'r '+(sn.tier?'green':'muted'),note:'$DIVI held: '+fmt(sn.divi||0,0)},{v:'Fee rebate',cls:'h'},{v:Math.round((sn.rebate||0)*100)+'%',cls:'r'},{el:btn('Season board',()=>location.href='/#season'),span:3}]);
    R.push('spacer');
    R.push([{v:'Open positions',cls:'hd',span:11}]);`, 'desk season');
Wr('client/desk.html', d);

// ── landing: season section + FAQ ──
let i = R('client/index.html');
i = rep(i, "  <section>\n    <div class=\"calc\">",
`  <section id="season">
    <div class="sect-head"><h2>The Payday Season. <em>Points every ex-date.</em></h2><p>Every dividend your desk receives mints points. DRIP paydays count double, a streak multiplier grows for every consecutive ex-date you hold through, and $DIVI holders get a tier boost and a fee rebate. The season pool goes to the board, pro rata.</p></div>
    <div class="season">
      <div class="sbox"><div class="lab">Season 1 ends in</div><div class="big" id="sCount">—</div><div class="sub" id="sMeta">—</div></div>
      <div class="sbox"><div class="lab">Season pool</div><div class="big" id="sPool">—</div><div class="sub">$DIVI · split by points at season end</div></div>
      <div class="sbox tiers"><div class="lab">Holder tiers · read on-chain</div><div id="sTiers"></div></div>
      <div class="sbox board"><div class="lab">Leaderboard</div><div id="sBoard" class="sub">no points yet · first payday is next ex-date</div><a class="btn gold" href="/desk" style="margin-top:14px">Open the desk →</a></div>
    </div>
  </section>

  <section>
    <div class="calc">`, 'landing season');
i = rep(i, ".rail::-webkit-scrollbar{display:none}",
`.rail::-webkit-scrollbar{display:none}
.season{display:grid;grid-template-columns:1fr 1fr 1.2fr 1.4fr;gap:18px}.sbox{background:var(--paper2);border:1px solid var(--line);border-radius:24px;padding:26px;min-height:200px}
.sbox .lab{font:500 11px/1 var(--ui);letter-spacing:.2em;text-transform:uppercase;color:var(--ink3)}.sbox .big{font:400 54px/1 var(--serif);margin:12px 0 6px;letter-spacing:-.02em}.sbox .sub{font:400 14px/1.5 var(--ui);color:var(--ink2)}
.tier{display:flex;justify-content:space-between;gap:10px;padding:9px 0;border-bottom:1px solid var(--line);font:400 14px var(--ui)}.tier b{font-weight:600}.tier .x{color:var(--goldDeep);font-family:var(--serif);font-size:20px}
.lb{display:flex;justify-content:space-between;gap:10px;padding:7px 0;border-bottom:1px solid var(--line);font:400 13.5px var(--ui)}.lb .mono{font-family:ui-monospace,monospace;font-size:12.5px}.lb b{font-weight:600}
@media(max-width:1000px){.season{grid-template-columns:1fr 1fr}}@media(max-width:600px){.season{grid-template-columns:1fr}}`, 'landing css');
i = rep(i, "  document.getElementById('copy').onclick=()=>navigator.clipboard.writeText(document.getElementById('ca').textContent);",
`  document.getElementById('copy').onclick=()=>navigator.clipboard.writeText(document.getElementById('ca').textContent);
  (function season(){const fmtN=(n)=>n>=1e6?(n/1e6).toFixed(n%1e6?1:0)+'M':n>=1e3?(n/1e3).toFixed(0)+'K':String(Math.round(n));let S=null;
    function tick(){if(!S)return;const ms=Math.max(0,S.season.end-Date.now()),d=Math.floor(ms/864e5),h=Math.floor(ms%864e5/36e5),m=Math.floor(ms%36e5/6e4);document.getElementById('sCount').textContent=d+'d '+h+'h '+m+'m';}
    async function load(){try{S=await fetch('/api/season').then(r=>r.json());}catch(e){return}
      document.getElementById('sPool').textContent=fmtN(S.season.pool);document.getElementById('sMeta').textContent=S.season.players+' desks · '+fmtN(S.season.totalPts)+' points minted';
      document.getElementById('sTiers').innerHTML=S.tiers.map(t=>'<div class="tier"><span><b>'+t.name+'</b> · hold '+fmtN(t.min)+' $DIVI</span><span><span class="x">'+t.boost+'×</span> pts · '+Math.round(t.rebate*100)+'% fee rebate</span></div>').join('');
      if(S.leaderboard.length)document.getElementById('sBoard').innerHTML=S.leaderboard.slice(0,6).map(r=>'<div class="lb"><span>'+r.rank+' <span class="mono">'+r.w.slice(0,6)+'…'+r.w.slice(-4)+'</span>'+(r.tier?' · '+r.tier:'')+'</span><span><b>'+fmtN(r.pts)+'</b> pts · ~'+fmtN(r.est)+' $DIVI</span></div>').join('');
      tick();}
    load();setInterval(load,30000);setInterval(tick,15000);})();`, 'landing js');
i = rep(i, "      <details><summary>What is the practice desk?</summary>",
`      <details><summary>What is the Payday Season?</summary><div class="a">A scored season on the desk. Every dividend your desk receives mints 100 points per dollar. DRIP paydays count double. Holding a long through consecutive ex-dates builds a streak: +10% per payday, up to +50%. Shorts earn 25 points per dollar of dividend they pay, and every trade earns 1 point per $100 of size. At the end of the season the pool of $DIVI is split across the leaderboard pro rata by points. Season 1 runs to October 31, 2026.</div></details>
      <details><summary>What are the holder tiers?</summary><div class="a">Your $DIVI balance is read from Robinhood Chain when you connect and refreshed every 90 seconds. Hold 1M for Holder (1.1× points, 25% fee rebate), 5M for Shareholder (1.25×, 50%), 10M for Board (1.5×, 75%). The boost applies to every point you earn and the rebate to every fee on the desk. Nothing to stake, nothing to lock: hold it in the wallet you trade with.</div></details>
      <details><summary>What is the practice desk?</summary>`, 'landing faq');
Wr('client/index.html', i);

// ── docs ──
let doc = R('client/docs.html');
doc = rep(doc, "  R.push(H('6 · $DIVI'));",
`  R.push(H('5c · The Payday Season'));
  R.push(P('Points','100 per $ of dividend received on a long; ×2 if the position has DRIP on; × streak (1 + 0.10 × consecutive paydays held, capped at 5); × holder tier boost. Shorts: 25 per $ of dividend paid × boost. Trades: 1 per $100 notional × boost. Points mint only while the season is open.'));
  R.push(P('Streak','Each open long counts the consecutive ex-dates it has been held through. Your desk streak is the best live position. Close or get liquidated and that position\\'s streak ends.'));
  R.push(P('Holder tiers','$DIVI balance read via eth_call balanceOf on Robinhood Chain (cached 60 s, all desks refreshed every 90 s). Holder 1M: 1.10× points, 25% fee rebate. Shareholder 5M: 1.25×, 50%. Board 10M: 1.50×, 75%. Rebate applies to the 8 bp desk fee on open and close.'));
  R.push(P('Pool','SEASON_POOL $DIVI (default 20,000,000), split pro rata by points at SEASON_END (default 2026-10-31T23:59:59Z). The leaderboard shows each desk\\'s live share and estimated allocation.'));
  R.push(M('GET /api/season?w=','{ season: { n, name, start, end, pool, open, msLeft, players, totalPts }, tiers, pts, leaderboard: [{ rank, w, pts, streak, tier, share, est }], me }'));
  R.push(H('6 · $DIVI'));`, 'docs');
Wr('client/docs.html', doc);
console.log('season patch applied');
