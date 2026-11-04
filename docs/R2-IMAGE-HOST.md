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

账号不用新注册：Keystatic 后台 `keystatic-admin.yi-meng.workers.dev` 就在这个 Cloudflare 账号下，
直接登录 [dash.cloudflare.com](https://dash.cloudflare.com) 即可。

> **最省事的做法**：如果你不想自己敲命令，只需把下面 5 个值发给我，
> 我会写好 `.env`、执行自检、上传 438 个对象、收尾并提交推送，全程不用你操作终端。

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

在仓库根目录建 `.env`（**已被 .gitignore 忽略，不会进版本库**）。仓库里已备好模板
`.env.example`，复制一份改名再填即可：

```bash
cp .env.example .env
```

Windows 资源管理器里也行：复制 `.env.example` → 粘贴 → 改名为 `.env` → 用记事本打开填 5 个值。

```bash
R2_ACCOUNT_ID=32位十六进制账户ID
R2_ACCESS_KEY_ID=Access Key ID
R2_SECRET_ACCESS_KEY=Secret Access Key
R2_BUCKET=blog-photos
R2_PUBLIC_BASE=https://pub-xxxxxxxx.r2.dev
```

填完先自检，**不用真的连 R2**，会告诉你哪一项没填、格式对不对、待上传产物和黑名单是否齐：

```bash
python scripts/check-r2-config.py           # 本地静态检查
python scripts/check-r2-config.py --live    # 额外探测公开域名是否可达
```

看到 `==== 检查通过，可以上线 ====` 就说明配置没问题。

## 使用

### 推荐：凭据到位前先预压缩（当前状态）

`scripts/stage-r2-photos.py` 已经把选好的图全部预压缩到
`.workbuddy/tmp/staging/`（已被 `.gitignore` 忽略，不进版本库），并生成 `_plan.json`
上传计划与 `photo_meta_r2.json` 元数据草稿。

当前暂存规模：

| 项目 | 数值 |
|---|---|
| 主图 | 146 张 |
| 三档 WebP 文件 | 438 个 |
| 暂存体积 | 42.70 MB |
| 涉及文章 | 6 篇新文章 + 6 篇已有文章补图 |
| 黑名单拦截 | 0 次（选图清单已全部避开敏感文件） |

6 篇新文章（`beijing-still-life-2026`、`taikang-temple-and-museum`、
`beijing-jingshan-clouds-and-city`、`beijing-shougang-bridge-sunset`、
`beijing-shichahai-lotus`、`beijing-waterbirds`）目前是 `draft: true`，
front matter 里的图片地址是占位符 `https://__R2_BASE__`，因此线上不会出现 404。

### 凭据到位后的一键上线

```bash
python scripts/upload-to-r2.py --from-staging          # 上传 438 个对象 + 落地元数据
python scripts/finalize-r2.py --check                 # 干跑，确认会改哪些文件
python scripts/finalize-r2.py                        # 替换占位符 / 追加补图 / 去掉 draft
git add -A && git commit && git push
```

`finalize-r2.py` 是幂等的，重复执行不会重复追加图片。

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
4. **仍需人工处理**：黑名单里的 13 个文件目前还留在 NAS `图片` 目录里，
   脚本只能保证它们不会被上传，不能替你把它们挪走。
   迁移目标建议用 NAS 上已存在的私有区：
   `\\192.168.8.1\YiMeng云盘\加密图片\张鹏超-证件\`
   （该目录已有，同级的 `加密图片` 不在 `图片` 共享范围内）。
   最要紧的两张：`河野华\钞票.jpg`（纸币序列号清晰）、
   `2026年北京摄影器材展\ZPC05945.jpg`（展台证件照打印件）。
   完整 13 条路径在 `D:\AI工作空间\YiMeng\.workbuddy\tmp\sensitive-files.txt`。

## 排障

| 现象 | 原因 | 处理 |
|---|---|---|
| `NoSuchBucket` | R2_BUCKET 拼错 | 核对控制台里的桶名 |
| `SignatureDoesNotMatch` | Secret Access Key 抄错 | 重新创建 Token（Secret 只显示一次） |
| 403 Forbidden | 桶没开公共访问 | R2 → Settings → Public access |
| `EndpointConnectionError` | 代理干扰 | `env -u http_proxy -u https_proxy ...` |
| `Package size exceeded ... 50 MB` | 误把新图塞回仓库而非 R2 | 只走 `--from-staging`，不要往 `static/images/uploads/` 加主图 |

## 附录：待迁移的 13 个敏感文件

清单采取**保守拦截**——宁可多拦，不漏一张。没有标准身份证/护照/银行卡，
但有现金序列号、证件照打印件和清晰私人人像。

| 所在目录（相对 `\\192.168.8.1\YiMeng云盘\图片\`） | 文件 | 处理建议 |
|---|---|---|
| `河野华\` | `钞票.jpg` | **必须迁移**：纸币序列号清晰可读 |
| `2026年北京摄影器材展\` | `ZPC05945.jpg` | **必须迁移**：展台上的证件照打印件 |
| `河野华\` | `河野华1.jpg`、`河野华2.jpg`、`河野华3.jpg` | 清晰私人人像，建议迁移 |
| `日本旅行\人像\` | `微信图片_20250514233327.jpg`、`微信图片_20250514233335.jpg`、`微信图片_20250514233338.jpg` | 清晰私人人像，建议迁移 |
| `2025年9月20日\图片\` | `ZPC03539.JPG` | 需人工复核 |
| `新疆\新疆禾木村、沙漠无人区、喀纳斯\` | `ZPC05015.jpg`、`ZPC05019.jpg` | 需人工复核 |
| `日本旅行\图片\` | `ZPC01596.JPG`、`ZPC01597.JPG` | 需人工复核 |

复核后如果确认某张可以公开，把对应行从 `sensitive-files.txt` 删掉，
下次选图就会把它当普通照片处理。删之前请确认该行是**精确路径**，别整段清空——
黑名单文件缺失时上传脚本会直接中止（fail-closed）。
