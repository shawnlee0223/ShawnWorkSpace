import {test} from 'node:test';
import assert from 'node:assert/strict';
import {validateSecrets} from '../infra/infisical/sync.mjs';
const vpn=()=>({'mixed-port':17890,'bind-address':'127.0.0.1','allow-lan':false,mode:'rule',proxies:[],rules:['DOMAIN,api.search.brave.com,research-route','DOMAIN,www.okx.com,research-route','MATCH,DIRECT']});
const rows=(v=vpn())=>Object.entries({ARK_API_KEY:'sentinel-model',ARK_MODEL_ID:'model',BRAVE_API_KEY:'sentinel-brave',VPN_CONFIG_JSON:JSON.stringify(v)}).map(([secretKey,secretValue])=>({secretKey,secretValue,secretValueHidden:false}));
test('同步只接收完整可读配置，缺失或重复不得覆盖缓存',()=>{
 assert.equal(validateSecrets(rows()).app.BRAVE_API_KEY,'sentinel-brave');
 assert.throws(()=>validateSecrets(rows().filter(x=>x.secretKey!=='BRAVE_API_KEY')));
 assert.throws(()=>validateSecrets([...rows(),rows()[0]]));
 assert.throws(()=>validateSecrets(rows().map(x=>({...x,secretValueHidden:true}))));
});
test('拒绝扩大代理到全局、其他域名、公网监听、TUN或额外监听器',()=>{
 for(const v of [{...vpn(),rules:['MATCH,research-route']},{...vpn(),'bind-address':'0.0.0.0'},{...vpn(),'allow-lan':true},{...vpn(),tun:{enable:true}},{...vpn(),listeners:[{}]},{...vpn(),dns:{listen:'0.0.0.0:53'}},{...vpn(),rules:['DOMAIN,example.com,research-route','DOMAIN,www.okx.com,research-route','MATCH,DIRECT']}])assert.throws(()=>validateSecrets(rows(v)));
});
