/* C3 screen: checkin. The daily check-in (the old Today > Check-in pane, #p-ready).
   Today's score in a ring from the app's own sum (Hooper: four answers, 1 to 7, lower is
   fresher), the five answers as big tap scales, one control to log it, and the last four
   weeks as a small chart against the person's own ordinary.
   Everything else the old pane held (the day, recovery, muscle feel, injuries, strength,
   notes, showing up, what the phone measured) is one tap away on the recovery screen.
   Reads and writes only through the app: rdDraft, readySave, readyDelete, readyRead,
   readyBaseline, readyTrend, autoRegulate. */
(function(){
  'use strict';
  var C3 = window.C3; if(!C3) return;
  (C3.ydq = C3.ydq || []).push(function(yd){
    var h = C3.h, esc = h.esc, safe = yd.safe;

    /* the app's own draft (pre-filled from today's answer, else the last one), plus today's appetite */
    function draft(){
      var d = rdDraft();
      if(d.appetite == null){ var t = readyToday(); if(t && +t.appetite >= 1) d.appetite = +t.appetite; }
      return d;
    }
    function sumOf(d){var t=0;for(var i=0;i<HOOPER.length;i++){var v=+d[HOOPER[i].k];if(!(v>=1&&v<=7))return null;t+=v;}return t;}
    function same(d, t){
      if(!t) return false;
      for(var i = 0; i < HOOPER.length; i++) if((d[HOOPER[i].k]==null?null:+d[HOOPER[i].k]) !== (t[HOOPER[i].k]==null?null:+t[HOOPER[i].k])) return false;
      return (+d.appetite || 0) === (+t.appetite || 0) && String(d.note || '').trim() === String(t.note || '').trim();
    }
    var TONE = {fresher:'#5CF2B0', usual:'#5CF2B0', off:'#FFB85C', rough:'#FF8A9A'};

    /* the last 28 days as dots against the person's own mean (a line) and one standard deviation (a band) */
    function chart(rows, B){
      var W = 560, H = 150, L = 6, R = 6, T = 10, Bm = 8, now = Date.now(), DAYMS = 86400000;
      var x = function(at){ var age = (now - at) / DAYMS; return L + (W - L - R) * (1 - Math.min(28, Math.max(0, age)) / 28); };
      var y = function(v){ return T + (H - T - Bm) * (1 - (v - HOOPER_MIN) / (HOOPER_MAX - HOOPER_MIN)); };
      var s = '<svg class="ck-chart" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' + esc(rows.length ? 'Check-in scores, last 28 days' : 'No check-ins in the last 28 days') + '" focusable="false">';
      [4, 12, 20, 28].forEach(function(v){ s += '<path d="M' + L + ' ' + y(v) + ' H' + (W - R) + '" stroke="rgba(207,209,213,0.187)" stroke-width="1" stroke-dasharray="2 6"></path>'; });
      if(B && !B.short){
        var lo = Math.max(HOOPER_MIN, B.mean - B.sd), hi = Math.min(HOOPER_MAX, B.mean + B.sd);
        if(B.sd > 0) s += '<rect x="' + L + '" y="' + y(hi) + '" width="' + (W - L - R) + '" height="' + Math.max(1, y(lo) - y(hi)) + '" fill="rgba(92,242,176,.12)"></rect>';
        s += '<path d="M' + L + ' ' + y(B.mean) + ' H' + (W - R) + '" stroke="#5CF2B0" stroke-width="2" stroke-dasharray="8 6"></path>';
      }
      if(rows.length > 1) s += '<path d="' + rows.map(function(r, i){ return (i ? 'L' : 'M') + (Math.round(x(r.at) * 10) / 10) + ' ' + (Math.round(y(r.v) * 10) / 10); }).join(' ') + '" fill="none" stroke="#FFFFFF" stroke-opacity=".55" stroke-width="2" stroke-linejoin="round"></path>';
      rows.forEach(function(r, i){
        var last = i === rows.length - 1;
        s += '<circle cx="' + (Math.round(x(r.at) * 10) / 10) + '" cy="' + (Math.round(y(r.v) * 10) / 10) + '" r="' + (last ? 7 : 5) + '" fill="' + (last ? '#5CF2B0' : '#FFFFFF') + '"' + (last ? ' style="filter:drop-shadow(0 0 8px #5CF2B0)"' : '') + '></circle>';
      });
      return s + '</svg>';
    }

    yd.screen('checkin', {
      nav: 'today', parent: 'today', old: ['today', 'ready'],
      render: function(ctx){
        var d = draft(), today = readyToday(), R = readyRead(today), B = readyBaseline(28), T = readyTrend(28);
        var log = readyLog(), sum = sumOf(d), dirty = !same(d, today);
        var fresh = sum==null?0:(HOOPER_MAX - sum) / (HOOPER_MAX - HOOPER_MIN);
        var tone = (R && !R.short && !dirty) ? (TONE[R.k] || '#5CF2B0') : '#5CF2B0';

        /* ---- the read: ring, the word, the person's own ordinary ---- */
        var word, sub;
        if(!today){ word = 'Not logged today'; sub = log.length ? 'Last: ' + yd.day(log[log.length - 1].at, true) + ', ' + (hooperScore(log[log.length - 1]) == null ? 'no score' : hooperScore(log[log.length - 1]) + ' of ' + HOOPER_MAX) : 'Your first check-in sets the baseline.'; }
        else if(dirty){ word = 'Changed, not saved'; sub = hooperScore(today)==null?'Today has skipped answers; no readiness score.':'Logged today: ' + hooperScore(today) + ' of ' + HOOPER_MAX; }
        else if(R && R.short){ var need = Math.max(0, (R.base.need || READY_BASE) - (R.base.have || 0)); word = 'Logged'; sub = 'Baseline in ' + yd.plural(need, 'more check-in'); }
        else if(R){ word = R.word; sub = R.flat ? 'Every check-in so far scored the same.' : (R.z >= 0 ? '+' : '') + R.z.toFixed(1) + ' SD from your own mean' + (R.worst ? ' · ' + R.worst.toLowerCase() + ' rated worst' : ''); }
        else { word = 'Recorded with skipped answers'; sub = 'No readiness score. Complete all four readiness answers to calculate one.'; }
        var stats = [];
        if(B && !B.short) stats.push([String(Math.round(B.mean * 10) / 10), 'Your ordinary'], ['±' + (Math.round(B.sd * 10) / 10), 'Spread']);
        stats.push([String(log.length), log.length === 1 ? 'Check-in' : 'Check-ins']);
        if(T) stats.push([(T.real ? (T.perWk > 0 ? '+' : '') + T.perWk.toFixed(1) : 'Flat'), T.real ? 'Per week' : 'Trend', T.real ? (T.perWk > 0 ? 'warn' : 'good') : '']);
        var read = '<section class="ck-read" aria-label="Today">' +
          '<div class="ck-ring">' + h.ringSVG({arcs:[{key:'train', frac:fresh, color:tone}], start:270, compact:ctx.phone, top:(today && !dirty) ? 'Today' : 'Now', big:sum==null?'\u00b7':String(sum), bottom:sum==null?'No score':'of ' + HOOPER_MAX,
            label:sum==null?'Readiness score unavailable: complete all four answers':'Check-in score ' + sum + ' of ' + HOOPER_MAX + ', lower is fresher'}) + '</div>' +
          '<div class="ck-say"><p class="ck-word" data-state="' + (today ? (dirty ? 'dirty' : 'logged') : 'none') + '">' + esc(word) + '</p>' + (sub ? '<p class="ck-sub">' + esc(sub) + '</p>' : '') +
            yd.stats(stats, 'ck-stats') + '</div>' +
        '</section>';

        /* ---- the five answers ---- */
        var nums = [1, 2, 3, 4, 5, 6, 7].map(function(n){ return [n, '']; });
        var qs = HOOPER.concat([APPETITE]).map(function(it){
          var v = d[it.k];
          return '<div class="yd-q ck-q"><div class="yd-qh"><b>' + esc(it.n) + '</b><span>1 ' + esc(it.lo.toLowerCase()) + ' · 7 ' + esc(it.hi.toLowerCase()) + '</span></div>' +
            yd.scale('set', nums, v == null ? null : v, {aria: it.n, k: it.k, extra: 'data-f="' + esc(it.k) + '"'}) + '</div>';
        }).join('');
        var form = '<section class="ck-form" aria-label="How are you today">' + qs +
          yd.input('note', d.note || '', 'Anything worth noting (optional)', {max:140, ph:'Slept badly, long drive, first day back', cls:'ck-note'}) +
          '<p role="alert">'+esc(ctx.state.saveError||'')+'</p>'+/* v366: the button shows the score about to be logged, and nothing before there is one ("No readiness score /
             not logged" repeated the heading); one way out (Cancel and Back did the same thing) */
          yd.primary('save', today ? 'Update today' : 'Log today', sum==null ? '' : '<span>' + sum + ' / ' + HOOPER_MAX + '</span><span>' + (today ? 'logged' : 'to log') + '</span>', {icon: 'check'}) +
          '<div class="yd-acts">'+yd.btn('cancel','Cancel')+'</div>'+
          (today ? '<div class="yd-acts ck-rm">' + yd.btn('del', 'Remove today’s', {pink:true, icon:'x'}) + '</div>' : '') +
        '</section>';

        /* ---- the last four weeks ---- */
        var from = Date.now() - 28 * 86400000;
        var pts = log.filter(function(r){ return r.at >= from; }).map(function(r){ return {at:r.at, v:hooperScore(r)}; }).filter(function(p){ return p.v != null; });
        var rows = log.slice().reverse(), show = ctx.state.all ? rows : rows.slice(0, 7);
        var hist = yd.sec('Last 28 days', '<div class="ck-chartw"><span class="ck-ax top">28 rough</span>' + chart(pts, B) + '<span class="ck-ax bot">4 fresh</span></div>' +
          (B && !B.short ? '<p class="ck-key"><i></i>Your ordinary, ' + (Math.round(B.mean * 10) / 10) + ' ± ' + (Math.round(B.sd * 10) / 10) + ' over ' + B.n + ' check-ins</p>' : '') +
          (T ? yd.note(T.real ? 'Trend: <b>' + (T.perWk > 0 ? 'worsening' : 'improving') + ' by ' + Math.abs(T.perWk).toFixed(1) + ' points a week</b> over ' + T.n + ' check-ins.' : 'Trend: flat over ' + T.n + ' check-ins.') : '') +
          (rows.length
            ? '<div class="yd-scroll"><table class="yd-table ck-table"><thead><tr><th>Day</th>' + HOOPER.map(function(q){ return '<th class="n" title="' + esc(q.n) + '">' + esc(q.n.slice(0, 3)) + '</th>'; }).join('') + '<th class="n">Score</th><th>Note</th></tr></thead><tbody>' +
              show.map(function(r){ var sc = hooperScore(r); return '<tr><td>' + esc(yd.day(r.at)) + '</td>' + HOOPER.map(function(q){ return '<td class="n">' + (r[q.k] == null ? '·' : esc(r[q.k])) + '</td>'; }).join('') +
                '<td class="n"><b>' + (sc == null ? '·' : sc) + '</b></td><td>' + esc(r.note || '') + '</td></tr>'; }).join('') + '</tbody></table></div>' +
              (rows.length > 7 ? '<div class="yd-acts">' + yd.btn('more', ctx.state.all ? 'Show fewer' : 'Show all ' + rows.length) + '</div>' : '')
            : yd.empty('No check-ins yet. The first one starts the chart.')) +
          '<p class="yd-src">Four items, 1 to 7, summed (Hooper and Mackinnon, 1995). Read against your own last 28 days, never a population number.</p>',
          {cls:'ck-hist', n: pts.length || null});

        /* ---- the rest of the old pane, one tap away ---- */
        var st = safe(function(){ return streaks(); }, null), inj = safe(function(){ return injActive().length; }, 0);
        var L = safe(function(){ return lifeSummary(); }, null);
        var more = yd.sec('Body and recovery', '<ul class="yd-list two">' +
          yd.linkRow('day', 'The day', L ? L.logged + ' of 4' : '', 'data-go="recovery" data-params=\'{"view":"day"}\'') +
          yd.linkRow('rec', 'Recovery', '', 'data-go="recovery" data-params=\'{"view":"rec"}\'') +
          yd.linkRow('rate', 'Muscle feel', '', 'data-go="recovery" data-params=\'{"view":"rate"}\'') +
          yd.linkRow('inj', 'Injuries', inj ? String(inj) : '', 'data-go="recovery" data-params=\'{"view":"inj"}\'') +
          yd.linkRow('streak', 'Streak', st ? yd.plural(st.now, 'day') : '', 'data-go="recovery" data-params=\'{"view":"streak"}\'') +
          yd.linkRow('str', 'Strength score', '', 'data-go="recovery" data-params=\'{"view":"str"}\'') +
          yd.linkRow('notes', 'Notes', '', 'data-go="recovery" data-params=\'{"view":"notes"}\'') +
          yd.linkRow('obj', 'From your phone', '', 'data-go="recovery" data-params=\'{"view":"obj"}\'') +
        '</ul>', {cls:'ck-more'});

        return '<div class="yd ck" data-logged="' + (today ? '1' : '0') + '">' +
          yd.head({back:'today', eyebrow:h.fmt.date(new Date()), title:'Daily', pk:'check-in'}) +
          '<div class="yd-cols narrow ck-cols"><div class="yd-col ck-a">' + read + hist + '</div><div class="yd-col ck-b">' + form + '</div></div>' +
          more + '</div>';
      },
      wire: function(root, ctx){
        yd.wire(root, ctx, {
          set: function(v, el){ draft()[el.getAttribute('data-f')] = +v; C3.render(); },
          save: function(){
            var d = draft();
            var before=JSON.parse(JSON.stringify(ALL.ready||[])),old=readyToday(),skipped={};HOOPER.forEach(function(q){if(d[q.k]==null)skipped[q.k]=true;});
            var r = readySave({sleep:d.sleep, fatigue:d.fatigue, stress:d.stress, soreness:d.soreness, appetite:d.appetite || undefined,mood:old&&old.mood,skipped:skipped,note:String(d.note || '').trim() || undefined});
            if(!saveOk()){ALL.ready=before;ctx.set({saveError:'This device could not save. Your answers are still here. Retry when storage is available.'});return;}
            ctx.state.saveError='';
            RDUI.draft = null;
            /* the app's own follow-up: today adjusts to a rough check-in on its own (its toast carries the undo) */
            var adj = (typeof autoRegulate === 'function') ? autoRegulate() : null;
            if(!adj) yd.toast(r && r.replaced ? 'Today’s check-in updated.' : 'Check-in logged.');
            C3.refresh();
          },
          cancel:function(){RDUI.draft=null;C3.go('today');},
          del: function(){
            var t = readyToday(); if(!t) return;
            var gone = readyDelete(t.at);
            RDUI.draft = null;
            if(gone) yd.undo('Check-in removed.', function(){ readyLog().push(gone); readyLog().sort(function(a, b){ return a.at - b.at; }); RDUI.draft = null; });
            C3.refresh();
          },
          more: function(){ ctx.set({all: !ctx.state.all}); }
        }, {
          note: function(v){ draft().note = v; C3.render(); }
        });
        /* keep what is being typed if something repaints the screen before the field is left */
        var n = root.querySelector('[data-chg="note"]');
        if(n) n.addEventListener('input', function(){ draft().note = n.value; });
      }
    });
  });
  if(C3.yd && C3.yd.drain) C3.yd.drain();
})();
