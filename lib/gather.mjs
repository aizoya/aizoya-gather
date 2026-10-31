// Dependency-free Qloo adapter and deterministic group decision policy.
export const BASE = 'https://hackathon.api.qloo.com';
export const TYPES = ['artist','movie','book','place'];
export class GatherError extends Error { constructor(message,status=400,code='INVALID_REQUEST'){ super(message);this.status=status;this.code=code; } }
export function text(value,max=100){ if(typeof value!=='string'||!value.trim()||value.length>max||/[\u0000-\u001f]/.test(value)) throw new GatherError('Enter a valid value.');return value.trim(); }
export function entity(row){
 if(!row||typeof row.entity_id!=='string'||typeof row.name!=='string')return null;
 return {id:row.entity_id,name:row.name,type:row.subtype||row.type||'entity',description:typeof row.properties?.short_description==='string'?row.properties.short_description.slice(0,350):'',address:typeof row.properties?.address==='string'?row.properties.address:'',tags:Array.isArray(row.tags)?row.tags.filter(t=>t&&typeof t.name==='string').slice(0,4).map(t=>t.name):[]};
}
export function rows(data,search=false){ const list=search?data.results:data.results?.entities; if(!Array.isArray(list))throw new GatherError('Qloo returned an unexpected response. No recommendations were generated.',502);return list.map(entity).filter(Boolean); }
export async function qloo(path,params,key,fetcher=fetch,{timeoutMs=25000,observe=record=>console.info(JSON.stringify(record))}={}){
 if(!key)throw new GatherError('Live Qloo access is awaiting the API key. Try the fictional sample to explore the workflow.',503,'KEY_MISSING');
 const url=new URL(path,BASE);for(const [k,v] of Object.entries(params))if(v!==''&&v!==undefined)url.searchParams.set(k,String(v));
 const started=Date.now(),signal=AbortSignal.timeout(timeoutMs);let status=null;
 const record=outcome=>{try{observe({event:'qloo_call',requestId:fetcher.requestId||null,endpoint:path,elapsedMs:Date.now()-started,status,outcome,take:Number(params.take)||null});}catch{}};
 try{
  const response=await fetcher(url,{headers:{'X-Api-Key':key,Accept:'application/json'},signal,redirect:'manual'});status=response.status;
  if(!response.ok){
   const code=status===429?'PROVIDER_RATE_LIMIT':status===401||status===403?'PROVIDER_AUTH':status===400?'PROVIDER_BAD_REQUEST':status>=500?'PROVIDER_5XX':'PROVIDER_HTTP';
   throw new GatherError(status===429?'Qloo is busy or the API quota was reached. Please wait before trying again.':status===401||status===403?'Qloo access was not accepted. The owner needs to check API access.':'Qloo returned an error. No substitute results were generated.',status===429?429:502,code);
  }
  let data;try{data=await response.json();}catch(error){if(signal.aborted||error?.name==='TimeoutError'||error?.name==='AbortError')throw error;throw new GatherError('Qloo returned an unreadable response.',502,'PROVIDER_RESPONSE');}
  record('OK');return data;
 }catch(error){
  let failure=error;
  if(!(error instanceof GatherError)){
   const timeout=signal.aborted||error?.name==='TimeoutError';const aborted=error?.name==='AbortError';
   failure=new GatherError(timeout?'Qloo took too long to respond. Please try again.':aborted?'The Qloo request was cancelled. Please try again.':'Qloo could not be reached. Please try again.',timeout?504:502,timeout?'UPSTREAM_TIMEOUT':aborted?'REQUEST_ABORTED':'NETWORK_FAILURE');
  }
  record(failure.code||'LIMITER_FAILURE');throw failure;
 }
}
export function discoveryTerms(query,type){
 const q=query.toLowerCase();const catalog=type==='place'?['Thai','Italian','Mexican','Japanese','Chinese','Indian']:type==='artist'?['Jazz','Rock','Pop','Classical','Hip Hop']:['Comedy','Adventure','Drama','Animation','Romance','Thriller','Horror','Science Fiction'];
 const aliases={funny:'Comedy',laugh:'Comedy',animated:'Animation','sci-fi':'Science Fiction'};
 const request=q.replace(/^(show me|find|i want|we want) /,'').replace(/ (for )?(tonight|this weekend|today)$/,'');const suffix=type==='place'?'food|restaurants|cuisine':type==='artist'?'music|artists':'movies|films|books';const match=request.match(new RegExp('^(.+) ('+suffix+')$'));const phrase=match?.[1]||'';const terms=catalog.filter(t=>phrase===t.toLowerCase());for(const [word,term] of Object.entries(aliases))if(phrase===word&&!terms.includes(term))terms.push(term);
 if(terms.length)return terms.slice(0,3);
 if(/^(movies?|films?|books?|music|artists?|food|restaurants?|places?|surprise me|surprise us|i don.t know)[.!? ]*$/.test(q))return catalog.slice(0,3);
 return [];
}
// Detect requests requiring live listings before a title lookup can mislead.
export function listingRequirement(query){
 const q=query.toLowerCase().trim();
 if(/\bhackathons?\b|\bnetworking events?\b|\bevents? (near|in|this|today|tonight)\b/.test(q))return 'Event discovery is not connected yet. Gather cannot yet retrieve or verify event options inside the app. No event recommendations were generated.';
 if(/\bnear me\b|\bnearby\b|\bshowtimes?\b|\bplaying (near|in|today|tonight)\b|^(find |show me )?(movies?|cinemas?|theaters?) in\b/.test(q))return 'Live nearby listings and movie showtimes are not connected yet. Gather cannot verify local screenings. For taste discovery, try “funny movies tonight”; confirm screenings with the theater.';
 return null;
}
export async function search(input,key,fetcher){
 const query=text(input.query,100);const requirement=listingRequirement(query);if(requirement)throw new GatherError(requirement,422);if(!TYPES.includes(input.type))throw new GatherError('Choose a supported interest type.');
 const terms=discoveryTerms(query,input.type);const deadline=AbortSignal.timeout(20000);const upstream=fetcher||fetch;const bounded=(url,options)=>upstream(url,{...options,signal:AbortSignal.any([options.signal,deadline])});
 bounded.requestId=upstream.requestId;
 if(terms.length){const options=[];for(const term of terms){if(deadline.aborted)throw new GatherError('Search timed out. Try a more specific interest.',504);const data=await qloo('/v2/tags',{'filter.query':term,take:20},key,bounded);if(!Array.isArray(data.results?.tags))throw new GatherError('Qloo returned an unexpected tag response.',502);for(const t of data.results.tags){if(typeof t.id==='string'&&typeof t.name==='string'&&t.type?.startsWith('urn:tag:genre:')&&t.parents?.some(p=>p.type==='urn:entity:'+input.type)&&!options.some(o=>o.id===t.id))options.push({id:t.id,name:t.name,type:'tag',description:'Explore '+t.name+' · '+(t.properties?.description||'Qloo cultural interest').slice(0,180)});}}return options.slice(0,5);}
 return rows(await qloo('/search',{query,types:'urn:entity:'+input.type,take:5},key,bounded),true);
}
export function validatePlan(input){
 if(!Array.isArray(input.members)||input.members.length<2||input.members.length>4)throw new GatherError('Add two to four people.');
 const members=input.members.map((m,i)=>{
 const raw=m.interests===undefined?[m]:m.interests;
 if(!Array.isArray(raw)||raw.length<1||raw.length>3)throw new GatherError('Choose one to three interests per person.');
 const interests=raw.map(v=>({id:text(v.id,100),name:text(v.name,160),kind:v.kind==='tag'?'tag':'entity'}));
 if(new Set(interests.map(v=>v.kind+':'+v.id)).size!==interests.length)throw new GatherError('Choose different interests.');
 return {label:'Person '+(i+1),...interests[0],interests};
 });
 if(!['place','movie','artist'].includes(input.category))throw new GatherError('Choose dining, a movie, or music.');
 const location=input.category==='place'?text(input.location,100):'';
 const excluded=Array.isArray(input.excluded)?input.excluded:[];if(excluded.length>30||excluded.some(id=>typeof id!=='string'||id.length>100))throw new GatherError('Too many excluded options. Start a new plan.');
 const candidateIds=input.candidateIds===undefined?[]:input.candidateIds;
 if(!Array.isArray(candidateIds)||candidateIds.length>3||candidateIds.some(id=>typeof id!=='string'||!id.trim()||id.length>100)||new Set(candidateIds).size!==candidateIds.length)throw new GatherError('Choose up to three distinct candidate entities.');
 return {members,category:input.category,location,excluded,candidateIds};
}
// Compare rank positions within each person's list. These are not probabilities.
export function rankGroup(lists,members,excluded=[]){
 const picks=new Map();lists.forEach((list,person)=>list.forEach((item,index)=>{
 if(excluded.includes(item.id)||picks.has(item.id)&&picks.get(item.id).ranks[person]!==null)return;
 if(!picks.has(item.id))picks.set(item.id,{...item,ranks:members.map(()=>null)});
 picks.get(item.id).ranks[person]=index+1;
 }));
 return [...picks.values()].map(item=>{const support=item.ranks.filter(Boolean).length;const worst=Math.max(...item.ranks.map(r=>r??1000));const mean=item.ranks.reduce((sum,r)=>sum+(r??1000),0)/members.length;return {...item,support,worst,mean};})
 .sort((a,b)=>b.support-a.support||a.worst-b.worst||a.mean-b.mean||a.id.localeCompare(b.id)).slice(0,4);
}
export async function plan(input,key,fetcher,{timeoutMs=55000}={}){
 const {members,category,location,excluded,candidateIds}=validatePlan(input);const started=Date.now();let lists=[];const trace=[];
 const deadline=AbortSignal.timeout(timeoutMs);
 const upstream=fetcher||fetch;
 const boundedFetch=(url,options)=>upstream(url,{...options,signal:AbortSignal.any([options.signal,deadline])});
 boundedFetch.requestId=upstream.requestId;
 async function retrieve(depth){
  const resolved=new Map(),jobs=new Map();
  const interestKey=i=>i.kind+':'+i.id;
  for(const member of members)for(const interest of member.interests){const k=interestKey(interest);if(!jobs.has(k))jobs.set(k,{interest,member});}
  const queue=[...jobs.entries()];let cursor=0,failure=null;
  async function worker(){
   while(!failure&&cursor<queue.length){
    const [cacheKey,{interest,member}]=queue[cursor++];const t=Date.now();
    try{
     if(deadline.aborted)throw new GatherError('Planning timed out. Try fewer interests.',504,'PLAN_TIMEOUT');
     const data=await qloo('/v2/insights',{'filter.type':'urn:entity:'+category,[interest.kind==='tag'?'signal.interests.tags':'signal.interests.entities']:interest.id,'filter.location.query':location,'filter.exclude.entities':excluded.join(','),'filter.results.entities':candidateIds.length?candidateIds.join(','):undefined,take:depth},key,boundedFetch);
     const list=rows(data).filter(item=>!candidateIds.length||candidateIds.includes(item.id)).slice(0,depth);resolved.set(cacheKey,list);
     trace.push({step:'Taste lookup: '+interest.name,person:member.label,endpoint:'/v2/insights',count:list.length,ms:Date.now()-t});
    }catch(error){failure??=deadline.aborted?new GatherError('Planning timed out. Try fewer interests.',504,'PLAN_TIMEOUT'):error;}
   }
  }
  await Promise.allSettled(Array.from({length:Math.min(2,queue.length)},()=>worker()));
  if(failure)throw failure; // Never silently discard a person's failed interest.
  const used=new Set();return members.map(member=>{
   // Canonical order prevents selection order or network completion affecting ranking.
   const individual=[...member.interests].sort((a,b)=>interestKey(a).localeCompare(interestKey(b))).map(interest=>{
    const k=interestKey(interest),list=resolved.get(k);
    if(used.has(k))trace.push({step:'Reuse identical interest within this plan',person:member.label,endpoint:'Local reuse',count:list.length,ms:0});
    used.add(k);return list;
   });
   const combined=[],seen=new Set();
   for(let rank=0;rank<depth;rank++)for(const list of individual){const item=list[rank];if(item&&!seen.has(item.id)){seen.add(item.id);combined.push(item);}}
   return combined.slice(0,depth);
  });
 }
 lists=await retrieve(12);let depth=12;let picks=rankGroup(lists,members,excluded);
 if(!candidateIds.length&&lists.some(list=>list.length)&&!picks.some(p=>p.support===members.length)){
  trace.push({step:'No shared candidate in top 12; widen once to 24 without changing interests, location or vetoes',endpoint:'Decision policy',count:0,ms:0});
  depth=24;lists=await retrieve(depth);picks=rankGroup(lists,members,excluded);
 }
 return {mode:'live',members,picks,trace,depth,elapsedMs:Date.now()-started,category,location,excluded,shared:picks.some(p=>p.support===members.length)};
}
export function sample(input={}){
 const members=[{label:'Person 1',id:'fictional-seed-a',name:'Fictional jazz artist'},{label:'Person 2',id:'fictional-seed-b',name:'Fictional adventure film'}];
 const items=[{id:'fictional-place-a',name:'The Lantern Table',type:'place',description:'Fictional venue created to demonstrate the decision workflow.',address:'Fictional location',tags:['Sample only']},{id:'fictional-place-b',name:'Juniper Social',type:'place',description:'Fictional venue; this is not a Qloo recommendation.',address:'Fictional location',tags:['Sample only']},{id:'fictional-place-c',name:'Ember Courtyard',type:'place',description:'Fictional venue created for interface testing.',address:'Fictional location',tags:['Sample only']},{id:'fictional-place-d',name:'Moonlight Cafe',type:'place',description:'Fictional venue created for interface testing.',address:'Fictional location',tags:['Sample only']}];
 const excluded=Array.isArray(input.excluded)?input.excluded:[];const picks=rankGroup([items,[items[1],items[0],items[3],items[2]]],members,excluded);
 return {mode:'sample',members,picks,category:'place',location:'Sample city',excluded,shared:picks.length>0,elapsedMs:0,trace:[{step:'Fictional fixture loaded',endpoint:'No Qloo calls',count:4,ms:0}]};
}
