// ── DEFAULTS ────────────────────────────────────────────────────────────────
// Used only as absolute fallback when no style is assigned to a text.
// Not user-editable — styles handle everything.
function getDefaults(opts) {
  return {
    font:      "'Syne',sans-serif",
    size:      72,
    weight:    '700',
    italic:    false,
    underline: false,
    textColor: opts.defaultColor,
    bgColor:   opts.defaultBg,
    align:     'left',
    pad:       80,
    lineH:     1.6,
    mirror:    false,
    mode:      opts.defaultMode,
    dir:       'up',
    speed:     60,
    keepText:  false,
    duration:  5,
    posX:      50,
    posY:      50,
    fade:      0.5,
  };
}

function esc(s) {
  return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ── SHARED STYLE LIBRARY ────────────────────────────────────────────────────
const STYLES_KEY = 'tp_styles';
function getStyles()          { return JSON.parse(localStorage.getItem(STYLES_KEY) || '[]'); }
function saveStylesLocal(s)   { localStorage.setItem(STYLES_KEY, JSON.stringify(s)); }

// ── POSITION PICKER ─────────────────────────────────────────────────────────
function buildPosPicker(gridId, xId, yId, xValId, yValId, onChange) {
  const CELLS = [
    {x:5,  y:5,  label:'↖'}, {x:50, y:5,  label:'↑'}, {x:95, y:5,  label:'↗'},
    {x:5,  y:50, label:'←'}, {x:50, y:50, label:'·'}, {x:95, y:50, label:'→'},
    {x:5,  y:95, label:'↙'}, {x:50, y:95, label:'↓'}, {x:95, y:95, label:'↘'},
  ];
  const grid = document.getElementById(gridId);
  if (!grid) return;
  grid.innerHTML = '';
  CELLS.forEach(cell => {
    const d = document.createElement('div');
    d.className = 'pos-cell';
    d.textContent = cell.label;
    d.dataset.x = cell.x; d.dataset.y = cell.y;
    d.onclick = () => {
      grid.querySelectorAll('.pos-cell').forEach(c => c.classList.remove('sel'));
      d.classList.add('sel');
      grid.style.opacity = '1';
      if (document.getElementById(xId)) document.getElementById(xId).value = cell.x;
      if (document.getElementById(yId)) document.getElementById(yId).value = cell.y;
      if (document.getElementById(xValId)) document.getElementById(xValId).textContent = cell.x + '%';
      if (document.getElementById(yValId)) document.getElementById(yValId).textContent = cell.y + '%';
      onChange();
    };
    grid.appendChild(d);
  });
}
function syncPosPickerToValues(gridId, xId, yId) {
  const xv = +document.getElementById(xId).value;
  const yv = +document.getElementById(yId).value;
  const grid = document.getElementById(gridId);
  if (!grid) return;
  grid.querySelectorAll('.pos-cell').forEach(d => {
    d.classList.toggle('sel', +d.dataset.x === xv && +d.dataset.y === yv);
  });
}

// ── MAIN PANEL ──────────────────────────────────────────────────────────────

// ── POSITION PREVIEW ────────────────────────────────────────────────────────
// Projection reference: 3840x2160
const PROJ_W = 3840, PROJ_H = 2160;

function buildPosPreview(previewId, xId, yId, xValId, yValId, onChange, getStyle) {
  const container = document.getElementById(previewId);
  if (!container) return;

  // Fixed preview size — small but clear, 16:9
  const PW = 240, PH = 135;
  container.style.width    = PW + 'px';
  container.style.height   = PH + 'px';
  container.style.position = 'relative';
  container.style.borderRadius = '4px';
  container.style.cursor   = 'crosshair';
  container.style.overflow = 'hidden';
  container.style.userSelect = 'none';
  container.style.flexShrink = '0';
  container.innerHTML = '';

  // Scale factor: preview / projection
  const scale = PW / PROJ_W; // ~0.0625

  // Background
  const bg = document.createElement('div');
  bg.style.cssText = `position:absolute;inset:0;background:#111`;
  container.appendChild(bg);

  // Text block — rendered at correct proportional font size
  const block = document.createElement('div');
  block.style.cssText = `
    position:absolute;
    pointer-events:none;
    transform:translate(0,0);
    white-space:pre;
    line-height:1.5;
  `;
  container.appendChild(block);

  // Crosshairs
  const hLine = document.createElement('div');
  hLine.style.cssText = 'position:absolute;left:0;right:0;height:1px;background:rgba(255,255,255,0.15);pointer-events:none';
  const vLine = document.createElement('div');
  vLine.style.cssText = 'position:absolute;top:0;bottom:0;width:1px;background:rgba(255,255,255,0.15);pointer-events:none';
  container.appendChild(hLine);
  container.appendChild(vLine);

  function getCurrentStyle() {
    if (getStyle) return getStyle();
    // Try to read from current style/defaults
    const styles = JSON.parse(localStorage.getItem('tp_styles')||'[]');
    const eStyle = document.getElementById('eStyle');
    const styleId = eStyle ? eStyle.value : null;
    const st = styleId ? styles.find(s=>String(s.id)===String(styleId)) : null;
    return {
      font:      (st&&st.font)      || "'Syne',sans-serif",
      size:      (st&&st.size)      || 72,
      weight:    (st&&st.weight)    || '700',
      italic:    !!(st&&st.italic),
      textColor: (st&&st.textColor) || '#f0efe8',
      bgColor:   (st&&st.bgColor)   || '#000000',
      lineH:     (st&&st.lineH)     || 1.6,
    };
  }

  function getCurrentText() {
    const eContent = document.getElementById('eContent');
    if (eContent && eContent.value.trim()) {
      return eContent.value.split('\n').slice(0,3).join('\n');
    }
    return 'Textvorschau';
  }

  function updateBlock(posX, posY) {
    const s = getCurrentStyle();
    const txt = getCurrentText();

    // Scale font size from projection to preview
    const scaledSize = Math.max(6, Math.round(s.size * scale));
    const rawFont = (s.font||"'Syne',sans-serif").replace(/'/g,'');

    // Background color
    bg.style.background = s.bgColor || '#111';

    // Text styling
    block.style.fontFamily   = rawFont;
    block.style.fontSize     = scaledSize + 'px';
    block.style.fontWeight   = s.weight || '700';
    block.style.fontStyle    = s.italic ? 'italic' : 'normal';
    block.style.color        = s.textColor || '#f0efe8';
    block.style.lineHeight   = s.lineH || 1.6;
    block.textContent        = txt;

    // Position: posX/posY are 0-100% of the space available for the text block
    // Match the projection engine: position is % of (screen - block) size
    const bw = block.offsetWidth  || 0;
    const bh = block.offsetHeight || 0;
    const availW = PW - bw;
    const availH = PH - bh;
    const px = Math.max(0, (posX / 100) * availW);
    const py = Math.max(0, (posY / 100) * availH);

    block.style.left = px + 'px';
    block.style.top  = py + 'px';
    hLine.style.top  = (py + bh/2) + 'px';
    vLine.style.left = (px + bw/2) + 'px';
  }

  function xyFromEvent(e) {
    const rect = container.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    const rx = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    const ry = Math.max(0, Math.min(1, (clientY - rect.top)  / rect.height));
    return {
      posX: Math.round(rx * 100),
      posY: Math.round(ry * 100)
    };
  }

  function applyPos(posX, posY) {
    const xEl = document.getElementById(xId);
    const yEl = document.getElementById(yId);
    const xVEl = document.getElementById(xValId);
    const yVEl = document.getElementById(yValId);
    if (xEl)  xEl.value = posX;
    if (yEl)  yEl.value = posY;
    if (xVEl) xVEl.textContent = posX + '%';
    if (yVEl) yVEl.textContent = posY + '%';
    // Sync grid picker
    const pickerId = xId === 'ePosX' ? 'ePosPicker' : xId === 'stPosX' ? 'stPosPicker' : null;
    if (pickerId && typeof syncPosPickerToValues === 'function') syncPosPickerToValues(pickerId, xId, yId);
    updateBlock(posX, posY);
    onChange();
  }

  function syncFromSliders() {
    const xEl = document.getElementById(xId);
    const yEl = document.getElementById(yId);
    updateBlock(xEl ? +xEl.value : 50, yEl ? +yEl.value : 50);
  }

  let dragging = false;
  container.addEventListener('mousedown',  e => { e.preventDefault(); dragging=true; applyPos(...Object.values(xyFromEvent(e))); });
  container.addEventListener('mousemove',  e => { if(!dragging)return; e.preventDefault(); applyPos(...Object.values(xyFromEvent(e))); });
  container.addEventListener('mouseup',    () => dragging=false);
  container.addEventListener('mouseleave', () => dragging=false);
  container.addEventListener('touchstart', e => { e.preventDefault(); dragging=true; applyPos(...Object.values(xyFromEvent(e))); }, {passive:false});
  container.addEventListener('touchmove',  e => { if(!dragging)return; e.preventDefault(); applyPos(...Object.values(xyFromEvent(e))); }, {passive:false});
  container.addEventListener('touchend',   () => dragging=false);

  container._syncFromSliders = syncFromSliders;
  syncFromSliders();
}

function refreshPosPreviews() {
  ['ePosPreview','stPosPreview'].forEach(id => {
    const el = document.getElementById(id);
    if (el && el._syncFromSliders) el._syncFromSliders();
  });
}

function initPanel(opts) {
  const S = opts.namespace;
  const TC = ['#000000','#111111','#f0efe8','#ffffff','#e8ff47','#ff6b35','#00ffcc'];
  const BC = ['#ffffff','#f5f5f0','#000000','#0e0e0f','#1a1a1d','#0a0a20','#1a1500'];
  const DEFAULTS = getDefaults(opts);

  let texts = [], selIdx = 0;
  let styles = [], selStyleIdx = -1;
  let curCueIdx = -1, state = 'idle';
  let progInt = null, startTime = 0, totalWords = 0, pausedElapsed = 0;

  function broadcast(msg) {
    localStorage.setItem(S+'msg', JSON.stringify({...msg, ts:Date.now()}));
    if (window.__fb) window.__fb.fbBroadcast(S, msg);
  }

  // ── RESOLVE: style → defaults ────────────────────────────────────────────
  function resolveForText(t) {
    // Always read fresh styles in case they were updated
    const currentStyles = JSON.parse(localStorage.getItem(STYLES_KEY) || '[]');
    const st = (t && t.styleId) ? currentStyles.find(s => String(s.id) === String(t.styleId)) : null;
    const D = DEFAULTS;
    // sv: use style value if style exists and field is set, else use default
    function sv(field, defVal) {
      if (!st) return defVal;
      const v = st[field];
      if (v === null || v === undefined) return defVal;
      return v;
    }
    return {
      font:      sv('font',      D.font),
      size:      sv('size',      D.size),
      weight:    sv('weight',    D.weight),
      italic:    !!sv('italic',    D.italic),
      underline: !!sv('underline', D.underline),
      textColor: sv('textColor', D.textColor),
      bgColor:   sv('bgColor',   D.bgColor),
      align:     sv('align',     D.align),
      pad:       sv('pad',       D.pad),
      lineH:     sv('lineH',     D.lineH),
      mirror:    !!sv('mirror',  D.mirror),
      keepText:  !!sv('keepText',D.keepText),
      mode:      sv('mode',      D.mode),
      dir:       sv('dir',       D.dir),
      speed:          (t&&t.exc_speed!=null)        ? +t.exc_speed        : sv('speed',         D.speed),
      scrollDuration: (t&&t.exc_scrollDuration!=null) ? +t.exc_scrollDuration : sv('scrollDuration', null),
      useScrollDuration: (t&&t.exc_scrollDuration!=null) ? true : !!sv('useScrollDuration', false),
      duration:  (t&&t.exc_duration!=null) ? +t.exc_duration : sv('duration', D.duration),
      posX:      (t&&t.exc_posX!=null)     ? +t.exc_posX     : sv('posX',     D.posX),
      posY:      (t&&t.exc_posY!=null)     ? +t.exc_posY     : sv('posY',     D.posY),
      fade:      sv('fade',      D.fade),
    };
  }
  window.resolveForText = resolveForText;

  // ── STYLE LIBRARY ──────────────────────────────────────────────────────────
  const STYLE_FIELDS = ['font','size','weight','italic','underline','textColor','bgColor','align','pad','lineH','mode','dir','speed','keepText','duration','posX','posY','fade','mirror','scrollDuration','useScrollDuration'];

  function defaultStyle(name) {
    const s = { id: Date.now()+Math.random(), name: name||'Neuer Stil' };
    STYLE_FIELDS.forEach(f => s[f] = DEFAULTS[f] !== undefined ? DEFAULTS[f] : null);
    return s;
  }

  function saveStyles() {
    saveStylesLocal(styles);
    localStorage.setItem(STYLES_KEY, JSON.stringify(styles));
    broadcast({type:'styles', data:styles});
    if (window.__fb) window.__fb.fbSyncStyles(styles);
    rebuildStyleDropdowns();
  }

  function renderStyleList() {
    const el = document.getElementById('styleList'); if (!el) return;
    el.innerHTML = '';
    if (!styles.length) {
      el.innerHTML = '<p style="font-size:.7rem;color:var(--mu);font-family:var(--mono);padding:.3rem 0">Keine Stile. + Neu klicken.</p>';
      return;
    }
    styles.forEach((st, i) => {
      const d = document.createElement('div');
      d.className = 'ti' + (i===selStyleIdx?' sel':'');
      d.style.border = i===selStyleIdx ? '1px solid var(--ac2)' : '';
      d.innerHTML = `<span class="tnum">${String(i+1).padStart(2,'0')}</span><span class="ttitle">${esc(st.name)}</span>`;
      d.onclick = () => selectStyle(i);
      el.appendChild(d);
    });
  }

  function selectStyle(i) { selStyleIdx = i; renderStyleList(); renderStyleEditor(); }

  function renderStyleEditor() {
    const el = document.getElementById('styleEditor'); if (!el) return;
    if (selStyleIdx < 0 || selStyleIdx >= styles.length) {
      el.innerHTML = '<p style="font-size:.72rem;color:var(--mu);font-family:var(--mono)">Keinen Stil ausgewählt.</p>';
      return;
    }
    const st = styles[selStyleIdx];
    const fonts = [
      ["'Syne',sans-serif","Syne"],
      ["'Julius Sans One',sans-serif","Julius Sans One"],
      ["'Hiragino Sans W0',sans-serif","Hiragino W0"],
      ["'Hiragino Sans W1',sans-serif","Hiragino W1"],
      ["'Hiragino Sans W2',sans-serif","Hiragino W2"],
      ["'Hiragino Sans W3',sans-serif","Hiragino W3"],
      ["'Hiragino Sans W4',sans-serif","Hiragino W4"],
      ["'Hiragino Sans W5',sans-serif","Hiragino W5"],
      ["'Hiragino Sans W6',sans-serif","Hiragino W6"],
      ["'Hiragino Sans W7',sans-serif","Hiragino W7"],
      ["'Hiragino Sans W8',sans-serif","Hiragino W8"],
      ["'Hiragino Sans W9',sans-serif","Hiragino W9"],
      ["'Space Mono',monospace","Space Mono"],
      ["Georgia,serif","Georgia"],
      ["'Helvetica Neue',sans-serif","Helvetica Neue"],
      ["'Arial',sans-serif","Arial"],
    ];
    el.innerHTML = `
      <label style="margin-top:0">Stilname</label>
      <input type="text" id="stName" value="${esc(st.name)}" oninput="saveStyleEdit()">

      <div class="two-col" style="margin-top:.75rem">
        <div>
          <label style="margin-top:0">Modus</label>
          <select id="stMode" onchange="saveStyleEdit()">
            <option value="scroll"  ${st.mode==='scroll' ?'selected':''}>Scroll</option>
            <option value="display" ${st.mode==='display'?'selected':''}>Display</option>
          </select>
          <label>Richtung (Scroll)</label>
          <select id="stDir" onchange="saveStyleEdit()">
            <option value="up"      ${st.dir==='up'     ?'selected':''}>↑ Unten→Oben</option>
            <option value="down"    ${st.dir==='down'   ?'selected':''}>↓ Oben→Unten</option>
            <option value="left"    ${st.dir==='left'   ?'selected':''}>← Rechts→Links</option>
            <option value="right"   ${st.dir==='right'  ?'selected':''}>→ Links→Rechts</option>
            <option value="diag-ul" ${st.dir==='diag-ul'?'selected':''}>↖ Diagonal OL</option>
            <option value="diag-ur" ${st.dir==='diag-ur'?'selected':''}>↗ Diagonal OR</option>
            <option value="diag-dl" ${st.dir==='diag-dl'?'selected':''}>↙ Diagonal UL</option>
            <option value="diag-dr" ${st.dir==='diag-dr'?'selected':''}>↘ Diagonal UR</option>
          </select>
          <label>Scroll-Steuerung</label>
          <div style="display:flex;align-items:center;gap:.5rem;margin-bottom:.4rem">
            <label class="tog" style="margin:0"><input type="checkbox" id="stUseScrollDuration" onchange="document.getElementById('stSpeedWrap').style.display=this.checked?'none':'flex';document.getElementById('stScrollDurWrap').style.display=this.checked?'flex':'none';saveStyleEdit()" ${st.useScrollDuration?'checked':''}><span class="tslide"></span></label>
            <span class="tlbl">Dauer statt Geschwindigkeit</span>
          </div>
          <div id="stSpeedWrap" class="rrow" style="display:${st.useScrollDuration?'none':'flex'}">
            <input type="range" id="stSpeed" min="10" max="300" step="5" value="${st.speed||60}"
              oninput="document.getElementById('stSpeedVal').textContent=this.value+' px/s';saveStyleEdit()">
            <span class="rval" id="stSpeedVal">${st.speed||60} px/s</span>
          </div>
          <div id="stScrollDurWrap" class="rrow" style="display:${st.useScrollDuration?'flex':'none'}">
            <input type="range" id="stScrollDuration" min="5" max="120" step="1" value="${st.scrollDuration||30}"
              oninput="document.getElementById('stScrollDurVal').textContent=this.value+'s';saveStyleEdit()">
            <span class="rval" id="stScrollDurVal">${st.scrollDuration||30}s</span>
          </div>
          <label>Anzeigedauer (Display)</label>
          <div class="rrow">
            <input type="range" id="stDuration" min="1" max="30" step="0.5" value="${st.duration||5}"
              oninput="document.getElementById('stDurationVal').textContent=parseFloat(this.value).toFixed(1)+'s';saveStyleEdit()">
            <span class="rval" id="stDurationVal">${parseFloat(st.duration||5).toFixed(1)}s</span>
          </div>
          <label>Einblenddauer</label>
          <div class="rrow">
            <input type="range" id="stFade" min="0.1" max="3" step="0.1" value="${st.fade||0.5}"
              oninput="document.getElementById('stFadeVal').textContent=parseFloat(this.value).toFixed(1)+'s';saveStyleEdit()">
            <span class="rval" id="stFadeVal">${parseFloat(st.fade||0.5).toFixed(1)}s</span>
          </div>
          <div class="trow" style="margin-top:.6rem">
            <label class="tog"><input type="checkbox" id="stKeep" onchange="saveStyleEdit()" ${st.keepText?'checked':''}><span class="tslide"></span></label>
            <span class="tlbl">Text bleibt sichtbar</span>
          </div>
          <div class="trow">
            <label class="tog"><input type="checkbox" id="stMirror" onchange="saveStyleEdit()" ${st.mirror?'checked':''}><span class="tslide"></span></label>
            <span class="tlbl">Spiegeln</span>
          </div>
        </div>
        <div>
          <label style="margin-top:0">Schriftart</label>
          <select id="stFont" onchange="saveStyleEdit()">
            ${fonts.map(([v,l]) => `<option value="${v}" ${st.font===v?'selected':''}>${l}</option>`).join('')}
          </select>
          <label>Schriftgröße (bei 1920px Breite)</label>
          <div class="rrow">
            <input type="range" id="stSize" min="24" max="400" step="2" value="${st.size||72}"
              oninput="document.getElementById('stSizeVal').textContent=this.value+'px';saveStyleEdit()">
            <span class="rval" id="stSizeVal">${st.size||72}px</span>
          </div>
          <label>Gewicht</label>
          <select id="stWeight" onchange="saveStyleEdit()">
            ${[100,200,300,400,500,600,700,800,900].map(w=>`<option value="${w}" ${+st.weight===w?'selected':''}>${w}</option>`).join('')}
          </select>
          <label>Zeilenabstand</label>
          <div class="rrow">
            <input type="range" id="stLineH" min="10" max="30" step="1" value="${Math.round((st.lineH||1.6)*10)}"
              oninput="document.getElementById('stLineHVal').textContent=(this.value/10).toFixed(1);saveStyleEdit()">
            <span class="rval" id="stLineHVal">${parseFloat(st.lineH||1.6).toFixed(1)}</span>
          </div>
          <div class="trow" style="margin-top:.5rem">
            <label class="tog"><input type="checkbox" id="stItalic" onchange="saveStyleEdit()" ${st.italic?'checked':''}><span class="tslide"></span></label>
            <span class="tlbl">Kursiv</span>
          </div>
          <div class="trow">
            <label class="tog"><input type="checkbox" id="stUnderline" onchange="saveStyleEdit()" ${st.underline?'checked':''}><span class="tslide"></span></label>
            <span class="tlbl">Unterstrichen</span>
          </div>
          <label>Ausrichtung</label>
          <select id="stAlign" onchange="saveStyleEdit()">
            <option value="left"   ${st.align==='left'  ?'selected':''}>Linksbündig</option>
            <option value="center" ${st.align==='center'?'selected':''}>Zentriert</option>
            <option value="right"  ${st.align==='right' ?'selected':''}>Rechtsbündig</option>
          </select>
          <label>Seitenränder</label>
          <div class="rrow">
            <input type="range" id="stPad" min="0" max="300" step="10" value="${st.pad??80}"
              oninput="document.getElementById('stPadVal').textContent=this.value+'px';saveStyleEdit()">
            <span class="rval" id="stPadVal">${st.pad??80}px</span>
          </div>
        </div>
      </div>

      <label>Textfarbe</label>
      <div class="crow" id="stColorSwatches"></div>
      <label>Hintergrundfarbe</label>
      <div class="crow" id="stBgSwatches"></div>

      <label style="margin-top:.85rem">Position (Display)</label>
      <div style="display:flex;gap:.75rem;align-items:flex-start;margin-bottom:.5rem">
        <div id="stPosPreview" style="border-radius:4px;border:1px solid var(--bd);flex-shrink:0"></div>
        <div style="flex:1">
      <div class="pos-wrap">
        <div class="pos-picker" id="stPosPicker"></div>
        <div class="pos-sliders">
          <label style="margin-top:0">Horizontal</label>
          <div class="rrow">
            <input type="range" id="stPosX" min="0" max="100" step="1" value="${st.posX??50}"
              oninput="document.getElementById('stPosXVal').textContent=this.value+'%';syncPosPickerToValues('stPosPicker','stPosX','stPosY');saveStyleEdit()">
            <span class="rval" id="stPosXVal">${st.posX??50}%</span>
          </div>
          <label>Vertikal</label>
          <div class="rrow">
            <input type="range" id="stPosY" min="0" max="100" step="1" value="${st.posY??50}"
              oninput="document.getElementById('stPosYVal').textContent=this.value+'%';syncPosPickerToValues('stPosPicker','stPosX','stPosY');saveStyleEdit()">
            <span class="rval" id="stPosYVal">${st.posY??50}%</span>
          </div>
        </div>
      </div>
        </div>
      </div>
    `;
    buildStyleSwatches('stColorSwatches', TC, st.textColor||opts.defaultColor);
    buildStyleSwatches('stBgSwatches',    BC, st.bgColor||opts.defaultBg);
    buildPosPicker('stPosPicker','stPosX','stPosY','stPosXVal','stPosYVal', () => {
      saveStyleEdit();
      const prev=document.getElementById('stPosPreview');
      if(prev&&prev._syncFromSliders) prev._syncFromSliders();
    });
    if (st.posX != null) syncPosPickerToValues('stPosPicker','stPosX','stPosY');

    // Build draggable preview for style position — reads live values from editor
    buildPosPreview('stPosPreview','stPosX','stPosY','stPosXVal','stPosYVal', saveStyleEdit, () => {
      const gv = id => { const e=document.getElementById(id); return e?e.value:null; };
      return {
        font:      gv('stFont')   || "'Syne',sans-serif",
        size:      gv('stSize')   ? +gv('stSize') : 72,
        weight:    gv('stWeight') || '700',
        italic:    document.getElementById('stItalic')  ? document.getElementById('stItalic').checked  : false,
        textColor: (()=>{ const e=document.querySelector('#stColorSwatches .cs.sel'); return e?e.dataset.c:'#f0efe8'; })(),
        bgColor:   (()=>{ const e=document.querySelector('#stBgSwatches .cs.sel');    return e?e.dataset.c:'#000000'; })(),
        lineH:     gv('stLineH') ? +(gv('stLineH')/10).toFixed(1) : 1.6,
      };
    });
  }

  function buildStyleSwatches(id, colors, cur) {
    const cont = document.getElementById(id); if (!cont) return; cont.innerHTML = '';
    colors.forEach(col => {
      const d = document.createElement('div');
      d.className = 'cs' + (col===cur?' sel':'');
      d.style.background = col;
      d.style.outline = (col==='#000000'||col==='#0e0e0f'||col==='#1a1a1d') ? '1px solid #555' : (col==='#ffffff'||col==='#f5f5f0') ? '1px solid #ccc' : '';
      d.dataset.c = col; d.title = col;
      d.onclick = () => { cont.querySelectorAll('.cs').forEach(x=>x.classList.remove('sel')); d.classList.add('sel'); saveStyleEdit(); };
      cont.appendChild(d);
    });
  }

  window.saveStyleEdit = function() {
    if (selStyleIdx < 0 || selStyleIdx >= styles.length) {
      console.warn('[saveStyleEdit] selStyleIdx out of range:', selStyleIdx, 'styles.length:', styles.length);
      return;
    }
    const st = styles[selStyleIdx];
    const gv = id => { const e=document.getElementById(id); return e?e.value:null; };
    const gc = id => { const e=document.getElementById(id); return e?e.checked:false; };
    const ga = id => { const e=document.querySelector('#'+id+' .cs.sel'); return e?e.dataset.c:null; };
    st.name      = gv('stName') || st.name;
    st.mode      = gv('stMode');
    st.dir       = gv('stDir');
    st.speed          = gv('stSpeed')          ? +gv('stSpeed')          : st.speed;
    st.useScrollDuration = gc('stUseScrollDuration');
    st.scrollDuration = gv('stScrollDuration') ? +gv('stScrollDuration') : st.scrollDuration;
    st.duration  = gv('stDuration') ? +parseFloat(gv('stDuration')).toFixed(1) : st.duration;
    st.fade      = gv('stFade')     ? +parseFloat(gv('stFade')).toFixed(1)     : st.fade;
    st.keepText  = gc('stKeep');
    st.mirror    = gc('stMirror');
    st.font      = gv('stFont')     || st.font;
    st.size      = gv('stSize')     ? +gv('stSize')     : st.size;
    st.weight    = gv('stWeight')   || st.weight;
    st.lineH     = gv('stLineH')    ? +(gv('stLineH')/10).toFixed(1) : st.lineH;
    st.italic    = gc('stItalic');
    st.underline = gc('stUnderline');
    st.align     = gv('stAlign');
    st.pad       = gv('stPad') !== null ? +gv('stPad') : st.pad;
    st.posX      = gv('stPosX') !== null ? +gv('stPosX') : st.posX;
    st.posY      = gv('stPosY') !== null ? +gv('stPosY') : st.posY;
    if (ga('stColorSwatches')) st.textColor = ga('stColorSwatches');
    if (ga('stBgSwatches'))    st.bgColor   = ga('stBgSwatches');
    saveStyles();
    setTimeout(()=>{ const el=document.getElementById('stPosPreview'); if(el&&el._syncFromSliders) el._syncFromSliders(); }, 30);
  };

  window.addStyle = function() {
    styles.push(defaultStyle(`Stil ${styles.length+1}`));
    saveStyles(); renderStyleList(); selectStyle(styles.length-1);
  };
  window.dupStyle = function() {
    if (selStyleIdx<0||selStyleIdx>=styles.length) return;
    styles.push({...styles[selStyleIdx], id:Date.now(), name:styles[selStyleIdx].name+' (Kopie)'});
    saveStyles(); renderStyleList(); selectStyle(styles.length-1);
  };
  window.delStyle = function() {
    if (selStyleIdx<0||selStyleIdx>=styles.length) return;
    if (!confirm(`Stil "${styles[selStyleIdx].name}" löschen?`)) return;
    const id = styles[selStyleIdx].id;
    styles.splice(selStyleIdx, 1);
    texts.forEach(t => { if (String(t.styleId)===String(id)) t.styleId=null; });
    saveTexts(); saveStyles();
    selStyleIdx = Math.min(selStyleIdx, styles.length-1);
    renderStyleList(); renderStyleEditor(); renderList();
  };

  function rebuildStyleDropdowns() {
    document.querySelectorAll('.style-select').forEach(sel => {
      const cur = sel.value;
      sel.innerHTML = '<option value="">— Kein Stil (Defaults) —</option>';
      styles.forEach(st => {
        const opt = document.createElement('option');
        opt.value = String(st.id); opt.textContent = st.name;
        sel.appendChild(opt);
      });
      sel.value = cur;
    });
  }

  // ── TEXT LIST ──────────────────────────────────────────────────────────────
  function saveTexts() {
    localStorage.setItem(S+'texts', JSON.stringify(texts));
    broadcast({type:'texts', data:texts});
  }

  function renderList() {
    const el = document.getElementById('textList'); el.innerHTML = '';
    texts.forEach((t,i) => {
      const isCur = i===curCueIdx;
      const cls = isCur?'active':t.status==='done'?'done':'waiting';
      const icon = isCur?(state==='running'?'►':'·'):t.status==='done'?'✓':'';
      const st = t.styleId ? styles.find(s=>String(s.id)===String(t.styleId)) : null;
      const badge = st ? `<span class="tspd" style="color:var(--ac2);max-width:70px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(st.name)}</span>` : '';
      const d = document.createElement('div');
      d.className = 'ti'+(i===selIdx?' sel':'')+' '+cls;
      d.innerHTML = `<span class="tnum">${String(i+1).padStart(2,'0')}</span><span class="ttitle">${esc(t.title||'(kein Titel)')}</span>${badge}<span class="ticon">${icon}</span><button class="png-btn" title="PNG" onclick="event.stopPropagation();exportTextAsPNG(${i})">PNG</button>`;
      d.onclick = () => { if(state==='running') return; if(typeof window.selectCue==='function') window.selectCue(i); else selectText(i); };
      el.appendChild(d);
    });
    if (curCueIdx>=0) { const items=el.querySelectorAll('.ti'); if(items[curCueIdx]) items[curCueIdx].scrollIntoView({block:'nearest',behavior:'smooth'}); }
    const lw = document.getElementById('textList');
    if (lw) { lw.style.opacity=state==='running'?'0.5':'1'; lw.style.pointerEvents=state==='running'?'none':'auto'; }
  }

  function selectText(i) {
    if (i<0||i>=texts.length) return;
    selIdx=i; renderList();
    const t = texts[i];
    document.getElementById('eTitle').value   = t.title||'';
    document.getElementById('eCue').value     = t.cue||'';
    document.getElementById('eContent').value = t.content||'';
    const sd = document.getElementById('eStyle');
    if (sd) { rebuildStyleDropdowns(); sd.value = t.styleId||''; }
    loadExceptions(t);
    updateInfo();
  }

  function updateInfo() {
    const w = (document.getElementById('eContent').value||'').split(/\s+/).filter(Boolean).length;
    document.getElementById('eInfo').innerHTML = `Text <span>${selIdx+1} / ${texts.length}</span> &nbsp;·&nbsp; <span>${w}</span> Wörter`;
  }

  function loadExceptions(t) {
    const r = resolveForText(t);
    // Speed override (always visible)
    const eSpeedEl = document.getElementById('eSpeed');
    if (eSpeedEl) {
      eSpeedEl.value = t.exc_speed!=null ? t.exc_speed : '';
      document.getElementById('eSpeedVal').textContent = t.exc_speed!=null ? t.exc_speed+' px/s' : '(vom Stil)';
    }
    // Scroll duration override (always visible)
    const eScrollDurEl = document.getElementById('eScrollDur');
    if (eScrollDurEl) {
      eScrollDurEl.value = t.exc_scrollDuration!=null ? t.exc_scrollDuration : '';
      document.getElementById('eScrollDurVal').textContent = t.exc_scrollDuration!=null ? t.exc_scrollDuration+'s' : '(vom Stil)';
    }
    // Display duration (always visible)
    const eDurEl = document.getElementById('eDur');
    if (eDurEl) {
      eDurEl.value = t.exc_duration!=null ? t.exc_duration : r.duration;
      document.getElementById('eDurVal').textContent = parseFloat(eDurEl.value).toFixed(1)+'s';
      document.getElementById('eDurActive').checked = t.exc_duration!=null;
      eDurEl.disabled = t.exc_duration==null;
    }
    // Position
    const hasPosX = t.exc_posX!=null;
    const ePosXEl = document.getElementById('ePosX');
    if (ePosXEl) {
      ePosXEl.value = hasPosX ? t.exc_posX : r.posX;
      document.getElementById('ePosY').value = hasPosX ? t.exc_posY : r.posY;
      document.getElementById('ePosXVal').textContent = ePosXEl.value+'%';
      document.getElementById('ePosYVal').textContent = document.getElementById('ePosY').value+'%';
      const badge = document.getElementById('ePosStatus');
      if (badge) { badge.textContent=hasPosX?'Individuell':'Vom Stil'; badge.style.color=hasPosX?'var(--ac2)':'var(--mu)'; badge.style.borderColor=hasPosX?'var(--ac2)':'var(--bd)'; }
      const picker = document.getElementById('ePosPicker');
      if (picker) { picker.style.opacity=hasPosX?'1':'0.4'; syncPosPickerToValues('ePosPicker','ePosX','ePosY'); }
    }
  }

  window.saveEdit = function() {
    if (selIdx<0||selIdx>=texts.length) return;
    setTimeout(refreshPosPreviews, 50);
    const t = texts[selIdx];
    t.title   = document.getElementById('eTitle').value;
    t.cue     = document.getElementById('eCue').value;
    t.content = document.getElementById('eContent').value;
    const sd = document.getElementById('eStyle');
    if (sd) t.styleId = sd.value ? sd.value : null;
    // Per-text speed: empty = use style, value = override
    const eSpeedVal = document.getElementById('eSpeed');
    const rawSpeed = eSpeedVal ? eSpeedVal.value.trim() : '';
    t.exc_speed = rawSpeed !== '' && +rawSpeed > 0 ? +rawSpeed : null;
    // Per-text scroll duration: empty = use style
    const eScrollDurEl2 = document.getElementById('eScrollDur');
    const rawScrollDur = eScrollDurEl2 ? eScrollDurEl2.value.trim() : '';
    t.exc_scrollDuration = rawScrollDur !== '' && +rawScrollDur > 0 ? +rawScrollDur : null;
    // Display duration
    const durActive = document.getElementById('eDurActive');
    t.exc_duration = durActive&&durActive.checked ? +parseFloat(document.getElementById('eDur').value).toFixed(1) : null;
    const picker = document.getElementById('ePosPicker');
    const posOverride = picker && parseFloat(picker.style.opacity||'1') > 0.5;
    t.exc_posX = posOverride ? +document.getElementById('ePosX').value : null;
    t.exc_posY = posOverride ? +document.getElementById('ePosY').value : null;
    saveTexts(); renderList(); updateInfo();
  };

  window.clearPosOverride = function() {
    if (selIdx>=0&&texts[selIdx]) { texts[selIdx].exc_posX=null; texts[selIdx].exc_posY=null; saveTexts(); }
    const r = resolveForText(texts[selIdx]);
    if (document.getElementById('ePosX')) document.getElementById('ePosX').value = r.posX;
    if (document.getElementById('ePosY')) document.getElementById('ePosY').value = r.posY;
    if (document.getElementById('ePosXVal')) document.getElementById('ePosXVal').textContent = r.posX+'%';
    if (document.getElementById('ePosYVal')) document.getElementById('ePosYVal').textContent = r.posY+'%';
    syncPosPickerToValues('ePosPicker','ePosX','ePosY');
    const picker = document.getElementById('ePosPicker'); if (picker) picker.style.opacity='0.4';
    const badge  = document.getElementById('ePosStatus');
    if (badge) { badge.textContent='Vom Stil'; badge.style.color='var(--mu)'; badge.style.borderColor='var(--bd)'; }
  };

  window.addText  = function() { texts.push({id:Date.now(),title:`Text ${texts.length+1}`,cue:'',content:'',status:'waiting',styleId:null,exc_speed:null,exc_scrollDuration:null,exc_duration:null,exc_posX:null,exc_posY:null}); saveTexts(); renderList(); selectText(texts.length-1); };
  window.delText  = function() { if(texts.length<=1)return; if(!confirm(`"${texts[selIdx].title}" löschen?`))return; texts.splice(selIdx,1); selIdx=Math.min(selIdx,texts.length-1); saveTexts(); renderList(); selectText(selIdx); };
  window.moveUp   = function() { if(selIdx<=0)return; [texts[selIdx-1],texts[selIdx]]=[texts[selIdx],texts[selIdx-1]]; selIdx--; saveTexts(); renderList(); selectText(selIdx); };
  window.moveDown = function() { if(selIdx>=texts.length-1)return; [texts[selIdx],texts[selIdx+1]]=[texts[selIdx+1],texts[selIdx]]; selIdx++; saveTexts(); renderList(); selectText(selIdx); };

  // ── CUE CONTROL ────────────────────────────────────────────────────────────
  function setState(s) {
    state = s;
    const map = {idle:['BEREIT','idle'],running:['LÄUFT','running']};
    const [txt,cls] = map[s]||['BEREIT','idle'];
    const pill = document.getElementById('pill');
    if (pill) { pill.textContent=txt; pill.className='pill '+cls; }
    const bs=document.getElementById('btnStop'); if(bs) bs.disabled=(s==='idle');
    const bc=document.getElementById('btnCue');  if(bc) bc.disabled=(s==='running');
    const bb=document.getElementById('btnBack'); if(bb) bb.disabled=(s==='running');
  }

  function activateText(idx) {
    if (curCueIdx>=0&&texts[curCueIdx]) texts[curCueIdx].status='done';
    curCueIdx=idx; texts[curCueIdx].status='active';
    document.getElementById('curTitle').textContent = texts[curCueIdx].title||'(kein Titel)';
    document.getElementById('idxDisp').textContent  = (curCueIdx+1)+' / '+texts.length;
    totalWords = (texts[curCueIdx].content||'').split(/\s+/).filter(Boolean).length;
    pausedElapsed=0; resetProg();
  }

  window.selectCue = function(i) {
    if (state==='running') return;
    if (texts[curCueIdx]) texts[curCueIdx].status='waiting';
    curCueIdx=i;
    if (texts[curCueIdx]) texts[curCueIdx].status='waiting';
    selectText(i); setState('idle'); renderList();
  };

  window.doCue = function() {
    if (state==='running') return;
    const target = curCueIdx>=0 ? curCueIdx : 0;
    if (target>=texts.length) return;
    activateText(target); setState('running');
    const resolved = resolveForText(texts[target]);
    const textContent = texts[target] ? texts[target].content || '' : '';
    broadcast({type:'cue', idx:curCueIdx, resolved, textContent});
    startProg(); renderList();
  };

  window.doBack = function() {
    if (state==='running'||curCueIdx<=0) return;
    if (texts[curCueIdx]) texts[curCueIdx].status='waiting';
    curCueIdx--;
    if (texts[curCueIdx]) texts[curCueIdx].status='waiting';
    selectText(curCueIdx); setState('idle'); renderList();
  };

  window.doStop = function() {
    clearInterval(progInt);
    if (curCueIdx>=0&&texts[curCueIdx]) texts[curCueIdx].status='waiting';
    setState('idle'); resetProg(); broadcast({type:'stop'}); renderList();
  };

  function resetProg() {
    document.getElementById('fill').style.width='0%';
    document.getElementById('pct').textContent='0%';
    document.getElementById('sub').innerHTML='0:00<br>0 / '+totalWords+' Wörter';
  }

  function startProg() {
    clearInterval(progInt);
    const t = texts[curCueIdx]; if (!t) return;
    const r = resolveForText(t);
    const mode  = r.mode;
    const size  = r.size;
    const lineH = r.lineH;
    const dur   = r.duration * 1000;
    const fade  = r.fade * 1000;
    // For scroll mode: use scrollDuration (total seconds) if set, else use speed
    let speed = r.speed;
    let total, entryDelay;
    if (mode === 'display') {
      total = fade + dur + fade;
      entryDelay = 0;
    } else if (r.useScrollDuration && r.scrollDuration) {
      // Time-based: total duration is exactly scrollDuration seconds
      total = r.scrollDuration * 1000;
      // Calculate px/s needed: total text height / (scrollDuration - entry time)
      // Entry delay is approx screen height worth of travel
      const estLines = (t.content||'').split('\n').reduce((a,l)=>a+Math.max(1,Math.ceil(l.length/28)),0);
      const totalPx  = estLines * (size * lineH) + (window.innerHeight||800);
      speed = totalPx / r.scrollDuration; // px/s to complete in exactly scrollDuration
      entryDelay = Math.round((window.innerHeight||800) / speed * 1000);
    } else {
      const estLines = (t.content||'').split('\n').reduce((a,l)=>a+Math.max(1,Math.ceil(l.length/28)),0);
      total = (estLines*(size*lineH)/speed)*1000;
      entryDelay = Math.round((window.innerHeight||800)/speed*1000);
    }
    let progStartTime = null;
    startTime = Date.now();
    progInt = setInterval(() => {
      const now = Date.now();
      if (progStartTime===null) {
        const elapsed = pausedElapsed+(now-startTime);
        if (elapsed<entryDelay) { document.getElementById('fill').style.width='0%'; document.getElementById('pct').textContent='0%'; document.getElementById('sub').innerHTML=''; return; }
        progStartTime = now-(elapsed-entryDelay);
      }
      const el = pausedElapsed+(now-progStartTime);
      const p  = Math.min(100, Math.round((el/total)*100));
      document.getElementById('fill').style.width=p+'%';
      document.getElementById('pct').textContent=p+'%';
      const sec=Math.floor(el/1000),m=Math.floor(sec/60),ss=sec%60;
      document.getElementById('sub').innerHTML=`${m}:${ss<10?'0':''}${ss}<br>${Math.round(p/100*totalWords)} / ${totalWords}`;
      if (p>=100) { clearInterval(progInt); setState('idle'); if(texts[curCueIdx]) texts[curCueIdx].status='done'; renderList(); }
    }, 200);
  }

  window.addEventListener('storage', e => {
    if (e.key===S+'texts')    { texts  = JSON.parse(e.newValue||'[]'); renderList(); }
    if (e.key===STYLES_KEY)   { styles = JSON.parse(e.newValue||'[]'); renderStyleList(); rebuildStyleDropdowns(); }
  });

  if (opts.keyboardCues) {
    document.addEventListener('keydown', e => {
      const tag = document.activeElement ? document.activeElement.tagName : '';
      if (tag==='INPUT'||tag==='TEXTAREA'||tag==='SELECT') return;
      if (e.code==='Space')                            { e.preventDefault(); if(state!=='running') window.doCue(); }
      if (e.code==='Backspace'||e.code==='ArrowLeft')  { e.preventDefault(); if(state!=='running') window.doBack(); }
      if (e.code==='ArrowRight'||e.code==='ArrowDown') { e.preventDefault(); if(state!=='running'&&curCueIdx<texts.length-1) window.selectCue(curCueIdx+1); }
    });
  }

  // ── PNG EXPORT ─────────────────────────────────────────────────────────────
  const PNG_W=3840, PNG_H=2160;

  function sanitize(str) { return (str||'text').replace(/[^a-zA-Z0-9äöüÄÖÜß\-_. ]/g,'_').trim()||'text'; }

  async function renderTextPages(idx) {
    const t = texts[idx]; if (!t||(!(t.content||'').trim())) return [];
    const r = resolveForText(t);
    console.log('[PNG] text:', t.title, 'styleId:', t.styleId, 'size:', r.size, 'italic:', r.italic);

    const SCALE     = PNG_W / 1920;
    const fontSize  = Math.round((r.size||72) * SCALE);
    const padding   = Math.round((r.pad??80) * SCALE);
    const lineH     = Math.round(fontSize * (r.lineH||1.6));
    const maxWidth  = PNG_W - padding * 2;
    const fontStr   = `${r.italic?'italic ':''} ${r.weight||'700'} ${fontSize}px ${(r.font||"'Syne',sans-serif").replace(/'/g,'')}`.trim();

    // Measure on a scratch canvas first
    const scratch = document.createElement('canvas');
    scratch.width = PNG_W; scratch.height = PNG_H;
    const sctx = scratch.getContext('2d');
    try { await document.fonts.ready; } catch(e) {}
    sctx.font = fontStr;

    // Wrap — respect manual line breaks, only word-wrap if a line is too wide
    function wrap(text) {
      const lines = [];
      for (const inputLine of text.split('\n')) {
        if (inputLine === '' || inputLine.trim() === '') { lines.push(''); continue; }
        if (sctx.measureText(inputLine).width <= maxWidth) {
          lines.push(inputLine);
        } else {
          let current = '';
          for (const word of inputLine.split(' ')) {
            const candidate = current ? current+' '+word : word;
            if (sctx.measureText(candidate).width > maxWidth && current) {
              lines.push(current); current = word;
            } else { current = candidate; }
          }
          if (current) lines.push(current);
        }
      }
      return lines;
    }

    const allLines = wrap(t.content||'');
    if (!allLines.length) return [];

    // Calculate how many lines fit in one PNG_H screen (with padding)
    const linesPerScreen = Math.floor((PNG_H - padding * 2) / lineH);

    // How many screens do we need? Round up to next whole screen
    const screensNeeded = Math.ceil(allLines.length / linesPerScreen);
    const canvasHeight  = screensNeeded * PNG_H; // always a multiple of PNG_H

    // Build one tall canvas
    const canvas = document.createElement('canvas');
    canvas.width  = PNG_W;
    canvas.height = canvasHeight;
    const ctx = canvas.getContext('2d');
    ctx.font = fontStr;

    // Fill background
    ctx.fillStyle = r.bgColor;
    ctx.fillRect(0, 0, PNG_W, canvasHeight);

    // Draw text
    ctx.fillStyle = r.textColor;
    ctx.textAlign = r.align==='center'?'center':r.align==='right'?'right':'left';
    const x = r.align==='center' ? PNG_W/2 : r.align==='right' ? PNG_W-padding : padding;

    // posY positions the text block within the first screen;
    // for tall canvases, start at top padding instead so it's predictable
    const totalTextH = allLines.length * lineH;
    let startY;
    if (screensNeeded === 1) {
      const posY = typeof r.posY==='number' ? r.posY : 50;
      startY = Math.round((posY/100) * (PNG_H - totalTextH)) + fontSize;
    } else {
      // Multi-screen: start from top with padding
      startY = padding + fontSize;
    }

    let y = startY;
    for (const line of allLines) {
      if (line !== '') {
        ctx.fillText(line, x, y);
        if (r.underline && line.trim()) {
          const w  = ctx.measureText(line).width;
          const ux = r.align==='center'?x-w/2 : r.align==='right'?x-w : x;
          ctx.fillRect(ux, y+Math.round(fontSize*0.12), w, Math.max(2, Math.round(fontSize*0.05)));
        }
      }
      y += lineH;
    }

    const blob = await new Promise(res => canvas.toBlob(res, 'image/png'));
    const suffix = screensNeeded > 1 ? `-${screensNeeded}x` : '';
    return [{ blob, name: `${sanitize(t.title)}${suffix}.png` }];
  }

  function dlBlob(blob,name) {
    const url=URL.createObjectURL(blob);
    const a=document.createElement('a');
    a.href=url; a.download=name;
    document.body.appendChild(a); a.click();
    document.body.removeChild(a);
    setTimeout(()=>URL.revokeObjectURL(url),2000);
  }

  window.exportTextAsPNG = async function(idx) {
    const result = await renderTextPages(idx);
    if (!result.length) { alert('Kein Inhalt.'); return; }
    dlBlob(result[0].blob, result[0].name);
  };

  window.exportAllAsPNG = async function() {
    showCloudStatus('… Generiere PNGs','var(--mu)');
    if (window.JSZip) {
      const zip = new window.JSZip();
      for (let i=0;i<texts.length;i++) {
        const pages=await renderTextPages(i);
        for (const {blob,name} of pages) { const ab=await blob.arrayBuffer(); zip.file(name,ab); }
      }
      const zb = await zip.generateAsync({type:'blob'});
      dlBlob(zb, opts.label.toLowerCase().replace(/\s/g,'-')+'-pngs.zip');
      showCloudStatus('✓ ZIP heruntergeladen','var(--ac)');
    } else {
      for (let i=0;i<texts.length;i++) {
        const pages=await renderTextPages(i);
        for (const {blob,name} of pages) { dlBlob(blob,name); await new Promise(r=>setTimeout(r,800)); }
      }
      showCloudStatus('✓ Fertig','var(--ac)');
    }
  };

  // ── CLOUD ──────────────────────────────────────────────────────────────────
  window.saveToCloud = function() {
    if (!window.__fb) { alert('Firebase nicht verbunden.'); return; }
    window.__fb.fbSyncTexts(S,texts);
    window.__fb.fbSyncStyles(styles);
    showCloudStatus('☁ Gespeichert','var(--ac)');
  };
  window.loadFromCloud = function() {
    if (!window.__fb) { alert('Firebase nicht verbunden.'); return; }
    showCloudStatus('… Laden','var(--mu)');
    Promise.all([window.__fb.fbGetTexts(S), window.__fb.fbGetStyles()]).then(([fbTexts,fbStyles]) => {
      if (fbTexts&&fbTexts.length>0)   { texts=fbTexts;   localStorage.setItem(S+'texts',JSON.stringify(texts)); renderList(); selectText(0); }
      if (fbStyles&&fbStyles.length>0) { styles=fbStyles; saveStylesLocal(styles); renderStyleList(); rebuildStyleDropdowns(); }
      showCloudStatus('☁ Geladen','var(--ac)');
    }).catch(()=>showCloudStatus('⚠ Fehler','var(--dn)'));
  };
  function showCloudStatus(msg,color) {
    const el=document.getElementById('cloudStatus'); if(!el)return;
    el.textContent=msg; el.style.color=color;
    setTimeout(()=>{el.textContent='';},3000);
  }

  // ── INIT ───────────────────────────────────────────────────────────────────
  const rawTexts = localStorage.getItem(S+'texts');
  texts = rawTexts ? JSON.parse(rawTexts) : null;
  if (!texts) {
    texts = Array.from({length:20},(_,i)=>({id:Date.now()+i,title:`Text ${i+1}`,cue:'',content:`Platzhalter für Text ${i+1}.\n\nBitte ersetzen.`,status:'waiting',styleId:null,exc_speed:null,exc_scrollDuration:null,exc_duration:null,exc_posX:null,exc_posY:null}));
    saveTexts();
  }
  styles = getStyles();

  renderList(); selectText(0);
  renderStyleList(); renderStyleEditor();
  rebuildStyleDropdowns();

  buildPosPicker('ePosPicker','ePosX','ePosY','ePosXVal','ePosYVal', () => {
    document.getElementById('ePosPicker').style.opacity='1';
    const badge=document.getElementById('ePosStatus');
    if(badge){badge.textContent='Individuell';badge.style.color='var(--ac2)';badge.style.borderColor='var(--ac2)';}
    saveEdit();
    const prev=document.getElementById('ePosPreview');
    if(prev&&prev._syncFromSliders) prev._syncFromSliders();
  });

  // Build draggable position preview for per-text position
  buildPosPreview('ePosPreview','ePosX','ePosY','ePosXVal','ePosYVal', () => {
    document.getElementById('ePosPicker').style.opacity='1';
    const badge=document.getElementById('ePosStatus');
    if(badge){badge.textContent='Individuell';badge.style.color='var(--ac2)';badge.style.borderColor='var(--ac2)';}
    saveEdit();
  });

  setState('idle');

  window.initDefaults = function() {
    texts=Array.from({length:20},(_,i)=>({id:Date.now()+i,title:`Text ${i+1}`,cue:'',content:`Platzhalter für Text ${i+1}.\n\nBitte ersetzen.`,status:'waiting',styleId:null,exc_speed:null,exc_scrollDuration:null,exc_duration:null,exc_posX:null,exc_posY:null}));
    saveTexts(); renderList(); selectText(0);
  };
  window.exportData = function() {
    const b=new Blob([JSON.stringify({texts,styles},null,2)],{type:'application/json'});
    const a=document.createElement('a'); a.href=URL.createObjectURL(b);
    a.download=opts.label.toLowerCase().replace(/\s/g,'-')+'-daten.json'; a.click();
  };
  window.importData = function(e) {
    const f=e.target.files[0]; if(!f)return;
    const r=new FileReader();
    r.onload=ev=>{
      try {
        const d=JSON.parse(ev.target.result);
        if(d.texts)  { texts=d.texts;   saveTexts(); }
        if(d.styles) { styles=d.styles; saveStylesLocal(styles); renderStyleList(); rebuildStyleDropdowns(); }
        renderList(); selectText(0);
      } catch(err) { alert('Fehler: '+err.message); }
    };
    r.readAsText(f);
  };
}
