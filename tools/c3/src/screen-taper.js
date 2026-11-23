/* C3 screen: taper. The old Off-ramp pane in the Peptides lane (renderTaper with its
   plan card, the one-number-a-day appetite scale, and the supply tiles with the vial
   steppers) on one flat page: the hero, the plan you are writing, appetite, and what is
   left. All of it reads the same shell helpers and the same TPUI state; only the frame
   changes - no cards, no banded gradients. While this screen is up the shell's taper
   renders point at the shadow copies so the week-step edits, the appetite taps, the vial
   steppers and Start-this-taper keep working unchanged; the originals come back when the
   screen is gone, so the old pane still works as the fallback. */
(function(){
  'use strict';
  var C3 = window.C3; if(!C3) return;
  (C3.ydq = C3.ydq || []).push(function(yd){
    var h = C3.h, esc = h.esc, safe = yd.safe;
    var tpRoot = null, origRenders = null;

    /* the old pane's taper module, word for word, with each element lookup scoped to the
       shadow root; every helper they touch is the shell's own */
    function renderTaper(){const host=tpRoot;if(!host||!host.isConnected)return;const $=id=>host.querySelector("#"+CSS.escape(id));const src=$("tpSrc");if(src)src.innerHTML="There is no taper schedule in any of the labels, escalation is what was studied, so this app does not invent a way down. What the literature IS clear about: <b>"+esc(TAPER_SRC)+"</b> followed people for a year after semaglutide was withdrawn. They regained a mean of <b>"+TAPER_REGAIN.pp+" percentage points</b> (SD "+TAPER_REGAIN.sd+") of the weight they had lost, about <b>two thirds of it</b>, leaving a net "+TAPER_REGAIN.netLoss+"% down from where they started, and the cardiometabolic markers moved back toward baseline with it. Just under half ("+TAPER_REGAIN.held5+"%) still held a 5% loss. That is not an argument against stopping. It is the thing to plan around.";renderTaperCard();renderAppetite();renderInventory()}
    function renderTaperCard(){const host=tpRoot;if(!host||!host.isConnected)return;const $=id=>host.querySelector("#"+CSS.escape(id));const box=$("tpPlan");if(!box)return;const st=taperState(S);const fmtD2=ms=>new Date(ms).toLocaleDateString(void 0,{month:"short",day:"numeric",year:"numeric"});if(st){const pct=Math.max(0,Math.min(100,(1-st.mg/(st.from||1))*100));box.innerHTML='<div class="tiles"><div class="tile"><div class="k">On now</div><div class="v" style="color:var(--blue-t)">'+fmtW(st.mg)+'<small>mg</small></div></div><div class="tile"><div class="k">Started from</div><div class="v">'+fmtW(st.from)+'<small>mg</small></div></div><div class="tile"><div class="k">'+(st.done?"Finished":"Weeks in")+'</div><div class="v">'+(st.done?"\u2713":st.weeksIn)+'</div></div></div><div class="pbar" style="margin-top:14px"><i style="width:'+pct.toFixed(1)+'%"></i><span>'+(st.done?"Off it":Math.round(pct)+"% of the way down")+'</span></div><div class="tw" style="margin-top:14px"><table><thead><tr><th>Step</th><th>From</th><th class="num">Dose</th></tr></thead><tbody>'+st.steps.map((s,i)=>{const at=taperOf(S).at+s.afterWeeks*7*DAY;const on=st.next&&st.next.afterWeeks===s.afterWeeks;const past=at<=Date.now();return"<tr"+(on?' style="color:var(--blue-t)"':past?' style="opacity:.55"':"")+"><td>Week "+s.afterWeeks+(on?", next":past?", done":"")+'</td><td style="color:var(--ink-2);font-size:17px">'+fmtD2(at)+'</td><td class="num"><b>'+(s.mg===0?"stop":fmtW(s.mg)+" mg")+"</b></td></tr>"}).join("")+'</tbody></table></div><div class="mvacts"><button class="mini" id="tpStop">End the taper</button><span class="mvuse">'+(st.done?"Last step reached "+fmtD2(st.endAt):st.next?"Next step "+fmtD2(st.nextAt):"Ends "+fmtD2(st.endAt))+"</span></div>";const b=$("tpStop");if(b)b.addEventListener("click",()=>{const gone=taperStop(S);renderTaper();drawAll();if(gone&&typeof offerUndo==="function")offerUndo("Taper ended.",()=>{S.taper=gone;save();renderTaper();drawAll()})});return}const plan=TPUI.plan||taperSuggest(S,TPUI.weeks);if(!plan){box.innerHTML='<p class="note">Nothing to come down from, no dose on this protocol yet.</p>';return}box.innerHTML='<div class="row2" style="margin-bottom:14px"><div><label for="tpWeeks">Weeks at each step</label><input id="tpWeeks" type="number" min="1" max="12" step="1" value="'+TPUI.weeks+'"></div></div><div class="tw"><table><thead><tr><th>Step</th><th class="num">Dose</th></tr></thead><tbody><tr><td>Now</td><td class="num"><b>'+fmtW(plan.from)+" mg</b></td></tr>"+plan.steps.map(s=>"<tr><td>Week "+s.afterWeeks+'</td><td class="num"><b>'+(s.mg===0?"stop":fmtW(s.mg)+" mg")+"</b></td></tr>").join("")+'</tbody></table></div><p class="note">Halving the gap each step down to <b>'+fmtW(plan.floor)+' mg</b>, which is the smallest rung on your own ladder, a step to a dose you cannot draw is not a step. Edit the weeks and it recalculates; this is a plan you are writing, not one the app is prescribing.</p><button class="mini go" id="tpGo">Start this taper</button>';const w=$("tpWeeks");if(w)w.addEventListener("change",()=>{TPUI.weeks=Math.max(1,Math.min(12,Math.round(num(w.value,4,{min:1}))));TPUI.plan=null;renderTaper()});const g=$("tpGo");if(g)g.addEventListener("click",()=>{taperStart(S,plan);TPUI.plan=null;renderTaper();drawAll();say("Taper started from <b>"+fmtW(plan.from)+" mg</b>.")})}
    function renderAppetite(){const host=tpRoot;if(!host||!host.isConnected)return;const $=id=>host.querySelector("#"+CSS.escape(id));const box=$("tpApp");if(!box)return;const t=appToday();const V2=appVsIntake(60);box.innerHTML='<div class="rdscale" role="radiogroup" aria-label="Appetite today">'+APP_SCALE.map(([v,l])=>'<button class="rdb'+(t&&t.v===v?" on":"")+'" data-app="'+v+'" role="radio" aria-checked="'+(!!t&&t.v===v)+'" title="'+esc(l)+'" aria-label="'+esc(l)+'">'+v+"</button>").join("")+'</div><p class="note" style="margin-top:8px">'+(t?"<b>"+esc((APP_SCALE.find(a=>a[0]===t.v)||[])[1]||"")+"</b> today.":"1 is no appetite at all, 4 is normal for you, 7 is hungry all day.")+"</p>"+(V2.short?'<p class="note">'+V2.have+" day"+(V2.have===1?"":"s")+" so far with both an appetite score and a complete food log. "+V2.need+" are needed before the two can be put side by side, and half-logged days are left out, because a day you forgot to finish looks exactly like a day you barely ate.</p>":'<div class="tw" style="margin-top:14px"><table><thead><tr><th>Appetite</th><th class="num">Days</th><th class="num">Average intake</th></tr></thead><tbody>'+V2.means.map(m=>"<tr><td>"+m.v+", "+esc((APP_SCALE.find(a=>a[0]===m.v)||[])[1]||"")+'</td><td class="num">'+m.n+'</td><td class="num"><b>'+m.kcal.toLocaleString()+"</b> kcal</td></tr>").join("")+'</tbody></table></div><p class="note">Over '+V2.n+" complete days, "+(V2.real?"each point of appetite is worth about <b>"+Math.abs(V2.perPoint).toLocaleString()+" kcal</b> "+(V2.perPoint>0?"more":"less")+" (95% CI "+V2.lo.toLocaleString()+" to "+V2.hi.toLocaleString()+")":"the relationship between what you rated and what you ate is <b>not yet distinguishable from nothing</b>, the slope\u2019s interval ("+V2.lo.toLocaleString()+" to "+V2.hi.toLocaleString()+" kcal a point) still spans zero")+(V2.rho!=null?", Spearman \u03C1 "+V2.rho.toFixed(2):"")+".</p>");box.querySelectorAll("[data-app]").forEach(b=>b.addEventListener("click",()=>{const v=+b.dataset.app;if(t&&t.v===v)appDelete(t.k);else appSet(v);renderTaper();renderToday()}))}
    function renderInventory(){const host=tpRoot;if(!host||!host.isConnected)return;const $=id=>host.querySelector("#"+CSS.escape(id));const box=$("tpInv");if(!box)return;const inv=vialInv(S),V2=vialSupply(S);const fmtD2=ms=>new Date(ms).toLocaleDateString(void 0,{month:"short",day:"numeric"});const tone=V2.out?"var(--red)":V2.overdue?"var(--amber)":"var(--ink-0)";box.innerHTML='<div class="tiles"><div class="tile"><div class="k">Doses left</div><div class="v" style="color:'+tone+'">'+V2.dosesLeft+"<small>"+V2.leftOpen+" open + "+V2.spare+' spare</small></div></div><div class="tile"><div class="k">Lasts until</div><div class="v">'+(V2.out?",":fmtD2(V2.runOut))+"<small>"+V2.daysLeft+' days</small></div></div><div class="tile"><div class="k">Order by</div><div class="v" style="color:'+(V2.overdue?"var(--amber)":"var(--ink-0)")+'">'+(V2.out?"now":fmtD2(V2.orderBy))+'</div></div></div><div class="row3" style="margin-top:14px"><div><label for="ivSpare">Unopened vials</label><input id="ivSpare" type="number" min="0" max="99" step="1" value="'+(inv.spare|0)+'"></div><div><label for="ivLead">Days to get more</label><input id="ivLead" type="number" min="0" max="90" step="1" value="'+(inv.leadDays|0)+'"></div><div><label for="ivBud">Good for, once mixed</label><input id="ivBud" type="number" min="0" max="365" step="1" placeholder="days" value="'+(inv.budDays>0?inv.budDays:"")+'"></div></div><p class="note">Each vial gives <b>'+V2.per+" dose"+(V2.per===1?"":"s")+"</b> at "+fmtW(S.doseMg)+" mg, and your schedule is one every <b>"+V2.intervalDays+" day"+(V2.intervalDays===1?"":"s")+"</b>, both read from what you have actually set, not assumed.</p>"+(V2.out?'<div class="warnbox"><b>Nothing left.</b> The open vial is empty and there are no spares logged.</div>':V2.overdue?'<div class="warnbox"><b>Order now.</b> At '+inv.leadDays+" days to arrive, anything ordered later than today lands after you run out on "+fmtD2(V2.runOut)+".</div>":"")+(V2.bud?'<p class="note"'+(V2.budFirst?' style="color:var(--amber)"':"")+">You marked the open vial good for "+inv.budDays+" days from "+fmtD2(inv.openedAt)+", which is <b>"+fmtD2(V2.bud)+"</b>"+(V2.budFirst?", that comes BEFORE you would use it up, so the date is what decides, not the doses.":".")+"</p>":"")+'<div class="mvacts"><button class="mini" id="ivOpen">'+(inv.openedAt?"Opened "+fmtD2(inv.openedAt)+", reset":"Mark a vial opened today")+'</button></div><p class="mvsrc">A reconstituted vial has no manufacturer in-use date, because the manufacturer did not reconstitute it. So nothing is assumed here: the app tracks the date you were given and stays quiet if you were not given one.</p>';const g=id=>$(id);g("ivSpare").addEventListener("change",()=>{inv.spare=Math.max(0,Math.round(num(g("ivSpare").value,0,{min:0})));save();renderTaper()});g("ivLead").addEventListener("change",()=>{inv.leadDays=Math.max(0,Math.round(num(g("ivLead").value,7,{min:0})));save();renderTaper()});enhanceNumbers(g("ivBud").closest(".card")||g("ivBud").parentNode);g("ivBud").addEventListener("change",()=>{const v=g("ivBud").value.trim();if(!v)delete inv.budDays;else inv.budDays=Math.max(1,Math.round(num(v,28,{min:1})));save();renderTaper()});g("ivOpen").addEventListener("click",()=>{inv.openedAt=Date.now();save();renderTaper()})}
    yd.screen('taper', {
      parent: 'progress', old: ['peptides', 'taper'], nav: 'progress',
      render: function(ctx){
        /* v371: the off-ramp is one of the app's Pro screens (PRO_PANES.taper). The old pane
           locked; this screen has to lock too. The app's lock, in this look (yd.lock). */
        if(safe(function(){ return !!PRO_PANES.taper && !isPro(); }, false)){
          return '<div class="yd tp locked" data-state="locked">' + yd.head({back:'progress', eyebrow:'Progress', title:'The ', pk:'off-ramp'}) +
            '<section class="yd-sec">' + yd.lock('taper', 'The off-ramp is part of Pro', {part:true}) + '</section></div>';
        }
        var obt = safe(function(){ return obtData('taper'); }, null);
        ctx.state.obt = obt;
        var head = yd.head({back:'progress', eyebrow:'Progress', title:'The ', pk:'off-ramp'});
        var hero = '';
        if(obt && obt.t){
          hero = '<div class="tp-hero"><div class="tp-rows">' + esc(obt.t) +
            (obt.s ? '<small>' + esc(obt.s) + '</small>' : '') + '</div>' +
            yd.primary('plan', (obt.act && obt.act[0]) || 'Plan the off-ramp') + '</div>';
        }
        var verdict = obt && obt.verdict;
        return '<div class="yd tp">' + head + hero +
          (verdict ? yd.note(esc(verdict)) : '') +
          '<div id="twrap">' +
          yd.sec('Coming off', '<p class="eyebrow">The ladder goes up because that is what was studied, coming down is yours to write</p><div id="tpPlan"></div><p class="mvsrc" id="tpSrc"></p>') +
          yd.sec('Appetite', '<p class="eyebrow">One number a day, put next to what you actually ate</p><div id="tpApp"></div>') +
          yd.sec('Supply', '<p class="eyebrow">What is left, how long it lasts at the schedule you are on, and when to order</p><div id="tpInv"></div>') +
          '</div>' +
          '<p class="medfoot">formed fit is a training and food log. We are not doctors and nothing here is medical advice. Always check with yours first.</p>' +
        '</div>';
      },
      wire: function(root, ctx){
        tpRoot = root;
        if(!origRenders){
          origRenders = {taper: window.renderTaper, card: window.renderTaperCard, app: window.renderAppetite, inv: window.renderInventory};
        }
        function restore(){
          if(!origRenders) return;
          window.renderTaper = origRenders.taper;
          window.renderTaperCard = origRenders.card;
          window.renderAppetite = origRenders.app;
          window.renderInventory = origRenders.inv;
        }
        function wrap(fn, key){
          return function(){
            if(tpRoot && tpRoot.isConnected){ try{ fn(); }catch(e){ console.error('[c3] taper render', e); } return; }
            restore();
            var o = origRenders && origRenders[key];
            if(o) try{ o(); }catch(e){}
          };
        }
        window.renderTaper = wrap(renderTaper, 'taper');
        window.renderTaperCard = wrap(renderTaperCard, 'card');
        window.renderAppetite = wrap(renderAppetite, 'app');
        window.renderInventory = wrap(renderInventory, 'inv');
        try{ renderTaper(); }catch(e){ console.error('[c3] taper first render', e); }
        var acts = {
          plan: function(){
            safe(function(){ var p = root.querySelector('#tpPlan'); if(p) p.scrollIntoView({block:'start'}); });
          }
        };
        acts.buy = yd.lockActs.buy; acts.restore = yd.lockActs.restore;
        yd.wire(root, ctx, acts, {});
      }
    });
  });
  if(C3.yd && C3.yd.drain) C3.yd.drain();
})();
