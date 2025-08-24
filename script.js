// -------------------------------
// script.js  (no <script> tags!)
// -------------------------------
'use strict';

/* ========= Filament picker helpers ========= */
function groupByBrand(arr){
  const map = new Map();
  for (const f of arr){
    const k = f.brand || 'Other';
    if (!map.has(k)) map.set(k, []);
    map.get(k).push(f);
  }
  return Array.from(map.entries())
    .sort((a,b)=>a[0].localeCompare(b[0]))
    .map(([brand, items])=>[brand, items.slice().sort((x,y)=>x.name.localeCompare(y.name))]);
}
function matchesQuery(f, q){
  if (!q) return true;
  q = q.toLowerCase();
  return (f.name||'').toLowerCase().includes(q)
      || (f.brand||'').toLowerCase().includes(q)
      || (f.hex||'').toLowerCase().includes(q);
}


// Optional: order finishes when rendering groups
const FINISH_ORDER = ['Regular', 'Silk', 'Matte', 'PLA', 'ABS', 'PETG'];

// Normalize/alias whatever you put in JSON (so “silk pla” → “Silk”, etc.)
function normalizeFinish(f){
  const raw = (f.finish || f.series || '').trim();
  if (!raw) return 'Other';
  const v = raw.toLowerCase();
  if (v.startsWith('silk'))  return 'Silk';
  if (v.startsWith('matte')) return 'Matte';
  if (v.startsWith('reg') || v === 'pla' || v.includes('standard')) return 'Regular';
  // fallback: show the literal value with first letter capped
  return raw.charAt(0).toUpperCase() + raw.slice(1);
}

function groupBy(arr, keyFn){
  const map = new Map();
  for (const x of arr){
    const k = keyFn(x);
    if (!map.has(k)) map.set(k, []);
    map.get(k).push(x);
  }
  return Array.from(map.entries());
}

// also search finish/series
function matchesQuery(f, q){
  if (!q) return true;
  q = q.toLowerCase();
  return (f.name||'').toLowerCase().includes(q)
      || (f.brand||'').toLowerCase().includes(q)
      || (f.hex||'').toLowerCase().includes(q)
      || (f.finish||'').toLowerCase().includes(q)
      || (f.series||'').toLowerCase().includes(q);
}



