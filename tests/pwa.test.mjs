import test from"node:test";import assert from"node:assert/strict";
import{ENABLED_SYMBOLS,resolveSymbol,timeframe}from"../web/js/config.js";
import{rsi,ema,wma,aggregateBiweekly,mergeRows,formatDuration,pointerAnchoredBounds,replayCutIndex,anchoredTimeScale}from"../web/js/math.js";
import{mapKlines}from"../web/js/binance.js";
import{SCHEMA,importLocalData}from"../web/js/storage.js";
import{createSyncEngine,newestByEntity}from"../web/js/sync-core.js";

test("fixed symbol allowlist and URL selection",()=>{assert.deepEqual(ENABLED_SYMBOLS,["BTCUSDT","ETHUSDT","DOGEUSDT"]);assert.equal(resolveSymbol("?symbol=ETHUSDT","BTCUSDT"),"ETHUSDT");assert.equal(resolveSymbol("?symbol=BAD","DOGEUSDT"),"DOGEUSDT")});
test("indicator math remains finite after warmup",()=>{const v=Array.from({length:80},(_,i)=>100+i+(i%4-2));const rv=rsi(v),ev=ema(rv,9),wv=wma(rv,45);assert.equal(rv.slice(14).every(Number.isFinite),true);assert.equal(ev.slice(14).every(Number.isFinite),true);assert.equal(wv.at(-1)>0,true)});
test("2W aggregation starts Monday and preserves OHLCV",()=>{const m=Date.UTC(1970,0,5),rows=[0,7,14].map((d,i)=>({time:m+d*864e5,open:10+i,high:12+i,low:8+i,close:11+i,volume:5,closeTime:0})),out=aggregateBiweekly(rows);assert.equal(out.length,2);assert.deepEqual([out[0].open,out[0].close,out[0].volume],[10,12,10]);assert.equal(timeframe("2W").biweekly,true)});
test("rows deduplicate by candle open time",()=>{assert.deepEqual(mergeRows([{time:1,close:1}],[{time:1,close:2},{time:2,close:3}]).map(x=>x.close),[2,3])});
test("Binance mapper and Date Range duration",()=>{assert.equal(mapKlines([[1,"2","4","1","3","5",9]])[0].volume,5);assert.equal(formatDuration(0,(8*24*60+9*60+30)*60000),"8D 9h 30m")});
test("IndexedDB schema is versioned and contains local-first stores",()=>{assert.equal(SCHEMA.version,1);assert.deepEqual(SCHEMA.stores,["settings","drawings","syncQueue","marketCache","meta"])});
test("Import rejects malformed data before opening IndexedDB",async()=>{await assert.rejects(importLocalData({format:"chartforge-rsi",version:1,settings:[],drawings:[{id:"x",symbol:"BAD",type:"trend",a:{time:1,price:2}}]}),/drawing không hợp lệ/)});
test("Replay hides the selected candle and first step reveals it",()=>{const rows=[1,2,3,4].map(time=>({time})),cut=replayCutIndex(rows,3);assert.equal(cut,2);assert.deepEqual(rows.slice(0,cut).map(x=>x.time),[1,2]);assert.equal(rows.slice(0,cut+1).at(-1).time,3)});
test("Price scale keeps the pointer-down price fixed",()=>{const bounds={lo:80,hi:120},pivot=90,ratio=.75,next=pointerAnchoredBounds(bounds,pivot,ratio,-60),project=b=>b.hi-ratio*(b.hi-b.lo);assert.ok(Math.abs(project(next)-pivot)<1e-9);assert.ok(next.hi-next.lo<40)});
test("Time scale changes bars without moving its pointer-down anchor",()=>{const before=anchoredTimeScale(1000,240,0,0,.4),after=anchoredTimeScale(1000,240,0,100,.4);assert.equal(after.bars,260);const projected=1000-after.offset-after.bars+.4*(after.bars-1);assert.ok(Math.abs(projected-after.anchor)<1e-9);assert.equal(before.bars,240)});
test("Sync coalesces queue and two devices converge through offline edits and tombstones",async()=>{
  const compare=(a,b)=>a.revision-b.revision||a.updatedAt-b.updatedAt||a.deviceId.localeCompare(b.deviceId),hub={docs:new Map(),listeners:new Set()};
  const remote=online=>({online:()=>online.value,write:async(uid,kind,row)=>{const key=`${uid}:${kind}:${row.id}`,current=hub.docs.get(key),winner=!current||compare(current,row)<=0?structuredClone(row):current;hub.docs.set(key,winner);for(const listener of hub.listeners)listener(kind,structuredClone(winner));return{winner}},subscribe:(uid,h)=>{const listener=(kind,row)=>h[kind](row);hub.listeners.add(listener);for(const[key,row]of hub.docs)if(key.startsWith(`${uid}:`))listener(key.split(":")[1],structuredClone(row));return[()=>hub.listeners.delete(listener)]}});
  const repository=()=>{
    const rows=new Map(),queue=[];return{rows,queue,local(kind,row){rows.set(`${kind}:${row.id}`,structuredClone(row));queue.push({id:`${kind}:${row.id}:${row.revision}:${queue.length}`,kind,payload:structuredClone(row)})},api:{queue:async()=>structuredClone(queue),ack:async ids=>{for(let i=queue.length-1;i>=0;i--)if(ids.includes(queue[i].id))queue.splice(i,1)},enqueueSnapshot:async()=>{},applyRemote:async(kind,row)=>{const key=`${kind}:${row.id}`,current=rows.get(key);if(current&&compare(current,row)>=0)return false;rows.set(key,structuredClone(row));return true}}}};
  const a=repository(),b=repository(),oa={value:true},ob={value:true},ea=createSyncEngine({repository:a.api,remote:remote(oa),compare}),eb=createSyncEngine({repository:b.api,remote:remote(ob),compare});
  await ea.start({uid:"same-user"});await eb.start({uid:"same-user"});
  a.local("setting",{id:"timeframe",value:"H4",revision:1,updatedAt:1,deviceId:"device-a"});ea.poke();await new Promise(r=>setTimeout(r,10));assert.equal(b.rows.get("setting:timeframe").value,"H4");
  ob.value=false;b.local("drawing",{id:"drawing-1",symbol:"BTCUSDT",revision:1,updatedAt:2,deviceId:"device-b",deleted:false});eb.poke();a.local("drawing",{id:"drawing-1",symbol:"BTCUSDT",revision:1,updatedAt:3,deviceId:"device-a",deleted:false});ea.poke();await new Promise(r=>setTimeout(r,10));ob.value=true;await eb.flush();await new Promise(r=>setTimeout(r,10));assert.equal(b.rows.get("drawing:drawing-1").deviceId,"device-a");
  a.local("drawing",{...a.rows.get("drawing:drawing-1"),revision:2,updatedAt:4,deleted:true});ea.poke();await new Promise(r=>setTimeout(r,10));assert.equal(b.rows.get("drawing:drawing-1").deleted,true);
  assert.equal(newestByEntity([{kind:"drawing",payload:{id:"x",revision:1}},{kind:"drawing",payload:{id:"x",revision:2}}],(x,y)=>x.revision-y.revision)[0].payload.revision,2);ea.stop();eb.stop()
});
