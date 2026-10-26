import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync,readFileSync,statSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {credentialInput,credentialVault,accessAllowed} from './credentials';
import {credentialHeaders,credentialRedirect} from './safety';
import {endpoint,type Source} from './adapters';

test('credentials require a protected workspace, HTTPS, supported platform and matching feed',()=>{
 assert.throws(()=>credentialInput('Mastodon','https://example.org','token','home',false));
 assert.throws(()=>credentialInput('Mastodon','http://example.org','token','home',true));
 assert.throws(()=>credentialInput('RSS / Atom','https://example.org','token','public',true));
 assert.throws(()=>credentialInput('Lemmy','https://example.org','','subscribed',true));
 assert.throws(()=>credentialInput('Lemmy','https://example.org','token','home',true));
 assert.throws(()=>credentialInput('Lemmy','https://example.org','token\r\nheader','public',true));
 assert.deepEqual(credentialInput('Lemmy','https://example.org',' jwt.token ','subscribed',true),{token:'jwt.token',feed:'subscribed'});
 assert.equal(accessAllowed('secret','secret'),true);assert.equal(accessAllowed('secret','wrong'),false);assert.equal(accessAllowed('secret',undefined),false);
});

test('authenticated fetch uses headers and cannot forward credentials to another origin or HTTP',()=>{
 assert.deepEqual(credentialHeaders('https://example.org/api','test-token'),{authorization:'Bearer test-token'});
 assert.throws(()=>credentialHeaders('http://example.org/api','test-token'));
 assert.throws(()=>credentialRedirect('https://example.org/api','https://other.example/api','test-token'));
 assert.throws(()=>credentialRedirect('https://example.org/api','http://example.org/api','test-token'));
 assert.equal(credentialRedirect('https://example.org/api','/next','test-token'),'https://example.org/next');
});

test('tokens are encrypted at rest and can be decrypted after restart; tampering is rejected',()=>{
 const directory=mkdtempSync(join(tmpdir(),'fediscope-vault-'));
 try{const vault=credentialVault(directory);const encrypted=vault.seal('sensitive-test-token');assert.ok(!encrypted.includes('sensitive-test-token'));
 assert.equal(credentialVault(directory).open(encrypted),'sensitive-test-token');
 assert.equal(readFileSync(join(directory,'credentials.key')).length,32);
 assert.equal(statSync(join(directory,'credentials.key')).mode&0o777,0o600);
 const bytes=Buffer.from(encrypted,'base64');bytes[bytes.length-1]^=1;assert.throws(()=>vault.open(bytes.toString('base64')));
 }finally{rmSync(directory,{recursive:true,force:true});}
});

test('account feeds preserve instance boundaries and pagination without putting credentials in URLs',()=>{
 const source:Source={id:'a',url:'https://example.org/',platform:'Mastodon',name:'Personal',enabled:true,cursor:'12',status:'pending',error:null,updated:null,feed:'home'};
 const home=new URL(endpoint(source,true));assert.equal(home.pathname,'/api/v1/timelines/home');assert.equal(home.searchParams.get('max_id'),'12');assert.equal(home.searchParams.has('local'),false);
 const subscribed=new URL(endpoint({...source,platform:'Lemmy',feed:'subscribed'},true));assert.equal(subscribed.searchParams.get('type_'),'Subscribed');assert.equal(subscribed.searchParams.get('page_cursor'),'12');assert.equal(subscribed.searchParams.has('auth'),false);
});
