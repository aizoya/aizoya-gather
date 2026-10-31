import test from 'node:test';import assert from 'node:assert/strict';
import {rankGroup,search,plan,qloo,sample,validatePlan,rows} from '../lib/gather.mjs';
const a={id:'a',name:'Alpha'},b={id:'b',name:'Beta'},c={id:'c',name:'Gamma'};const members=[{id:'seed1',name:'One'},{id:'seed2',name:'Two'}];
test('shared candidate outranks a one-person first choice',()=>{const out=rankGroup([[a,b],[c,b]],members);assert.equal(out[0].id,'b');assert.deepEqual(out[0].ranks,[2,2]);});
test('weakest rank first prevents one excellent rank dominating',()=>{const extras=Array.from({length:8},(_,i)=>({id:'x'+i,name:'X'+i}));const out=rankGroup([[a,b,...extras],[b,...extras,a]],members);assert.equal(out[0].id,'b');});
test('rejection is excluded from every displayed result',()=>assert(!rankGroup([[a,b],[b,a]],members,['b']).some(p=>p.id==='b')));
test('duplicate provider entries do not inflate support',()=>assert.equal(rankGroup([[a,a],[]],members)[0].support,1));
test('no overlap is explicitly partial',()=>assert(rankGroup([[a],[b]],members).every(p=>p.support===1)));
test('empty results remain empty',()=>assert.deepEqual(rankGroup([[],[]],members),[]));
test('sample mode is fictional and replans without rejected venue',()=>{const s=sample();assert.equal(s.mode,'sample');assert(s.picks.every(p=>p.id.startsWith('fictional-')));assert(!sample({excluded:[s.picks[0].id]}).picks.some(p=>p.id===s.picks[0].id));});
test('invalid category and excessive inputs rejected',()=>{assert.throws(()=>validatePlan({members,category:'evil'}));assert.throws(()=>validatePlan({members:[members[0]],category:'movie'}));assert.throws(()=>validatePlan({members,category:'place',location:''}));});
test('missing key fails closed without a network request',async()=>{let calls=0;await assert.rejects(qloo('/search',{},'',()=>calls++),/awaiting/);assert.equal(calls,0);});
test('search uses exact documented base, server header, encoded query',async()=>{let seen;const out=await search({query:'A & B',type:'movie'},'test-secret',async(url,options)=>{seen={url,options};return Response.json({results:[{entity_id:'id',name:'Result',subtype:'movie'}]});});assert.equal(seen.url.origin,'https://hackathon.api.qloo.com');assert.equal(seen.url.pathname,'/search');assert.equal(seen.url.searchParams.get('query'),'A & B');assert.equal(seen.options.headers['X-Api-Key'],'test-secret');assert(!seen.url.href.includes('test-secret'));assert.equal(out[0].id,'id');});
test('rate limit is reported rather than turned into no match',async()=>{await assert.rejects(qloo('/search',{},'key',async()=>new Response('',{status:429})),/quota/);});
test('malformed provider shape fails closed',()=>assert.throws(()=>rows({results:{bogus:[]}}),/unexpected/));
test('plan makes separate per-person requests and passes exclusions',async()=>{const urls=[];const p=await plan({members,category:'movie',excluded:['reject']},'key',async url=>{urls.push(url);return Response.json({results:{entities:[{entity_id:'shared',name:'Shared'}]}});});assert.equal(urls.length,2);assert.equal(urls[0].searchParams.get('signal.interests.entities'),'seed1');assert.equal(urls[1].searchParams.get('signal.interests.entities'),'seed2');assert.equal(urls[0].searchParams.get('filter.exclude.entities'),'reject');assert.equal(p.picks[0].support,2);assert.equal(p.mode,'live');});
test('upstream failure does not silently become sample success',async()=>{await assert.rejects(plan({members,category:'movie'},'key',async()=>new Response('',{status:500})),/No substitute/);});
test('no-overlap recovery widens exactly once and preserves vetoes',async()=>{const urls=[];const p=await plan({members,category:'movie',excluded:['reject']},'key',async url=>{urls.push(url);const deep=url.searchParams.get('take')==='24';const seed=url.searchParams.get('signal.interests.entities');return Response.json({results:{entities:[{entity_id:deep?'shared':seed+'-only',name:'Candidate'}]}});});assert.equal(urls.length,4);assert.equal(p.depth,24);assert(p.shared);assert(urls.every(u=>u.searchParams.get('filter.exclude.entities')==='reject'));assert(p.trace.some(t=>t.step.includes('widen once')));});
test('disjoint recovery stops after one wider pass and labels partial evidence',async()=>{let calls=0;const p=await plan({members,category:'movie'},'key',async url=>{calls++;return Response.json({results:{entities:[{entity_id:url.searchParams.get('signal.interests.entities'),name:'Separate'}]}});});assert.equal(calls,4);assert.equal(p.depth,24);assert(!p.shared);});
test('all empty lists do not trigger unnecessary recovery',async()=>{let calls=0;const p=await plan({members,category:'movie'},'key',async()=>{calls++;return Response.json({results:{entities:[]}});});assert.equal(calls,2);assert.deepEqual(p.picks,[]);});
test('budget errors preserve actionable status through adapter',async()=>{const {GatherError}=await import('../lib/gather.mjs');await assert.rejects(qloo('/search',{},'key',async()=>{throw new GatherError('Budget paused',429);}),e=>e.status===429&&e.message==='Budget paused');});
test('overall planning deadline cancels an in-flight call with actionable timeout',async()=>{await assert.rejects(plan({members,category:'movie'},'key',async(url,options)=>new Promise((resolve,reject)=>{const timer=setTimeout(()=>resolve(Response.json({results:{entities:[]}})),100);options.signal.addEventListener('abort',()=>{clearTimeout(timer);reject(options.signal.reason);},{once:true});}),{timeoutMs:5}),e=>e.status===504&&e.message.includes('timed out'));});

 test("redirects fail closed with Worker-compatible manual mode", async()=>{let calls=0;await assert.rejects(search({query:"Inception",type:"movie"},"test-key",async(url,options)=>{calls++;assert.equal(options.redirect,"manual");return new Response(null,{status:302,headers:{Location:"https://example.invalid"}});}),e=>e.status===502);assert.equal(calls,1);});

