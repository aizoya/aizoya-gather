// Dependency-free Qloo adapter and deterministic group decision policy.
export const BASE = 'https://hackathon.api.qloo.com';
export const TYPES = ['artist','movie','book','place'];
export class GatherError extends Error { constructor(message,status=400){ super(message);this.status=status; } }
export function text(value,max=100){ if(typeof value!=='string'||!value.trim()||value.length>max||/[\u0000-\u001f]/.test(value)) throw new GatherError('Enter a valid value.');return value.trim(); }
export function entity(row){
 if(!row||typeof row.entity_id!=='string'||typeof row.name!=='string')return null;
 return {id:row.entity_id,name:row.name,type:row.subtype||row.type||'entity',description:typeof row.properties?.short_description==='string'?row.properties.short_description.slice(0,350):'',address:typeof row.properties?.address==='string'?row.properties.address:'',tags:Array.isArray(row.tags)?row.tags.filter(t=>t&&typeof t.name==='string').slice(0,4).map(t=>t.name):[]};
}
export function rows(data,search=false){ const list=search?data.results:data.results?.entities; if(!Array.isArray(list))throw new GatherError('Qloo returned an unexpected response. No recommendations were generated.',502);return list.map(entity).filter(Boolean); }
export async function qloo(path,params,key,fetcher=fetch){
 if(!key)throw new GatherError('Live Qloo access is awaiting the API key. Try the fictional sample to explore the workflow.',503);
 const url=new URL(path,BASE);for(const [k,v] of Object.entries(params))if(v!==''&&v!==undefined)url.searchParams.set(k,String(v));
 let response;try{response=await fetcher(url,{headers:{'X-Api-Key':key,Accept:'application/json'},signal:AbortSignal.timeout(12000),redirect:'error'});}catch(error){if(error instanceof GatherError)throw error;throw new GatherError('Qloo could not be reached. Please try again.',502);}
 if(!response.ok)throw new GatherError(response.status===429?'Qloo is busy or the API quota was reached. Please wait before trying again.':response.status===401||response.status===403?'Qloo access was not accepted. The owner needs to check API access.':'Qloo returned an error. No substitute results were generated.',response.status===429?429:502);
 try{return await response.json();}catch{throw new GatherError('Qloo returned an unreadable response.',502);}
}
export async function search(input,key,fetcher){const query=text(input.query,100);if(!TYPES.includes(input.type))throw new GatherError('Choose a supported interest type.');return rows(await qloo('/search',{query,types:'urn:entity:'+input.type,take:5},key,fetcher),true);}
export function validatePlan(input){
 if(!Array.isArray(input.members)||input.members.length<2||input.members.length>3)throw new GatherError('Add two or three people.');
 const members=input.members.map((m,i)=>({label:'Person '+(i+1),id:text(m.id,100),name:text(m.name,160)}));
 if(!['place','movie','artist'].includes(input.category))throw new GatherError('Choose dining, a movie, or music.');
 const location=input.category==='place'?text(input.location,100):'';
 const excluded=Array.isArray(input.excluded)?input.excluded:[];if(excluded.length>30||excluded.some(id=>typeof id!=='string'||id.length>100))throw new GatherError('Too many excluded options. Start a new plan.');
 return {members,category:input.category,location,excluded};
}
// Compare rank positions within each person's list. These are not probabilities.
export function rankGroup(lists,members,excluded=[]){
 const picks=new Map();lists.forEach((list,person)=>list.forEach((item,index)=>{
 if(excluded.includes(item.id)||picks.has(item.id)&&picks.get(item.id).ranks[person]!==null)return;
 if(!picks.has(item.id))picks.set(item.id,{...item,ranks:members.map(()=>null)});
 picks.get(item.id).ranks[person]=index+1;
 }));
 return [...picks.values()].map(item=>{const support=item.ranks.filter(Boolean).length;const worst=Math.max(...item.ranks.map(r=>r??1000));const mean=item.ranks.reduce((sum,r)=>sum+(r??1000),0)/members.length;return {...item,support,worst,mean};})
 .sort((a,b)=>b.support-a.support||a.worst-b.worst||a.mean-b.mean||a.id.localeCompare(b.id)).slice(0,3);
}
export async function plan(input,key,fetcher,{timeoutMs=25000}={}){
 const {members,category,location,excluded}=validatePlan(input);const started=Date.now();let lists=[];const trace=[];
 const deadline=AbortSignal.timeout(timeoutMs);
 const upstream=fetcher||fetch;
 const boundedFetch=(url,options)=>upstream(url,{...options,signal:AbortSignal.any([options.signal,deadline])});
 async function retrieve(depth){
  const next=[];
  for(const member of members){
   if(deadline.aborted)throw new GatherError('Planning timed out. Please try again with fewer people.',504);
   const t=Date.now();let data;try{data=await qloo('/v2/insights',{'filter.type':'urn:entity:'+category,'signal.interests.entities':member.id,'filter.location.query':location,'filter.exclude.entities':excluded.join(','),take:depth},key,boundedFetch);}catch(error){if(deadline.aborted)throw new GatherError('Planning timed out. Please try again with fewer people.',504);throw error;}
   const list=rows(data).slice(0,depth);next.push(list);trace.push({step:depth===12?'Taste lookup':'Bounded overlap recovery',person:member.label,endpoint:'/v2/insights',count:list.length,ms:Date.now()-t});
  }
  return next;
 }
 lists=await retrieve(12);let depth=12;let picks=rankGroup(lists,members,excluded);
 if(lists.some(list=>list.length)&&!picks.some(p=>p.support===members.length)){
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
