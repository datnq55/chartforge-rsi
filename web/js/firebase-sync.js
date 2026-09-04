import{firebaseConfig}from"../firebase-config.js";
import{createSyncEngine}from"./sync-core.js";
import{applyRemoteDrawing,applyRemoteSetting,compareVersions,enqueueLocalSnapshot,listSyncQueue,removeSyncQueue,switchCloudUser}from"./storage.js";

const SDK="https://www.gstatic.com/firebasejs/11.10.0";
let modulesPromise;
async function modules(){return modulesPromise ||= Promise.all([import(`${SDK}/firebase-app.js`),import(`${SDK}/firebase-auth.js`),import(`${SDK}/firebase-firestore.js`)]).then(([app,auth,firestore])=>({app,auth,firestore}))}
export async function createCloudSync({onAuth=()=>{},onStatus=()=>{},onData=()=>{}}={}){
  const {app:a,auth:f,firestore:s}=await modules(),firebaseApp=a.getApps().length?a.getApp():a.initializeApp(firebaseConfig),auth=f.getAuth(firebaseApp);
  await f.setPersistence(auth,f.indexedDBLocalPersistence).catch(()=>f.setPersistence(auth,f.browserLocalPersistence));
  const db=s.initializeFirestore(firebaseApp,{localCache:s.memoryLocalCache()}),online=()=>navigator.onLine!==false;
  const remote={
    online,
    write:async(uid,kind,row)=>{
      if(kind==="drawing"){const clean={id:row.id,symbol:row.symbol,type:row.type,pane:row.pane||"price",a:row.a,b:row.b||null,c:row.c||null,style:row.style||{},text:row.text||"",revision:row.revision,updatedAt:row.updatedAt,deviceId:row.deviceId,deleted:!!row.deleted,contentHash:row.contentHash||""},ref=s.doc(db,"users",uid,"drawings",row.id);return s.runTransaction(db,async tx=>{const current=(await tx.get(ref)).data();if(current&&compareVersions(clean,current)<0)return{winner:current};tx.set(ref,{...clean,serverUpdatedAt:s.serverTimestamp()});return{winner:clean}})}
      const ref=s.doc(db,"users",uid,"settings","current");return s.runTransaction(db,async tx=>{const current=(await tx.get(ref)).data(),currentRow=current?.values?.[row.id]&&{id:row.id,...current.values[row.id]};if(currentRow&&compareVersions(row,currentRow)<0)return{winner:currentRow};tx.set(ref,{values:{...(current?.values||{}),[row.id]:{value:row.value,revision:row.revision,updatedAt:row.updatedAt,deviceId:row.deviceId}},revision:Math.max(current?.revision||0,row.revision),updatedAt:Math.max(current?.updatedAt||0,row.updatedAt),deviceId:row.deviceId,serverUpdatedAt:s.serverTimestamp()});return{winner:row}})
    },
    subscribe:(uid,handlers)=>[
      s.onSnapshot(s.doc(db,"users",uid,"settings","current"),snap=>{const values=snap.data()?.values||{};for(const[id,value]of Object.entries(values))handlers.setting({id,...value})},handlers.error),
      s.onSnapshot(s.collection(db,"users",uid,"drawings"),snap=>{for(const change of snap.docChanges())if(change.type!=="removed")handlers.drawing(change.doc.data())},handlers.error)
    ]
  };
  const repository={queue:listSyncQueue,ack:removeSyncQueue,enqueueSnapshot:enqueueLocalSnapshot,applyRemote:(kind,row)=>kind==="drawing"?applyRemoteDrawing(row):applyRemoteSetting(row)};
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
