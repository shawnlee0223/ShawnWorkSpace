# Brave / OKX 私有代理

这些脚本记录已部署的 VPN 接入方式，正常网站代码更新无需再次执行。真实订阅、节点、密码仅保存于服务器私有配置，不进入仓库。

- Mihomo 作为独立非登录用户 zhigu-proxy 运行，只监听 127.0.0.1:17890。
- config.example.json 是不含节点的结构示例，默认拒绝研究流量，防止误以为配置后即可联网。
- 由维护者在服务器私下填入获授权的节点，并将 RESEARCH 组的 REJECT 替换为实际节点名称；仅 api.search.brave.com、www.okx.com 走代理，其余 DIRECT。不得扩大到系统全局代理。
- 从 MetaCubeX/mihomo 官方 GitHub Releases 获取适合架构的二进制，核对官方校验和，再准备为 /tmp/mihomo-zhigu。
- 私有配置暂存 /root/zhigu-proxy-staging.json（600），以 root 执行 install-proxy.sh。脚本验证配置、创建并启动 systemd 服务，然后删除暂存文件。
- enable-app-proxy.sh 为 zhigu.service 添加 Node 环境代理设置并重启；需支持 NODE_USE_ENV_PROXY 的 Node 版本。具体域名路由仍受 Mihomo 规则限制。
- disable-app-proxy.sh 移除应用代理设置并停止代理，Brave/OKX 在当前网络下可能再次不可达。

服务器最终配置：/var/lib/zhigu-proxy/config.json，属 zhigu-proxy，权限 600。订阅当前为静态快照；套餐或节点过期时需私下更新，不会自动续费或刷新订阅。
