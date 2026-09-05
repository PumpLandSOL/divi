// DIVI hype — 10s, recorded on the REAL hero (coin rain) with kinetic serif titles over it.
'use strict';
const path = require('path');
const { record } = require('./rec.cjs');
const OVERLAY = require('./overlay.cjs');
const SITE = process.env.SITE || 'http://localhost:8196';
record({ site: SITE + '/', out: path.join(__dirname, '..', 'brand', 'divi-hype-10s.mp4'), port: 9461, script: async ({ ev, sleep }) => {
  await ev(OVERLAY, true); await sleep(1400);
  await ev("window.__title('Every perp on earth<br><em>forgets the dividend.</em>','stock goes ex · price gaps · the long eats it','solid')"); await sleep(1800);
  await ev("window.__title('DIVI <em>settles it.</em>','on the ex-date · pro rata by shares · on-chain','dark')"); await sleep(1600);
  await ev("window.__title('Shorts pay.<br><em>Longs get paid.</em>','like stock lending · no treasury · no emissions','solid')"); await sleep(1700);
  await ev('window.__titleHide()'); await sleep(1400);
  await ev("window.__title('DIVI','perps that pay dividends · divionrh.xyz · $DIVI','dark')"); await sleep(1400);
} }).catch((e) => { console.error(e); process.exit(1); });
