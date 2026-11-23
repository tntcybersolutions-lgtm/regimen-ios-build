/* C3 module: foodlog. Photo and voice meal logging, native to the food screen.
   One tap: photograph the plate or say the meal, check the read, log it. The read
   rides the app's own AI service (photoRead's sibling: askModel, kind 'scan', the
   3-a-day free scan quota and Pro apply the same), matches every food against the
   app's own foodSearch, and logs through the app's own h.logFood with one undo. */
(function(){
  'use strict';
  var C3 = window.C3; if(!C3) return;
  var h = C3.h, esc = h.esc, fmt = h.fmt;

  function safe(fn, dflt){ try{ var v = fn(); return v === undefined ? dflt : v; }catch(e){ return dflt; } }
  function g1(v){ v = Math.round((+v || 0) * 10) / 10; return String(v).replace(/\.0$/, ''); }

  /* voice is wired here, not through the shell's voiceListen: the shell ships its
     listener behind an early "Type it in." return, so its own check always says no */
  function hearAvailable(){
    if(typeof RUN !== 'undefined' && RUN.speech && RUN.speech.available && safe(function(){ return RUN.speech.available(); }, false)) return {ok:true, how:'native'};
    if(typeof window !== 'undefined' && (window.SpeechRecognition || window.webkitSpeechRecognition)) return {ok:true, how:'browser'};
    return {ok:false, reason:'This browser cannot listen. Type it instead.'};
  }
  function hear(onText, onError){
    var av = hearAvailable();
    if(!av.ok){ if(onError) onError(av.reason); return null; }
    if(av.how === 'native'){
      RUN.speech.listen().then(function(r){ if(r && r.text) onText(r.text); else if(onError) onError(r && r.reason || 'Nothing was heard.'); });
      return {stop:function(){ safe(function(){ RUN.speech.stop(); }); }};
    }
    var R = window.SpeechRecognition || window.webkitSpeechRecognition;
    var rec = new R; rec.lang = 'en-US'; rec.interimResults = false; rec.maxAlternatives = 1;
    rec.onresult = function(e){ onText(e.results[0][0].transcript); };
    rec.onerror = function(e){ if(onError) onError(e && e.error === 'not-allowed' ? 'Microphone access was refused.' : 'Nothing was heard.'); };
    try{ rec.start(); }catch(e){ if(onError) onError('Could not start listening.'); return null; }
    return {stop:function(){ try{ rec.stop(); }catch(e){} }};
  }

  function photoOK(){ return safe(function(){ return !!photoAvailable().ok; }, false); }
  function available(){ return {photo: photoOK(), voice: hearAvailable().ok}; }

  var VOICE_RULES = 'You are reading one spoken meal description for a food log.\n' +
    'Return ONLY a JSON array. Each element: {"name":string,"grams":number,"confident":boolean}.\n' +
    'RULES:\n' +
    '- Name each food plainly, as it would be searched: "grilled chicken breast", not "poultry".\n' +
    '- grams is your best estimate of the EDIBLE portion. Use what they said; when they gave no amount, a typical serving.\n' +
    '- confident:false for anything vague, or an amount you had to guess.\n' +
    '- If nothing sounds like food, return [].\n' +
    '- No prose, no code fence, no commentary. The array only.';

  /* the same matching photoRead does: top search hit, the next three as alternates */
  function matchItems(arr){
    var items = [], unmatched = [];
    (arr || []).forEach(function(x){
      var nm = String(x && x.name || '').trim();
      var g = Math.round(Math.max(1, Math.min(2000, +(x && x.grams) || 0)));
      if(!nm || !g) return;
      var hits = safe(function(){ return foodSearch(nm, 4); }, []) || [];
      if(!hits.length){ unmatched.push(nm); return; }
      items.push({food:hits[0], grams:g, said:nm, confident: x.confident !== false, alternatives:hits.slice(1, 4)});
    });
    return {items:items, unmatched:unmatched};
  }

  /* the offline brain's share of this sheet: when the model cannot answer (a dead-zone gym, a key
     problem), the built-in table still reads what they typed or said. Plain pieces, top search hit,
     the food's own serving as the grams, every line flagged - the draft's teaching line already
     tells them to check the amounts. Returns null when nothing matches, so the honest error stands. */
  function localRead(text){
    var pieces = String(text || '').toLowerCase().split(/,| and | with | plus /).map(function(s){ return s.trim(); }).filter(Boolean);
    var items = [], unmatched = [];
    pieces.forEach(function(p){
      var n = 1;
      var m = /^(\d+(?:\.\d+)?)\s*x?\s+(.+)$/.exec(p);   /* "2 eggs", "1.5 scoops whey" */
      if(m){ n = Math.max(0.25, Math.min(12, +m[1])); p = m[2]; }
      p = p.replace(/^(some|extra|a|an|the|my)\s+/, '').trim();
      if(!p) return;
      var hits = safe(function(){ return foodSearch(p, 4); }, []) || [];
      if(!hits.length){ var st = p.split(' ').map(function(w){ return w.replace(/(e)?s$/, ''); }).join(' '); if(st !== p) hits = safe(function(){ return foodSearch(st, 4); }, []) || []; }   /* speech plurals: "eggs", "scoops whey" */
      if(!hits.length){ unmatched.push(p); return; }
      var fd = hits[0], serv = fd && fd.serv && fd.serv[0];
      var g = Math.round((serv ? serv[1] : 100) * n);
      items.push({food:fd, grams:Math.max(1, Math.min(2000, g)), said:p, confident:false, alternatives:hits.slice(1, 4)});
    });
    if(!items.length) return null;
    return {ok:true, items:items, unmatched:unmatched, note:null};
  }

  function voiceRead(text, token, ctx){
    return safe(function(){
      return askModel(VOICE_RULES + '\n\nTHEY SAID: "' + String(text).replace(/"/g, '') + '"', {kind:'scan'});
    }, null).then(function(r){
      if(!r || !r.ok){ var L = localRead(text); if(L) return L; return {ok:false, reason:(r && r.error) || 'The read did not come back.'}; }
      var arr;
      try{ var m = /\[[\s\S]*\]/.exec(String(r.text || '')); arr = JSON.parse(m ? m[0] : String(r.text)); }
      catch(e){ return {ok:false, reason:'The answer did not come back as data.'}; }
      if(!Array.isArray(arr)) return {ok:false, reason:'The answer did not come back as a list.'};
      if(!arr.length) return {ok:true, items:[], unmatched:[], note:'No food in that. Say the foods and the amounts.'};
      var M = matchItems(arr);
      M.ok = true;
      return M;
    });
  }

  /* ---------- state ---------- */
  function st(ctx){ return ctx.state.foodlog || null; }
  function set(ctx, patch){ var cur = st(ctx) || {}; for(var k in patch) cur[k] = patch[k]; ctx.set({foodlog: cur}); }
  function clear(ctx){ ctx.set({foodlog: null}); }

  var seq = 0;   /* a stale read never lands over a newer one */
  var listening = null;

  function startPhoto(root, ctx){
    var inp = root.ownerDocument.createElement('input');
    inp.type = 'file'; inp.accept = 'image/*';
    try{ inp.setAttribute('capture', 'environment'); }catch(e){}
    inp.style.display = 'none';
    root.appendChild(inp);
    inp.addEventListener('change', function(){
      var f = inp.files && inp.files[0];
      try{ inp.remove(); }catch(e){}
      if(!f) return;
      var tk = ++seq;
      set(ctx, {phase:'reading', src:'photo', items:null, error:null});
      safe(function(){ return shrinkImage(f, 1600); }, null).then(function(url){
        if(!url){ if(tk === seq) set(ctx, {phase:'draft', items:[], unmatched:[], error:'That image could not be read.'}); return; }
        return photoRead(url).then(function(r){
          if(tk !== seq) return;
          if(!r || !r.ok){ set(ctx, {phase:'draft', src:'photo', items:[], unmatched:[], error:(r && r.reason) || 'The read did not come back.'}); return; }
          set(ctx, {phase:'draft', src:'photo', items:r.items || [], unmatched:r.unmatched || [], note:r.note || null, error:null});
        });
      });
    });
    inp.click();
  }

  function startVoice(ctx){
    var tk = ++seq;
    set(ctx, {phase:'listening', src:'voice', items:null, error:null});
    listening = hear(function(text){
      listening = null;
      if(tk !== seq) return;
      set(ctx, {phase:'reading', src:'voice', transcript:text});
      voiceRead(text, tk, ctx).then(function(r){
        if(tk !== seq) return;
        if(!r || !r.ok){ set(ctx, {phase:'draft', src:'voice', transcript:text, items:[], unmatched:[], error:(r && r.reason) || 'The read did not come back.'}); return; }
        set(ctx, {phase:'draft', src:'voice', transcript:text, items:r.items || [], unmatched:r.unmatched || [], note:r.note || null, error:null});
      });
    }, function(err){
      listening = null;
      if(tk !== seq) return;
      set(ctx, {phase:'draft', src:'voice', items:[], unmatched:[], error:err || 'Nothing was heard.'});
    });
    if(!listening) set(ctx, {phase:'draft', src:'voice', items:[], unmatched:[], error:'This browser cannot listen. Type it instead.'});
  }

  function confirm(ctx){
    var s = st(ctx); if(!s || !s.items || !s.items.length) return;
    var done = s.items.map(function(it){ return safe(function(){ return h.logFood(it.food.id, +it.grams > 0 ? +it.grams : 100, true); }, null); }).filter(Boolean);
    clear(ctx);
    if(!done.length) return;
    var p = Math.round(done.reduce(function(a, e){ return a + (+e.p || 0); }, 0));
    safe(function(){
      offerUndo('<b>' + done.length + ' food' + (done.length === 1 ? '' : 's') + '</b> logged · ' + p + ' g protein.', function(){
        done.forEach(function(e){ foodDelete(e.at); });
      });
    });
    /* the pacing line: where this leaves the day */
    var key = safe(function(){ return dkey(Date.now()); }, ''), t = safe(function(){ return dayTotals(key); }, null);
    var pT = safe(function(){ return proteinTarget(); }, null);
    if(t && pT > 0){
      var left = Math.round(pT - t.p);
      safe(function(){ yd.toast('Protein is ' + Math.round(t.p) + ' of ' + Math.round(pT) + ' g' + (left <= 0 ? ' - done for today.' : left <= 30 ? ' - one more snack closes it.' : '.')); });
    }
    /* mirror into the coach feed: "Photo log: chicken breast, rice, olive oil - 710 kcal, 63 g protein." */
    safe(function(){
      ALL.coach = ALL.coach || {}; ALL.coach.log = ALL.coach.log || [];
      var names = s.items.map(function(it){ return String(it.food.n).toLowerCase(); });
      var shown = names.slice(0, 3).join(', ') + (names.length > 3 ? ' +' + (names.length - 3) + ' more' : '');
      var kcal = Math.round(done.reduce(function(a, e){ return a + (+e.kcal || 0); }, 0));
      ALL.coach.log.push({
        id: 'fl' + Math.random().toString(36).slice(2, 10),
        at: Date.now(),
        coach: ALL.coach.lead || 'dakota-jane',
        kind: 'meal',
        key: 'meal-log-' + done[0].at,
        text: (s.src === 'voice' ? 'Voice log: ' : 'Photo log: ') + shown + ' - ' + kcal + ' kcal, ' + p + ' g protein.',
        go: {label:'Open food', pane:'food'},
        up: null, acted: null, ai: false
      });
      save();
    });
    safe(function(){ drawAll(); });
    safe(function(){ appBuzz(18); });
    C3.refresh();
  }

  /* ---------- the draft card ---------- */
  function ico(d, size, sw){ return '<svg class="c3-ic" width="' + size + '" height="' + size + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="' + (sw || 2) + '" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">' + d + '</svg>'; }
  var IC_X = '<path d="M6 6l12 12"></path><path d="M18 6L6 18"></path>';

  function render(ctx){
    var s = st(ctx); if(!s) return '';
    if(s.phase === 'listening'){
      return '<section class="fdl" aria-label="Say it" aria-live="polite">' +
        '<div class="fdl-head"><b>Listening</b><span class="fdl-sub">Name the foods and the amounts.</span></div>' +
        '<div class="fdl-acts"><button type="button" class="c3-btn-quiet" data-act="fl-done" data-key="fl-done"><span>Done</span></button>' +
        '<button type="button" class="c3-btn-quiet bare" data-act="fl-cancel" data-key="fl-cancel"><span>Cancel</span></button></div></section>';
    }
    if(s.phase === 'reading'){
      return '<section class="fdl" aria-label="Reading" aria-live="polite">' +
        '<div class="fdl-head"><b>' + (s.src === 'photo' ? 'Reading your plate' : 'Plating that up') + '</b><span class="fdl-sub">' + (s.src === 'voice' && s.transcript ? esc(s.transcript) : 'A few seconds.') + '</span></div></section>';
    }
    /* draft */
    var items = s.items || [], out = '<section class="fdl" aria-label="' + (s.src === 'photo' ? 'What I saw' : 'What I heard') + '">';
    out += '<div class="fdl-head"><b>' + (s.src === 'photo' ? 'What I saw' : 'What I heard') + '</b>' +
      '<span class="fdl-sub">' + (s.src === 'voice' && s.transcript ? esc(s.transcript) : 'Check it before it logs.') + '</span></div>';
    if(s.error) out += '<p class="fdl-err">' + esc(s.error) + '</p>';
    if(s.note) out += '<p class="fdl-note">' + esc(s.note) + '</p>';
    if(items.length){
      var tk = 0, tp = 0;
      out += '<ul class="fdl-list">';
      items.forEach(function(it, i){
        var sc = safe(function(){ return scaleFood(it.food, +it.grams > 0 ? +it.grams : 100); }, null) || {kcal:0, p:0};
        tk += sc.kcal; tp += sc.p;
        out += '<li class="fdl-row' + (it.confident ? '' : ' unsure') + '">' +
          '<div class="fdl-n"><b>' + esc(it.food.n) + '</b>' +
            (it.said && it.said.toLowerCase() !== String(it.food.n).toLowerCase() ? '<small>heard "' + esc(it.said) + '"</small>' : '') +
            (it.confident ? '' : '<small class="fdl-check">worth a check</small>') + '</div>' +
          '<div class="fdl-g"><input type="number" inputmode="decimal" min="1" max="2000" step="1" value="' + g1(it.grams) + '" data-chg="fl-gram" data-i="' + i + '" aria-label="Grams of ' + esc(it.food.n) + '"><span>g</span></div>' +
          '<div class="fdl-k"><b class="c3-num">' + fmt.n(sc.kcal) + '</b><small>kcal · ' + g1(sc.p) + ' g protein</small></div>' +
          '<button type="button" class="fdl-x" data-act="fl-drop" data-i="' + i + '" data-key="fl-drop-' + i + '" aria-label="Remove ' + esc(it.food.n) + '">' + ico(IC_X, 15, 2.6) + '</button>' +
          (it.alternatives && it.alternatives.length ?
            '<div class="fdl-alt"><select data-chg="fl-alt" data-i="' + i + '" aria-label="Swap ' + esc(it.food.n) + ' for a match that fits better">' +
              '<option value="">Swap: ' + esc(it.food.n) + '</option>' +
              it.alternatives.map(function(a, j){ return '<option value="' + j + '">' + esc(a.n) + '</option>'; }).join('') + '</select></div>' : '') +
          '</li>';
      });
      out += '</ul><div class="fdl-tot"><span>Altogether</span><b class="c3-num">' + fmt.n(Math.round(tk)) + ' kcal</b><span>' + g1(Math.round(tp * 10) / 10) + ' g protein</span></div>';
      if(items.some(function(it){ return !it.confident; })) out += '<p class="fdl-note">Flagged amounts are my best guess - a scale beats me once.</p>';
    }
    if(s.unmatched && s.unmatched.length) out += '<p class="fdl-note">Could not place ' + esc(s.unmatched.join(', ')) + ' - search for it after.</p>';
    out += '<div class="fdl-acts">' +
      (items.length ? '<button type="button" class="c3-btn-primary fdl-log" data-act="fl-confirm" data-key="fl-confirm"><span class="l">Log ' + (items.length === 1 ? 'it' : 'all ' + items.length) + '</span><span class="r">' + h.icon('check', 24, 3) + '</span></button>' : '') +
      '<button type="button" class="c3-btn-quiet bare" data-act="fl-cancel" data-key="fl-cancel"><span>' + (items.length ? 'Not this' : 'Close') + '</span></button>' +
      (s.src === 'photo' ? '<button type="button" class="c3-btn-quiet bare" data-act="fl-again" data-key="fl-again"><span>Retake</span></button>' : '<button type="button" class="c3-btn-quiet bare" data-act="fl-again" data-key="fl-again"><span>Say it again</span></button>') +
      '</div></section>';
    return out;
  }

  /* ---------- actions ---------- */
  function act(a, b, ctx, root){
    if(a === 'photo' && photoOK()){ startPhoto(root, ctx); return true; }
    if(a === 'voice'){ startVoice(ctx); return true; }
    if(a === 'fl-done'){ if(listening){ var l = listening; listening = null; l.stop(); } return true; }
    if(a === 'fl-cancel'){ if(listening){ var l2 = listening; listening = null; l2.stop(); } seq++; clear(ctx); return true; }
    if(a === 'fl-again'){ var s = st(ctx), kind = s && s.src === 'voice' ? 'voice' : 'photo'; if(kind === 'voice') startVoice(ctx); else startPhoto(root, ctx); return true; }
    if(a === 'fl-confirm'){ confirm(ctx); return true; }
    if(a === 'fl-drop'){ var s2 = st(ctx); if(s2 && s2.items){ s2.items.splice(+b.getAttribute('data-i'), 1); set(ctx, {items: s2.items.slice()}); } return true; }
    return false;
  }

  function chg(k, el, ctx){
    var s = st(ctx); if(!s || !s.items) return true;
    var i = +el.getAttribute('data-i');
    if(k === 'fl-gram'){ var it = s.items[i]; if(it){ it.grams = Math.round(Math.max(1, Math.min(2000, +el.value || it.grams))); set(ctx, {items: s.items.slice()}); } return true; }
    if(k === 'fl-alt'){ var it2 = s.items[i], j = el.value === '' ? -1 : +el.value; if(it2 && j >= 0 && it2.alternatives[j]){ var pick = it2.alternatives[j]; it2.alternatives.splice(j, 1); it2.alternatives.unshift(it2.food); it2.food = pick; set(ctx, {items: s.items.slice()}); } return true; }
    return true;
  }

  C3.foodlog = {available: available, render: render, act: act, chg: chg, start: function(kind, root, ctx){ if(kind === 'voice') startVoice(ctx); else startPhoto(root, ctx); }};
  if(C3.yd && C3.yd.drain) C3.yd.drain();
})();
