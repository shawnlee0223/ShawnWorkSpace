# 私有 Infisical 社区版

采用官方 Docker Compose 结构：Infisical + PostgreSQL + Redis。固定版本见 compose.yaml。社区开源功能无需软件许可订阅；企业功能未启用。

## 部署

遵守仓库 AGENTS.md：验证、提交、推送 GitHub，再执行网站部署脚本同步本目录。然后在 ECS root 账号执行 setup.sh。需要先安装 Docker Engine 和 Compose v2。

- 唯一宿主机端口为 127.0.0.1:8090，不开放公网。
- 从 Mac 建立 SSH 转发 `-L 127.0.0.1:3090:127.0.0.1:8090`，浏览器访问 http://127.0.0.1:3090。
- 用户本人创建首个管理员账号和密码；完成后关闭额外注册。SMTP 暂未配置，邮件邀请和邮件重置密码不可用。
- 根加密密钥、认证密钥、数据库密码由服务器随机生成，只保存在 /etc/zhigu-infisical（目录700、文件600）。再次执行不会重建这些密钥。
- API/VPN 凭据必须迁移到用户创建的项目后才能声称接入完成。部署平台本身不会更改知股现有 connections.json 或 VPN 配置。
- 容器内存上限共约2.3GiB，服务器总内存4GiB属于资源紧张的单机部署。应实测启动和空闲占用；不能保证高可用。每日研究保持暂停。

## 镜像下载受限

.github/workflows/infisical-images.yml 仅下载官方公开镜像并打包，不含凭据。人工触发，下载 artifact 后校验 SHA256SUMS，再传到 ECS，使用 `gzip -dc images.tar.gz | docker load` 导入。registry-digests.jsonl 记录官方仓库摘要用于追溯。artifact 三天后过期。

不通过现有仅允许 Brave/OKX 的 VPN 下载镜像，不使用未知镜像站。部署前人工核对镜像来源和摘要。

## 备份恢复

backup.sh 生成私有 PostgreSQL dump 与根密钥备份，位于 /var/backups/zhigu-infisical。应配置每日备份，并在首次配置后通过专用 SSH 下载到 Mac 私有目录，不能提交到仓库。

恢复需停止 backend，在同版本空数据库通过 pg_restore 导入 database.dump，恢复匹配的 instance.env/database.env，再启动。必须同时备份数据库和 ENCRYPTION_KEY；丢失加密密钥无法恢复业务凭据。同机备份不能防服务器丢失，应额外保留离机副本。

在完成管理员初始化、项目授权、真实凭据迁移和读取验证之前，知股仍使用原有配置。
