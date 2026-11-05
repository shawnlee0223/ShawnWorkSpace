const finite=v=>v!==null&&v!==''&&Number.isFinite(Number(v));
export function technicals(rows,period=252){
 const valid=rows.filter(x=>finite(x.adjusted_close??x.close)&&Number(x.adjusted_close??x.close)>0);
 const close=valid.map(x=>Number(x.adjusted_close??x.close));
 if(!close.length)return null;
 const last=close.at(-1),avg=n=>close.length>=n?close.slice(-n).reduce((a,b)=>a+b,0)/n:null;
 const returns=close.slice(1).map((v,i)=>Math.log(v/close[i]));
 const recent=returns.slice(-30),mean=recent.reduce((a,b)=>a+b,0)/(recent.length||1);
 const vol=recent.length>=20?Math.sqrt(recent.reduce((a,b)=>a+(b-mean)**2,0)/(recent.length-1))*Math.sqrt(period)*100:null;
 const change=n=>close.length>n?(last/close.at(-n-1)-1)*100:null;
 return {lastClose:last,lastDate:valid.at(-1).date,change1d:change(1),change5d:change(5),change20d:change(20),sma20:avg(20),sma60:avg(60),volatility30d:vol,drawdownFromWindowHigh:(last/Math.max(...close)-1)*100,sampleSize:close.length,method:'收益/均线使用供应商复权收盘价（若有）；波动率为最近30个收益样本的年化标准差；最大值为当前采样窗口，不是历史最高'};
}
