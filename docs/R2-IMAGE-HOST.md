# R2 自建图床配置指南

## 为什么要换图床

jsDelivr 对**单个仓库**有 50MB 硬上限（实测报 `Package size exceeded configured limit of 50 MB`），
一旦超限整个版本被拒，**站内所有图床链接一起失效**。

当前状态：

| 项目 | 数值 |
|---|---|
| 仓库追踪文件总量 | 39.65 MB |
| jsDelivr 上限 | 50 MB |
| 剩余余量 | 10.35 MB（≈ 25 张图） |
| NAS 可用照片 | 1055 张 |
| 全量发布所需 | ≈ 410 MB |

结论：靠 jsDelivr 无法承载 NAS 全量照片，必须换图床。

## 选型：Cloudflare R2

- 免费版 **10GB 存储 / 免流量费 / 免请求计费上限**
- 走 Cloudflare 边缘网络，和主站 `www.zhangpengchao.com` 同一 CDN
- 账号已有（`yi-meng`，`keystatic-admin.yi-meng.workers.dev` 在用），无需新注册

## 配置步骤（约 5 分钟）

### 1. 创建桶

Cloudflare 控制台 → 左侧 **R2** → **Create bucket**

- Bucket name：`blog-photos`（建议用这个，后续脚本默认值一致）
- Location：`Automatic`（会自动选离用户更近的边缘）
- Storage class：默认 **Standard**

### 2. 开启公开访问

R2 → `blog-photos` → **Settings** → **Public access** → 开启 **r2.dev** 子域名

开启后页面顶部会显示形如：

```
https://pub-xxxxxxxxxxxxxxxx.r2.dev
```

**把这个地址记下来**，它是图片的公开访问前缀。

> 若想用 `img.zhangpengchao.com` 这样的自定义域名，需在 R2 的 Custom Domains 里添加，
> 并在 Cloudflare DNS 加一条 CNAME 指向 `pub-xxx.r2.dev`。
> 自定义域名需要该域名已托管在 Cloudflare——本项目的主域名已满足。

### 3. 创建 API Token

R2 右上角 → **Manage R2 API Tokens** → **Create Account API token**（或 Create User API token）

- Permissions：**Object Read & Write**
- Specify bucket(s)：只勾 `blog-photos`（最小权限）
- TTL：可设 1 年 / 不过期

创建后立刻显示三个值（**Secret 只显示一次，务必当场保存**）：

```
Access Key ID:     xxxxxxxxxxxxxxxx
Secret Access Key: xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

### 4. 账户 ID

Cloudflare 控制台右侧边栏 → **Account ID**（一串 32 位十六进制字符）。
或访问 `https://dash.cloudflare.com/<AccountID>/r2/overview`。

## 填入项目

在仓库根目录建 `.env`（**已被 .gitignore 忽略，不会进版本库**）：

```bash
R2_ACCOUNT_ID=你的账户ID
R2_ACCESS_KEY_ID=上面的Access Key ID
R2_SECRET_ACCESS_KEY=上面的Secret Access Key
R2_BUCKET=blog-photos
R2_PUBLIC_BASE=https://pub-xxxxxxxx.r2.dev
```

## 使用

### 上传新图（从 NAS）

先做人工甄别，把选中的文件写成清单（每行一个，支持三种写法）：

```
新疆/新疆伊犁/ZPC05367.jpg      # 相对 NAS 图片根目录
ZPC05372.jpg                     # 相对源目录的文件名
//192.168.8.1/YiMeng云盘/图片/…  # 绝对 / UNC 路径
```

然后：

```bash
python scripts/upload-to-r2.py --nas --slug xinjiang-ili --files-list tmp/picked.txt
```

脚本会：读证件照黑名单（命中即跳过）→ 生成 2000px / 800px / 240px 三档 WebP
→ 上传到 `posts/<slug>/NN.webp` → 写入 `data/photo_meta_r2.json`。

### 迁移仓库里的存量图

```bash
python scripts/upload-to-r2.py --migrate
```

把现有 99 张原样上传到 R2，之后可把仓库里的图片删掉，让主仓库瘦回几 MB。

## 安全约束（脚本已内置）

1. **fail-closed**：证件照黑名单文件不存在时直接中止，不会「警告一句就继续传」。
   黑名单路径：`../.workbuddy/tmp/sensitive-files.txt`，也可用 `NAS_BLACKLIST` 环境变量覆盖。
2. 只读取 NAS 与仓库，不修改、不删除 NAS 上任何文件。
3. 凭据只从环境变量 / `.env` 读取，不写入任何被追踪的文件。

## 排障

| 现象 | 原因 | 处理 |
|---|---|---|
| `NoSuchBucket` | R2_BUCKET 拼错 | 核对控制台里的桶名 |
| `SignatureDoesNotMatch` | Secret Access Key 抄错 | 重新创建 Token（Secret 只显示一次） |
| 403 Forbidden | 桶没开公共访问 | R2 → Settings → Public access |
| `EndpointConnectionError` | 代理干扰 | `env -u http_proxy -u https_proxy ...` |
