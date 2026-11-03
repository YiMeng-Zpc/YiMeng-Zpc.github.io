# NAS 安全加固方案（GL.iNet GL-BE6500，192.168.8.1）

> 目标：NAS 承担**原图归档备份**职责，图片对外分发继续走 GitHub + jsDelivr CDN。
> NAS **不需要**暴露到公网。本方案的核心是**确保它不会变成公网攻击面**，
> 同时把四类风险（目录遍历 / 写入植入 / 目录列表泄露 / 管理界面暴露）逐条封堵。

---

## 一、当前环境实测结论

对 `192.168.8.1` 的端口探测结果：

| 端口 | 服务 | 风险等级 | 说明 |
|---|---|---|---|
| 22 | SSH | **高** | 若公网可达 = 直接爆破入口 |
| 23 | Telnet | **高** | 明文协议，应彻底关闭 |
| 53 | DNS | 中 | 通常路由器本地 DNS 转发 |
| 80 | nginx | 中 | 管理页 / 可能含 UPnP |
| 139 | NetBIOS | **高** | 局域网发现协议，不应出 WAN |
| 443 | nginx TLS | 中 | 管理页 HTTPS |
| 445 | **Samba** | **高** | NAS 共享，若出 WAN 风险极高 |
| 8080 | LuCI | **高** | 路由器管理界面 |
| 8443 | LuCI TLS | **高** | 路由器管理界面 |
| 9090 | — | 中 | 可能是管理/调试端口 |

固件：**GL.iNet GL-BE6500**（OpenWrt + LuCI）。
另探测到 `80` 端口返回 `Server: nginx/1.26.1` —— 说明路由器上**已在跑 nginx**，
这是做静态文件隔离的好抓手。

---

## 二、核心原则：三层隔离

```
┌─────────────────────────────────────────────┐
│  公网访客                                    │
└──────────────┬──────────────────────────────┘
               │ ❌ 不允许任何直连
               ▼
┌─────────────────────────────────────────────┐
│  第 1 层：WAN 防火墙（最外层，路由器自带）      │
│  · 拒绝所有 WAN → LAN 的 unsolicited 连接     │
│  · 尤其封 139/445/22/23/8080/8443/9090       │
└─────────────────────────────────────────────┘
┌─────────────────────────────────────────────┐
│  第 2 层：服务只监听 LAN（bind 127.0.0.1）     │
│  · LuCI / SSH / Samba 全部绑定 br-lan         │
│  · 即使端口被误转发，也无服务响应              │
└─────────────────────────────────────────────┐
│  第 3 层：数据层只读 + 目录白名单              │
│  · Samba 共享目录只读（readonly = yes）       │
│  · 只暴露 /mnt/archive 下的图片目录            │
│  · 私有数据目录完全不参与共享                  │
└─────────────────────────────────────────────┘
```

**关键原则：靠三层叠加，而不是靠单点。** 任何一层配置失误，其余两层仍能兜住。

---

## 三、落地配置

### 3.1 第 1 层：WAN 侧封端口（最重要）

GL.iNet 固件在 LuCI 提供 **「防火墙设置」→「端口转发」** 和 **「访问控制」**。
原则是 **默认拒绝、按需放行**。

在 LuCI → **系统 → 防火墙 → 常规设置**：

- **入站流量策略**：`丢弃（Drop）`（不要用「接受」）

在 LuCI → **应用 → 端口转发 / 端口管理**：确认**没有任何** WAN 端口转发条目指向
`192.168.8.1` 自身的 22/23/139/445/8080/8443/9090 端口。

> ⚠️ 很多「智能」路由器为了「远程管理」默认开了 8080/8443 的 WAN 放行，
> 这是最常见的暴露点，必须手动关闭。

**SSH 额外加固**（LuCI → 系统 → 管理 → SSH 服务）：

| 项目 | 建议值 | 理由 |
|---|---|---|
| 端口 | 改非默认（如 2222） | 降低暴力破解命中率 |
| 密码登录 | **关闭** | 只用密钥登录 |
| Root 密码登录 | **关闭** | 用普通用户 + sudo |
| 来源 IP 限制 | 只允许 `192.168.8.0/24` | 双保险 |

**Telnet**（如存在）：**直接关闭/卸载**，明文协议无任何安全价值。

### 3.2 第 2 层：服务只绑 LAN

在 LuCI → **系统 → 管理 → 管理接口（Administration Interfaces）**：

- 勾选 **「此管理接口仅绑定到 lan 接口」**（Bind to lan only）
- 对 **HTTP / HTTPS / SSH** 三项**全部**勾选

这一步保证即使有人在 WAN 上做端口转发，LuCI/SSH 也**不会响应**，
因为 socket 根本没绑到 WAN 口。

### 3.3 第 3 层：Samba 只读共享

