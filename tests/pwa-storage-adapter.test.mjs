import test from"node:test";
import assert from"node:assert/strict";
import{STORAGE_ADAPTER_CONTRACT,canonicalStateFromRows,canonicalizeRemote,createCanonicalChromeFacade,createCanonicalStorageAdapter,isCloudSettingId,toCanonicalDrawing,toStoredDrawing}from"../web/js/storage-adapter.js";

test("only portable preferences are eligible for Firebase sync",()=>{
  for(const id of ["lastSymbol","timeframe","visibleBars","pricePercent","priceShift","priceScale","crossMode","drawingDefaults"])assert.equal(isCloudSettingId(id),true,id);
  for(const id of ["visible","collapsed","left","top","width","height","panBars","uiDefaultsVersion","replay","historyPast"])assert.equal(isCloudSettingId(id),false,id);
});

test("canonical codec hides row metadata and maps legacy Price Range types",()=>{
  const row={id:"drawing-1",symbol:"BTCUSDT",type:"priceRange",pane:"price",a:{time:1,price:2},b:{time:3,price:4},revision:7,updatedAt:9,deviceId:"device-a",deleted:false};
  assert.deepEqual(toCanonicalDrawing(row),{type:"range",pane:"price",a:{time:1,price:2},b:{time:3,price:4},__cfrsiId:"drawing-1"});
  assert.equal(toStoredDrawing({type:"range",a:row.a},{id:row.id,symbol:row.symbol}).type,"priceRange");
  assert.deepEqual(STORAGE_ADAPTER_CONTRACT.canonicalDrawingTypes,["fib","long","range","dateRange","trend","text"]);
});

test("Fibonacci rows always keep their type and strip transient pointer coordinates",async()=>{
  let replacement;
  const adapter=createCanonicalStorageAdapter({listSettingRows:async()=>[],listDrawings:async()=>[],replaceDrawings:async(symbol,next)=>{replacement=next},setSetting:async()=>{}},{makeId:()=>"fib-id-1"});
  await adapter.loadState();
  await adapter.saveState({fibDrawings:{BTCUSDT:[{a:{time:1,price:2,clientX:10,clientY:20},b:{time:3,price:4,clientX:30,clientY:40}}]}});
  assert.equal(replacement[0].type,"fib");
  assert.deepEqual(replacement[0].a,{time:1,price:2});
  assert.deepEqual(replacement[0].b,{time:3,price:4});
  assert.equal("__cfrsiId" in replacement[0],false);
});

test("canonical state maps settings and splits symbol-level drawing collections",()=>{
  const state=canonicalStateFromRows([{id:"timeframe",value:"H4"},{id:"drawingDefaults",value:{trend:{color:"#f00"}}}],[{id:"f",symbol:"BTCUSDT",type:"fib",a:{time:1,price:2}},{id:"r",symbol:"BTCUSDT",type:"priceRange",a:{time:2,price:3}},{id:"gone",symbol:"BTCUSDT",type:"trend",a:{time:3,price:4},deleted:true}]);
  assert.equal(state.selected,"H4");
  assert.deepEqual(state.toolDefaults,{trend:{color:"#f00"}});
  assert.equal(state.fibDrawings.BTCUSDT.length,1);
  assert.equal(state.toolDrawings.BTCUSDT[0].type,"range");
});

test("adapter preserves IDs across edits and keeps local-only settings out of cloud queue",async()=>{
  const settings=[],drawings=[{id:"stable-id",symbol:"BTCUSDT",type:"priceRange",a:{time:1,price:2},b:{time:2,price:3}}],writes=[];
  const repository={
    listSettingRows:async()=>settings,
    listDrawings:async(symbol,{includeDeleted=false}={})=>drawings.filter(row=>(!symbol||row.symbol===symbol)&&(includeDeleted||!row.deleted)),
    replaceDrawings:async(symbol,next)=>{writes.push(next);drawings.splice(0,drawings.length,...next)},
    setSetting:async(id,value,options)=>{settings.push({id,value});writes.push({id,options})},
    removeSetting:async id=>{const index=settings.findIndex(row=>row.id===id);if(index>=0)settings.splice(index,1)}
  };
  const adapter=createCanonicalStorageAdapter(repository,{makeId:()=>"new-id"}),loaded=await adapter.loadState();
  loaded.toolDrawings.BTCUSDT[0].b.price=9;
  await adapter.saveState({toolDrawings:loaded.toolDrawings,visible:false,toolDefaults:{trend:{color:"#f00"}}});
  assert.equal(writes[0][0].id,"stable-id");
  assert.equal(writes[0][0].type,"priceRange");
  assert.equal(writes[0][0].contentHash,"cfrsi-order:0");
  assert.deepEqual(writes[1],{id:"visible",options:{sync:false}});
  assert.deepEqual(writes[2],{id:"drawingDefaults",options:{sync:true}});
  assert.equal("revision"in loaded.toolDrawings.BTCUSDT[0],false);
  assert.equal(canonicalizeRemote("drawing",{symbol:"BTCUSDT",type:"priceRange",a:{time:1,price:2},deleted:false}).row.drawing.type,"range");
});