test("four people accepted and five rejected",()=>{assert.equal(validatePlan({members:[...members,...members],category:"movie"}).members.length,4);assert.throws(()=>validatePlan({members:[...members,...members,members[0]],category:"movie"}));});
test("shortlist offers four distinct choices",()=>{const list=[a,b,c,{id:"d",name:"Delta"},{id:"e",name:"Epsilon"}];assert.equal(rankGroup([list,list],members).length,4);});
import {discoveryTerms} from '../lib/gather.mjs';
test('discovery recognizes generic movies, funny requests and cuisine without inventing IDs',()=>{assert.deepEqual(discoveryTerms('movies','movie'),['Comedy','Adventure','Drama']);assert.deepEqual(discoveryTerms('funny movies tonight','movie'),['Comedy']);assert.deepEqual(discoveryTerms('Thai food','place'),['Thai']);assert.deepEqual(discoveryTerms('Inception','movie'),[]);});
test('discovery offers only Qloo tags valid for the selected category',async()=>{const result=await search({query:'funny movies',type:'movie'},'key',async()=>Response.json({results:{tags:[{id:'urn:tag:genre:media:comedy',name:'Comedy',type:'urn:tag:genre:media',parents:[{type:'urn:entity:movie'}]},{id:'urn:tag:genre:music:comedy',name:'Comedy music',type:'urn:tag:genre:music',parents:[{type:'urn:entity:artist'}]}]}}));assert.equal(result.length,1);assert.equal(result[0].type,'tag');});
test('tag-based plan sends confirmed tag IDs as tag signals',async()=>{const calls=[];await plan({members:[{id:'urn:tag:genre:media:comedy',name:'Comedy',kind:'tag'},members[0]],category:'movie'},'key',async(url)=>{calls.push(url);return Response.json({results:{entities:[{entity_id:'a',name:'A'}]}});});assert.equal(calls[0].searchParams.get('signal.interests.tags'),'urn:tag:genre:media:comedy');assert.equal(calls[0].searchParams.has('signal.interests.entities'),false);assert.equal(calls[1].searchParams.get('signal.interests.entities'),'seed1');});

