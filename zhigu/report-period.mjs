const dayIn=(date,zone)=>new Intl.DateTimeFormat('en-CA',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(date));
export function reportPeriod(trigger,now=new Date()){
 const generatedOn=dayIn(now,'Asia/Shanghai');
 return {generatedOn,reportDate:trigger==='scheduled'?new Date(Date.parse(generatedOn+'T12:00:00Z')-86400000).toISOString().slice(0,10):generatedOn,priceBasis:trigger==='scheduled'?'previous-close':'latest',description:trigger==='scheduled'?'前一日晨报：股票采用各市场最近已收盘交易日；加密采用最近完整UTC日K。休市沿用最近交易日；晨间新增消息单独标注。':'手动更新：最新可得行情与资料'};
}
export function useReportPeriod(s,period){
 if(period?.priceBasis!=='previous-close')return s;
 s.reportPeriod=period;
 if(s.asset.kind==='crypto'){
  const row=s.rows?.at(-1),previous=s.rows?.at(-2);
  if(row&&row.date<=period.reportDate){s.quote={price:row.close,currency:'USDT',asOf:row.date+'T23:59:59.999Z',change1d:previous?.close>0?(row.close/previous.close-1)*100:null,sourceUrl:s.sources.find(x=>x.label.includes('UTC日K'))?.url,provider:'OKX',period:'utc-day-close',method:'晨报基准：'+row.date+'完整UTC日K收盘（北京时间次日08:00）；USDT报价，非生成时刻现价。'};}
  else{s.quote=null;s.missing.push('晨报缺少前一完整UTC日K，不用盘中现价代替昨日收盘。');}
 }else if(s.quote){
  const zone=s.asset.code.endsWith('.US')?'America/New_York':'Asia/Shanghai';
  if(dayIn(s.quote.asOf,zone)>period.reportDate){
   const row=s.rows?.at(-1);
   if(row&&row.date<=period.reportDate&&s.quote.previousClose>0){s.quote={...s.quote,price:s.quote.previousClose,asOf:row.date,change1d:null,method:'晨报基准：腾讯昨收字段，最近完整交易日为'+row.date+'；不使用生成日盘中/集合竞价报价。'};}
   else{s.quote=null;s.missing.push('晨报未取得可验证的前一交易日收盘价，不用今日盘中报价代替。');}
  }else s.quote.method+=' 晨报采用最近已收盘交易日，休市沿用最后交易日。';
 }
 return s;
}
