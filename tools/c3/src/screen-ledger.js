/* C3 screen: ledger. The old Attribution pane in the Peptides lane (renderLedger with its
   which-dose-gets-the-credit table, the side-effect timing chart with its hover tooltip,
   and the cost-of-the-run tiles that renderConsole used to fill) on one flat page: the
   hero, attribution, timing, and cost. All of it reads the same shell helpers and the same
   protocol state; only the frame changes - no cards, no banded gradients. While this screen
   is up the shell's renderLedger points at the shadow copy so every dose or weigh-in keeps
   the table and the chart current; the original comes back when the screen is gone, so the
   old pane still works as the fallback. */
(function(){
  'use strict';
  var C3 = window.C3; if(!C3) return;
  (C3.ydq = C3.ydq || []).push(function(yd){
    var h = C3.h, esc = h.esc, safe = yd.safe;
    var lgRoot = null, origRenderLedger = null;

    /* the old pane's ledger module, word for word, with each element lookup scoped to the
       shadow root; every helper they touch is the shell's own. The cost tiles were filled
       by renderConsole in the old layout; here they are their own render over the same
       shell math (protoVial, doseCostOf, ewma), the chunk word for word. */
    function renderLedger(){const host=lgRoot;if(!host||!host.isConnected)return;const $=id=>host.querySelector("#"+CSS.escape(id));const rows=attribution();const at=$("attrTable");if(!at)return;const tb=at.querySelector("tbody");tb.innerHTML="";const dfmt=ms=>new Date(ms).toLocaleDateString(void 0,{month:"short",day:"numeric"});let disagree=0;for(const r of rows){if(!r.agree)disagree++;const tr=document.createElement("tr");tr.innerHTML="<td>"+dfmt(r.at)+'</td><td class="num">'+fmt(r.lb,1)+'</td><td style="color:var(--blue-t)">'+dfmt(r.dom.at)+" \u00B7 "+r.dom.mg+' mg</td><td class="num">'+fmt(r.share,0)+'%</td><td style="color:'+(r.agree?"var(--ink-2)":"var(--red)")+'">'+(r.naive?dfmt(r.naive.at):",")+(r.agree?"":" \u2717")+"</td>";tb.appendChild(tr)}$("attrNote").innerHTML=rows.length?'On this run the naive "most recent dose" answer disagrees with the modeled one on <b>'+disagree+" of "+rows.length+" readings</b>. Each disagreement is a data point filed under the wrong dose in every tracker that does it the easy way.":"Log doses and weigh-ins to see attribution.";const cv=$("sx");const _p4=prep(cv);if(!_p4)return;const{g,w,h}=_p4;const pad={l:56,r:22,t:20,b:40};const c=byId(S.compound),ke=keOf(c.t12),ka=kaFromTmax(c.tmax,ke,c.id);if(!S.sx.length||!S.doses.length){emptyText(g,"Log side effects to find the lag.",w,h);$("sxNote").textContent="";return}const binH=12,nb=Math.ceil(S.everyH/binH);const bins=Array.from({length:nb},()=>({sum:0,n:0}));const sev=[],conc=[];const t0=S.doses[0].at,gk=ka/(ka-ke);for(const e of S.sx){const prior=S.doses.filter(d=>d.at<=e.at);if(!prior.length)continue;const last=prior[prior.length-1];const hrs=(e.at-last.at)/HOUR;const b=Math.min(nb-1,Math.floor(hrs/binH));bins[b].sum+=e.sev;bins[b].n++;const t=(e.at-t0)/HOUR;let cc=0;for(const d of S.doses){const dt=t-(d.at-t0)/HOUR;if(dt>0)cc+=d.mg*gk*(Math.exp(-ke*dt)-Math.exp(-ka*dt))}sev.push(e.sev);conc.push(cc)}const means=bins.map(b=>b.n?b.sum/b.n:0);const maxM=Math.max(...means,1);const X=i=>pad.l+(i+.5)/nb*(w-pad.l-pad.r);const Y=v=>h-pad.b-v/(maxM*1.15)*(h-pad.t-pad.b);axes(g,w,h,pad,niceTicks(0,maxM*1.15,tickCount(h)).map(v=>({v,y:Y(v)})),Array.from({length:nb},(_,i)=>({v:i*binH,x:X(i)})).filter((_,i)=>i%Math.max(1,Math.round(nb/7))===0),v=>fmt(v,1),v=>v+"h");const bw=(w-pad.l-pad.r)/nb-4;let peak=0;means.forEach((m,i)=>{if(m>means[peak])peak=i});means.forEach((m,i)=>{if(!bins[i].n)return;const x=X(i)-bw/2,y=Y(m),hh=h-pad.b-y;g.fillStyle=i===peak?chartInk().amber:chartInk().series2;if(i===peak){g.shadowColor=chartInk().amber;g.shadowBlur=18}g.beginPath();g.roundRect(x,y,bw,hh,[4,4,0,0]);g.fill();g.shadowBlur=0});const xtip=$("sxTip");if(xtip){cv.onpointermove=e=>{const r=cv.getBoundingClientRect();const mx=(e.clientX-r.left)*(w/r.width);const i=Math.max(0,Math.min(nb-1,Math.floor((mx-pad.l)/(w-pad.l-pad.r)*nb)));if(!bins[i].n){xtip.style.opacity=0;return}xtip.style.opacity=1;xtip.style.left=Math.min(w-190,Math.max(0,mx+14))+"px";xtip.style.top=Math.max(4,Y(means[i])-58)+"px";xtip.innerHTML=i*binH+"\u2013"+(i+1)*binH+" h after a dose<br><b>"+fmt(means[i],1)+"</b> mean severity<br>"+bins[i].n+" report"+(bins[i].n===1?"":"s")};cv.onpointerleave=()=>{xtip.style.opacity=0}}const rho=spearman(sev,conc);$("sxNote").innerHTML="Severity peaks in the <b>"+peak*binH+" to "+(peak+1)*binH+" hour</b> window after a dose"+(rho!==null?", and severity tracks modeled blood level with a Spearman correlation of <b>\u03C1 = "+fmt(rho,2)+"</b>":"")+'. Correlating symptoms against the modeled concentration, rather than against the calendar, is the difference between "I feel rough sometimes" and a number you can take to a titration decision.'}
    function renderLedgerCosts(){const host=lgRoot;if(!host||!host.isConnected)return;const $=id=>host.querySelector("#"+CSS.escape(id));const now=Date.now();const V2=protoVial(S);const perVial=V2.per,left=V2.left;const lastDose2=S.doses.length?S.doses[S.doses.length-1]:null;const next=lastDose2?lastDose2.at+S.everyH*HOUR:null;const cd=perVial?S.costUsd/perVial:NaN;const cw=cd*(168/S.everyH);const spent=S.doses.reduce((t,d)=>t+doseCostOf(S,d.mg),0);$("cDose").textContent=money(cd);$("cWeek").textContent=money(cw);let lbLost=NaN;if(S.weights.length>6){const sm=ewma(S.weights.map(p=>p.lb),.1);lbLost=sm[0]-sm[sm.length-1]}const weeksRun=S.doses.length?(now-S.doses[0].at)/DAY/7:0;const kK=$("cLbK");if(kK)kK.textContent="Per "+wU()+" lost";$("cLb").textContent=isFinite(lbLost)&&lbLost>0&&spent>0?money(spent/wNum(lbLost,3)):",";const runOut=next&&left>=0?new Date(now+left*S.everyH*HOUR):null;$("cReorder").textContent=runOut?runOut.toLocaleDateString(void 0,{month:"short",day:"numeric"}):",";$("costNote").innerHTML=perVial?"A "+S.vialMg+" mg vial at "+money(S.costUsd)+" reconstituted in "+S.diluentMl+" mL yields <b>"+perVial+" doses</b> of "+S.doseMg+" mg after dead volume, so each shot costs <b>"+money(cd)+"</b>. "+(isFinite(lbLost)&&lbLost>0&&spent>0?"The run has cost <b>"+money(spent)+"</b> so far, every dose priced at the rung it was actually given, not at today's. Against <b>"+wTxt(lbLost,1)+"</b> of trend loss that is <b>"+money(spent/wNum(lbLost,3))+" per "+wU()+"</b>.":""):"";}
    function renderAll(){ try{ renderLedger(); }catch(e){ console.error('[c3] ledger render', e); } try{ renderLedgerCosts(); }catch(e){ console.error('[c3] ledger costs', e); } }

    yd.screen('ledger', {
      parent: 'progress', old: ['peptides', 'ledger'], nav: 'progress',
      render: function(ctx){
        var obt = safe(function(){ return obtData('ledger'); }, null);
        ctx.state.obt = obt;
        var head = yd.head({back:'progress', eyebrow:'Progress', title:'The ', pk:'attribution'});
        var hero = '';
        if(obt && obt.t){
          hero = '<div class="lg-hero"><div class="lg-rows">' + esc(obt.t) +
            (obt.s ? '<small>' + esc(obt.s) + '</small>' : '') + '</div>' +
            yd.primary('logdose', (obt.act && obt.act[0]) || 'Log a dose') + '</div>';
        }
        var verdict = obt && obt.verdict;
        return '<div class="yd lg">' + head + hero +
          (verdict ? yd.note(esc(verdict)) : '') +
          '<div id="lwrap">' +
          yd.sec('Which dose gets the credit', '<p class="eyebrow">Attribution by modeled exposure, not by the nearest calendar entry</p><p class="note" style="margin-top:0">A reading taken on Saturday does not belong to Saturday. It belongs to whichever dose was actually driving your blood level at that moment, and with a 5-day half-life that is usually not the most recent one. This is the bug users report in the biggest app in the category. Here it is done properly: every reading is attributed to the dose contributing the largest share of modeled concentration at that instant.</p><div class="tw"><table id="attrTable"><thead><tr><th>Reading</th><th class="num">Weight</th><th>Dominant dose</th><th class="num">Share</th><th>Naive answer</th></tr></thead><tbody></tbody></table></div><p class="note" id="attrNote"></p>') +
          yd.sec('When side effects actually hit', '<p class="eyebrow">Severity binned against hours since the dominant dose</p><div class="plot"><canvas id="sx" width="1400" height="300"></canvas><div class="tip" id="sxTip"></div></div><p class="note" id="sxNote"></p>') +
          yd.sec('Cost of the run', '<p class="eyebrow">Per dose, per week, per pound</p><div class="tiles" style="grid-template-columns:repeat(auto-fit,minmax(128px,1fr))"><div class="tile"><div class="k">Per dose</div><div class="v" id="cDose">,</div></div><div class="tile"><div class="k">Per week</div><div class="v" id="cWeek">,</div></div><div class="tile"><div class="k" id="cLbK">Per lb lost</div><div class="v" id="cLb">,</div></div><div class="tile"><div class="k">Reorder by</div><div class="v" id="cReorder">,</div></div></div><p class="note" id="costNote"></p>') +
          '</div>' +
          '<p class="medfoot">formed fit is a training and food log. We are not doctors and nothing here is medical advice. Always check with yours first.</p>' +
        '</div>';
      },
      wire: function(root, ctx){
        lgRoot = root;
        if(!origRenderLedger){ origRenderLedger = window.renderLedger; }
        window.renderLedger = function(){
          if(lgRoot && lgRoot.isConnected){ renderAll(); return; }
          window.renderLedger = origRenderLedger;
          if(origRenderLedger) try{ origRenderLedger(); }catch(e){}
        };
        renderAll();
        yd.wire(root, ctx, {
          logdose: function(){
            safe(function(){ C3.go('log'); });
          }
        }, {});
      }
    });
  });
  if(C3.yd && C3.yd.drain) C3.yd.drain();
})();
