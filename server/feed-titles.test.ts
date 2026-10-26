import {test} from 'node:test';
import assert from 'node:assert/strict';
import {XMLParser} from 'fast-xml-parser';
import {normalize, type Source} from './adapters';

const source: Source = {id:'feed',url:'https://blog.example/feed.xml',name:'Blog',platform:'RSS / Atom',enabled:true,cursor:null,status:'pending',error:null,updated:null};

test('feed titles normalize XML text nodes to strings suitable for rendering',()=>{
 const parser=new XMLParser({ignoreAttributes:false});
 const atom=parser.parse(`<feed>
  <entry><title type="text">Hello</title><link href="/one"/></entry>
  <entry><title type="html">&lt;em&gt;Hello&lt;/em&gt;</title><link href="/two"/></entry>
  <entry><title>123</title><link href="/three"/></entry>
  <entry><title/><link href="/four"/></entry>
  <entry><link href="/five"/></entry>
 </feed>`);
 const rss=parser.parse('<rss><channel><item><title>Plain title</title><link>https://blog.example/six</link></item></channel></rss>');
 const items=normalize(source.platform,[...atom.feed.entry,rss.rss.channel.item],source);
 assert.deepEqual(items.map(item=>item.title),['Hello','<em>Hello</em>','123','','','Plain title']);
});
