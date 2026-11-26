# shawnlee.top 公网上线

备案已于火山控制台核验通过：沪ICP备2026063663号-1。首页等公开页面底部链接到工信部备案查询网站。

发布顺序：验证、提交并推送 GitHub main → 使用 scripts/deploy.sh 同步同一版本 → 获得用户对公开入口的确认 → 云安全组仅开放 TCP 80/443 → 启用 @ 和 www 的既有 A 记录（115.190.159.42）→ 在服务器执行本目录 enable.sh → 验证 HTTPS、跳转及私有 API 登录保护。

Caddy 使用发行版安全更新仓库提供的软件包。安装准备阶段应保持 caddy.service masked，防止默认页面提前开放；enable.sh 安装经过验证的 Caddyfile 后才解除 mask、启用服务。Caddy 自动申请和续期公开证书，HTTP 自动跳转 HTTPS；www 永久跳转主域名。证书及 Caddy 的持久化数据由服务器私下保存，不进入 GitHub。

公开：首页、关于我、简历摘要、项目、思考，以及知股登录入口。私人研究数据和 API 仍要求登录，Cookie 在正式域名启用 Secure。PUBLIC_ORIGIN 固定为 https://shawnlee.top，避免跨站写入；SSH 隧道可继续用于健康检查，知股登录与写操作请使用正式 HTTPS 域名。

Infisical 8090、应用3000、代理17890和Caddy管理2019均不向公网开放。不要为上线开放这些端口，也不要重新启用已暂停的每日研究。

无效证书、DNS错误或健康失败时不得宣称发布完成；保留服务器 Caddyfile 和 public-origin.conf 的旧副本供回滚。不会删除或重建数据库、凭据、缓存或定时设置。
