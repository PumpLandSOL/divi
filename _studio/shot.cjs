// Headless screenshot of a page section: node _studio/shot.cjs <url> <selector> <out.png>
'use strict';
const { spawn } = require('child_process'); const fs = require('fs'); const path = require('path');
const CHROME = process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const [url, sel, out] = process.argv.slice(2); const port = 9470; const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  const chrome = spawn(CHROME, ['--headless=new', '--ignore-gpu-blocklist', '--no-sandbox', '--hide-scrollbars', '--window-size=1280,800', `--remote-debugging-port=${port}`, '--remote-allow-origins=*', `--user-data-dir=${path.join(__dirname, 'rec-profile-shot')}`, url], { stdio: 'ignore' });
  try {
    for (let i = 0; i < 80; i++) { try { if ((await fetch(`http://127.0.0.1:${port}/json/version`)).ok) break; } catch {} await sleep(200); }
    const p = (await (await fetch(`http://127.0.0.1:${port}/json`)).json()).find((t) => t.type === 'page');
    const ws = new WebSocket(p.webSocketDebuggerUrl); await new Promise((res, rej) => { ws.addEventListener('open', res); ws.addEventListener('error', rej); });
    let id = 0; const pending = new Map(); ws.addEventListener('message', (e) => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m.result); pending.delete(m.id); } });
    const send = (method, params = {}) => new Promise((res) => { const mid = ++id; pending.set(mid, res); ws.send(JSON.stringify({ id: mid, method, params })); });
    await send('Page.enable'); await send('Runtime.enable'); await sleep(3000);
    await send('Runtime.evaluate', { expression: `document.documentElement.style.scrollBehavior='auto';document.querySelector(${JSON.stringify(sel)}).scrollIntoView();1`, awaitPromise: true }); await sleep(800);
    const shot = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(out, Buffer.from(shot.data, 'base64')); console.log('✓', out); ws.close();
  } finally { chrome.kill(); }
})().catch((e) => { console.error(e); process.exit(1); });
