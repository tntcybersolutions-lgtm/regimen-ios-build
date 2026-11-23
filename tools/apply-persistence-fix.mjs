// Account persistence fix (2 Nov 2026). Idempotent. Root causes fixed here:
//  1. The workouts table has no columns for a session's logged rows or loads, so every pull rebuilt the
//     session without them (new device, or the next sync on the same device if the local copy had no stamp).
//     The whole session now also rides in private_log as kind 'pref', key 'wl|<day>'; no schema change.
//  2. mergeState never read back `health` or `checkin` (they were pushed inside profiles.body but dropped on pull).
//  3. Several device settings (prefs, reminders, water schedule, TRT, setup finished, share level, ...) never left the device.
export function applyPersistenceFix(html) {
  return applyV4(applyV3(applyV2(applyV1(html))));
}
// v2 (2 Nov 2026, lane B bug): an account row that only holds the app's defaults (the first sync pushes them) must not
// overwrite the goal/mode/body/train the person just chose in setup. Previously the row's newer timestamp, or the
// fresh-sign-in rule, let the default replace the choice on the first sync.
function applyV2(html) {
  const patch = (a, b) => { if (!html.includes(a)) throw new Error('Persistence fix anchor missing: ' + a.slice(0, 90)); html = html.replace(a, () => b); };
  if (html.includes('/* persistence-fix-v2 */')) return html;
  patch("    ['mode','body','train','activeId'].forEach(k=>{ if(newer && remote[k] != null) out[k] = remote[k]; });",
`    /* persistence-fix-v2 */
    const remoteConfigured = !!((remote.body && remote.body.sex) || (remote.protocols||[]).some(p=>(p.doses||[]).length) ||
      (remote.weights||[]).length || Object.keys(remote.workLog||{}).length || ((remote.priv||{}).settingsBlob && (remote.priv.settingsBlob.v||{}).setupDone) ||
      (remote.train && ((remote.train.ex && Object.keys(remote.train.ex).length) || (remote.train.overrides && Object.keys(remote.train.overrides).length))));
    ['mode','body','train','activeId'].forEach(k=>{ if(newer && remoteConfigured && remote[k] != null) out[k] = remote[k]; });
    if(newer && !remoteConfigured && !(local.body && local.body.sex) && !local.setupDone && local.train && !Object.keys(local.train).length && remote.train) out.train = remote.train;`);
  return html;
}
function applyV1(html) {
  const patch = (a, b) => { if (!html.includes(a)) throw new Error('Persistence fix anchor missing: ' + a.slice(0, 90)); html = html.replace(a, () => b); };
  if (html.includes('/* persistence-fix-v1 */')) return html;

  // 1a. push: one private row per workout day (full session) + one settings row
  patch("    if(ALL.workouts || ALL.workoutsRemoved) out.push({kind:'pref',key:'workoutLibrary'",
`    /* persistence-fix-v1 */
    (function(){
      const cutoff=Date.now()-400*864e5;
      Object.entries(ALL.workLog||{}).forEach(([day,entry])=>{
        if(!entry||typeof entry!=='object'||!/^\\d{4}-\\d{2}-\\d{2}$/.test(day))return;
        const sig=JSON.stringify(Object.assign({},entry,{updatedAt:0,_sig:0}));
        if(entry._sig!==sig){entry._sig=sig;entry.updatedAt=Date.now();}
        if((+entry.updatedAt||0)<cutoff&&(+entry.at||0)<cutoff)return;
        out.push({kind:'pref',key:'wl|'+day,at:iso(+entry.updatedAt||+entry.at||Date.now()),data:{day,entry},updated_at:iso(Date.now())});
      });
      const set={};
      ['prefs','reminders','waterSched','trt','setupDone','share','hkBodyFat','nutSeen'].forEach(k=>{if(ALL[k]!=null)set[k]=ALL[k];});
      const ssig=JSON.stringify(set);
      if(ALL._settingsSig!==ssig){ALL._settingsSig=ssig;ALL.settingsAt=Date.now();}
      if(Object.keys(set).length)out.push({kind:'pref',key:'settingsBlob',at:iso(+ALL.settingsAt||Date.now()),data:{at:+ALL.settingsAt||Date.now(),v:set},updated_at:iso(Date.now())});
    })();
    if(ALL.workouts || ALL.workoutsRemoved) out.push({kind:'pref',key:'workoutLibrary'`);

  // 1b. pull: collect them
  patch("      if(r.kind === 'pref' && (r.key.startsWith('coachReceipt|')",
`      if(r.kind==='pref'&&typeof r.key==='string'&&r.key.startsWith('wl|')){
        if(r.data&&r.data.entry&&typeof r.data.entry==='object'){(st.workLogFull=st.workLogFull||{})[r.key.slice(3)]=r.data.entry;}
        return;
      }
      if(r.kind==='pref'&&r.key==='settingsBlob'){if(r.data&&r.data.v)st.settingsBlob=r.data;return;}
      if(r.kind === 'pref' && (r.key.startsWith('coachReceipt|')`);

  // 2+1c+3. merge
  patch("    dayMap('hydration'); dayMap('steps');",
`    dayMap('hydration'); dayMap('steps');
    /* persistence-fix-v1: the full session (rows, loads) beats the table copy, which cannot hold them.
       Local wins unless the account holds a strictly newer full copy; a local session is never replaced by the stripped table row. */
    (function(){
      const RF=(remote.priv||{}).workLogFull||{}, stamp=x=>Math.max(+(x&&x.updatedAt)||0,+(x&&x.at)||0);
      out.workLog={...(out.workLog||{})};
      const days=new Set(Object.keys(RF).concat(Object.keys(local.workLog||{})));
      days.forEach(day=>{
        const l=(local.workLog||{})[day], f=RF[day];
        if(l&&!f){out.workLog[day]=l;return;}
        if(f&&!l){out.workLog[day]=f;return;}
        if(f&&l){out.workLog[day]=stamp(f)>stamp(l)?f:l;}
      });
      const sb=(remote.priv||{}).settingsBlob;
      if(sb&&sb.v&&(+sb.at||0)>(+local.settingsAt||0)){Object.entries(sb.v).forEach(([k,v])=>{out[k]=v;});out.settingsAt=+sb.at;}
      if(remote.checkin&&(+(remote.checkin.lastAt)||0)>(+((local.checkin||{}).lastAt)||0))out.checkin=remote.checkin;
      if(remote.health){
        const lh=local.health||{},rh=remote.health;
        const lk=+lh.askedAt||0,rk=+rh.askedAt||0,lEmpty=!(lh.conds&&lh.conds.length)&&!lh.meds&&!lh.notes;
        if(rk>lk||(lEmpty&&rk>=lk))out.health=rh;
      }
    })();`);
  return html;
}

