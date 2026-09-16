// THE PAYDAY UPDATE: board 11 → 22 real RH-pool dividend names + DRIP (auto-reinvest dividends into the long) + /api/payday ladder.
const fs = require('fs'), path = require('path');
const R = (f) => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
const Wr = (f, s) => fs.writeFileSync(path.join(__dirname, '..', f), s);
const rep = (s, a, b, f) => { if (!s.includes(a)) throw new Error(f + ' miss: ' + a.slice(0, 70)); return s.split(a).join(b); };

// 1. engine: 11 new names, all with real Robinhood Chain pools (DexScreener, chainId robinhood, base token)
let e = R('server/engine.js');
e = rep(e, "  { sym: 'MCD',   name: \"McDonald's\",         rh: '0x08E91b659a545Bfb52F1a5e588Bf6Dc2FA85DE7A', fut: 'ES=F' },",
`  { sym: 'MCD',   name: "McDonald's",         rh: '0x08E91b659a545Bfb52F1a5e588Bf6Dc2FA85DE7A', fut: 'ES=F' },
  // ── Payday Update: 11 more dividend payers, every one with a real Robinhood Chain pool ──
  { sym: 'KO',    name: 'Coca-Cola',          rh: '0xf6100b855D8C44d3662aa40DeA90436E6197158c', fut: 'ES=F' },
  { sym: 'XOM',   name: 'Exxon Mobil',        rh: '0x56664778A3d488270cb2f61C67c308350a547AF7', fut: 'ES=F' },
  { sym: 'PG',    name: 'Procter & Gamble',   rh: '0x0F901745D470Fe995603691419B70D8dc190Db2b', fut: 'ES=F' },
  { sym: 'ABBV',  name: 'AbbVie',             rh: '0xA0675aDf2c985D3bB2f4b2c99879122BA67E0B7B', fut: 'ES=F' },
  { sym: 'CVX',   name: 'Chevron',            rh: '0xe0Bd4dB9057105b4F286C8Ce9D3457639c1E60B6', fut: 'ES=F' },
  { sym: 'HD',    name: 'Home Depot',         rh: '0x4e5d97B1bC7B468a85A6ea636EB356410FEd940C', fut: 'ES=F' },
  { sym: 'WMT',   name: 'Walmart',            rh: '0x16Ac89aFC679274896C0eEd8eA66C18e949ECD4c', fut: 'ES=F' },
  { sym: 'JPM',   name: 'JPMorgan Chase',     rh: '0x9459a75B67Da40890EC396b27bfCE6a1F73dc1cB', fut: 'ES=F' },
  { sym: 'UNH',   name: 'UnitedHealth',       rh: '0xb6e8218ABe37F3f39d8b19A7c1529a0a6C813FC7', fut: 'ES=F' },
  { sym: 'LLY',   name: 'Eli Lilly',          rh: '0xc7db6eA9C2B7c8f518D4C958BbBB6A357cF63DB1', fut: 'ES=F' },
  { sym: 'MRK',   name: 'Merck',              rh: '0x90a18453FCD0C0f15CF739c0FE22De840fF7F860', fut: 'ES=F' },`, 'engine');
Wr('server/engine.js', e);

// 2. server: DRIP + payday ladder
let s = R('server/index.js');
s = rep(s, "        if (p.side === 'long') { a.cash += cash; a.divReceived += cash; p.divReceived = (p.divReceived || 0) + cash; }",
`        if (p.side === 'long') {
          a.divReceived += cash; p.divReceived = (p.divReceived || 0) + cash;
          if (p.drip) { // DRIP: the dividend buys more of the same position at the current mark, same leverage
            const add = cash * p.lev; p.margin += cash; p.notional += add; p.qty += add / m.mark; p.dripped = (p.dripped || 0) + cash; p.drips = (p.drips || 0) + 1; a.dripped = (a.dripped || 0) + cash;
          } else a.cash += cash;
        }`, 'server drip');