GL.iNet 的 Samba 通常在 **「网络存储 / 共享文件夹」** 页面配置（部分固件在
**服务 → SMB / Samba**）。

#### 建立专用归档目录

SSH 登录路由器后：

```sh
# 只为博客创建归档目录，与私人数据物理分开
mkdir -p /mnt/archive/blog-originals
mkdir -p /mnt/archive/blog-webp

# 权限：属主可写，其他人只读可遍历
chmod 755 /mnt/archive
chmod 755 /mnt/archive/blog-originals
chmod 755 /mnt/archive/blog-webp
```

#### Samba 配置

编辑 `/etc/samba/smb.conf`（**先备份**）：

```ini
[global]
   # 关键安全项
   server string = GL-BE6500
   # 关闭 NetBIOS 名字服务（避免 137/138/139 泄露）
   disable netbios = yes
   # 只在 LAN 接口提供服务
   interfaces = br-lan
   bind interfaces only = yes
   # 不做 guest 访问
   map to guest = never
   guest ok = no
   # 隐藏 Samba 版本信息
   server min protocol = SMB2_02

# === 只读归档共享 ===
[blog-archive]
   path = /mnt/archive
   browseable = no          # ← 防止目录列表泄露结构
   read only = yes          # ← 只读，杜绝写入/植入
   guest ok = no
   valid users = backup
   # 限制可访问的子路径，杜绝 ../ 遍历
   follow symlinks = no
   wide links = no
   veto files = /.DS_Store/Thumbs.db/
   delete share = no
   create mask = 0600
   directory mask = 0700
```

改完重启：

```sh
/etc/init.d/samba restart
```

#### 验证只读生效

```sh
# 写入应被拒绝
echo x > /mnt/archive/test.txt        # → 应报 Read-only file system
smbclient //192.168.8.1/blog-archive -U backup -c 'put /etc/passwd'   # → 应被拒绝
```

#### 防目录遍历（双重保险）

Samba 的 `veto files` + `wide links = no` 已覆盖大部分场景。
再加一层 **nginx 层的路径规范化**，见 3.4。

### 3.4 nginx 静态层（路由器已在跑 nginx）

如需在路由器本机提供一个**只读的图片静态目录**（例如给内网其他设备用），
用 nginx 严格限定路径。编辑 `/etc/nginx/nginx.conf` 的对应 server 块：

```nginx
server {
    listen 192.168.8.1:8443;   # 只绑 LAN 地址，不绑 0.0.0.0
    server_name _;

    # 站点根目录 = 只读归档目录
    root /mnt/archive/blog-webp;

    # 禁止目录列表
    autoindex off;

    # 只允许 GET / HEAD —— 从协议层杜绝写入
    if ($request_method !~ ^(GET|HEAD)$) {
        return 405;
    }

    # 路径规范化：清掉 ../ 与编码变体，防目录穿越
    if ($uri ~ "(?i)\.\.(/|%2f|%5c|%252e)") {
        return 403;
    }

    # 只放行 webp/png/jpg，屏蔽一切可执行/脚本类型（防 webshell 执行）
    location ~* \.(webp|png|jpe?g|gif|svg)$ {
        add_header X-Content-Type-Options "nosniff" always;
        add_header Content-Disposition "inline" always;
        expires 30d;
        add_header Cache-Control "public, max-age=2592000" always;
        try_files $uri =404;
    }

    # 所有非图片请求一律 404，不暴露任何目录信息
    location / {
        return 404;
    }

    # 关闭服务器版本号泄露
    server_tokens off;
}
```

关键点：
- `listen 192.168.8.1:8443` —— **绑定具体 LAN IP**，不绑 `0.0.0.0`，
  这样公网无法通过端口映射访问
- `location / { return 404; }` —— 非图片路径直接 404，**不暴露目录结构**
- 只放行静态图片扩展名 —— **任何 `.php/.cgi/.sh/.jsp` 都不会被执行**
- `try_files $uri =404` —— 配合 `root` 天然阻断 `../` 穿越

### 3.5 归档同步（NAS ←→ 本机）

**推荐方案：单向 push（NAS 是纯接收端，天然杜绝风险文件写入 NAS）**

在**你的电脑**上执行，而非 NAS 上：

```sh
# 只推送博客相关图片到 NAS 归档目录
rsync -avz --delete \
  --include='*/' \
  --include='*.webp' \
  --include='*.jpg' \
  --include='*.jpeg' \
  --include='*.png' \
  --exclude='*' \
  /path/to/blog/static/images/uploads/posts/ \
  backup@192.168.8.1:/mnt/archive/blog-webp/
```

`--include='*.webp'` 等白名单确保**只有图片类型**能进入 NAS，
其他任何文件（脚本、可执行文件）一律拒绝写入。

