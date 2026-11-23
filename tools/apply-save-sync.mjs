// Accurate save receipts and bounded, account-scoped synchronization.
export function applySaveSync(html) {
  html=html.replace('Nothing typed since you opened the app is saved, ', 'Your latest changes could not be saved on this device, ');
  if(html.includes('/* formed save sync v356 */')) return html.replace("SYNC.at=0;SYNC.state='idle';SYNC.pending=false;localStorage.removeItem('theregimen.syncedAt');", "SYNC.at=0;SYNC.state='idle';SYNC.pending=false;SYNC.dirty=localStorage.getItem('formed.sync.dirty.'+next)==='1';localStorage.removeItem('theregimen.syncedAt');");
  const patch=(a,b)=>{if(!html.includes(a))throw new Error('Save/sync source anchor missing: '+a.slice(0,85));html=html.replace(a,b);};
  patch('function save(){\n  ALL.updatedAt = Date.now();',`function save(){
  /* formed save sync v356 */
  if(!SYNC.hold) window.FL_SAVE_REVISION=(window.FL_SAVE_REVISION||0)+1;
  ALL.updatedAt = Date.now();`);
  patch('    }finally{ clearTimeout(t); }\n  }\n  async function call', '    }finally{ clearTimeout(t); if(opts?.signal)opts.signal.removeEventListener("abort",abortParent); }\n  }\n  async function call');
  patch('    const t = setTimeout(()=>ac.abort(), ms || 20000);',`    const abortParent=()=>ac.abort();
    if(opts?.signal){if(opts.signal.aborted)ac.abort();else opts.signal.addEventListener('abort',abortParent,{once:true});}
    const t = setTimeout(()=>ac.abort(), ms || 20000);`);
  patch('  async function db(path, opts, retried){\n    const tok = await token();',`  async function db(path, opts, retried, context){
    const valid=()=>!context||(!context.controller.signal.aborted&&context.owner===user()?.id);
    if(!valid())return {ok:false,status:0,body:{message:'Sync stopped. Your device copy is kept; retry when ready.'}};
    const tok = await token();
    if(!valid())return {ok:false,status:0,body:{message:'Sync stopped. Your device copy is kept; retry when ready.'}};`);
  patch('    const res = await call(CFG.api + path, {...o,', '    const res = await call(CFG.api + path, {...o, ...(context?{signal:context.controller.signal}:{}),');
  patch('return db(path, opts, true);','return db(path, opts, true, context);');
  patch("  const rows  = async (path) => { const r = await db(path); return r.ok && Array.isArray(r.body) ? r.body : []; };",`  const rows = async (path,context) => {
    const r=await db(path,undefined,false,context);
    if(context&&(!r.ok||!Array.isArray(r.body)))throw new Error('Could not read your saved records. No cleanup was started; retry sync.');
    const list=r.ok&&Array.isArray(r.body)?r.body:[];
    if(context?.phase==='pull')context.baseline[path.split('?')[0].slice(1)]=list;
    return list;
  };`);
  patch('  const post  = (path, data, prefer) => db(path, {method:', '  const post  = (path, data, prefer, context) => db(path, {method:');
  patch('body:JSON.stringify(data)});\n  const patch', 'body:JSON.stringify(data)},false,context);\n  const patch');
  patch("  const del   = (path) => db(path, {method:'DELETE'});", "  const del   = (path,context) => db(path, {method:'DELETE'},false,context);");
  patch('const upsert = (table, onConflict, list) => post(', 'const upsert = (table, onConflict, list,context) => post(');
  patch("    'resolution=merge-duplicates,return=minimal');\n\n  /* ---------- shape helpers", "    'resolution=merge-duplicates,return=minimal',context);\n\n  /* ---------- shape helpers");
  patch('  async function dropExtras(table, col, keys){','  async function dropExtras(table, col, keys,context){');
  patch("const r = await del('/'+table+'?'+col+'=in.'+inList(part));", "const r = await del('/'+table+'?'+col+'=in.'+inList(part),context);");
  const p0=html.indexOf('  async function pullAll(){'),p1=html.indexOf('  function mergeState(',p0);
  if(p0<0||p1<0)throw new Error('Missing pull boundary');
  html=html.slice(0,p0)+html.slice(p0,p1).replace('async function pullAll(){','async function pullAll(context){').replace(/await rows\(([^\n]+)\);/g,'await rows($1,context);')+html.slice(p1);
  const u0=html.indexOf('  async function pushAll(ALL, S, opts){'),u1=html.indexOf('\n  /* ============================================================',u0);
  if(u0<0||u1<0)throw new Error('Missing push boundary');
  let push=html.slice(u0,u1).replace(/\bpost\(/g,'syncPost(').replace(/\brows\(/g,'syncRows(').replace(/\bupsert\(/g,'syncUpsert(').replace(/\bdropExtras\(/g,'syncDrop(');
  push=push.replace("    const prune = !opts || opts.prune !== false;",`    const context=opts?.syncContext;
    const syncPost=(path,data,prefer)=>post(path,data,prefer,context);
    const syncRows=path=>rows(path,context);
    const syncUpsert=(table,key,list)=>upsert(table,key,list,context);
    const syncDrop=(table,key,list)=>dropExtras(table,key,list,context);
    // Never prune a row added or changed by another device after our pull.
    const eligible=(table,row)=>!context||(context.baseline[table]||[]).some(old=>JSON.stringify(old)===JSON.stringify(row));
    const prune = !opts || opts.prune !== false;`);
  push=push.replace("const saved = await syncRows('/protocols?select=id,client_id');", "const saved = await syncRows('/protocols?select=*');");
  push=push.replace("const svProto = await syncRows('/protocols?select=id,client_id');", "const svProto = await syncRows('/protocols?select=*');");
  push=push.replace('svProto.filter(x=>!want.protocols', "svProto.filter(x=>eligible('protocols',x)).filter(x=>!want.protocols");
  push=push.replace("const svDose = await syncRows('/doses?select=id,protocol_id,at');", "const svDose = await syncRows('/doses?select=*');");
  push=push.replace('svDose.filter(x=>!want.doses',"svDose.filter(x=>eligible('doses',x)).filter(x=>!want.doses");
  push=push.replace('const sv = await syncRows(sel);',"const sv = await syncRows('/'+K.table+'?select=*');");
  push=push.replace('sv.filter(x=>!keys.has', 'sv.filter(x=>eligible(K.table,x)).filter(x=>!keys.has');
  push=push.replace("const svDay = await syncRows('/daily?select=day');", "const svDay = await syncRows('/daily?select=*');");
  push=push.replace('svDay.filter(x=>!dayKeys.has',"svDay.filter(x=>eligible('daily',x)).filter(x=>!dayKeys.has");
  html=html.slice(0,u0)+push+html.slice(u1);
  patch('    syncing = true;\n    try{\n      const got = await pullAll();',`    syncing = true;
    const context={owner:user()?.id,controller:new AbortController(),baseline:{},phase:'pull'};
    const deadline=setTimeout(()=>context.controller.abort(),45000);
    try{
      const got = await pullAll(context);`);
  patch('      const up = await pushAll(merged, S);', "      context.phase='push';\n      const up = await pushAll(merged, S,{syncContext:context});");
  patch("      if(!up.ok) return {ok:false, error:up.error, state:merged};", "      if(!up.ok) return {ok:false, error:up.error, state:merged};\n      if(up.counts?.privSkipped?.length)return {ok:false,error:'Some private records remain on this device. Retry sync or contact support.'};");
  patch('    } finally { syncing = false; }', "    } catch(e){return {ok:false,error:context.controller.signal.aborted?'Sync took too long. Your device copy is kept; retry now.':e.message||'Sync failed. Retry now.'};}\n    finally { clearTimeout(deadline); syncing = false; }");
  patch("  if(!canSync() || !SYNC.auto || SYNC.hold) return;\n  clearTimeout(SYNC.timer);",`  if(SYNC.hold)return;
  SYNC.dirty=true;
  try{localStorage.setItem('formed.sync.dirty.'+(window.FL_PROFILE?.owner()||'guest'),'1');}catch(e){}
  if(!canSync() || !SYNC.auto) {try{window.C3?.syncPaint();}catch(e){}return;}
  clearTimeout(SYNC.timer);`);
  patch("  SYNC.state = 'busy'; SYNC.err = ''; paintSync();\n  let r;", "  SYNC.state = 'busy'; SYNC.err = ''; paintSync();\n  const revision=window.FL_SAVE_REVISION||0;\n  let r;");
  patch("  if(CLOUD.user()?.id!==syncOwner){SYNC.state='idle';return {ok:false,error:'Account changed.'};}",`  const edited=(window.FL_SAVE_REVISION||0)!==revision;
  if(edited&&r?.ok)r={...r,state:null};
  if(CLOUD.user()?.id!==syncOwner){SYNC.state='idle';return {ok:false,error:'Account changed.'};}`);
  patch("    SYNC.at = r.at || Date.now(); SYNC.state = 'idle'; SYNC.err = '';",`    SYNC.at = r.at || Date.now(); SYNC.state = 'idle'; SYNC.err = '';
    SYNC.dirty=edited;SYNC.pending=edited;
    try{const key='formed.sync.dirty.'+(window.FL_PROFILE?.owner()||'guest');if(!edited)localStorage.removeItem(key);}catch(e){}
    if(edited&&SYNC.auto)queueSync();`);
  patch("SYNC.at=0;SYNC.state='idle';SYNC.pending=false;localStorage.removeItem('theregimen.syncedAt');", "SYNC.at=0;SYNC.state='idle';SYNC.pending=false;SYNC.dirty=localStorage.getItem('formed.sync.dirty.'+next)==='1';localStorage.removeItem('theregimen.syncedAt');");
  patch("try{ SYNC.at   = +localStorage.getItem('theregimen.syncedAt') || 0; }catch(e){}", "try{ SYNC.at   = +localStorage.getItem('theregimen.syncedAt') || 0;SYNC.dirty=localStorage.getItem('formed.sync.dirty.'+(window.FL_PROFILE?.owner()||'guest'))==='1'; }catch(e){}");
  return html;
}
