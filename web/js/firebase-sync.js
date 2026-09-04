import{firebaseConfig}from"../firebase-config.js";
import{createSyncEngine}from"./sync-core.js";
import{applyRemoteDrawing,applyRemoteSetting,compareVersions,enqueueLocalSnapshot,listSyncQueue,markSyncQueueFailure,removeSyncQueue,switchCloudUser}from"./storage.js";
import{isCloudSettingId}from"./storage-adapter.js";
import{ENABLED_SYMBOLS,TIMEFRAMES}from"./config.js";

const SDK="https://www.gstatic.com/firebasejs/11.10.0";
let modulesPromise;
async function modules(){return modulesPromise ||= Promise.all([import(`${SDK}/firebase-app.js`),import(`${SDK}/firebase-auth.js`),import(`${SDK}/firebase-firestore.js`)]).then(([app,auth,firestore])=>({app,auth,firestore}))}
const validStyle=style=>style&&typeof style==="object"&&!Array.isArray(style)&&Object.keys(style).every(key=>["color","lineWidth","dash","fontSize"].includes(key))&&(!("color"in style)||(typeof style.color==="string"&&style.color.length<=20))&&(!("lineWidth"in style)||(Number.isFinite(style.lineWidth)&&style.lineWidth>=1&&style.lineWidth<=8))&&(!("dash"in style)||["solid","dash","dot"].includes(style.dash))&&(!("fontSize"in style)||(Number.isFinite(style.fontSize)&&style.fontSize>=8&&style.fontSize<=64));
const validSettingValue=(id,value)=>id==="lastSymbol"?ENABLED_SYMBOLS.includes(value):id==="timeframe"?TIMEFRAMES.some(item=>item.label===value):id==="visibleBars"?Number.isFinite(value)&&value>=20&&value<=1000:id==="pricePercent"?Number.isFinite(value)&&value>=20&&value<=80:id==="priceShift"?Number.isFinite(value):id==="priceScale"?Number.isFinite(value)&&value>=.15&&value<=20:id==="crossMode"?typeof value==="boolean":id==="drawingDefaults"?value&&typeof value==="object"&&!Array.isArray(value)&&Object.keys(value).every(key=>["trend","text"].includes(key))&&(!value.trend||validStyle(value.trend))&&(!value.text||validStyle(value.text)):false;
const normalizeSettingEntry=(id,entry)=>entry&&typeof entry==="object"&&Number.isInteger(entry.revision)&&entry.revision>=0&&Number.isInteger(entry.updatedAt)&&entry.updatedAt>0&&typeof entry.deviceId==="string"&&entry.deviceId.length>=8&&entry.deviceId.length<=100&&validSettingValue(id,entry.value)?{value:entry.value,revision:entry.revision,updatedAt:entry.updatedAt,deviceId:entry.deviceId}:null;
export function sanitizeCloudSettingValues(values={}){const clean={};for(const[id,entry]of Object.entries(values||{})){if(!isCloudSettingId(id))continue;const normalized=normalizeSettingEntry(id,entry);if(normalized)clean[id]=normalized}return clean}
export async function createCloudSync({onAuth=()=>{},onStatus=()=>{},onData=()=>{}}={}){
  const {app:a,auth:f,firestore:s}=await modules(),firebaseApp=a.getApps().length?a.getApp():a.initializeApp(firebaseConfig),auth=f.getAuth(firebaseApp);
  await f.setPersistence(auth,f.indexedDBLocalPersistence).catch(()=>f.setPersistence(auth,f.browserLocalPersistence));
  const db=s.initializeFirestore(firebaseApp,{localCache:s.memoryLocalCache()}),online=()=>navigator.onLine!==false;
  const remote={
    online,
    write:async(uid,kind,row)=>{
      if(kind==="drawing"){const point=value=>value?{time:Number(value.time),price:Number(value.price)}:null,clean={id:row.id,symbol:row.symbol,type:row.type,pane:row.pane||"price",a:point(row.a),b:point(row.b),c:point(row.c),style:row.style||{},text:row.text||"",revision:row.revision,updatedAt:row.updatedAt,deviceId:row.deviceId,deleted:!!row.deleted,contentHash:row.contentHash||""},ref=s.doc(db,"users",uid,"drawings",row.id);return s.runTransaction(db,async tx=>{const current=(await tx.get(ref)).data();if(current&&compareVersions(clean,current)<0)return{winner:current};tx.set(ref,{...clean,serverUpdatedAt:s.serverTimestamp()});return{winner:clean}})}
      if(!isCloudSettingId(row.id)||!normalizeSettingEntry(row.id,row))return{winner:row};
      const ref=s.doc(db,"users",uid,"settings","current");return s.runTransaction(db,async tx=>{const current=(await tx.get(ref)).data(),values=sanitizeCloudSettingValues(current?.values),currentRow=values[row.id]&&{id:row.id,...values[row.id]};if(currentRow&&compareVersions(row,currentRow)<0)return{winner:currentRow};values[row.id]=normalizeSettingEntry(row.id,row);const entries=Object.values(values),revision=Math.max(row.revision,...entries.map(entry=>entry.revision)),updatedAt=Math.max(row.updatedAt,...entries.map(entry=>entry.updatedAt));tx.set(ref,{values,revision,updatedAt,deviceId:row.deviceId,serverUpdatedAt:s.serverTimestamp()});return{winner:row}})
    },
    subscribe:(uid,handlers)=>[
      s.onSnapshot(s.doc(db,"users",uid,"settings","current"),snap=>{const values=sanitizeCloudSettingValues(snap.data()?.values);for(const[id,value]of Object.entries(values))handlers.setting({id,...value})},handlers.error),
      s.onSnapshot(s.collection(db,"users",uid,"drawings"),snap=>{for(const change of snap.docChanges())if(change.type!=="removed")handlers.drawing(change.doc.data())},handlers.error)
    ]
  };
  const repository={queue:listSyncQueue,ack:removeSyncQueue,fail:markSyncQueueFailure,enqueueSnapshot:enqueueLocalSnapshot,applyRemote:(kind,row)=>kind==="drawing"?applyRemoteDrawing(row):applyRemoteSetting(row)};
  const engine=createSyncEngine({repository,remote,compare:compareVersions,onChange:onData,onStatus});
  const handleAuth=async user=>{engine.stop();if(user&&await switchCloudUser(user.uid))onData("reset",{});onAuth(user);await engine.start(user)};
  const authStop=f.onAuthStateChanged(auth,user=>void handleAuth(user).catch(error=>onStatus("error",error)));
  addEventListener("online",engine.poke);
  addEventListener("cfrsi:local-change",engine.poke);
  await f.getRedirectResult(auth).catch(error=>onStatus("error",error));
  return{
    signIn:async()=>{const provider=new f.GoogleAuthProvider();provider.setCustomParameters({prompt:"select_account"});try{await f.signInWithPopup(auth,provider)}catch(error){if(["auth/popup-blocked","auth/cancelled-popup-request","auth/operation-not-supported-in-this-environment"].includes(error.code))await f.signInWithRedirect(auth,provider);else throw error}},
    signOut:()=>f.signOut(auth),
    flush:engine.flush,
    notifyLocalChange:engine.poke,
    destroy:()=>{authStop();engine.stop();removeEventListener("online",engine.poke);removeEventListener("cfrsi:local-change",engine.poke)}
  };
}
