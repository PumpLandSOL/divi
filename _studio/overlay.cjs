// DIVI caption / title / cursor overlay injected into the real page (paper · ink · gold).
'use strict';
module.exports = String.raw`(() => {
  const s = document.createElement('style');
  s.textContent = "#dmT{position:fixed;inset:0;z-index:99999;display:flex;flex-direction:column;align-items:center;justify-content:center;opacity:0;transition:opacity .45s;pointer-events:none}#dmT.on{opacity:1}#dmT.solid{background:#f6f3ee}#dmT.dark{background:#151412}#dmT .t{font-family:'Instrument Serif',Georgia,serif;font-weight:400;font-size:112px;line-height:.95;letter-spacing:-.025em;color:#151412;text-align:center;max-width:1100px}#dmT.dark .t{color:#f6f3ee}#dmT .t em{font-style:italic;color:#a37d12}#dmT.dark .t em{color:#e5c158}#dmT .s{font-family:'Inter Tight',system-ui,sans-serif;font-weight:500;font-size:16px;letter-spacing:.22em;color:#8a847a;margin-top:26px;text-transform:uppercase}#dmC{position:fixed;left:40px;bottom:40px;z-index:99998;max-width:640px;background:#151412;color:#f6f3ee;border-radius:22px;padding:18px 26px;opacity:0;transform:translateY(24px);transition:opacity .3s,transform .3s;box-shadow:0 24px 50px -20px rgba(0,0,0,.45)}#dmC.on{opacity:1;transform:none}#dmC .k{font-family:'Inter Tight',sans-serif;font-weight:600;font-size:12px;letter-spacing:.22em;color:#e5c158;text-transform:uppercase}#dmC .v{font-family:'Instrument Serif',Georgia,serif;font-size:30px;line-height:1.15;margin-top:6px}#dmC .v b{font-weight:400;font-style:italic;color:#e5c158}";
  document.head.appendChild(s);
  const T = document.createElement('div'); T.id = 'dmT'; T.innerHTML = '<div class="t"></div><div class="s"></div>'; document.body.appendChild(T);
  const C = document.createElement('div'); C.id = 'dmC'; C.innerHTML = '<div class="k"></div><div class="v"></div>'; document.body.appendChild(C);
  window.__title = (t, sub, mode) => { T.querySelector('.t').innerHTML = t; T.querySelector('.s').textContent = sub || ''; T.className = 'on ' + (mode || ''); };
  window.__titleHide = () => T.classList.remove('on');
  window.__cap = (k, v) => { C.querySelector('.k').textContent = k || ''; C.querySelector('.v').innerHTML = v || ''; C.classList.add('on'); };
  window.__capHide = () => C.classList.remove('on');
  window.__scrollTo = (y, dur) => new Promise((res) => { const y0 = window.scrollY; const t0 = performance.now(); dur = dur || 1000; (function fr(t) { const k = Math.min(1, (t - t0) / dur), e = k < .5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2; window.scrollTo(0, y0 + (y - y0) * e); if (k < 1) requestAnimationFrame(fr); else res(); })(t0); });
  window.__scrollToSel = (sel, dur, frac) => { const el = document.querySelector(sel); if (!el) return Promise.resolve(); return window.__scrollTo(window.scrollY + el.getBoundingClientRect().top - window.innerHeight * (frac == null ? .12 : frac), dur); };
  return true;
})()`;
