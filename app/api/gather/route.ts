import { env } from 'cloudflare:workers';
import { budgetedFetch } from '../../../lib/budget.mjs';
import { search, plan, sample, GatherError } from '../../../lib/gather.mjs';
export const dynamic = 'force-dynamic';
const headers={'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'};
export async function GET(){return Response.json({liveConfigured:!!(env as unknown as Record<string,string>).QLOO_API_KEY},{headers});}
export async function POST(request:Request){
 try{
  if(request.headers.get('origin')!==new URL(request.url).origin)return Response.json({error:'Origin rejected.'},{status:403,headers});
  if(!request.headers.get('content-type')?.includes('application/json'))return Response.json({error:'JSON required.'},{status:415,headers});
  if(Number(request.headers.get('content-length')||0)>10000)return Response.json({error:'Request too large.'},{status:413,headers});
  const raw=await request.text();if(raw.length>10000)return Response.json({error:'Request too large.'},{status:413,headers});
  const input=JSON.parse(raw);const key=(env as unknown as Record<string,string>).QLOO_API_KEY;
  if(input.action==='sample')return Response.json(sample(input),{headers});
  if(!key)throw new GatherError('Live Qloo access is awaiting the API key. Try the fictional sample to explore the workflow.',503);
  const fetcher=budgetedFetch(env.DB);
  if(input.action==='search')return Response.json({mode:'live',entities:await search(input,key,fetcher)},{headers});
  if(input.action==='plan')return Response.json(await plan(input,key,fetcher),{headers});
  return Response.json({error:'Unknown action.'},{status:400,headers});
 }catch(error){const e=error as Error & {status?:number};return Response.json({error:e instanceof GatherError?e.message:'The request could not be processed.'},{status:e instanceof GatherError?e.status:400,headers});}
}
