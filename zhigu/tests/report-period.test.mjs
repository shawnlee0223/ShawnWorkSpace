import {test} from 'node:test';
import assert from 'node:assert/strict';
import {reportPeriod,useReportPeriod,fillClosingChange} from '../report-period.mjs';
import {quoteChangeText} from '../public/quote-format.mjs';
test('晨报按北京时间归属前一日，跨月跨年与手动更新区分',()=>{
 assert.equal(reportPeriod('scheduled',new Date('2026-12-31T16:30:00Z')).reportDate,'2026-12-31');
 assert.equal(reportPeriod('scheduled',new Date('2026-11-10T01:00:00Z')).reportDate,'2026-11-09');
 assert.equal(reportPeriod('manual',new Date('2026-11-10T01:00:00Z')).priceBasis,'latest');
});
test('晨报从同口径相邻交易日日K补涨跌幅，显示口径与缺失原因',()=>{
 const period=reportPeriod('scheduled',new Date('2026-11-10T02:00:00Z'));
 const sample=()=>({asset:{code:'9988.HK',kind:'stock'},quote:{price:106,previousClose:104.6,asOf:'2026-11-10T02:00:00Z',change1d:1.34,method:'test'},rows:[{date:'2026-11-06',close:104.9,priceBasis:'forward-adjusted'},{date:'2026-11-09',close:104.6,priceBasis:'forward-adjusted'}],missing:[]});
 const s=useReportPeriod(sample(),period);
 assert.ok(Math.abs(s.quote.change1d-(-0.2859866539561553))<1e-9);assert.equal(s.quote.price,104.6);assert.equal(s.quote.changeComparison.date,'2026-11-06');assert.equal(s.quote.previousClose,undefined);
 assert.equal(quoteChangeText(s.quote,s.asset),'该交易日涨跌（前复权） -0.29%');
 const mixed=sample();mixed.rows[0].priceBasis='unadjusted';useReportPeriod(mixed,period);assert.equal(mixed.quote.change1d,null);assert.equal(quoteChangeText(mixed.quote,mixed.asset),'该交易日涨跌待补全');
 const single=sample();single.rows.shift();useReportPeriod(single,period);assert.equal(single.quote.change1d,null);
 const mismatch=sample();mismatch.rows[1].close=100;useReportPeriod(mismatch,period);assert.equal(mismatch.quote.change1d,null);
 const raw=sample();raw.rows.forEach(x=>x.priceBasis='unadjusted');useReportPeriod(raw,period);assert.equal(raw.quote.changeBasis,'unadjusted');
 const zero={period:'previous-close',change1d:0};assert.equal(quoteChangeText(zero,s.asset),'该交易日涨跌 0.00%');assert.equal(quoteChangeText({change1d:2},{kind:'crypto'}),'24小时 +2.00%');
 const before=JSON.stringify(s);fillClosingChange(s);assert.equal(JSON.stringify(s),before);
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
