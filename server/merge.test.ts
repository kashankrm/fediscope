import {test} from 'node:test';
import assert from 'node:assert/strict';
import {merge, normalize, type Source} from './adapters';

test('refresh replaces cached content and warnings while retaining source provenance',()=>{
 const source:Source={id:'one',url:'https://social.example/',name:'Social',platform:'Mastodon',enabled:true,cursor:null,status:'healthy',error:null,updated:null};
 const raw={id:'1',url:'https://social.example/posts/1',created_at:'2026-01-01',content:'<p>Original</p>'};
 const [cached]=normalize(source.platform,[raw],source);
 const [updated]=normalize(source.platform,[{...raw,content:'<p>Edited</p>',spoiler_text:'New warning'}],source);
 const result=merge([cached,{...cached,sourceIds:['two']},updated]);
 assert.equal(result.length,1);
 assert.equal(result[0].id,cached.id);
 assert.equal(result[0].html,'<p>Edited</p>');
 assert.equal(result[0].warning,'New warning');
 assert.deepEqual(result[0].sourceIds,['one','two']);
 assert.deepEqual(merge([result[0],updated]),result);
});
