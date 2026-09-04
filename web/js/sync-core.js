export function newestByEntity(queue,compare){
  const groups=new Map();
  for(const item of queue){const key=`${item.kind}:${item.payload.id}`,current=groups.get(key);if(!current||compare(current.payload,item.payload)<0)groups.set(key,item)}
  return [...groups.values()];
}
export function createSyncEngine({repository,remote,compare,onChange=()=>{},onStatus=()=>{}}){
  let user=null,stops=[],flushing=false,rerun=false;
  const receive=async(kind,row)=>{const changed=await repository.applyRemote(kind,row);if(changed)onChange(kind,row)};
  const flush=async()=>{
    if(!user||flushing||!remote.online())return false;
    flushing=true;onStatus("syncing");
    try{
      const failures=new Map();
      do{
        rerun=false;const queue=await repository.queue(),latest=newestByEntity(queue,compare);
        for(const item of latest){const entity=`${item.kind}:${item.payload.id}`;try{const result=await remote.write(user.uid,item.kind,item.payload);if(result?.winner&&compare(item.payload,result.winner)<0)await receive(item.kind,result.winner);const winning=result?.winner||item.payload,matching=queue.filter(x=>x.kind===item.kind&&x.payload.id===item.payload.id&&compare(x.payload,winning)<=0).map(x=>x.id);await repository.ack(matching);failures.delete(entity)}catch(error){failures.set(entity,error);await repository.fail?.(item.id,error)}}
      }while(rerun);
      if(failures.size)throw new AggregateError([...failures.values()],`${failures.size} sync mutation(s) failed`);
      onStatus("synced");return true;
    }catch(error){onStatus("error",error);return false}finally{flushing=false}
  };
  const stop=()=>{for(const unsubscribe of stops)unsubscribe?.();stops=[];user=null;onStatus("local")};
  const start=async nextUser=>{
    stop();user=nextUser;if(!user){onStatus("local");return false}
    onStatus("syncing");await repository.enqueueSnapshot();
    const incoming=(kind,row)=>void receive(kind,row).catch(error=>onStatus("error",error));
    stops=remote.subscribe(user.uid,{setting:row=>incoming("setting",row),drawing:row=>incoming("drawing",row),error:error=>onStatus("error",error)});
    await flush();return true;
  };
  const poke=()=>{if(flushing)rerun=true;else void flush()};
  return{start,stop,flush,poke,get user(){return user}};
}
