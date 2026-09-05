// DIVI sheet renderer. A grid of rows; every cell can carry a formula (shown in the formula bar when selected).
// Cell: { v: html, cls, f: 'formula', note: 'plain-English explanation', span: colspan, id } or a plain string/number.
'use strict';
(function () {
  const COLS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  function Sheet(host, opts) {
    this.host = host; this.cols = (opts && opts.cols) || 10; this.widths = (opts && opts.widths) || [];
    this.sel = null; this.rows = [];
    host.innerHTML = '';
    this.table = document.createElement('table'); this.table.className = 'grid';
    const cg = document.createElement('colgroup'); const c0 = document.createElement('col'); c0.style.width = '44px'; cg.appendChild(c0);
    for (let i = 0; i < this.cols; i++) { const c = document.createElement('col'); if (this.widths[i]) c.style.width = this.widths[i] + 'px'; cg.appendChild(c); }
    this.table.appendChild(cg);
    const th = document.createElement('thead'); const tr = document.createElement('tr'); tr.innerHTML = '<th class="rn"></th>' + Array.from({ length: this.cols }, (_, i) => '<th>' + COLS[i] + '</th>').join(''); th.appendChild(tr); this.table.appendChild(th);
    this.tbody = document.createElement('tbody'); this.table.appendChild(this.tbody); host.appendChild(this.table);
    this.fxBox = document.querySelector('.fxbar .box'); this.fxFormula = document.querySelector('.fxbar .formula');
    this.table.addEventListener('click', (e) => { const td = e.target.closest('td'); if (!td || td.classList.contains('rn') || !this.table.contains(td)) return; this.select(td); });
  }
  Sheet.prototype.select = function (td) {
    if (this.sel) this.sel.classList.remove('sel'); this.sel = td; td.classList.add('sel');
    const ref = td.dataset.ref || ''; const f = td.dataset.f || '', note = td.dataset.note || '';
    if (this.fxBox) this.fxBox.textContent = ref;
    if (this.fxFormula) this.fxFormula.innerHTML = (f ? escapeHtml(f) : escapeHtml(td.textContent.trim())) + (note ? '<i>' + escapeHtml(note) + '</i>' : '');
  };
  function escapeHtml(s) { return String(s).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c])); }
  // rows: array of arrays of cells; returns nothing. Keeps selection by data-id when re-rendered.
  Sheet.prototype.render = function (rows) {
    const keep = this.sel && this.sel.dataset.id;
    const frag = document.createDocumentFragment();
    rows.forEach((cells, ri) => {
      const tr = document.createElement('tr'); if (cells === 'spacer' || (cells && cells.spacer)) { tr.className = 'spacer'; tr.innerHTML = '<td class="rn">' + (ri + 1) + '</td><td colspan="' + this.cols + '"></td>'; frag.appendChild(tr); return; }
      const rn = document.createElement('td'); rn.className = 'rn'; rn.textContent = ri + 1; tr.appendChild(rn);
      let ci = 0;
      for (const cell of cells) {
        const c = (cell && typeof cell === 'object' && !(cell instanceof Node)) ? cell : { v: cell };
        const td = document.createElement('td');
        if (c.span) td.colSpan = c.span;
        if (c.cls) td.className = c.cls;
        td.dataset.ref = COLS[ci] + (ri + 1);
        if (c.f) td.dataset.f = c.f; if (c.note) td.dataset.note = c.note; if (c.id) td.dataset.id = c.id;
        if (c.el) td.appendChild(c.el); else td.innerHTML = c.v == null ? '' : c.v;
        if (c.title) td.title = c.title;
        tr.appendChild(td); ci += c.span || 1;
      }
      while (ci < this.cols) { const td = document.createElement('td'); td.dataset.ref = COLS[ci] + (ri + 1); tr.appendChild(td); ci++; }
      frag.appendChild(tr);
    });
    // pad with empty rows so it looks like a sheet
    for (let r = rows.length; r < rows.length + 6; r++) { const tr = document.createElement('tr'); tr.innerHTML = '<td class="rn">' + (r + 1) + '</td>' + Array.from({ length: this.cols }, (_, i) => '<td data-ref="' + COLS[i] + (r + 1) + '"></td>').join(''); frag.appendChild(tr); }
    this.tbody.replaceChildren(frag);
    if (keep) { const td = this.tbody.querySelector('[data-id="' + keep + '"]'); if (td) this.select(td); }
    else if (this.sel) { const td = this.tbody.querySelector('[data-ref="' + this.sel.dataset.ref + '"]'); if (td) this.select(td); }
  };
  window.Sheet = Sheet;
  // helpers
  window.fmt = (n, d) => (n == null || isNaN(n)) ? '—' : (+n).toLocaleString(undefined, { minimumFractionDigits: d == null ? 2 : d, maximumFractionDigits: d == null ? 2 : d });
  window.fmtDate = (ms) => ms ? new Date(ms).toLocaleDateString('en-US', { timeZone: 'UTC', month: 'short', day: 'numeric', year: 'numeric' }) : '—';
  window.toast = (msg, err) => { let t = document.querySelector('.toast'); if (!t) { t = document.createElement('div'); t.className = 'toast'; document.body.appendChild(t); } t.textContent = msg; t.className = 'toast on' + (err ? ' err' : ''); clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove('on'), 4200); };
  window.sessChip = (s) => s === 'open' ? '<span class="chip g">OPEN</span>' : s === 'closed' ? '<span class="chip a">CLOSED</span>' : '<span class="chip b">' + s.toUpperCase() + '</span>';
})();
