// DIVI hype — 10s, recorded on the REAL hero (coin rain) with kinetic serif titles over it.
'use strict';
const path = require('path');
const { record } = require('./rec.cjs');
const OVERLAY = require('./overlay.cjs');
const SITE = process.env.SITE || 'http://localhost:8196';
record({ site: SITE + '/', out: path.join(__dirname, '..', 'brand', 'divi-season-10s.mp4'), port: 9463, script: async ({ ev, sleep }) => {
  await ev(OVERLAY, true); await sleep(1200);
  await ev("window.__title('THE PAYDAY SEASON','divi · season 1 · live now','dark')"); await sleep(1500);
  await ev("window.__title('Every ex-date<br><em>mints points.</em>','100 pts per $ of dividend · DRIP counts double · streaks up to +50%','solid')"); await sleep(2000);
  await ev("window.__title('Hold $DIVI.<br><em>Get the boost.</em>','1M · 5M · 10M held on-chain → 1.1× · 1.25× · 1.5× points + fee rebates','dark')"); await sleep(2000);
  await ev("window.__title('20M $DIVI pool.','split by points · ends Oct 31 · leaderboard live','solid')"); await sleep(1700);
  await ev('window.__titleHide()'); await sleep(600);
  await ev("window.__title('DIVI','perps that pay dividends · divionrh.xyz · $DIVI','dark')"); await sleep(1000);
} }).catch((e) => { console.error(e); process.exit(1); });
