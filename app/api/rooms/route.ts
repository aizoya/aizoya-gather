import {env} from 'cloudflare:workers';
import {confirmedPreferences,groupDiscoveryMessages} from '../../../lib/group-intake.mjs';
import {groundedDiscover} from '../../../lib/grounded-discovery.mjs';
import {issueDiscoveryInvitation} from '../../../lib/discovery-invitation.mjs';
import {applyVenueTaste,verifiedVenue} from '../../../lib/venue-taste.mjs';
import {conversation} from '../../../lib/discovery.mjs';
import {reserveDiscovery} from '../../../lib/discovery-budget.mjs';
import {readDiscoveryInvitation} from '../../../lib/discovery-invitation.mjs';
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
 if(!row)throw new GatherError('This invitation has expired or is invalid.',404);
 if(String(row.category).startsWith('discovering:')&&Date.now()-Number(String(row.category).split(':')[1])>65000){await db().prepare('UPDATE gather_rooms SET category=? WHERE id=? AND category=?').bind('intake',row.id,row.category).run();row.category='intake';}
 return row;
}
async function state(request:Request){
 const room=await authorized(request);const people=await db().prepare('SELECT id,seat,token_hash,votes,preferences FROM gather_players WHERE room_id=? ORDER BY seat').bind(room.id).all();
 const member=request.headers.get('X-Player-Key')||'';const hash=member?await digest(member):'';
 const me=people.results.find(p=>p.token_hash===hash);const picks=JSON.parse(String(room.picks));
 const votes=people.results.filter(p=>p.votes).map(p=>JSON.parse(String(p.votes)));const outcome=agreement(picks,votes,room.seats);
 return {id:room.id,title:room.title,date:room.date,location:room.location,category:room.category,mode:['place','movie','artist'].includes(String(room.category))?room.category:room.discovery_mode||'events',seats:room.seats,joined:people.results.length,ready:votes.length,phase:room.category==='intake'?'intake':String(room.category).startsWith('discovering:')?'discovering':'voting',preferencesReady:people.results.filter(p=>p.preferences).length,picks,me:me?{seat:me.seat,votes:me.votes?JSON.parse(String(me.votes)):null,preferences:me.preferences?JSON.parse(String(me.preferences)):null}:null,outcome:{complete:outcome.complete,choices:outcome.choices.map(({total,accepted,...p}:{total:number;accepted:boolean;id:string;name:string})=>p)}};
}
export async function GET(request:Request){try{return reply(await state(request));}catch(e){return failure(e);}}
function failure(error:unknown){return error instanceof GatherError?reply({error:error.message,code:error.code},error.status):reply({error:'The planning room is temporarily unavailable. Please try again.'},503);}
export async function POST(request:Request){try{
 if(request.headers.get('origin')!==new URL(request.url).origin)return reply({error:'Origin rejected.'},403);
 if(!request.headers.get('content-type')?.includes('application/json'))return reply({error:'JSON required.'},415);
 const raw=await request.text();if(raw.length>10000)return reply({error:'Request too large.'},413);const input=JSON.parse(raw);
 if(input.action==='create-intake'){
  const mode=input.mode??'events';if(!['events','place','movie','artist'].includes(mode))throw new GatherError('Choose a supported discovery type.');
  const details=roomDetails(input);const location=typeof input.location==='string'?input.location.trim():'';
  if(!location||location.length>120)throw new GatherError('Enter a city or area in up to 120 characters.');
  if(!Number.isInteger(input.seats)||input.seats<2||input.seats>4)throw new GatherError('Choose two to four people.');
  const id=crypto.randomUUID().replaceAll('-',''),access=secret(),player=secret(),now=Date.now();
  const expires=Math.min(Date.parse(details.date+'T12:00:00Z')+2*86400000,now+33*86400000);
  await db().batch([
   db().prepare('INSERT INTO gather_rooms(id,access_hash,title,date,location,category,discovery_mode,seats,picks,created,expires) VALUES (?,?,?,?,?,?,?,?,?,?,?)').bind(id,await digest(access),details.title,details.date,location,'intake',mode,input.seats,'[]',now,expires),
   db().prepare('INSERT INTO gather_players(id,room_id,token_hash,seat) VALUES (?,?,?,1)').bind(crypto.randomUUID(),id,await digest(player))
  ]);return reply({id,access,player},201);
 }
 if(input.action==='create-discovery'){
  const key=(env as unknown as Record<string,string>).OPENAI_API_KEY;
  const discovery=await readDiscoveryInvitation(input.invitation,key);
  const details=roomDetails({title:input.title,date:discovery.date});
  if(!Number.isInteger(input.seats)||input.seats<2||input.seats>4)throw new GatherError('Choose two to four people.');
  const id=crypto.randomUUID().replaceAll('-',''),access=secret(),player=secret(),now=Date.now();
  const expires=Math.min(Date.parse(details.date+'T12:00:00Z')+2*86400000,now+33*86400000);
  await db().batch([
   db().prepare('INSERT INTO gather_rooms(id,access_hash,title,date,location,category,seats,picks,created,expires) VALUES (?,?,?,?,?,?,?,?,?,?)').bind(id,await digest(access),details.title,details.date,discovery.location,input.collectPreferences===true?'intake':'events',input.seats,JSON.stringify(discovery.picks),now,expires),
   db().prepare('INSERT INTO gather_players(id,room_id,token_hash,seat) VALUES (?,?,?,1)').bind(crypto.randomUUID(),id,await digest(player))
  ]);
  return reply({id,access,player},201);
 }
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
 if(input.action==='preferences'){
  const token=request.headers.get('X-Player-Key')||'';if(!/^[a-f0-9]{64}$/.test(token))throw new GatherError('Join the room first.',403);
  const preferences=confirmedPreferences(input.preferences);
  if(room.discovery_mode!=='events'&&!preferences.interests.length)throw new GatherError('Choose at least one cultural favorite for Qloo taste discovery.');
  const row=await db().prepare('UPDATE gather_players SET preferences=? WHERE room_id=? AND token_hash=? AND EXISTS (SELECT 1 FROM gather_rooms WHERE id=? AND category=?) RETURNING id').bind(JSON.stringify(preferences),room.id,await digest(token),room.id,'intake').first();
  if(!row)throw new GatherError('Preferences are locked during discovery or voting.',409);return reply(await state(request));
 }
 if(input.action==='replan'){
  const token=request.headers.get('X-Player-Key')||'';
  const host=await db().prepare('SELECT seat FROM gather_players WHERE room_id=? AND token_hash=? AND seat=1').bind(room.id,await digest(token)).first();
  if(!host)throw new GatherError('Only the room creator can open another round.',403);
  const people=await db().prepare('SELECT votes FROM gather_players WHERE room_id=? ORDER BY seat').bind(room.id).all();
  const picks=JSON.parse(String(room.picks));
  const result=agreement(picks,people.results.filter(p=>p.votes).map(p=>JSON.parse(String(p.votes))),room.seats);
  if(!picks.length||!result.complete||result.choices.length)throw new GatherError('A new round is available only after everyone votes and no option is shared.',409);
  const rejected=[...JSON.parse(String(room.rejected||'[]')),...picks.map((p:{id:string;name:string;sourceUrl?:string})=>({id:p.id,name:p.name,sourceUrl:p.sourceUrl||''}))];
  if(rejected.length>30)throw new GatherError('This room has reached its 30-option limit. Start a new invitation.',409);
  const lock='replanning:'+crypto.randomUUID();
  const started=await db().prepare('UPDATE gather_rooms SET category=? WHERE id=? AND category=? RETURNING id').bind(lock,room.id,room.category).first();
  if(!started)throw new GatherError('This round already changed. Reload the room.',409);
  try{await db().batch([
   db().prepare('UPDATE gather_players SET votes=NULL WHERE room_id=?').bind(room.id),
   db().prepare('UPDATE gather_rooms SET category=?,picks=?,rejected=? WHERE id=? AND category=?').bind('intake','[]',JSON.stringify(rejected),room.id,lock)
  ]);}catch(error){await db().prepare('UPDATE gather_rooms SET category=? WHERE id=? AND category=?').bind(room.category,room.id,lock).run();throw error;}
  return reply(await state(request));
 }
 if(input.action==='discover-group'){
  const token=request.headers.get('X-Player-Key')||'';
  const host=await db().prepare('SELECT seat FROM gather_players WHERE room_id=? AND token_hash=? AND seat=1').bind(room.id,await digest(token)).first();
  if(!host)throw new GatherError('Only the room creator can start group discovery.',403);
  const storedPicks=JSON.parse(String(room.picks));
  const rejected=JSON.parse(String(room.rejected||'[]')) as {id:string;name:string;sourceUrl:string}[];
  const config=env as unknown as Record<string,string>;const tasteMode=['place','movie','artist'].includes(String(room.discovery_mode));
  if(tasteMode?!config.QLOO_API_KEY:!config.OPENAI_API_KEY||(!storedPicks.length&&!config.TAVILY_API_KEY))throw new GatherError('Discovery is awaiting provider activation.',503);
  const lock='discovering:'+Date.now()+':'+crypto.randomUUID();
  const started=await db().prepare('UPDATE gather_rooms SET category=? WHERE id=? AND category=? RETURNING id').bind(lock,room.id,'intake').first();
  if(!started)throw new GatherError('Discovery is already running or this room has its shortlist.',409);
  try{
  const people=await db().prepare('SELECT preferences FROM gather_players WHERE room_id=? ORDER BY seat').bind(room.id).all();
  if(people.results.length!==room.seats||people.results.some(p=>!p.preferences))throw new GatherError('Everyone must confirm their preferences first.',409);
  const preferences=people.results.map(p=>confirmedPreferences(JSON.parse(String(p.preferences))));
  if(tasteMode){
   if(preferences.some(p=>!p.interests.length))throw new GatherError('Each person must choose a cultural favorite.',409);
   const result=await plan({category:room.discovery_mode,location:room.location,excluded:rejected.map(p=>p.id),members:preferences.map(p=>({interests:p.interests}))},config.QLOO_API_KEY,budgetedFetch(env.DB));
   if(!result.picks.some((p:{id:string})=>!rejected.some(r=>r.id===p.id)))throw new GatherError('Qloo returned no taste picks. Your preferences are saved.',422);
   const picks=result.picks.filter((p:{id:string})=>!rejected.some(r=>r.id===p.id)).map((p:{id:string;name:string;address?:string;ranks:(number|null)[];support:number})=>({id:p.id,name:p.name,address:p.address||'',ranks:p.ranks,support:p.support}));
   const saved=await db().prepare('UPDATE gather_rooms SET category=?,picks=? WHERE id=? AND category=? RETURNING id').bind(room.discovery_mode,JSON.stringify(picks),room.id,lock).first();
   if(!saved)throw new GatherError('This discovery attempt expired. Reload the room.',409);
  }else{
  const messages=groupDiscoveryMessages(room,preferences);
  if(rejected.length)messages[0].content+=' Find different options. Previously rejected names: '+JSON.stringify(rejected.map(p=>p.name)).slice(0,400)+'.';
   const eventStarted=Date.now();
   let found;
   if(storedPicks.length){found={city:room.location,checkedAt:storedPicks[0].checkedAt,candidates:storedPicks.map((p:{name:string;sourceUrl:string;dateQuote:string;price:number|null;venueQuote?:string;address?:string})=>({name:p.name,url:p.sourceUrl,eventDate:room.date,dateQuote:p.dateQuote,price:p.price,venue:verifiedVenue({dateQuote:p.dateQuote,venueName:null,venueAddress:null,venueQuote:null},p.dateQuote.replace(/\s+/g,' ').trim(),p.name)}))};}
   else{conversation(messages);await reserveDiscovery(env.DB);found=await groundedDiscover(messages,config.OPENAI_API_KEY,config.TAVILY_API_KEY);}
   const result=await applyVenueTaste(found,preferences,config.QLOO_API_KEY,budgetedFetch(env.DB),{timeoutMs:Math.min(12000,55000-(Date.now()-eventStarted))});
   result.candidates=(result.candidates||[]).filter((p:{name:string;url:string})=>!rejected.some(r=>r.name.trim().toLowerCase()===p.name.trim().toLowerCase()));
   const receipt=await issueDiscoveryInvitation(result,config.OPENAI_API_KEY);
   if(!receipt)throw new GatherError('No dated listings passed the evidence checks. Preferences are saved; discuss a broader search before trying again.',422);
   const discovery=await readDiscoveryInvitation(receipt,config.OPENAI_API_KEY);
   const saved=await db().prepare('UPDATE gather_rooms SET category=?,picks=? WHERE id=? AND category=? RETURNING id').bind('events',JSON.stringify(discovery.picks),room.id,lock).first();
   if(!saved)throw new GatherError('This discovery attempt expired. Reload the room.',409);
  }
  }catch(error){await db().prepare('UPDATE gather_rooms SET category=? WHERE id=? AND category=?').bind('intake',room.id,lock).run();throw error;}
  return reply(await state(request));
 }
 if(input.action==='vote'){
  if(String(room.category).startsWith('replanning:')||!JSON.parse(String(room.picks)).length||room.category==='intake'||String(room.category).startsWith('discovering:'))throw new GatherError('Wait for the shared shortlist before voting.',409);
  const token=request.headers.get('X-Player-Key')||'';if(!/^[a-f0-9]{64}$/.test(token))throw new GatherError('Join the room before voting.',403);
  const choices=ballot(input.votes,JSON.parse(String(room.picks)));
  const row=await db().prepare('UPDATE gather_players SET votes=? WHERE room_id=? AND token_hash=? AND (SELECT COUNT(*) FROM gather_players WHERE room_id=? AND votes IS NOT NULL) < ? RETURNING id').bind(JSON.stringify(choices),room.id,await digest(token),room.id,room.seats).first();
  if(!row)throw new GatherError('Your seat is unavailable or this round is complete. Votes lock after the reveal.',403);
  return reply(await state(request));
 }
 throw new GatherError('Unknown room action.');
 }catch(e){return failure(e);}}
