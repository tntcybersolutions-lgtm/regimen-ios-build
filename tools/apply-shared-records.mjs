// Shared account records. Fail closed on an unexpected master and stay idempotent.
export function applySharedRecords(html){
 if(html.includes('/* shared-records-v1 */'))return html;
 const patch=(a,b)=>{if(!html.includes(a))throw Error('Shared records anchor missing: '+a.slice(0,70));html=html.replace(a,b);};
 patch('    const coach=ALL.coach||{};',`    /* shared-records-v1 */
    for(const key of ['injuries','customFood']) out.push({kind:'pref',key:'shared:'+key,at:iso(Date.now()),data:{list:ALL[key]||[],removed:ALL[key+'Removed']||{}},updated_at:iso(Date.now())});
    if(ALL.units)out.push({kind:'pref',key:'shared:units',at:iso(ALL.unitsAt||0),data:{value:ALL.units,at:ALL.unitsAt||0},updated_at:iso(Date.now())});
    const coach=ALL.coach||{};`);
 patch("      if(r.kind === 'pref' && r.key === 'foodFav'){",`      if(r.kind==='pref' && ['shared:injuries','shared:customFood','shared:units'].includes(r.key)){if(r.data && typeof r.data==='object')st[r.key]=r.data;return;}
      if(r.kind === 'pref' && r.key === 'foodFav'){`);
 patch('      if(R.protoX) out._protoX = R.protoX;',`      for(const key of ['injuries','customFood']){
        const incoming=R['shared:'+key]||{},removed={...(incoming.removed||{})},items=new Map();
        for(const [id,at] of Object.entries(local[key+'Removed']||{}))removed[id]=Math.max(+removed[id]||0,+at||0);
        const stamp=x=>Math.max(+x.updatedAt||0,+x.at||0,+x.healed||0);
        for(const row of [...(incoming.list||[]),...(local[key]||[])])if(row&&row.id){const old=items.get(String(row.id));if(!old||stamp(row)>stamp(old)||(stamp(row)===stamp(old)&&JSON.stringify(row)>JSON.stringify(old)))items.set(String(row.id),row);}
        out[key]=Array.from(items.values()).filter(row=>!removed[row.id]||stamp(row)>removed[row.id]).sort((a,b)=>String(a.id).localeCompare(String(b.id)));
        out[key+'Removed']=removed;
      }
      const ru=R['shared:units'];
      if(ru&&['metric','imperial'].includes(ru.value)&&(!local.units||(+ru.at||0)>(+local.unitsAt||0)||((+ru.at||0)===(+local.unitsAt||0)&&ru.value>local.units))){out.units=ru.value;out.unitsAt=+ru.at||0;}
      if(R.protoX) out._protoX = R.protoX;`);
 patch("  ALL.units = (sys === 'metric') ? 'metric' : 'imperial';", "  ALL.units = (sys === 'metric') ? 'metric' : 'imperial';\n  ALL.unitsAt = Math.max(Date.now(),(+ALL.unitsAt||0)+1);");
 patch("const row = {id:'inj_'", "const row = {updatedAt:Date.now(),id:'inj_'");
 patch('  i.healed = on ? Date.now() : null;', '  i.healed = on ? Date.now() : null;\n  i.updatedAt=Math.max(Date.now(),(+i.updatedAt||+i.at||0)+1);');
 patch('  const gone = list.splice(i, 1)[0]; save();', "  const gone = list.splice(i, 1)[0];\n  ALL.injuriesRemoved=ALL.injuriesRemoved||{};ALL.injuriesRemoved[id]=Math.max(Date.now(),(+gone.updatedAt||+gone.at||0)+1);save();");
 patch('    ALL.customFood.push(rec);', '    rec.updatedAt=Date.now();ALL.customFood.push(rec);');
 patch('  ALL.customFood.push(rec);', '  rec.updatedAt=Date.now();ALL.customFood.push(rec);');
 patch('  const i = ALL.customFood.findIndex(x => x.id === food.id);', '  food={...food,updatedAt:Math.max(Date.now(),(+((ALL.customFood||[]).find(x=>x.id===food.id)||{}).updatedAt||0)+1)};\n  const i = ALL.customFood.findIndex(x => x.id === food.id);');
 patch('ALL.customFood.push({id, n: ing.name', 'ALL.customFood.push({updatedAt:Date.now(),id, n: ing.name');
 patch('function customFoods(){', `function customFoodDelete(id){
  const old=(ALL.customFood||[]).find(x=>x.id===id);\n  ALL.customFood=(ALL.customFood||[]).filter(x=>x.id!==id);
  ALL.customFoodRemoved=ALL.customFoodRemoved||{};ALL.customFoodRemoved[id]=Math.max(Date.now(),(+old?.updatedAt||0)+1);save();
}
function customFoods(){`);
 return html;
}
