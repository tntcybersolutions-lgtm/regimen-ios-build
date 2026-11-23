/* C3 screen: log (v320). Replaces the old "Schedule & log" page (p-log: three boxes: published schedules, the
   schedule form with its ladder, the list of doses with Take / Skip / Hold / Undo and Export / Import).
   The doses first (what happened and what is next, as rows), then the schedule. The app's own throughout:
   buildSchedule(S) (every dose, its status), the occurrence list's own buttons (renderOccurrences: Take writes
   the ladder's mg and the next site, Skip follows the skip rule, Hold, Undo with tombstones) pressed as they are,
   the schedule form and ladder (renderLog) and the published schedules (renderTemplates) mirrored, the start date
   written the way the app's own picker writes it (S.sched.anchor), Export and import on the Data screen (the app's own panel). */
(function(){
  'use strict';
  var C3 = window.C3; if(!C3) return;
  (C3.ydq = C3.ydq || []).push(function(yd){
    var h = C3.h, esc = h.esc, safe = yd.safe;
    var DAYMS = 864e5, MIR = {els: []};
    var TONE = {taken:'good', planned:'', missed:'bad', skipped:'warn', held:'warn', blocked:'bad'};

    function when(at){ return safe(function(){ return new Date(at).toLocaleString('en-US', {weekday:'short', month:'short', day:'numeric', hour:'numeric', minute:'2-digit'}); }, ''); }
    function rel(at){ var d = at - Date.now(), hh = Math.round(Math.abs(d) / 36e5); return hh < 1 ? 'now' : hh < 36 ? (d > 0 ? 'in ' + hh + ' h' : hh + ' h ago') : (d > 0 ? 'in ' + Math.round(hh / 24) + ' d' : Math.round(hh / 24) + ' d ago'); }
    function press(sel){ try{ renderOccurrences(); }catch(e){} var b = document.querySelector('#occList ' + sel); if(!b){ console.error('[c3] log: no ' + sel); return false; } b.click(); return true; }
    function iso(ms){ var d = new Date(ms); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }

    yd.screen('log', {
      parent: 'progress', nav: 'progress', old: ['peptides', 'log'],
      enter: function(){ ['p-log'].forEach(function(){ try{ renderLog(); }catch(e){} try{ renderTemplates(); }catch(e){} }); },
      render: function(ctx){
        var P = safe(function(){ return S; }, null);
        if(!P || !P.sched) return '<div class="yd lg">' + yd.head({back:'progress', title:'Your', pk:'schedule'}) + yd.empty('No protocol set up.') + '</div>';
        var now = Date.now();
        var all = (safe(function(){ return buildSchedule(P, now - 70 * DAYMS, now + 60 * DAYMS); }, []) || []).slice().sort(function(a, b){ return a.at - b.at; });
        var past = all.filter(function(r){ return r.at <= now; }), soon = all.filter(function(r){ return r.at > now; });
        var rows = past.slice(-6).concat(soon.slice(0, 4));
        var next = soon.filter(function(r){ return r.status === 'planned' || r.status === 'blocked'; })[0];
        var last30 = past.filter(function(r){ return r.at >= now - 30 * DAYMS; });
        var taken = last30.filter(function(r){ return r.status === 'taken'; }).length, owed = last30.filter(function(r){ return r.status === 'taken' || r.status === 'missed'; }).length;
        var top = yd.stats([
          [next ? rel(next.at) : '·', next ? 'next, ' + safe(function(){ return amtTxt(P, next.mg); }, '') : 'nothing scheduled'],
          [String(taken), 'taken, 30 days'],
          [owed ? Math.round(taken / owed * 100) + '%' : '·', 'on schedule', owed ? (taken / owed >= 0.9 ? 'good' : taken / owed >= 0.7 ? 'warn' : 'bad') : ''],
          [String(past.filter(function(r){ return r.status === 'missed'; }).length), 'missed, 70 days', past.some(function(r){ return r.status === 'missed'; }) ? 'bad' : '']], 'lg-top');
        var list = rows.length ? '<ul class="lg-list">' + rows.map(function(r){
          var acts = r.status === 'taken' ? yd.btn('undo', 'Undo', {v: r.at})
            : (r.status === 'planned' || r.status === 'missed' || r.status === 'blocked') ? yd.btn('take', 'Take', {v: r.at, icon:'check'}) + yd.btn('skip', 'Skip', {v: r.at}) + yd.btn('hold', 'Hold', {v: r.at})
            : yd.btn('clear', 'Undo', {v: r.at});
          var future = r.at > now;
          return '<li class="' + (future ? 'ahead' : '') + '"><span class="w"><b>' + esc(when(r.at)) + '</b><small>' + esc(rel(r.at)) + '</small></span>' +
            '<span class="a"><b class="c3-num">' + esc(safe(function(){ return amtTxt(P, r.mg); }, r.mg + ' mg')) + '</b><small class="st ' + (TONE[r.status] || '') + '">' + esc(r.status) + (r.off ? ', off schedule' : '') + '</small></span>' +
            '<span class="acts">' + acts + '</span></li>';
        }).join('') + '</ul>' : yd.empty('Nothing scheduled yet. Set the pattern below and log the first dose.');
        if(rows.some(function(r){ return r.status === 'blocked'; })) list += yd.note('Blocked: the open vial cannot cover it. Mix the next vial and it clears.', 'warn');
        MIR.els = [];
        var card = safe(function(){ return document.getElementById('sKind').closest('.card'); }, null), tmpl = document.getElementById('tmplBody');
        /* the app's date picker face is replaced by a date field here */
        var face = document.querySelector('#p-log .calwrap .dfield'), was = face ? face.hidden : false;
        if(face) face.hidden = true;
        var form = card ? yd.mirror(card, {els: MIR.els, skip: function(c){ return c.tagName === 'H2' || /\beyebrow\b/.test(c.className || ''); }}).html : '';
        if(face) face.hidden = was;
        var tm = tmpl ? yd.mirror(tmpl, {els: MIR.els}).html : '';
        var start = safe(function(){ return P.sched.anchor; }, null);
        return '<div class="yd lg">' + yd.head({back:'progress', eyebrow: (P.name || safe(function(){ return byId(P.compound).n; }, '')) + ' · ' + safe(function(){ return amtTxt(P, P.doseMg); }, ''), title:'Your', pk:'schedule'}) + top +
          '<div class="yd-cols"><div class="yd-col">' + yd.sec('Doses', list + '<div class="yd-acts">' + yd.btn('data', 'Export or import', {icon:'down'}) + '</div>', {id:'doses'}) + '</div>' +
          '<div class="yd-col">' + yd.sec('Schedule', (start ? yd.input('start', iso(start), 'Started on', {type:'date'}) : '') + '<div class="lg-mir">' + form + '</div>', {id:'sched'}) +
            (tm ? yd.sec('Published schedules', '<div class="lg-mir">' + tm + '</div>', {id:'tmpl'}) : '') + '</div></div></div>';
      },
      wire: function(root, ctx){
        var after = function(){ setTimeout(function(){ try{ renderLog(); }catch(e){} C3.render(); }, 40); };
        var mir = yd.mirrorActs(function(){ return MIR.els; }, after), mirC = yd.mirrorChgs(function(){ return MIR.els; }, after);
        yd.wire(root, ctx, {
          take: function(v){ press('[data-take="' + v + '"]'); C3.refresh(); },
          skip: function(v){ press('[data-skip="' + v + '"]'); C3.refresh(); },
          hold: function(v){ press('[data-hold="' + v + '"]'); C3.refresh(); },
          undo: function(v){ press('[data-undo="' + v + '"]'); C3.refresh(); },
          clear: function(v){ press('[data-clear="' + v + '"]'); C3.refresh(); },
          data: function(){ C3.go('data'); },   /* the app's own export and import, on the Data screen */
          mir: mir.mir, mirck: mir.mirck
        }, {
          /* the start date, the way the app's own picker writes it: the first dose's day at the schedule's hour */
          start: function(v){ var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v || ''); if(!m) return; var a = new Date(S.sched.anchor || Date.now()); var d = new Date(+m[1], +m[2] - 1, +m[3], a.getHours(), a.getMinutes()); S.sched.anchor = d.getTime(); try{ save(); drawAll(); }catch(e){} C3.refresh(); },
          mirin: mirC.mirin, mirsel: mirC.mirsel
        });
      }
    });
  });
  if(C3.yd && C3.yd.drain) C3.yd.drain();
})();
