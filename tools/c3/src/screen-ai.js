/* C3 screen: ai. The old Ask pane on Progress (renderAI, paintAI, aiAsk and the brief it
   shows for every answer) on one flat page: the rows hero and Read my log, the suggested
   questions and the ask box, the conversation, the AI service details, and the brief with
   its copy and download. All of it reads the same shell helpers and the same AIUI state;
   only the frame changes - no cards, no banded gradients. While this screen is up the
   shell's renderAI and paintAI point at the shadow copy so aiAsk, aiDeeper, the streaming
   paint and every button keep working unchanged; the originals come back when the screen
   is gone, so the old pane still works as the fallback. */
(function(){
  'use strict';
  var C3 = window.C3; if(!C3) return;
  (C3.ydq = C3.ydq || []).push(function(yd){
    var h = C3.h, esc = h.esc, safe = yd.safe;
    var aiRoot = null, origRender = null, origPaint = null;
    var aiPrevTurns = null;   /* lane H: turn count at the last render, for the scroll-to-answer below */

    /* the old pane's renderAI, word for word, with the host passed in and its element
       lookups scoped to the shadow root; every helper it touches is the shell's own */
    function renderInto(host){
      const box=host.querySelector("#aiTurns");if(!box)return;const brief=briefText();const sections=logBrief();const empties=sections.filter(s=>s.empty);const how=modelHow();const svcField='<details class="adv" id="aiSvcBox"'+(how==="none"?" open":"")+"><summary>AI service"+(how==="none"?", not connected":", connected "+modelWord())+"</summary>"+(how==="service"&&!ownSvc()?'<p class="note" style="font-size:17px">Using the formed labs service at <b>'+esc(okSvc(AI_SERVICE_DEFAULT).replace(/^https?:\/\//,""))+"</b>. Put your own address below to use a service you run instead.</p>":"")+'<div class="row2" style="grid-template-columns:minmax(0,1fr) auto;align-items:end;margin-top:10px"><div><label for="aiSvcUrl">Service address</label><input id="aiSvcUrl" type="url" inputmode="url" autocomplete="off" spellcheck="false" placeholder="https://your-service.vercel.app" value="'+esc(aiSvc().url||"")+'"></div><button class="mini go" id="aiSvcSave">Connect</button></div><p class="note" style="font-size:17px">The address of a server that holds the API key and forwards the question. The key never touches this phone, and the service keeps nothing. '+(how==="native"?"The app is using its own built-in route, so this is only a fallback.":how==="claude"?"The app is running inside Claude, so the model is already available here, this is what the downloaded app uses instead.":"")+"</p></details>";host.querySelector("#aiHead").innerHTML=(how==="none"?'<p class="note">No AI service is connected. The questions below are answered here anyway, from your rows and from published guidance, with the sources, and anything else needs a service. The brief is assembled on this device either way, and you can copy it into any assistant you like.</p>':'<p class="note">Answers come from the brief below and nothing else. It is on this page so you can read what the model was told before you decide what to make of what it says, which is the only way to tell an answer from a guess.</p>')+svcField;box.innerHTML=AIUI.turns.length?AIUI.turns.map((t,i)=>'<div class="aiturn"><div class="aiq">'+esc(t.q)+'</div><div class="aia">'+esc(t.a||(t.pending&&t.runId===window.C3?.sessionRun?"...":"Response interrupted. Ask again when connected."))+"</div>"+(t.local?(t.sources&&t.sources.length?'<p class="note" style="font-size:17px;margin:10px 0 0">Sources: '+t.sources.map(sr=>'<a href="'+esc(sr.u)+'" target="_blank" rel="noopener" style="color:inherit;text-decoration:underline">'+esc(sr.t)+"</a>").join(" &middot; ")+"</p>":"")+'<div class="quick" style="margin-top:10px">'+(t.actions||[]).map((a,j)=>'<button class="mini" data-aiact="'+i+":"+j+'">'+esc(a[0])+"</button>").join("")+(how!=="none"&&!AIUI.busy?'<button class="mini" data-aideeper="'+i+'">Go deeper with the model</button>':"")+"</div>":"")+"</div>").join(""):"";host.querySelector("#aiAsk").innerHTML='<div class="aisugg">'+aiSuggestions().map((q,i)=>'<button class="aiq1" data-aiq="'+i+'">'+esc(q)+"</button>").join("")+'</div><div class="row2" style="grid-template-columns:minmax(0,1fr) auto;align-items:end"><div><label for="aiQ">Ask about your own numbers</label><input id="aiQ" type="text" maxlength="240" value="'+esc(AIUI.q)+'" placeholder="Why has my weight stalled?"></div><button class="mini go" id="aiGo"'+(AIUI.busy?" disabled":"")+">"+(AIUI.busy?"Reading...":"Ask")+"</button></div>"+(AIUI.err?'<p class="note" style="color:var(--amber)">'+esc(AIUI.err)+"</p>":"")+(AIUI.turns.length?'<button class="mini" id="aiClear" style="margin-top:10px">Start over</button>':"");host.querySelector("#aiBrief").innerHTML='<button class="mini'+(AIUI.showBrief?" go":"")+'" id="aiShow">'+(AIUI.showBrief?"Hide what it was told":"Show exactly what it was told")+'</button><button class="mini" id="aiCopy">Copy the brief</button><button class="mini" id="aiPack">Download it as data</button>'+(AIUI.showBrief?'<pre class="aibrief">'+esc(brief)+"</pre>":"")+(empties.length?'<p class="note">'+empties.length+" section"+(empties.length===1?" is":"s are")+" empty, "+empties.map(s=>s.title.toLowerCase()).join(", ")+". They are still sent, marked empty, so nothing can mistake missing data for a value of zero.</p>":'<p class="note">Every section has something in it.</p>')+'<p class="mvsrc">The brief is built on this device out of your own rows. Nothing else is sent, not the raw log, not your photos, which never leave the device at all. If you would rather use another assistant, copy it or take the data file; it is the same text either way.</p>';const g=id=>host.querySelector("#"+id);const svcIn=g("aiSvcUrl"),svcGo=g("aiSvcSave");if(svcGo)svcGo.addEventListener("click",async()=>{const v=(svcIn&&svcIn.value||"").trim();if(v&&!/^https:\/\//i.test(v)&&!/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(v)){say("A service address has to start with <b>https://</b>.","bad");return}setAiSvc(v);await modelProbe(true);renderAI();say(modelReady()?"AI service connected, answers now come <b>"+modelWord()+"</b>.":"AI service cleared.")});const inp=g("aiQ");if(inp)inp.addEventListener("input",()=>{AIUI.q=inp.value});if(inp)inp.addEventListener("keydown",e=>{if(e.key==="Enter"&&!AIUI.busy){e.preventDefault();g("aiGo").click()}});const go=g("aiGo");if(go)go.addEventListener("click",()=>{const q=AIUI.q.trim();AIUI.q="";aiAsk(q)});host.querySelectorAll("[data-aiq]").forEach(btn=>btn.addEventListener("click",()=>{if(AIUI.busy)return;aiAsk(aiSuggestions()[+btn.dataset.aiq])}));const cl=g("aiClear");if(cl)cl.addEventListener("click",()=>{AIUI.turns=[];AIUI.err="";renderAI()});host.querySelectorAll("[data-aiact]").forEach(btn=>btn.addEventListener("click",()=>{const[i,j]=btn.dataset.aiact.split(":").map(Number);const t=AIUI.turns[i];const a=t&&t.actions&&t.actions[j];if(a)try{a[1]()}catch(e){}}));host.querySelectorAll("[data-aideeper]").forEach(btn=>btn.addEventListener("click",()=>aiDeeper(+btn.dataset.aideeper)));const sh=g("aiShow");if(sh)sh.addEventListener("click",()=>{AIUI.showBrief=!AIUI.showBrief;renderAI()});const cp=g("aiCopy");if(cp)cp.addEventListener("click",async()=>{try{await navigator.clipboard.writeText(brief);say("Brief copied.")}catch(e){AIUI.showBrief=true;renderAI();say("Could not reach the clipboard, it is on screen instead.")}});const pk=g("aiPack");if(pk)pk.addEventListener("click",()=>{const txt=JSON.stringify(contextPack(),null,2);if(typeof saveText==="function")saveText(txt,"formed-fit-context.json","application/json");else{AIUI.showBrief=true;renderAI()}})
      /* lane H: when a new turn lands, bring it on screen - the ask box sits above the fold and
         the answer renders below it, so without this a tap on Ask looked like nothing happened */
      const nTurns = (window.AIUI && AIUI.turns.length) || 0;
      if(aiPrevTurns !== null && nTurns > aiPrevTurns){
        const turns = host.querySelectorAll("#aiTurns .aiturn");
        const lastT = turns[turns.length - 1];
        if(lastT && lastT.scrollIntoView) lastT.scrollIntoView({behavior:"smooth", block:"start"});
      }
      aiPrevTurns = nTurns;
    }

    /* the old pane's paintAI (the streaming paint), scoped the same way */
    function paintInto(host){
      var box = host.querySelector("#aiTurns"); if(!box) return;
      var last = box.querySelector(".aiturn:last-child .aia");
      var t = AIUI.turns[AIUI.turns.length - 1];
      if(last && t) last.textContent = t.a || "...";
    }

    yd.screen('ai', {
      parent: 'progress', old: ['progress', 'ai'], nav: 'progress',
      render: function(ctx){
        /* v371: Ask your log is one of the app's Pro screens (PRO_PANES.ai). The old pane locked;
           this screen has to lock too, or an expired trial walks straight in. The app's lock, in
           this look: its words, its one control (yd.lock), running buyPro(). */
        if(safe(function(){ return !!PRO_PANES.ai && !isPro(); }, false)){
          return '<div class="yd ai locked" data-state="locked">' + yd.head({back:'progress', eyebrow:'Progress', title:'Ask your ', pk:'log'}) +
            '<section class="yd-sec">' + yd.lock('ai', 'Ask your log is part of Pro', {part:true}) + '</section></div>';
        }
        var obt = safe(function(){ return obtData('ai'); }, null);
        ctx.state.obt = obt;
        var head = yd.head({back:'progress', eyebrow:'Progress', title:'Ask your ', pk:'log'});
        var hero = '';
        /* lane H: the shell's obtData never singularizes ("1 rows", "1 sessions"); fix the two strings here */
        function pl1(t){
          return String(t || '')
            .replace(/\b1 rows\b/, '1 row').replace(/\b1 sessions\b/, '1 session')
            .replace(/\b1 food entries\b/, '1 food entry').replace(/\b1 weigh-ins\b/, '1 weigh-in')
            .replace(/\b1 doses\b/, '1 dose').replace(/\b1 check-ins\b/, '1 check-in');
        }
        if(obt && obt.t){
          hero = '<div class="ai-hero"><div class="ai-rows">' + esc(pl1(obt.t)) +
            (obt.s ? '<small>' + esc(pl1(obt.s)) + '</small>' : '') + '</div>' +
            yd.primary('readlog', (obt.act && obt.act[0]) || 'Read my log') + '</div>';
        }
        var verdict = safe(function(){ var l = brainLine('ai'); return l && l.text; }, '');
        return '<div class="yd ai">' + head + hero +
          (verdict ? yd.note(esc(verdict)) : '') +
          '<div id="aiAsk"></div><div id="aiHead"></div><div id="aiTurns"></div>' +
          yd.sec('What it was told', yd.note('The whole of it, nothing else is sent') + '<div id="aiBrief"></div>', {id:'brief'}) +
          '<p class="medfoot">formed fit is a training and food log. We are not doctors and nothing here is medical advice. Always check with yours first.</p>' +
        '</div>';
      },
      wire: function(root, ctx){
        aiRoot = root;
        if(!origRender){ origRender = window.renderAI; origPaint = window.paintAI; }
        window.renderAI = function(){
          if(aiRoot && aiRoot.isConnected){ try{ renderInto(aiRoot); }catch(e){ console.error('[c3] ai render', e); } return; }
          window.renderAI = origRender; window.paintAI = origPaint;
          if(origRender) try{ origRender(); }catch(e){}
        };
        window.paintAI = function(){
          if(aiRoot && aiRoot.isConnected){ try{ paintInto(aiRoot); }catch(e){} return; }
          window.paintAI = origPaint; if(origPaint) try{ origPaint(); }catch(e){}
        };
        renderInto(root);
        var acts = {
          readlog: function(){
            safe(function(){
              var o = ctx.state.obt;
              if(o && o.act && o.act[1]) o.act[1](); else aiAsk('');
            });
          }
        };
        acts.buy = yd.lockActs.buy; acts.restore = yd.lockActs.restore;
        yd.wire(root, ctx, acts, {});
      }
    });
  });
  if(C3.yd && C3.yd.drain) C3.yd.drain();
})();