test('literal names containing genres retain entity lookup',()=>{for(const [q,type] of [['Pop Smoke','artist'],['Aesop Rock','artist'],['Adventureland','movie'],['The King of Comedy','movie'],['Thai Diner','place']])assert.deepEqual(discoveryTerms(q,type),[]);});

test('identical confirmed interests reuse one lookup while retaining both people',async()=>{
 let calls=0;
 const same={id:'urn:tag:genre:media:comedy',name:'Comedy',kind:'tag'};
 const p=await plan({members:[same,same],category:'movie'},'key',async()=>{
  calls++;return Response.json({results:{entities:[{entity_id:'shared',name:'Shared'}]}});
 });
 assert.equal(calls,1);
 assert.deepEqual(p.picks[0].ranks,[1,1]);
 assert.equal(p.picks[0].support,2);
 assert.equal(p.trace.filter(t=>t.endpoint==='Local reuse').length,1);
});
test('reuse stays within each plan and honors changed exclusions',async()=>{
 const seen=[];const same={id:'seed',name:'Seed'};
 const fetcher=async url=>{seen.push(url.searchParams.get('filter.exclude.entities'));return Response.json({results:{entities:[{entity_id:'a',name:'A'},{entity_id:'b',name:'B'}]}});};
 await plan({members:[same,same],category:'movie'},'key',fetcher);
 const p=await plan({members:[same,same],category:'movie',excluded:['a']},'key',fetcher);
 assert.deepEqual(seen,[null,'a']);assert(!p.picks.some(x=>x.id==='a'));
});

test('local and event requests do not silently become title searches',async()=>{
 for(const query of ['movies near me','showtimes tonight','movies in Oakland','AI hackathons','events in Oakland']){
  let calls=0;
  await assert.rejects(search({query,type:'movie'},'test',async()=>{calls++;}),/not connected/);
  assert.equal(calls,0);
 }
});

test('multiple interests retain equal person weight and vetoes',async()=>{
 const profile=[{interests:[{id:'jazz',name:'Jazz'},{id:'comedy',name:'Comedy'}]},{interests:[{id:'comedy',name:'Comedy'}]}];
 const calls=[];
 const out=await plan({members:profile,category:'movie',excluded:['veto']},'key',async url=>{
  calls.push(url.searchParams.get('signal.interests.entities'));
  return Response.json({results:{entities:[{entity_id:'veto',name:'Rejected'},{entity_id:'shared',name:'Shared'}]}});
 });
 assert.deepEqual(calls,['jazz','comedy']);assert.equal(out.members.length,2);
 assert.equal(out.picks[0].support,2);assert.equal(out.picks[0].ranks.length,2);
 assert(!out.picks.some(p=>p.id==='veto'));
});
test('interest limits and duplicates fail before provider access',()=>{
 for(const interests of [[],Array.from({length:4},(_,i)=>({id:String(i),name:'Test'})),[{id:'a',name:'A'},{id:'a',name:'Again'}]])assert.throws(()=>validatePlan({members:[{interests},members[1]],category:'movie'}));
});