// v3: an account that never chose a compound must not get a Tirzepatide protocol on the server.
// The built-in starter protocol (compound tirz, 2.5 mg, weekly) is only a placeholder so screens never crash.
// It is not pushed, and the profile mode is not 'peptide', until the person finished setup in peptide mode or logged a dose.
function applyV3(html) {
  if (html.includes('/* persistence-fix-v3 */')) return html;
  const swaps = [
    ["color: me.color || '#0b63d6', mode: ALL.mode || 'peptide',",
     "color: me.color || '#0b63d6', mode: (ALL.setupDone || (ALL.protocols || []).some(p => (p.doses || []).length) ? (ALL.mode || 'peptide') : 'training'), /* persistence-fix-v3 */"],
    ["const locals = ALL.protocols || [];",
     "const locals = (ALL.protocols || []).filter(p => (p.doses || []).length || (ALL.setupDone && ALL.mode === 'peptide')); /* persistence-fix-v3: placeholder starter protocol is not data */"],
  ];
  for (const [a, b] of swaps) {
    if (!html.includes(a)) throw new Error('Persistence fix anchor missing: ' + a);
    html = html.replace(a, () => b);
  }
  return html;
}

// v4: a planned-meal tag ('mp:YYYY-MM-DD:n') went into nutrition_log_entries.plan_meal_id, a uuid column, so the first
// planned meal logged made every later sync fail. Only real uuids go in that column; the tag rides in nutrients._pm.
// And one rejected row (bad data) no longer blocks the rest of the sync: the batch is retried row by row and bad rows are skipped.
function applyV4(html) {
  if (html.includes('/* persistence-fix-v4 */')) return html;
  const swaps = [
    ["plan_meal_id: e.pm || null,",
     "plan_meal_id: (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(e.pm || '') ? e.pm : null), /* persistence-fix-v4 */"],
    ["...(e.mic ? {mic:e.mic} : {})},",
     "...(e.mic ? {mic:e.mic} : {}), ...(e.pm && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(e.pm) ? {_pm:String(e.pm)} : {})},"],
    ["if(r.plan_meal_id) e.pm = r.plan_meal_id;",
     "if(r.plan_meal_id) e.pm = r.plan_meal_id; else if(n._pm) e.pm = String(n._pm);"],
    ["      const res = await fn(part);\n      if(!res.ok) return (res.body && res.body.message) || 'The server refused a write.';",
     "      const res = await fn(part);\n      if(!res.ok){\n        const msg = (res.body && res.body.message) || 'The server refused a write.';\n        const bad = /invalid input syntax|malformed|out of range|violates (check|not-null)/i;\n        if(!bad.test(msg)) return msg;\n        for(const row of part){ const r1 = await fn([row]); if(!r1.ok){ const m1 = (r1.body && r1.body.message) || ''; if(!bad.test(m1)) return m1 || msg; } }\n      }"],
  ];
  for (const [a, b] of swaps) {
    if (!html.includes(a)) throw new Error('Persistence fix anchor missing: ' + a);
    html = html.replace(a, () => b);
  }
  return html;
}
