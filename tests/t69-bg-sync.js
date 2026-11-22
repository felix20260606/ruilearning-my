// （原 t38）同步到生词本网站（/api/vocab）：词条生成、去重、并发写入不丢
const fs=require('fs'),vm=require('vm'),path=require('path');
// 服务器端的合并逻辑直接取自 web/_worker.js，测试和线上保持一致
const W=fs.readFileSync(path.join(__dirname,'..','web','_worker.js'),'utf8');
const { vadd }=new Function(W.slice(W.indexOf('const atOk'),W.indexOf('\n',W.indexOf('const atOk')))+W.slice(W.indexOf('const vdef'),W.indexOf('async function vocab'))+';return {vadd};')();
let bin={custom:[{id:"u_1",word:"tire"}],progress:{a:"known"},deleted:["v_growth"],pending:["growth","thesis","wake up"]},posts=0;
const store={saved:["growth","Tire"],savedSents:[{k:"ph|wake up",t:"wake up",tr:"醒来",ph:1,ctx:"And one day I woke up"}],savedCtx:{growth:{t:"The growth  mindset matters."}},"med:w:thesis":{t:"I wrote my thesis.",tr:"我写了论文。"}};
const ctx={console,setTimeout,clearTimeout,URL,encodeURIComponent,Promise,
 importScripts(){},
 chrome:{storage:{local:{get:async k=>{if(typeof k==="string")return{[k]:store[k]};const o={};for(const x in k)o[x]=store[x]??k[x];return o},set:async()=>{}},sync:{get:async d=>d},onChanged:{addListener(){}}},runtime:{onMessage:{addListener(){}},onInstalled:{addListener(){}},onStartup:{addListener(){}},getURL:x=>x},alarms:{create(){},onAlarm:{addListener(){}}},tabs:{create(){}},action:{onClicked:{addListener(){}}}},
 fetch:async(u,o)=>{u=String(u);
  if(u==="https://ruilearning-my.pages.dev/api/vocab"){ await new Promise(r=>setTimeout(r,20));
   if(o&&o.method==="POST"){const b=JSON.parse(o.body);const r=vadd(bin,b.add);bin=r.d;posts++;return{ok:true,json:async()=>({ok:true,added:r.n,total:bin.custom.length})}}
   return{ok:true,json:async()=>Object.assign({ok:true},JSON.parse(JSON.stringify(bin)))}}
  if(u.includes("translate_a")){const q=decodeURIComponent(u.split("q=")[1]);return{ok:true,json:async()=>[[["译:"+q]],[["noun",["甲","乙"]]]]}}
  return{ok:false,json:async()=>({})}}};
ctx.self=ctx;ctx.globalThis=ctx;vm.createContext(ctx);
let src=fs.readFileSync(path.join(__dirname,'..','extension','background.js'),'utf8');
vm.runInContext(src+"\n;globalThis.__t={makeEntry,cloudAdd,syncAll,addWord};",ctx);
let fail=0;const ok=(c,m)=>{if(!c){fail++;console.log("FAIL",m)}};
(async()=>{
 const e=await ctx.__t.makeEntry("woke",{ctx:{t:"And one day I woke up",tr:"然后有一天我醒了"}});
 ok(e.id==="v_woke"&&e.type==="word","id/type"); ok(e.examples[0][0]==="And one day I {woke} up","example mark "+JSON.stringify(e.examples)); ok(e.zh.includes("译:woke")&&e.zh.includes("甲"),"zh "+e.zh);
 const p=await ctx.__t.makeEntry("wake up",{}); ok(p.type==="phrase"&&p.id==="v_wake_up","phrase");
 // 并发三次加词都要落地
 await Promise.all(["alpha","beta","gamma"].map(w=>ctx.__t.addWord(w,false,{})));
 ok(["alpha","beta","gamma"].every(w=>bin.custom.some(x=>x.word===w)),"concurrent adds "+bin.custom.map(x=>x.word));
 const r=await ctx.__t.syncAll("zh-CN");
 const ws=bin.custom.map(x=>x.word.toLowerCase());
 ok(ws.filter(x=>x==="tire").length===1,"no dup of existing word"); ok(ws.includes("growth")&&ws.includes("thesis")&&ws.includes("wake up"),"backfill "+ws);
 ok(bin.pending.length===0,"pending cleared "+bin.pending); ok(bin.deleted.includes("v_growth")&&bin.custom.some(x=>x.word==="growth"&&x.id!=="v_growth"),"deleted word re-added with a new id (old id stays deleted)"); ok(bin.progress.a==="known","progress kept");
 const th=bin.custom.find(x=>x.word==="thesis"); ok(th.examples[0][1]==="我写了论文。","media ctx");
 const gr=bin.custom.find(x=>x.word==="growth"); ok(gr.examples[0][0]==="The {growth} mindset matters."&&gr.examples[0][1].startsWith("译:"),"ctx translated "+JSON.stringify(gr.examples));
 ok(r.cloud&&r.added===3,"result "+JSON.stringify(r));
 console.log(fail?"t38 FAILED":"t38 ok");
})();