s = rep(s, "        (a.events = a.events || []).unshift({ t, sym: p.sym, side: p.side, cash, exTs: d.next.exTs });",
  "        (a.events = a.events || []).unshift({ t, sym: p.sym, side: p.side, cash, exTs: d.next.exTs, drip: !!(p.side === 'long' && p.drip) });", 'server event');
s = rep(s, "  return { cash: a.cash, equity, positions, closed: a.closed.slice(0, 20), events: (a.events || []).slice(0, 12), divReceived: a.divReceived || 0, divPaid: a.divPaid || 0,",
  "  return { cash: a.cash, equity, positions, closed: a.closed.slice(0, 20), events: (a.events || []).slice(0, 12), divReceived: a.divReceived || 0, divPaid: a.divPaid || 0, dripped: a.dripped || 0,", 'server view');
s = rep(s, "function deskReset(w) {",
`function deskDrip(w, id, on) {
  const a = acct(w); if (!a) return { error: 'no account' };
  const p = a.positions.find((x) => x.id === id); if (!p) return { error: 'no such position' };
  if (p.side !== 'long') return { error: 'DRIP is for longs: shorts pay the dividend' };
  p.drip = !!on; dirty = true; return { ok: true, drip: p.drip };
}
// payday ladder: every name by next ex-date, with what a $1,000 long at lev earns, and the compounding path with DRIP over a year
function payday(lev) {
  lev = Math.max(1, Math.min(DESK_MAX_LEV, +lev || 1));
  return E.snapshot().map((m) => { const d = E.dividend(m.sym); if (!d) return null; const yieldPct = m.mark ? d.annual / m.mark * 100 : 0; const per1k = d.next ? 1000 * lev / m.mark * d.next.amount : 0;
    const drip = Math.pow(1 + yieldPct / 100 * lev / (d.perYear || 4), d.perYear || 4) - 1; // one year of reinvested paydays, price flat
    return { sym: m.sym, name: m.name, mark: m.mark, annual: d.annual, perYear: d.perYear, yieldPct, levYieldPct: yieldPct * lev, dripYearPct: drip * 100, next: d.next, daysToEx: d.next ? (d.next.exTs * 1000 - Date.now()) / 86400e3 : null, per1k }; })
    .filter(Boolean).sort((x, y) => (x.daysToEx == null ? 1e9 : x.daysToEx) - (y.daysToEx == null ? 1e9 : y.daysToEx));
}
function deskReset(w) {`, 'server drip fn');
s = rep(s, "  if (u === '/api/desk/reset' && req.method === 'POST')",
`  if (u === '/api/desk/drip' && req.method === 'POST') { const b = await body(req); const r = deskDrip(b.w, b.id, b.on); return json(res, r.error ? 400 : 200, r.error ? r : Object.assign(r, { account: deskView(b.w) })); }
  if (u === '/api/payday') return json(res, 200, { lev: +url.searchParams.get('lev') || 1, names: E.BOARD.length, ladder: payday(url.searchParams.get('lev')) });
  if (u === '/api/desk/reset' && req.method === 'POST')`, 'server routes');
Wr('server/index.js', s);

// 3. desk page: DRIP toggle per long + DRIP total
let d = R('client/desk.html');
d = rep(d, "{v:'Received',cls:'hd r'},{v:'',cls:'hd'}]);", "{v:'Received',cls:'hd r'},{v:'DRIP',cls:'hd'}]);", 'desk head');
d = rep(d, "{v:'$'+fmt(p.divReceived||0),cls:'r'},{el:btn('Close',()=>post('/api/",
  "{v:'$'+fmt(p.divReceived||0)+(p.dripped?' <span class=\"muted\">('+(p.drips||0)+' drip)</span>':''),cls:'r'},{el:p.side==='long'?btn(p.drip?'DRIP ON':'drip',()=>post('/api/desk/drip',{w:who(),id:p.id,on:!p.drip}),p.drip?'green':''):btn('Close',()=>post('/api/desk/close',{w:who(),id:p.id})),cls:'edit'},{el:btn('Close',()=>post('/api/", 'desk row');
