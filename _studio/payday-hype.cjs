// DIVI hype — 10s, recorded on the REAL hero (coin rain) with kinetic serif titles over it.
'use strict';
const path = require('path');
const { record } = require('./rec.cjs');
const OVERLAY = require('./overlay.cjs');
const SITE = process.env.SITE || 'http://localhost:8196';
record({ site: SITE + '/', out: path.join(__dirname, '..', 'brand', 'divi-payday-10s.mp4'), port: 9462, script: async ({ ev, sleep }) => {
  await ev(OVERLAY, true); await sleep(1200);
  await ev("window.__title('THE PAYDAY UPDATE','divi · shipped today','dark')"); await sleep(1500);
  await ev("window.__title('22 names.<br><em>Double the board.</em>','KO · XOM · PG · ABBV · CVX · HD · WMT · JPM · UNH · LLY · MRK · real Robinhood Chain pools','solid')"); await sleep(2000);
  await ev("window.__title('DRIP.<br><em>Paydays buy more.</em>','every dividend reinvests into the long · shares grow every ex-date','dark')"); await sleep(2000);
  await ev("window.__title('The payday ladder.','every name by next ex-date · yield at your leverage · 1-year DRIP path','solid')"); await sleep(1700);
  await ev('window.__titleHide()'); await sleep(600);
  await ev("window.__title('DIVI','perps that pay dividends · divionrh.xyz · $DIVI','dark')"); await sleep(1000);
} }).catch((e) => { console.error(e); process.exit(1); });
