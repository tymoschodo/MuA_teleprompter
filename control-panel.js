// Shared control panel logic
// Call initPanel(opts) where opts = { namespace, projectionUrl, defaultBg, defaultColor, defaultMode, label }

function initPanel(opts) {
  const S = opts.namespace;
  const TC = ['#f0efe8','#ffffff','#e8ff47','#ff6b35','#00ffcc','#000000','#111111'];
  const BC = ['#000000','#0e0e0f','#1a1a1d','#ffffff','#f5f5f0','#f0ede6','#0a0a20'];

  let texts = [], selIdx = 0;
  let curCueIdx = -1, state = 'idle';
  let progInt = null, startTime = 0, totalDur = 0, totalWords = 0, pausedElapsed = 0;

  function getG()  { return JSON.parse(localStorage.getItem(S+'global') || '{}'); }
  function saveG(g){ localStorage.setItem(S+'global', JSON.stringify(g)); broadcast({type:'global',data:g}); }
  function broadcast(msg){ localStorage.setItem(S+'msg', JSON.stringify({...msg, ts:Date.now()})); }

  // ── GLOBAL SETTINGS ────────────────────────────────────────────────────────
  window.saveGlobal = function() {
    const g = {
      mode:      document.getElementById('modeScroll').classList.contains('on') ? 'scroll' : 'display',
      dir:       document.getElementById('sDir').value,
      speed:     +document.getElementById('sSpeed').value,
      lineH:     +(document.getElementById('sLineH').value/10).toFixed(1),
      keepText:  document.getElementById('sKeep').checked,
      mirror:    document.getElementById('sMirror').checked,
      font:      document.getElementById('sFont').value,
      size:      +document.getElementById('sSize').value,
      weight:    document.getElementById('sWeight').value,
      align:     document.getElementById('sAlign').value,
      pad:       +document.getElementById('sPad').value,
      fade:      +parseFloat(document.getElementById('sFade').value).toFixed(1),
      duration:  +parseFloat(document.getElementById('sDuration').value).toFixed(1),
      textColor: activeColor('colorSwatches') || opts.defaultColor,
      bgColor:   activeColor('bgSwatches')    || opts.defaultBg,
    };
    saveG(g);
  };

  window.setMode = function(m) {
    document.getElementById('modeScroll').classList.toggle('on', m==='scroll');
    document.getElementById('modeDisplay').classList.toggle('on', m==='display');
    saveGlobal();
  };

  window.setScheme = function(scheme) {
    if (scheme === 'wob') { setActiveColor('colorSwatches','#f0efe8'); setActiveColor('bgSwatches','#000000'); }
    else                  { setActiveColor('colorSwatches','#000000'); setActiveColor('bgSwatches','#ffffff'); }
    saveGlobal();
  };

  function setActiveColor(id, col) {
    document.querySelectorAll('#'+id+' .cs').forEach(x => x.classList.toggle('sel', x.dataset.c === col));
  }

  function activeColor(id) {
    const e = document.querySelector('#'+id+' .cs.sel');
    return e ? e.dataset.c : null;
  }

  function buildSwatches(id, colors, key, def) {
    const cont = document.getElementById(id); cont.innerHTML = '';
    const cur = getG()[key] || def;
    colors.forEach(col => {
      const d = document.createElement('div');
      d.className = 'cs' + (col === cur ? ' sel' : '');
      d.style.background = col;
      d.style.outline = (col==='#000000'||col==='#0e0e0f'||col==='#1a1a1d') ? '1px solid #555' : '';
      d.dataset.c = col; d.title = col;
      d.onclick = () => { cont.querySelectorAll('.cs').forEach(x=>x.classList.remove('sel')); d.classList.add('sel'); saveGlobal(); };
      cont.appendChild(d);
    });
  }

  function loadGlobalUI() {
    const g = getG();
    const sv = (id,v) => { if(v!==undefined && document.getElementById(id)) document.getElementById(id).value=v; };
    setMode(g.mode || opts.defaultMode);
    sv('sDir', g.dir);
    if(g.speed)    { sv('sSpeed',g.speed);     document.getElementById('sSpeedVal').textContent=g.speed+' px/s'; }
    if(g.lineH)    { sv('sLineH',g.lineH*10);  document.getElementById('sLineHVal').textContent=parseFloat(g.lineH).toFixed(1); }
    if(g.keepText!==undefined) document.getElementById('sKeep').checked=g.keepText;
    if(g.mirror!==undefined)   document.getElementById('sMirror').checked=g.mirror;
    sv('sFont',g.font); sv('sWeight',g.weight); sv('sAlign',g.align);
    if(g.size)     { sv('sSize',g.size);       document.getElementById('sSizeVal').textContent=g.size+'px'; }
    if(g.pad!==undefined) { sv('sPad',g.pad);  document.getElementById('sPadVal').textContent=g.pad+'px'; }
    if(g.fade)     { sv('sFade',g.fade);       document.getElementById('sFadeVal').textContent=g.fade+'s'; }
    if(g.duration) { sv('sDuration',g.duration); document.getElementById('sDurationVal').textContent=g.duration+'s'; }
  }

  // ── TEXT LIST ──────────────────────────────────────────────────────────────
  function saveTexts() {
    localStorage.setItem(S+'texts', JSON.stringify(texts));
    broadcast({type:'texts', data:texts});
  }

  function renderList() {
    const el = document.getElementById('textList'); el.innerHTML='';
    texts.forEach((t,i) => {
      const isCur = i === curCueIdx;
      const cls = isCur ? 'active' : t.status==='done' ? 'done' : 'waiting';
      const icon = isCur ? (state==='running'?'►':state==='paused'?'⏸':'·') : t.status==='done'?'✓':'';
      const spd = t.speed ? t.speed+'px/s' : '';
      const d = document.createElement('div');
      d.className = 'ti' + (i===selIdx?' sel':'') + ' ' + cls;
      d.innerHTML = `<span class="tnum">${String(i+1).padStart(2,'0')}</span><span class="ttitle">${t.title||'(kein Titel)'}</span><span class="tspd">${spd}</span><span class="ticon">${icon}</span>`;
      d.onclick = () => selectText(i);
      el.appendChild(d);
    });
    if(curCueIdx>=0){ const items=el.querySelectorAll('.ti'); if(items[curCueIdx])items[curCueIdx].scrollIntoView({block:'nearest',behavior:'smooth'}); }
  }

  function selectText(i) {
    if(i<0||i>=texts.length)return;
    selIdx=i; renderList();
    const t=texts[i];
    document.getElementById('eTitle').value=t.title||'';
    document.getElementById('eContent').value=t.content||'';
    const spd=t.speed||getG().speed||60;
    document.getElementById('eSpeed').value=spd;
    document.getElementById('eSpeedVal').textContent=spd+' px/s';
    const dur=t.duration||getG().duration||5;
    document.getElementById('eDur').value=dur;
    document.getElementById('eDurVal').textContent=parseFloat(dur).toFixed(1)+'s';
    updateInfo();
  }

  function updateInfo() {
    const w=(document.getElementById('eContent').value||'').split(/\s+/).filter(Boolean).length;
    document.getElementById('eInfo').innerHTML=`Text <span>${selIdx+1} / ${texts.length}</span> &nbsp;·&nbsp; <span>${w}</span> Wörter`;
  }

  window.saveEdit = function() {
    if(selIdx<0||selIdx>=texts.length)return;
    texts[selIdx].title    = document.getElementById('eTitle').value;
    texts[selIdx].content  = document.getElementById('eContent').value;
    texts[selIdx].speed    = +document.getElementById('eSpeed').value;
    texts[selIdx].duration = +parseFloat(document.getElementById('eDur').value).toFixed(1);
    saveTexts(); renderList(); updateInfo();
  };

  window.addText = function() {
    texts.push({id:Date.now(),title:`Text ${texts.length+1}`,content:'',status:'waiting',speed:null,duration:null});
    saveTexts(); renderList(); selectText(texts.length-1);
  };
  window.delText = function() {
    if(texts.length<=1)return;
    if(!confirm(`"${texts[selIdx].title}" löschen?`))return;
    texts.splice(selIdx,1); selIdx=Math.min(selIdx,texts.length-1);
    saveTexts(); renderList(); selectText(selIdx);
  };
  window.moveUp = function() {
    if(selIdx<=0)return;
    [texts[selIdx-1],texts[selIdx]]=[texts[selIdx],texts[selIdx-1]]; selIdx--;
    saveTexts(); renderList(); selectText(selIdx);
  };
  window.moveDown = function() {
    if(selIdx>=texts.length-1)return;
    [texts[selIdx],texts[selIdx+1]]=[texts[selIdx+1],texts[selIdx]]; selIdx++;
    saveTexts(); renderList(); selectText(selIdx);
  };

  // ── CUE CONTROL ────────────────────────────────────────────────────────────
  function setState(s) {
    state=s;
    const pill=document.getElementById('pill');
    const map={idle:['BEREIT','idle'],running:['LÄUFT','running'],paused:['PAUSE','paused']};
    const [txt,cls]=map[s]; pill.textContent=txt; pill.className='pill '+cls;
    document.getElementById('btnPause').disabled=(s==='idle');
    document.getElementById('btnStop').disabled=(s==='idle');
    document.getElementById('btnCue').disabled=(s==='running');
    document.getElementById('btnBack').disabled=(s==='running'||curCueIdx<=0);
  }

  function activateText(idx) {
    if(curCueIdx>=0&&texts[curCueIdx]) texts[curCueIdx].status='done';
    curCueIdx=idx; texts[curCueIdx].status='active';
    document.getElementById('curTitle').textContent=texts[curCueIdx].title||'(kein Titel)';
    document.getElementById('idxDisp').textContent=(curCueIdx+1)+' / '+texts.length;
    totalWords=(texts[curCueIdx].content||'').split(/\s+/).filter(Boolean).length;
    pausedElapsed=0; resetProg();
  }

  window.doCue = function() {
    if(state==='running')return;
    const next=curCueIdx+1;
    if(next>=texts.length){alert('Alle '+texts.length+' Texte wurden gezeigt!');return;}
    activateText(next); setState('running');
    broadcast({type:'cue',idx:curCueIdx});
    startProg(); renderList();
  };

  window.doBack = function() {
    if(state==='running'||curCueIdx<=0)return;
    if(curCueIdx>=0&&texts[curCueIdx]) texts[curCueIdx].status='waiting';
    const prev=curCueIdx-1;
    curCueIdx=prev-1; // activateText will increment
    activateText(prev);
    setState('running');
    broadcast({type:'cue',idx:curCueIdx});
    startProg(); renderList();
  };

  window.doPause = function() {
    if(state==='running'){
      clearInterval(progInt); pausedElapsed+=Date.now()-startTime;
      setState('paused'); broadcast({type:'pause'});
    } else if(state==='paused'){
      startTime=Date.now(); startProg(); setState('running'); broadcast({type:'resume'});
    }
    renderList();
  };

  window.doStop = function() {
    clearInterval(progInt);
    if(curCueIdx>=0&&texts[curCueIdx]) texts[curCueIdx].status='waiting';
    setState('idle'); resetProg(); broadcast({type:'stop'}); renderList();
  };

  function resetProg() {
    document.getElementById('fill').style.width='0%';
    document.getElementById('pct').textContent='0%';
    document.getElementById('sub').innerHTML='0:00<br>0 / '+totalWords+' Wörter';
  }

  function startProg() {
    clearInterval(progInt);
    const g=getG(); const t=texts[curCueIdx]; if(!t)return;
    const mode=g.mode||opts.defaultMode;
    const speed=t.speed||g.speed||60;
    const size=g.size||72; const lineH=g.lineH||1.6;
    const dur=(t.duration||g.duration||5)*1000;
    startTime=Date.now();
    if(mode==='display'){
      progInt=setInterval(()=>{
        const el=pausedElapsed+(Date.now()-startTime);
        const p=Math.min(100,Math.round((el/dur)*100));
        updateProgUI(p,el);
        if(p>=100){clearInterval(progInt);setState('idle');if(texts[curCueIdx])texts[curCueIdx].status='done';renderList();}
      },200);
    } else {
      const estLines=(t.content||'').split('\n').reduce((a,l)=>a+Math.max(1,Math.ceil(l.length/28)),0);
      totalDur=(estLines*(size*lineH)/speed)*1000;
      progInt=setInterval(()=>{
        const el=pausedElapsed+(Date.now()-startTime);
        const p=Math.min(100,Math.round((el/totalDur)*100));
        updateProgUI(p,el);
        if(p>=100){clearInterval(progInt);setState('idle');if(texts[curCueIdx])texts[curCueIdx].status='done';renderList();}
      },200);
    }
  }

  function updateProgUI(p,ms) {
    document.getElementById('fill').style.width=p+'%';
    document.getElementById('pct').textContent=p+'%';
    const sec=Math.floor(ms/1000),m=Math.floor(sec/60),ss=sec%60;
    document.getElementById('sub').innerHTML=`${m}:${ss<10?'0':''}${ss}<br>${Math.round(p/100*totalWords)} / ${totalWords} Wörter`;
  }

  // ── STORAGE SYNC ───────────────────────────────────────────────────────────
  window.addEventListener('storage', e => {
    if(e.key===S+'texts'){ texts=JSON.parse(e.newValue||'[]'); renderList(); }
  });

  document.addEventListener('keydown', e => {
    if(e.code==='Space')    { e.preventDefault(); if(state!=='running') doCue(); }
    if(e.code==='Backspace'||e.code==='ArrowLeft') { e.preventDefault(); if(state!=='running') doBack(); }
  });

  // ── EXPORT / IMPORT ────────────────────────────────────────────────────────
  window.exportData = function() {
    const b=new Blob([JSON.stringify({texts,global:getG()},null,2)],{type:'application/json'});
    const a=document.createElement('a'); a.href=URL.createObjectURL(b);
    a.download=opts.label.toLowerCase()+'-daten.json'; a.click();
  };
  window.importData = function(e) {
    const f=e.target.files[0]; if(!f)return;
    const r=new FileReader();
    r.onload=ev=>{
      try{
        const d=JSON.parse(ev.target.result);
        if(d.texts){texts=d.texts;saveTexts();}
        if(d.global){localStorage.setItem(S+'global',JSON.stringify(d.global));loadGlobalUI();buildSwatches('colorSwatches',TC,'textColor',opts.defaultColor);buildSwatches('bgSwatches',BC,'bgColor',opts.defaultBg);}
        renderList();selectText(0);
      }catch(err){alert('Fehler: '+err.message);}
    };r.readAsText(f);
  };
  window.initDefaults = function() {
    texts=Array.from({length:20},(_,i)=>({id:Date.now()+i,title:`Text ${i+1}`,content:`Platzhalter für Text ${i+1}.\n\nBitte ersetzen.`,status:'waiting',speed:null,duration:null}));
    saveTexts();renderList();selectText(0);
  };

  // ── INIT ───────────────────────────────────────────────────────────────────
  const raw=localStorage.getItem(S+'texts');
  texts=raw?JSON.parse(raw):null;
  if(!texts) initDefaults(); else { renderList(); selectText(0); }
  loadGlobalUI();
  buildSwatches('colorSwatches',TC,'textColor',opts.defaultColor);
  buildSwatches('bgSwatches',BC,'bgColor',opts.defaultBg);
  if(!getG().font) saveGlobal();
  setState('idle');
}
