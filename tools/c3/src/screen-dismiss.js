/* Shared exits for temporary choices. Closing never chooses a replacement. */
(function(){
 'use strict';var C3=window.C3;if(!C3)return;
 var stack=[],visible={},queued=false,navBusy=false,from=null,serial=0,started=false;
 function shown(el){var sh=el&&el.closest&&el.closest('#sheet');return !!(el&&el.isConnected&&!el.closest('[hidden]')&&(!sh||sh.classList.contains('up'))&&el.getClientRects().length);}
 function all(root,sel){return root?Array.from(root.querySelectorAll(sel)).filter(shown):[];}
 function ident(el){if(!el||!el.getAttribute)return null;var a=['id','data-key','data-dyswap','data-wkswap'];for(var i=0;i<a.length;i++){var v=el.getAttribute(a[i]);if(v)return '['+a[i]+'="'+CSS.escape(v)+'"]';}return null;}
 function restore(d){requestAnimationFrame(function(){var n=d.from&&d.from.isConnected?d.from:null;if(!n&&d.selector)n=C3.root.querySelector(d.selector)||document.querySelector(d.selector);var sh=document.getElementById('sheet');if(shown(sh)&&n&&!sh.contains(n))return;if(shown(n))n.focus({preventScroll:true});});}
 function bar(el,label,close,key){
  if(el.querySelector(':scope > .fl-exitbar'))return;
  var row=document.createElement('div');row.className='fl-exitbar';var b=document.createElement('button');b.type='button';b.className='fl-close';b.textContent=label;b.setAttribute('aria-label',label);b.dataset.flClose=key;
  b.addEventListener('click',function(e){e.preventDefault();e.stopPropagation();var d=visible[key]||{from:from};close();restore(d);schedule();});row.appendChild(b);el.prepend(row);
 }
 function discover(){
  var list=[],sheet=document.getElementById('sheet');function put(key,el,close){list.push({key:key,el:el,close:close});}
  if(shown(sheet))put('sheet:'+String(typeof SH==='undefined'?'':SH),sheet,function(){closeSheet();});
  var story=document.getElementById('story');
  if(shown(story))put('story',story,function(){STORY.after=null;storyFinish();});
  var setup=document.getElementById('onb');
  if(shown(setup)){bar(setup.querySelector('.onbcard')||setup,'Close setup',function(){onbClose();},'setup');put('setup',setup,function(){onbClose();});}
  [document,C3.root].forEach(function(root){
   all(root,'details[open]').forEach(function(el,i){var summary=el.querySelector('summary'),key='details:'+(root===document?'doc':'c3')+':'+(el.id||summary&&summary.textContent.trim().slice(0,80)||i),close=function(){el.open=false;if(summary)summary.focus({preventScroll:true});};
    if(!el.querySelector(':scope > .fl-exitbar')){bar(el,'Close section',close,key);if(summary)summary.after(el.querySelector(':scope > .fl-exitbar'));}put(key,el,close);
   });
   all(root,'[aria-expanded="true"][aria-controls]').forEach(function(trigger){var id=trigger.getAttribute('aria-controls'),panel=root.getElementById(id);if(!shown(panel)||panel.contains(trigger)||panel.matches('.c3-ov-panel'))return;
    var key='controlled:'+id,close=function(){if(trigger.getAttribute('aria-expanded')==='true')trigger.click();};bar(panel,'Close options',close,key);put(key,panel,close);
   });
  });
  all(C3.root,'.mk-swap').forEach(function(el){var b=el.querySelector('[data-key="mswapclose"]');if(!b)return;var key='meal:'+b.getAttribute('data-k')+':'+b.getAttribute('data-i');var close=function(){var n=C3.root.querySelector('.mk-swap [data-key="mswapclose"]');if(n)n.click();};bar(el,'Close meal swaps',close,key);put(key,el,close);});
  [['dySwapQ','day','swap'],['wkSwapQ','workout','swap'],['dyAddQ','day','add'],['wkAddQ','workout','add']].forEach(function(s){var q=document.getElementById(s[0]);if(!shown(q))return;var el=q.closest(s[2]==='swap'?'.dysearch':'.dyadd');if(!el)return;
   var key='exercise:'+s[0],close=function(){var ui=s[1]==='day'?DAYUI:WKUI,old=ui.swap;ui[s[2]]=s[2]==='swap'?null:false;ui.q='';if(s[1]==='day')renderDaySheet();else renderWorkoutSheet();var target=s[2]==='add'?document.getElementById(s[1]==='day'?'dyAddBtn':'wkAddBtn'):document.querySelector('['+(s[1]==='day'?'data-dyswap':'data-wkswap')+'=\"'+CSS.escape(old||'')+'\"]');if(target)target.focus({preventScroll:true});};bar(el,s[2]==='swap'?'Close exercise swaps':'Close exercise search',close,key);put(key,el,close);
  });
  all(document,'.selpop').forEach(function(pop,i){var w=pop.closest('.selw'),trigger=w&&w.querySelector('.seltrig');if(!trigger)return;var sel=w.querySelector('select'),key='select:'+(sel&&sel.id||i),close=function(){if(trigger.getAttribute('aria-expanded')==='true')trigger.click();};
   if(pop.getAttribute('role')==='listbox'){var opts=document.createElement('div');opts.setAttribute('role','listbox');while(pop.firstChild)opts.appendChild(pop.firstChild);pop.appendChild(opts);pop.setAttribute('role','dialog');pop.setAttribute('aria-label','Choose an option');trigger.setAttribute('aria-haspopup','dialog');}
   bar(pop,'Close options',close,key);put(key,pop,close);
  });return list;
 }
 function sync(){
  queued=false;if(!started||!C3.root)return;var found=discover(),map={};found.forEach(function(d){map[d.key]=d;});visible=map;
  stack.forEach(function(d){if(map[d.key]){map[d.key].from=d.from;map[d.key].selector=d.selector;d.el=map[d.key].el;d.close=map[d.key].close;}});if(navBusy)return;
  while(stack.length&&!map[stack[stack.length-1].key]){var d=stack.pop();if(d.token&&history.state&&history.state.flExit===d.token){if(C3.nav&&C3.nav.backing)return;navBusy=true;if(C3.nav)C3.nav.backing=true;history.back();return;}}
  found.forEach(function(d){if(stack.some(function(x){return x.key===d.key;}))return;d.from=from||C3.root.activeElement||document.activeElement;d.selector=ident(d.from);d.token='fl-exit-'+Date.now()+'-'+(++serial);try{history.pushState(Object.assign({},history.state||{},{flExit:d.token}),'');}catch(e){d.token=null;}stack.push(d);});
 }
 function schedule(){if(!queued){queued=true;requestAnimationFrame(sync);}}
 function dismiss(){var d=stack[stack.length-1];if(!d||!visible[d.key])return false;d.close();restore(d);schedule();return true;}
 function init(){
  if(started)return;if(!C3.mounted||!C3.root){requestAnimationFrame(init);return;}started=true;
  function remember(e){var path=e.composedPath?e.composedPath():[e.target],n=path.find(function(x){return x&&x.matches&&x.matches('button,summary,a,input,select');});if(n&&!n.hasAttribute('data-fl-close'))from=n;}
  document.addEventListener('pointerdown',remember,true);C3.root.addEventListener('pointerdown',remember,true);
  document.addEventListener('keydown',function(e){var n=e.composedPath&&e.composedPath()[0];if((e.key==='Enter'||e.key===' ')&&n&&n.hasAttribute&&n.hasAttribute('data-fl-close')){e.preventDefault();e.stopImmediatePropagation();n.click();return;}if(e.key!=='Escape'||shown(C3.root.querySelector('.c3-ov:not([hidden])')))return;if(dismiss()){e.preventDefault();e.stopImmediatePropagation();}},true);
  window.addEventListener('popstate',function(){var token=history.state&&history.state.flExit;navBusy=false;while(stack.length&&stack[stack.length-1].token!==token){var d=stack.pop();if(visible[d.key]){d.close();restore(d);}}schedule();});
  var observer=new MutationObserver(schedule);[document.body,C3.root].forEach(function(root){observer.observe(root,{childList:true,subtree:true,attributes:true,attributeFilter:['hidden','open','aria-expanded']});});
  var x=document.getElementById('shClose');if(x){x.textContent='Close';x.title='Close this panel';}
  C3.dismiss={close:dismiss,scan:sync,open:function(){return stack.map(function(d){return d.key;});}};schedule();
 }requestAnimationFrame(init);
})();

