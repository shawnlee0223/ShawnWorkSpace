import {test} from 'node:test';
import assert from 'node:assert/strict';
import {decodeOnlineReport,verifiedSources} from '../online-research.mjs';
const asset={code:'9988.HK',name:'阿里巴巴',currency:'HKD'};
function response(quoteDate='2026-11-04'){const report={quote:{price:100,currency:'HKD',asOf:quoteDate,url:'https://example.com/quote'},facts:[{text:'测试用财务事实',asOf:'2026Q3',url:'https://example.com/filing'},{text:'测试用价格事实',asOf:quoteDate,url:'https://example.com/quote'}],analysis:{category:'继续持有观察',conclusion:'测试结论',reasons:['测试理由'],indicators:[],addConditions:[],reduceConditions:[],risks:[],nextWeek:[],confidence:'低'}};return {status:'completed',model:'test-model',output:[{type:'message',content:[{type:'output_text',text:JSON.stringify(report),annotations:[{type:'url_citation',url:'https://example.com/quote',title:'测试报价来源'},{type:'url_citation',url:'https://example.com/filing',title:'测试财报来源'}]}]}]};}
test('缺引用、陈旧价格和伪造资料链接均不能形成投资分类',()=>{
 const at='2026-11-04T08:00:00Z';let r=response();assert.equal(decodeOnlineReport(r,asset,at).analysis.category,'继续持有观察');
 r=response();r.output[0].content[0].annotations=[];const missing=decodeOnlineReport(r,asset,at);assert.equal(missing.quote,null);assert.equal(missing.analysis,null);
 const old=decodeOnlineReport(response('2026-10-01'),asset,at);assert.equal(old.quote,null);assert.equal(old.analysis.category,null);
 r=response();const report=JSON.parse(r.output[0].content[0].text);report.facts.forEach(x=>x.url='https://invented.example/');r.output[0].content[0].text=JSON.stringify(report);const forged=decodeOnlineReport(r,asset,at);assert.equal(forged.fundamentals.facts.length,0);assert.equal(forged.analysis.category,null);
 assert.deepEqual(verifiedSources({output:[{type:'url_citation',url:'javascript:alert(1)'}]},at),[]);
});
