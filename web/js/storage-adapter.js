const CLIENT_DRAWING_ID="__cfrsiId";
const ROW_METADATA=new Set(["id","symbol","revision","updatedAt","deviceId","deleted","serverUpdatedAt","contentHash",CLIENT_DRAWING_ID]);
const CANONICAL_TO_STORED_SETTING={selected:"timeframe",zoomBars:"visibleBars",toolDefaults:"drawingDefaults"};
const STORED_TO_CANONICAL_SETTING=Object.fromEntries(Object.entries(CANONICAL_TO_STORED_SETTING).map(([canonical,stored])=>[stored,canonical]));
const CLOUD_SETTINGS=new Set(["lastSymbol","timeframe","visibleBars","pricePercent","priceShift","priceScale","crossMode","drawingDefaults"]);
const CANONICAL_SETTINGS=new Set(["lastSymbol","visible","collapsed","selected","zoomBars","panBars","priceShift","priceScale","left","top","width","height","pricePercent","crossMode","toolDefaults","uiDefaultsVersion"]);
const VOLATILE_KEYS=new Set(["symbol","socket","raw","closes","times","rows","countdownTimeframe","hoverIndex","hoverPane","hoverYRatio","drawingTool","fibDraft","toolDraft","selectedDrawing","drawingHitAreas","menuPosition","fullscreen","restoreGeometry","historyPast","historyFuture","loadingOlder","historyExhausted","loadGeneration","replay"]);
const clone=value=>value==null?value:structuredClone(value);
const canonicalType=type=>type==="priceRange"?"range":type;
const storedType=type=>type==="range"?"priceRange":type;
const stableValue=value=>Array.isArray(value)?value.map(stableValue):value&&typeof value==="object"?Object.fromEntries(Object.keys(value).filter(key=>key!==CLIENT_DRAWING_ID).sort().map(key=>[key,stableValue(value[key])])):value;
const signature=value=>JSON.stringify(stableValue(value));
const orderOf=row=>String(row?.contentHash||"").startsWith("cfrsi-order:")?Number(row.contentHash.slice(12)):Number.POSITIVE_INFINITY;

export function toCanonicalDrawing(row){
  if(!row||typeof row!=="object")return null;
  const drawing={};
  for(const[key,value]of Object.entries(row))if(!ROW_METADATA.has(key))drawing[key]=clone(value);
  drawing.type=canonicalType(drawing.type);
  if(row.id)drawing[CLIENT_DRAWING_ID]=row.id;
  return drawing;
}

export function toStoredDrawing(drawing,{id,symbol}={}){
  if(!drawing||typeof drawing!=="object")return null;
  const row={};
  for(const[key,value]of Object.entries(drawing))if(!ROW_METADATA.has(key))row[key]=clone(value);
  row.type=storedType(row.type);
  for(const point of ["a","b","c"])if(row[point])row[point]={time:Number(row[point].time),price:Number(row[point].price)};
  if(id)row.id=id;
  if(symbol)row.symbol=symbol;
  return row;
}

export function canonicalStateFromRows(settingRows=[],drawingRows=[]){
  const state={fibDrawings:{},toolDrawings:{}};
  for(const row of settingRows||[])if(row&&typeof row.id==="string"){const key=STORED_TO_CANONICAL_SETTING[row.id]||row.id;if(CANONICAL_SETTINGS.has(key))state[key]=clone(row.value)}
  for(const row of [...(drawingRows||[])].sort((a,b)=>orderOf(a)-orderOf(b))){
    if(!row||row.deleted||!row.symbol)continue;
    const target=canonicalType(row.type)==="fib"?state.fibDrawings:state.toolDrawings;
    (target[row.symbol]||=[]).push(toCanonicalDrawing(row));
  }
  return state;
}

