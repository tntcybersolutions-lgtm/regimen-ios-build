(function(){
 'use strict';
 var C3=window.C3;if(!C3)return;
 (C3.ydq=C3.ydq||[]).push(function(yd){
  var h=C3.h,esc=h.esc;
  yd.screen('conversations',{
   parent:'coaches',nav:'coach',
   render:function(ctx){
    var coaches=h.coaches(),cid=ctx.state.coach||coachState().lead,coach=coaches.filter(function(c){return c.id===cid;})[0]||coaches[0];
    var all=(coachState().threads[coach.id]||[]).slice().reverse(),limit=+ctx.state.limit||20,list=all.slice(0,limit);
    return '<div class="yd cv">'+yd.head({back:'coaches',eyebrow:'Your saved conversations',title:'Conversation',pk:'history'})+yd.note('Coaches are AI. They can be wrong. Nothing they say is medical advice. Check with your doctor.')+'<label class="cv-picker">Coach<select id="history-coach">'+coaches.map(function(c){return '<option value="'+esc(c.id)+'"'+(c.id===coach.id?' selected':'')+'>'+esc(c.name)+'</option>';}).join('')+'</select></label>'+yd.note(yd.signedIn()?'Conversations use your account sync. Check Data and export for the latest sync result.':'Saved on this device. Sign in to sync conversations across devices.')+'<div class="yd-acts"><button type="button" class="c3-btn-quiet" data-coach="'+esc(coach.id)+'">Talk to '+esc(coach.name)+'</button><button type="button" class="c3-btn-quiet" data-go="data">Data and export</button></div>'+(!list.length?yd.empty('No saved conversations with this coach yet.'):'<p class="yd-note">'+list.length+' of '+all.length+' conversations, newest first.</p><ol class="cv-list">'+list.map(function(t){return '<li><time>'+esc(yd.when(t.at))+'</time>'+(t.q?'<h2>You</h2><p>'+esc(t.q)+'</p>':'')+'<h2>'+esc(coach.name)+'</h2><p>'+esc(t.a||'Response interrupted. Ask again when connected.')+'</p>'+(t.acted?'<small>Action: '+esc(t.acted)+'</small>':'')+'</li>';}).join('')+'</ol>')+(all.length>limit?'<button type="button" class="c3-btn-quiet" data-act="more">Load older conversations</button>':'')+'</div>';
   },
   wire:function(root,ctx){
    root.querySelector('#history-coach').addEventListener('change',function(e){ctx.set({coach:e.target.value,limit:20});});
    yd.wire(root,ctx,{more:function(){ctx.set({limit:(+ctx.state.limit||20)+20});}});
   }
  });
 });
 if(C3.yd&&C3.yd.drain)C3.yd.drain();
})();

