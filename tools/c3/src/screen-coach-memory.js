/* Consent is off until the member enables it. Preferences use account-owned
   private_log rows; memory notes retain their original source and edit date. */
(function(){
  'use strict';
  var C3=window.C3;if(!C3)return;
  C3.sessionRun=Date.now().toString(36)+Math.random().toString(36).slice(2,8);
  var day=86400000;
  function prefs(){return ALL.memoryPrefs||{enabled:false,days:90,at:0};}
  function owner(){try{return CLOUD.signedIn()?String(CLOUD.user().id||''):'';}catch(e){return '';}}
  function expiry(at){return (+at||Date.now())+Math.max(1,Math.min(365,+prefs().days||90))*day;}
  function active(row){return !!row&&!row.del&&(+row.expiresAt||expiry(row.at))>Date.now();}
  function change(values){ALL.memoryPrefs=Object.assign({},prefs(),values,{at:Math.max(Date.now(),(+prefs().at||0)+1)});save();}
  C3.memory={
    prefs:prefs,enabled:function(){return prefs().enabled===true;},active:active,expiry:expiry,change:change,
    capture:function(){return prefs().enabled===true?{state:ALL,user:owner(),revision:prefs().at}:null;},
    ownerToken:function(){return {state:ALL,user:owner()};},
    sameOwner:function(r){return !!r&&r.state===ALL&&r.user===owner();},
    valid:function(r){return !!r&&r.state===ALL&&r.user===owner()&&prefs().enabled===true&&r.revision===prefs().at;},
    list:function(cid){return Object.entries(coachFile()).filter(function(e){return e[1]&&!e[1].del&&(!cid||e[1].cid===cid);}).map(function(e){return Object.assign({key:e[0]},e[1]);});},
    edit:function(key,text,days){
      var row=coachFile()[key],t=String(text||'').replace(/\s+/g,' ').trim();
      if(!row||row.del||!t||t.length>220||LANE_RE.test(t))return false;
      row.text=t;row.updatedAt=Date.now();row.editedBy='member';row.expiresAt=Date.now()+Math.max(1,Math.min(365,+days||90))*day;save();return true;
    },
    answers:function(){var b=brainState(),out=[];['learn','cand'].forEach(function(kind){Object.entries(b[kind]||{}).forEach(function(e){if(e[1]&&!e[1].del)out.push(Object.assign({key:e[0],kind:kind},e[1]));});});return out;},
    editAnswer:function(kind,key,text){var row=(brainState()[kind]||{})[key],t=String(text||'').trim();if(!row||row.del||!t||t.length>1400||LANE_RE.test(t))return false;row[kind==='learn'?'body':'a']=t;row.updatedAt=Date.now();row.editedBy='member';row.expiresAt=expiry(Date.now());BRAIN_IDF.map=null;save();return true;},
    forget:function(){var f=coachFile(),b=brainState(),snap={state:ALL,user:owner(),enabled:prefs().enabled,files:[],learn:[],cand:[]};Object.keys(f).forEach(function(k){if(f[k]&&!f[k].del){snap.files.push(k);fileDel(k);}});['learn','cand'].forEach(function(kind){Object.keys(b[kind]||{}).forEach(function(k){if(!b[kind][k].del){snap[kind].push(k);b[kind][k].del=Date.now();}});});BRAIN_IDF.map=null;change({enabled:false});return snap;},
    restore:function(snap){if(!this.sameOwner(snap))return false;var f=coachFile(),b=brainState();snap.files.forEach(function(k){if(f[k]){delete f[k].del;f[k].updatedAt=Date.now();}});['learn','cand'].forEach(function(kind){snap[kind].forEach(function(k){if(b[kind][k]){delete b[kind][k].del;b[kind][k].updatedAt=Date.now();}});});BRAIN_IDF.map=null;change({enabled:snap.enabled});return true;}
  };
})();
