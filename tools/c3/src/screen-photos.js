/* C3 screen: photos. Progress photos, side by side (the old Photos pane on Progress:
   renderPhotos, buildCompare, paintCompare, the ph* controls). Same store, same rules:
   pictures stay on the device, poses front/side/back, the nearest weigh-in rides along,
   "Then and now" compares two of one pose. The look is the house one: no cards, no banded
   gradients, one primary slab, pictures rounded with a neon edge and never anything on top. */
(function(){
  'use strict';
  var C3 = window.C3; if(!C3) return;
  (C3.ydq = C3.ydq || []).push(function(yd){
    var h = C3.h, esc = h.esc, safe = yd.safe;

    var S = {list:null, usage:null, err:''};
    function poses(){ return [['front','Front'],['side','Side'],['back','Back']]; }
    function pname(p){ return safe(function(){ return poseName(p); }, 'Front'); }
    function lbOf(x){ return safe(function(){ return x.lb || weightNear(x.at); }, null); }
    function lbTxt(lb){ return safe(function(){ return fmt(lb, 1) + ' lb'; }, ''); }
    function dstr(at, yr){ return new Date(at).toLocaleDateString('en-US', yr ? {month:'short', day:'numeric', year:'numeric'} : {month:'short', day:'numeric'}); }

    function load(done){
      if(!safe(function(){ return PHOTOS.supported(); }, false)){ S.list = []; if(done) done(); return; }
      safe(function(){ PHOTOS.releaseAll(); });
      Promise.resolve().then(function(){ return PHOTOS.all(); }).then(function(list){
        S.list = (list || []).slice().sort(function(a, b){ return a.at - b.at; });
        S.err = '';
        return PHOTOS.usage ? PHOTOS.usage() : null;
      }).then(function(u){ S.usage = u || null; if(done) done(); })
      .catch(function(e){ S.list = S.list || []; S.err = 'The photos on this device could not be read.'; if(done) done(); });
    }

    function optList(list){
      return list.map(function(x){
        var lb = lbOf(x);
        return [x.id, dstr(x.at, true) + ' · ' + pname(x.pose) + (lb ? ' · ' + lbTxt(lb) : '')];
      });
    }
    /* Then and now defaults: the pose with the most shots, first against last */
    function cmpDefaults(list){
      var byPose = {};
      list.forEach(function(x){ (byPose[x.pose] = byPose[x.pose] || []).push(x); });
      var best = Object.keys(byPose).map(function(k){ return byPose[k]; }).sort(function(m, n){
        return n.length - m.length || ((n[n.length-1].at - n[0].at) - (m[m.length-1].at - m[0].at));
      })[0] || list;
      return [best[0].id, best[best.length-1].id];
    }
    function fig(x, tag){
      var lb = lbOf(x);
      return '<figure class="ph-cell">' +
        '<img src="' + esc(safe(function(){ return PHOTOS.url(x.blob); }, '')) + '" alt="' + esc(pname(x.pose) + ' photo from ' + dstr(x.at, true)) + '" loading="lazy">' +
        '<figcaption>' + (tag ? '<span class="ph-tag">' + esc(tag) + '</span>' : '') + esc(dstr(x.at)) + (lb ? ' <b>' + esc(lbTxt(lb)) + '</b>' : '') + '</figcaption>' +
      '</figure>';
    }

    yd.screen('photos', {
      parent: 'progress', old: ['progress', 'photos'], nav: 'progress',
      enter: function(ctx){
        if(S.list === null && !ctx.state.loading){ ctx.state.loading = 1; load(function(){ ctx.state.loading = 0; if(C3.current === 'photos') C3.render(); }); }
      },
      leave: function(){ safe(function(){ PHOTOS.releaseAll(); }); },
      render: function(ctx){
        var st = ctx.state;
        if(st.pose == null) st.pose = 'front';
        if(!st.when) st.when = Date.now();
        var head = yd.head({back:'progress', eyebrow:'Progress', title:'Progress ', pk:'photos'});
        if(!safe(function(){ return PHOTOS.supported(); }, true)){
          return '<div class="yd ph">' + head + yd.note('This browser cannot store photos on the device.') + '</div>';
        }
        if(S.list === null){
          return '<div class="yd ph">' + head + yd.note('One moment, reading the photos on this device.') + '</div>';
        }
        var list = S.list;
        var add = yd.sec('Add a photo',
          yd.seg('pose', poses(), st.pose, {aria:'Pose'}) +
          '<div class="ph-when"><span class="k">Taken</span><input class="ph-date" id="c3phWhen" type="text" readonly data-key="ph-when"></div>' +
          yd.primary('add', 'Add a photo', '', {icon:'plus'}) +
          (S.err ? yd.note(esc(S.err)) : ''), {id:'add'});

        var body;
        if(!list.length){
          body = yd.sec('Your photos', yd.empty('Nothing here yet. Take the first one today: front, side and back, arms down, same spot and same light each time. That is what makes the comparison mean anything.'), {id:'grid'});
        } else {
          var byPose = {};
          list.forEach(function(x){ (byPose[x.pose] = byPose[x.pose] || []).push(x); });
          body = Object.keys(byPose).map(function(pose){
            return yd.sec(pname(pose), '<div class="ph-strip">' + byPose[pose].map(function(x){
              return '<div class="ph-one">' + fig(x) +
                yd.arm(ctx, 'rm', 'Remove', 'Tap again to remove', {v: x.id, cls:'ph-rm'}) + '</div>';
            }).join('') + '</div>', {n: byPose[pose].length, id:'pose-' + pose});
          }).join('');
        }

        var cmp = '';
        if(list.length >= 2){
          var dflt = cmpDefaults(list);
          var a = st.cmpA && list.some(function(x){ return x.id === st.cmpA; }) ? st.cmpA : dflt[0];
          var b = st.cmpB && list.some(function(x){ return x.id === st.cmpB; }) ? st.cmpB : dflt[1];
          var xa = list.filter(function(x){ return x.id === a; })[0], xb = list.filter(function(x){ return x.id === b; })[0];
          var opts = optList(list);
          cmp = yd.sec('Then and now',
            '<div class="ph-cmp-picks">' + yd.select('cmpA', opts, a, 'Left', {}) + yd.select('cmpB', opts, b, 'Right', {}) + '</div>' +
            (xa && xb ? '<div class="ph-cmp">' + fig(xa, 'Then') + fig(xb, 'Now') + '</div>' : '') +
            yd.note('The same pose on both sides is the one comparison that means anything.'), {id:'cmp'});
        }

        var u = S.usage;
        var note = u && u.count
          ? u.count + (u.count === 1 ? ' photo' : ' photos') + ' on this device' + (u.bytes ? ', ' + (u.bytes >= 1e6 ? (Math.round(u.bytes / 1e5) / 10) + ' MB' : Math.max(1, Math.round(u.bytes / 1024)) + ' KB') : '') + '. Photos never leave this device: they are not backed up to your account and are not in the crew view.'
          : 'Photos are stored on this device only. They are not backed up to your account and no one in a crew can see them.';

        return '<div class="yd ph">' + head + add + body + cmp + yd.note(note) + '</div>';
      },
      wire: function(root, ctx){
        var st = ctx.state;
        var wEl = root.querySelector('#c3phWhen');
        if(wEl && !wEl._repaint){
          wEl.value = new Date(st.when || Date.now()).toLocaleDateString('en-US', {month:'short', day:'numeric', year:'numeric'});
          safe(function(){ attachDate(wEl, function(){ return st.when; }, function(v){ st.when = v; }); });
        }
        var inp = root.querySelector('#c3phFile');
        if(!inp){
          inp = document.createElement('input');
          inp.type = 'file'; inp.accept = 'image/*'; inp.id = 'c3phFile'; inp.hidden = true;
          root.appendChild(inp);
          inp.addEventListener('change', function(){
            var f = inp.files && inp.files[0]; inp.value = '';
            if(!f) return;
            var meta = {at: st.when || Date.now(), pose: st.pose || 'front', lb: safe(function(){ return weightNear(st.when || Date.now()); }, null)};
            yd.toast('Adding the photo.');
            Promise.resolve(PHOTOS.add(f, meta)).then(function(r){
              if(r && r.ok === false){ yd.toast(esc(r.error || 'That photo could not be added.'), 'bad'); return; }
              yd.toast('Added.');
              load(function(){ if(C3.current === 'photos') C3.render(); });
            }, function(){ yd.toast('That photo could not be added.', 'bad'); });
          });
        }
        yd.wire(root, ctx, {
          pose: function(v){ st.pose = v; C3.render(); },
          add: function(){ var i = root.querySelector('#c3phFile'); if(i) i.click(); },
          rm: function(v, el){
            Promise.resolve(PHOTOS.remove(v)).then(function(){
              yd.toast('Removed.');
              load(function(){ if(C3.current === 'photos') C3.render(); });
            }, function(){ yd.toast('That photo could not be removed.', 'bad'); });
          }
        }, {
          cmpA: function(v){ st.cmpA = v; C3.render(); },
          cmpB: function(v){ st.cmpB = v; C3.render(); }
        });
      }
    });
  });
  if(C3.yd && C3.yd.drain) C3.yd.drain();
})();
