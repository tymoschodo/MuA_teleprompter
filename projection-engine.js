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

  function getT() { return JSON.parse(localStorage.getItem(S+'texts') ||'[]'); }

  let lastResolved = null; // fully resolved settings sent with each cue

  function resolve() {
    if (lastResolved) return lastResolved;
    // Hardcoded defaults — only used before any cue arrives
    return {
      font:"'Syne',sans-serif", size:72, weight:'700',
      italic:false, underline:false, align:'left', pad:80, mirror:false,
      textColor:opts.defaultColor, bgColor:opts.defaultBg,
      lineH:1.6, fade:0.5, mode:opts.defaultMode, dir:'up',
      speed:60, keepText:false, duration:5, posX:50, posY:50,
    };
  }

  const REF_WIDTH = 1920; // reference screen width the size slider is calibrated against

  function applyVisual(s) {
    document.body.style.background = s.bgColor;
    stage.style.background          = s.bgColor;
    content.style.fontFamily        = s.font;
    // Scale font size proportionally to screen width so it looks the same on any display
    const scaledSize = ((s.size / REF_WIDTH) * window.innerWidth).toFixed(2);
    content.style.fontSize          = scaledSize + 'px';
    content.style.lineHeight        = s.lineH;
    content.style.color             = s.textColor;
    content.style.fontWeight        = s.weight;
    content.style.fontStyle         = s.italic    ? 'italic' : 'normal';
    content.style.textDecoration    = s.underline ? 'underline' : 'none';
    content.style.textAlign         = s.align;
    // justify needs white-space:normal; otherwise keep pre-wrap for line breaks
    content.style.whiteSpace        = s.align === 'justify' ? 'normal' : 'pre-wrap';
    // Also scale padding proportionally
    const scaledPad = Math.round((s.pad / REF_WIDTH) * window.innerWidth);
    content.style.padding           = `0 ${scaledPad}px`;
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
    animWorker.postMessage('stop');
  }

  function startText(idx) {
    clearAll(); curIdx=idx; paused=false; stopped=false;
    const s=resolve();
    console.log('[Projection] cue', idx, 'italic:', s.italic, 'font:', s.font, 'size:', s.size, 'weight:', s.weight, 'full resolved:', JSON.stringify(s));
    applyVisual(s);
    const textData = texts && texts[idx];
    content.textContent = textData ? (textData.content||'') : '';
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

  // Web Worker clock — runs at full speed even in background tabs
  const workerBlob = new Blob([`
    let iv = null;
    self.onmessage = function(e) {
      if (e.data === 'start') {
        if (iv) clearInterval(iv);
        iv = setInterval(() => self.postMessage('tick'), 16);
      } else if (e.data === 'stop') {
        clearInterval(iv); iv = null;
      }
    };
  `], { type: 'application/javascript' });
  const animWorker = new Worker(URL.createObjectURL(workerBlob));
  animWorker.onmessage = function() {
    if (paused || stopped) { animWorker.postMessage('stop'); return; }
    const t = Math.min((performance.now() - animStart) / animDuration, 1);
    const x = startPos.x + (endPos.x - startPos.x) * t;
    const y = startPos.y + (endPos.y - startPos.y) * t;
    wrap.style.transform = `translate(${x}px,${y}px)`;
    if (t >= 1) { stopped = true; animWorker.postMessage('stop'); }
  };

  function animate() {
    animWorker.postMessage('start');
  }

  function doPause() {
    if(stopped)return;
    if(!paused) {
      clearAll();
      const m=wrap.style.transform.match(/translate\(([^,]+)px,\s*([^)]+)px\)/);
      if(m){pausedX=parseFloat(m[1]);pausedY=parseFloat(m[2]);}
      paused=true;
    } else {
      const s=resolve();
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
    lastResolved=null; // reset so next cue picks up fresh settings
    wrap.style.transition='opacity 0.5s'; wrap.style.opacity='0';
    setTimeout(()=>{
      wrap.style.transition=''; wrap.style.opacity='1';
      wrap.style.transform='translate(0px,100vh)';
      content.textContent=''; if(tag)tag.textContent='';
    },520);
  }

  function handleMsg(msg) {
    if (!msg) return;
    if(msg.type==='cue') {
      if (msg.resolved) lastResolved = msg.resolved;
      // If text content is embedded in the cue message, use it directly
      if (msg.textContent !== undefined) {
        // Ensure texts array has a slot for this index with the content
        if (!texts[msg.idx]) texts[msg.idx] = {};
        texts[msg.idx].content = msg.textContent;
      }
      // Also sync full texts from local/Firebase in background
      const local = getT();
      if (local.length > 0) {
        texts = local;
        startText(msg.idx);
      } else if (msg.textContent !== undefined) {
        // We have the content embedded — start immediately
        startText(msg.idx);
        // Fetch full texts in background for subsequent cues
        if (window.__fb) {
          window.__fb.fbGetTexts(S).then(fbTexts => {
            if (fbTexts && fbTexts.length > 0) {
              texts = fbTexts;
              localStorage.setItem(S+'texts', JSON.stringify(texts));
            }
          }).catch(()=>{});
        }
      } else if (window.__fb) {
        window.__fb.fbGetTexts(S).then(fbTexts => {
          if (fbTexts && fbTexts.length > 0) {
            texts = fbTexts;
            localStorage.setItem(S+'texts', JSON.stringify(texts));
          }
          startText(msg.idx);
        }).catch(() => startText(msg.idx));
      } else {
        startText(msg.idx);
      }
    }
    if(msg.type==='pause')  { doPause(); }
    if(msg.type==='resume') { if(paused) doPause(); }
    if(msg.type==='stop')   { doStop(); }
    if(msg.type==='texts' && msg.data) {
      texts = msg.data;
      localStorage.setItem(S+'texts', JSON.stringify(texts));
    }

  }

  // Same-device sync via localStorage
  window.addEventListener('storage', e => {
    if(e.key===S+'texts') texts=JSON.parse(e.newValue||'[]');
    if(e.key===S+'msg') { try { handleMsg(JSON.parse(e.newValue||'{}')); } catch(e){} }
  });

  // Cross-device sync via Firebase
  // Wait for firebase-sync.js to be ready then start listening
  function startFirebaseListener() {
    if (window.__fb) {
      // Fetch latest texts from Firebase on load
      window.__fb.fbGetTexts(S).then(fbTexts => {
        if (fbTexts && fbTexts.length > 0) {
          texts = fbTexts;
          localStorage.setItem(S+'texts', JSON.stringify(texts));
        }
      });

      // Listen for cue messages
      window.__fb.fbListen(S, handleMsg);
    } else {
      setTimeout(startFirebaseListener, 200);
    }
  }
  startFirebaseListener();

  document.addEventListener('keydown', e => {
    if(e.key==='f'||e.key==='F'){
      if(!document.fullscreenElement) document.documentElement.requestFullscreen().catch(()=>{});
      else document.exitFullscreen();
    }
  });


  texts=getT();
  document.body.style.background = opts.defaultBg;
  if(stage) stage.style.background = opts.defaultBg;
}