test('provider failures have specific safe diagnostics',async()=>{
 for(const [status,code] of [[400,'PROVIDER_BAD_REQUEST'],[401,'PROVIDER_AUTH'],[429,'PROVIDER_RATE_LIMIT'],[503,'PROVIDER_5XX']]){
  const records=[];
  await assert.rejects(qloo('/v2/insights',{'signal.interests.entities':'private-interest',take:12},'private-key',async()=>new Response('secret upstream body',{status}),{observe:r=>records.push(r)}),e=>e.code===code);
  assert.equal(records[0].outcome,code);assert(!JSON.stringify(records).includes('private-'));assert(!JSON.stringify(records).includes('secret upstream'));
 }
});
test('network reset and timeout are distinguished without leaking exceptions',async()=>{
 for(const [error,code] of [[new TypeError('sensitive details'),'NETWORK_FAILURE'],[new DOMException('sensitive details','TimeoutError'),'UPSTREAM_TIMEOUT']]){
  const records=[];await assert.rejects(qloo('/search',{},'key',async()=>{throw error;},{observe:r=>records.push(r)}),e=>e.code===code);
  assert.equal(records[0].outcome,code);assert(!JSON.stringify(records).includes('sensitive'));
 }
});
test('real individual abort is classified as timeout',async()=>{
 await assert.rejects(qloo('/search',{},'key',async(url,{signal})=>new Promise((resolve,reject)=>{signal.addEventListener('abort',()=>reject(signal.reason),{once:true});}),{timeoutMs:5,observe:()=>{}}),e=>e.code==='UPSTREAM_TIMEOUT'&&e.status===504);
});

test('lookups run at most two concurrently, deduplicate, and ignore selection order',async()=>{
 let active=0,peak=0;const calls=[];
 const fetcher=async url=>{const id=url.searchParams.get('signal.interests.entities');calls.push(id);active++;peak=Math.max(peak,active);await new Promise(r=>setTimeout(r,id==='a'?10:2));active--;return Response.json({results:{entities:[{entity_id:id,name:id},{entity_id:'common',name:'Common'}]}});};
 const seed=id=>({id,name:id});
 const one=[{interests:[seed('b'),seed('a')]},{interests:[seed('c'),seed('a')]}];
 const first=await plan({members:one,category:'movie'},'key',fetcher);
 assert.equal(peak,2);assert.equal(calls.filter(x=>x==='a').length,1);
 const second=await plan({members:one.map(m=>({interests:[...m.interests].reverse()})),category:'movie'},'key',fetcher);
 assert.deepEqual(first.picks,second.picks);
});
test('failed parallel interest fails whole plan without presenting partial agreement',async()=>{
 const seed=id=>({id,name:id});let calls=0;
 await assert.rejects(plan({members:[{interests:[seed('a'),seed('b'),seed('c')]},{interests:[seed('d')]}],category:'movie'},'key',async url=>{calls++;if(url.searchParams.get('signal.interests.entities')==='a')return new Response('',{status:401});await new Promise(r=>setTimeout(r,10));return Response.json({results:{entities:[]}});}),e=>e.code==='PROVIDER_AUTH');
 assert.equal(calls,2);
});

test('specific candidate filtering is bounded and enforced against extra provider rows',async()=>{for(const candidateIds of ['not-array',['a','a'],[''],['a','b','c','d']])assert.throws(()=>validatePlan({members,category:'place',location:'Oakland',candidateIds}));const urls=[];const result=await plan({members,category:'place',location:'Oakland',candidateIds:['target']},'synthetic',async url=>{urls.push(url);return Response.json({results:{entities:[{entity_id:'unrequested',name:'Ignore'},{entity_id:'target',name:'Requested'}]}});});assert.equal(urls.length,2);assert(urls.every(u=>u.searchParams.get('filter.results.entities')==='target'));assert.deepEqual(result.picks.map(p=>p.id),['target']);assert.equal(result.picks[0].support,2);});
test('empty candidate-filtered results never trigger unrelated widening',async()=>{let calls=0;const result=await plan({members,category:'place',location:'Oakland',candidateIds:['target']},'synthetic',async()=>{calls++;return Response.json({results:{entities:[]}});});assert.equal(calls,2);assert.deepEqual(result.picks,[]);});
