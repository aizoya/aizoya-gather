import {GatherError} from './gather.mjs';
export async function reserveDiscovery(db){
 if(!db)throw new GatherError('The private test limiter is unavailable.',503);
 const reserved=await db.prepare('INSERT INTO api_budget_gate(id,second,second_used,minute,minute_used,day,day_used) VALUES(2,0,0,0,0,0,2) ON CONFLICT(id) DO UPDATE SET day_used=day_used+2 WHERE day_used<=13 RETURNING day_used').first();
 if(!reserved)throw new GatherError('The private AI testing allowance is used. Ask the owner to review usage before continuing.',429);
}
