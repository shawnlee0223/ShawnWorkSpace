import {test} from 'node:test';
import assert from 'node:assert/strict';
import {normalizeBrave} from '../brave-research.mjs';
import {decodeOnlineReport} from '../online-research.mjs';
test('Brave资料去重、去标签、限制长度，拒绝非HTTP引用',()=>{
 const r=normalizeBrave({web:{results:[{url:'https://example.com/a',title:'<b>财报</b>',description:'<script>x</script>hello',extra_snippets:['hello']},{url:'javascript:bad',title:'bad'},{url:'https://example.com/a',title:'更新标题',description:'x'.repeat(5000)}]}},'2026-11-04T00:00:00Z');assert.equal(r.length,1);assert.equal(r[0].snippets.length,2200);assert.equal(r[0].label,'更新标题');
});
test('模型自造的Brave事实URL不进入已核验事实',()=>{
 const report={quote:null,facts:[{text:'伪造事实',url:'https://madeup.example/'}],analysis:{category:'值得分批加仓',conclusion:'测试',reasons:[],indicators:[],addConditions:[],reduceConditions:[],risks:[],nextWeek:[]}};
 const r=decodeOnlineReport({status:'completed',output:[{type:'message',content:[{type:'output_text',text:JSON.stringify(report)}]}]},{currency:'HKD'},'2026-11-04T00:00:00Z',[{url:'https://real.example/',label:'实际搜索来源'}]);assert.equal(r.fundamentals.facts.length,0);assert.equal(r.analysis.category,null);
});
