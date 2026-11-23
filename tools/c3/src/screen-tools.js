/* The shared task index. Every destination uses an existing app route. */
(function(){
  'use strict';
  var C3=window.C3; if(!C3) return;
  var h=C3.h, esc=h.esc;
  var tools=[
    ['Today','Daily','today','next action day'],['Food diary','Food','food','eat calories protein search scan barcode portions'],
    ['Meal plan','Food','plan','meal swap recipe'],['Groceries','Food','plan','grocery groceries shopping list',{tab:'groc'}],
    ['Workout','Train','train','exercise reps weights session'],['Workout builder','Train','program','custom program build routine'],
    ['Exercise library','Train','moves','video form demonstration movement'],['Calendar','Train','cal','schedule rest day'],
    ['Workout history','Train','history','previous sets log'],['Deload and recovery','Train','deload','lighter rest injury'],
    ['Four coaches','Coach','coaches','shay dakota kayne nova chat memory autopilot'],['Conversation history','Coach','conversations','chat messages conversations archive history'],
    ['Morning check-in','Daily','daily','sleep energy stress soreness appetite readiness'],['Recovery','Daily','recovery','soreness recovery rest'],
    ['Together workout room','Together','together','invite code join ready group remote session organizer trainer'],
    ['Coaching inbox','Together','trainer','trainer messages feedback video review proposals pause handover'],['Crew and trainer roster','Together','crew','group team coach clients challenge invitation'],['Share your progress','Together','share','social report share'],
    ['Workout studio','Together','post','photos video live board tiktok facebook'],
    ['Peptide and medication tracking','Track','doses','stack dose compound injection schedule inventory'],
    ['Add a compound','Track','addcmp','peptide medication add'],['Calculators','Track','math','syringe concentration units mix calculator'],
    ['Levels and estimates','Track','levels','pharmacokinetic estimate'],['Progress','Progress','progress','records trends strength consistency'],
    ['Body measurements','Progress','body','weight photos measurements'],['Reports','Progress','report','export doctor report'],
    ['Full guide','Account','guide','help instructions how to use'],['Your account','Account','you','profile account sign in'],
    ['Reminders','Account','reminders','notifications quiet hours'],['Settings','Account','settings','units language preferences'],
    ['Data and export','Account','data','download backup privacy account records'],
    ['Member benefits','Membership','member','points rewards referrals invitation preferences expiry redeem']
  ];
  C3.toolIndex=tools;
  function key(t){return t[2]+(t[4]&&t[4].tab?':'+t[4].tab:'');}
  function pinned(t){var p=ALL.toolPrefs||{};return !!(p.items&&p.items[key(t)]&&p.items[key(t)].pinned);}
  function toggle(t){var p=ALL.toolPrefs=ALL.toolPrefs||{at:0,items:{}};p.items=p.items||{};var at=Math.max(Date.now(),(+p.at||0)+1);p.items[key(t)]={pinned:!pinned(t),at:at};p.at=at;save();}

  C3.screen('tools',{
    nav:'tools',
    render:function(){return '<div class="tl"><header class="tl-head"><div class="c3-eyebrow"><i></i>Tools when you need them</div><h1 class="c3-h1">All tools</h1><p>Start with Today for your next step. Find a specific tool here.</p><button type="button" class="c3-link" data-go="today">Back to my day</button><label class="tl-search"><span>Find a tool</span><input id="tool-search" type="search" placeholder="Try groceries, reps, invite or dose" autocomplete="off"></label></header><p id="tool-count" role="status"></p><button type="button" class="c3-btn-quiet" data-sheet="">Quick log</button><div id="tool-results"></div><section class="tl-shop"><h2 class="c3-h2">Train with your crew</h2><p>Crews, challenges and a trainer view are part of Pro. Review membership and current availability before choosing.</p><button type="button" class="c3-link" data-go="you">Review Pro membership</button><button type="button" class="c3-link" data-go="member">Your member benefits</button></section></div>';},
    wire:function(root){
      var input=root.querySelector('#tool-search'), results=root.querySelector('#tool-results'), count=root.querySelector('#tool-count');
      function paint(){
        var q=input.value.toLowerCase().trim().split(/\s+/).filter(Boolean);
        var rows=tools.filter(function(t){return C3.screens[t[2]]&&q.every(function(w){return (t[0]+' '+t[1]+' '+t[3]).toLowerCase().indexOf(w)>=0;});});
        count.textContent=rows.length+' '+(rows.length===1?'tool':'tools');
        function row(t){var saved=pinned(t);return '<div class="tl-row"><button type="button" data-go="'+esc(t[2])+'"'+(t[4]?' data-params="'+esc(JSON.stringify(t[4]))+'"':'')+'><span>'+esc(t[0])+'</span>'+h.icon('chev',18,2.4)+'</button><button type="button" class="tl-pin" data-tool-pin="'+tools.indexOf(t)+'" aria-pressed="'+saved+'" aria-label="'+(saved?'Unpin ':'Pin ')+esc(t[0])+'">'+C3.yd.icon('star',18)+'</button></div>';}
        var saved=rows.filter(pinned),groups=[];
        rows.filter(function(t){return !pinned(t);}).forEach(function(t){if(groups.indexOf(t[1])<0)groups.push(t[1]);});
        results.innerHTML=(saved.length?'<section class="tl-group"><h2>Pinned</h2><div>'+saved.map(row).join('')+'</div></section>':'')+(rows.length?groups.map(function(g){return '<section class="tl-group"><h2>'+esc(g)+'</h2><div>'+rows.filter(function(t){return t[1]===g&&!pinned(t);}).map(row).join('')+'</div></section>';}).join(''):'<p class="tl-empty">No matching tool. Try a shorter word.</p>');

      }
      input.addEventListener('input',paint);results.addEventListener('click',function(e){var b=e.target.closest('[data-tool-pin]');if(!b)return;var i=+b.getAttribute('data-tool-pin');if(!tools[i])return;toggle(tools[i]);paint();var next=results.querySelector('[data-tool-pin="'+i+'"]');if(next)next.focus();});paint();
    }
  });
})();
