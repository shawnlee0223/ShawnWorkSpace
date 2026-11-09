import { technicals } from './price-technicals.mjs';
const number=v=>v!==''&&v!=null&&Number.isFinite(Number(v))?Number(v):null;
export function tencentSymbol(a){if(a.code.endsWith('.HK'))return 'hk'+a.code.split('.')[0].padStart(5,'0');if(a.code.endsWith('.SH'))return 'sh'+a.code.split('.')[0];if(a.code.endsWith('.SZ'))return 'sz'+a.code.split('.')[0];if(a.code.endsWith('.US'))return 'us'+a.code.split('.')[0];throw Error('腾讯标的映射缺失');}
function localStamp(raw,zone){
 const digits=raw.replace(/\D/g,'');if(!/^\d{14}$/.test(digits))throw Error('行情时间无效');
 const parts=digits.match(/^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})$/).slice(1).map(Number);
 const naive=Date.UTC(parts[0],parts[1]-1,...parts.slice(2));let t=naive;
 for(let i=0;i<3;i++){const p=Object.fromEntries(new Intl.DateTimeFormat('en-GB',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).formatToParts(t).map(x=>[x.type,x.value]));const shown=Date.UTC(+p.year,+p.month-1,+p.day,+p.hour,+p.minute,+p.second);t+=naive-shown;}
 return new Date(t).toISOString();
}
export function parseTencent(text,asset,at=new Date().toISOString()){
 const symbol=tencentSymbol(asset),match=text.match(new RegExp('v_'+symbol+'="([^"\\r\\n]*)"'));
 if(!match)throw Error('腾讯未返回该标的行情');const f=match[1].split('~');
 const expected=asset.code.split('.')[0],actual=String(f[2]||'').split('.')[0];if(actual!==expected&&!(asset.code.endsWith('.HK')&&Number(actual)===Number(expected)))throw Error('腾讯返回标的代码不匹配');
 const price=number(f[3]);if(!price||price<=0)throw Error('腾讯价格无效');
 const us=asset.code.endsWith('.US'),asOf=localStamp(f[30],us?'America/New_York':'Asia/Shanghai');const age=Date.parse(at)-Date.parse(asOf);if(age < -300000||age>7*86400000)throw Error('腾讯行情超出有效时限');
 return {price,previousClose:number(f[4]),currency:asset.currency,asOf,change1d:number(f[32]),sourceUrl:'https://qt.gtimg.cn/q='+symbol,provider:'腾讯财经',method:'腾讯财经最新可得快照，可能延迟；美股按纽约时间转换，港股/A股按北京时间转换。成交量与资金流不等同。'};
}
export function parseOKX(d,asset,at=new Date().toISOString()){
 const instId=asset.code.split('.')[0]+'-USDT',x=d?.data?.[0];if(d?.code!=='0'||x?.instId!==instId||x.instType!=='SPOT')throw Error('OKX现货行情标的不匹配或接口错误');
 const price=number(x.last),ts=number(x.ts),open=number(x.open24h);if(!price||price<=0||!ts||Date.parse(at)-ts>86400000||ts-Date.parse(at)>300000)throw Error('OKX价格或时间无效');
 return {price,currency:'USDT',asOf:new Date(ts).toISOString(),change1d:open>0?(price/open-1)*100:null,volume:number(x.vol24h),volumeUnit:asset.code.split('.')[0],turnover:number(x.volCcy24h),turnoverCurrency:'USDT',sourceUrl:'https://www.okx.com/api/v5/market/ticker?instId='+instId,provider:'OKX',method:'OKX '+instId+' 现货，24小时滚动涨跌与成交量；USDT不等同USD，不是全市场综合价格。'};
}
export async function collectMarket(asset,{fetcher=fetch}={}){
 const at=new Date().toISOString(),s={asset,fetchedAt:at,quote:null,sources:[],missing:[],errors:[]};
 try{const url=asset.kind==='crypto'?'https://www.okx.com/api/v5/market/ticker?instId='+asset.code.split('.')[0]+'-USDT':'https://qt.gtimg.cn/q='+tencentSymbol(asset);const r=await fetcher(url,{signal:AbortSignal.timeout(12000)});if(!r.ok)throw Error('行情 HTTP '+r.status);
 s.quote=asset.kind==='crypto'?parseOKX(await r.json(),asset,at):parseTencent(new TextDecoder('gb18030').decode(await r.arrayBuffer()),asset,at);
 s.sources.push({label:s.quote.provider+' 行情快照',url:s.quote.sourceUrl,asOf:s.quote.asOf,fetchedAt:at});
 }catch(e){s.errors.push((asset.kind==='crypto'?'OKX':'腾讯财经')+'行情：'+(e.name==='TimeoutError'||e.message==='fetch failed'?'连接失败或超时':e.message));}
 await collectHistory(s,{fetcher});
 s.missing.push('行情与日K不含完整财务报表、相对基准强弱或资金流；基本面与新闻通过Brave检索核验。');if(asset.kind==='crypto')s.missing.push('OKX交易所行情不提供链上活跃地址、TVL、代币解锁或全市场资金流。');return s;
}