test("stable reconciliation keeps an edited middle ID when an earlier drawing is deleted",async()=>{
  const drawing=(id,time,price)=>({id,symbol:"BTCUSDT",type:"trend",pane:"price",a:{time,price},b:{time:time+1,price:price+1}}),drawings=[drawing("A",1,1),drawing("B",10,10),drawing("C",20,20)];
  let replacement;
  const adapter=createCanonicalStorageAdapter({listSettingRows:async()=>[],listDrawings:async(symbol)=>drawings.filter(row=>!symbol||row.symbol===symbol),replaceDrawings:async(symbol,next)=>{replacement=next},setSetting:async()=>{}},{makeId:()=>"new-id"});
  const state=await adapter.loadState(),editedB={...state.toolDrawings.BTCUSDT[1],style:{color:"#00f"}},unchangedC=state.toolDrawings.BTCUSDT[2];
  await adapter.saveState({toolDrawings:{BTCUSDT:[editedB,unchangedC]}});
  assert.deepEqual(replacement.map(row=>row.id),["B","C"]);
  assert.equal(replacement.some(row=>row.id==="A"),false);
  assert.equal("id"in editedB,false);
});

test("stable reconciliation keeps B when A and C are deleted while B is edited",async()=>{
  const drawing=(id,time)=>({id,symbol:"BTCUSDT",type:"trend",pane:"price",a:{time,price:time},b:{time:time+1,price:time+1}}),drawings=[drawing("A",1),drawing("B",10),drawing("C",20)];
  let replacement;
  const adapter=createCanonicalStorageAdapter({listSettingRows:async()=>[],listDrawings:async(symbol)=>drawings.filter(row=>!symbol||row.symbol===symbol),replaceDrawings:async(symbol,next)=>{replacement=next},setSetting:async()=>{}},{makeId:()=>"new-id"});
  const state=await adapter.loadState(),edited={...state.toolDrawings.BTCUSDT[1],b:{time:99,price:99}};
  await adapter.saveState({toolDrawings:{BTCUSDT:[edited]}});
  assert.deepEqual(replacement.map(row=>row.id),["B"]);
});

test("new identical drawings receive IDs before reload so deleting the first keeps the second ID",async()=>{
  const rows=[];let sequence=0;
  const repository={listSettingRows:async()=>[],listDrawings:async(symbol,{includeDeleted=false}={})=>rows.filter(row=>(!symbol||row.symbol===symbol)&&(includeDeleted||!row.deleted)),replaceDrawings:async(symbol,next)=>rows.splice(0,rows.length,...next),setSetting:async()=>{}};
  const adapter=createCanonicalStorageAdapter(repository,{makeId:()=>`generated-${++sequence}`});
  await adapter.loadState();
  const shape=()=>({type:"trend",pane:"price",a:{time:1,price:1},b:{time:2,price:2}}),a=shape();
  await adapter.saveState({toolDrawings:{BTCUSDT:[a]}});
  const b=shape();
  await adapter.saveState({toolDrawings:{BTCUSDT:[a,b]}});
  assert.equal(a.__cfrsiId,"generated-1");
  assert.equal(b.__cfrsiId,"generated-2");
  await adapter.saveState({toolDrawings:{BTCUSDT:[b]}});
  assert.deepEqual(rows.map(row=>row.id),["generated-2"]);
});

test("adapter serializes overlapping canonical writes",async()=>{
  const settings=[],order=[];
  const adapter=createCanonicalStorageAdapter({listSettingRows:async()=>settings,listDrawings:async()=>[],replaceDrawings:async()=>{},setSetting:async(id,value)=>{if(value==="H1")await new Promise(resolve=>setTimeout(resolve,15));const found=settings.find(row=>row.id===id);if(found)found.value=value;else settings.push({id,value});order.push(value)},removeSetting:async()=>{} });
  await Promise.all([adapter.saveState({selected:"H1"}),adapter.saveState({selected:"H4"})]);
  assert.deepEqual(order,["H1","H4"]);
  assert.equal((await adapter.get("selected")).selected,"H4");
});

test("canonical map writes skip unchanged symbols",async()=>{
  const rows=[{id:"btc",symbol:"BTCUSDT",type:"trend",a:{time:1,price:1}},{id:"eth",symbol:"ETHUSDT",type:"fib",a:{time:2,price:2}}],replaced=[];
  const adapter=createCanonicalStorageAdapter({listSettingRows:async()=>[],listDrawings:async(symbol)=>rows.filter(row=>!symbol||row.symbol===symbol),replaceDrawings:async(symbol,next)=>replaced.push({symbol,next}),setSetting:async()=>{}},{makeId:()=>"new-id"}),state=await adapter.loadState();
  state.toolDrawings.BTCUSDT[0].style={color:"#f00"};
  await adapter.saveState({fibDrawings:state.fibDrawings,toolDrawings:state.toolDrawings});
  assert.deepEqual(replaced.map(item=>item.symbol),["BTCUSDT"]);
  assert.equal(replaced.some(item=>item.symbol==="ETHUSDT"),false);
});

test("chrome facade exposes callbacks, remote change events and inert sync shards",async()=>{
  const rows=[],adapter=createCanonicalStorageAdapter({listSettingRows:async()=>rows,listDrawings:async()=>[],replaceDrawings:async()=>{},setSetting:async(id,value)=>{rows.push({id,value})},removeSetting:async()=>{}},{makeId:()=>"id"}),chrome=createCanonicalChromeFacade(adapter,{baseUrl:"https://example.test/app/"});
  const changes=[];chrome.storage.onChanged.addListener((value,area)=>changes.push({value,area}));
  await new Promise(resolve=>chrome.storage.local.set({selected:"D"},resolve));
  assert.equal((await chrome.storage.local.get("selected")).selected,"D");
  assert.deepEqual(await chrome.storage.sync.get(null),{});
  assert.equal(chrome.runtime.getURL("icons/icon32.png"),"https://example.test/app/icons/icon32.png");
  assert.equal(changes[0].area,"local");chrome.destroy();
});
