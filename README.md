# Vet-Code-Lookup/* Vet Code Lookup (online) */
(function(){
  const csvUrl = 'data/products.csv'; // replace with your real CSV path if needed
  const searchEl = document.getElementById('search');
  const resultsEl = document.getElementById('results');
  const metaEl = document.getElementById('meta');
  const copySelectedBtn = document.getElementById('copySelected');

  let rows = [];
  let filtered = [];
  let selected = new Set();

  function fmtGBP(x){
    if (x === null || x === undefined || x === '') return '£0.00';
    let n = typeof x === 'number' ? x : parseFloat(String(x).replace(/[^\d.-]/g,''));
    if (!isFinite(n)) n = 0;
    return '£' + n.toFixed(2);
  }

  function tinyCSV(text){
    // Simple CSV fallback: handles commas, newlines, double-quoted fields with commas.
    const lines = text.replace(/\r\n/g,'\n').replace(/\r/g,'\n').split('\n');
    let out = [];
    let headers = null;
    let cur = [];
    let inQuotes = false;
    let field = '';
    function pushField(){ cur.push(field); field=''; }
    function pushRow(){ if (cur.length) out.push(cur); cur=[]; }
    for (let i=0;i<lines.length;i++){
      let line = lines[i];
      for (let j=0;j<line.length;j++){
        const ch = line[j];
        if (ch === '"'){
          if (inQuotes && line[j+1] === '"'){ field+='"'; j++; }
          else inQuotes = !inQuotes;
        } else if (ch === ',' && !inQuotes){
          pushField();
        } else {
          field += ch;
        }
      }
      if (inQuotes){ field += '\n'; }
      else{ pushField(); pushRow(); }
    }
    if (!headers){ headers = out.shift() || []; }
    return out.map(row => {
      const obj = {};
      for (let i=0;i<headers.length;i++){
        obj[headers[i]?.trim()] = (row[i] ?? '').trim();
      }
      return obj;
    });
  }

  async function loadCSV(){
    const resp = await fetch(csvUrl, {cache:'no-cache'});
    if (!resp.ok) throw new Error('Failed to load products CSV');
    const text = await resp.text();
    if (typeof Papa !== 'undefined' && Papa.parse){
      const parsed = Papa.parse(text, {header:true, skipEmptyLines:true});
      return parsed.data;
    }
    return tinyCSV(text);
  }

  function matches(q, row){
    if (!q) return true;
    q = q.toLowerCase();
    return (row.Code||'').toLowerCase().includes(q)
        || (row.Description||'').toLowerCase().includes(q);
  }

  function render(){
    resultsEl.innerHTML = '';
    filtered.forEach((row, idx) => {
      const id = row.Code;
      const checked = selected.has(id);
      const item = document.createElement('div');
      item.className = 'item';

      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.checked = checked;
      cb.addEventListener('change', () => {
        if (cb.checked) selected.add(id);
        else selected.delete(id);
        updateSelectedState();
      });

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

      const right = document.createElement('div');
      const prices = document.createElement('div');
      prices.className = 'prices';
      const ppm = document.createElement('span');
      ppm.className = 'price-pill';
      const exc = fmtGBP(row['Sell price exc VAT']);
      const inc = fmtGBP(row['Sell price inc VAT']);
      ppm.textContent = `${exc} ex / ${inc} inc`;
      prices.appendChild(ppm);

      const copyBtn = document.createElement('button');
      copyBtn.className = 'copy-btn';
      copyBtn.textContent = 'Copy';
      copyBtn.addEventListener('click', async () => {
        await copyToClipboard(row.Code);
        flash(copyBtn);
      });

      right.appendChild(prices);
      right.appendChild(copyBtn);

      item.appendChild(cb);
      item.appendChild(main);
      item.appendChild(right);

      resultsEl.appendChild(item);
    });

    metaEl.textContent = `${filtered.length} item${filtered.length!==1?'s':''}`;
    updateSelectedState();
  }

  function updateSelectedState(){
    copySelectedBtn.disabled = selected.size === 0;
  }

  async function copyToClipboard(text){
    try{
      await navigator.clipboard.writeText(text);
    }catch(e){
      // Fallback older iOS
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      try{ document.execCommand('copy'); } finally { document.body.removeChild(ta); }
    }
  }

  function flash(el){
    const old = el.textContent;
    el.textContent = '✓ Copied';
    el.style.borderColor = 'var(--ok)';
    setTimeout(()=>{
      el.textContent = old;
      el.style.borderColor = 'var(--border)';
    }, 1200);
  }

  function debounce(fn, ms){
    let t; return (...args)=>{ clearTimeout(t); t=setTimeout(()=>fn(...args), ms); };
  }

  function onSearch(){
    const q = searchEl.value.trim();
    filtered = rows.filter(r => matches(q, r));
    render();
  }

  copySelectedBtn.addEventListener('click', async () => {
    const codes = Array.from(selected);
    if (!codes.length) return;
    await copyToClipboard(codes.join('\\n'));
    flash(copySelectedBtn);
  });

  searchEl.addEventListener('input', debounce(onSearch, 120));

  // Init
  loadCSV().then(data => {
    // Normalize keys used by the app
    rows = (data || []).map(d => ({
      Code: d['Code'] ?? d['code'] ?? d['CODE'] ?? '',
      Description: d['Description'] ?? d['Name'] ?? d['DESCRIPTION'] ?? '',
      'Sell price exc VAT': d['Sell price exc VAT'] ?? d['Ex VAT'] ?? d['Price ex VAT'] ?? d['sell_price_ex_vat'] ?? '',
      'Sell price inc VAT': d['Sell price inc VAT'] ?? d['Inc VAT'] ?? d['Price inc VAT'] ?? d['sell_price_inc_vat'] ?? ''
    })).filter(r => r.Code);
    filtered = rows;
    render();
  }).catch(err => {
    resultsEl.innerHTML = `<div style="padding:16px;color:#ffb3b3;">Failed to load products: ${err?.message||err}</div>`;
  });
})();
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Vet Code Lookup</title>
  <link rel="stylesheet" href="styles.css">
  <!-- Papa Parse for robust CSV parsing (CDN). App also has a tiny fallback parser if this fails. -->
  <script src="https://unpkg.com/papaparse@5.4.1/papaparse.min.js" defer></script>
  <script src="app.js" defer></script>
