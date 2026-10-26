import {test} from 'node:test';
import assert from 'node:assert/strict';
import {XMLParser} from 'fast-xml-parser';
import {normalize, type Source} from './adapters';

const source: Source = {id:'feed',url:'https://blog.example/feed.xml',name:'Blog',platform:'RSS / Atom',enabled:true,cursor:null,status:'pending',error:null,updated:null};

test('feed authors normalize XML text nodes and fall back to the source name',()=>{
 const parser=new XMLParser({ignoreAttributes:false});
 const rss=parser.parse(`<rss><channel>
  <item><author domain="example.com">Alice</author><link>/one</link></item>
  <item><author/><link>/two</link></item>
  <item><dc:creator>123</dc:creator><link>/three</link></item>
 </channel></rss>`);
 const atom=parser.parse(`<feed>
  <entry><author><name xml:lang="en">Bob</name></author><link href="/four"/></entry>
  <entry><author><uri>https://example.com</uri></author><link href="/five"/></entry>
 </feed>`);
 const items=normalize(source.platform,[...rss.rss.channel.item,...atom.feed.entry],source);
 assert.deepEqual(items.map(item=>item.author),['Alice','Blog','123','Bob','Blog']);
});
