# ShawnWorkSpace

Shawn Lee 的个人网站与「知股」研究工作台，应用源代码位于 [zhigu](zhigu/README.md)。

- 个人网站：关于我、简历摘要、项目占位、思考文章。
- 知股：腾讯股票行情/日K、OKX 加密货币现货与日K、Brave 搜索、火山方舟模型分析、历史研究记录。
- VPN 运维脚本与无凭据配置示例：[代理说明](zhigu/scripts/proxy/README.md)。实际节点和密钥只保存在服务器私有配置。

## 修改与发布

所有修改必须先验证、提交并推送 GitHub main，成功后再部署。规则见 [AGENTS.md](AGENTS.md)。

```sh
cd zhigu
npm test
cd ..
git add <本次修改文件>
git commit -m '<说明>'
git push origin main
SSH_KEY=/仓库外/专用私钥 SSH_KNOWN_HOSTS=/仓库外/known_hosts ./zhigu/scripts/deploy.sh
```

部署脚本拒绝未提交修改或尚未推送的版本，在本机与服务器执行测试，保留旧代码备份，检查健康状态并写入部署提交编号。不会改写数据库、连接凭据或定时设置。当前采用源文件覆盖更新；删除或重命名运行文件时需另行安排清理，失败回滚恢复旧文件但不清除新增文件。

**每日自动研究目前按用户要求暂停。** 网站和历史记录继续可用；手动生成仍会调用付费模型。部署不得重新启用每日任务。

API Key、VPN 订阅、SSH 私钥、数据库、身份材料均不进入本仓库。恢复完整服务还需要服务器上的私有配置及数据库备份，仓库不是这些数据的备份。
