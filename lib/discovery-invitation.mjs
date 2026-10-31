import {GatherError} from './gather.mjs';
import {digest} from './rooms.mjs';
const encoder=new TextEncoder();
const encode=bytes=>btoa(String.fromCharCode(...bytes)).replaceAll('+','-').replaceAll('/','_').replace(/=+$/,'');
const decode=value=>Uint8Array.from(atob(value.replaceAll('-','+').replaceAll('_','/')+'='.repeat((4-value.length%4)%4)),c=>c.charCodeAt(0));
async function signingKey(secret){if(!secret)throw new GatherError('Invitation signing is unavailable.',503);return crypto.subtle.importKey('raw',encoder.encode('gather-event-invitation-v1:'+secret),{name:'HMAC',hash:'SHA-256'},false,['sign','verify']);}
export async function issueDiscoveryInvitation(result,secret,now=Date.now()){
 if(!result.candidates?.length)return null;
 const picks=await Promise.all(result.candidates.map(async c=>({id:await digest(c.url+'\n'+c.name),name:c.name,address:c.venue?.address||'',venueQuote:c.venue?.quote||null,venueTaste:c.venueTaste||null,sourceUrl:c.url,dateQuote:c.dateQuote,price:c.price,checkedAt:result.checkedAt})));
 // Intentionally exclude the raw conversation, search query and personal budget.
 const payload=encode(encoder.encode(JSON.stringify({v:1,expires:now+30*60000,date:result.candidates[0].eventDate,location:result.city,picks})));
 const signature=await crypto.subtle.sign('HMAC',await signingKey(secret),encoder.encode(payload));
 return payload+'.'+encode(new Uint8Array(signature));
}
export async function readDiscoveryInvitation(receipt,secret,now=Date.now()){
 try{
 if(typeof receipt!=='string'||receipt.length>7000||!/^[-_A-Za-z0-9]+\.[-_A-Za-z0-9]+$/.test(receipt))throw Error();
 const [payload,signature]=receipt.split('.');
 if(!await crypto.subtle.verify('HMAC',await signingKey(secret),decode(signature),encoder.encode(payload)))throw Error();
 const data=JSON.parse(new TextDecoder().decode(decode(payload)));
 if(data.v!==1||!Number.isFinite(data.expires)||data.expires<=now||data.expires>now+30*60000||!Array.isArray(data.picks)||!data.picks.length||data.picks.length>3||typeof data.location!=='string'||!data.location.trim())throw Error();
 return data;
 }catch{throw new GatherError('This discovery invitation expired or changed. Please search again.',400,'INVITATION_INVALID');}
}
