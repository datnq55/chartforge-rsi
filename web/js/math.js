export function rsi(values,n=14){
  const out=Array(values.length).fill(null);if(values.length<=n)return out;
  let gain=0,loss=0;for(let i=1;i<=n;i++){const d=values[i]-values[i-1];gain+=Math.max(d,0);loss+=Math.max(-d,0)}
  let ag=gain/n,al=loss/n;out[n]=al===0?100:100-100/(1+ag/al);
  for(let i=n+1;i<values.length;i++){const d=values[i]-values[i-1];ag=(ag*(n-1)+Math.max(d,0))/n;al=(al*(n-1)+Math.max(-d,0))/n;out[i]=al===0?100:100-100/(1+ag/al)}return out;
}
export function ema(values,n){const out=Array(values.length).fill(null),a=2/(n+1);let p=null;values.forEach((x,i)=>{if(x!=null){p=p==null?x:a*x+(1-a)*p;out[i]=p}});return out}
export function wma(values,n){const out=Array(values.length).fill(null),den=n*(n+1)/2;for(let i=n-1;i<values.length;i++){let s=0,ok=true;for(let j=0;j<n;j++){const x=values[i-n+1+j];if(x==null){ok=false;break}s+=x*(j+1)}if(ok)out[i]=s/den}return out}
export function aggregateBiweekly(rows){
  const span=14*864e5,monday=Date.UTC(1970,0,5),buckets=new Map();
  for(const row of rows){const key=Math.floor((row.time-monday)/span),old=buckets.get(key),closeTime=monday+(key+1)*span-1;if(!old)buckets.set(key,{...row,closeTime});else{old.high=Math.max(old.high,row.high);old.low=Math.min(old.low,row.low);old.close=row.close;old.closeTime=closeTime;old.volume=(old.volume||0)+(row.volume||0)}}return [...buckets.values()];
}
export function mergeRows(...groups){const map=new Map();for(const rows of groups)for(const row of rows||[])if(Number.isFinite(row.time))map.set(row.time,row);return [...map.values()].sort((a,b)=>a.time-b.time)}
export function indicators(rows){const close=rows.map(x=>x.close),rv=rsi(close);return{rsi:rv,ema:ema(rv,9),wma:wma(rv,45)}}
export function formatDuration(a,b){let m=Math.floor(Math.abs(b-a)/60000),d=Math.floor(m/1440);m-=d*1440;const h=Math.floor(m/60);m-=h*60;return[d&&`${d}D`,h&&`${h}h`,(m||(!d&&!h))&&`${m}m`].filter(Boolean).join(" ")}
export function pointerAnchoredBounds(bounds,pivot,ratio,delta,coefficient=.003){const span=(bounds.hi-bounds.lo)*Math.exp(delta*coefficient),hi=pivot+ratio*span;return{lo:hi-span,hi}}
export function replayCutIndex(rows,time){let lo=0,hi=Math.max(0,rows.length-1);while(lo<hi){const mid=(lo+hi)>>1;if(rows[mid].time<time)lo=mid+1;else hi=mid}return Math.max(1,lo)}
export function rightAnchoredTimeScale(startBars,startOffset,startX,currentX,width){const fromStart=Math.max(0,Math.min(width,width-startX)),fromCurrent=Math.max(0,Math.min(width,width-currentX)),bars=fromStart===0||fromCurrent===0?Math.max(20,Math.min(1000,Math.round(startBars))):Math.max(20,Math.min(1000,Math.round(1+(startBars-1)*fromStart/fromCurrent)));return{bars,offset:startOffset}}
