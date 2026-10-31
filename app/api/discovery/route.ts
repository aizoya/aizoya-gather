import {env} from 'cloudflare:workers';
import {reserveDiscovery} from '../../../lib/discovery-budget.mjs';
import {conversation} from '../../../lib/discovery.mjs';
import {groundedDiscover} from '../../../lib/grounded-discovery.mjs';
import {issueDiscoveryInvitation} from '../../../lib/discovery-invitation.mjs';
import {GatherError} from '../../../lib/gather.mjs';
export const dynamic='force-dynamic';
const headers={'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'};
export async function POST(request:Request){try{
 if(request.headers.get('origin')!==new URL(request.url).origin)return Response.json({error:'Origin rejected.'},{status:403,headers});
 if(!request.headers.get('content-type')?.includes('application/json'))throw new GatherError('JSON required.',415);
 const raw=await request.text();if(raw.length>15000)throw new GatherError('Request too large.',413);
 const input=JSON.parse(raw);const messages=conversation(input.messages);
 const key=(env as unknown as Record<string,string>).OPENAI_API_KEY;if(!key)throw new GatherError('Conversational discovery is awaiting server activation.',503);
 const tavilyKey=(env as unknown as Record<string,string>).TAVILY_API_KEY;if(!tavilyKey)throw new GatherError('Live source retrieval is awaiting server activation.',503);
 await reserveDiscovery(env.DB);
 const result=await groundedDiscover(messages,key,tavilyKey);
 const invitation=await issueDiscoveryInvitation(result,key);
 return Response.json({...result,invitation},{headers});
 }catch(e){return Response.json({error:e instanceof GatherError?e.message:'Discovery could not be completed. Please try again.',code:e instanceof GatherError?e.code:'DISCOVERY_FAILED'},{status:e instanceof GatherError?e.status:502,headers});}}
