import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import {DatabaseSync} from 'node:sqlite';import ts from 'typescript';
import {issueDiscoveryInvitation} from '../lib/discovery-invitation.mjs';import {secret} from '../lib/rooms.mjs';
test('discovered shortlist → two independent seats → private ballots → reveal',async()=>{
 const sql=new DatabaseSync(':memory:');sql.exec(fs.readFileSync(new URL('../drizzle/0002_opposite_colleen_wing.sql',import.meta.url),'utf8'));sql.exec(fs.readFileSync(new URL('../drizzle/0003_mixed_lenny_balinger.sql',import.meta.url),'utf8'));sql.exec(fs.readFileSync(new URL('../drizzle/0004_zippy_la_nuit.sql',import.meta.url),'utf8'));sql.exec(fs.readFileSync(new URL('../drizzle/0005_simple_vindicator.sql',import.meta.url),'utf8'));sql.exec(fs.readFileSync(new URL('../drizzle/0001_lonely_puma.sql',import.meta.url),'utf8'));
 sql.exec(fs.readFileSync(new URL('../drizzle/0006_common_barracuda.sql',import.meta.url),'utf8'));
 const db={prepare(query){let values=[];const statement={bind(...v){values=v;return statement;},async first(){return sql.prepare(query).get(...values)||null;},async all(){return {results:sql.prepare(query).all(...values)};},async run(){return sql.prepare(query).run(...values);}};return statement;},async batch(statements){sql.exec('BEGIN');try{const out=[];for(const s of statements)out.push(await s.run());sql.exec('COMMIT');return out;}catch(e){sql.exec('ROLLBACK');throw e;}}};
 let modelCalls=0,providerInput;globalThis.__gatherGroundedMock=async(messages)=>{modelCalls++;providerInput=messages;return {city:'Oakland',checkedAt:new Date().toISOString(),candidates:[{name:'Group fixture',eventDate:new Date(Date.now()+86400000).toISOString().slice(0,10),url:'https://example.invalid/group',dateQuote:'Synthetic fixture date evidence',price:null}]};};let qlooCalls=0,qlooInput;let qlooPicks=[{id:'qloo-fixture',name:'Qloo fixture place',address:'Synthetic address',ranks:[1,2],support:2}];globalThis.__gatherPlanMock=async(input)=>{qlooCalls++;qlooInput=input;return {picks:qlooPicks};};globalThis.__gatherRoomTestEnv={DB:db,OPENAI_API_KEY:'synthetic',TAVILY_API_KEY:'synthetic',QLOO_API_KEY:'synthetic'};
 let source=fs.readFileSync(new URL('../app/api/rooms/route.ts',import.meta.url),'utf8').replace("import {env} from 'cloudflare:workers';",'const env=globalThis.__gatherRoomTestEnv;').replace("import {groundedDiscover} from '../../../lib/grounded-discovery.mjs';",'const groundedDiscover=globalThis.__gatherGroundedMock;').replace("import {GatherError,plan,validatePlan} from '../../../lib/gather.mjs';","import {GatherError,validatePlan} from '../../../lib/gather.mjs'; const plan=globalThis.__gatherPlanMock;").replaceAll("'../../../lib/","'"+new URL('../lib/',import.meta.url).href);
 const compiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
 const route=await import('data:text/javascript;base64,'+Buffer.from(compiled).toString('base64'));
 const date=new Date(Date.now()+86400000).toISOString().slice(0,10);
 const invitation=await issueDiscoveryInvitation({city:'Oakland',checkedAt:new Date().toISOString(),candidates:[{name:'Synthetic event',eventDate:date,url:'https://example.invalid/event',dateQuote:'Synthetic fixture date evidence',price:null},{name:'Another event',eventDate:date,url:'https://example.invalid/other',dateQuote:'Synthetic fixture date evidence',price:25}]},'synthetic');
 const create=await route.POST(new Request('https://gather.example/api/rooms',{method:'POST',headers:{origin:'https://gather.example','content-type':'application/json'},body:JSON.stringify({action:'create-discovery',invitation,title:'Synthetic QA room',seats:2})}));assert.equal(create.status,201);const room=await create.json();
 const url='https://gather.example/api/rooms?id='+room.id;const send=(player,body)=>{const headers={origin:'https://gather.example','content-type':'application/json','X-Room-Key':room.access,'X-Player-Key':player};return body?route.POST(new Request(url,{method:'POST',headers,body:JSON.stringify(body)})):route.GET(new Request(url,{headers}));};
 const second=secret();assert.equal((await send(second,{action:'join'})).status,201);
 const initial=await (await send(room.player)).json();assert.equal(initial.joined,2);assert.equal(initial.picks[0].sourceUrl,'https://example.invalid/event');const [a,b]=initial.picks.map(p=>p.id);
 assert.equal((await send(room.player,{action:'vote',votes:{[a]:1,[b]:0}})).status,200);
 const privateState=await (await send(second)).json();assert.equal(privateState.me.votes,null);assert.deepEqual(privateState.outcome,{complete:false,choices:[]});assert(!JSON.stringify(privateState).includes('token_hash'));assert(!JSON.stringify(privateState).includes(room.player));
 const revealed=await (await send(second,{action:'vote',votes:{[a]:-1,[b]:1}})).json();assert.equal(revealed.outcome.complete,true);assert.deepEqual(revealed.outcome.choices.map(p=>p.id),[b]);assert.equal(revealed.outcome.choices[0].price,25);
 assert.equal((await send(room.player,{action:'vote',votes:{[a]:1,[b]:1}})).status,403);
 assert.equal((await route.GET(new Request(url,{headers:{'X-Room-Key':secret()}}))).status,404);
 const intakeCreate=await route.POST(new Request('https://gather.example/api/rooms',{method:'POST',headers:{origin:'https://gather.example','content-type':'application/json'},body:JSON.stringify({action:'create-intake',title:'Private intake QA',location:'Oakland',date,seats:2})}));assert.equal(intakeCreate.status,201);const group=await intakeCreate.json();
 const groupUrl='https://gather.example/api/rooms?id='+group.id;
 const groupSend=(player,body)=>{const headers={origin:'https://gather.example','content-type':'application/json','X-Room-Key':group.access,'X-Player-Key':player};return body?route.POST(new Request(groupUrl,{method:'POST',headers,body:JSON.stringify(body)})):route.GET(new Request(groupUrl,{headers}));};
 const guest=secret();assert.equal((await groupSend(guest,{action:'join'})).status,201);
 assert.equal((await groupSend(group.player,{action:'vote',votes:{}})).status,409);
 assert.equal((await groupSend(group.player,{action:'discover-group'})).status,409);assert.equal(modelCalls,0);
 const pref={description:'Private alpha: comedy or nature',hardNos:'Private dislike: loud music',budget:40,confirmed:true};
 assert.equal((await groupSend(group.player,{action:'preferences',preferences:{...pref,confirmed:false}})).status,400);
 assert.equal((await groupSend(group.player,{action:'preferences',preferences:pref})).status,200);
 const guestState=await (await groupSend(guest)).json();assert.equal(guestState.preferencesReady,1);assert.equal(guestState.me.preferences,null);assert(!JSON.stringify(guestState).includes('Private alpha'));assert(!JSON.stringify(guestState).includes('Private dislike'));
 assert.equal((await groupSend(guest,{action:'preferences',preferences:{description:'Private beta: outdoors or skating',hardNos:'',budget:30,confirmed:true}})).status,200);
 assert.equal((await groupSend(guest,{action:'discover-group'})).status,403);assert.equal(modelCalls,0);
 const generated=await (await groupSend(group.player,{action:'discover-group'})).json();assert.equal(generated.phase,'voting');assert.equal(generated.picks.length,1);assert.equal(modelCalls,1);assert(providerInput[0].content.includes('$30'));assert(providerInput.some(m=>m.content.includes('Private alpha')));assert(providerInput.some(m=>m.content.includes('Private beta')));
 assert(!JSON.stringify(generated).includes('Private beta'));assert.equal((await groupSend(group.player,{action:'preferences',preferences:pref})).status,409);assert.equal((await groupSend(group.player,{action:'discover-group'})).status,409);assert.equal(modelCalls,1);
 const tasteCreated=await route.POST(new Request('https://gather.example/api/rooms',{method:'POST',headers:{origin:'https://gather.example','content-type':'application/json'},body:JSON.stringify({action:'create-intake',title:'Qloo private group QA',location:'Oakland',date,seats:2,mode:'place'})}));assert.equal(tasteCreated.status,201);const taste=await tasteCreated.json();
 const tasteUrl='https://gather.example/api/rooms?id='+taste.id;
 const tasteSend=(player,body)=>{const headers={origin:'https://gather.example','content-type':'application/json','X-Room-Key':taste.access,'X-Player-Key':player};return body?route.POST(new Request(tasteUrl,{method:'POST',headers,body:JSON.stringify(body)})):route.GET(new Request(tasteUrl,{headers}));};
 const tasteGuest=secret();await tasteSend(tasteGuest,{action:'join'});assert.equal((await tasteSend(taste.player,{action:'preferences',preferences:pref})).status,400);
 const interest={id:'fixture-cultural-id',name:'A cultural favorite',kind:'entity'};
 await tasteSend(taste.player,{action:'preferences',preferences:{...pref,interests:[interest]}});await tasteSend(tasteGuest,{action:'preferences',preferences:{...pref,description:'Private second taste person',budget:25,interests:[{...interest,id:'another-cultural-id'}]}});
 const before=sql.prepare('SELECT day_used FROM api_budget_gate WHERE id=2').get().day_used;
 const tasteResult=await (await tasteSend(taste.player,{action:'discover-group'})).json();assert.equal(tasteResult.mode,'place');assert.equal(tasteResult.phase,'voting');assert.equal(tasteResult.picks[0].support,2);assert.equal(qlooCalls,1);assert.equal(modelCalls,1);assert.equal(sql.prepare('SELECT day_used FROM api_budget_gate WHERE id=2').get().day_used,before);
 assert.equal(qlooInput.category,'place');assert.equal(qlooInput.location,'Oakland');assert.equal(qlooInput.members.length,2);assert(!JSON.stringify(qlooInput).includes('Private alpha'));assert(!JSON.stringify(qlooInput).includes('budget'));assert(!JSON.stringify(tasteResult).includes('Private second taste person'));
 const reusedCreated=await route.POST(new Request('https://gather.example/api/rooms',{method:'POST',headers:{origin:'https://gather.example','content-type':'application/json'},body:JSON.stringify({action:'create-discovery',invitation,title:'Reuse saved listings QA',seats:2,collectPreferences:true})}));assert.equal(reusedCreated.status,201);const reused=await reusedCreated.json();const reusedUrl='https://gather.example/api/rooms?id='+reused.id;
 const reuseSend=(player,body)=>{const headers={origin:'https://gather.example','content-type':'application/json','X-Room-Key':reused.access,'X-Player-Key':player};return body?route.POST(new Request(reusedUrl,{method:'POST',headers,body:JSON.stringify(body)})):route.GET(new Request(reusedUrl,{headers}));};
 const reusedGuest=secret();await reuseSend(reusedGuest,{action:'join'});assert.equal((await (await reuseSend(reused.player)).json()).phase,'intake');await reuseSend(reused.player,{action:'preferences',preferences:{...pref,interests:[interest]}});await reuseSend(reusedGuest,{action:'preferences',preferences:{...pref,interests:[interest]}});
 const allowanceBeforeReuse=sql.prepare('SELECT day_used FROM api_budget_gate WHERE id=2').get().day_used;const callsBeforeReuse=modelCalls;const reusedResult=await (await reuseSend(reused.player,{action:'discover-group'})).json();assert.equal(reusedResult.phase,'voting');assert.equal(reusedResult.picks.length,2);assert.equal(modelCalls,callsBeforeReuse);assert.equal(sql.prepare('SELECT day_used FROM api_budget_gate WHERE id=2').get().day_used,allowanceBeforeReuse);
 // Replanning is host-only, deadlock-only, keeps private input, and never spends discovery allowance itself.
 assert.equal((await tasteSend(taste.player,{action:'replan'})).status,409);
 for(let round=0;round<3;round++){
  const snapshot=await (await tasteSend(taste.player)).json();const ids=snapshot.picks.map(p=>p.id);
  await tasteSend(taste.player,{action:'vote',votes:Object.fromEntries(ids.map(id=>[id,-1]))});
  await tasteSend(tasteGuest,{action:'vote',votes:Object.fromEntries(ids.map(id=>[id,1]))});
  assert.equal((await tasteSend(tasteGuest,{action:'replan'})).status,403);
  const reset=await (await tasteSend(taste.player,{action:'replan'})).json();
  assert.equal(reset.phase,'intake');assert.equal(reset.ready,0);assert.equal(reset.me.votes,null);assert.equal(reset.preferencesReady,2);assert.equal(reset.me.preferences.description,pref.description);
  assert.equal(modelCalls,callsBeforeReuse);assert.equal(sql.prepare('SELECT day_used FROM api_budget_gate WHERE id=2').get().day_used,allowanceBeforeReuse);
  assert.equal((await tasteSend(taste.player,{action:'replan'})).status,409);
  if(round===0){assert.equal((await tasteSend(taste.player,{action:'discover-group'})).status,422);assert(qlooInput.excluded.includes('qloo-fixture'));}
  // Supply a new fixture while deliberately returning all previously vetoed entities too.
  const nextId='next-'+round;
  qlooPicks.push({id:nextId,name:'New synthetic choice',address:'',ranks:[1,1],support:2});
  const next=await (await tasteSend(taste.player,{action:'discover-group'})).json();assert.equal(next.phase,'voting');assert.deepEqual(next.picks.map(p=>p.id),[nextId]);assert.equal(qlooInput.excluded.length,round+1);
 }
 // A repeated web-discovered listing is rejected server-side even if the model returns it again.
 const eventId=generated.picks[0].id;
 await groupSend(group.player,{action:'vote',votes:{[eventId]:-1}});await groupSend(guest,{action:'vote',votes:{[eventId]:1}});
 const eventReset=await groupSend(group.player,{action:'replan'});assert.equal(eventReset.status,200);
 const duplicateEvent=await groupSend(group.player,{action:'discover-group'});assert.equal(duplicateEvent.status,422);
 const eventRetry=await (await groupSend(guest)).json();assert.equal(eventRetry.phase,'intake');assert.equal(eventRetry.me.preferences.description,'Private beta: outdoors or skating');
 const privateAfter=await (await tasteSend(tasteGuest)).json();assert(!JSON.stringify(privateAfter).includes('Private alpha'));
 delete globalThis.__gatherPlanMock;
 delete globalThis.__gatherGroundedMock;
 sql.close();delete globalThis.__gatherRoomTestEnv;
});
