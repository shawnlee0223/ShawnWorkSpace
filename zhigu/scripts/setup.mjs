import { randomBytes, scryptSync } from 'node:crypto';
import { existsSync, writeFileSync } from 'node:fs';
import { createInterface } from 'node:readline';
import { Writable } from 'node:stream';
if(existsSync('.env')){console.error('.env 已存在，请保留原文件并按需更新；未覆盖。');process.exit(1);}
if(!process.stdin.isTTY){console.error('请在交互式终端执行 npm run setup');process.exit(1);}
async function password(prompt){let mute=false;const output=new Writable({write(chunk,encoding,cb){if(!mute)process.stdout.write(chunk,encoding);cb();}});const rl=createInterface({input:process.stdin,output,terminal:true});process.stdout.write(prompt);mute=true;const value=await new Promise(resolve=>rl.question('',resolve));rl.close();process.stdout.write('\n');return value;}
const first=await password('设置网站管理员密码（至少12位，输入隐藏）：');
const second=await password('再次输入密码：');
if(first.length<12||first!==second){console.error('密码不足12位或两次不一致，未写入配置。');process.exit(1);}
const salt=randomBytes(16).toString('hex');
writeFileSync('.env',`ADMIN_PASSWORD_HASH=${salt}:${scryptSync(first,salt,64).toString('hex')}\nARK_API_KEY=\nARK_MODEL_ID=\nTUSHARE_TOKEN=\n# 配好域名后填写 https://your-domain.example\nPUBLIC_ORIGIN=\n`,{mode:0o600,flag:'wx'});
console.log('已创建 .env（权限600）。请在服务器上填写方舟配置；不要提交到 GitHub。');
