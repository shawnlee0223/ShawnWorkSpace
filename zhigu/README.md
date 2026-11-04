# 知股 · 个人研究室

面向个人的 A 股研究网站。火山引擎 ECS 运行网站，火山方舟提供模型 API，GitHub 保存代码。

现有功能：自选股、基于粘贴资料的 AI 研究、研究日志、Tushare 日线、JSON 导出/合并导入、管理员登录和 SQLite 持久化。没有券商交易接口。模型不会自动读取来源网址或抓取最新信息，网站不会生成模拟行情。

## 本机预览

Node.js 22.13 或以上（建议 24 LTS），无第三方运行依赖。

```sh
npm run dev
```

打开 `http://127.0.0.1:3088`。预览模式只绑定本机回环地址，不启用登录，保存的数据位于 `data/zhigu.sqlite`。不要把这个开发命令用于云端公开访问。

## 正式部署：火山引擎 ECS

第一阶段使用普通 CPU 服务器，模型运行在火山方舟。服务器本身不部署模型权重。Docker Compose 为可迁移的部署方式，单个应用实例使用一个 SQLite 数据卷。

1. 在火山引擎创建/选择 ECS（Linux），准备 SSH 登录及 Docker Compose。
2. 拉取本仓库；运行 `npm run setup`，在交互终端设置网站管理员密码。脚本以权限 `600` 创建 `.env`，只保存带随机盐的 scrypt 散列，不保存明文密码。
3. 在服务器编辑 `.env`：

   - `ARK_API_KEY`：火山方舟通用 API Key。
   - `ARK_MODEL_ID`：账号已开通的文本模型 Model ID 或推理 Endpoint ID，以控制台实际值为准。
   - `TUSHARE_TOKEN`：可选。需要账号具备历史日线权限。
   - `PUBLIC_ORIGIN`：先通过 SSH 隧道使用时可以留空；公开时填写 `https://实际域名`，不要带结尾斜线。

4. 启动：

```sh
docker compose up -d --build app
```

应用端口只映射在服务器 `127.0.0.1:3000`，避免未配置 HTTPS 就公开传输密码。通过 SSH 隧道先验收：

```sh
ssh -L 3088:127.0.0.1:3000 your-user@your-server
```

打开本机 `http://127.0.0.1:3088` 并输入设置的网站管理员密码。

5. 有域名后，在 `.env` 添加 `SITE_DOMAIN=实际域名`，将 `PUBLIC_ORIGIN` 改为匹配的 HTTPS 地址。DNS 指向服务器，按实际网络要求开放 80/443，使用 Caddy 自动签发 HTTPS：

```sh
docker compose --profile public up -d --build
```

中国大陆服务器的域名公开访问，需根据火山引擎控制台提示处理网站备案。服务器购买、域名及模型服务开通均由账户所有者完成。仓库不包含这些服务的费用承诺。

如服务器暂时没有 Node.js，可通过 Docker 初始化密码配置：

```sh
docker run --rm -it -v "$PWD:/app" -w /app node:24-bookworm-slim node scripts/setup.mjs
```

## 模型和行情

- [方舟 Base URL 与鉴权](https://docs.volcengine.com/docs/ark/base-url-and-authentication?lang=zh)：后端调用 `https://ark.cn-beijing.volces.com/api/v3/chat/completions`，使用 Bearer API Key。
- 使用通用模型 API。本项目未接入 Coding Plan 的专用地址和密钥。
- [Tushare HTTP 数据调用](https://tushare.pro/document/1?doc_id=40)、[历史日线](https://tushare.pro/document/2?doc_id=27)：按股票拉取最近150个自然日的未复权日线，以返回交易日为准，不代表实时价格。
- 未配置密钥时，相应接口明确返回未连接状态，其他功能正常运行。
- 用户点击生成后，粘贴资料会发给火山方舟。报告要求区分事实、推断和待核实内容，保存时附资料网址、日期和模型标识；来源网址本身不会被读取。用户应核验报告。

## 维护与备份

```sh
npm test
# 更新应用，保持已有数据卷
git pull --ff-only
docker compose up -d --build app
# 生成 SQLite 一致性备份
docker compose exec app node scripts/backup.mjs
# 查看日志
docker compose logs --tail=100 app
```

备份位于独立 `zhigu-backups` 数据卷，需另行复制到服务器外。网页 JSON 导出包括自选股和研究日志；不包含模型密钥、管理员密码或登录会话。

数据卷 `zhigu-data` 包含 SQLite 文件和会话。不要运行 `docker compose down -v`，它会删除数据卷。迁移时使用一致性备份，恢复后重新登录；不要直接复制写入中的 SQLite 单文件。

`.gitignore` 排除 `.env`、数据库和备份。密钥只在服务器环境变量中；浏览器无法读取。登录使用 HttpOnly / SameSite Cookie（HTTPS 配置下添加 Secure），失败尝试限制、来源校验和记录版本检测。单管理员设计，不提供公众注册；如扩展多用户，需要新增用户隔离与权限体系。

## 当前验证范围

已验证：登录/退出、未授权访问阻止、跨来源写请求拒绝、数据校验、保存冲突、进程重启持久化、SQLite 一致性备份恢复、密钥未配置时的明确错误、静态文件访问边界。

方舟与 Tushare 真实调用需要账号密钥才能验证；Docker 镜像需要在有 Docker 的环境构建验收。上线后应再次验证真实模型生成、行情权限、HTTPS 与数据库备份恢复。
