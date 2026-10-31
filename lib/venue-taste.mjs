import {qloo,plan} from './gather.mjs';
const normalize=value=>typeof value==='string'?value.normalize('NFKD').replace(/\p{M}/gu,'').toLowerCase().replace(/[^a-z0-9]/g,''):'';
export function verifiedVenue(item,content,eventName){
 const clean=value=>typeof value==='string'?value.replace(/\s+/g,' ').trim():'';
 const fromFields=(name,address,quote)=>name&&name.length<=160&&address&&address.length<=200&&/^\d/.test(address)&&quote.length<=500&&quote.includes(eventName)&&quote.includes(name)&&quote.includes(address)&&content.includes(quote)?{name,address,quote}:null;
 const provided=fromFields(clean(item.venueName),clean(item.venueAddress),clean(item.venueQuote));if(provided)return provided;
 // Supported source layout: EVENT at VENUE (TIME) STREET ADDRESS, CITY.
 // Parse only a previously sourced quote; never complete an address from a model guess.
 const quote=clean(item.dateQuote);if(!quote.includes(eventName)||!content.includes(quote))return null;
 const parts=quote.match(/\bat (.{2,160}?)\s+\([^)]{1,40}\)\s+(\d[^\n]{4,199})$/);
 return parts?fromFields(parts[1].trim(),parts[2].trim(),quote):null;
}
export function matchVenue(venue,city,entities){
 if(!venue)return null;const place=normalize(city.split(',')[0]);const name=normalize(venue.name),address=normalize(venue.address);
 if(!place||!address.includes(place)||!/^\d+[a-z]{2,}/.test(address.slice(0,address.indexOf(place))))return null;
 const matches=entities.filter(e=>typeof e.entity_id==='string'&&normalize(e.name)===name&&normalize(e.properties?.address).includes(place)&&normalize(e.properties?.address).startsWith(address));
 return matches.length===1?matches[0].entity_id:null;
}
export async function applyVenueTaste(result,preferences,key,fetcher=fetch,{timeoutMs=12000}={}){
 const candidates=result.candidates||[];
 if(!key||!candidates.length||preferences.some(p=>!p.interests?.length))return {...result,venueTasteStatus:'not_requested'};
 if(timeoutMs<1000)return {...result,venueTasteStatus:'unavailable'};
 const started=Date.now();const deadline=AbortSignal.timeout(timeoutMs);const bounded=(url,options)=>fetcher(url,{...options,signal:AbortSignal.any([options.signal,deadline])});
 bounded.requestId=fetcher.requestId;
 try{
  const resolved=new Map();
  // Sequential resolution respects the common limiter; there are at most three venues.
  for(const c of candidates){if(!c.venue)continue;const cacheKey=c.venue.name+'\n'+c.venue.address;if(resolved.has(cacheKey))continue;
   const data=await qloo('/search',{query:c.venue.name,types:'urn:entity:place',take:5},key,bounded);
   resolved.set(cacheKey,matchVenue(c.venue,result.city,Array.isArray(data.results)?data.results:[]));
  }
  const ids=[...new Set([...resolved.values()].filter(Boolean))];
  if(!ids.length)return {...result,venueTasteStatus:'no_verified_venue_match'};
  const remaining=timeoutMs-(Date.now()-started);
  if(remaining<1000)throw Error('Venue taste budget exhausted');
  const ranking=await plan({category:'place',location:result.city,candidateIds:ids,members:preferences.map(p=>({interests:p.interests}))},key,bounded,{timeoutMs:remaining});
  const rankMap=new Map(ranking.picks.map(p=>[p.id,p]));
  const enriched=candidates.map((c,index)=>{const id=c.venue?resolved.get(c.venue.name+'\n'+c.venue.address):null;const evidence=rankMap.get(id);return {...c,_order:index,venueTaste:evidence?{entityId:id,ranks:evidence.ranks,support:evidence.support,participants:preferences.length,worst:evidence.worst,mean:evidence.mean}:null};});
  enriched.sort((a,b)=>(b.venueTaste?.support||0)-(a.venueTaste?.support||0)||(a.venueTaste?.worst??1000)-(b.venueTaste?.worst??1000)||(a.venueTaste?.mean??1000)-(b.venueTaste?.mean??1000)||a._order-b._order);
  return {...result,candidates:enriched.map(({_order,...c})=>c),venueTasteStatus:'checked'};
 }catch{return {...result,venueTasteStatus:'unavailable'};}
}
