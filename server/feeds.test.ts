import {test} from 'node:test';
import assert from 'node:assert/strict';
import {normalize, type Source} from './adapters';

const source: Source = {id:'feed',url:'https://blog.example/feed.xml',name:'Blog',platform:'RSS / Atom',enabled:true,cursor:null,status:'pending',error:null,updated:null};

test('Atom article links default to alternate and skip self and enclosure links',()=>{
 const items=normalize(source.platform,[
  {link:[{'@_rel':'self','@_href':'/entries/1.atom'},{'@_href':'/posts/1'}]},
  {link:[{'@_rel':'enclosure','@_href':'/audio.mp3'},{'@_rel':'alternate','@_href':'/posts/2'}]},
  {link:{'@_rel':'self','@_href':'/entries/3.atom'}},
  {link:{'@_href':'/posts/4'}},
  {link:'/posts/5'}
 ],source);
 assert.deepEqual(items.map(item=>item.url),[
  'https://blog.example/posts/1','https://blog.example/posts/2',
  'https://blog.example/posts/4','https://blog.example/posts/5'
 ]);
});
