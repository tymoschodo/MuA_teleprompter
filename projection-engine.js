function initProjection(opts) {
  // opts: { namespace, defaultBg, defaultColor, defaultMode }
  const S = opts.namespace;
  let texts=[], animId=null;
  let startPos={x:0,y:0}, endPos={x:0,y:0};
  let animStart=0, animDuration=0;
  let paused=false, stopped=true, pausedX=0, pausedY=0;
  let displayTimeout=null, curIdx=-1;

  const stage=document.getElementById('stage');
  const wrap=document.getElementById('wrap');
  const content=document.getElementById('content');
  const tag=document.getElementById('tag');
  const hint=document.getElementById('hint');

  setTimeout(()=>{if(hint)hint.style.opacity='0';},3000);

  function getG() { return JSON.parse(localStorage.getItem(S+'global')||'{}'); }
  function getT() { return JSON.parse(localStorage.getItem(S+'texts') ||'[]'); }

  function resolve(idx) {
    const g=getG(), t=(texts[idx]||{});
    return {
      font:      g.font      || "'Syne',sans-serif",
      size:      g.size      || 72,
      weight:    g.weight    || '700',
      align:     g.align     || 'left',
      pad:       g.pad       !== undefined ? g.pad : 80,
      mirror:    g.mirror    || false,
      textColor: g.textColor || opts.defaultColor,
      bgColor:   g.bgColor   || opts.defaultBg,
      lineH:     g.lineH     || 1.6,
      fade:      g.fade      !== undefined ? g.fade : 0.5,
      mode:      g.mode      || opts.defaultMode,
      dir:       g.dir       || 'up',
      speed:     t.speed     || g.speed || 60,
      keepText:  g.keepText  || false,
      duration:  t.duration  || g.duration || 5,
      posX: (t.posX !== undefined && t.posX !== null && t.posX !== '') ? +t.posX : (g.posX !== undefined ? +g.posX : 50),
      posY: (t.posY !== undefined && t.posY !== null && t.posY !== '') ? +t.posY : (g.posY !== undefined ? +g.posY : 50),
    };
  }

  function applyVisual(s) {
    document.body.style.background = s.bgColor;
    stage.style.background          = s.bgColor;
    content.style.fontFamily        = s.font;
    content.style.fontSize          = s.size+'px';
    content.style.lineHeight        = s.lineH;
    content.style.color             = s.textColor;
    content.style.fontWeight        = s.weight;
    content.style.textAlign         = s.align;
    content.style.padding           = `0 ${s.pad}px`;
    content.style.transform         = s.mirror ? 'scaleX(-1)' : '';
  }

  function traj(s) {
    const W=window.innerWidth,H=window.innerHeight,tw=wrap.offsetWidth,th=wrap.offsetHeight,k=s.keepText;
    // When keepText=false, text must scroll fully OFF screen.
    // End positions use -(th+H) / (W+tw) to guarantee last line clears the edge.
    const ox=W+tw, oy=th+H; // full off-screen offsets
    const m={
      'up':     [{x:0,       y:H},    {x:0,       y:k?0:-oy}],
      'down':   [{x:0,       y:-th},  {x:0,       y:k?H-th:H+oy}],
      'left':   [{x:W,       y:0},    {x:k?0:-ox, y:0}],
      'right':  [{x:-tw,     y:0},    {x:k?W-tw:ox,y:0}],
      'diag-ul':[{x:W,       y:H},    {x:k?0:-ox, y:k?0:-oy}],
      'diag-ur':[{x:-tw,     y:H},    {x:k?W-tw:ox,y:k?0:-oy}],
      'diag-dl':[{x:W,       y:-th},  {x:k?0:-ox, y:k?H-th:H+oy}],
      'diag-dr':[{x:-tw,     y:-th},  {x:k?W-tw:ox,y:k?H-th:H+oy}],
    };
    return m[s.dir]||m['up'];
  }

  function clearAll() {
    if(displayTimeout){clearTimeout(displayTimeout);displayTimeout=null;}
    if(animId){cancelAnimationFrame(animId);animId=null;}
  }

  function startText(idx) {
    clearAll(); curIdx=idx; paused=false; stopped=false;
    const s=resolve(idx);
    applyVisual(s);
    content.textContent=texts[idx]?(texts[idx].content||''):'';
    if(tag) tag.textContent=`${idx+1} / ${texts.length}`;
    wrap.style.transition=''; wrap.style.opacity='1';
    wrap.style.width=window.innerWidth+'px';

    if(s.mode==='display') {
      wrap.style.transform='translate(0px,0px)';
      requestAnimationFrame(()=>{
        void wrap.offsetHeight;
        const W=window.innerWidth,H=window.innerHeight,tw=wrap.offsetWidth,th=wrap.offsetHeight;
        const px=Math.max(0,Math.min(W-tw, (s.posX/100)*(W-tw)));
        const py=Math.max(0,Math.min(H-th, (s.posY/100)*(H-th)));
        wrap.style.transform=`translate(${px}px,${py}px)`;
        wrap.style.opacity='0';
        wrap.style.transition=`opacity ${s.fade}s ease`;
        // Small timeout so browser registers opacity:0 before transitioning to 1
        setTimeout(()=>{
          wrap.style.opacity='1';
          displayTimeout=setTimeout(()=>{
            wrap.style.transition=`opacity ${s.fade}s ease`;
            wrap.style.opacity='0';
            displayTimeout=setTimeout(()=>{
              stopped=true; content.textContent=''; if(tag)tag.textContent='';
              wrap.style.opacity='1'; wrap.style.transition='';
            },s.fade*1000);
          },s.duration*1000);
        });
      });
    } else {
      // Single rAF: force layout, measure, snap to start, begin animation immediately
      requestAnimationFrame(()=>{
        // Force layout so offsetHeight is correct
        void wrap.offsetHeight;
        const pair=traj(s);
        startPos=pair[0]; endPos=pair[1];
        wrap.style.transform=`translate(${startPos.x}px,${startPos.y}px)`;
        const dx=endPos.x-startPos.x, dy=endPos.y-startPos.y;
        animDuration=(Math.sqrt(dx*dx+dy*dy)/s.speed)*1000;
        animStart=performance.now();
        animate();
      });
    }
  }

  function animate() {
    if(paused||stopped)return;
    const t=Math.min((performance.now()-animStart)/animDuration,1);
    wrap.style.transform=`translate(${startPos.x+(endPos.x-startPos.x)*t}px,${startPos.y+(endPos.y-startPos.y)*t}px)`;
    if(t<1) animId=requestAnimationFrame(animate);
    else stopped=true;
  }

  function doPause() {
    if(stopped)return;
    if(!paused) {
      clearAll();
      const m=wrap.style.transform.match(/translate\(([^,]+)px,\s*([^)]+)px\)/);
      if(m){pausedX=parseFloat(m[1]);pausedY=parseFloat(m[2]);}
      paused=true;
    } else {
      const s=resolve(curIdx);
      if(s.mode!=='display'){
        const dx=endPos.x-pausedX,dy=endPos.y-pausedY;
        animDuration=(Math.sqrt(dx*dx+dy*dy)/s.speed)*1000;
        startPos={x:pausedX,y:pausedY}; animStart=performance.now();
        paused=false; animate();
      } else { paused=false; }
    }
  }

  function doStop() {
    clearAll(); stopped=true; paused=false;
    wrap.style.transition='opacity 0.5s'; wrap.style.opacity='0';
    setTimeout(()=>{
      wrap.style.transition=''; wrap.style.opacity='1';
      wrap.style.transform='translate(0px,100vh)';
      content.textContent=''; if(tag)tag.textContent='';
    },520);
  }

  window.addEventListener('storage', e => {
    if(e.key===S+'texts') texts=JSON.parse(e.newValue||'[]');
    if(e.key===S+'msg') {
      try {
        const msg=JSON.parse(e.newValue||'{}');
        if(msg.type==='cue')    {texts=getT();startText(msg.idx);}
        if(msg.type==='pause')  {doPause();}
        if(msg.type==='resume') {if(paused)doPause();}
        if(msg.type==='stop')   {doStop();}
      } catch(e){}
    }
  });

  document.addEventListener('keydown', e => {
    if(e.key==='f'||e.key==='F'){
      if(!document.fullscreenElement) document.documentElement.requestFullscreen().catch(()=>{});
      else document.exitFullscreen();
    }
  });

  texts=getT();
  const g=getG();
  document.body.style.background = g.bgColor || opts.defaultBg;
  if(stage) stage.style.background = g.bgColor || opts.defaultBg;
}
