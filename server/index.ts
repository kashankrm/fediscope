import express from 'express';
import {loadEnvFile} from 'node:process';
try{loadEnvFile();}catch(e:any){if(e.code!=='ENOENT')throw e;}
import Database from 'better-sqlite3';
import {randomUUID} from 'node:crypto';
import {mkdirSync} from 'node:fs';
import {createServer as createViteServer} from 'vite';
import {load,merge,type Source,type Item} from './adapters';
import {validateURL} from './safety';
import {accessAllowed,credentialInput,credentialVault} from './credentials';
const dataDir=process.env.FEDISCOPE_DATA_DIR||'data';
mkdirSync(dataDir,{recursive:true,mode:0o700});const db=new Database(`${dataDir}/fediscope.db`);db.pragma('journal_mode = WAL');db.exec('CREATE TABLE IF NOT EXISTS state (id TEXT PRIMARY KEY, value TEXT NOT NULL)');
const read=(id:string,fallback:any)=>{const row=db.prepare('SELECT value FROM state WHERE id=?').get(id) as any;return row?JSON.parse(row.value):fallback;};const write=(id:string,value:any)=>db.prepare('INSERT OR REPLACE INTO state VALUES (?,?)').run(id,JSON.stringify(value));
db.exec('CREATE TABLE IF NOT EXISTS credentials (source_id TEXT PRIMARY KEY, encrypted TEXT NOT NULL)');
const accessKey=process.env.FEDISCOPE_ACCESS_KEY;
if(accessKey&&accessKey.length<32)throw Error('FEDISCOPE_ACCESS_KEY must contain at least 32 characters.');
if(!accessKey&&(db.prepare('SELECT COUNT(*) AS n FROM credentials').get() as any).n)throw Error('FEDISCOPE_ACCESS_KEY is required while connected accounts exist.');
const vault=accessKey?credentialVault(dataDir):null;
const tokenFor=(id:string)=>{const row=db.prepare('SELECT encrypted FROM credentials WHERE source_id=?').get(id) as any;return row&&vault?vault.open(row.encrypted):undefined;};
const saveToken=(id:string,token:string)=>{if(token&&vault)db.prepare('INSERT OR REPLACE INTO credentials VALUES (?,?)').run(id,vault.seal(token));else db.prepare('DELETE FROM credentials WHERE source_id=?').run(id);};
const app=express();
app.use('/api',(req,res,next)=>{
 res.setHeader('Cache-Control','no-store');
 if(req.path==='/health')return next();
 if(!accessAllowed(accessKey,req.headers['x-fediscope-key'] as string|undefined))return res.status(401).json({error:'Unlock this workspace with its access key.'});
 next();
});app.use(express.json({limit:'64kb'}));app.use('/api',(req,res,next)=>{if(req.method!=='GET'&&req.headers.origin&&req.headers.origin!==`${req.protocol}://${req.headers.host}`)return res.status(403).json({error:'Origin is not allowed'});next();});
app.get('/api/health',(_,res)=>res.json({ok:true}));app.get('/api/state',(_,res)=>res.json({accountsEnabled:!!accessKey,sources:read('sources',[]),items:read('items',[]),saved:read('saved',[]),preferences:read('preferences',{})}));
app.post('/api/sources',async(req,res)=>{try{
 const {url,platform,accountLabel}=req.body;
 if(!['Mastodon','Pixelfed','PeerTube','Lemmy','RSS / Atom'].includes(platform))throw Error('Choose a supported platform');
 const {u}=await validateURL(url);u.hash='';
 if(platform!=='RSS / Atom'){u.pathname='/';u.search='';}
 const {token,feed}=credentialInput(platform,u.href,req.body.token,req.body.feed||'public',!!accessKey);
 const label=String(accountLabel||'').trim().slice(0,80);
 if(token&&!label)throw Error('Give this account a label to distinguish it from other accounts.');
 const sources:Source[]=read('sources',[]);
 if(sources.length>=24)throw Error('Limit of 24 sources reached');
 if(sources.some(s=>s.url===u.href&&s.platform===platform&&(s.accountLabel||'')===label&&(s.feed||'public')===feed))throw Error('This source and account are already added');
 const source:Source={id:randomUUID(),url:u.href,platform,name:label?`${u.hostname} · ${label}`:u.hostname,accountLabel:label,feed,authenticated:!!token,enabled:true,cursor:null,status:'pending',error:null,updated:null};
 db.transaction(()=>{saveToken(source.id,token);sources.push(source);write('sources',sources);})();
 res.json(source);
 }catch(e:any){res.status(400).json({error:e.message});}});
