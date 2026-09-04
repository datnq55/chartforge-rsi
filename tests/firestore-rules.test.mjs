import test,{after,before}from"node:test";
import assert from"node:assert/strict";
import{readFile}from"node:fs/promises";
import{initializeTestEnvironment,assertFails,assertSucceeds}from"@firebase/rules-unit-testing";
import{doc,getDoc,serverTimestamp,setDoc,updateDoc}from"firebase/firestore";

let env;
const uid="user-one",otherUid="user-two",deviceId="device-fixture-123";
const entry=(value,revision=1)=>({value,revision,updatedAt:1788557000000+revision,deviceId});
const settingsValues=()=>({
  lastSymbol:entry("BTCUSDT"),timeframe:entry("H4",2),visibleBars:entry(240,3),pricePercent:entry(64,4),
  priceShift:entry(-.144,5),priceScale:entry(2.104336046415477,6),crossMode:entry(true,7),
  drawingDefaults:entry({trend:{color:"#f23645",lineWidth:8,dash:"dot"},text:{color:"#111111",fontSize:64}},8)
});
const settingsDocument=(values=settingsValues())=>({values,revision:8,updatedAt:1788557000008,deviceId,serverUpdatedAt:serverTimestamp()});
const drawing=(type,id=`drawing-${type}-fixture`)=>({id,symbol:"BTCUSDT",type,pane:"price",a:{time:1788557000000,price:100},b:type==="text"?null:{time:1788557060000,price:101},c:type==="long"?{time:1788557090000,price:99}:null,style:type==="trend"?{color:"#f23645",lineWidth:8,dash:"dot"}:type==="text"?{color:"#111111",fontSize:64}:{},text:type==="text"?"fixture text":"",revision:1,updatedAt:1788557000001,serverUpdatedAt:serverTimestamp(),deviceId,deleted:false,contentHash:"cfrsi-order:0"});

before(async()=>{const[host,port]=process.env.FIRESTORE_EMULATOR_HOST.split(":");env=await initializeTestEnvironment({projectId:"demo-chartforge-rsi",firestore:{host,port:Number(port),rules:await readFile(new URL("../web/firestore.rules",import.meta.url),"utf8")}})});
after(async()=>env?.cleanup());

test("authenticated owner can create and update every synchronized setting",async()=>{
  const db=env.authenticatedContext(uid).firestore(),ref=doc(db,"users",uid,"settings","current");
  await assertSucceeds(setDoc(ref,settingsDocument()));
  const values=settingsValues();values.lastSymbol=entry("DOGEUSDT",9);values.timeframe=entry("30m",10);values.pricePercent=entry(20,11);values.visibleBars=entry(1000,12);values.priceScale=entry(.15,13);
  await assertSucceeds(setDoc(ref,{...settingsDocument(values),revision:13,updatedAt:1788557000013}));
  assert.equal((await getDoc(ref)).data().values.lastSymbol.value,"DOGEUSDT");
});

test("owner can replace a legacy settings document with a sanitized retry",async()=>{
  await env.withSecurityRulesDisabled(async context=>setDoc(doc(context.firestore(),"users",uid,"settings","current"),{...settingsDocument({...settingsValues(),panBars:entry(29)}),serverUpdatedAt:new Date()}));
  const ref=doc(env.authenticatedContext(uid).firestore(),"users",uid,"settings","current");
  await assertSucceeds(setDoc(ref,settingsDocument()));
  assert.equal(Object.hasOwn((await getDoc(ref)).data().values,"panBars"),false);
});

test("settings reject unauthenticated users, wrong UIDs and local-only or invalid values",async()=>{
  const ownerRef=doc(env.authenticatedContext(uid).firestore(),"users",uid,"settings","current");
  await assertFails(setDoc(doc(env.unauthenticatedContext().firestore(),"users",uid,"settings","current"),settingsDocument()));
  await assertFails(setDoc(doc(env.authenticatedContext(otherUid).firestore(),"users",uid,"settings","current"),settingsDocument()));
  await assertFails(setDoc(ownerRef,settingsDocument({...settingsValues(),panBars:entry(20)})));
  await assertFails(setDoc(ownerRef,settingsDocument({...settingsValues(),lastSymbol:entry("BADUSDT")})));
});

test("all six drawing types support create, update and tombstones for their owner",async()=>{
  const db=env.authenticatedContext(uid).firestore();
  for(const type of["fib","long","priceRange","dateRange","trend","text"]){
    const value=drawing(type),ref=doc(db,"users",uid,"drawings",value.id);
    await assertSucceeds(setDoc(ref,value));
    await assertSucceeds(updateDoc(ref,{revision:2,updatedAt:1788557000002,deleted:true,serverUpdatedAt:serverTimestamp()}));
  }
  const foreign=drawing("trend","drawing-foreign-fixture");
  await assertFails(setDoc(doc(env.authenticatedContext(otherUid).firestore(),"users",uid,"drawings",foreign.id),foreign));
  await assertFails(setDoc(doc(env.unauthenticatedContext().firestore(),"users",uid,"drawings","drawing-anon-fixture"),drawing("fib","drawing-anon-fixture")));
});
