// Two Season graphics: divi-tiers.png (same payday, four wallets) and divi-drip.png (cash vs DRIP over 12 paydays).  node _studio/season-pair.cjs
'use strict';
const fs = require('fs'); const path = require('path'); const { execFileSync } = require('child_process');
const CHROME = process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const BRAND = path.join(__dirname, '..', 'brand'); const TMP = path.join(__dirname, 'out');
const W = 1200, H = 675;
const HEAD = `<!doctype html><html><head><meta charset="utf-8"><link href="https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Inter+Tight:wght@400;500;600;700&display=swap" rel="stylesheet"><style>
*{margin:0;padding:0;box-sizing:border-box}:root{--paper:#f6f3ee;--paper2:#efeae0;--ink:#151412;--ink2:#4a463f;--ink3:#8a847a;--line:#e3ddd0;--gold:#e5c158;--goldDeep:#a37d12;--green:#1f7a4d;--red:#b3342a}
html,body{width:${W}px;height:${H}px;overflow:hidden}body{font-family:'Inter Tight',sans-serif;color:var(--ink);background:var(--paper);padding:42px 56px;position:relative}
.serif{font-family:'Instrument Serif',Georgia,serif;font-weight:400}.i{font-style:italic;color:var(--goldDeep)}
.eyebrow{font:500 12px/1 'Inter Tight';letter-spacing:.2em;text-transform:uppercase;color:var(--ink3)}
h1{font-size:54px;line-height:.95;letter-spacing:-.02em;margin-top:10px;max-width:1000px}
.foot{position:absolute;left:56px;right:56px;bottom:26px;display:flex;justify-content:space-between;font:500 12.5px 'Inter Tight';color:var(--ink3)}
.coin{position:absolute;right:56px;top:40px;width:74px;height:74px;border-radius:50%;background:radial-gradient(circle at 35% 30%,#fff2b0,#e5c158 38%,#b8901f 70%,#8a6a12);box-shadow:0 22px 44px -14px rgba(120,90,10,.6),inset 0 -8px 14px rgba(0,0,0,.28);display:flex;align-items:center;justify-content:center;font-family:'Instrument Serif',serif;font-size:38px;color:#5a4306;transform:rotate(-10deg)}
`;
// ── 1. tiers: same $22.71 payday, four wallets ──
const CASH = 22.71, tiers = [['No $DIVI', 0, 1, '0'], ['Holder', 1, 1.10, '1M'], ['Shareholder', 2, 1.25, '5M'], ['Board', 3, 1.50, '10M']];
const tierHtml = HEAD + `
.wallets{display:grid;grid-template-columns:repeat(4,1fr);gap:16px;margin-top:30px}
.w{background:#fffdf7;border:1px solid var(--line);border-radius:20px;padding:22px 22px 20px;box-shadow:0 24px 50px -30px rgba(40,30,0,.3);position:relative;overflow:hidden}
.w.top{border:2px solid var(--ink)}
.w .addr{font-family:ui-monospace,Menlo,monospace;font-size:12px;color:var(--ink3)}.w .tier{font:600 15px 'Inter Tight';margin-top:10px}.w .hold{font:400 12.5px 'Inter Tight';color:var(--ink3);margin-top:2px}
.w .row{display:flex;justify-content:space-between;align-items:baseline;padding:10px 0;border-bottom:1px solid var(--line);font:400 13.5px 'Inter Tight';color:var(--ink2)}.w .row b{font-family:'Instrument Serif',serif;font-size:22px;color:var(--ink)}
.w .pts{margin-top:14px}.w .pts .lab{font:500 10.5px/1 'Inter Tight';letter-spacing:.18em;text-transform:uppercase;color:var(--goldDeep)}.w .pts .n{font-family:'Instrument Serif',serif;font-size:58px;line-height:1;margin-top:8px;letter-spacing:-.02em}.w .pts .d{font:500 13px 'Inter Tight';color:var(--green);margin-top:6px}
.bar{height:8px;border-radius:4px;background:var(--paper2);margin-top:14px;overflow:hidden}.bar i{display:block;height:100%;background:var(--goldDeep);border-radius:4px}
.strip{background:var(--ink);color:var(--paper);border-radius:18px;padding:18px 26px;margin-top:18px;display:flex;justify-content:space-between;align-items:center;font:400 15px 'Inter Tight';color:#cfc8b8}.strip b{color:#fff;font-weight:600}.strip .f{font-family:'Instrument Serif',serif;font-size:24px;color:#fff;white-space:nowrap;flex:none}.strip .f em{color:var(--gold)}
</style></head><body>
<div class="eyebrow">DIVI · The Payday Season · holder tiers</div>
<h1 class="serif">Same payday. Four wallets. <span class="i">One minted 50% more.</span></h1>
<div class="coin">$</div>
<div class="wallets">${tiers.map(([name, i, x, hold]) => { const pts = Math.round(CASH * 100 * x); return `<div class="w${x === 1.5 ? ' top' : ''}"><div class="addr">0x${['7c1e…a9f2', '3b90…e77d', '8a2f…11c0', '0d1a…c9a4'][i]}</div><div class="tier">${name}${x > 1 ? ' · ' + x.toFixed(2) + '×' : ''}</div><div class="hold">${hold === '0' ? 'holds no $DIVI' : 'holds ' + hold + ' $DIVI · ' + [0, 25, 50, 75][i] + '% fee rebate'}</div>
<div class="row"><span>Long $AAPL · 84 shares</span></div><div class="row"><span>Dividend received</span><b>$${CASH.toFixed(2)}</b></div>
<div class="pts"><div class="lab">Points minted</div><div class="n">${pts.toLocaleString()}</div><div class="d">${x > 1 ? '+' + Math.round((x - 1) * 100) + '% on the same dividend' : 'base rate · 100 per $'}</div><div class="bar"><i style="width:${Math.round(x / 1.5 * 100)}%"></i></div></div></div>`; }).join('')}</div>
<div class="strip"><div class="f">boost = <em>$DIVI held</em></div><div style="max-width:720px">Nothing to stake, nothing to lock. Balance read from Robinhood Chain every 90 s. <b>Stacks with DRIP (2×) and streaks (up to 1.5×).</b></div></div>
<div class="foot"><span>20M $DIVI pool · split pro rata by points · Season 1 ends Oct 31</span><span>divionrh.xyz · 0xec297bed…04ed</span></div>
</body></html>`;