function assignStableRows(symbol,drawings,existing,makeId){
  existing=[...existing].sort((a,b)=>orderOf(a)-orderOf(b));
  const buckets=new Map();
  for(const[rowIndex,row]of existing.entries()){const key=signature(toCanonicalDrawing(row));if(!buckets.has(key))buckets.set(key,[]);buckets.get(key).push({row,rowIndex})}
  const used=new Set(),assigned=[];
  for(const[newIndex,drawing]of drawings.entries()){const explicitId=drawing?.[CLIENT_DRAWING_ID],explicitIndex=explicitId?existing.findIndex(row=>row.id===explicitId&&!used.has(row.id)):-1,explicit=explicitIndex>=0?{row:existing[explicitIndex],rowIndex:explicitIndex}:null,match=explicit||buckets.get(signature(toCanonicalDrawing(drawing)))?.find(item=>!used.has(item.row.id));if(match)used.add(match.row.id);assigned.push({drawing,newIndex,match})}
  for(const item of assigned){
    if(item.match)continue;
    const matched=assigned.filter(candidate=>candidate.match),left=matched.filter(candidate=>candidate.newIndex<item.newIndex).at(-1),right=matched.find(candidate=>candidate.newIndex>item.newIndex);
    const expected=left&&right?left.match.rowIndex+(item.newIndex-left.newIndex)*(right.match.rowIndex-left.match.rowIndex)/(right.newIndex-left.newIndex):right?right.match.rowIndex-(right.newIndex-item.newIndex):left?left.match.rowIndex+(item.newIndex-left.newIndex):item.newIndex;
    const drawing=toCanonicalDrawing(item.drawing),candidates=existing.map((row,rowIndex)=>({row,rowIndex,drawing:toCanonicalDrawing(row)})).filter(candidate=>!used.has(candidate.row.id)&&candidate.drawing.type===drawing.type).sort((a,b)=>(a.drawing.pane===drawing.pane?0:1)-(b.drawing.pane===drawing.pane?0:1)||Math.abs(a.rowIndex-expected)-Math.abs(b.rowIndex-expected));
    item.match=candidates[0]||null;if(item.match)used.add(item.match.row.id);
  }
  return assigned.map(({drawing,match},order)=>{const id=match?.row.id||makeId();drawing[CLIENT_DRAWING_ID]=id;return{...toStoredDrawing(drawing,{id,symbol}),contentHash:`cfrsi-order:${order}`}});
}

export function canonicalizeRemote(kind,row){
  if(kind==="setting")return{kind,row:{...clone(row),id:STORED_TO_CANONICAL_SETTING[row.id]||row.id}};
  if(kind==="drawing")return{kind,row:{symbol:row.symbol,drawing:row.deleted?null:toCanonicalDrawing(row)}};
  return{kind,row:clone(row)};
}

export const isCloudSettingId=id=>CLOUD_SETTINGS.has(id);