function buildBrandBlocks(selectEl, query){
  const blocks = [];
  const current = String(selectEl.value);

  const data = Array.isArray(window.FILAMENTS) ? window.FILAMENTS : [];
  if (!data.length){
    const empty = document.createElement('div');
    empty.style.padding = '8px';
    empty.style.color = '#9aa4b2';
    empty.textContent = 'No filaments loaded. Check filaments.json path or load order.';
    blocks.push(empty);
    return blocks;
  }

  const grouped = groupByBrand(data);
for (const [brand, items] of grouped){
  const hasMatch = items.some(f=>matchesQuery(f, query));
  if (!hasMatch) continue;

  const wrap = document.createElement('div'); wrap.className = 'fp-brand';

  // Brand header
  const hdr  = document.createElement('div'); hdr.className = 'fp-bhdr';
  const caret= document.createElement('span'); caret.className = 'caret'; caret.textContent = '▾';
  const title= document.createElement('strong'); title.textContent = brand;
  const meta = document.createElement('span'); meta.className = 'fp-meta'; meta.textContent = String(items.length);
  hdr.append(caret, title, meta);
  wrap.appendChild(hdr);

  // Group this brand's items by finish (or series)
  let byFinish = groupBy(items, f => normalizeFinish(f));
  // Sort groups by FINISH_ORDER then alphabetically
  const idx = n => { const i = FINISH_ORDER.indexOf(n); return i === -1 ? FINISH_ORDER.length : i; };
  byFinish.sort((a,b)=> idx(a[0]) - idx(b[0]) || a[0].localeCompare(b[0]));

  for (const [finishName, subitems] of byFinish){
    // If query filters to one finish, still render header for clarity
    const subHdr = document.createElement('div');
    subHdr.className = 'fp-subhdr';
    const caret2 = document.createElement('span'); caret2.className = 'caret'; caret2.textContent = '▾';
    const label  = document.createElement('span'); label.textContent = finishName;
    const meta2  = document.createElement('span'); meta2.className = 'fp-meta'; meta2.textContent = String(subitems.length);
    subHdr.append(caret2, label, meta2);
    wrap.appendChild(subHdr);

    // Swatch grid for this finish
    const grid = document.createElement('div'); grid.className = 'fp-grid';
    for (const f of subitems){
      if (!matchesQuery(f, query)) continue;
      const b = document.createElement('button');
      b.type='button'; b.className='fp-swatch';
      b.style.background = f.hex || '#888';
      b.title = `${f.brand||'Other'} — ${f.name}${f.hex?` (${f.hex})`:''} • ${finishName}`;
      if (String(f.id) === current) b.setAttribute('aria-selected','true');
      b.addEventListener('click', ()=>{
        // Make sure the select actually has this option and a nice label
        ensureSelectHasOption(selectEl, f);

       // Select it (this makes the CLOSED dropdown show "Brand – Name (Finish)")
        selectEl.value = String(f.id ?? f.slug ?? f.name);

        // Update selection outline in the grid
        grid.querySelector('[aria-selected="true"]')?.removeAttribute('aria-selected');
        b.setAttribute('aria-selected','true');

        // Fire your existing listeners and helpers
        selectEl.dispatchEvent(new Event('change', { bubbles:true }));
        window.applyCurrentSelection?.();
        window.refreshAllBuyButtons?.();

        closeFilamentPicker();
      });
      grid.appendChild(b);
    }
    wrap.appendChild(grid);

    // collapse/expand this finish group
    let collapsedFinish = false; // default open; change to true if you want them collapsed by default
    if (collapsedFinish){ subHdr.classList.add('collapsed'); grid.style.display='none'; }
    subHdr.addEventListener('click', ()=>{
      collapsedFinish = !collapsedFinish;
      subHdr.classList.toggle('collapsed', collapsedFinish);
      grid.style.display = collapsedFinish ? 'none' : 'grid';
    });
  }

  // collapse/expand the whole brand block
  let collapsedBrand = !query && !items.some(f=>String(f.id)===current);
  if (collapsedBrand){ hdr.classList.add('collapsed'); /* optionally hide all subgrids too */ }
  hdr.addEventListener('click', ()=>{
    collapsedBrand = !collapsedBrand;
    hdr.classList.toggle('collapsed', collapsedBrand);
    // toggle all children (subheaders + grids)
    wrap.querySelectorAll('.fp-subhdr ~ .fp-grid').forEach(g=>{
      g.style.display = collapsedBrand ? 'none' : 'grid';
    });
    wrap.querySelectorAll('.fp-subhdr').forEach(sh=>{
      sh.classList.toggle('collapsed', collapsedBrand);
    });
  });

  blocks.push(wrap);
}

  return blocks;
}


function optionLabel(f) {
  const brand  = f.brand ? `${f.brand} – ` : '';
  const finish = f.finish ? ` (${f.finish})` : '';
  return `${brand}${f.name}${finish}`;
}

function ensureSelectHasOption(selectEl, f) {
  const val = String(f.id ?? f.slug ?? f.name);
  // try to find existing option
  let opt = Array.from(selectEl.options).find(o => o.value === val);
  // create if missing
  if (!opt) {
    opt = document.createElement('option');
    opt.value = val;
    selectEl.appendChild(opt);
  }
  // set the visible label and useful metadata
  opt.textContent   = optionLabel(f);
  opt.dataset.hex   = f.hex || '#cccccc';
  opt.dataset.brand = f.brand || '';
  opt.dataset.finish= f.finish || '';
  opt.dataset.url   = f.link || f.url || '';
  return opt;
}



