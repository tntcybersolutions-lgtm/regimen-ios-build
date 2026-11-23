/* C3 screen: data. Your data, out and in.
   Export first: everything you logged as one file (the app's own "Export everything":
   dataPanel('exp'), its Save and Copy buttons pressed as they are), and the simple CSV.
   Then, apart from it, bringing data in: a CSV from another tracker (the app's own preview,
   shown through yd.mirror, nothing written until "Bring it in"), or a backup, which REPLACES
   everything on this device and is confirmed on the control itself (press twice), never
   with a browser dialog. Then the documents attached to the log.
   "Print every screen" is the old Share card's "Print / Save PDF", kept as one quiet control.
   v329 (privacy, Chad's list: "data stays on your phone"): the photos go out as their own file and come back in, and
   Erase this device removes everything this app keeps on it (the log, the photos, the sign-in), confirmed on the
   control itself. Deleting the account and its server copy stays on the Account screen. */
(function(){
  'use strict';
  var C3 = window.C3; if(!C3) return;
  (C3.ydq = C3.ydq || []).push(function(yd){
    var h = C3.h, esc = h.esc, safe = yd.safe;
    var els = [], SIZE = {bytes:0, at:-1, busy:false};
    function $(id){ return document.getElementById(id); }
    /* where the app builds its own panel for us: in the page, never seen */
    function host(){
      var el = $('c3ydData');
      if(!el){ el = document.createElement('div'); el.id = 'c3ydData'; el.hidden = true; el.setAttribute('aria-hidden', 'true'); document.body.appendChild(el); }
      return el;
    }
    function panel(mode){ yd.rawPanel(mode, host()); return $('dataTa'); }
    function measure(){
      var at = safe(function(){ return ALL.updatedAt || 0; }, 0);
      if(SIZE.at === at || SIZE.busy) return;
      SIZE.busy = true;
      setTimeout(function(){
        SIZE.busy = false; SIZE.at = at;
        SIZE.bytes = safe(function(){ return JSON.stringify(serialise(), null, 1).length; }, 0);
        if(C3.current === 'data') C3.refresh();
      }, 30);
    }
    function sizeWord(b){ return b >= 1048576 ? (Math.round(b / 104857.600) / 10) + ' MB' : b >= 1024 ? Math.round(b / 1024) + ' KB' : b + ' B'; }
    function isBackup(raw){ return raw && (raw[0] === '{' || raw[0] === '['); }
    function read(ctx, raw){
      raw = String(raw || '').trim();
      if(!raw){ yd.toast('Paste a backup or a CSV first, or choose a file.'); return; }
      ctx.state.imp = raw;
      if(isBackup(raw)){
        var what = safe(function(){ var o = JSON.parse(raw); var p = Array.isArray(o.protocols) ? o.protocols : null;
          if(p && p.length && p.every(function(x){ return x && typeof x.compound === 'string' && Array.isArray(x.doses); })) return {ok:true, sessions: Object.keys(o.workLog || {}).length, weights: (o.weights || []).length, food: (o.food || []).length, doses: p.reduce(function(t, x){ return t + x.doses.length; }, 0)};
          if(o && Array.isArray(o.doses) && typeof o.compound === 'string') return {ok:true, legacy:true, doses: o.doses.length, weights: (o.weights || []).length, sessions:0, food:0};
          return {ok:false}; }, {ok:false});
        ctx.set({pending: what, preview: false});
        return;
      }
      /* a CSV: the app's own reader and preview, drawn in its own (unseen) panel */
      var ta = panel('imp'); if(!ta) return;
      ta.value = raw;
      var b = $('loadBtn'); if(b) b.click();
      ctx.set({pending: null, preview: true});
      yd.settle();
    }

    yd.screen('data', {
      parent: 'you',
      /* no old pane of its own: the fallback is the app's export panel on the old Account pane (v297) */
      fall: function(){ yd.old('profile', 'youaccount'); try{ yd.rawPanel('exp', document.getElementById('acctCard')); }catch(e){} },
      enter: function(){ SIZE.at = -1; },
      leave: function(){ var b = $('dataBox'); if(b && b.parentNode && b.parentNode.id === 'c3ydData') b.remove(); },
      render: function(ctx){
        var pep = safe(function(){ return !!onPeptide(); }, false);
        var n = {
          sessions: safe(function(){ return Object.keys(ALL.workLog || {}).length; }, 0), food: safe(function(){ return (ALL.food || []).length; }, 0),
          weights: safe(function(){ return (ALL.weights || []).length; }, 0), ready: safe(function(){ return (ALL.ready || []).length; }, 0),
          doses: safe(function(){ return (ALL.protocols || []).reduce(function(t, p){ return t + ((p.doses || []).length); }, 0); }, 0)
        };
        var st = [[SIZE.at < 0 ? '·' : sizeWord(SIZE.bytes), 'One file'], [String(n.sessions), n.sessions === 1 ? 'Session' : 'Sessions'], [String(n.food), 'Food entries'], [String(n.weights), n.weights === 1 ? 'Weigh-in' : 'Weigh-ins'], [String(n.ready), n.ready === 1 ? 'Check-in' : 'Check-ins']];
        if(pep) st.push([String(n.doses), n.doses === 1 ? 'Dose' : 'Doses']);
        var exp = '<section class="dt-exp" aria-label="Export">' + yd.stats(st, 'dt-stats') +
          yd.primary('save', 'Save file', '<span>everything</span><span>JSON</span>', {icon:'down'}) +
          '<div class="yd-acts">' + yd.btn('copy', 'Copy it', {icon:'copy'}) + yd.btn('csv', 'Simple CSV', {icon:'down'}) + (document.getElementById('btnPrint') ? yd.btn('printall', 'Print every screen', {icon:'print'}) : '') + '</div>' +
          yd.note('Your data lives on this device. The export is plain JSON; nothing here holds it hostage.') + '</section>';

        /* ---- bringing data in ---- */
        var P = ctx.state.pending, imp;
        var prev = ctx.state.preview ? yd.mirror($('impPrev'), {els: (els = [])}).html : '';
        imp = '<label class="yd-field"><span class="k">Paste a backup, or a CSV from another tracker</span><textarea class="yd-ta dt-ta" data-chg="imp" data-key="imp" spellcheck="false" placeholder="date,weight\n2026-10-01,201.4">' + esc(ctx.state.imp || '') + '</textarea></label>' +
          '<div class="yd-acts"><label class="c3-btn-quiet yd-btn dt-pick" data-key="pick">' + yd.icon('file', 17, 2.200) + '<span>Choose a file</span><input type="file" class="dt-file" data-file="imp" accept=".csv,.tsv,.txt,.json,text/csv,text/plain,application/json"></label>' +
            yd.btn('read', 'Read it', {icon:'check'}) + ((ctx.state.imp || P || ctx.state.preview) ? yd.btn('clear', 'Clear', {pink:true, icon:'x'}) : '') + '</div>' +
          (P ? (P.ok
              ? '<div class="dt-danger" data-pending="backup"><p class="dt-warn">This is a backup' + (P.legacy ? ' from an older version' : '') + '.</p>' +
                yd.stats([[String(P.sessions), 'Sessions'], [String(P.food), 'Food entries'], [String(P.weights), 'Weigh-ins']].concat(pep || P.doses ? [[String(P.doses), 'Doses']] : []), 'dt-small') +
                yd.note('<b>Restoring it replaces everything on this device</b> with what is in the file. Save a file of what is here first if you want to keep it.', 'bad') +
                '<div class="yd-acts">' + yd.arm(ctx, 'restore', 'Replace everything with this backup', 'Tap again: everything here is replaced', {icon:'up'}) + '</div></div>'
              : '<div class="dt-danger" data-pending="bad">' + yd.note('That is not a backup this app made. Nothing was changed.', 'bad') + '</div>') : '') +
          (prev ? '<div class="dt-prev" data-preview="1">' + prev + '</div>' : '');
        var docs = safe(function(){ return ALL.files || []; }, []);
        /* v337: the room on this device, measured by the browser */
        var room = ctx.state.room, big = safe(function(){ return FILE_SYNC_MAX; }, 1.6e6);
        var mb = function(b){ return b >= 1e9 ? (Math.round(b / 1e8) / 10) + ' GB' : b >= 1e7 ? Math.round(b / 1e6) + ' MB' : b >= 1e6 ? (Math.round(b / 1e5) / 10) + ' MB' : Math.max(0, Math.round(b / 1e3)) + ' KB'; };
        /* what the documents take is their own sizes added up (exact); the room left is the browser's own measure */
        var inDocs = docs.reduce(function(a, f){ return a + (+f.size || 0); }, 0);
        var roomHtml = yd.stats([[mb(inDocs), 'in documents'], [room && room.quota ? mb(Math.max(0, room.quota - room.used)) : '\u00b7', 'more room on this device'], [String(docs.length) + ' / ' + safe(function(){ return FILES_MAX; }, 100), 'documents']], 'dt-small dt-room');
        if(room === undefined){ ctx.state.room = null; safe(function(){ filesRoom().then(function(r){ ctx.state.room = r || false; if(C3.current === 'data') C3.refresh(); }); }); }
        var files = yd.sec('Documents', roomHtml + (docs.length ? '<ul class="yd-list dt-files">' + docs.map(function(f, i){
            return '<li><div class="yd-row"><span class="l">' + esc(f.n) + '<small>' + esc(yd.day(f.at)) + ' · ' + ((f.size || 0) >= 1e6 ? (Math.round(f.size / 1e5) / 10) + ' MB' : Math.round((f.size || 0) / 1024) + ' KB') + ((f.size || 0) > big ? ' · this device only' : '') + '</small></span>' +
              yd.btn('openfile', 'Open', {v: i}) +
              yd.arm(ctx, 'rmfile', 'Remove', 'Tap again', {v: i, cls: 'dt-rm'}) + '</div></li>'; }).join('') + '</ul>' : yd.empty('No documents attached.')) +
          '<div class="yd-acts"><label class="c3-btn-quiet yd-btn dt-pick" data-key="attach">' + yd.icon('plus', 17, 2.400) + '<span>Attach a document</span><input type="file" class="dt-file" data-file="doc" accept="image/*,.pdf,.csv,.txt,.json"></label></div>' +
          '<p class="yd-src">Lab results, plans, photos. Up to 100, each up to 10 MB, kept on this device. Signed in, the ones up to 1.6 MB also go to your account.</p>', {id:'files', n: docs.length || null});
        var ph = ctx.state.phn;
        var priv = yd.sec('Your photos', '<p class="dt-ph"><b class="c3-num">' + (ph == null ? '\u00b7' : ph) + '</b> progress photos, on this device only, never sent anywhere.</p>' +
            '<div class="yd-acts">' + yd.btn('phout', 'Save my photos as a file', {icon: 'down'}) + '<label class="c3-btn-quiet yd-btn dt-phin"><input type="file" accept=".json,application/json" data-key="phin" hidden>' + yd.icon('up', 17, 2.2) + '<span>Bring photos back</span></label></div>', {id: 'photos'}) +
          yd.sec('This device', yd.note('Everything this app keeps on this phone or computer: the log, the photos, the sign-in. Your account on the server stays (delete it on the Account screen).') +
            '<div class="yd-acts">' + yd.arm(ctx, 'erase', 'Erase this device', 'Tap again: everything here is erased', {icon: 'trash'}) + '</div>', {id: 'erase'});
        if(ph == null) safe(function(){ PHOTOS.all().then(function(r){ ctx.state.phn = (r || []).length; if(C3.current === 'data') C3.refresh(); }, function(){ ctx.state.phn = 0; }); });
        var acct = yd.sec('On the server', '<ul class="yd-list">' + yd.linkRow('account', 'Account, sync and deleting the account', '') + '</ul>', {id:'server'});

        return '<div class="yd dt">' + yd.head({back:'you', eyebrow:'On this device', title:'Your', pk:'data'}) +
          '<div class="yd-cols even"><div class="yd-col">' + exp + files + '</div><div class="yd-col">' + yd.sec('Bring data in', imp, {id:'import'}) + priv + acct + '</div></div></div>';
      },
      wire: function(root, ctx){
        measure();
        var get = function(){ return els; };
        var acts = yd.mirrorActs(get, function(){ yd.settle(); }), chgs = yd.mirrorChgs(get, function(){ yd.settle(); });
        acts.save = function(){ panel('exp'); var b = $('saveJsonBtn'); if(b) b.click(); };
        acts.copy = function(){ panel('exp'); var b = $('copyBtn'); if(b) b.click(); };
        acts.csv = function(){
          var b = $('btnCsv'), note = $('shareNote'); if(!b) return;
          if(note) note.textContent = '';
          b.click();
          setTimeout(function(){ var t = note ? String(note.textContent || '').trim() : ''; if(t) yd.toast(esc(t)); }, 500);
        };
        /* the app's own "Print / Save PDF" (#btnPrint): it un-hides every old screen and prints them.
           While it prints, html.c3-printing puts the C3 host out of the way (screen-youdeep.js). */
        acts.printall = function(){
          var b = $('btnPrint'), el = document.documentElement; if(!b) return;
          var done = function(){ window.removeEventListener('afterprint', done); el.classList.remove('c3-printing'); };
          el.classList.add('c3-printing'); window.addEventListener('afterprint', done);
          try{ b.click(); }catch(e){ console.error('[c3] print all', e); }
          setTimeout(done, 1500);     /* window.print() blocks until the dialog is closed; this is the end in every case */
        };
        acts.read = function(){ var ta = root.querySelector('[data-chg="imp"]'); read(ctx, ta ? ta.value : ctx.state.imp); };
        acts.clear = function(){ var p = $('impPrev'); if(p) p.innerHTML = ''; els = []; ctx.set({imp: '', pending: null, preview: false}); };
        acts.restore = function(){
          var raw = String(ctx.state.imp || '').trim(), ta = panel('imp'); if(!ta || !raw) return;
          ta.value = raw;
          var b = $('loadBtn'); if(b) b.click();          /* the app's own restore: replaces ALL, saves, repaints, says what it loaded */
          ctx.state.imp = ''; ctx.state.pending = null; ctx.state.preview = false; SIZE.at = -1;
          yd.settle();
        };
        acts.rmfile = function(i){
          /* the app's own remove (it records the deletion for sync): draw its list, press its button */
          try{ renderFiles(); var b = document.querySelector('#fileList [data-rmf="' + (+i) + '"]'); if(b){ b.click(); yd.toast('Removed.'); } }catch(e){ console.error('[c3] data file', e); }
          ctx.state.room = undefined; C3.refresh();
        };
        acts.openfile = function(i){
          var f = (ALL.files || [])[+i]; if(!f) return;
          /* v337: the contents are read back from IndexedDB */
          safe(function(){ fileOpen(+i).then(function(ok){ if(!ok) yd.toast('That file could not be opened here.', 'bad'); }); });
        };
        acts.account = function(){ h.openYou('youaccount', 'acctCard'); };
        /* v329 */
        acts.phout = function(){ safe(function(){ rxPhotosOut().then(function(list){
          if(!list.length){ yd.toast('No photos on this device.'); return; }
          var blob = new Blob([JSON.stringify({kind: 'formed fit photos', at: Date.now(), photos: list})], {type: 'application/json'}), a = document.createElement('a');
          a.href = URL.createObjectURL(blob); a.download = 'formed-fit-photos-' + dkey(Date.now()) + '.json'; document.body.appendChild(a); a.click(); setTimeout(function(){ URL.revokeObjectURL(a.href); a.remove(); }, 1500);
          yd.toast(list.length + (list.length === 1 ? ' photo saved.' : ' photos saved.'));
        }); }); };
        acts.erase = function(){ safe(function(){ rxEraseDevice().then(function(r){ yd.toast('Erased: ' + r.photos + ' photos and everything else. Starting fresh.'); setTimeout(function(){ location.reload(); }, 900); }); }); };
        var pin = root.querySelector('[data-key="phin"]');
        if(pin) pin.addEventListener('change', function(){ var f = pin.files && pin.files[0]; if(!f) return; var fr = new FileReader();
          fr.onload = function(){ var j = null; try{ j = JSON.parse(fr.result); }catch(e){} if(!j || !Array.isArray(j.photos)){ yd.toast('That file has no photos in it.', 'bad'); return; }
            rxPhotosIn(j.photos).then(function(n){ ctx.state.phn = null; if(C3.rx) C3.rx.photosChanged(); yd.toast(n ? n + (n === 1 ? ' photo' : ' photos') + ' back on this device.' : 'Those photos are already here.'); C3.refresh(); }); };
          fr.readAsText(f); });
        chgs.imp = function(v){ ctx.state.imp = v; };
        yd.wire(root, ctx, acts, chgs);
        var ta = root.querySelector('[data-chg="imp"]');
        if(ta) ta.addEventListener('input', function(){ ctx.state.imp = ta.value; });
        root.querySelectorAll('[data-file]').forEach(function(inp){
          inp.addEventListener('change', function(){
            var f = inp.files && inp.files[0]; if(!f) return;
            if(inp.getAttribute('data-file') === 'imp'){
              if(f.size > 8e6){ yd.toast('That file is ' + (f.size / 1e6).toFixed(1) + ' MB, too big to read in one go.', 'bad'); return; }
              var rd = new FileReader();
              rd.onload = function(){ read(ctx, String(rd.result || '')); };
              rd.readAsText(f);
              return;
            }
            /* a document: handed to the app's own file input, so its handler does the attaching */
            try{
              var target = $('fileIn'), note = $('shareNote'), dt = new DataTransfer();
              dt.items.add(f); target.files = dt.files; if(note) note.textContent = '';
              target.dispatchEvent(new Event('change', {bubbles:true}));
              var n = 0, t = setInterval(function(){ var s = note ? String(note.textContent || '').trim() : ''; if(s || ++n > 40){ clearInterval(t); if(s) yd.toast(esc(s)); ctx.state.room = undefined; C3.refresh(); } }, 150);
            }catch(e){ console.error('[c3] data attach', e); yd.toast('That file could not be attached here.', 'bad'); }
          });
        });
      }
    });
  });
  if(C3.yd && C3.yd.drain) C3.yd.drain();
})();
