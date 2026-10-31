import {GatherError} from './gather.mjs';
export async function reserveDiscovery(db){
 if(!db)throw new GatherError('The discovery usage limiter is unavailable.',503);
 const reserved=await db.prepare('INSERT INTO api_budget_gate(id,second,second_used,minute,minute_used,day,day_used) VALUES(2,0,0,0,0,0,2) ON CONFLICT(id) DO UPDATE SET day_used=day_used+2 WHERE day_used<=29 RETURNING day_used').first();
 if(!reserved)throw new GatherError('The capped discovery allowance is used. The owner needs to review usage before more searches.',429);
}
