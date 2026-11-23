/* C3 screen: body (v320). Replaces the old Body page (p-body: 7 boxes, 1,014 words, 9,452 px).
   The numbers first, then the four things a person logs about their body, each in the app's own terms:
     weight        S.weights through the app's own math: ewma(0.10) trend, ols() over the last 28 days with its
                   95% interval, the 14-day stall test, fitPlateau() on the raw readings (renderBody)
     muscle or fat navyBF() at the first and the latest weigh-in, fat and lean split, lean share (renderComp);
                   the inputs write ALL.body (the keys renderComp writes) and syncBodyInputs() mirrors them
     tape          TAPE_SITES, tapeSave() and the waist / neck / hip it hands the body-fat math (the tape card's
                   Save), whtr() against NICE NG246
     blood pressure bpAverage(30), bpCat(), bpAdd(), bpDelete() with the app's Undo (renderBP)
     scans         compLog / compLatest / compChange (renderComp2); the importer is the app's own (dexaParse,
                   compSave): its result and the type-it-in form are mirrored (yd.mirror) and pressed as they are
     phone scan    a camera wizard drawn by the app into its own page: the one door that still opens the old pane
   No placeholder numbers: the old card's fields carried 38 / 15.5 / 42 in its markup and wrote them into the
   body record the first time Body was opened; here a field is empty until the person fills it. */