export function parseTencentHistory(d,asset,at=new Date().toISOString()){
 const symbol=tencentSymbol(asset),data=d?.data?.[symbol];if(d?.code!==0||(!Array.isArray(data?.qfqday)&&!Array.isArray(data?.day)))throw Error('未返回该标的日K');
 const adjusted=Array.isArray(data.qfqday),series=adjusted?data.qfqday:data.day;
 const zone=asset.code.endsWith('.US')?'America/New_York':'Asia/Shanghai';
 // Exclude the current exchange date even after market close: never treat an unfinished/delayed bar as final.
 const today=new Intl.DateTimeFormat('en-CA',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(at));
 const rows=new Map();for(const r of series){if(!Array.isArray(r)||!/^\d{4}-\d{2}-\d{2}$/.test(r[0])||r[0]>=today)continue;
 const [date,o,c,h,l,v]=r,nums=[o,c,h,l].map(number);if(nums.some(n=>n===null||n<=0)||nums[2]<Math.max(nums[0],nums[1],nums[3])||nums[3]>Math.min(nums[0],nums[1]))continue;
 rows.set(date,{date,open:nums[0],close:nums[1],...(adjusted?{adjusted_close:nums[1]}:{}),priceBasis:adjusted?'forward-adjusted':'unadjusted',high:nums[2],low:nums[3],volume:number(v)});}
 const result=[...rows.values()].sort((a,b)=>a.date.localeCompare(b.date));if(!result.length)throw Error('没有完整历史日K');if(Date.parse(today)-Date.parse(result.at(-1).date)>10*86400000)throw Error('日K末日过旧');return result;
}
export function parseOKXCandles(d,asset,at=new Date().toISOString()){
 if(d?.code!=='0'||!Array.isArray(d.data))throw Error('OKX日K返回错误');const rows=new Map();
 for(const r of d.data){if(!Array.isArray(r)||r[8]!=='1')continue;const t=number(r[0]),nums=r.slice(1,5).map(number);if(!t||t>=Date.parse(at)||t+86400000>Date.parse(at)||nums.some(x=>x===null||x<=0)||nums[1]<Math.max(nums[0],nums[2],nums[3])||nums[2]>Math.min(nums[0],nums[3]))continue;
 const date=new Date(t).toISOString().slice(0,10);rows.set(date,{date,open:nums[0],high:nums[1],low:nums[2],close:nums[3],volume:number(r[5]),turnover:number(r[7])});}
 const result=[...rows.values()].sort((a,b)=>a.date.localeCompare(b.date));if(!result.length||Date.parse(at)-Date.parse(result.at(-1).date)>3*86400000)throw Error('OKX完整日K缺失或过旧');return result;
}
async function collectHistory(s,{fetcher}){
 const {asset,fetchedAt:at}=s;let url;
 if(asset.kind==='crypto')url='https://www.okx.com/api/v5/market/candles?instId='+asset.code.split('.')[0]+'-USDT&bar=1Dutc&limit=100';
 else if(asset.code.endsWith('.US')){s.missing.push('美股/ETF复权日K尚未接入；不使用A股或港股接口猜测美股历史。');return;}
 else url='https://web.ifzq.gtimg.cn/appstock/app/'+(asset.code.endsWith('.HK')?'hkfqkline':'fqkline')+'/get?param='+tencentSymbol(asset)+',day,,,120,qfq';
 try{const r=await fetcher(url,{signal:AbortSignal.timeout(12000)});if(!r.ok)throw Error('HTTP '+r.status);const d=await r.json();s.rows=asset.kind==='crypto'?parseOKXCandles(d,asset,at):parseTencentHistory(d,asset,at);s.technicals=technicals(s.rows,asset.kind==='crypto'?365:252);s.technicals.method+='；仅完整历史日K，股票排除交易所当日行，腾讯按返回字段标注复权口径；OKX为UTC日线，不含未完成K线';
 if(asset.kind!=='crypto'&&s.rows[0].priceBasis==='unadjusted'){s.technicals.method+='；该标的仅返回普通未复权日K，除权除息可能导致价格跳变，收益与波动需谨慎解读';s.missing.push('供应商未返回前复权列，当前历史明确为未复权，不作为总回报指标。');}
 s.sources.push({label:asset.kind==='crypto'?'OKX完整UTC日K':s.rows[0].priceBasis==='unadjusted'?'腾讯普通未复权日K（排除当日）':'腾讯财经前复权日K（排除当日）',url,asOf:s.rows.at(-1).date,fetchedAt:at});
 }catch(e){s.missing.push('历史日K：'+(e.message==='fetch failed'||e.name==='TimeoutError'?'连接失败或超时':e.message));}
}
