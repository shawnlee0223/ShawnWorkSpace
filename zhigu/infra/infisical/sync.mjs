import {readFileSync,writeFileSync,renameSync,statSync,chownSync,unlinkSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
export const APP_KEYS=['ARK_API_KEY','ARK_MODEL_ID','BRAVE_API_KEY','EODHD_API_KEY','COINGECKO_API_KEY'];
export function validateSecrets(rows){
 if(!Array.isArray(rows))throw Error('Invalid secret list');
 const values=Object.create(null);
 for(const row of rows){
  if(!row||typeof row.secretKey!=='string'||typeof row.secretValue!=='string'||row.secretValueHidden===true)throw Error('Unreadable secret');
  if(Object.hasOwn(values,row.secretKey))throw Error('Duplicate secret');
  values[row.secretKey]=row.secretValue;
 }
 const app={};
 for(const key of APP_KEYS){if(values[key]!==undefined){if(values[key].length>4096||/[\r\n\0]/.test(values[key]))throw Error('Invalid application secret');app[key]=values[key];}}
 if(!app.ARK_API_KEY||!app.ARK_MODEL_ID||!app.BRAVE_API_KEY)throw Error('Required application secrets missing; previous cache retained');
 if(!values.VPN_CONFIG_JSON)throw Error('VPN config missing; previous cache retained');
 let vpn;try{vpn=JSON.parse(values.VPN_CONFIG_JSON);}catch{throw Error('Invalid VPN JSON');}
 const rules=vpn.rules;
 if(vpn.dns?.listen||vpn.tunnels?.length||vpn['mixed-port']!==17890||vpn['bind-address']!=='127.0.0.1'||vpn['allow-lan']!==false||vpn.mode!=='rule'||vpn['external-controller']||vpn['external-controller-tls']||vpn['external-controller-unix']||vpn.tun?.enable||vpn.listeners?.length||vpn['proxy-providers']||vpn['rule-providers']||vpn['port']||vpn['socks-port']||vpn['redir-port']||vpn['tproxy-port']||vpn['external-ui-url'])throw Error('VPN config would expand authorized network access');
 if(!Array.isArray(rules)||rules.length!==3||rules[2]!=='MATCH,DIRECT')throw Error('VPN routing must remain restricted');
 const first=rules[0].split(','),second=rules[1].split(',');
 if(first.length!==3||second.length!==3||first[0]!=='DOMAIN'||first[1]!=='api.search.brave.com'||second[0]!=='DOMAIN'||second[1]!=='www.okx.com'||!first[2]||first[2]!==second[2])throw Error('Only Brave and OKX may use the VPN');
 return {app,vpn};
}
function stage(path,value){
 const old=statSync(path),temp=path+'.infisical-'+process.pid;
 writeFileSync(temp,value,{mode:0o600,flag:'wx'});chownSync(temp,old.uid,old.gid);return temp;
}
async function json(base,path,options={}){
 const response=await fetch(new URL(path,base),{...options,redirect:'error',signal:AbortSignal.timeout(15000)});
 if(!response.ok)throw Error('Infisical HTTP '+response.status);
 const raw=await response.text();if(raw.length>1024*1024)throw Error('Infisical response too large');return JSON.parse(raw);
}
export async function sync(){
 const c=JSON.parse(readFileSync('/etc/zhigu-infisical/reader.json','utf8'));
 if(c.baseUrl!=='http://127.0.0.1:8090'||!c.projectId||!c.clientId||!c.clientSecret)throw Error('Invalid local reader configuration');
 const auth=await json(c.baseUrl,'/api/v1/auth/universal-auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({clientId:c.clientId,clientSecret:c.clientSecret})});
 if(typeof auth.accessToken!=='string'||!auth.accessToken)throw Error('Missing access token');
 const params=new URLSearchParams({projectId:c.projectId,environment:'prod',secretPath:'/',viewSecretValue:'true',expandSecretReferences:'false',includeImports:'false'});
 const result=await json(c.baseUrl,'/api/v4/secrets?'+params,{headers:{Authorization:'Bearer '+auth.accessToken}});
 const {app,vpn}=validateSecrets(result.secrets);
 const appPath='/var/lib/zhigu/connections.json',vpnPath='/var/lib/zhigu-proxy/config.json';
 const appText=JSON.stringify(app),vpnText=JSON.stringify(vpn);
 const appChanged=appText!==JSON.stringify(JSON.parse(readFileSync(appPath,'utf8')));
 const vpnChanged=vpnText!==JSON.stringify(JSON.parse(readFileSync(vpnPath,'utf8')));
 const previousVpn=readFileSync(vpnPath,'utf8');
 let appTemp,vpnTemp;
 try{
  if(appChanged)appTemp=stage(appPath,appText);
  if(vpnChanged){
   vpnTemp=stage(vpnPath,vpnText);
   execFileSync('runuser',['-u','zhigu-proxy','--','/usr/local/lib/zhigu-proxy/mihomo','-t','-d','/var/lib/zhigu-proxy','-f',vpnTemp],{stdio:'ignore',timeout:15000});
  }
  if(vpnChanged){renameSync(vpnTemp,vpnPath);vpnTemp=null;try{execFileSync('systemctl',['restart','zhigu-proxy'],{stdio:'ignore',timeout:15000});}catch{const rollback=stage(vpnPath,previousVpn);renameSync(rollback,vpnPath);try{execFileSync('systemctl',['restart','zhigu-proxy'],{stdio:'ignore',timeout:15000});}catch{}throw Error('VPN restart failed; restored old configuration');}}
  if(appChanged){renameSync(appTemp,appPath);appTemp=null;}
  console.log(JSON.stringify({ok:true,applicationUpdated:appChanged,vpnUpdated:vpnChanged}));
 }finally{for(const path of [appTemp,vpnTemp])if(path)try{unlinkSync(path);}catch{}}
}
if(process.argv[1]===fileURLToPath(import.meta.url))sync().catch(()=>{console.error('Infisical sync failed. Existing local configuration retained; inspect service status without logging secret values.');process.exitCode=1;});
