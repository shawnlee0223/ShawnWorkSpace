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

## 每日跨市场研究（新增）
默认首页为每日投资研究，预置用户指定13个标的：阿里9988.HK、小米1810.HK、阳光电源300274.SZ、地平线9660.HK、赤子城9911.HK、小马2026.HK、药明生物2269.HK、巨子2367.HK、LUNR.US、SPCX.US、SOXX.US、ETH.CRYPTO、SOL.CRYPTO。其他公司有多地上市时本清单采用所列市场；这是观察清单，不代表实际持仓。

`daily-research.mjs` 在服务端每分钟检查北京时间每日08:30计划，可在网页暂停或改时间。服务器重启后会将中断任务标记为interrupted，并保留已经完成的采集结果；当日已有任务时不重复自动执行。手动运行至少间隔一分钟。网页关闭和SSH隧道断开不影响服务器调度。未配置任何行情密钥时，定时采集保持等待；手动运行可尝试CoinGecko公开接口。

数据来源：
- 股票/ETF使用 [EODHD日线](https://eodhd.com/financial-apis/api-for-historical-data-and-volumes)、[基本面](https://eodhd.com/financial-apis/stock-etfs-fundamental-data-feeds)与[新闻](https://eodhd.com/financial-apis/stock-market-financial-news-api)。需要账号的所选市场、日线和基本面权限；免费或单项套餐未必覆盖全部，运行结果会分别显示缺失。没有代用户订阅付费数据服务。阳光电源供应商代码为300274.SHE。
- ETH/SOL使用 [CoinGecko](https://docs.coingecko.com/reference/coins-markets) 市场信息和120天历史；可配置Demo Key。公开接口可能限流、超时或需要认证。
- 模型调用火山方舟，按用户配置的模型计费。每次最多逐个调用13个标的，缺行情或基本面会跳过模型；仅配置不代表开通权限或网络已验证。

默认判断分为谨慎持有、继续持有观察、值得分批加仓；关键资料不足时保留待核实。每标的展示结论、理由、指标、加减仓条件、风险、未来一周事项、数据源与时间；附采样窗口价格变化、均线、波动率。价格日期超过7天不生成分类。数字与事实仍需回查原始资料；模型分类不保证正确。

当前覆盖限制：尚未专门采集官方监管政策原文、完整同业对比、实时资金流、ETF每日申赎、链上活动/TVL/质押/代币解锁和精确财报事件日历。缺失项会明确显示；不把价格涨跌当资金流或链上基本面。组合部分只提供风险检查，未取得实际权重、成本与风险能力前不输出个性化仓位百分比。不是完整专业投研终端。

网页连接表单（仅管理员登录可用，同样进行来源校验）保存密钥到服务端DATA_DIR/connections.json，权限600，API只返回是否配置；空白保留原值。该文件与SQLite数据均不得提交GitHub，不包含在数据库备份或JSON日报导出中。环境变量作为基础配置，网页保存值覆盖同名变量。该页面应仅经SSH隧道或HTTPS使用。旧的单次资料研究仍可使用，A股Tushare日线接口保留。

运行档案、快照和报告保存在SQLite research_runs表，支持历史选择与本次JSON导出。每日同机SQLite备份包含运行档案；异地备份需另行配置。服务端实际部署为systemd+Node24时亦支持本模块，不要求Docker。

### 可选：方舟联网研究模式
新增 `online-research.mjs`，每日计划可选 `web` 模式，使用现有lite密钥调用方舟Responses API内置web_search（仅search_engine，最多2轮、每轮2个关键词）。该模式需要单独开通联网内容插件，有独立计费；未替用户开通，默认仍为provider模式。未与独立行情源交叉核验，不能把搜索整理视为准确行情终端。

价格必须有正数、匹配币种、近7天日期以及API返回的实际url_citation来源；只有模型文本中出现的URL不采信。分类至少需要有效价格、两个有API引用来源的事实与两个不同来源URL；不足保留原始资料整理和待核实。网页引用存在不保证源文事实或模型摘录正确，仍需回查原文。原始联网响应正文、引用及使用量会随日报保存。数据源未覆盖的链上/资金流/ETF申赎继续明确标缺失。

### 使用已有 Brave Search API（用户选择）
网页新增BRAVE_API_KEY密码框，保存方式与方舟密钥相同，仅服务端600权限。每日计划选择brave模式：每个标的2次Brave Web Search（count6、extra_snippets=true；新闻freshness=pw），串行并间隔1.1秒，完整13标的最多26次搜索；有搜索结果才调用lite，每标的最多1次。费用与限流按已有Brave套餐执行；未替用户注册或订阅。API文档：https://api-dashboard.search.brave.com/api-reference/web/search/get 。

Brave实际返回的http/https结果链接构成可引用范围，模型自造链接不能成为有效事实或报价来源。检索内容为搜索摘要和额外摘录，不等于已读取全文。行情日期需来自摘录本身，不把采集日当报价日期。资料不足时生成待核实的研究整理。该模式不调用方舟联网插件，不需要其新增订阅，也不要求EODHD密钥。尚需用用户真实Brave Key核对网络、权限、搜索返回及首份日报；密钥已配置不代表连接通过。


### 腾讯财经 / OKX 行情（Brave模式）

股票与ETF以腾讯财经 `https://qt.gtimg.cn/q=` 返回的最新可得快照为准，校验返回代码、正数价格、数据时间；GB18030解码，美股纽约时间按夏令时转换，港股/A股按北京时间。该公开行情入口缺少稳定开发者契约，失败或过期时展示缺失，不从搜索摘要补价格。

ETH/SOL使用OKX公开现货 `GET /api/v5/market/ticker?instId=ETH-USDT`（或SOL-USDT），不需要交易账户或密钥。币种明确为USDT，成交量为币数量、成交额为USDT，涨跌为24小时滚动口径。不能把USDT当美元，交易所成交量不能代表资金净流入或链上活动。

行情与Brave财报/新闻摘录一起交给lite模型；服务端强制保留供应商行情，覆盖模型生成的价格。行情缺失仍可整理资料，暂停投资分类；搜索失败仍保留实际行情。9项自动检查覆盖代码、时区、币种、过期/失败及既有认证和来源校验。实际可用性取决于服务器网络与供应商覆盖。


### 完整历史日K与行情时效
腾讯A股使用fqkline，港股使用hkfqkline，优先qfqday前复权列；若仅返回普通day列，明确标注未复权及除权跳变风险，不把普通day列当复权数据。股票始终排除交易所当日行，防止盘中未完成日K污染技术指标。OKX使用现货market/candles、bar=1Dutc，只采信confirm=1且日周期已结束的行。以252/365分别年化股票/加密资产波动率。美股/ETF历史接口尚未验证，显示缺失。页面同时展示行情时间、采集时间和两者间隔（含休市时段，不把间隔直接认定为供应商延迟）。
东方财富push2快照、push2his日K已做本机只读可达验证，尚未作为正式自动回退或交叉校验源；新浪和中证指数未接入。11项自动检查通过；独立网站服务器仍须部署和验证网络。
