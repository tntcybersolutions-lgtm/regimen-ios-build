/* Quick log uses the same calendar-week totals as the top strip and Progress.
   h.week() describes the training calendar and can span different dates. */
(function(){
 'use strict';
 if(typeof logNum!=='function'||!window.C3)return;
 var original=logNum;
 logNum=function(kind){
  if(kind!=='session')return original(kind);
  try{
   var W=C3.h.stripData(),done=Math.max(0,W.done|0),planned=Math.max(0,W.planned|0);
   if(W.lane==='fit')return {big:planned?done+' / '+planned:String(done),of:' this week',frac:planned?done/planned:null,done:planned>0&&done>=planned};
  }catch(e){}
  return original(kind);
 };
})();
