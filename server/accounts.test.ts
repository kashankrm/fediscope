import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import Database from 'better-sqlite3';

test('account API protects data, separates instance accounts, hides tokens and clears private content', {timeout:25000}, async()=>{
 const directory=mkdtempSync(join(tmpdir(),'fediscope-api-'));
 const key='test-workspace-key-at-least-32-characters';
 const child=spawn(process.execPath,['--import','tsx','server/index.ts'],{env:{...process.env,PORT:'15109',FEDISCOPE_DATA_DIR:directory,FEDISCOPE_ACCESS_KEY:key},stdio:['ignore','pipe','pipe']});
 let output='';child.stdout.on('data',c=>output+=c);child.stderr.on('data',c=>output+=c);
 const request=async(path:string,body?:unknown,method?:string,authorized=true)=>fetch('http://127.0.0.1:15109'+path,{method:method||(body?'POST':'GET'),headers:{'Content-Type':'application/json',...(authorized?{'X-FediScope-Key':key}:{})},body:body?JSON.stringify(body):undefined});
 let database:Database.Database|undefined;
 try{
  for(let i=0;i<100;i++){if(output.includes('FediScope ready'))break;if(child.exitCode!==null)throw Error(output);await new Promise(r=>setTimeout(r,100));}
  assert.ok(output.includes('FediScope ready'),output);
  assert.equal((await request('/api/state',undefined,undefined,false)).status,401);
  const token='test-account-token';
  const a=await request('/api/sources',{platform:'Mastodon',url:'https://8.8.8.8',accountLabel:'Personal',token,feed:'home'});assert.equal(a.status,200);const first=await a.json() as any;
  const b=await request('/api/sources',{platform:'Mastodon',url:'https://8.8.8.8',accountLabel:'Work',token:'other-token',feed:'home'});assert.equal(b.status,200);
  const state=await (await request('/api/state')).text();assert.ok(!state.includes(token));assert.equal(JSON.parse(state).sources.length,2);assert.equal(JSON.parse(state).sources[0].authenticated,true);
  database=new Database(join(directory,'fediscope.db'));const row=database.prepare('SELECT encrypted FROM credentials WHERE source_id=?').get(first.id) as any;assert.ok(row.encrypted&&!row.encrypted.includes(token));
  const privateItem={id:'https://example.org/private',sourceIds:[first.id]};
  database.prepare('INSERT OR REPLACE INTO state VALUES (?,?)').run('items',JSON.stringify([privateItem]));database.prepare('INSERT OR REPLACE INTO state VALUES (?,?)').run('saved',JSON.stringify([privateItem.id]));
  assert.equal((await request(`/api/sources/${first.id}/credentials`,{token:'',feed:'public'},'PUT')).status,200);
  const cleared=await (await request('/api/state')).json() as any;assert.equal(cleared.items.length,0);assert.equal(cleared.saved.length,0);assert.equal(cleared.sources[0].authenticated,false);
  assert.equal((await request(`/api/sources/${first.id}`,undefined,'DELETE')).status,200);
  assert.equal((await request('/api/state')).headers.get('cache-control'),'no-store');
  for(const path of ['/.env','/data/fediscope.db','/data/credentials.key']){const response=await request(path);assert.ok([403,404].includes(response.status),`Sensitive file accessible: ${path}`);}

 }finally{database?.close();child.kill('SIGTERM');await new Promise<void>(r=>{if(child.exitCode!==null)r();else child.once('exit',()=>r());});rmSync(directory,{recursive:true,force:true});}
});
