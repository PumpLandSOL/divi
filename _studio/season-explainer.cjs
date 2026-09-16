// DIVI Payday Season explainer: how points mint, multipliers, holder tiers, worked example → brand/divi-season.png.  node _studio/season-explainer.cjs
'use strict';
const fs = require('fs'); const path = require('path'); const { execFileSync } = require('child_process');
const CHROME = process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const OUT = path.join(__dirname, '..', 'brand', 'divi-season.png'); const TMP = path.join(__dirname, 'out', 'divi-season.html');
const W = 1200, H = 675;
const html = `<!doctype html><html><head><meta charset="utf-8"><link href="https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Inter+Tight:wght@400;500;600;700&display=swap" rel="stylesheet"><style>
*{margin:0;padding:0;box-sizing:border-box}:root{--paper:#f6f3ee;--paper2:#efeae0;--ink:#151412;--ink2:#4a463f;--ink3:#8a847a;--line:#e3ddd0;--gold:#e5c158;--goldDeep:#a37d12;--green:#1f7a4d;--red:#b3342a}
html,body{width:${W}px;height:${H}px;overflow:hidden}body{font-family:'Inter Tight',sans-serif;color:var(--ink);background:var(--paper);padding:42px 56px;position:relative}
.serif{font-family:'Instrument Serif',Georgia,serif;font-weight:400}.i{font-style:italic;color:var(--goldDeep)}
.eyebrow{font:500 12px/1 'Inter Tight';letter-spacing:.2em;text-transform:uppercase;color:var(--ink3)}
h1{font-size:54px;line-height:.95;letter-spacing:-.02em;margin-top:10px;max-width:980px}
.grid{display:grid;grid-template-columns:1fr 1fr 1fr;gap:18px;margin-top:30px}
.box{background:#fffdf7;border:1px solid var(--line);border-radius:20px;padding:22px 24px;box-shadow:0 24px 50px -30px rgba(40,30,0,.3)}
.box .lab{font:500 10.5px/1 'Inter Tight';letter-spacing:.18em;text-transform:uppercase;color:var(--goldDeep);margin-bottom:12px}
.k{display:flex;justify-content:space-between;align-items:baseline;gap:10px;padding:13px 0;border-bottom:1px solid var(--line);font:400 15px 'Inter Tight';color:var(--ink2)}.k b{font:600 15px 'Inter Tight';color:var(--ink)}.k .n{font-family:'Instrument Serif',serif;font-size:30px;line-height:1;color:var(--ink)}
.k:last-child{border-bottom:0}
.eq{background:var(--ink);color:var(--paper);border-radius:20px;padding:24px 28px;margin-top:20px;display:flex;justify-content:space-between;align-items:center;gap:20px}
.eq .f{font-family:'Instrument Serif',serif;font-size:30px;letter-spacing:-.01em}.eq .f em{color:var(--gold);font-style:italic}
.eq .ex{font:400 13.5px/1.45 'Inter Tight';color:#cfc8b8;max-width:520px}.eq .ex b{color:#fff;font-weight:600}
.foot{position:absolute;left:56px;right:56px;bottom:26px;display:flex;justify-content:space-between;font:500 12.5px 'Inter Tight';color:var(--ink3)}
.coin{position:absolute;right:56px;top:40px;width:74px;height:74px;border-radius:50%;background:radial-gradient(circle at 35% 30%,#fff2b0,#e5c158 38%,#b8901f 70%,#8a6a12);box-shadow:0 22px 44px -14px rgba(120,90,10,.6),inset 0 -8px 14px rgba(0,0,0,.28);display:flex;align-items:center;justify-content:center;font-family:'Instrument Serif',serif;font-size:38px;color:#5a4306;transform:rotate(-10deg)}
</style></head><body>
<div class="eyebrow">DIVI · The Payday Season · how points work</div>
<h1 class="serif">Every ex-date <span class="i">mints points.</span> Hold $DIVI, <span class="i">multiply them.</span></h1>
<div class="coin">$</div>
<div class="grid">
  <div class="box"><div class="lab">01 · How points mint</div>
    <div class="k"><span><b>Dividend received</b> on a long</span><span class="n">100 <span style="font:400 13px 'Inter Tight';color:var(--ink3)">/ $</span></span></div>
    <div class="k"><span><b>Dividend paid</b> as a short</span><span class="n">25 <span style="font:400 13px 'Inter Tight';color:var(--ink3)">/ $</span></span></div>
    <div class="k"><span><b>Trade</b> opened, any side</span><span class="n">1 <span style="font:400 13px 'Inter Tight';color:var(--ink3)">/ $100</span></span></div>
    <div class="k"><span>Counted on the desk, live</span><span style="font:400 12px 'Inter Tight';color:var(--ink3)">while the season is open</span></div>
  </div>
  <div class="box"><div class="lab">02 · Multipliers stack</div>
    <div class="k"><span><b>DRIP on</b> · payday buys more</span><span class="n">2×</span></div>
    <div class="k"><span><b>Streak</b> · each ex-date held through</span><span class="n">+10%</span></div>
    <div class="k"><span>Streak cap · 5 paydays</span><span class="n">1.5×</span></div>
    <div class="k"><span><b>Holder tier</b> · read on-chain</span><span class="n">up to 1.5×</span></div>
  </div>
  <div class="box"><div class="lab">03 · Holder tiers · $DIVI held</div>
    <div class="k"><span><b>Holder</b> · 1M</span><span class="n">1.10× <span style="font:400 12px 'Inter Tight';color:var(--ink3)">· 25% fee rebate</span></span></div>
    <div class="k"><span><b>Shareholder</b> · 5M</span><span class="n">1.25× <span style="font:400 12px 'Inter Tight';color:var(--ink3)">· 50% rebate</span></span></div>
    <div class="k"><span><b>Board</b> · 10M</span><span class="n">1.50× <span style="font:400 12px 'Inter Tight';color:var(--ink3)">· 75% rebate</span></span></div>
    <div class="k"><span>Nothing to stake or lock</span><span style="font:400 12px 'Inter Tight';color:var(--ink3)">hold it in the wallet you trade with</span></div>
  </div>
</div>
<div class="eq"><div class="f">points = <em>$ received</em> × 100 × DRIP × streak × tier</div><div class="ex"><b>Example:</b> long $AAPL, DRIP on, 3rd payday in a row, Board tier. $22.71 dividend → 22.71 × 100 × 2 × 1.2 × 1.5 = <b>8,176 points</b> on one ex-date.</div></div>
<div class="foot"><span>20M $DIVI pool · split pro rata by points · Season 1 ends Oct 31</span><span>divionrh.xyz · 0xec297bed…04ed</span></div>
</body></html>`;
fs.mkdirSync(path.dirname(TMP), { recursive: true }); fs.writeFileSync(TMP, html);
execFileSync(CHROME, ['--headless=new', '--disable-gpu', '--no-sandbox', '--hide-scrollbars', '--force-device-scale-factor=2', `--window-size=${W},${H}`, '--virtual-time-budget=6000', `--screenshot=${OUT}`, 'file:///' + TMP.split(path.sep).join('/')], { stdio: 'ignore' });
console.log('✓', OUT);