app.put('/api/sources/:id/credentials',(req,res)=>{try{
 if(running)return res.status(409).json({error:'Wait for the current refresh to finish.'});
 const sources:Source[]=read('sources',[]);const source=sources.find(s=>s.id===req.params.id);
 if(!source)return res.status(404).json({error:'Source not found'});
 const {token,feed}=credentialInput(source.platform,source.url,req.body.token,req.body.feed||'public',!!accessKey);
 db.transaction(()=>{saveToken(source.id,token);Object.assign(source,{authenticated:!!token,feed,cursor:null,status:'pending',error:null,updated:null});write('sources',sources);
 // Discard cached content when account permissions or identity change, including bookmarks.
 const items:Item[]=read('items',[]);const kept=items.map(i=>({...i,sourceIds:i.sourceIds.filter(id=>id!==source.id)})).filter(i=>i.sourceIds.length);
 write('items',kept);write('saved',read('saved',[]).filter((id:string)=>kept.some(i=>i.id===id)));})();
 res.json({ok:true});
 }catch(e:any){res.status(400).json({error:e.message});}});
app.patch('/api/sources/:id',(req,res)=>{const sources:Source[]=read('sources',[]);const s=sources.find(s=>s.id===req.params.id);if(s)s.enabled=!!req.body.enabled;write('sources',sources);res.json({ok:true});});
app.delete('/api/sources/:id',(req,res)=>{
 if(running)return res.status(409).json({error:'Wait for the current refresh to finish.'});
 const sources:Source[]=read('sources',[]);const source=sources.find(s=>s.id===req.params.id);
 db.transaction(()=>{saveToken(req.params.id,'');write('sources',sources.filter(s=>s.id!==req.params.id));
 const items:Item[]=read('items',[]);const kept=items.map(i=>({...i,sourceIds:i.sourceIds.filter(id=>id!==req.params.id)})).filter(i=>i.sourceIds.length||(!source?.authenticated&&read('saved',[]).includes(i.id)));
 write('items',kept);write('saved',read('saved',[]).filter((id:string)=>kept.some(i=>i.id===id)));})();
 res.json({ok:true});
});
let running=false;app.post('/api/refresh',async(req,res)=>{if(running)return res.status(409).json({error:'Refresh already in progress'});running=true;try{const sources:Source[]=read('sources',[]);const results=await Promise.all(sources.filter(s=>s.enabled).map(async s=>{try{const result=await load(s,!!req.body.more,tokenFor(s.id));return {id:s.id,...result,status:'healthy',error:null,updated:new Date().toISOString()};}catch(e:any){return {id:s.id,items:[],cursor:s.cursor,status:s.platform==='Pixelfed'?'unsupported':'error',error:s.authenticated?'Account refresh failed. Check the token, read permissions, instance availability and API compatibility.':e.message,updated:s.updated};}}));const current:Source[]=read('sources',[]);for(const r of results){const s=current.find(s=>s.id===r.id);if(s)Object.assign(s,{cursor:r.cursor,status:r.status,error:r.error,updated:r.updated});}write('sources',current);write('items',merge([...read('items',[]),...results.filter(r=>current.some(s=>s.id===r.id)).flatMap(r=>r.items)]).slice(0,2000));res.json({ok:true});}finally{running=false;}});
app.post('/api/saved',(req,res)=>{const {id}=req.body;if(typeof id!=='string')return res.sendStatus(400);let saved:string[]=read('saved',[]);saved=saved.includes(id)?saved.filter(x=>x!==id):[...saved,id];write('saved',saved);res.json(saved);});app.post('/api/preferences',(req,res)=>{write('preferences',req.body);res.json({ok:true});});
app.use((req,res,next)=>{let path:string;try{path=decodeURIComponent(req.path);}catch{return res.sendStatus(400);}if(/(?:^|\/)(?:data|\.aws|\.codex|\.agents)(?:\/|$)|(?:^|\/)\.env[^/]*$|\.(?:key|pem|db)(?:-[^/]*)?$/.test(path))return res.sendStatus(403);next();});
const vite=await createViteServer({server:{middlewareMode:true,fs:{deny:['**/.env*','**/*.{crt,pem,key}','**/.git/**','**/data/**','**/*.db','**/*.db-*','**/.aws/**','**/.codex/**','**/.agents/**']}},appType:'spa'});app.use(vite.middlewares);app.listen(Number(process.env.PORT||5101),'0.0.0.0',()=>console.log('FediScope ready'));
