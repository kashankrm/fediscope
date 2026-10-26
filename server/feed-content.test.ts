import {test} from 'node:test';
import assert from 'node:assert/strict';
import {XMLParser} from 'fast-xml-parser';
import {normalize, type Source} from './adapters';

const source:Source={id:'feed',url:'https://blog.example/feed.xml',name:'Blog',platform:'RSS / Atom',enabled:true,cursor:null,status:'pending',error:null,updated:null};

test('feed content extracts attributed XML text and keeps sanitization',()=>{
 const parser=new XMLParser({ignoreAttributes:false});
 const atom=parser.parse(`<feed>
  <entry><link href="/one"/><summary type="html">&lt;p&gt;Summary&lt;/p&gt;&lt;script&gt;bad()&lt;/script&gt;</summary></entry>
  <entry><link href="/two"/><content type="text"/><summary>Fallback</summary></entry>
  <entry><link href="/three"/><content type="html">&lt;p&gt;Body&lt;/p&gt;</content><summary>Unused</summary></entry>
 </feed>`);
 const rss=parser.parse('<rss><channel><item><link>/four</link><description xml:lang="en">Description</description></item></channel></rss>');
 const items=normalize(source.platform,[...atom.feed.entry,rss.rss.channel.item],source);
 assert.deepEqual(items.map(item=>item.html),['<p>Summary</p>','Fallback','<p>Body</p>','Description']);
});
