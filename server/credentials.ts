import {createCipheriv,createDecipheriv,randomBytes,timingSafeEqual} from 'node:crypto';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {join} from 'node:path';

export function accessAllowed(expected:string|undefined,provided:string|undefined) {
 if(!expected)return true;
 const a=Buffer.from(expected),b=Buffer.from(provided||'');
 return a.length===b.length&&timingSafeEqual(a,b);
}

export function credentialInput(platform:string,url:string,token:unknown,feed:unknown='public',protectedWorkspace=false) {
 if(!['public','home','subscribed'].includes(String(feed)))throw Error('Choose a supported feed.');
 if(feed==='home'&&!['Mastodon','Pixelfed'].includes(platform))throw Error('Home feeds require Mastodon or compatible Pixelfed.');
 if(feed==='subscribed'&&platform!=='Lemmy')throw Error('Subscribed feeds require Lemmy.');
 if(token!==undefined&&typeof token!=='string')throw Error('Access token must be text.');
 const value=typeof token==='string'?token.trim():'';
 if(value){
  if(!protectedWorkspace)throw Error('Configure FEDISCOPE_ACCESS_KEY before connecting accounts.');
  if(!['Mastodon','Pixelfed','Lemmy'].includes(platform))throw Error('Account connections are supported for Mastodon, Pixelfed and Lemmy.');
  if(new URL(url).protocol!=='https:')throw Error('Account connections require HTTPS.');
  if(!/^[A-Za-z0-9._~+\/=-]{1,8192}$/.test(value))throw Error('Invalid access token format.');
 }
 if(feed!=='public'&&!value)throw Error('This feed requires an access token.');
 return {token:value,feed:feed as 'public'|'home'|'subscribed'};
}

export function credentialVault(directory:string) {
 mkdirSync(directory,{recursive:true,mode:0o700});
 const path=join(directory,'credentials.key');
 let key:Buffer;
 try{key=readFileSync(path);}catch(e:any){if(e.code!=='ENOENT')throw e;key=randomBytes(32);writeFileSync(path,key,{mode:0o600,flag:'wx'});}
 if(key.length!==32)throw Error('Invalid credential encryption key.');
 return {
  seal(token:string){const iv=randomBytes(12);const cipher=createCipheriv('aes-256-gcm',key,iv);const encrypted=Buffer.concat([cipher.update(token,'utf8'),cipher.final()]);return Buffer.concat([iv,cipher.getAuthTag(),encrypted]).toString('base64');},
  open(value:string){const data=Buffer.from(value,'base64');const cipher=createDecipheriv('aes-256-gcm',key,data.subarray(0,12));cipher.setAuthTag(data.subarray(12,28));return Buffer.concat([cipher.update(data.subarray(28)),cipher.final()]).toString('utf8');}
 };
}
