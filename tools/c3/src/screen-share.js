/* C3 screen: share. The share card (the old "Share it" card on the Crew pane: renderShareOpts,
   drawShareCard, renderSocial, the export approval and the recipe links).
   The card itself first, drawn on its own canvas and shown
   here as the picture it will be. One control shares it (the phone's share sheet, or a PNG).
   Under it, quiet: which card, which size, the background, what is on it, the caption, the
   social links, and (signed in) the approval and the recipe links.
   Nothing here posts anywhere: it is an export, as it always was. */
(function(){
  'use strict';
  var C3 = window.C3; if(!C3) return;
  (C3.ydq = C3.ydq || []).push(function(yd){
    var h = C3.h, esc = h.esc, safe = yd.safe;

    /* ---------- the picture of the card ----------
       drawShareCard() paints #shareCard (1080 wide, in the old pane, never on screen now).
       It is turned into one blob URL per distinct card; some cards load art and finish late,
       so the canvas is read again a moment after. */
    var CARD = {url:'', key:'', n:0, size:0, w:1080, h:1080, hash:'', blob:null, pending:false, error:''};
    function cardKey(){ return safe(function(){ return JSON.stringify([SHARE.kind, SHARE.size, !!SHARE.alpha, shareFields(), unitSys(), displayName(), ALL.updatedAt || 0]); }, ''); }
    /* The export and its caption must honor the same field switches. Legacy canvas
       renderers ignored several off switches and fell back to a Progress caption. */
    function cardRows(){
      var k=SHARE.kind,F=shareFields(),rows=[],st=safe(function(){return stats();},{});
      var add=function(on,label,value){if(on)rows.push([label,String(value)]);};
      if(k==='progress'){
        var L=safe(function(){return levelOf(st);},{lvl:1});
        add(F.level,'Level / week',L.lvl+' / '+Math.max(1,Math.round(st.weeks||0)));
        add(F.sessions,'Sessions',st.sessions||0);add(F.adherence,'Adherence',fmt(st.adherence||0,0)+'%');
        add(F.prs,'Personal bests',st.prs||0);add(F.doses,'Doses logged',st.doses||0);
        if(F.weight && st.lost>0)add(true,'Weight change',h.fmt.weight(st.lost,1)+' down');
      }else if(k==='lift'){
        var lift=safe(function(){return bestLift();},null);
        if(!lift)return {title:'No lift logged yet',rows:[],empty:'Log a working set to start your record history.',go:'train'};
        add(F.lift,'Lift',lift.n);add(F.lift,'Load / reps',h.fmt.weight(lift.lb,1)+' x '+lift.reps);
        add(F.e1rm,'Estimated single',h.fmt.weight(lift.e1,1));add(F.date,'Recorded',new Date(lift.at).toLocaleDateString());
      }else if(k==='muscle'){
        var V=safe(function(){return muscleSets(7);},{});
        if(F.sets)(typeof MUSCLES!=='undefined'?MUSCLES:[]).forEach(function(m){var v=V[m]||{};add(true,(MUSCLE_LABEL||{})[m]||m,Math.round((v.direct||0)+(v.indirect||0)*(typeof SEC_CREDIT!=='undefined'?SEC_CREDIT:.5))+' sets');});
      }else if(k==='week'){
        var W=safe(function(){return weekStreak();},{weeks:0,goal:0,rows:[]});
        add(F.weeks,'Weeks at your goal',W.weeks||0);
        if(F.weeks)add(true,'Weekly goal',(W.goal||0)+' days');
        if(F.bars)(W.rows||[]).slice(0,12).forEach(function(r,i){add(true,'Week '+(i+1),(r.n||0)+' / '+(r.goal||W.goal||0)+' days');});
      }else if(k==='recap'){

        var sessions=safe(function(){return Object.keys(ALL.workLog||{}).filter(function(d){var age=Date.now()-Date.parse(d+'T12:00:00');var l=ALL.workLog[d];return l&&l.done&&l.done.length&&d<=dkey(Date.now())&&age<=7*864e5;}).length;},0);add(F.sessions,'Sessions this week',sessions);
        if(F.days){var n=safe(function(){return Object.keys(TEAM.days||{}).filter(function(d){var age=Date.now()-Date.parse(d+'T12:00:00');return TEAM.days[d]==='complete'&&d<=dkey(Date.now())&&age<=7*864e5;}).length;},0);add(true,'Complete days',n);}
        var one=safe(function(){var a=TEAM.cur.synthesis.action;return (TEAM_WORDS[a]||[a])[0];},'');add(F.team&&one,'The team\'s one thing',one);
        if(F.weight){var weights=(ALL.weights||[]).filter(function(w){return Number.isFinite(+w.lb)&&+w.lb>0&&Number.isFinite(+w.at)&&Date.now()-w.at>=0&&Date.now()-w.at<=7*864e5;}).sort(function(a,b){return a.at-b.at;});if(weights.length>=2)add(true,'Weight change',h.fmt.weight(weights[weights.length-1].lb-weights[0].lb,1));}
      }else return null;
      return {title:({progress:'Progress',lift:'Personal record',muscle:'Muscles this week',week:'Your weekly goal',recap:'Your weekly recap'})[k],rows:rows,empty:rows.length?'':'No details selected. Turn on a field to include it.'};
    }
    function cardCaption(){
      var M=cardRows();if(M)return 'formed fit. '+(M.rows.length?M.rows.map(function(r){return r[0]+': '+r[1];}).join('. ')+'.':M.title+'. '+M.empty);
      if(SHARE.kind==='milestone'){var m=safe(function(){return milestoneLatest();},null);return m?'formed fit. '+m.n+'. '+m.line+(shareFields().reactions?'. '+(m.reactions||[]).map(function(r){return r.text;}).join(' '):''):'No milestone yet on formed fit. Keep logging your own activity.';}
      if(SHARE.kind==='scorecard'){var s=safe(function(){return scorecardCurrent();},{}),f=shareFields(),a=[];if(f.numbers)a.push('Sessions '+(s.sessions||0)+' of '+(s.planned||0)+', protein days '+(s.prot||0)+', water days '+(s.water||0)+', step days '+(s.steps||0));if(f.line&&(s.words||s.line))a.push(s.words||s.line);if(f.numbers&&f.trend&&s.trend!=null)a.push('Weight trend '+s.trend+' '+wU()+'/week');return 'formed fit scorecard. '+(a.join('. ')||'No details selected.') ;}
      if(SHARE.kind==='meal'&&!safe(function(){return shareMeal();},null))return 'No meal planned yet on formed fit. Build a meal plan to make a meal card.';
      return shareText();
    }
    function cardPayload(){var p=shareCardPayload();p.caption=cardCaption();p.template_version=2;return p;}
    function paintCard(){
      var M=cardRows();if(!M){drawShareCard();return;}
      var cv=document.getElementById('shareCard'),size=SHARE_SIZES[SHARE.size]||SHARE_SIZES.square;
      if(!cv)throw new Error('Share canvas missing');cv.width=size.w;cv.height=size.h;
      var g=cv.getContext('2d'),W=size.w,H=size.h,a=!!SHARE.alpha;
      shareBg(g,W,H,a);shareHead(g,W,M.title,a);
      var rows=M.rows.length?M.rows:[['',M.empty]],top=H>1400?320:260,cols=rows.length>8?2:1,count=Math.ceil(rows.length/cols),gap=Math.min(140,(H-top-150)/Math.max(1,count)),cellW=(W-140)/cols;
      rows.forEach(function(r,i){var y=top+(i%count)*gap,x=70+Math.floor(i/count)*cellW;g.textAlign='left';g.fillStyle=cardInk().muted;g.font='500 24px Barlow, sans-serif';haloText(g,r[0],x,y,a);g.fillStyle=cardInk().ink;g.font='600 '+(rows.length>8?29:36)+'px Barlow, sans-serif';var words=String(r[1]).split(' '),line='',yy=y+38;words.forEach(function(w){var t=line?line+' '+w:w;if(g.measureText(t).width>cellW-28&&line){haloText(g,line,x,yy,a);yy+=38;line=w;}else line=t;});haloText(g,line,x,yy,a);});
      shareFoot(g,W,H,a);
    }

    function snap(force){
      var key = cardKey();
      if(!force && key === CARD.key && (CARD.url || CARD.pending || CARD.error)) return;
      CARD.key = key; CARD.fresh = true; CARD.pending = true; CARD.error = ''; CARD.blob = null; CARD.hash = '';
      if(CARD.url){ URL.revokeObjectURL(CARD.url); CARD.url = ''; }
      var mine = ++CARD.n;
      var fail = function(){ if(mine !== CARD.n) return; CARD.pending = false; CARD.error = 'The card could not be drawn. Try again or choose a different card.'; if(C3.current === 'share') C3.refresh(); };
      var take = function(){
        if(mine !== CARD.n) return;
        try{
          paintCard();
          var cv = document.getElementById('shareCard'); if(!cv || !cv.toBlob){ fail(); return; }
          var w = cv.width, hh = cv.height;
          cv.toBlob(function(b){
            if(mine !== CARD.n) return; if(!b){ fail(); return; }
            if(!CARD.fresh && b.size === CARD.size && CARD.url && w === CARD.w && hh === CARD.h) return;
            CARD.fresh = false; CARD.pending = false; CARD.error = ''; CARD.blob = b;
            var old = CARD.url;
            CARD.url = URL.createObjectURL(b); CARD.size = b.size; CARD.w = w; CARD.h = hh;
            if(old) setTimeout(function(){ try{ URL.revokeObjectURL(old); }catch(e){} }, 3000);
            if(C3.current === 'share') C3.render();
          }, 'image/png');
        }catch(e){ console.error('[c3] share card', e); fail(); }
      };
      take(); setTimeout(take, 700);
      /* the approval names the exact card: work out its hash for the screen */
      safe(function(){ Promise.resolve(shareHash(cardPayload())).then(function(x){ if(mine === CARD.n){ CARD.hash = x || ''; if(C3.current === 'share') C3.refresh(); } }, function(){}); });
    }
    function fileName(){ return 'formed-fit-' + SHARE.kind + '-' + SHARE.size + (SHARE.alpha ? '-clear' : '') + '.png'; }
    function blob(){ return Promise.resolve(!CARD.pending ? CARD.blob : null); }
    function download(b){
      var url = URL.createObjectURL(b), a = document.createElement('a');
      a.href = url; a.download = fileName(); a.style.display = 'none'; document.body.appendChild(a); a.click(); a.remove();
      setTimeout(function(){ try{ URL.revokeObjectURL(url); }catch(e){} }, 4000);
    }
    /* SHARE: the phone's own sheet with the picture and the caption; where there is none, the picture is saved */
    function shareCard(){
      blob().then(function(b){
        if(!b){ yd.toast('The card could not be made here.', 'bad'); return; }
        var file = safe(function(){ return new File([b], fileName(), {type:'image/png'}); }, null);
        if(file && navigator.share && navigator.canShare && safe(function(){ return navigator.canShare({files:[file]}); }, false)){
          Promise.resolve(navigator.share({text: cardCaption(), files:[file]})).then(function(){}, function(e){ if(!e || e.name !== 'AbortError'){ download(b); yd.toast('Saved as <b>' + esc(fileName()) + '</b>.'); } });
          return;
        }
        download(b); yd.toast('Saved as <b>' + esc(fileName()) + '</b>.');
      });
    }
    function copy(text, ok){
      try{ navigator.clipboard.writeText(text).then(function(){ yd.toast(ok); }, function(){ yd.toast('Copy is not available here.', 'bad'); }); }
      catch(e){ yd.toast('Copy is not available here.', 'bad'); }
    }
    function busyRecipes(on){ RSHARE.busy = !!on; C3.refresh(); }

    function approvalHTML(){
      if(!yd.signedIn()) return '';
      var a = SHARE_UIX.approval, covers = !!(a && CARD.hash && a.content_hash === CARD.hash && !a.revoked_at);
      return yd.sec('Approval', '<p class="sh-appr" data-covers="' + (covers ? '1' : '0') + '">' + (covers ? '<i></i><b>Approved for export</b><span>' + esc(safe(function(){ return agoWord(Date.parse(a.approved_at)); }, '')) + '</span>' : '<b>Not approved</b>' + (a && !a.revoked_at ? '<span>Changed since the last approval.</span>' : '')) + '</p>' +
        '<div class="yd-acts">' + (covers ? yd.btn('revoke', 'Revoke', {pink:true, icon:'x'}) : yd.btn('approve', 'Approve this exact card', {icon:'check', disabled: !!SHARE_UIX.busy || CARD.pending || !CARD.blob})) + '</div>' +
        (SHARE_UIX.err ? yd.note(esc(SHARE_UIX.err), 'bad') : '') +
        '<p class="yd-src">An approval names this card’s hash' + (CARD.hash ? ' (' + esc(CARD.hash.slice(0, 12)) + ')' : '') + '. Change the card and it no longer covers it.</p>', {id:'approval'});
    }
    function recipesHTML(){
      if(SHARE.kind !== 'meal') return '';
      var signed = yd.signedIn(), mine = safe(function(){ return recipeStore().filter(function(r){ return (r.items || []).length; }); }, []), made = RSHARE.made, links = RSHARE.links || [];
      return yd.sec('Or send the recipe itself',
        (!signed ? yd.empty('Sign in to make a link.') : !mine.length ? yd.empty('Save a recipe under Food and it shows here.')
          : '<div class="yd-seg sh-recipes">' + mine.slice(0, 12).map(function(r){ return yd.btn('rshare', r.name || 'Recipe', {v: r.id, icon: 'link', disabled: !!RSHARE.busy}); }).join('') + '</div>') +
        (RSHARE.err ? yd.note(esc(RSHARE.err), 'bad') : '') +
        (made ? '<div class="sh-made"><p class="yd-note good"><b>' + esc(made.title || 'Recipe') + '</b>: link made, good for ' + (made.expires_at ? Math.max(1, Math.round((Date.parse(made.expires_at) - Date.now()) / 86400000)) : 90) + ' days.</p>' +
            '<p class="sh-url c3-num">' + esc(recipeLinkUrl(made.token)) + '</p><div class="yd-acts">' + yd.btn('rcopy', 'Copy link', {icon:'copy'}) + yd.btn('rsend', 'Share', {icon:'share'}) + '</div>' +
            yd.note('In it: ' + esc((made.fields_in || []).join(', ')) + '. Not in it: ' + esc((made.fields_out || []).join(', ')) + '.') + '</div>' : '') +
        (links.length ? '<ul class="yd-list">' + links.slice(0, 8).map(function(l){ return '<li><div class="yd-row"><span class="l">' + esc(l.title || 'Recipe') + '<small>' + (l.live ? (l.views | 0) + ' opened · ' + (l.adaptations | 0) + ' adapted' : (l.revoked_at ? 'revoked' : 'expired')) + '</small></span>' +
            (l.live ? yd.btn('rrevoke', 'Revoke', {v: l.id, pink: true, disabled: !!RSHARE.busy}) : '') + '</div></li>'; }).join('') + '</ul>' : '') +
        '<p class="yd-src">A friend opens it in the app and can adapt it to their own targets. They never get your name, your targets or your account.</p>', {id:'recipes'});
    }

    yd.screen('share', {
      parent: 'crew', old: ['profile', 'youcrew'],
      enter: function(){ snap(false); },
      render: function(ctx){
        var kind = SHARE.kind, size = SHARE.size, F = shareFields(), defs = SHARE_FIELDS[kind] || [], S2 = SHARE_SIZES[size] || SHARE_SIZES.square, cap = safe(function(){ return cardCaption(); }, '');
        var kdef = SHARE_KINDS.filter(function(k){ return k[0] === kind; })[0] || SHARE_KINDS[0];
        var pic = '<section class="sh-card ' + esc(size) + '" aria-label="The card">' +
          (CARD.url ? '<img class="sh-img' + (SHARE.alpha ? ' clear' : '') + '" src="' + esc(CARD.url) + '" width="' + S2.w + '" height="' + S2.h + '" style="aspect-ratio:' + S2.w + ' / ' + S2.h + '" alt="' + esc('Your ' + kdef[1] + ' share card, ' + S2.n.toLowerCase() + '. ' + cap) + '">'
                    : '<div class="sh-wait" style="aspect-ratio:' + S2.w + ' / ' + S2.h + '" role="status">' + (CARD.error ? esc(CARD.error) + yd.btn('retry', 'Try again', {icon:'refresh'}) : 'Drawing your card...') + '</div>') +
        '</section>';
        var act = '<section class="sh-act" aria-label="Share">' + yd.primary('send', 'Share', '<span>' + esc(S2.n) + '</span><span>' + S2.w + ' × ' + S2.h + '</span>', {icon:'arrow', disabled: !CARD.url}) +
          '<div class="yd-acts">' + yd.btn('save', 'Save image', {icon:'down', disabled: !CARD.url}) + yd.btn('caption', 'Copy caption', {icon:'copy'}) + '</div>' +
          '<p class="sh-cap">' + esc(cap) + '</p></section>';
        var start = (kind === 'lift' && !safe(function(){ return bestLift(); }, null)) ? yd.btn('start', 'Log a working set', {v:'train',icon:'arrow'}) : (kind === 'meal' && !safe(function(){ return shareMeal(); }, null)) ? yd.btn('start', 'Build a meal plan', {v:'food',icon:'arrow'}) : (kind === 'milestone' && !safe(function(){ return milestoneLatest(); }, null)) ? yd.btn('start', 'See your wins', {v:'wins',icon:'arrow'}) : '';
        act += start ? '<div class="yd-acts">' + start + '</div>' : '';
        var opts = yd.sec('Which card', yd.seg('kind', SHARE_KINDS.map(function(k){ return [k[0], k[1]]; }), kind, {aria:'Which card', cls:'sh-kinds'}) + yd.note(esc(kdef[2])), {id:'kind'}) +
          yd.sec('Size', yd.seg('size', Object.keys(SHARE_SIZES).map(function(k){ return [k, SHARE_SIZES[k].n + ' ' + SHARE_SIZES[k].w + ' × ' + SHARE_SIZES[k].h]; }), size, {aria:'Size', cls:'wrap2'}) +
            '<div class="yd-list">' + yd.sw('alpha', !!SHARE.alpha, 'No background', 'A PNG with a clear background, to sit on your own picture.') + '</div>', {id:'size'}) +
          (defs.length ? yd.sec('On the card', '<div class="yd-list">' + defs.map(function(d){ return yd.sw('field', !!F[d[0]], d[1], d[3] ? 'Off unless you say.' : '', {v: d[0]}); }).join('') + '</div>', {id:'fields'}) : '');
        var soc = yd.sec('Post it yourself', '<div class="sh-soc">' + safe(function(){ return SOCIAL.map(function(s){
            return '<a class="sh-net" href="' + esc(s[0] === 'Facebook' ? 'https://www.facebook.com/' : s[1] + encodeURIComponent(cap)) + '" target="_blank" rel="noopener" aria-label="Open ' + esc(s[0]) + '" data-key="soc-' + esc(s[0]) + '">' + (C3.h.brand(s[0], 52) || '<svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true" focusable="false"><path d="' + esc(s[2]) + '" fill="currentColor"></path></svg>') + '</a>'; }).join(''); }, '') + '</div>' +
          '<p class="yd-src">Save the image and copy the caption before opening a site. Some sites accept the caption in a web link; Facebook, Instagram and TikTok require you to paste it yourself.</p>', {id:'social'});
        return '<div class="yd sh" data-kind="' + esc(kind) + '" data-size="' + esc(size) + '">' + yd.head({back:'crew', eyebrow:kdef[1] + ' · ' + S2.n, title:'Share', pk:'card'}) +
          '<p class="sh-guide">Choose a card and what it includes, check the preview, then save or share it. Nothing is posted automatically.</p><div class="yd-cols even sh-cols"><div class="yd-col sh-a">' + pic + act + '</div><div class="yd-col sh-b">' + yd.sec('A workout, posted', '<div class="yd-acts">' + yd.btn('post', 'Photos and clips with your numbers', {icon:'arrow'}) + '</div>' + yd.note('A picture or a video sized for TikTok, Reels and X, the session under it. And a live board for your stream.'), {id:'post'}) + opts + soc + approvalHTML() + recipesHTML() + '</div></div></div>';
      },
      wire: function(root, ctx){
        snap(false);
        if(SHARE.kind === 'meal' && RSHARE.links === null && yd.signedIn() && !ctx.state.asked){ ctx.state.asked = 1; safe(function(){ recipeLinksRefresh().then(function(){ C3.refresh(); }, function(){}); }); }
        var redraw = function(){ snap(true); try{ renderSocial(); }catch(e){} C3.render(); };
        yd.wire(root, ctx, {
          retry: function(){ snap(true); C3.render(); },
          send: function(){ shareCard(); },
          post: function(){ C3.go('post'); },
          start: function(v){ C3.go(v); },
          save: function(){ blob().then(function(b){ if(!b){ yd.toast('The card could not be made here.', 'bad'); return; } download(b); yd.toast('Saved as <b>' + esc(fileName()) + '</b>.'); }); },
          caption: function(){ copy(cardCaption(), 'Caption copied.'); },
          kind: function(v){ if(SHARE.kind === v) return; SHARE.kind = v; redraw(); },
          size: function(v){ if(SHARE.size === v) return; SHARE.size = v; redraw(); },
          alpha: function(){ SHARE.alpha = !SHARE.alpha; redraw(); },
          field: function(v){ var F = shareFields(); F[v] = !F[v]; redraw(); },
          approve: function(){
            SHARE_UIX.busy = true; SHARE_UIX.err = ''; C3.render();
            var p = cardPayload();
            Promise.resolve(shareHash(p)).then(function(hs){
              return CLOUD.shareDraftSave(Object.assign({}, p, hs ? {content_hash: hs} : {})).then(function(d){
                if(!d.ok){ SHARE_UIX.busy = false; SHARE_UIX.err = d.error; C3.refresh(); return; }
                return CLOUD.shareApprove(d.draft.id, d.draft.content_hash, 'export').then(function(a){
                  SHARE_UIX.busy = false;
                  if(!a.ok){ SHARE_UIX.err = a.error; C3.refresh(); return; }
                  SHARE_UIX.draft = d.draft; SHARE_UIX.approval = Object.assign({}, a.result, {id: a.result.approval_id});
                  CARD.hash = d.draft.content_hash || hs || CARD.hash;
                  yd.toast('<b>Approved for export</b>, this exact card.'); C3.refresh();
                });
              });
            }).catch(function(){ SHARE_UIX.busy = false; SHARE_UIX.err = 'The approval did not go through.'; C3.refresh(); });
          },
          revoke: function(){
            var a = SHARE_UIX.approval; if(!a) return;
            Promise.resolve(CLOUD.shareApprovalRevoke(a.id)).then(function(r){
              if(r.ok){ SHARE_UIX.approval = Object.assign({}, a, {revoked_at: new Date().toISOString()}); yd.toast(esc((r.result && r.result.note) || 'Revoked.')); } else yd.toast(esc(r.error || 'That did not work.'), 'bad');
              C3.refresh();
            }, function(){ C3.refresh(); });
          },
          rshare: function(id){
            var r = recipeStore().filter(function(x){ return x.id === id; })[0]; if(!r) return;
            RSHARE.err = ''; RSHARE.made = null; busyRecipes(true);
            var vid = r.server && r.server.versionId;
            var pub = vid ? Promise.resolve(vid) : Promise.resolve(CLOUD.recipePublish(recipePayload(r))).then(function(p){
              if(!p.ok) throw new Error(p.error || 'Could not publish the recipe first.');
              r.server = {version: p.result.version, versionId: p.result.version_id, at: Date.now()}; save(); return p.result.version_id; });
            pub.then(function(v){ return CLOUD.recipeShare(v, 90); }).then(function(made){
              if(!made.ok) throw new Error(made.error);
              RSHARE.made = made.result; return recipeLinksRefresh();
            }).catch(function(e){ RSHARE.err = (e && e.message) || 'Could not make the link.'; }).then(function(){ busyRecipes(false); });
          },
          rrevoke: function(id){
            busyRecipes(true);
            Promise.resolve(CLOUD.recipeShareRevoke(id)).then(function(r){
              if(!r.ok) RSHARE.err = r.error; else { if(RSHARE.made && RSHARE.made.id === id) RSHARE.made = null; yd.toast('Link revoked. Copies already adapted stay with whoever adapted them.'); }
              return recipeLinksRefresh();
            }).catch(function(){}).then(function(){ busyRecipes(false); });
          },
          rcopy: function(){ copy(recipeLinkUrl(RSHARE.made.token), 'Link copied.'); },
          rsend: function(){
            var url = recipeLinkUrl(RSHARE.made.token);
            try{ if(navigator.share){ Promise.resolve(navigator.share({title: RSHARE.made.title || 'A recipe', url: url})).then(function(){}, function(){}); return; } }catch(e){}
            copy(url, 'Link copied.');
          }
        });
      }
    });
  });
  if(C3.yd && C3.yd.drain) C3.yd.drain();
})();
