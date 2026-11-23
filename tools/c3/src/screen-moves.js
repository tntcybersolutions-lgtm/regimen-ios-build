/* C3 screen: moves (v320). Replaces the old Library page (p-moves: the list with collapsible chips and an opened
   row of cue paragraphs, the custom-movement form, the gyms card).
   Search, your lifts or everything, a muscle, the moves as photo rows; a tap shows how it is done (the C3 Watch
   layer: the move's own video, start and finish photos, steps and cues). The app's own pieces throughout:
   MOVEUI + moveSearch() (the same search, the same "my lifts" order: last trained first, this week's next),
   myMoves(), EXERCISES / grpLabel / EQ_LABEL, exImg() (the bundled photo library, loaded by exdbLoad()),
   the custom-movement form (renderMoveForm) and the gyms card (renderGyms) drawn by the app and mirrored. */
(function(){
  'use strict';
  var C3 = window.C3; if(!C3) return;
  (C3.ydq = C3.ydq || []).push(function(yd){
    var h = C3.h, esc = h.esc, safe = yd.safe;
    var MIR = {els: []}, PAGE = 30, typing = 0;

    function UI(){ return safe(function(){ return MOVEUI; }, {q:'', grp:'', eq:'', scope:'mine'}); }
    function groups(){ var seen = {}; return (safe(function(){ return EXERCISES; }, []) || []).map(function(e){ return e.grp; }).filter(function(g){ if(!g || seen[g]) return false; seen[g] = 1; return true; }); }
    function eqs(){ var seen = {}; return (safe(function(){ return EXERCISES; }, []) || []).map(function(e){ return e.eq; }).filter(function(g){ if(!g || seen[g]) return false; seen[g] = 1; return true; }); }
    function ago(at){ return safe(function(){ return agoWord(at); }, ''); }
    function mirrorOf(id, draw, skip){
      var el = document.getElementById(id);
      if(!el) return '';
      if(!el.getAttribute('data-c3') || !el.firstChild){ safe(draw); el.setAttribute('data-c3', '1'); }
      return yd.mirror(el, {els: MIR.els, ta: true, skip: skip}).html;   /* the form's cue fields are text areas */
    }

    yd.screen('moves', {
      parent: 'train', nav: 'train', old: ['train', 'moves'],
      leave: function(){ try{ MOVEUI.open = null; }catch(e){} },
      enter: function(){ safe(function(){ exdbLoad(); }); ['mvForm', 'mvGyms'].forEach(function(id){ var el = document.getElementById(id); if(el) el.removeAttribute('data-c3'); }); },
      render: function(ctx){
        var M = UI(), list = safe(function(){ return moveSearch(); }, []) || [], all = safe(function(){ return EXERCISES.length; }, 0), mine = safe(function(){ return myMoves().length; }, 0);
        /* "Open in the library" (the Watch layer's door, the app's openMoveInLibrary) sets MOVEUI.open: that move
           comes first, marked, until the list is changed */
        var picked = M.open ? (safe(function(){ return EXERCISES; }, []) || []).filter(function(e){ return e.id === M.open; })[0] : null;
        if(picked) list = [picked].concat(list.filter(function(e){ return e.id !== picked.id; }));
        var filtered = !!(M.grp || M.eq || (M.q || '').trim());
        var shown = list.slice(0, ctx.state.page || PAGE);
        var db = safe(function(){ return !!EXDB.data; }, false);
        var rows = shown.map(function(e){
          var img = db ? safe(function(){ return exImg(e, 0); }, '') : '';
          var meta = [safe(function(){ return grpLabel(e.grp); }, e.grp), (EQ_LABEL[e.eq] || e.eq)].concat(e.unil ? ['one side'] : []).concat(e._at ? [ago(e._at)] : e._planned ? ['this week'] : []).join(' · ');
          return '<li' + (picked && e.id === picked.id ? ' class="sel"' : '') + '><button type="button" class="mv-row" data-act="watch" data-v="' + esc(e.id) + '" data-key="mv-' + esc(e.id) + '" aria-label="' + esc(e.n + ', how to do it') + '">' +
            (img ? '<img src="' + esc(img) + '" alt="" loading="lazy" decoding="async">' : '<span class="mv-noimg" aria-hidden="true">' + h.icon('train', 22, 2) + '</span>') +
            '<span class="l"><b>' + esc(e.n) + (e.cx ? ' <em>yours</em>' : '') + '</b><small>' + esc(meta) + '</small></span>' + h.icon('chev', 16, 2.4) + '</button></li>';
        }).join('');
        var top = yd.stats([[String(mine), 'your lifts'], [String(all), 'in the library'], [String(safe(function(){ return customMoves().length; }, 0)), 'added by you']], 'mv-top');
        var search = '<label class="yd-field mv-search"><span class="k">Search everything</span><input class="yd-in" type="search" data-key="mv-q" data-q="1" value="' + esc(M.q || '') + '" placeholder="Squat, row, dumbbell, glutes" autocomplete="off" enterkeyhint="search"></label>';
        var scope = yd.seg('scope', [['mine', 'My lifts'], ['all', 'Everything']], (M.scope === 'mine' && !filtered) ? 'mine' : 'all', {aria:'Which moves', cls:'mv-seg'});
        var grp = yd.seg('grp', [['', 'All']].concat(groups().map(function(g){ return [g, safe(function(){ return grpLabel(g); }, g)]; })), M.grp || '', {aria:'Muscle', cls:'mv-seg mv-chips'});
        var eq = yd.seg('eq', [['', 'Any kit']].concat(eqs().map(function(v){ return [v, EQ_LABEL[v] || v]; })), M.eq || '', {aria:'Equipment', cls:'mv-seg mv-chips'});
        var count = (M.scope === 'mine' && !filtered) ? (list.length ? list.length + ' you train, last trained first' : 'Nothing trained yet: Everything has all ' + all) : list.length + ' of ' + all;
        MIR.els = [];
        /* the form's closed state carries a paragraph that counts the library as 121 moves; the count is on top */
        var form = mirrorOf('mvForm', function(){ renderMoveForm(); }, function(c){ return c.tagName === 'P' && /\bnote\b/.test(c.className || ''); }), gymsH = mirrorOf('mvGyms', function(){ renderGyms(); });
        return '<div class="yd mv">' + yd.head({back:'train', eyebrow: list.length + (list.length === 1 ? ' move' : ' moves'), title:'Your', pk:'library'}) + top +
          '<div class="yd-cols"><div class="yd-col">' + yd.sec('Moves', search + scope + grp + eq + '<p class="mv-count" aria-live="polite">' + esc(count) + '</p>' +
            (rows ? '<ul class="mv-list">' + rows + '</ul>' : yd.empty('Nothing matches. Clear a filter, or add it yourself.')) +
            (list.length > shown.length ? '<div class="yd-acts">' + yd.btn('more', 'Show ' + Math.min(PAGE, list.length - shown.length) + ' more') + '</div>' : ''), {id:'moves', n: list.length}) + '</div>' +
          '<div class="yd-col">' + (form ? yd.sec('Add your own', '<div class="mv-mir">' + form + '</div>', {id:'mine'}) : '') +
            (gymsH ? yd.sec('Gyms', '<div class="mv-mir">' + gymsH + '</div>', {id:'gyms'}) : '') + '</div></div></div>';
      },
      wire: function(root, ctx){
        var after = function(){ setTimeout(function(){ ['mvForm', 'mvGyms'].forEach(function(id){ var el = document.getElementById(id); if(el) el.setAttribute('data-c3', '1'); }); try{ save(); }catch(e){} C3.render(); }, 40); };
        var mir = yd.mirrorActs(function(){ return MIR.els; }, after), mirC = yd.mirrorChgs(function(){ return MIR.els; }, after);
        var M = UI();
        yd.wire(root, ctx, {
          watch: function(v, el){ h.watch(v, el); },
          scope: function(v){ M.open = null; M.scope = v; if(v === 'mine'){ M.grp = ''; M.eq = ''; M.q = ''; } ctx.state.page = PAGE; C3.render(); },
          grp: function(v){ M.open = null; M.grp = v; if(v) M.scope = 'all'; ctx.state.page = PAGE; C3.render(); },
          eq: function(v){ M.open = null; M.eq = v; if(v) M.scope = 'all'; ctx.state.page = PAGE; C3.render(); },
          more: function(){ ctx.state.page = (ctx.state.page || PAGE) + PAGE; C3.render(); },
          mir: function(v){ mir.mir(v); /* the app redraws its form and gyms itself; a new move or gym shows in the list */ setTimeout(function(){ try{ renderMoves(); }catch(e){} C3.render(); }, 80); },
          mirck: mir.mirck
        }, { mirin: mirC.mirin, mirsel: mirC.mirsel });
        /* the search answers as it is typed (the app's own: typing searches everything) */
        var q = root.querySelector('[data-q]');
        if(q && C3.root && C3.root.activeElement === q){ try{ var n = q.value.length; q.setSelectionRange(n, n); }catch(e){} }
        if(q) q.addEventListener('input', function(){ M.q = q.value; M.open = null; ctx.state.page = PAGE; clearTimeout(typing); typing = setTimeout(function(){ C3.render(); }, 140); });
        /* the photo library arrives after the first paint */
        if(!safe(function(){ return !!EXDB.data; }, false)){
          var tries = 0, t = setInterval(function(){ if(C3.current !== 'moves' || ++tries > 40){ clearInterval(t); return; } if(safe(function(){ return !!EXDB.data; }, false)){ clearInterval(t); C3.render(); } }, 250);
        }
      }
    });
  });
  if(C3.yd && C3.yd.drain) C3.yd.drain();
})();
