// DIVI shipped checklist + comparison vs every other perp (+ $INDEX ATH line) → brand/divi-checklist.png.  node _studio/checklist.cjs
'use strict';
const fs = require('fs'); const path = require('path'); const { execFileSync } = require('child_process');
const CHROME = process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const OUT = path.join(__dirname, '..', 'brand', 'divi-checklist.png'); const TMP = path.join(__dirname, 'out', 'divi-checklist.html');
const W = 1200, H = 675;
const ship = [
  ['Dividends settle on-chain', 'shorts pay, longs receive, pro rata, on the ex-date'],
  ['22 real names', 'AAPL → MRK, every one a real Robinhood Chain pool'],
  ['24/7 marks', 'weighted median: pools + xStock + futures × β, signed'],
  ['Up to 10×, USDG', 'DiviPerps.sol · 8 bp · anyone settles, keeps 1%'],
  ['Dividend calendar', 'declared vs projected, per-share, per $1,000'],
  ['DRIP', 'every payday buys more of the long · compounding'],
  ['Payday ladder', 'every name by next ex-date, yield at your leverage'],
  ['Practice desk', 'same fills, same maintenance, same dividends'],
];
const cmp = [
  ['Ex-date', 'long eats the gap', 'long gets paid'],
  ['Shorts', 'pocket the gap', 'owe the dividend'],
  ['Names', 'crypto majors', '22 tokenized stocks'],
  ['Hours', 'stock closed = stale', '24/7 signed marks'],
  ['Reinvest', '—', 'DRIP'],
  ['Payday', 'never', 'every ex-date'],
];
const html = `<!doctype html><html><head><meta charset="utf-8"><link href="https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Inter+Tight:wght@400;500;600;700&display=swap" rel="stylesheet"><style>
*{margin:0;padding:0;box-sizing:border-box}:root{--paper:#f6f3ee;--paper2:#efeae0;--ink:#151412;--ink2:#4a463f;--ink3:#8a847a;--line:#e3ddd0;--gold:#e5c158;--goldDeep:#a37d12;--green:#1f7a4d;--red:#b3342a}
html,body{width:${W}px;height:${H}px;overflow:hidden}body{font-family:'Inter Tight',sans-serif;color:var(--ink);background:var(--paper);padding:44px 56px;position:relative}
.serif{font-family:'Instrument Serif',Georgia,serif;font-weight:400}.i{font-style:italic;color:var(--goldDeep)}
.eyebrow{font:500 12px/1 'Inter Tight';letter-spacing:.2em;text-transform:uppercase;color:var(--ink3)}
h1{font-size:60px;line-height:.95;letter-spacing:-.02em;margin-top:10px}
.grid{display:grid;grid-template-columns:600px 1fr;gap:34px;margin-top:36px;align-items:start}
.list{display:grid;grid-template-columns:1fr 1fr;gap:22px 20px}
.row{display:flex;gap:10px;align-items:flex-start}.chk{width:26px;height:26px;border-radius:50%;background:var(--green);color:#fff;font:700 15px/26px 'Inter Tight';text-align:center;flex:none;margin-top:1px}
.row b{font:600 17px/1.2 'Inter Tight';display:block}.row span{font:400 13.5px/1.35 'Inter Tight';color:var(--ink3);display:block;margin-top:2px}
table{width:100%;border-collapse:collapse;background:#fffdf7;border:1px solid var(--line);border-radius:18px;overflow:hidden;box-shadow:0 30px 60px -30px rgba(40,30,0,.35)}
th{font:500 11px/1 'Inter Tight';letter-spacing:.16em;text-transform:uppercase;color:var(--ink3);padding:14px 16px;text-align:left;border-bottom:1px solid var(--line)}th.d{color:var(--goldDeep)}
td{padding:15px 16px;font:400 15.5px 'Inter Tight';border-bottom:1px solid var(--line);color:var(--ink2)}td.k{font-weight:600;color:var(--ink)}td.d{font-weight:600;color:var(--green)}td.x{color:var(--red)}
.foot{position:absolute;left:56px;right:56px;bottom:34px;display:flex;justify-content:space-between;align-items:flex-end}
.mc{display:flex;gap:26px}.mc div b{font-family:'Instrument Serif',serif;font-size:34px;line-height:1;display:block}.mc div span{font:500 10.5px 'Inter Tight';letter-spacing:.16em;text-transform:uppercase;color:var(--ink3)}
.coin{position:absolute;right:56px;top:40px;width:78px;height:78px;border-radius:50%;background:radial-gradient(circle at 35% 30%,#fff2b0,#e5c158 38%,#b8901f 70%,#8a6a12);box-shadow:0 22px 44px -14px rgba(120,90,10,.6),inset 0 -8px 14px rgba(0,0,0,.28);display:flex;align-items:center;justify-content:center;font-family:'Instrument Serif',serif;font-size:40px;color:#5a4306;transform:rotate(-10deg)}
</style></head><body>
<div class="eyebrow">DIVI · shipped so far · Robinhood Chain</div>
<h1 class="serif">Perps that pay dividends. <span class="i">Everything on the board.</span></h1>
<div class="coin">$</div>
<div class="grid">
  <div class="list">${ship.map(([b, s]) => `<div class="row"><div class="chk">✓</div><div><b>${b}</b><span>${s}</span></div></div>`).join('')}</div>
  <table><thead><tr><th></th><th>Other perps</th><th class="d">DIVI</th></tr></thead><tbody>${cmp.map(([k, a, b]) => `<tr><td class="k">${k}</td><td class="x">${a}</td><td class="d">${b}</td></tr>`).join('')}</tbody></table>
</div>
<div class="foot"><div class="mc"><div><b>$76M</b><span>$INDEX ATH · Robinhood Chain</span></div><div><b>day one</b><span>$DIVI · perps that pay dividends</span></div></div><div style="font:500 13px 'Inter Tight';color:var(--ink3)">divionrh.xyz · 0xec297bed…04ed</div></div>
</body></html>`;
fs.mkdirSync(path.dirname(TMP), { recursive: true }); fs.writeFileSync(TMP, html);
execFileSync(CHROME, ['--headless=new', '--disable-gpu', '--no-sandbox', '--hide-scrollbars', '--force-device-scale-factor=2', `--window-size=${W},${H}`, '--virtual-time-budget=6000', `--screenshot=${OUT}`, 'file:///' + TMP.split(path.sep).join('/')], { stdio: 'ignore' });
console.log('✓', OUT);
