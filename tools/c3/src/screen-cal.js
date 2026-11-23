/* C3 screen: cal (v320). Replaces the old Calendar page (p-cal: a box with three views, a legend of six colored
   dots, a day panel of boxes).
   The month as a grid of marks, the day under the finger, the two weeks ahead. Everything is the app's own:
   dayFacts / dayItems / planItemsOn / eventsOn (what is on a day), calMonth (the month the app is on),
   CALUI.sel (the day picked). The day itself is the app's own day panel (renderCalDay: every record on the day,
   Edit, Delete, Done, Send to calendar, Add), mirrored (yd.mirror) and pressed as it is, so editing a dose, a
   weigh-in, a side effect or a meeting is exactly the app's write. Export is the app's calendar sheet. */
(function(){
  'use strict';
  var C3 = window.C3; if(!C3) return;
  (C3.ydq = C3.ydq || []).push(function(yd){
    var h = C3.h, esc = h.esc, safe = yd.safe;
    var DAYMS = 864e5;
    var MIR = {els: []};
    /* the marks: one color per kind of thing, never blue type */
    var MK = {session:'#5CF2B0', plan:'#5CF2B0', weigh:'#FFFFFF', dose:'#FF4FCB', plandose:'#FF4FCB', missed:'#FF8A9A', sx:'#FFB85C', event:'#FFE45C', hyd:'#FFB85C'};
    function markLabel(x){
      return x[0] === 'session' ? 'Workout logged' : x[0] === 'plan' ? 'Workout planned' : x[0] === 'dose' ? 'Dose logged' : x[0] === 'plandose' ? 'Dose scheduled' : x[0] === 'missed' ? 'Scheduled dose missed' : x[0] === 'weigh' ? 'Weigh-in logged' : x[0] === 'hyd' ? 'Water target met' : x[0] === 'sx' ? 'Side effect logged' : x[1] ? 'Event completed or past' : 'Event planned';
    }
    function legend(){
      var items = [['session','Workout'],['weigh','Weigh-in'],['hyd','Water target met'],['event','Event']];
      if(safe(function(){ return onPeptide(); }, false)) items.splice(2, 0, ['dose','Dose'], ['missed','Scheduled dose missed']);
      return '<div class="cal-key" aria-label="Calendar color key">' + items.map(function(x){ return '<span><i style="--c:' + MK[x[0]] + '"></i>' + esc(x[1]) + '</span>'; }).join('') + '<p>Solid workout and dose marks = logged. Outlines = planned or scheduled. Solid event marks = completed or past.</p><p>Tap a day to see names, amounts and times.</p></div>';
    }

    function d0(ms){ var d = new Date(ms); d.setHours(0, 0, 0, 0); return d.getTime(); }
    function marks(ms, today){
      var f = safe(function(){ return dayFacts(ms); }, {}) || {}, out = [];
      if(f.workout) out.push(['session', 1]);
      if(f.doses) out.push(['dose', 1]);
      if(f.missed) out.push(['missed', 1]);
      if(f.weight != null) out.push(['weigh', 1]);
      if(f.hydMet) out.push(['hyd', 1]);
      if(ms >= today) (safe(function(){ return planItemsOn(ms); }, []) || []).forEach(function(p){ out.push([p.t === 'plan' ? 'plan' : p.t === 'plandose' ? (/missed/.test(p.sub || '') ? 'missed' : 'plandose') : 'event', 0]); });
      (safe(function(){ return eventsOn(ms); }, []) || []).forEach(function(e){ out.push(['event', e.done || e.at <= Date.now() ? 1 : 0]); });
      return out.slice(0, 5);
    }
    function grid(ctx){
      var cm = safe(function(){ return calMonth; }, new Date()), y = cm.getFullYear(), m = cm.getMonth();
      var first = new Date(y, m, 1).getDay(), len = new Date(y, m + 1, 0).getDate(), today = d0(Date.now());
      var sel = safe(function(){ return CALUI.sel; }, null), selK = sel != null ? d0(sel) : null;
      var s = '<div class="cal-dows" aria-hidden="true">' + ['S', 'M', 'T', 'W', 'T', 'F', 'S'].map(function(x){ return '<span>' + x + '</span>'; }).join('') + '</div><div class="cal-grid" role="grid" aria-label="' + esc(cm.toLocaleString('en-US', {month:'long', year:'numeric'})) + '">';
      for(var i = 0; i < first; i++) s += '<span class="cal-off" aria-hidden="true"></span>';
      for(var d = 1; d <= len; d++){
        var ms = new Date(y, m, d).getTime(), mk = marks(ms, today);
        var lbl = new Date(ms).toLocaleDateString('en-US', {weekday:'long', month:'long', day:'numeric'}) + (mk.length ? ', ' + mk.map(markLabel).join(', ') : ', no calendar marks');
        s += '<button type="button" class="cal-d' + (ms === today ? ' today' : '') + (ms === selK ? ' sel' : '') + (ms < today ? ' past' : '') + '" data-act="day" data-v="' + ms + '" data-key="d-' + d + '" aria-label="' + esc(lbl) + '" aria-pressed="' + (ms === selK ? 'true' : 'false') + '">' +
          '<b>' + d + '</b><span class="mk">' + mk.map(function(x){ return '<i class="' + (x[1] ? 'f' : 'o') + '" title="' + esc(markLabel(x)) + '" style="--c:' + MK[x[0]] + '"></i>'; }).join('') + '</span></button>';
      }
      return s + '</div>' + legend();
    }
    function monthStats(){
      var cm = safe(function(){ return calMonth; }, new Date()), y = cm.getFullYear(), m = cm.getMonth(), len = new Date(y, m + 1, 0).getDate();
      var ses = 0, wts = 0, doses = 0, miss = 0, ahead = 0, today = d0(Date.now());
      for(var d = 1; d <= len; d++){
        var ms = new Date(y, m, d).getTime(), f = safe(function(){ return dayFacts(ms); }, {}) || {};
        if(f.workout) ses++; if(f.weight != null) wts++; doses += f.doses || 0; miss += f.missed || 0;
        if(ms >= today) ahead += (safe(function(){ return planItemsOn(ms); }, []) || []).filter(function(p){ return p.t === 'plan'; }).length;
      }
      var st = [[String(ses), ses === 1 ? 'session' : 'sessions'], [String(ahead), 'planned ahead'], [String(wts), wts === 1 ? 'weigh-in' : 'weigh-ins']];
      if(safe(function(){ return onPeptide(); }, false)) st.push([String(doses), doses === 1 ? 'dose' : 'doses', miss ? 'bad' : '']);
      return st;
    }
    function ahead(){
      var today = d0(Date.now()), out = '';
      for(var i = 0; i < 14; i++){
        var ms = today + i * DAYMS, items = safe(function(){ return calDayAll(ms); }, []) || [];
        if(!items.length) continue;
        out += '<li><button type="button" class="cal-ag" data-act="day" data-v="' + ms + '" data-key="ag-' + i + '" aria-pressed="' + (d0(CALUI.sel) === ms ? 'true' : 'false') + '">' +
          '<span class="w"><b>' + esc(i === 0 ? 'Today' : i === 1 ? 'Tomorrow' : new Date(ms).toLocaleDateString('en-US', {weekday:'short'})) + '</b><small>' + esc(yd.day(ms)) + '</small></span>' +
          '<span class="its">' + items.slice(0, 3).map(function(it){
            var name = it.t === 'plan' ? it.name : it.t === 'plandose' ? it.name : it.t === 'event' ? (it.title || safe(function(){ return evKind(it.kind).n; }, 'Event')) : it.t === 'session' ? it.name : it.t === 'weigh' ? safe(function(){ return wTxt(it.lb, 1); }, '') : it.t === 'dose' ? safe(function(){ return fmtW(it.mg) + ' mg'; }, 'Dose') : (it.kind || 'Side effect');
            var k = it.t === 'plandose' ? 'plandose' : it.t === 'plan' ? 'plan' : it.t;
            return '<span><i style="--c:' + (MK[k] || '#FFFFFF') + '" class="' + (it.t === 'plan' || it.t === 'plandose' ? 'o' : 'f') + '"></i>' + esc(name) + '</span>'; }).join('') +
            (items.length > 3 ? '<span class="more">+' + (items.length - 3) + '</span>' : '') + '</span></button></li>';
      }
      return out ? '<ul class="cal-ags">' + out + '</ul>' : yd.empty('Nothing in the next two weeks.');
    }
    function dayPanel(){
      var sel = safe(function(){ return CALUI.sel; }, null);
      MIR.els = [];
      if(sel == null) return '';
      var box = document.getElementById('calDetail');
      if(!box) return '';
      /* the app draws its own day panel; it is redrawn here only when the day, what is being edited or added, or
         what is on the day changes, so a field half typed in the app's own form keeps what was typed */
      var sig = safe(function(){ return [sel, CALUI.editing, CALUI.adding, calDayAll(sel).map(function(it){ return it.t + it.at + (it.done ? 'd' : ''); }).join(',')].join('|'); }, String(sel));
      if(box.getAttribute('data-c3') !== sig || !box.firstChild){ safe(function(){ renderCalDay(); }); box.setAttribute('data-c3', sig); }
      var M = yd.mirror(box, {els: MIR.els, skip: function(c){ return c.tagName === 'H2'; }});   /* the date is the section's own label */
      return '<div class="cal-day">' + M.html + '</div>';
    }

    yd.screen('cal', {
      parent: 'train', nav: 'train', old: ['train', 'cal'],
      enter: function(){ try{ if(CALUI.sel == null) CALUI.sel = d0(Date.now()); CALUI.editing = null; CALUI.adding = null; }catch(e){} },
      render: function(ctx){
        var cm = safe(function(){ return calMonth; }, new Date());
        var name = cm.toLocaleString('en-US', {month:'long'}), yr = cm.getFullYear(), now = new Date();
        var isNow = cm.getMonth() === now.getMonth() && yr === now.getFullYear();
        var nav = '<div class="cal-nav">' + yd.btn('prev', '', {icon:'back', aria:'Previous month', cls:'cal-arrow'}) +
          '<b>' + esc(name) + ' <span class="c3-num">' + yr + '</span></b>' +
          (isNow ? '' : yd.btn('thismonth', 'Today', {cls:'cal-today'})) +
          yd.btn('next', '', {icon:'chev', aria:'Next month', cls:'cal-arrow'}) + '</div>';
        var sel = safe(function(){ return CALUI.sel; }, null);
        return '<div class="yd cal">' + yd.head({back:'train', eyebrow: name + ' ' + yr, title:'Your', pk:'calendar'}) +
          yd.stats(monthStats(), 'cal-top') +
          '<div class="yd-cols"><div class="yd-col">' + yd.sec('', nav + grid(ctx), {id:'month', aria:'Month'}) +
            yd.sec('Next 14 days', ahead(), {id:'ahead'}) + '</div>' +
          '<div class="yd-col">' + (sel != null ? yd.sec(new Date(sel).toLocaleDateString('en-US', {weekday:'long', month:'long', day:'numeric'}), dayPanel(), {id:'day'}) : '') +
            '<div class="yd-acts">' + yd.btn('export', 'Export to my calendar', {icon:'out'}) + '</div></div></div></div>';
      },
      wire: function(root, ctx){
        var after = function(){ setTimeout(function(){ try{ save(); }catch(e){} C3.render(); }, 40); };
        var mir = yd.mirrorActs(function(){ return MIR.els; }, after), mirC = yd.mirrorChgs(function(){ return MIR.els; }, after);
        yd.wire(root, ctx, {
          day: function(v){ CALUI.sel = +v; CALUI.editing = null; CALUI.adding = null; var m = new Date(+v); if(m.getMonth() !== calMonth.getMonth() || m.getFullYear() !== calMonth.getFullYear()){ calMonth.setFullYear(m.getFullYear(), m.getMonth(), 1); } C3.render();
            if(window.innerWidth < 1024) setTimeout(function(){ var el = root.querySelector('[data-sec="day"]'); if(el) el.scrollIntoView({block:'start', behavior:'smooth'}); }, 40); },
          prev: function(){ calMonth.setDate(1); calMonth.setMonth(calMonth.getMonth() - 1); C3.render(); },
          next: function(){ calMonth.setDate(1); calMonth.setMonth(calMonth.getMonth() + 1); C3.render(); },
          thismonth: function(){ var n = new Date(); calMonth.setFullYear(n.getFullYear(), n.getMonth(), 1); CALUI.sel = d0(Date.now()); C3.render(); },
          'export': function(){ openSheet('calout', {all:true}); },
          mir: mir.mir, mirck: mir.mirck
        }, { mirin: mirC.mirin, mirsel: mirC.mirsel });
      }
    });
  });
  if(C3.yd && C3.yd.drain) C3.yd.drain();
})();