(function(){
  'use strict';
  var C3 = window.C3; if(!C3) return;
  (C3.ydq = C3.ydq || []).push(function(yd){
    var h = C3.h, esc = h.esc, safe = yd.safe, icon = yd.icon;
    var DAYMS = 864e5;

    function num(v){ v = +v; return isFinite(v) ? v : null; }
    function dp1(v){ return (Math.round(v * 10) / 10).toFixed(1); }
    function sgn(v, dp){ var r = (Math.round(Math.abs(v) * Math.pow(10, dp)) / Math.pow(10, dp)).toFixed(dp); return (v > 0 ? '+' : v < 0 ? '−' : '') + r; }
    function W(lb, dp){ return safe(function(){ return wNum(lb, dp == null ? 1 : dp); }, lb); }
    function U(){ return safe(function(){ return wU(); }, 'lb'); }
    function L(inch, dp){ return safe(function(){ return lNum(inch, dp); }, inch); }
    function LU(){ return safe(function(){ return lU(); }, 'in'); }
    function metric(){ return safe(function(){ return isMetric(); }, false); }
    function md(at){ return yd.day(at); }
    function B(){ return safe(function(){ return ALL.body || (ALL.body = {}); }, {}); }
    function tone(k){ return {healthy:'good', normal:'good', increased:'warn', elevated:'warn', stage1:'warn', high:'bad', stage2:'bad', crisis:'bad', low:'warn'}[k] || ''; }

    /* ---------------- weight ---------------- */
    function weightModel(){
      var ws = (safe(function(){ return (S.weights || []).slice(); }, []) || []).filter(function(x){ return x && x.at > 0 && x.lb > 0; }).sort(function(a, b){ return a.at - b.at; });
      var M = {ws: ws, n: ws.length};
      if(ws.length < 3) return M;
      var t0 = ws[0].at, xs = ws.map(function(p){ return (p.at - t0) / DAYMS; }), ys = ws.map(function(p){ return p.lb; });
      var sm = ewma(ys, 0.10), last = xs[xs.length - 1];
      var idx = xs.map(function(x, i){ return i; }).filter(function(i){ return xs[i] >= last - 28; });
      M.xs = xs; M.ys = ys; M.sm = sm; M.t0 = t0;
      M.reg = safe(function(){ return ols(idx.map(function(i){ return xs[i]; }), idx.map(function(i){ return sm[i]; })); }, null);
      M.fit = safe(function(){ return fitPlateau(xs, ys); }, null);
      if(M.reg){ M.wk = M.reg.slope * 7; M.lo = M.reg.lo * 7; M.hi = M.reg.hi * 7; M.real = !(M.lo < 0 && M.hi > 0); }
      /* the 14-day stall, as renderBody calls it (all weigh-ins, a straight fit, goal loss or recomp) */
      var w14 = safe(function(){ return (ALL.weights || []).filter(function(x){ return x.at >= Date.now() - 14 * DAYMS; }).sort(function(a, b){ return a.at - b.at; }); }, []) || [];
      M.n14 = w14.length;
      if(w14.length >= 5){
        var f = safe(function(){ var x0 = w14[0].at; return ols(w14.map(function(x){ return (x.at - x0) / DAYMS; }), w14.map(function(x){ return x.lb; })); }, null);
        var goal = safe(function(){ return trainCfg().goal || ''; }, '');
        M.f14 = f; M.stall = !!(f && f.lo <= 0 && f.hi >= 0 && (goal === 'fatloss' || goal === 'recomp'));
      }
      return M;
    }
    function chart(M){
      var VW = 640, VH = 250, Lx = 54, Rx = 628, Ty = 18, By = 212;
      var xs = M.xs, ys = M.ys, sm = M.sm, days = xs[xs.length - 1] || 1, fit = M.fit;
      var lo = Math.min.apply(null, ys.concat(fit ? [fit.Winf] : [])) - 1.5, hi = Math.max.apply(null, ys) + 1.5;
      var X = function(d){ return Math.round((Lx + d / days * (Rx - Lx)) * 10) / 10; };
      var Y = function(v){ return Math.round((By - (v - lo) / (hi - lo) * (By - Ty)) * 10) / 10; };
      var FT = 'font-family:\'Barlow\',system-ui,sans-serif;font-weight:700;font-variant-numeric:tabular-nums;';
      var FH = 'font-family:\'Barlow Condensed\',\'Arial Narrow\',sans-serif;font-weight:800;letter-spacing:0;';
      var lastSm = sm[sm.length - 1];
      var s = '<svg class="bdy-chart" viewBox="0 0 ' + VW + ' ' + VH + '" role="img" focusable="false" aria-label="' +
        esc('Weight, ' + M.n + ' weigh-ins from ' + md(M.t0) + ' to ' + md(M.ws[M.n - 1].at) + '. Trend now ' + dp1(W(lastSm)) + ' ' + U() + (fit ? ', projected plateau ' + dp1(W(fit.Winf)) + ' ' + U() : '')) + '">';
      /* three level lines, labeled in the person's unit */
      [hi - 1.5, (hi + lo) / 2, lo + 1.5].forEach(function(v){
        s += '<path d="M ' + Lx + ' ' + Y(v) + ' H ' + Rx + '" stroke="rgba(207,209,213,0.238)" stroke-width="1" stroke-dasharray="2 6" fill="none"></path>' +
          '<text x="' + (Lx - 8) + '" y="' + (Y(v) + 5) + '" text-anchor="end" fill="#EDEEEF" style="' + FT + 'font-size:13px">' + esc(String(Math.round(W(v, 0)))) + '</text>';
      });
      if(fit){
        s += '<path d="M ' + Lx + ' ' + Y(fit.Winf) + ' H ' + Rx + '" stroke="#FFB85C" stroke-width="1.5" stroke-dasharray="6 6" fill="none" opacity=".85"></path>' +
          '<text x="' + (Lx + 6) + '" y="' + (Y(fit.Winf) - 7) + '" fill="#FFB85C" style="' + FH + 'font-size:14px">' + esc('Plateau ' + dp1(W(fit.Winf)) + ' ' + U()) + '</text>';
      }
      var r = M.n > 120 ? 1.8 : M.n > 50 ? 2.4 : 3.2;
      for(var i = 0; i < M.n; i++) s += '<circle data-pt="1" cx="' + X(xs[i]) + '" cy="' + Y(ys[i]) + '" r="' + r + '" fill="rgba(237,238,239,0.468)"></circle>';
      s += '<polyline data-trend="1" points="' + xs.map(function(x, k){ return X(x) + ',' + Y(sm[k]); }).join(' ') + '" fill="none" stroke="#5CF2B0" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round" style="filter:drop-shadow(0 0 6px rgba(92,242,176,.8))"></polyline>';
      var lx = X(days), ly = Y(lastSm);
      s += '<circle cx="' + lx + '" cy="' + ly + '" r="8" fill="#5CF2B0" style="filter:drop-shadow(0 0 8px #5CF2B0)"></circle><circle cx="' + lx + '" cy="' + ly + '" r="3" fill="#FFFFFF"></circle>';
      s += '<text x="' + Lx + '" y="' + (By + 30) + '" fill="#EDEEEF" style="' + FH + 'font-size:15px">' + esc(md(M.t0)) + '</text>' +
        '<text x="' + Rx + '" y="' + (By + 30) + '" text-anchor="end" fill="#FFFFFF" style="' + FH + 'font-size:15px">' + esc(md(M.ws[M.n - 1].at)) + '</text>';
      return s + '</svg>';
    }
    function weightSec(M){
      var weigh = '<div class="yd-acts"><button type="button" class="c3-btn-quiet yd-btn" data-sheet="weigh" data-key="weigh">' + h.icon('plus', 17, 3) + '<span>Weigh in</span></button></div>';
      if(M.n < 3) return yd.sec('Weight', yd.empty(M.n ? M.n + ' of 3 weigh-ins. The third draws the trend.' : 'No weigh-in yet. Three draw the trend.') + weigh, {id:'weight'});
      var mini = [];
      mini.push(M.stall ? ['Stalled', '14 days', 'warn'] : M.f14 ? [sgn(W(M.f14.slope * 7, 2), 1), U() + ' / wk · 14 d'] : [M.n14 + '/5', 'weigh-ins · 14 d']);
      if(M.reg) mini.push([sgn(W(M.lo, 2), 2) + ' to ' + sgn(W(M.hi, 2), 2), '95% range · 28 d']);
      if(M.fit) mini.push([dp1(W(M.fit.Winf)), U() + ' plateau']);
      var line = M.reg ? (M.real ? 'A real change: the 28-day range stays clear of zero.' : 'Not a real change yet: the 28-day range crosses zero.') : '';
      return yd.sec('Weight', chart(M) + yd.stats(mini, 'bdy-mini') + (line ? '<p class="bdy-line' + (M.real ? '' : ' flat') + '">' + esc(line) + '</p>' : '') + weigh, {id:'weight', n: M.n});
    }

    /* ---------------- muscle or fat (renderComp's math, from the body record) ---------------- */
    function compModel(){
      var b = B(), ws = (safe(function(){ return (ALL.weights || []).slice(); }, []) || []).sort(function(a, c){ return a.at - c.at; });
      var wNow = ws.length ? ws[ws.length - 1].lb : (b.wt || 0), wThen = ws.length ? ws[0].lb : (b.wt0 || wNow);
      var sex = b.sex || '', ht = num(b.htIn);
      var need = [];
      /* v366: one plain sentence ("Needs waist and neck now, waist and neck at the start." read as a stutter) */
      var wnNow = !(b.waist > 0) || !(b.neck > 0), wnThen = !(b.waist0 > 0) || !(b.neck0 > 0);
      if(!sex) need.push('your sex'); if(!(ht > 0)) need.push('your height');
      if(wnNow && wnThen) need.push('your waist and neck, today and at the start');
      else if(wnNow) need.push('your waist and neck today');
      else if(wnThen) need.push('your waist and neck at the start');
      if(sex === 'female' && (!(b.hip > 0) || !(b.hip0 > 0))) need.push('your hips');
      if(!(wNow > 0)) need.push('a weigh-in');
      var M = {b: b, sex: sex, ht: ht, wNow: wNow, wThen: wThen, need: need};
      if(need.length) return M;
      var bfN = safe(function(){ return navyBF(sex, ht, b.waist, b.neck, b.hip); }, null), bfT = safe(function(){ return navyBF(sex, ht, b.waist0, b.neck0, b.hip0); }, null);
      if(bfN == null || bfT == null){ M.bad = 'Waist must be larger than neck for the circumference method to resolve.'; return M; }
      var fmN = wNow * bfN / 100, fmT = wThen * bfT / 100;
      M.bfN = bfN; M.bfT = bfT; M.dW = wNow - wThen; M.dFM = fmN - fmT; M.dFF = (wNow - fmN) - (wThen - fmT);
      M.share = M.dW !== 0 ? M.dFF / M.dW * 100 : 0;
      M.protein = Math.round(wNow * 0.4536 * 1.4);
      return M;
    }
    function compSec(M, ctx){
      var b = M.b, f = M.sex === 'female', out = '';
      if(!M.need.length && !M.bad){
        out += yd.stats([[sgn(W(M.dW), 1), U() + ' total'], [sgn(W(M.dFM), 1), U() + ' fat', M.dFM < 0 ? 'good' : ''], [sgn(W(M.dFF), 1), U() + ' lean', M.dFF < 0 && M.dW < 0 && M.share > 30 ? 'bad' : ''],
          /* the share of the LOSS that was lean: none when lean mass held or grew (the old card printed the size of the gain as a share) */
          [M.dW < 0 ? (M.dFF >= 0 ? '0%' : Math.round(Math.abs(M.share)) + '%') : '·', 'lean share', M.dW < 0 ? (M.dFF >= 0 ? 'good' : M.share > 30 ? 'bad' : M.share > 20 ? 'warn' : 'good') : '']], 'bdy-four');
        var verdict = M.dW >= 0 ? 'Weight is not down over this run, so there is no loss to split.'
          : M.share > 30 ? 'More lean lost than trials report. Protein floor about ' + M.protein + ' g a day, and load the muscle twice a week.'
          : M.share > 20 ? 'Inside the usual range, worth holding down. Protein floor about ' + M.protein + ' g a day.'
          : M.dFF >= 0 ? 'No lean lost: all of it was fat, and lean mass held. Protein near ' + M.protein + ' g a day keeps it there.'
          : 'A good split: fat off, muscle kept. Protein near ' + M.protein + ' g a day.';
        out += '<p class="bdy-line"><b class="c3-num">' + esc(dp1(M.bfT) + '% → ' + dp1(M.bfN) + '%') + '</b> body fat. ' + esc(verdict) + '</p>';
        var hk = safe(function(){ var r = ALL.hkBodyFat || []; var l = r[r.length - 1]; return l && Date.now() - l.at <= 21 * DAYMS ? l : null; }, null);
        if(hk) out += '<p class="bdy-line flat">A scale in Health reads <b class="c3-num">' + esc(dp1(hk.pct)) + '%</b>, ' + esc(md(hk.at)) + '. Two methods, two errors: follow the trend in each.</p>';
      } else {
        var nd = M.need.length > 1 ? M.need.slice(0, -1).join(', ') + ' and ' + M.need[M.need.length - 1] : M.need[0];
        out += yd.empty(M.bad || ('Add ' + nd + '.'));
      }
      var fld = function(key, label, inch){ return yd.input('bf', inch > 0 ? L(inch, metric() ? 1 : 2) : '', label + ' (' + LU() + ')', {type:'number', step: metric() ? '0.5' : '0.25', mode:'decimal', extra:'data-f="' + key + '"', k:key}); };
      out += '<div class="bdy-set">' +
        '<div class="bdy-field"><span class="k">Sex</span>' + yd.seg('sex', [['male', 'Male'], ['female', 'Female']], M.sex, {aria:'Sex', cls:'bdy-seg'}) + '</div>' +
        '<div class="yd-fields three">' + fld('htIn', 'Height', b.htIn) + yd.input('dob', safe(function(){ return bodyDob(); }, '') || '', 'Born', {type:'date'}) + '<span></span>' +
          fld('waist', 'Waist now', b.waist) + fld('neck', 'Neck now', b.neck) + (f ? fld('hip', 'Hips now', b.hip) : '<span></span>') +
          fld('waist0', 'Waist at start', b.waist0) + fld('neck0', 'Neck at start', b.neck0) + (f ? fld('hip0', 'Hips at start', b.hip0) : '<span></span>') +
        '</div></div>';
      return yd.sec('Muscle or fat', out, {id:'comp'});
    }

    /* ---------------- tape ---------------- */
    var TORSO = ['neck', 'shoulder', 'chest', 'waist', 'abdomen', 'hip'];
    function tapeSec(ctx){
      var last = safe(function(){ return tapeLatest(); }, null), b = B(), d = ctx.state.draft || (ctx.state.draft = {});
      var R = safe(function(){ return whtr(last && last.waist ? last.waist : b.waist, b.htIn); }, null);
      var out = '';
      if(R){
        var pos = Math.max(0, Math.min(1, (R.r - 0.35) / 0.35));
        out += '<div class="bdy-ratio ' + tone(R.k) + '"><b class="c3-num">' + R.r.toFixed(2) + '</b><span>waist ÷ height<br>' + esc(R.word) + '</span></div>' +
          '<div class="bdy-band" role="img" aria-label="' + esc('Waist to height ' + R.r.toFixed(2) + ', bands at 0.4, 0.5 and 0.6') + '"><i class="z1"></i><i class="z2"></i><i class="z3"></i><i class="z4"></i><em style="left:' + (Math.round(pos * 1000) / 10) + '%"></em>' +
            '<span style="left:' + (5 / 35 * 100).toFixed(1) + '%">0.4</span><span style="left:' + (15 / 35 * 100).toFixed(1) + '%">0.5</span><span style="left:' + (25 / 35 * 100).toFixed(1) + '%">0.6</span></div>' +
          (R.over > 0 ? '<p class="bdy-line"><b class="c3-num">' + esc(L(R.over, 1) + ' ' + LU()) + '</b> off the waist lands inside the healthy band (NICE NG246).</p>' : '');
      }
      var sites = safe(function(){ return TAPE_SITES.slice(); }, []) || [];
      var shown = ctx.state.allSites ? sites : sites.filter(function(s){ return TORSO.indexOf(s.k) >= 0; });
      out += '<ul class="bdy-tape">' + shown.map(function(s){
        var ch = safe(function(){ return tapeChange(s.k); }, null);
        var known = {neck: b.neck, waist: b.waist, hip: b.hip}[s.k];
        var v = d[s.k] != null ? d[s.k] : (last && last[s.k] != null ? last[s.k] : (known > 0 ? known : null));
        var chs = ch ? (ch.one ? '<span class="ch">first</span>' : '<span class="ch ' + (ch.d < 0 ? 'down' : ch.d > 0 ? 'up' : '') + '"><b class="c3-num">' + esc(sgn(L(ch.d, 2), metric() ? 1 : 2)) + '</b> since ' + esc(md(ch.fromAt)) + '</span>') : '<span class="ch"></span>';
        return '<li><label class="bdy-site"><span class="n">' + esc(s.n) + '</span>' +
          '<input class="yd-in" type="number" data-chg="tape" data-site="' + esc(s.k) + '" data-key="tape-' + esc(s.k) + '" step="' + (metric() ? '0.5' : '0.25') + '" min="0" inputmode="decimal" placeholder="' + esc(LU()) + '" value="' + (v == null ? '' : esc(L(v, metric() ? 1 : 2))) + '" aria-label="' + esc(s.n + ' in ' + (metric() ? 'centimeters' : 'inches') + '. ' + s.s) + '"></label>' + chs + '</li>';
      }).join('') + '</ul>';
      var asym = safe(function(){ return tapeAsym(); }, []) || [];
      if(asym.length) out += '<p class="bdy-line flat">' + asym.map(function(a){ return '<b>' + esc(a.n) + '</b> <span class="c3-num">' + esc(L(Math.abs(a.d), 2)) + ' ' + esc(LU()) + '</span> bigger on the ' + esc(a.bigger); }).join(' · ') + '</p>';
      out += '<div class="yd-acts">' + yd.btn('tapesave', 'Save', {icon:'check'}) + yd.btn('allsites', ctx.state.allSites ? 'Torso only' : 'All ' + sites.length + ' sites') + '</div>' +
        (last ? '<p class="bdy-when">Last measured ' + esc(md(last.at)) + '</p>' : '');
      return yd.sec('Tape', out, {id:'tape'});
    }

    /* ---------------- blood pressure ---------------- */
    function bpSec(ctx){
      var A = safe(function(){ return bpAverage(30); }, null), T = safe(function(){ return bpTrend(90); }, null);
      var rows = (safe(function(){ return bpLog().slice(); }, []) || []).reverse(), out = '';
      if(A){
        out += '<div class="bdy-bp ' + tone(A.cat && A.cat.k) + '"><b class="c3-num">' + A.s + '<i>/' + A.d + '</i></b><span>' + esc(A.cat ? A.cat.n : '') + '<br>' + (A.single ? 'one reading' : A.n + '-reading average, 30 d') + (A.p ? ' · pulse ' + A.p : '') + '</span></div>';
        if(T && T.sys) out += '<p class="bdy-line flat">' + (T.sys.real ? 'Systolic ' + (T.sys.per30 > 0 ? 'up ' : 'down ') + '<b class="c3-num">' + esc(Math.abs(T.sys.per30).toFixed(1)) + '</b> a month over ' + T.days + ' days.' : 'Systolic is flat over ' + T.days + ' days.') + '</p>';
      } else out += yd.empty('No reading yet.');
      var r0 = rows[0] || {};
      out += '<div class="yd-fields three">' +
        yd.input('bps', ctx.state.bps != null ? ctx.state.bps : (r0.s || ''), 'Systolic', {type:'number', mode:'numeric', min:40, maxv:299, step:'1', ph:'120'}) +
        yd.input('bpd', ctx.state.bpd != null ? ctx.state.bpd : (r0.d || ''), 'Diastolic', {type:'number', mode:'numeric', min:20, maxv:219, step:'1', ph:'80'}) +
        yd.input('bpp', ctx.state.bpp != null ? ctx.state.bpp : (r0.p || ''), 'Pulse', {type:'number', mode:'numeric', min:20, maxv:249, step:'1', ph:'bpm'}) + '</div>' +
        (ctx.state.bpMsg ? yd.note(esc(ctx.state.bpMsg), 'warn') : '') +
        '<div class="yd-acts">' + yd.btn('bplog', 'Log it', {icon:'plus'}) + '</div>';
      var show = ctx.state.bpAll ? rows : rows.slice(0, 5);
      if(rows.length) out += '<ul class="bdy-rows">' + show.map(function(r){
        var c = safe(function(){ return bpCat(r.s, r.d); }, null) || {};
        return '<li><span class="w">' + esc(md(r.at)) + '</span><b class="c3-num">' + r.s + '/' + r.d + '</b><span class="t ' + tone(c.k) + '">' + esc(c.n || '') + '</span>' +
          '<button type="button" class="c3-btn-quiet bdy-x" data-act="bpdel" data-v="' + r.at + '" data-key="bpdel-' + r.at + '" aria-label="Remove ' + r.s + '/' + r.d + ' from ' + esc(md(r.at)) + '">' + h.icon('x', 15, 2.4) + '</button></li>';
      }).join('') + '</ul>' + (rows.length > 5 ? '<div class="yd-acts">' + yd.btn('bpall', ctx.state.bpAll ? 'Fewer' : 'All ' + rows.length) + '</div>' : '');
      return yd.sec('Blood pressure', out, {id:'bp'});
    }

    /* ---------------- scans ---------------- */
    var MIR = {els: []};
    function scansSec(ctx){
      var log = safe(function(){ return compLog(); }, []) || [], used = safe(function(){ return compMethodsUsed(); }, []) || [];
      var latest = used.map(function(u){ return safe(function(){ return compLatest(u.m); }, null); }).filter(Boolean).sort(function(a, b){ return b.at - a.at; });
      var out = '';
      latest.forEach(function(r){
        var Mth = safe(function(){ return compMethod(r.m); }, null) || {n: r.m}, ch = safe(function(){ return compChange('bf', r.m); }, null);
        var st = [];
        if(r.bf != null) st.push([dp1(r.bf) + '%', 'body fat']);
        if(r.lean != null) st.push([dp1(W(r.lean)), U() + ' lean']);
        if(r.fat != null) st.push([dp1(W(r.fat)), U() + ' fat']);
        if(r.vat) st.push([safe(function(){ return vatWord(r.vat); }, ''), 'visceral']);
        out += '<div class="bdy-scan"><div class="bdy-scanh"><b>' + esc(Mth.n) + '</b><span>' + esc(md(r.at)) + '</span>' +
          '<button type="button" class="c3-btn-quiet bdy-x" data-act="scandel" data-v="' + r.at + '" data-m="' + esc(r.m) + '" data-key="scandel-' + r.at + '" aria-label="Delete the ' + esc(Mth.n) + ' scan of ' + esc(md(r.at)) + '">' + h.icon('x', 15, 2.4) + '</button></div>' +
          yd.stats(st, 'bdy-mini') + (ch && !ch.one ? '<p class="bdy-line flat"><b class="c3-num">' + esc(sgn(ch.d, 1)) + '</b> points body fat since ' + esc(md(ch.fromAt)) + ', ' + ch.n + ' scans</p>' : '') + '</div>';
      });
      var mix = safe(function(){ return compMixWarning(); }, null);
      if(latest.length > 1 && mix) out += yd.note('Different instruments are trended each against itself, never against each other.', 'warn');
      if(!log.length) out += yd.empty('No DEXA, InBody or Withings report yet.');
      /* the importer: the app's own, its result mirrored */
      var P = safe(function(){ return COMPUI; }, {}) || {};
      out += '<label class="yd-field"><span class="k">Paste a report</span><textarea class="yd-ta bdy-ta" data-chg="paste" data-key="paste" spellcheck="false" placeholder="DEXA, InBody, BodySpec, Withings or Tanita text">' + esc(P.paste || '') + '</textarea></label>' +
        '<div class="yd-acts">' + yd.btn('compread', 'Read it', {icon:'check'}) + yd.btn('compman', P.open === 'manual' ? 'Close' : 'Type it in') + (P.paste || P.parsed ? yd.btn('compclear', 'Clear') : '') + '</div>';
      MIR.els = [];
      if(P.parsed || P.open === 'manual'){
        var host = document.getElementById('bdComp');
        /* the app's importer is redrawn only when what it shows changes (read, re-read in another unit, the
           type-it-in form opened, a scan saved), so a date or a number half entered in it keeps what was entered */
        var sig = [P.parsed ? (P.parsed.ok ? 'ok' : 'no') + (P.parsed.unit ? P.parsed.unit.u : '') : '', P.open || '', log.length].join('|');
        if(host && (host.getAttribute('data-c3') !== sig || !host.querySelector('.impres, .manbox'))){ safe(function(){ renderComp2(); }); host.setAttribute('data-c3', sig); }
        var src = host && (host.querySelector('.impres') || null), man = host && host.querySelector('.manbox');
        var html = '';
        if(src){ var m1 = yd.mirror(src, {els: MIR.els}); html += m1.html; }
        if(man){ var m2 = yd.mirror(man, {els: MIR.els}); html += m2.html; }
        if(html) out += '<div class="bdy-mir">' + html + '</div>';
      }
      return yd.sec('Scans', out, {id:'scans', n: log.length || null});
    }

    yd.screen('body', {
      parent: 'progress', nav: 'progress', old: ['progress', 'body'],
      render: function(ctx){
        var Mw = weightModel(), Mc = compModel(), b = B();
        var last = safe(function(){ return tapeLatest(); }, null), R = safe(function(){ return whtr(last && last.waist ? last.waist : b.waist, b.htIn); }, null);
        var A = safe(function(){ return bpAverage(30); }, null);
        var top = [];
        if(Mw.n >= 3) top.push([dp1(W(Mw.sm[Mw.sm.length - 1])), U() + ' trend']);
        else if(Mw.n) top.push([dp1(W(Mw.ws[Mw.n - 1].lb)), U()]);
        if(Mw.reg) top.push([sgn(W(Mw.wk, 2), 1), U() + ' / week', Mw.real ? '' : 'flat']);
        if(R) top.push([R.r.toFixed(2), 'waist ÷ height', tone(R.k)]);
        if(Mc.bfN != null) top.push([dp1(Mc.bfN) + '%', 'body fat']);
        if(A) top.push([A.s + '/' + A.d, 'blood pressure', tone(A.cat && A.cat.k)]);
        var eye = Mw.n ? 'Weighed ' + md(Mw.ws[Mw.n - 1].at) : 'No weigh-in yet';
        var scan = safe(function(){ return scanSupported(); }, false);
        return '<div class="yd bdy">' + yd.head({back:'progress', eyebrow: eye, title:'Your', pk:'body'}) +
          (top.length ? yd.stats(top, 'bdy-top') : '') +
          '<div class="yd-cols even"><div class="yd-col">' + weightSec(Mw) + compSec(Mc, ctx) + '</div>' +
          '<div class="yd-col">' + tapeSec(ctx) + bpSec(ctx) + scansSec(ctx) +
            (scan ? '<ul class="yd-list">' + yd.linkRow('phonescan', 'Phone scan', 'camera') + '</ul>' : '') + '</div></div></div>';
      },
      wire: function(root, ctx){
        var after = function(msg){ try{ save(); }catch(e){} try{ syncBodyInputs(); }catch(e){} try{ drawAll(); }catch(e){} if(msg) yd.toast(msg); C3.refresh(); };
        var setBody = function(key, inch){
          var b = B(), ws = (safe(function(){ return (ALL.weights || []).slice(); }, []) || []).sort(function(a, c){ return a.at - c.at; });
          if(inch == null) delete b[key]; else b[key] = inch;
          /* the weights renderComp writes beside them: first and latest weigh-in */
          if(ws.length){ b.wt = ws[ws.length - 1].lb; b.wt0 = ws[0].lb; }
          after();
        };
        var mir = yd.mirrorActs(function(){ return MIR.els; }, function(){ setTimeout(function(){ C3.render(); }, 30); });
        var mirC = yd.mirrorChgs(function(){ return MIR.els; }, function(){ setTimeout(function(){ C3.render(); }, 30); });
        yd.wire(root, ctx, {
          sex: function(v){ var b = B(); if(b.sex === v) return; b.sex = v; setBody('sex', v); },
          tapesave: function(){
            var r = tapeSave(ctx.state.draft || {});
            if(!r){ yd.toast('Put at least one measurement in first.'); return; }
            ctx.state.draft = {};
            var b = B();
            if(r.row.waist > 0) b.waist = r.row.waist;
            if(r.row.neck > 0) b.neck = r.row.neck;
            if(r.row.hip > 0) b.hip = r.row.hip;
            after('Measurements saved.');
          },
          allsites: function(){ ctx.state.allSites = !ctx.state.allSites; C3.render(); },
          bplog: function(){
            var g = function(k){ var el = root.querySelector('[data-chg="' + k + '"]'); return el ? el.value.trim() : ''; };
            var s = num(g('bps')), d = num(g('bpd')), p = g('bpp') ? num(g('bpp')) : null;
            ctx.state.bpMsg = '';
            if(!(s > 0) || !(d > 0)){ ctx.state.bpMsg = 'Both numbers are needed.'; C3.render(); return; }
            if(d >= s){ ctx.state.bpMsg = 'The bottom number has to be below the top one.'; C3.render(); return; }
            var r = bpAdd(s, d, p);
            if(!r){ ctx.state.bpMsg = 'That is outside what a cuff can read.'; C3.render(); return; }
            ctx.state.bps = ctx.state.bpd = ctx.state.bpp = null;
            after('<b>' + r.s + '/' + r.d + '</b> logged, ' + esc(bpCat(r.s, r.d).n) + '.');
          },
          bpdel: function(v){
            var gone = bpDelete(+v);
            after();
            if(gone) yd.undo('Removed <b>' + gone.s + '/' + gone.d + '</b>.', function(){
              bpLog().push(gone); bpLog().sort(function(a, c){ return a.at - c.at; });
              if(ALL.tomb && ALL.tomb.bp) delete ALL.tomb.bp[String(gone.at)];
              after();
            });
          },
          bpall: function(){ ctx.state.bpAll = !ctx.state.bpAll; C3.render(); },
          scandel: function(v, el){
            var m = el.getAttribute('data-m'), gone = compDelete(+v, m);
            after();
            if(gone) yd.undo('Scan removed.', function(){ compSave(gone); after(); });
          },
          compread: function(){ COMPUI.parsed = dexaParse(COMPUI.paste || '', {}); COMPUI.open = ''; C3.render(); },
          compman: function(){ COMPUI.open = COMPUI.open === 'manual' ? '' : 'manual'; C3.render(); },
          compclear: function(){ COMPUI.paste = ''; COMPUI.parsed = null; C3.render(); },
          phonescan: function(){
            yd.old('progress', 'body');
            setTimeout(function(){ var el = document.getElementById('bdScan'); if(el) el.scrollIntoView({block:'start'}); }, 120);
          },
          mir: function(v, el, c, ev){ mir.mir(v); setTimeout(function(){ try{ save(); }catch(e){} C3.refresh(); }, 60); },
          mirck: mir.mirck
        }, {
          bf: function(v, el){ var k = el.getAttribute('data-f'); var n = String(v).trim() === '' ? null : num(v); if(n != null && !(n > 0)) return; setBody(k, n == null ? null : Math.round(lIn(n) * 100) / 100); },
          dob: function(v){ setBodyDob(v); after(); },
          tape: function(v, el){ var k = el.getAttribute('data-site'), d = ctx.state.draft || (ctx.state.draft = {}); if(String(v).trim() === '') delete d[k]; else d[k] = Math.round(lIn(+v) * 100) / 100; },
          bps: function(v){ ctx.state.bps = v; }, bpd: function(v){ ctx.state.bpd = v; }, bpp: function(v){ ctx.state.bpp = v; },
          paste: function(v){ COMPUI.paste = v; },
          mirin: mirC.mirin, mirsel: mirC.mirsel
        });
        /* a tape field keeps what is typed before a Save, even across a repaint */
        root.querySelectorAll('[data-chg="tape"]').forEach(function(el){ el.addEventListener('input', function(){ var k = el.getAttribute('data-site'), d = ctx.state.draft || (ctx.state.draft = {}); if(el.value.trim() === '') delete d[k]; else d[k] = Math.round(lIn(+el.value) * 100) / 100; }); });
        var ta = root.querySelector('[data-chg="paste"]'); if(ta) ta.addEventListener('input', function(){ COMPUI.paste = ta.value; });
        ['bps', 'bpd', 'bpp'].forEach(function(k){ var el = root.querySelector('[data-chg="' + k + '"]'); if(el) el.addEventListener('input', function(){ ctx.state[k] = el.value; }); });
      }
    });
  });
  if(C3.yd && C3.yd.drain) C3.yd.drain();
})();