function openFilamentPicker(selectEl, anchorBtn){
  closeFilamentPicker();

  const backdrop = document.createElement('div');
  backdrop.className = 'picker-backdrop';
  const pop = document.createElement('div');
  pop.className = 'filament-picker';
  pop.innerHTML = `
    <div class="fp-head">
      <input type="search" placeholder="Search brand or color…" />
    </div>
    <div class="fp-body"></div>
  `;
  document.body.appendChild(backdrop);
  document.body.appendChild(pop);

  const body = pop.querySelector('.fp-body');
  const render = (q='')=>{
    body.innerHTML = '';
    buildBrandBlocks(selectEl, q).forEach(el=>body.appendChild(el));
  };
  render();

  const search = pop.querySelector('input[type=search]');
  search.addEventListener('input', ()=>render(search.value));

  // position near anchor
  const r = anchorBtn.getBoundingClientRect();
  pop.style.left = `${Math.max(8, Math.min(window.innerWidth - 340, r.left))}px`;
  pop.style.top  = `${Math.max(8, Math.min(window.innerHeight - 380, r.bottom + 6))}px`;

  const onEsc = (e)=>{ if(e.key==='Escape') closeFilamentPicker(); };
  document.addEventListener('keydown', onEsc, { once:true });
  pop._cleanup = ()=>{ document.removeEventListener('keydown', onEsc); backdrop.remove(); pop.remove(); };
  backdrop.addEventListener('click', closeFilamentPicker);
  window._openPicker = pop;
}
function closeFilamentPicker(){
  if (window._openPicker){ window._openPicker._cleanup(); window._openPicker = null; }
}
function attachFilamentPicker(selectId){
  const sel = document.getElementById(selectId);
  if (!sel) return;

  // Hide native select (we still use its value + change events)
  sel.classList.add('visually-hidden');

  // If an old display button exists, remove it (we'll use one control only)
  if (sel.nextElementSibling && sel.nextElementSibling.classList?.contains('select-display')) {
    sel.nextElementSibling.remove();
  }

  // Use (or create) the button with data-picker-for as the single trigger
  let btn = document.querySelector(`[data-picker-for="${selectId}"]`);
  if (!btn){
    btn = document.createElement('button');
    btn.setAttribute('data-picker-for', selectId);
    sel.insertAdjacentElement('afterend', btn);
  }

  // Upgrade it to a full-width trigger that shows the text
  btn.type = 'button';
  btn.classList.remove('mini');          // it used to be the small caret button
  btn.classList.add('select-trigger');   // now becomes the wide control

  // Keep its label in sync with the selected option
  function syncTrigger(){
    const txt = sel.selectedOptions?.[0]?.textContent || 'Select filament…';
    btn.textContent = txt;               // caret is drawn via ::after in CSS
  }
  syncTrigger();
  sel.addEventListener('change', syncTrigger);

  // Open the picker from the trigger
  if (btn.dataset.wired !== '1') {
    btn.dataset.wired = '1';
    btn.addEventListener('click', (e)=>{
      e.preventDefault(); e.stopPropagation();
      openFilamentPicker(sel, btn);
    });
  }
}




// Expose if other scripts call them
window.openFilamentPicker = openFilamentPicker;
window.closeFilamentPicker = closeFilamentPicker;
window.attachFilamentPicker = attachFilamentPicker;

/* ========= Three.js viewer bootstrap (mobile-safe) ========= */
(function initViewer(){
  const canvas = document.getElementById('viewer');
  if (!canvas) return; // page not ready or id mismatch

  // Guard if THREE isn't loaded yet
  if (typeof THREE === 'undefined') return;

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  const DPR_CAP = 1.7;

  // Reuse global scene/camera if you already create them elsewhere
  let scene = window.scene || new THREE.Scene();
  let camera = window.camera || new THREE.PerspectiveCamera(45, 1, 0.1, 100);
  if (!window.camera) camera.position.set(0, 0, 5);

  function renderOnce(){
    renderer.render(scene, camera);
  }
  window.renderOnce = renderOnce; // let other code trigger a redraw

  function resizeRenderer(){
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, DPR_CAP);
    renderer.setPixelRatio(dpr);
    renderer.setSize(rect.width, rect.height, false); // CSS controls layout
    camera.aspect = Math.max(1e-6, rect.width / Math.max(1, rect.height));
    camera.updateProjectionMatrix();
    renderOnce();
  }

  const ro = new ResizeObserver(resizeRenderer);
  ro.observe(canvas);
  window.addEventListener('resize', ()=>{ clearTimeout(window.__rt); window.__rt=setTimeout(resizeRenderer,120); });
  window.addEventListener('orientationchange', resizeRenderer);

  // If you don't create a scene elsewhere, add a tiny sanity scene so you see something.
  if (!window.scene){
    scene.background = new THREE.Color(0x1b4db3);
    const light = new THREE.DirectionalLight(0xffffff, 1);
    light.position.set(2, 3, 4);
    scene.add(light);
  }

  resizeRenderer(); // kick once
  renderOnce();
})();

/* ========= On DOM ready: hook pickers if needed ========= */
document.addEventListener('DOMContentLoaded', ()=>{
  // If you rely on external JSON loaders elsewhere, keep those.
  // This simply wires the pickers to existing selects when present.
  ['faceSelect','backerSelect','labelSelect','textSelect','accentSelect','accent2Select']
    .forEach(id => attachFilamentPicker(id));
});
