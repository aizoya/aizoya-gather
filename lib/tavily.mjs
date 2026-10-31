import {GatherError} from './gather.mjs';
const endpoint='https://api.tavily.com';
function safeUrl(value){try{const u=new URL(value);return u.protocol==='https:'&&!u.username&&!u.password?u.href:null;}catch{return null;}}
export function sourceFailure(status){
 if(status===432)return new GatherError('Tavily source retrieval reached a key or plan usage limit. The owner needs to review the Tavily key limit.',429,'SEARCH_USAGE_LIMIT');
 if(status===433)return new GatherError('Tavily source retrieval reached its paid usage limit. No additional requests were made.',429,'SEARCH_SPENDING_LIMIT');
 if(status===429)return new GatherError('Tavily is rate limiting source retrieval. Please wait before trying again.',429,'SEARCH_RATE_LIMIT');
 if(status===401||status===403)return new GatherError('Tavily did not accept server access. The owner needs to check the connection.',503,'SEARCH_AUTH');
 if(status===400||status===422)return new GatherError('Tavily rejected the source request. No substitute recommendations were generated.',502,'SEARCH_BAD_REQUEST');
 if(status===434||status>=500)return new GatherError('Tavily source retrieval is temporarily unavailable. Please try later.',503,'SEARCH_UNAVAILABLE');
 return new GatherError('Tavily source retrieval failed. No substitute recommendations were generated.',502,'SEARCH_HTTP');
}
async function call(path,payload,key,fetcher,signal){
 const started=Date.now();let status=null;
 const log=outcome=>console.info(JSON.stringify({event:'tavily_call',endpoint:path,status,outcome,elapsedMs:Date.now()-started}));
 try{
  const response=await fetcher(endpoint+path,{method:'POST',headers:{Authorization:'Bearer '+key,'Content-Type':'application/json'},signal,body:JSON.stringify(payload)});status=response.status;
  if(!response.ok)throw sourceFailure(status);
  let data;try{data=await response.json();}catch(error){if(signal?.aborted||error?.name==='TimeoutError'||error?.name==='AbortError')throw error;throw new GatherError('Tavily returned an unreadable source response.',502,'SEARCH_RESPONSE');}
  log('OK');return data;
 }catch(error){
  const failure=error instanceof GatherError?error:signal?.aborted||error?.name==='TimeoutError'||error?.name==='AbortError'?new GatherError('Source retrieval timed out. No substitute recommendations were generated.',504,'SEARCH_TIMEOUT'):new GatherError('Tavily could not be reached. Please try later.',502,'SEARCH_NETWORK');
  log(failure.code);throw failure;
 }
}
// Retrieval evidence only. These pages do not prove dates, prices or availability.
export async function retrieveSources(query,key,fetcher=fetch,signal=AbortSignal.timeout(12000)){
 if(!key)throw new GatherError('Tavily source retrieval is awaiting a secure server connection.',503,'SEARCH_KEY_MISSING');
 if(typeof query!=='string'||!query.trim()||query.length>1000)throw new GatherError('Keep the search request under 1,000 characters.');
 const search=await call('/search',{query,search_depth:'basic',max_results:3,include_answer:false,include_raw_content:false,include_usage:true},key,fetcher,signal);
 const urls=[...new Set((search.results||[]).map(r=>safeUrl(r.url)).filter(Boolean))].slice(0,3);
 if(!urls.length)return {sources:[],checkedAt:new Date().toISOString()};
 const extracted=await call('/extract',{urls,extract_depth:'basic',format:'text',include_usage:true},key,fetcher,signal);
 const sources=(extracted.results||[]).flatMap(r=>{
 const url=safeUrl(r.url);if(!url||!urls.includes(url)||typeof r.raw_content!=='string'||!r.raw_content.trim())return [];
 const original=search.results.find(s=>safeUrl(s.url)===url);
 return [{url,title:typeof original?.title==='string'?original.title.slice(0,300):new URL(url).hostname,content:r.raw_content.slice(0,12000)}];
 });
 return {sources,checkedAt:new Date().toISOString()};
}
