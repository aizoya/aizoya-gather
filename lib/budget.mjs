import {GatherError} from './gather.mjs';
// One atomic reservation checks every window before charging any counter.
export const RESERVE_SQL=`INSERT INTO api_budget_gate (id,second,second_used,minute,minute_used,day,day_used)
VALUES (1,?1,1,?2,1,?3,1)
ON CONFLICT(id) DO UPDATE SET
 second=excluded.second,second_used=CASE WHEN api_budget_gate.second=excluded.second THEN api_budget_gate.second_used+1 ELSE 1 END,
 minute=excluded.minute,minute_used=CASE WHEN api_budget_gate.minute=excluded.minute THEN api_budget_gate.minute_used+1 ELSE 1 END,
 day=excluded.day,day_used=CASE WHEN api_budget_gate.day=excluded.day THEN api_budget_gate.day_used+1 ELSE 1 END
WHERE (api_budget_gate.second<excluded.second OR (api_budget_gate.second=excluded.second AND api_budget_gate.second_used<3))
 AND (api_budget_gate.minute<excluded.minute OR (api_budget_gate.minute=excluded.minute AND api_budget_gate.minute_used<60))
 AND (api_budget_gate.day<excluded.day OR (api_budget_gate.day=excluded.day AND api_budget_gate.day_used<1000))
RETURNING second_used,minute_used,day_used`;
export async function reserve(db,now=Date.now()){
 if(!db)throw new GatherError('Live requests are paused until the shared request limiter is available.',503,'LIMITER_UNAVAILABLE');
 let row,state;try{
 row=await db.prepare(RESERVE_SQL).bind(Math.floor(now/1000),Math.floor(now/60000),Math.floor(now/86400000)).first();
 if(row)return;
 state=await db.prepare('SELECT second,second_used,minute,minute_used,day,day_used FROM api_budget_gate WHERE id=1').first();
 }catch{throw new GatherError('The request limiter is unavailable. No Qloo request was sent.',503,'LIMITER_UNAVAILABLE');}
 const e=new GatherError('The shared demo request limit was reached. Please try again later.',429,'LOCAL_RATE_LIMIT');
 if(state&&state.minute===Math.floor(now/60000)&&state.minute_used>=60||state&&state.day===Math.floor(now/86400000)&&state.day_used>=1000)throw e;
 if(state&&state.second===Math.floor(now/1000)&&state.second_used>=3){e.retryAfterMs=1000-(now%1000)+25;throw e;}
 throw e;
}
export function budgetedFetch(db,fetcher=fetch,{clock=Date.now,wait=ms=>new Promise(resolve=>setTimeout(resolve,ms))}={}){
 return async(url,options)=>{
  for(let attempt=0;;attempt++){
   options?.signal?.throwIfAborted();
   try{await reserve(db,clock());break;}catch(e){if(!(e instanceof GatherError)||!e.retryAfterMs||attempt>=2)throw e;await wait(e.retryAfterMs);}
  }
  options?.signal?.throwIfAborted();return fetcher(url,options);
 };
}
