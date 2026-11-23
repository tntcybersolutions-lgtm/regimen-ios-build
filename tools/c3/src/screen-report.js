/* C3 screen: report (the old You > Report pane, #p-report: the full record, the link for the
   doctor, the questions with answers).
   The record first: its numbers, the period, then one control to print it or save it as a
   PDF. Under it the sections of the document, folded, a CSV, the read-only link for a
   clinician, and the server reports.
   The document, the link block and the questions are drawn by the app exactly where they
   always were (renderReport, renderShare, renderHub write into #rpDoc, #shareBody, #hubBody
   in a pane nobody sees); this screen shows them through yd.mirror and every control here
   presses the app's own control, so what prints, what the CSV holds and what a link carries
   are the app's, unchanged. Printing prints the app's document, not this screen.
   The report is part of Pro (PRO_PANES): when the app's isPro() says no (billing live and the
   trial over) it shows the app's lock with the app's one control (yd.lock), like the old screen. */
(function(){
  'use strict';
  var C3 = window.C3; if(!C3) return;
  (C3.ydq = C3.ydq || []).push(function(yd){
    var h = C3.h, esc = h.esc, safe = yd.safe;
    var PERIODS = [[4, '4 wk'], [8, '8 wk'], [12, '12 wk'], [18, '18 wk'], [26, '26 wk'], [0, 'All']];
    var els = [], stale = true, stamp = '', foldAll = false;
    function $(id){ return document.getElementById(id); }

    /* have the app draw its blocks (cheap to skip: only when something changed) */
    function sync(){
      var s = safe(function(){ return [ALL.updatedAt || 0, RP.weeks, unitSys(), yd.signedIn()].join('|'); }, '');
      if(!stale && s === stamp) return;
      stale = false; stamp = s;
      try{
        renderReport();
        /* arriving: every section folded, so the numbers are what is seen first. Print opens them all
           (the app's own print CSS), and a section the person opens stays open. */
        if(foldAll){ foldAll = false; Object.keys(FOLD).forEach(function(k){ if(k.indexOf('rp:') === 0) FOLD[k].open = false; }); renderReport(); }
      }catch(e){ console.error('[c3] report doc', e); }
      try{ renderShare(); }catch(e){ console.error('[c3] report link', e); }
    }
    function after(){ yd.settle(); }

    /* PRINT: the app's own button. While the print dialog is up the old document is what the
       printer sees and the C3 host is out of the way (html.c3-printing, set here and nowhere else). */
    function printDoc(){
      var pane = $('p-report'), btn = $('rpPrint'), root = document.documentElement;
      if(!pane || !btn){ yd.old('profile', 'report'); return; }
      var wasHidden = pane.hidden, seen = false, n = 0, t = 0;
      var done = function(){
        clearInterval(t); window.removeEventListener('afterprint', done);
        root.classList.remove('c3-printing');
        if(wasHidden && safe(function(){ return curPane !== 'report'; }, true)) pane.hidden = true;
      };
      root.classList.add('c3-printing'); pane.hidden = false;
      window.addEventListener('afterprint', done);
      /* the app takes body.printing off again when the dialog has closed: that is the end */
      t = setInterval(function(){ var on = document.body.classList.contains('printing'); if(on) seen = true; if((seen && !on) || ++n > 1500) done(); }, 200);
      try{ btn.click(); }catch(e){ done(); console.error('[c3] report print', e); }
    }

    yd.screen('report', {
      parent: 'you', old: ['profile', 'report'],
      enter: function(){
        stale = true; foldAll = true;
        safe(function(){ if(yd.signedIn() && SHARE_UI.list == null) Promise.resolve(shareLoad()).then(function(){ stale = true; C3.refresh(); }, function(){}); });
        yd.settle();
      },
      render: function(ctx){
        if(safe(function(){ return !!PRO_PANES.report && !isPro(); }, false)){   /* v328: the report is free (PRO_PANES no longer has it) */
          /* the app's lock, in this look: its words, its one control (yd.lock), and the export, which stays free */
          return '<div class="yd rp locked" data-state="locked">' + yd.head({back:'you', eyebrow:'Pro', title:'Your', pk:'report'}) +
            '<section class="yd-sec rp-lock">' + yd.lock('report', 'The report is part of Pro', {part:true}) +
            '<ul class="yd-list">' + yd.linkRow('data', 'Export my data', '', 'data-go="data"') + '</ul></section></div>';
        }
        sync();
        els = [];
        var doc = $('rpDoc'), weeks = safe(function(){ return +RP.weeks; }, 18);
        var has = function(el, c){ return !!(el.classList && el.classList.contains(c)); };
        var tiles = yd.mirror(doc, {els: els, skip: function(el){ return !has(el, 'rptiles'); }}).html;
        var body = yd.mirror(doc, {els: els, skip: function(el){ return has(el, 'rptiles') || has(el, 'rphead') || el.id === 'rpPhotos'; }}).html;
        var span = safe(function(){ return doc.querySelector('.rphead .eyebrow').textContent.replace(/\s+/g, ' ').trim(); }, '');
        var gen = safe(function(){ return doc.querySelector('.rpstamp').textContent.replace(/\s+/g, ' ').trim(); }, '');
        var link = yd.mirror($('shareBody'), {els: els}).html, hub = yd.mirror($('hubBody'), {els: els}).html;

        var top = '<section class="rp-top" aria-label="The full record">' +
          '<p class="rp-span">' + esc(span) + '</p>' + tiles +
          yd.seg('weeks', PERIODS, weeks, {aria:'Period', cls:'fill rp-weeks txt'}) + '</section>';
        var act = '<section class="rp-act" aria-label="Print">' + yd.primary('print', 'Print', '<span>or save</span><span>as PDF</span>', {icon:'arrow'}) +
          '<div class="yd-acts">' + yd.btn('csv', 'Download CSV', {icon:'down'}) + '</div>' + (gen ? '<p class="yd-src">' + esc(gen) + '. A clean paper copy, with the app left off.</p>' : '') + '</section>';
        return '<div class="yd rp" data-state="open" data-weeks="' + weeks + '">' + yd.head({back:'you', eyebrow: weeks ? weeks + ' weeks' : 'Everything', title:'Your', pk:'report'}) +
          '<div class="yd-cols rp-cols"><div class="yd-col rp-a">' + top + act + yd.sec('In the record', '<div class="rp-doc">' + body + '</div>', {id:'doc'}) + '</div>' +
          '<div class="yd-col rp-b">' + yd.sec('A link for the doctor', '<div class="rp-link">' + link + '</div>', {id:'link'}) + yd.sec('Questions with answers', '<div class="rp-hub">' + hub + '</div>', {id:'hub'}) + '</div></div></div>';
      },
      wire: function(root, ctx){
        var get = function(){ return els; };
        var acts = yd.mirrorActs(get, function(){ stale = false; after(); }), chgs = yd.mirrorChgs(get, function(){ after(); });
        acts.weeks = function(v){ var sel = $('rpWeeks'); if(!sel) return; sel.value = String(v); try{ sel.dispatchEvent(new Event('change', {bubbles:true})); }catch(e){} stale = false; stamp = ''; C3.render(); };
        acts.print = function(){ printDoc(); };
        acts.csv = function(){ var b = $('rpCsv'); if(b) b.click(); };
        acts.buy = yd.lockActs.buy; acts.restore = yd.lockActs.restore;
        yd.wire(root, ctx, acts, chgs);
      }
    });
  });
  if(C3.yd && C3.yd.drain) C3.yd.drain();
})();
