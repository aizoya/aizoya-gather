import {env} from 'cloudflare:workers';
import {GatherError,plan,validatePlan} from '../../../lib/gather.mjs';
import {budgetedFetch} from '../../../lib/budget.mjs';
import {roomDetails,ballot,agreement,digest,secret} from '../../../lib/rooms.mjs';
export const dynamic='force-dynamic';
const headers={'Cache-Control':'private, no-store','Referrer-Policy':'no-referrer','X-Content-Type-Options':'nosniff'};
function db(){if(!env.DB)throw new GatherError('The shared room database is unavailable.',503);return env.DB;}
const reply=(body:unknown,status=200)=>Response.json(body,{status,headers});
async function authorized(request:Request){
 const id=new URL(request.url).searchParams.get('id');const token=request.headers.get('X-Room-Key')||'';
 if(!id||!/^[a-f0-9]{32}$/.test(id)||!/^[a-f0-9]{64}$/.test(token))throw new GatherError('This invitation is invalid.',404);
 const row=await db().prepare('SELECT * FROM gather_rooms WHERE id=? AND access_hash=? AND expires>?').bind(id,await digest(token),Date.now()).first();
 if(!row)throw new GatherError('This invitation has expired or is invalid.',404);return row;
}
async function state(request:Request){
 const room=await authorized(request);const people=await db().prepare('SELECT id,seat,token_hash,votes FROM gather_players WHERE room_id=? ORDER BY seat').bind(room.id).all();
 const member=request.headers.get('X-Player-Key')||'';const hash=member?await digest(member):'';
 const me=people.results.find(p=>p.token_hash===hash);const picks=JSON.parse(String(room.picks));
 const votes=people.results.filter(p=>p.votes).map(p=>JSON.parse(String(p.votes)));const outcome=agreement(picks,votes,room.seats);
 return {id:room.id,title:room.title,date:room.date,location:room.location,category:room.category,seats:room.seats,joined:people.results.length,ready:votes.length,picks,me:me?{seat:me.seat,votes:me.votes?JSON.parse(String(me.votes)):null}:null,outcome:{complete:outcome.complete,choices:outcome.choices.map(({total,accepted,...p}:{total:number;accepted:boolean;id:string;name:string})=>p)}};
}
export async function GET(request:Request){try{return reply(await state(request));}catch(e){return failure(e);}}
function failure(error:unknown){return error instanceof GatherError?reply({error:error.message},error.status):reply({error:'The planning room is temporarily unavailable. Please try again.'},503);}
export async function POST(request:Request){try{
 if(request.headers.get('origin')!==new URL(request.url).origin)return reply({error:'Origin rejected.'},403);
 if(!request.headers.get('content-type')?.includes('application/json'))return reply({error:'JSON required.'},415);
 const raw=await request.text();if(raw.length>10000)return reply({error:'Request too large.'},413);const input=JSON.parse(raw);
 if(input.action==='create'){
  const details=roomDetails(input);const {members,location,category}=validatePlan(input);
  const key=(env as unknown as Record<string,string>).QLOO_API_KEY;
  const result=await plan(input,key,budgetedFetch(env.DB));
  if(!result.picks.length)throw new GatherError('No choices found yet. Refine the favorites before inviting people.');
  const id=crypto.randomUUID().replaceAll('-',''),access=secret(),player=secret(),now=Date.now();
  const expires=Math.min(Date.parse(details.date+'T12:00:00Z')+2*86400000,now+33*86400000);
  const picks=result.picks.map((p:{id:string;name:string;address?:string;ranks:(number|null)[];support:number})=>({id:p.id,name:p.name,address:p.address||'',ranks:p.ranks,support:p.support}));
  await db().batch([
   db().prepare('INSERT INTO gather_rooms(id,access_hash,title,date,location,category,seats,picks,created,expires) VALUES (?,?,?,?,?,?,?,?,?,?)').bind(id,await digest(access),details.title,details.date,location,category,members.length,JSON.stringify(picks),now,expires),
   db().prepare('INSERT INTO gather_players(id,room_id,token_hash,seat) VALUES (?,?,?,1)').bind(crypto.randomUUID(),id,await digest(player))
  ]);
  return reply({id,access,player},201);
 }
 const room=await authorized(request);
 if(input.action==='join'){
  const player=request.headers.get('X-Player-Key')||'';if(!/^[a-f0-9]{64}$/.test(player))throw new GatherError('Your phone needs a valid seat token.',400);const hash=await digest(player);let joined=await db().prepare('SELECT seat FROM gather_players WHERE room_id=? AND token_hash=?').bind(room.id,hash).first();if(!joined){joined=await db().prepare('INSERT OR IGNORE INTO gather_players(id,room_id,token_hash,seat) SELECT ?,?,?,COALESCE(MAX(seat),0)+1 FROM gather_players WHERE room_id=? HAVING COUNT(*) < ? RETURNING seat').bind(hash,room.id,hash,room.id,room.seats).first();if(!joined)joined=await db().prepare('SELECT seat FROM gather_players WHERE room_id=? AND token_hash=?').bind(room.id,hash).first();}
  if(!joined)throw new GatherError('All seats are taken. Open this invitation on the phone you joined with, or ask for a new room.',409);
  return reply({player,seat:joined.seat},201);
 }
 if(input.action==='vote'){
  const token=request.headers.get('X-Player-Key')||'';if(!/^[a-f0-9]{64}$/.test(token))throw new GatherError('Join the room before voting.',403);
  const choices=ballot(input.votes,JSON.parse(String(room.picks)));
  const row=await db().prepare('UPDATE gather_players SET votes=? WHERE room_id=? AND token_hash=? AND (SELECT COUNT(*) FROM gather_players WHERE room_id=? AND votes IS NOT NULL) < ? RETURNING id').bind(JSON.stringify(choices),room.id,await digest(token),room.id,room.seats).first();
  if(!row)throw new GatherError('Your seat is unavailable or this round is complete. Votes lock after the reveal.',403);
  return reply(await state(request));
 }
 throw new GatherError('Unknown room action.');
 }catch(e){return failure(e);}}
