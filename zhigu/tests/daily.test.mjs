import {test} from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { mkdtempSync,rmSync,statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createDailyResearch,DEFAULT_ASSETS,technicals,dueToday } from '../daily-research.mjs';
test('读取旧晨报补算交易日涨跌幅，不改写历史快照或调用供应商',()=>{
 const dir=mkdtempSync(join(tmpdir(),'zhigu-display-')),db=new DatabaseSync(join(dir,'test.sqlite'));let engine;
 try{engine=createDailyResearch(db,dir,{fetcher:()=>{throw Error('不得重新请求供应商');}});
 const raw=JSON.stringify({reportPeriod:{priceBasis:'previous-close'},assets:[{asset:{code:'9988.HK',kind:'stock'},quote:{price:104.6,asOf:'2026-11-09',change1d:null,method:'历史收盘'},rows:[{date:'2026-11-06',close:104.9,priceBasis:'forward-adjusted'},{date:'2026-11-09',close:104.6,priceBasis:'forward-adjusted'}]}]});
 db.prepare('INSERT INTO research_runs(id,started,finished,status,payload) VALUES(?,?,?,?,?)').run('old',new Date().toISOString(),new Date().toISOString(),'partial',raw);
 assert.ok(engine.getRun('old').payload.assets[0].quote.change1d<0);assert.equal(engine.summary().latest.payload.assets[0].quote.changeComparison.date,'2026-11-06');
 assert.equal(db.prepare('SELECT payload FROM research_runs WHERE id=?').get('old').payload,raw);
 }finally{engine?.stop();db.close();rmSync(dir,{recursive:true,force:true});}
});
test('多市场默认清单、复权收益计算和北京时间运行边界',()=>{
 assert.equal(DEFAULT_ASSETS.length,12);assert.equal(DEFAULT_ASSETS.find(x=>x.name==='SpaceX'),undefined);assert.equal(DEFAULT_ASSETS.find(x=>x.name==='小马智行').code,'PONY.US');assert.equal(DEFAULT_ASSETS.find(x=>x.name==='阿里巴巴').market,'港股');
 const t=technicals([{date:'2026-10-30',close:100,adjusted_close:50},{date:'2026-11-02',close:51,adjusted_close:51}]);assert.equal(t.change1d,2.0000000000000018);assert.equal(t.sma20,null);assert.equal(t.volatility30d,null);assert.equal(technicals([]),null);
 const s={enabled:true,time:'08:30'};assert.equal(dueToday(new Date('2026-11-04T00:29:00Z'),s,null),false);assert.equal(dueToday(new Date('2026-11-04T00:30:00Z'),s,null),true);assert.equal(dueToday(new Date('2026-11-04T01:00:00Z'),s,'2026-11-04'),false);assert.equal(dueToday(new Date('2026-11-04T01:00:00Z'),{...s,enabled:false},null),false);
});
test('无凭据时保存真实阻塞状态，连接密钥不进入日报或公开状态，重启后历史保留',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'zhigu-daily-')),db=new DatabaseSync(join(dir,'test.sqlite'));const oldKey=process.env.EODHD_API_KEY;delete process.env.EODHD_API_KEY;let engine;
 try{engine=createDailyResearch(db,dir);assert.equal(engine.summary().settings.assets.length,12);
  const s=engine.summary().settings;s.assets=[DEFAULT_ASSETS[0],DEFAULT_ASSETS.find(x=>x.code==='SOXX.US')];db.prepare('UPDATE research_settings SET payload=? WHERE id=1').run(JSON.stringify(s));
  const r=engine.start();while(engine.summary().running)await new Promise(resolve=>setTimeout(resolve,10));const run=engine.getRun(r.id);assert.equal(run.status,'blocked');assert.equal(run.payload.assets.length,2);assert.equal(run.payload.assets[0].quote,null);assert.equal(run.payload.assets[0].analysis,null);assert.match(run.payload.assets[0].errors[0],/未配置/);assert.throws(()=>engine.start(),/一分钟/);
  engine.saveConnections({EODHD_API_KEY:'test-private-placeholder'});assert.equal(engine.connections().globalMarket,true);assert.doesNotMatch(JSON.stringify(engine.summary()),/test-private-placeholder/);assert.equal(statSync(join(dir,'connections.json')).mode&0o777,0o600);engine.saveConnections({EODHD_API_KEY:''});assert.equal(engine.connections().globalMarket,true);assert.throws(()=>engine.saveConnections({ARK_API_KEY:'bad\nkey'}),/连接参数/);
  engine.saveSettings({enabled:false,time:'09:00'});engine.stop();engine=createDailyResearch(db,dir);assert.equal(engine.summary().settings.time,'09:00');assert.equal(engine.getRun(r.id).status,'blocked');assert.equal(engine.connections().globalMarket,true);
 }finally{engine?.stop();db.close();if(oldKey!==undefined)process.env.EODHD_API_KEY=oldKey;rmSync(dir,{recursive:true,force:true});}
});
test('同日观察清单变化只更新新标的，既有报告带来源复用且保留原历史',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'zhigu-reuse-')),db=new DatabaseSync(join(dir,'test.sqlite'));let engine;
 const oldKey=process.env.EODHD_API_KEY;delete process.env.EODHD_API_KEY;
 try{
  engine=createDailyResearch(db,dir);const keep={asset:DEFAULT_ASSETS[0],quote:{price:100},analysis:{category:'继续持有观察',conclusion:'已完成的同日报告'},sources:[{url:'https://example.com/filing'}],errors:[],missing:[]};
  db.prepare('INSERT INTO research_runs(id,started,finished,status,payload) VALUES(?,?,?,?,?)').run('prior',new Date().toISOString(),new Date().toISOString(),'completed',JSON.stringify({assets:[keep,{asset:{code:'SPCX.US'},analysis:{category:null}}]}));
  const s=engine.summary().settings;s.assets=[DEFAULT_ASSETS[0],DEFAULT_ASSETS.find(a=>a.code==='PONY.US')];db.prepare('UPDATE research_settings SET payload=? WHERE id=1').run(JSON.stringify(s));
  const started=engine.start();while(engine.summary().running)await new Promise(r=>setTimeout(r,10));const result=engine.getRun(started.id);
  assert.equal(result.payload.reuseRunId,'prior');assert.equal(result.payload.assets[0].reusedFromRunId,'prior');assert.equal(result.payload.assets[1].asset.code,'PONY.US');assert.equal(engine.getRun('prior').payload.assets.length,2);assert.equal(result.payload.assets.some(a=>a.asset.code==='SPCX.US'),false);
 }finally{engine?.stop();db.close();if(oldKey!==undefined)process.env.EODHD_API_KEY=oldKey;rmSync(dir,{recursive:true,force:true});}
});
