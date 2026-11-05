import {test} from 'node:test';
import assert from 'node:assert/strict';
import {parseTencent,parseOKX,tencentSymbol,collectMarket,parseTencentHistory,parseOKXCandles} from '../market-data.mjs';
import {collectBrave} from '../brave-research.mjs';
const at='2026-11-05T03:00:00Z';
const hk={code:'9988.HK',currency:'HKD',kind:'stock'},us={code:'LUNR.US',currency:'USD',kind:'stock'},eth={code:'ETH.CRYPTO',currency:'USD',kind:'crypto'};
function quote(symbol,code,date){const f=Array(33).fill('');f[2]=code;f[3]='100.1';f[30]=date;f[32]='2.1';return `v_${symbol}="${f.join('~')}";`;}
test('腾讯代码核验、纽约夏令时和北京行情时间、过期拒绝',()=>{
 assert.equal(tencentSymbol(hk),'hk09988');assert.equal(parseTencent(quote('hk09988','09988','2026/11/05 10:00:00'),hk,at).asOf,'2026-11-05T02:00:00.000Z');
 assert.equal(parseTencent(quote('usLUNR','LUNR.OQ','2026-11-04 16:00:01'),us,at).asOf,'2026-11-04T21:00:01.000Z');
 assert.equal(parseTencent(quote('usLUNR','LUNR.OQ','2026-07-06 16:00:01'),us,'2026-07-07T03:00:00Z').asOf,'2026-07-06T20:00:01.000Z');
 assert.throws(()=>parseTencent(quote('hk09988','00700','2026/11/05 10:00:00'),hk,at));
 assert.throws(()=>parseTencent(quote('hk09988','09988','2025/11/05 10:00:00'),hk,at));
});
test('OKX现货代码、USDT币种及24小时单位，拒绝永续合约与错误结果',()=>{
 const data={code:'0',data:[{instType:'SPOT',instId:'ETH-USDT',last:'2000',open24h:'1000',vol24h:'3',volCcy24h:'5000',ts:String(Date.parse(at))}]};
 const q=parseOKX(data,eth,at);assert.equal(q.currency,'USDT');assert.equal(q.change1d,100);assert.equal(q.volumeUnit,'ETH');assert.equal(q.turnoverCurrency,'USDT');
 assert.throws(()=>parseOKX({...data,code:'1'},eth,at));assert.throws(()=>parseOKX({code:'0',data:[{...data.data[0],instType:'SWAP'}]},eth,at));
});
test('行情失败保持缺失；没有检索Key时仍保留独立行情，不调用模型',async()=>{
 const failed=await collectMarket(eth,{fetcher:async()=>{throw Error('fetch failed');}});assert.equal(failed.quote,null);assert.equal(failed.errors.length,1);
 let calls=0;const result=await collectBrave(eth,{}, {fetcher:async()=>{calls++;return new Response(JSON.stringify({code:'0',data:[{instType:'SPOT',instId:'ETH-USDT',last:'2000',ts:String(Date.now())}]}));}});
 assert.equal(calls,2);assert.equal(result.quote.currency,'USDT');assert.equal(result.analysis,null);
});

test('前复权日K校验映射、排序去重，排除当日及错误OHLC，不猜测复权字段',()=>{
 const rows=[['2026-11-05','10','11','12','9','100'],['2026-11-04','10','11','12','9','100'],['2026-11-03','10','10','12','9','100'],['2026-11-02','10','11','9','8','100']];
 const r=parseTencentHistory({code:0,data:{hk09988:{qfqday:rows}}},hk,at);assert.deepEqual(r.map(x=>x.date),['2026-11-03','2026-11-04']);assert.equal(r.at(-1).adjusted_close,11);
 const unadjusted=parseTencentHistory({code:0,data:{hk09988:{day:rows}}},hk,at);assert.equal(unadjusted[0].priceBasis,'unadjusted');assert.equal(unadjusted[0].adjusted_close,undefined);assert.throws(()=>parseTencentHistory({code:0,data:{hk00700:{qfqday:rows}}},hk,at));
});
test('OKX UTC日线只使用已完成的日K，排除未完成及未来条目',()=>{
 const ts=Date.parse('2026-11-04T00:00:00Z'),r=[String(ts),'10','12','9','11','100','100','1100','1'];
 const result=parseOKXCandles({code:'0',data:[r,[...r.slice(0,8),'0'],[String(Date.parse(at)),...r.slice(1)]]},eth,at);assert.equal(result.length,1);assert.equal(result[0].date,'2026-11-04');assert.equal(result[0].close,11);
});
