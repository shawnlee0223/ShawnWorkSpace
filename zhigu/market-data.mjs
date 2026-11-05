const number=v=>v!==''&&v!=null&&Number.isFinite(Number(v))?Number(v):null;
export function tencentSymbol(a){if(a.code.endsWith('.HK'))return 'hk'+a.code.split('.')[0].padStart(5,'0');if(a.code.endsWith('.SZ'))return 'sz'+a.code.split('.')[0];if(a.code.endsWith('.US'))return 'us'+a.code.split('.')[0];throw Error('腾讯标的映射缺失');}
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
 return {price,currency:asset.currency,asOf,change1d:number(f[32]),sourceUrl:'https://qt.gtimg.cn/q='+symbol,provider:'腾讯财经',method:'腾讯财经最新可得快照，可能延迟；美股按纽约时间转换，港股/A股按北京时间转换。成交量与资金流不等同。'};
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
 s.missing.push('行情快照不含完整财务报表、历史波动率、相对强弱或资金流；基本面与新闻通过Brave检索核验。');if(asset.kind==='crypto')s.missing.push('OKX交易所行情不提供链上活跃地址、TVL、代币解锁或全市场资金流。');return s;
}