> 💡 若路由器不支持 rsync，可改用 SMB 挂载 + `cp`，思路相同：
> **写入方向永远是「电脑 → NAS」，NAS 不主动接收外部请求写入。**

Windows 版本（PowerShell）：

```powershell
robocopy "D:\AI工作空间\YiMeng\YiMeng-Zpc.github.io\static\images\uploads\posts" `
        "\\192.168.8.1\blog-archive\blog-webp" `
        /E /XF *.* /IS /R:2 /W:2
```

---

## 四、风险逐条对照

| 用户担心的风险 | 本方案的封堵措施 | 验证方法 |
|---|---|---|
| **目录遍历读到其他文件** | ① Samba `read only` + 路径白名单<br>② nginx `if ($uri ~ "\.\.") return 403` + `try_files`<br>③ `root` 指向专用目录，与私人数据物理隔离 | `curl http://192.168.8.1:8443/../../../etc/passwd` → 403/404 |
| **被写入/植入风险文件** | ① Samba `read only = yes`<br>② Samba `guest ok = no` + `map to guest = never`<br>③ nginx 仅允许 GET/HEAD<br>④ nginx 只放行图片扩展名，无脚本执行路径<br>⑤ 同步走单向 push + 扩展名白名单 | `echo x > /mnt/archive/x.txt` → Read-only<br>`curl -X PUT ...` → 405 |
| **目录列表泄露结构** | ① Samba `browseable = no`<br>② nginx `autoindex off`<br>③ nginx `location / { return 404; }`<br>④ 专用子目录，不与其他业务混放 | `curl http://192.168.8.1:8443/` → 404（无目录列表） |
| **管理界面暴露公网** | ① WAN 防火墙默认 Drop<br>② 无任何端口转发指向 LuCI/SSH<br>③ 管理接口只绑 lan<br>④ SSH 改端口 + 禁密码 + 限源 IP<br>⑤ 关闭 Telnet | 从外网 `nmap 192.168.8.1`（需在路由器外测试）→ 全部 filtered |

---

## 五、上线后的自查清单

```sh
# 1. 从外网检查路由器（请在手机流量/其他网络下执行）
#    nmap -Pn your-public-ip
#    期望：22/23/139/445/8080/8443/9090 全部 filtered 或 closed

# 2. 内网确认共享只读
smbclient //192.168.8.1/blog-archive -U backup -c 'put /tmp/x'   # 应失败

# 3. 确认目录不列举
curl -s http://192.168.8.1:8443/ | head -c 200    # 应无文件列表

# 4. 确认路径穿越被拦
curl -s -o /dev/null -w '%{http_code}\n' http://192.168.8.1:8443/../../etc/passwd   # 403/404

# 5. 确认写方法被拒
curl -s -o /dev/null -w '%{http_code}\n' -X PUT http://192.168.8.1:8443/test.webp  # 405
```

---

## 六、边界说明（诚实告知）

1. **本方案无法防御已被入侵的主机**。若路由器自身已被拿下，
   以上都是马后炮。建议定期更新 GL.iNet 固件、开启自动更新。
2. **Samba 445 端口在 LAN 内仍可用**，这是设计如此（归档同步需要）。
   LAN 内其他设备理论上可访问共享，但受 `valid users` 账号密码与
   只读权限保护。若 LAN 内有不受信任的设备，请改用 SSH/SFTP 传输并
   关闭 Samba 共享。
3. **图片仍由 CDN 分发**，NAS 不参与公网流量，因此：
   - 不存在家宽上行被图片流量占满的问题
   - NAS 断电/故障不影响网站图片显示
   - NAS 只需要保证「不被入侵」即可，不需要高可用

---

## 七、配套的 CDN 配额提醒

jsDelivr 对 GitHub 仓库有 **50MB 硬门槛**（实测报
`Package size exceeded configured limit of 50 MB`，比公开文档的 150MB 严格）。

当前仓库图片占用：

| 项 | 体积 |
|---|---|
| 主图（99 张 × 2000px） | ~41 MB |
| 缩略图（99 张 × 800px） | ~5 MB |
| 站点其他文件 | ~2 MB |
| **合计** | **~48 MB** ⚠️ 接近上限 |

**因此原图不适合再放进仓库**——这正是「NAS 做原图归档、CDN 只放压缩图」
这条分工的价值：NAS 存 1636 张原图（`E:/图片/` 对应的完整素材），
仓库只保留精选后的 99 张压缩图。

若未来需要扩容，备选方案：
- 改用 Cloudflare R2（无 50MB 限制，按量计费且有免费额度）
- 主图降到 1600px 长边（体积再降约 35%）
- 主图继续留在 GitHub Pages 原生托管（`www.zhangpengchao.com/images/...`），
  完全绕开 jsDelivr 配额
