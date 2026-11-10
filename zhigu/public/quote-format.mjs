export function quoteChangeText(q,asset){
 const label=q.period==='utc-day-close'?'较前一UTC日收盘':q.period==='previous-close'?'该交易日涨跌'+(q.changeBasis==='forward-adjusted'?'（前复权）':q.changeBasis==='unadjusted'?'（未复权）':''):asset.kind==='crypto'?'24小时':'较昨收';
 if(!Number.isFinite(q.change1d))return label+'待补全';
 const value=q.change1d.toLocaleString('zh-CN',{minimumFractionDigits:2,maximumFractionDigits:2});
 return label+' '+(q.change1d>0?'+':'')+value+'%';
}