d = rep(d, "{v:'Dividends paid',cls:'h'},{v:'$'+fmt(A.divPaid),cls:'r red'},{el:btn('Reset'",
  "{v:'Dividends paid',cls:'h'},{v:'$'+fmt(A.divPaid),cls:'r red'},{v:'DRIP reinvested',cls:'h'},{v:'$'+fmt(A.dripped||0),cls:'r green',note:'dividends that bought more of the position instead of landing as cash'},{el:btn('Reset'", 'desk acct');
d = rep(d, "cols:10,widths:[120,110,90,90,90,90,100,110,110,90]", "cols:11,widths:[110,100,80,90,90,90,100,110,120,90,80]", 'desk cols');
d = d.split('span:10}').join('span:11}');
d = rep(d, "R.push([{v:'Dividend events',cls:'hd',span:5},{v:'Closed',cls:'hd',span:5}]);", "R.push([{v:'Dividend events',cls:'hd',span:5},{v:'Closed',cls:'hd',span:6}]);", 'desk events');
d = rep(d, "{v:e?(e.side==='long'?'+':'−')+'$'+fmt(e.cash):'',cls:'r '+(e?(e.side==='long'?'green':'red'):'')},{v:''},",
  "{v:e?(e.side==='long'?'+':'−')+'$'+fmt(e.cash)+(e.drip?' ↻':''):'',cls:'r '+(e?(e.side==='long'?'green':'red'):''),note:e&&e.drip?'reinvested (DRIP)':''},{v:''},", 'desk ev');
d = rep(d, "{v:c?(c.reason==='liquidated'?'<span class=\"chip r\">liquidated</span>':'closed'):''}])}", "{v:c?(c.reason==='liquidated'?'<span class=\"chip r\">liquidated</span>':'closed'):''},{v:''}])}", 'desk closed');
d = rep(d, "<p>10,000 practice USDG. Same fills, same maintenance, same dividends on declared ex-dates.</p>", "<p>10,000 practice USDG. Same fills, same maintenance, same dividends on declared ex-dates. Turn <b>DRIP</b> on a long and every payday buys more of it.</p>", 'desk sub');
Wr('client/desk.html', d);

// 4. landing copy + FAQ
let i = R('client/index.html');
i = rep(i, '<h2>Eleven names. <em>Every payday.</em></h2><p>Real tokenized stocks with real Robinhood Chain pools.', '<h2>Twenty-two names. <em>Every payday.</em></h2><p>Real tokenized stocks with real Robinhood Chain pools, from Apple to Exxon to JPMorgan.', 'landing h2');
i = rep(i, 'Eleven dividend payers with real Robinhood Chain pools: AAPL, MSFT, NVDA, META, GOOGL, SPY, QQQ, JNJ, IBM, COST and MCD.', 'Twenty-two dividend payers with real Robinhood Chain pools: AAPL, MSFT, NVDA, META, GOOGL, SPY, QQQ, JNJ, IBM, COST, MCD, KO, XOM, PG, ABBV, CVX, HD, WMT, JPM, UNH, LLY and MRK.', 'landing faq');
i = rep(i, '<details><summary>What is the practice desk?</summary>', `<details><summary>What is DRIP?</summary><div class="a">Dividend reinvestment, the way a brokerage does it, on a perp. Turn DRIP on for any long and on each ex-date the dividend you receive from the shorts buys more of the same position at the current mark, at the same leverage, instead of landing as cash. Shares grow every payday, so the next payday is bigger. Turn it off any time and the dividends land as cash again.</div></details>
      <details><summary>What is the payday ladder?</summary><div class="a">Every name on the board ordered by its next ex-date, with the yield, the yield at your leverage, what a $1,000 long collects on that date, and the one-year compounding path with DRIP. It is at <code>/api/payday?lev=</code> and on the calendar.</div></details>
      <details><summary>What is the practice desk?</summary>`, 'landing faq2');
Wr('client/index.html', i);
console.log('payday patch applied');