export function createCanonicalStorageAdapter(repository,{makeId=()=>crypto.randomUUID()}={}){
  const listeners=new Set();let snapshot=null,writeQueue=Promise.resolve();
  const read=async()=>canonicalStateFromRows(await repository.listSettingRows(),await repository.listDrawings(null,{includeDeleted:true}));
  const rawGet=async(keys=null)=>{const state=await read();snapshot=state;if(keys==null)return state;const requested=typeof keys==="string"?[keys]:Array.isArray(keys)?keys:Object.keys(keys||{}),result={};for(const key of requested)if(key in state)result[key]=state[key];else if(keys&&!Array.isArray(keys)&&typeof keys==="object"&&key in keys)result[key]=clone(keys[key]);return result};
  const get=async(keys=null)=>{await writeQueue.catch(()=>undefined);return rawGet(keys)};
  const emit=(changes,area="local")=>{if(Object.keys(changes).length)for(const listener of listeners)listener(changes,area)};
  const rawReload=async(area="sync")=>{const before=snapshot||{},after=await read(),changes={};for(const key of new Set([...Object.keys(before),...Object.keys(after)]))if(JSON.stringify(before[key])!==JSON.stringify(after[key]))changes[key]={oldValue:clone(before[key]),newValue:clone(after[key])};snapshot=after;emit(changes,area);return after};
  const reload=async(area="sync")=>{await writeQueue.catch(()=>undefined);return rawReload(area)};
  const performSet=async data=>{
    if(!data||typeof data!=="object")return;const before=snapshot||await read();
    const hasFibs=Object.hasOwn(data,"fibDrawings"),hasTools=Object.hasOwn(data,"toolDrawings");
    if(hasFibs||hasTools){const current=await read(),fibs=hasFibs?(data.fibDrawings||{}):current.fibDrawings,tools=hasTools?(data.toolDrawings||{}):current.toolDrawings,existing=await repository.listDrawings(null,{includeDeleted:false}),symbols=new Set([...existing.map(row=>row.symbol),...Object.keys(fibs),...Object.keys(tools)]);for(const symbol of symbols){const live=existing.filter(row=>row.symbol===symbol),currentFibs=live.filter(row=>canonicalType(row.type)==="fib").sort((a,b)=>orderOf(a)-orderOf(b)).map(toCanonicalDrawing),currentTools=live.filter(row=>canonicalType(row.type)!=="fib").sort((a,b)=>orderOf(a)-orderOf(b)).map(toCanonicalDrawing),nextFibs=Array.isArray(fibs[symbol])?fibs[symbol]:[],nextTools=Array.isArray(tools[symbol])?tools[symbol]:[];if(signature(currentFibs)===signature(nextFibs)&&signature(currentTools)===signature(nextTools))continue;for(const drawing of nextFibs)drawing.type="fib";const fibRows=assignStableRows(symbol,nextFibs,live.filter(row=>canonicalType(row.type)==="fib"),makeId),toolRows=assignStableRows(symbol,nextTools,live.filter(row=>canonicalType(row.type)!=="fib"),makeId);await repository.replaceDrawings(symbol,[...fibRows,...toolRows])}}
    for(const[key,value]of Object.entries(data)){if(key==="fibDrawings"||key==="toolDrawings"||VOLATILE_KEYS.has(key)||!CANONICAL_SETTINGS.has(key))continue;const storedId=CANONICAL_TO_STORED_SETTING[key]||key;await repository.setSetting(storedId,clone(value),{sync:CLOUD_SETTINGS.has(storedId)})}
    snapshot=before;await rawReload("local");
  };
  const set=data=>writeQueue=writeQueue.catch(()=>undefined).then(()=>performSet(data));
  const performRemove=async keys=>{for(const key of(typeof keys==="string"?[keys]:keys||[])){if(key==="fibDrawings"||key==="toolDrawings")await performSet({[key]:{}});else await repository.removeSetting?.(CANONICAL_TO_STORED_SETTING[key]||key)}await rawReload("local")};
  const remove=keys=>writeQueue=writeQueue.catch(()=>undefined).then(()=>performRemove(keys));
  const callback=(pending,done,map=value=>value)=>{if(typeof done==="function")pending.then(value=>done(map(value)),()=>done(map(undefined)));return pending};
  const area={get(keys,done){return callback(get(keys),done,value=>value||{})},set(data,done){return callback(set(data),done,()=>undefined)},remove(keys,done){return callback(remove(keys),done,()=>undefined)}};
  return{get,set,remove,reload,loadState:()=>get(null),saveState:set,canonicalizeRemote,refreshFromRemote:()=>reload("sync"),subscribe:listener=>(listeners.add(listener),()=>listeners.delete(listener)),area};
}

export function createCanonicalChromeFacade(adapter,{baseUrl=globalThis.location?.href||"http://localhost/"}={}){
  const listeners=new Set(),stop=adapter.subscribe((changes,area)=>{for(const listener of listeners)listener(changes,area)}),emptyArea={get(keys,callback){const result={};callback?.(result);return Promise.resolve(result)},set(data,callback){callback?.();return Promise.resolve()},remove(keys,callback){callback?.();return Promise.resolve()}};
  return{storage:{local:adapter.area,sync:emptyArea,onChanged:{addListener:listener=>listeners.add(listener),removeListener:listener=>listeners.delete(listener)}},runtime:{getURL:path=>new URL(path,baseUrl).href,onMessage:{addListener(){},removeListener(){}}},destroy:stop};
}

export const STORAGE_ADAPTER_CONTRACT={canonicalDrawingTypes:["fib","long","range","dateRange","trend","text"],canonicalSettings:[...CANONICAL_SETTINGS],volatileKeys:[...VOLATILE_KEYS],settingAliases:{...CANONICAL_TO_STORED_SETTING}};