</head>
<body>
  <header class="app-header">
    <h1>Vet Code Lookup</h1>
    <div class="search-wrap">
      <input id="search" type="search" placeholder="Search code or description…" autocomplete="off" spellcheck="false">
    </div>
    <div id="meta" class="meta">0 items</div>
  </header>

  <main id="results" class="results" aria-live="polite"></main>

  <footer class="app-footer">
    <button id="copySelected" class="copy-selected" disabled>Copy selected codes</button>
  </footer>
</body>
</html>

/* Basic, mobile-first styling */
:root{
  --bg: #0b0d10;
  --panel: #12161b;
  --text: #e8eef6;
  --muted: #9fb1c4;
  --accent: #4da3ff;
  --ok: #21c07a;
  --border: #20262e;
  --shadow: rgba(0,0,0,0.3);
}

*{ box-sizing: border-box; }
html, body{ height:100%; }
body{
  margin:0;
  font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Helvetica,Arial,sans-serif;
  background:var(--bg);
  color:var(--text);
}

.app-header{
  position:sticky;
  top:0;
  z-index:10;
  background:linear-gradient(180deg, rgba(18,22,27,0.95), rgba(18,22,27,0.9));
  backdrop-filter: blur(6px);
  padding:16px 16px 10px;
  border-bottom:1px solid var(--border);
}
h1{
  margin:0 0 10px 0;
  font-size:20px;
  font-weight:700;
  letter-spacing:0.2px;
}

.search-wrap{
  position:relative;
}
#search{
  width:100%;
  font-size:16px;
  padding:12px 14px;
  border-radius:10px;
  border:1px solid var(--border);
  background:#0f1317;
  color:var(--text);
  outline:none;
  box-shadow: inset 0 1px 2px var(--shadow);
}
#search::placeholder{ color:#6a7a8a; }

.meta{
  margin-top:8px;
  font-size:12px;
  color:var(--muted);
}

.results{
  padding:8px 8px 90px; /* space for sticky footer */
}

.item{
  display:grid;
  grid-template-columns: 28px 1fr auto;
  gap:10px;
  align-items:center;
  padding:12px;
  margin:8px 0;
  border:1px solid var(--border);
  border-radius:12px;
  background:var(--panel);
  box-shadow: 0 2px 8px var(--shadow);
}

.item input[type="checkbox"]{
  width:18px; height:18px;
  accent-color: var(--accent);
}

.item-main{
  min-width: 0;
}
.code{
  font-weight:700;
  font-variant-numeric: tabular-nums;
}
.desc{
  color:var(--muted);
  margin-top:4px;
  overflow:hidden;
  text-overflow:ellipsis;
  white-space:nowrap;
}

.prices{
  font-size:13px;
  margin-left:12px;
  white-space:nowrap;
  color:#d3e4f7;
}
.price-pill{
  display:inline-block;
  border:1px solid var(--border);
  padding:6px 10px;
  border-radius:999px;
  background:#0f1317;
}

.copy-btn{
  border:1px solid var(--border);
  background:#0f1317;
  color:var(--text);
  padding:8px 10px;
  border-radius:10px;
  cursor:pointer;
}
.copy-btn:active{ transform: translateY(1px); }

.app-footer{
  position:sticky;
  bottom:0;
  background:linear-gradient(0deg, rgba(18,22,27,0.95), rgba(18,22,27,0.9));
  backdrop-filter: blur(6px);
  padding:10px 16px 16px;
  border-top:1px solid var(--border);
}
.copy-selected{
  display:block;
  width:100%;
  font-size:16px;
  font-weight:700;
  padding:14px 16px;
  border:none;
  border-radius:12px;
  background:var(--accent);
  color:#06121c;
  cursor:pointer;
  box-shadow: 0 6px 16px rgba(77,163,255,0.35);
}
.copy-selected[disabled]{
  opacity:0.5;
  cursor:not-allowed;
  box-shadow:none;
}
