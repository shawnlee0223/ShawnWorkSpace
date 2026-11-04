import { DatabaseSync } from 'node:sqlite';
import { mkdirSync, chmodSync } from 'node:fs';
import { resolve, join } from 'node:path';
const dir=resolve(process.env.DATA_DIR||'data');const backupDir=resolve(process.env.BACKUP_DIR||'backups');mkdirSync(backupDir,{recursive:true,mode:0o700});
const db=new DatabaseSync(join(dir,'zhigu.sqlite'));const destination=join(backupDir,'zhigu-'+new Date().toISOString().replaceAll(':','-')+'.sqlite');db.prepare('VACUUM INTO ?').run(destination);db.close();chmodSync(destination,0o600);console.log('已生成一致性备份：'+destination);
