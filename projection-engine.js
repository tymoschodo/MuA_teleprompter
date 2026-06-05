// Shared projection engine
// Call initProjection({ namespace, defaultBg, defaultColor, defaultMode })

function initProjection(opts) {
  const NS  = opts.namespace;   // 'tp_front_' or 'tp_back_'
  const S   = NS;

  let texts = [], animId = null;
  let startPos = {x:0,y:0}, endPos = {x:0,y:0};
  let animStart = 0, animDuration = 0;
  let paused = false, stopped = true;
  let pausedX = 0, pausedY = 0;
  let displayTimeout = null;
  let curIdx = -1;

  const stage   = document.getElementById('stage');
  const wrap    = document.getElementById('wrap');
  const content = document.getElementById('content');
  const tag     = document.getElementById('tag');
  const hint    = document.getElementById('hint');

  setTimeout(() => { if(hint) hint.style.opacity = '0'; }, 3000);

  function getG()  { return JSON.parse(localStorage.getItem(S+'global')  || '{}'); }
  function getT()  { return JSON.parse(localStorage.getItem(S+'texts')   || '[]'); }

  function resolveSettings(idx) {
    const g = getG();
    const t = (texts[idx] || {});
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
    };
  }

  function applyVisual(s) {
    document.body.style.background = s.bgColor;
    stage.style.background          = s.bgColor;
    content.style.fontFamily        = s.font;
    content.style.fontSize          = s.size + 'px';
    content.style.lineHeight        = s.lineH;
    content.style.color             = s.textColor;
    content.style.fontWeight        = s.weight;
    content.style.textAlign         = s.align;
    content.style.padding           = `0 ${s.pad}px`;
    content.style.transform         = s.mirror ? 'scaleX(-1)' : '';
  }

  function computeTrajectory(s) {
    const W = window.innerWidth, H = window.innerHeight;
    const tw = wrap.offsetWidth, th = wrap.offsetHeight;
    const keep = s.keepText;
    const map = {
      'up':      [{x:(W-tw)/2, y:H},   {x:(W-tw)/2, y:keep?0:-th}],
      'down':    [{x:(W-tw)/2, y:-th},  {x:(W-tw)/2, y:keep?H-th:H}],
      'left':    [{x:W, y:(H-th)/2},    {x:keep?0:-tw, y:(H-th)/2}],
      'right':   [{x:-tw, y:(H-th)/2},  {x:keep?W-tw:W, y:(H-th)/2}],
      'diag-ul': [{x:W, y:H},           {x:keep?0:-tw, y:keep?0:-th}],
      'diag-ur': [{x:-tw, y:H},         {x:keep?W-tw:W, y:keep?0:-th}],
      'diag-dl': [{x:W, y:-th},         {x:keep?0:-tw, y:keep?H-th:H}],
      'diag-dr': [{x:-tw, y:-th},       {x:keep?W-tw:W, y:keep?H-th:H}],
    };
    return (map[s.dir] || map['up']);
  }

  function clearAll() {
    if (displayTimeout) { clearTimeout(displayTimeout); displayTimeout = null; }
    if (animId)         { cancelAnimationFrame(animId); animId = null; }
  }

  function startText(idx) {
    clearAll();
    curIdx = idx;
    paused = false; stopped = false;

    const s = resolveSettings(idx);
    applyVisual(s);
    content.textContent = texts[idx] ? (texts[idx].content || '') : '';
    if (tag) tag.textContent = `${idx+1} / ${texts.length}`;

    wrap.style.transition = '';
    wrap.style.opacity    = '1';
    wrap.style.width      = window.innerWidth + 'px';

    if (s.mode === 'display') {
      // Centre vertically, fade in, hold, fade out
      wrap.style.transform = 'translate(0px,0px)';
      requestAnimationFrame(() => {
        const H = window.innerHeight, th = wrap.offsetHeight;
        wrap.style.transform = `translate(0px,${Math.max(0,(H-th)/2)}px)`;
        wrap.style.opacity = '0';
        requestAnimationFrame(() => {
          wrap.style.transition = `opacity ${s.fade}s ease`;
          wrap.style.opacity = '1';
          displayTimeout = setTimeout(() => {
            wrap.style.transition = `opacity ${s.fade}s ease`;
            wrap.style.opacity = '0';
            displayTimeout = setTimeout(() => {
              stopped = true;
              content.textContent = '';
              if (tag) tag.textContent = '';
              wrap.style.opacity = '1';
              wrap.style.transition = '';
            }, s.fade * 1000);
          }, s.duration * 1000);
        });
      });

    } else {
      // Scroll: snap to start pos instantly, then animate
      requestAnimationFrame(() => {
        const pair = computeTrajectory(s);
        startPos = pair[0]; endPos = pair[1];
        wrap.style.transform = `translate(${startPos.x}px,${startPos.y}px)`;
        const dx = endPos.x-startPos.x, dy = endPos.y-startPos.y;
        animDuration = (Math.sqrt(dx*dx+dy*dy) / s.speed) * 1000;
        animStart = performance.now();
        requestAnimationFrame(animate);
      });
    }
  }

  function animate() {
    if (paused || stopped) return;
    const t = Math.min((performance.now()-animStart)/animDuration, 1);
    wrap.style.transform = `translate(${startPos.x+(endPos.x-startPos.x)*t}px,${startPos.y+(endPos.y-startPos.y)*t}px)`;
    if (t < 1) animId = requestAnimationFrame(animate);
    else stopped = true;
  }

  function doPause() {
    if (stopped) return;
    if (!paused) {
      clearAll();
      const m = wrap.style.transform.match(/translate\(([^,]+)px,\s*([^)]+)px\)/);
      if (m) { pausedX = parseFloat(m[1]); pausedY = parseFloat(m[2]); }
      paused = true;
    } else {
      const s = resolveSettings(curIdx);
      if (s.mode !== 'display') {
        const dx = endPos.x-pausedX, dy = endPos.y-pausedY;
        animDuration = (Math.sqrt(dx*dx+dy*dy) / s.speed) * 1000;
        startPos = {x:pausedX, y:pausedY};
        animStart = performance.now();
        paused = false;
        animate();
      } else {
        paused = false;
      }
    }
  }

  function doStop() {
    clearAll();
    stopped = true; paused = false;
    wrap.style.transition = 'opacity 0.5s';
    wrap.style.opacity = '0';
    setTimeout(() => {
      wrap.style.transition = '';
      wrap.style.opacity = '1';
      wrap.style.transform = 'translate(0px,100vh)';
      content.textContent = '';
      if (tag) tag.textContent = '';
    }, 520);
  }

  window.addEventListener('storage', e => {
    if (e.key === S+'texts') { texts = JSON.parse(e.newValue || '[]'); }
    if (e.key === S+'msg') {
      try {
        const msg = JSON.parse(e.newValue || '{}');
        if (msg.type === 'cue')    { texts = getT(); startText(msg.idx); }
        if (msg.type === 'pause')  { doPause(); }
        if (msg.type === 'resume') { if (paused) doPause(); }
        if (msg.type === 'stop')   { doStop(); }
      } catch(e) {}
    }
  });

  document.addEventListener('keydown', e => {
    if (e.key === 'f' || e.key === 'F') {
      if (!document.fullscreenElement) document.documentElement.requestFullscreen().catch(()=>{});
      else document.exitFullscreen();
    }
  });

  // Init background immediately
  texts = getT();
  const g = getG();
  document.body.style.background = g.bgColor || opts.defaultBg;
  if (stage) stage.style.background = g.bgColor || opts.defaultBg;
}
