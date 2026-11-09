import {test} from 'node:test';
import assert from 'node:assert/strict';
import {reportPeriod,useReportPeriod} from '../report-period.mjs';
test('晨报按北京时间归属前一日，跨月跨年与手动更新区分',()=>{
 assert.equal(reportPeriod('scheduled',new Date('2026-12-31T16:30:00Z')).reportDate,'2026-12-31');
 assert.equal(reportPeriod('scheduled',new Date('2026-11-10T01:00:00Z')).reportDate,'2026-11-09');
 assert.equal(reportPeriod('manual',new Date('2026-11-10T01:00:00Z')).priceBasis,'latest');
});
test('晨报不用生成日盘中价：港股昨收需有历史日期，美股按纽约交易日，休市沿用',()=>{
 const p=reportPeriod('scheduled',new Date('2026-11-10T01:00:00Z'));
 const hk={asset:{code:'9988.HK',kind:'stock'},quote:{price:110,previousClose:100,asOf:'2026-11-10T01:00:00Z',method:'test'},rows:[{date:'2026-11-09',close:98}],missing:[]};
 assert.equal(useReportPeriod(hk,p).quote.price,100);assert.equal(hk.quote.asOf,'2026-11-09');
 const us={asset:{code:'LUNR.US',kind:'stock'},quote:{price:10,asOf:'2026-11-09T21:00:00Z',method:'test'},missing:[]};assert.equal(useReportPeriod(us,p).quote.price,10);
 const noHistory={asset:{code:'9988.HK',kind:'stock'},quote:{price:110,asOf:'2026-11-10T01:00:00Z',method:'test'},missing:[]};assert.equal(useReportPeriod(noHistory,p).quote,null);
});
test('加密晨报用完整UTC日K收盘，不用现价；缺失不补估',()=>{
 const p=reportPeriod('scheduled',new Date('2026-11-10T01:00:00Z'));
 const s={asset:{kind:'crypto'},quote:{price:3000},rows:[{date:'2026-11-08',close:1000},{date:'2026-11-09',close:1100}],sources:[{label:'OKX完整UTC日K',url:'https://www.okx.com/api/v5/market/candles'}],missing:[]};
 useReportPeriod(s,p);assert.equal(s.quote.price,1100);assert.equal(s.quote.currency,'USDT');assert.ok(Math.abs(s.quote.change1d-10)<1e-9);assert.equal(s.quote.period,'utc-day-close');
 const missing={asset:{kind:'crypto'},quote:{price:3000},sources:[],missing:[]};assert.equal(useReportPeriod(missing,p).quote,null);
});
