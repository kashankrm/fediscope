import dns from 'node:dns/promises';
import ipaddr from 'ipaddr.js';
import { Agent, fetch } from 'undici';
export function publicIP(address:string) { try { const ip=ipaddr.process(address); return ip.range()==='unicast'; } catch { return false; } }
export function safeURL(value:string) { const u=new URL(value); if(!['http:','https:'].includes(u.protocol)||u.username||u.password||(!['','80','443'].includes(u.port))) throw Error('Use a public HTTP or HTTPS URL on a standard port.'); if(u.hostname==='localhost'||u.hostname.endsWith('.localhost')) throw Error('Private network addresses are not allowed.'); return u; }
export async function validateURL(value:string) {const u=safeURL(value);const addresses=await dns.lookup(u.hostname.replace(/^\[|\]$/g,''),{all:true});if(!addresses.length||addresses.some(a=>!publicIP(a.address)))throw Error('Private network addresses are not allowed.');return {u,addresses};}
const cache=new Map<string,{at:number,data:string}>();const hosts=new Map<string,number>();
export async function remote(value:string,redirects=0):Promise<string>{
 const hit=cache.get(value);if(hit&&Date.now()-hit.at<60000)return hit.data;
 const {u,addresses}=await validateURL(value);if(redirects>4)throw Error('Too many redirects');
 const wait=Math.max(0,(hosts.get(u.host)||0)-Date.now());hosts.set(u.host,Date.now()+wait+500);if(wait>5000)throw Error('Source is busy. Try again shortly.');if(wait)await new Promise(r=>setTimeout(r,wait));
 const agent=new Agent({connect:{lookup:((_h:any,_o:any,cb:any)=>{if(_o.all)cb(null,addresses);else cb(null,addresses[0].address,addresses[0].family);}) as any}});
 try {const r=await fetch(u,{dispatcher:agent,redirect:'manual',signal:AbortSignal.timeout(12000),headers:{'user-agent':'FediScope/1.0 (personal public-source reader)','accept':'application/json, application/atom+xml, application/rss+xml, text/xml'}});
 if(r.status>=300&&r.status<400){const next=r.headers.get('location');if(!next)throw Error('Invalid redirect');await r.body?.cancel();return remote(new URL(next,u).href,redirects+1);}
 if(!r.ok)throw Error(r.status===401||r.status===403||r.status===422?'Public access is restricted by this server.':r.status===429?'Source rate limit reached. Try again later.':`Source returned HTTP ${r.status}`);
 let size=0;const chunks:Uint8Array[]=[];for await(const chunk of r.body!){size+=chunk.length;if(size>3_000_000)throw Error('Source response exceeds 3 MB limit');chunks.push(chunk);}const data=Buffer.concat(chunks).toString('utf8');cache.set(value,{at:Date.now(),data});if(cache.size>200)cache.delete(cache.keys().next().value!);return data;
 }finally{await agent.close();}
}
