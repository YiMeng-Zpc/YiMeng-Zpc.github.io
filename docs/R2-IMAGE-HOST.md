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

> **可能的卡点**：第一次进入 R2 时，控制台可能要求先绑定付款方式（Visa/Mastercard
> 等外币卡，通常只做 1 美元预授权后撤销，免费额度内不扣费）。各方资料对「是否必须绑卡」
> 说法不一，以你控制台实际弹窗为准。若这一步走不通，告诉我，我们改走别的图床方案。

### 1. 创建桶

Cloudflare 控制台 → 左侧 **R2** → **Create bucket**

- Bucket name：`blog-photos`（建议用这个，后续脚本默认值一致）
  **桶名是全局唯一的**，若提示已被占用，换成 `yimeng-blog-photos` 之类，
  并同步把 `.env` 里的 `R2_BUCKET` 改成同一个名字
- Location：`Automatic`（会自动选离用户更近的边缘）
- Storage class：选 **标准（Standard）**，不要选「不频繁访问」。原因：
  1. 官方用例里 Standard 明确包含「网站与应用数据」和「图片、视频等媒体内容」，
     IA 面向的是长期归档、灾备、长尾 UGC；
  2. **免费额度只适用于 Standard**（10 GB 存储 / 100 万 A 类 / 1000 万 B 类操作），
     选 IA 一分钱免费额度都不享受；
  3. IA 有 **$0.01/GB 数据检索费**、A/B 类操作单价翻倍，以及 **30 天最短存储期**
     （提前删除或迁移仍按 30 天计费）。本项目全量图约 42.7 MB，
     在免费额度内选 Standard 的实际费用是 0，选 IA 反而产生检索费。
  该选项建桶后仍可在 Dashboard 改，已上传对象也能用 CopyObject 切换，不是不可逆决定。

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

> ⚠️ **入口别走错**：必须从 R2 页面创建。若你看到「从头开始 / 编辑区域 DNS /
> 读写 Cloudflare Stream 和 Images / Workers AI」这一串**策略模板**，说明你进的是
> Cloudflare **通用** API Token 页面（头像菜单或「创建其他令牌」），那里**没有**
> R2 的 `Object Read & Write`，选「编辑 Cloudflare Workers」也不对。
>
> 正确路径：**左侧菜单 → R2（R2 object storage）→ 概览页 Account Details 区块
> → API Tokens 旁边的 Manage → Create Account API token**。
> 只有从这个入口进去，权限下拉里才会出现 `Object Read & Write`。

- Permissions：**Object Read & Write**（不是 Admin，也不需要 Stream/Images 权限）
- Specify bucket(s)：只勾 `blog-photos`（最小权限）
- TTL：可设 1 年 / 不过期
- 「包含所有账户 / Include All accounts」：能工作，但建议选当前这个账户，遵循最小权限

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

### 上传新图（从本地原图目录）

> 注：博客迁 NAS 计划已放弃，NAS 不再作为对外图床或博客托管方案，
> 仅作本机原图来源之一。内网地址不写入公开文档，统一由本机环境变量提供。

先做人工甄别，把选中的文件写成清单（每行一个，支持三种写法）：

```
新疆/新疆伊犁/ZPC05367.jpg   # 相对 NAS_ROOT 指定的原图根目录
ZPC05372.jpg                  # 相对源目录的文件名
/path/to/originals/IMG.jpg    # 绝对路径
```

然后（用 `NAS_ROOT` 指向本机原图目录，清单含相对路径时必填）：

```bash
NAS_ROOT="/path/to/originals" python scripts/upload-to-r2.py --nas --slug xinjiang-ili --files-list tmp/picked.txt
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
4. **仍需人工处理**：黑名单里的 13 个敏感文件（证件照、含序列号纸币等）目前
   仍留在原图目录里，脚本只能保证它们不会被上传，不能替你挪走。
   请将它们移至本机私有加密目录（路径与具体文件名仅存于本机
   `.workbuddy/tmp/sensitive-files.txt`，不写入公开仓库）。

## 排障

| 现象 | 原因 | 处理 |
|---|---|---|
| `NoSuchBucket` | R2_BUCKET 拼错 | 核对控制台里的桶名 |
| `SignatureDoesNotMatch` | Secret Access Key 抄错 | 重新创建 Token（Secret 只显示一次） |
| 403 Forbidden | 桶没开公共访问 | R2 → Settings → Public access |
| `EndpointConnectionError` | 代理干扰 | `env -u http_proxy -u https_proxy ...` |
| `Package size exceeded ... 50 MB` | 误把新图塞回仓库而非 R2 | 只走 `--from-staging`，不要往 `static/images/uploads/` 加主图 |
| 创建桶提示已被占用 | R2 桶名全局唯一 | 换个名字，同步改 `.env` 的 `R2_BUCKET` |
| 首次进 R2 被拦 | 账号未绑定付款方式 | 按控制台提示补绑，或换图床方案 |
| 国内访问 `r2.dev` 偏慢 | 公共子域名在国内链路不稳定 | 在 R2 Custom Domains 绑定 `img.zhangpengchao.com`（主域名已在 Cloudflare），并改 `R2_PUBLIC_BASE` |

## 附录：敏感文件黑名单

清单采取**保守拦截**——宁可多拦，不漏一张（现金序列号、证件照打印件、
清晰私人人像等）。13 条具体路径**只保存在本机的**
`.workbuddy/tmp/sensitive-files.txt`，**不写入公开仓库**。

维护方式：在本机复核后，若确认某张可以公开，把对应行从本机黑名单删掉，
下次选图就会把它当普通照片处理。删之前请确认该行是**精确路径**，别整段清空——
黑名单文件缺失时上传脚本会直接中止（fail-closed）。
