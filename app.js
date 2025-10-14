(function () {
  const csvUrl = 'data/products.csv';

  // Elements (let so we can reassign resultsEl if needed)
  let searchEl = document.getElementById('search');
  let resultsEl = document.getElementById('results');
  const metaEl = document.getElementById('meta');
  const copySelectedBtn = document.getElementById('copySelected');

  // State
  let rows = [];
  let filtered = [];
  const selected = new Set();

  // ---------- Utils ----------
  function fmtGBP(x) {
    if (x === null || x === undefined || x === '') return '£0.00';
    let n = typeof x === 'number' ? x : parseFloat(String(x).replace(/[^\d.-]/g, ''));
    if (!isFinite(n)) n = 0;
    return '£' + n.toFixed(2);
  }

  function matches(q, row) {
    if (!q) return true;
    q = q.toLowerCase();
    return (row.Code || '').toLowerCase().includes(q)
        || (row.Description || '').toLowerCase().includes(q);
  }

  function normalizeRow(d) {
    return {
      Code: d['Code'] ?? d['code'] ?? d['CODE'] ?? '',
      Description: d['Description'] ?? d['Name'] ?? d['DESCRIPTION'] ?? '',
      'Sell price exc VAT': d['Sell price exc VAT'] ?? d['Ex VAT'] ?? d['Price ex VAT'] ?? d['sell_price_ex_vat'] ?? '',
      'Sell price inc VAT': d['Sell price inc VAT'] ?? d['Inc VAT'] ?? d['Price inc VAT'] ?? d['sell_price_inc_vat'] ?? '',
    };
  }

  function debounce(fn, ms) {
    let t;
    return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
  }

  async function copyToClipboard(text) {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand('copy'); } finally { document.body.removeChild(ta); }
    }
  }

  function flash(el) {
    const old = el.textContent;
    el.textContent = '✓ Copied';
    el.style.borderColor = 'var(--ok)';
    setTimeout(() => { el.textContent = old; el.style.borderColor = 'var(--border)'; }, 1200);
  }

  function updateSelectedState() {
    copySelectedBtn.disabled = selected.size === 0;
  }

  // ---------- iOS-safe one-shot search clear ----------
  let shouldClearOnNextInput = false;

  function armSearchClear() {
    shouldClearOnNextInput = true;     // next key/paste replaces content
    searchEl.value = '';               // visually clear
    try { searchEl.setSelectionRange(0, 0); } catch {}
  }

  // ---------- Rendering ----------
  function render() {
    resultsEl.innerHTML = '';
    filtered.forEach((row) => {
      const id = row.Code;
      const item = document.createElement('div');
      item.className = 'item';

      // Checkbox
      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.checked = selected.has(id);
      cb.addEventListener('change', () => {
        if (cb.checked) selected.add(id); else selected.delete(id);
        updateSelectedState();

        // After selection, reset to full list + arm clear
        filtered = rows;
        render();
        armSearchClear();
        searchEl.focus();
      });

      // Main (code + description)
      const main = document.createElement('div');
      main.className = 'item-main';

      const code = document.createElement('div');
      code.className = 'code';
      code.textContent = row.Code || '';

      const desc = document.createElement('div');
      desc.className = 'desc';
      desc.textContent = row.Description || '';

      main.appendChild(code);
      main.appendChild(desc);

      // Right (prices + copy)
      const right = document.createElement('div');
      const prices = document.createElement('div');
      prices.className = 'prices';
      const pill = document.createElement('span');
      pill.className = 'price-pill';
      const exc = fmtGBP(row['Sell price exc VAT']);
      const inc = fmtGBP(row['Sell price inc VAT']);
      pill.textContent = `${exc} ex / ${inc} inc`;
      prices.appendChild(pill);

      const copyBtn = document.createElement('button');
      copyBtn.className = 'copy-btn';
      copyBtn.textContent = 'Copy';
      copyBtn.addEventListener('click', async () => {
        await copyToClipboard(row.Code);
        flash(copyBtn);

        // After copying, reset to full list + arm clear
        filtered = rows;
        render();
        armSearchClear();
        searchEl.focus();
      });

      right.appendChild(prices);
      right.appendChild(copyBtn);

      item.appendChild(cb);
      item.appendChild(main);
      item.appendChild(right);
      resultsEl.appendChild(item);
    });
    metaEl.textContent = `${filtered.length} item${filtered.length !== 1 ? 's' : ''}`;
    updateSelectedState();
  }

  // ---------- Search handlers ----------
  const onSearchInput = debounce(() => {
    const q = searchEl.value.trim();
    filtered = rows.filter(r => matches(q, r));
    render();
  }, 120);
  searchEl.addEventListener('input', onSearchInput);

  // One-shot replace on next input/paste if armed (beats iOS ghost text)
  searchEl.addEventListener('beforeinput', (e) => {
    if (!shouldClearOnNextInput) return;
    const incoming = e.data ?? '';
    e.preventDefault();
    searchEl.value = incoming;
    shouldClearOnNextInput = false;
    const q = searchEl.value.trim();
    filtered = rows.filter(r => matches(q, r));
    render();
  });

  searchEl.addEventListener('paste', (e) => {
    if (!shouldClearOnNextInput) return;
    e.preventDefault();
    const text = (e.clipboardData || window.clipboardData).getData('text');
    searchEl.value = text;
    shouldClearOnNextInput = false;
    const q = searchEl.value.trim();
    filtered = rows.filter(r => matches(q, r));
    render();
  });

  searchEl.addEventListener('focus', () => {
    try {
      const len = searchEl.value.length;
      searchEl.setSelectionRange(len, len);
    } catch {}
  });

  // ---------- Full UI reset after bulk copy ----------
  function resetUIFull() {
    // Clear selection state
    selected.clear();
    updateSelectedState();

    // Force-drop any lingering checkbox 'checked' states (iOS)
    const old = resultsEl;
    const neu = old.cloneNode(false); // empty clone, no children
    old.parentNode.replaceChild(neu, old);
    resultsEl = neu; // update reference

    // Restore full list, re-render fresh (all boxes unchecked)
    filtered = rows;
    render();

    // Clear search and refocus for the next batch
    armSearchClear();
    searchEl.focus();

    // Optional: jump back to top
    try { window.scrollTo({ top: 0, behavior: 'instant' }); } catch {}
  }

  // ---------- Bulk copy ----------
  copySelectedBtn.addEventListener('click', async () => {
    if (!selected.size) return;

    // Copy the selection (one code per line)
    await copyToClipboard(Array.from(selected).join('\n'));
    flash(copySelectedBtn);
    copySelectedBtn.blur?.();

    // Full reset so you can immediately start a fresh list
    resetUIFull();
  });

  // ---------- Data load ----------
  async function loadCSV() {
    const resp = await fetch(csvUrl, { cache: 'no-cache' });
    if (!resp.ok) throw new Error('Failed to load products CSV');
    const text = await resp.text();

    if (typeof Papa !== 'undefined' && Papa.parse) {
      const parsed = Papa.parse(text, { header: true, skipEmptyLines: true });
      return parsed.data;
    }

    // Minimal fallback CSV parser
    const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
    let out = [], cur = [], inQ = false, field = '', headers;
    const pushField = () => { cur.push(field); field = ''; };
    const pushRow = () => { if (cur.length) out.push(cur); cur = []; };

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      for (let j = 0; j < line.length; j++) {
        const ch = line[j];
        if (ch === '"') {
          if (inQ && line[j + 1] === '"') { field += '"'; j++; }
          else inQ = !inQ;
        } else if (ch === ',' && !inQ) {
          pushField();
        } else {
          field += ch;
        }
      }
      if (inQ) { field += '\n'; } else { pushField(); pushRow(); }
    }

    headers = out.shift() || [];
    return out.map(row => {
      const obj = {};
      for (let i = 0; i < headers.length; i++) obj[headers[i]?.trim()] = (row[i] ?? '').trim();
      return obj;
    });
  }

  // Boot
  loadCSV().then(data => {
    rows = (data || []).map(normalizeRow).filter(r => r.Code);
    filtered = rows;
    render();
  }).catch(err => {
    resultsEl.innerHTML = `<div style="padding:16px;color:#ffb3b3;">Failed to load products: ${err?.message || err}</div>`;
  });
})();