// ── 2. DRIP: $1,000 long CVX at 5×, price flat, 12 quarterly paydays, cash vs DRIP ──
const MARK = 211.73, DIV = 1.7625, LEV = 5, MARGIN = 1000;
let cash = 0, shares = MARGIN * LEV / MARK, drip = 0, dshares = shares; const rows = [];
for (let q = 1; q <= 12; q++) { cash += shares * DIV; const c = dshares * DIV; drip += c; dshares += c * LEV / MARK; rows.push({ q, cash, drip, dshares }); }
const maxV = rows[11].drip; const CH = 230, CW = 1000, n = 12, gw = CW / n, bw = 30;
const y = (v) => CH - v / maxV * CH;
const bars = rows.map((r, i) => { const x0 = i * gw + gw / 2; return `<rect x="${x0 - bw - 2}" y="${y(r.cash)}" width="${bw}" height="${CH - y(r.cash)}" rx="4" fill="#1f7a4d"/><rect x="${x0 + 2}" y="${y(r.drip)}" width="${bw}" height="${CH - y(r.drip)}" rx="4" fill="#a37d12"/><text x="${x0}" y="${CH + 22}" text-anchor="middle" font-family="Inter Tight" font-size="12" fill="#8a847a">Q${r.q}</text>`; }).join('');
const last = rows[11], mid = rows[5];
const lbl = (r, i) => `<text x="${i * gw + gw / 2 - bw / 2 - 2}" y="${y(r.cash) - 8}" text-anchor="middle" font-family="Inter Tight" font-size="12" font-weight="600" fill="#151412">$${Math.round(r.cash)}</text><text x="${i * gw + gw / 2 + bw / 2 + 2}" y="${y(r.drip) - 8}" text-anchor="middle" font-family="Inter Tight" font-size="12" font-weight="600" fill="#151412">$${Math.round(r.drip)}</text>`;
const dripHtml = HEAD + `
.chart{background:#fffdf7;border:1px solid var(--line);border-radius:20px;padding:20px 26px 12px;margin-top:24px;box-shadow:0 24px 50px -30px rgba(40,30,0,.3)}
.legend{display:flex;gap:22px;font:500 13px 'Inter Tight';color:var(--ink2);align-items:center}.legend i{display:inline-block;width:12px;height:12px;border-radius:3px;margin-right:6px;vertical-align:-1px}
.stats{display:flex;gap:40px;margin-top:18px;align-items:flex-end}.stats .note{font:400 12.5px/1.4 'Inter Tight';color:var(--ink3);margin-left:auto;max-width:330px;text-align:right}.stats div b{font-family:'Instrument Serif',serif;font-size:40px;line-height:1;display:block;letter-spacing:-.02em}.stats div span{font:500 11px 'Inter Tight';letter-spacing:.16em;text-transform:uppercase;color:var(--ink3)}
</style></head><body>
<div class="eyebrow">DIVI · DRIP · dividends that buy more dividends</div>
<h1 class="serif">Same stock, same size. <span class="i">Paydays that buy paydays.</span></h1>
<div class="coin">$</div>
<div class="chart"><div class="legend"><span>$1,000 long $CVX at 5× · cumulative dividends received · price held flat</span><span style="margin-left:auto"><i style="background:#1f7a4d"></i>Cash</span><span><i style="background:#a37d12"></i>DRIP on</span></div>
<svg width="${CW}" height="${CH + 30}" viewBox="0 0 ${CW} ${CH + 30}" style="display:block;margin:30px auto 0;overflow:visible"><line x1="0" y1="${CH}" x2="${CW}" y2="${CH}" stroke="#e3ddd0"/>${bars}${lbl(mid, 5)}${lbl(last, 11)}</svg></div>
<div class="stats"><div><b>$${Math.round(last.cash)}</b><span>cash · 12 paydays</span></div><div><b style="color:var(--goldDeep)">$${Math.round(last.drip)}</b><span>DRIP · 12 paydays</span></div><div><b>${last.dshares.toFixed(1)}</b><span>shares from ${shares.toFixed(1)} · DRIP</span></div><div><b>+${Math.round((last.drip / last.cash - 1) * 100)}%</b><span>more, same stock</span></div><div class="note">DRIP: each dividend adds margin, size × leverage and shares at the current mark. Shorts pay it, settled on the ex-date.</div></div>
<div class="foot"><span>20M $DIVI Payday Season pool · DRIP paydays count 2× · Season 1 ends Oct 31</span><span>divionrh.xyz · 0xec297bed…04ed</span></div>
</body></html>`;

fs.mkdirSync(TMP, { recursive: true });
for (const [name, html] of [['divi-tiers', tierHtml], ['divi-drip', dripHtml]]) {
  const f = path.join(TMP, name + '.html'); fs.writeFileSync(f, html);
  execFileSync(CHROME, ['--headless=new', '--disable-gpu', '--no-sandbox', '--hide-scrollbars', '--force-device-scale-factor=2', `--window-size=${W},${H}`, '--virtual-time-budget=6000', `--screenshot=${path.join(BRAND, name + '.png')}`, 'file:///' + f.split(path.sep).join('/')], { stdio: 'ignore' });
  console.log('✓', name + '.png');
}
console.log('drip numbers', rows[11]);
