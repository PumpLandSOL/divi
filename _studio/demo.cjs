// DIVI product demo — 15s. Real site: hero → the dividend moves → paycheck cards → calculator → trade.
'use strict';
const path = require('path');
const { record } = require('./rec.cjs');
const OVERLAY = require('./overlay.cjs');
const SITE = process.env.SITE || 'http://localhost:8196';
record({ site: SITE + '/', out: path.join(__dirname, '..', 'brand', 'divi-demo-15s.mp4'), port: 9462, script: async ({ ev, sleep }) => {
  await ev(OVERLAY, true); await sleep(1000);
  await ev("window.__cap('divionrh.xyz','Perps on tokenized stocks that <b>pay real dividends.</b> Robinhood Chain, USDG, 24/7.')"); await sleep(1500);
  await ev('window.__capHide()');
  await ev("(async()=>{const h=document.getElementById('how');await window.__scrollTo(h.offsetTop+innerHeight*0.5,1200)})()", true);
  await ev("window.__cap('the ex-date','The short’s margin is debited shares × dividend. <b>The cash crosses to the long.</b>')");
  await ev("(async()=>{const h=document.getElementById('how');await window.__scrollTo(h.offsetTop+innerHeight*1.95,2000)})()", true); await sleep(400);
  await ev('window.__capHide()'); await sleep(100);
  await ev("window.__scrollToSel('#rail',800,.28)", true);
  await ev("window.__cap('eleven names','Live 24/7 mark, next payday, per-share amount, <b>what a $1,000 long earns.</b>')"); await sleep(500);
  await ev("(async()=>{const r=document.getElementById('rail');const t0=performance.now();await new Promise(res=>{(function f(t){const k=Math.min(1,(t-t0)/1300);r.scrollLeft=k*700;if(k<1)requestAnimationFrame(f);else res()})(t0)})})()", true); await sleep(200);
  await ev('window.__capHide()'); await sleep(100);
  await ev("window.__scrollToSel('.calc',800,.12)", true);
  await ev("window.__cap('your long','Pick a name, size and leverage. <b>The dividend you collect</b>, live.')");
  await ev("(async()=>{const m=document.getElementById('cMar'),l=document.getElementById('cLev');for(let i=0;i<10;i++){m.value=+m.value+900;m.dispatchEvent(new Event('input'));await new Promise(r=>setTimeout(r,80))}for(let i=0;i<4;i++){l.value=+l.value+1;l.dispatchEvent(new Event('input'));await new Promise(r=>setTimeout(r,120))}})()", true); await sleep(600);
  await ev('window.__capHide()'); await sleep(100);
  await ev("location.href='" + SITE + "/trade'"); await sleep(1400);
  await ev(OVERLAY, true);
  await ev("window.__cap('trade it','USDG perps, up to 10×, signed fills. <b>Settle any declared dividend on-chain.</b>')"); await sleep(1400);
  await ev('window.__capHide()'); await sleep(100);
  await ev("window.__title('DIVI','perps that pay dividends · divionrh.xyz · $DIVI','dark')"); await sleep(1300);
} }).catch((e) => { console.error(e); process.exit(1); });
