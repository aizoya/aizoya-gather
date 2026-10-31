import {GatherError,text} from './gather.mjs';
export function roomDetails(input){
 const title=text(input.title,80),date=text(input.date,10);
 if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||new Date(date+'T12:00:00Z').toISOString().slice(0,10)!==date)throw new GatherError('Choose a valid date.');
 const days=(Date.parse(date+'T12:00:00Z')-Date.now())/86400000;
 if(days< -1||days>31)throw new GatherError('Choose a date within the next 30 days.');
 return {title,date};
}
export function ballot(value,picks){
 if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).length!==picks.length)throw new GatherError('Vote on every option.');
 const out={};for(const p of picks){if(![-1,0,1].includes(value[p.id]))throw new GatherError('Choose Love it, Maybe, or Pass for each option.');out[p.id]=value[p.id];}return out;
}
export function agreement(picks,votes,expected){
 if(votes.length!==expected)return {complete:false,choices:[]};
 const choices=picks.map(p=>({...p,total:votes.reduce((n,v)=>n+v[p.id],0),accepted:votes.every(v=>v[p.id]>=0)})).filter(p=>p.accepted).sort((a,b)=>b.total-a.total||picks.findIndex(p=>p.id===a.id)-picks.findIndex(p=>p.id===b.id));
 return {complete:true,choices};
}
export async function digest(value){return [...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value)))].map(b=>b.toString(16).padStart(2,'0')).join('');}
export function secret(){return crypto.randomUUID().replaceAll('-','')+crypto.randomUUID().replaceAll('-','');}
export function makeCalendar(p,room,now=new Date()){
 const day=room.date.replaceAll('-','');const end=new Date(room.date+'T12:00:00Z');end.setUTCDate(end.getUTCDate()+1);
 const escape=s=>s.replace(/\\/g,'\\\\').replace(/\r?\n/g,'\\n').replace(/[,;]/g,m=>'\\'+m);
 return ['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//AIZOYA//Gather//EN','BEGIN:VEVENT','UID:'+crypto.randomUUID()+'@gather.aizoya.com','DTSTAMP:'+now.toISOString().replace(/[-:]/g,'').replace(/\.\d{3}/,''),'DTSTART;VALUE=DATE:'+day,'DTEND;VALUE=DATE:'+end.toISOString().slice(0,10).replaceAll('-',''),'SUMMARY:'+escape(p.name),'LOCATION:'+escape(room.location),'DESCRIPTION:Gather group choice. Confirm details before booking.','END:VEVENT','END:VCALENDAR',''].join('\r\n');
}
