# Keystatic CMS 部署指南 - 忆梦博客

## 架构概览

```
┌─────────────────────────────────────────────────┐
│                  你写文章                         │
│          (Keystatic Web 管理后台)                 │
│         https://你的域名/keystatic               │
└──────────────────────┬──────────────────────────┘
                       │ GitHub API
                       ▼
┌─────────────────────────────────────────────────┐
│            GitHub 仓库 (自动提交)                │
│    YiMeng-Zpc/YiMeng-Zpc.github.io             │
└──────────────────────┬──────────────────────────┘
                       │ Push 触发
                       ▼
┌─────────────────────────────────────────────────┐
│         GitHub Actions → 构建 Hugo              │
│         部署到 GitHub Pages                     │
│         https://www.zhangpengchao.com           │
└─────────────────────────────────────────────────┘
```

## 第一步：推送代码到 GitHub

在你的电脑上用 GitHub Desktop 打开仓库：
`D:\YiMeng-Zpc.github.io`

提交所有新文件，然后推送到 main 分支。

新添加的文件：
- package.json
- tsconfig.json
- keystatic.config.ts
- keystatic/page.tsx
- keystatic/config.tsx
- worker/ (OAuth 代理)
- DEPLOY-KEYSTATIC.md (本文件)

## 第二步：创建 GitHub OAuth App

1. 打开 https://github.com/settings/developers
2. 点击 **OAuth Apps** → **New OAuth App**
3. 填写信息：
   - **Application name**: `忆梦博客 Keystatic`
   - **Homepage URL**: `https://www.zhangpengchao.com`
   - **Authorization callback URL**: `https://keystatic-oauth-proxy.YOUR_SUBDOMAIN.workers.dev/api/auth/callback`
     (等部署完 Cloudflare Worker 后再填写正确的 URL)
4. 点击 **Register application**
5. 复制 **Client ID**
6. 点击 **Generate a new client secret**，复制 **Client Secret**
7. ⚠️ 保管好这两个值，后面要用！

## 第三步：创建 Cloudflare 账号（如果没有）

1. 打开 https://dash.cloudflare.com/sign-up
2. 注册免费账号
3. 完成验证

## 第四步：部署 OAuth Proxy Worker

这是用来处理 GitHub 登录认证的 Cloudflare Worker（免费）。

### 4.1 安装 Wrangler CLI

在电脑上打开 PowerShell：
```powershell
npm install -g wrangler
```

### 4.2 登录 Cloudflare
```powershell
wrangler login
```
（会打开浏览器，用 Cloudflare 账号登录）

### 4.3 部署 Worker
```powershell
cd D:\YiMeng-Zpc.github.io\worker
npm install
```

设置密钥（会提示输入，填入你的 GitHub Client Secret）：
```powershell
npx wrangler secret put GITHUB_CLIENT_SECRET
```

修改 `wrangler.toml`，填入你的 Client ID：
```toml
[vars]
GITHUB_CLIENT_ID = "你复制的Client_ID"
```

部署：
```powershell
npm run deploy
```

部署成功后，你会看到一个 URL，类似：
`https://keystatic-oauth-proxy.XXXX.workers.dev`

⚠️ **记下这个 URL！**

### 4.4 回去更新 GitHub OAuth App

回到 https://github.com/settings/developers → OAuth Apps → 你的应用

更新 **Authorization callback URL** 为：
```
https://keystatic-oauth-proxy.XXXX.workers.dev/api/auth/callback
```

## 第五步：创建 Cloudflare Pages 项目

### 5.1 创建项目

1. 打开 https://dash.cloudflare.com
2. 左侧菜单 → **Workers & Pages** → **Create**
3. 选择 **Pages** → **Connect to Git**
4. 选择 GitHub → 授权 → 选择 `YiMeng-Zpc.github.io` 仓库
5. 配置构建设置：
   - **Production branch**: `main`
   - **Build command**: `npm install && npm run build`
   - **Build output directory**: `public`
   - **Node.js version**: `18`
6. 点击 **Save and Deploy**

### 5.2 设置环境变量

在 Cloudflare Pages 项目 → **Settings** → **Environment variables**

添加以下变量（Production 和 Preview 都设置）：

| 变量名 | 值 |
|--------|-----|
| `GITHUB_TOKEN` | 你的 GitHub Personal Access Token (见下方说明) |
| `GITHUB_REPO_OWNER` | `YiMeng-Zpc` |
| `GITHUB_REPO_SLUG` | `YiMeng-Zpc.github.io` |
| `GITHUB_CLIENT_ID` | 你的 GitHub OAuth App Client ID |
| `GITHUB_CLIENT_SECRET` | 你的 GitHub OAuth App Client Secret |
| `OAUTH_PROXY_URL` | `https://keystatic-oauth-proxy.XXXX.workers.dev` |

### 5.3 创建 GitHub Personal Access Token

1. 打开 https://github.com/settings/tokens
2. 点击 **Generate new token (classic)**
3. 勾选权限：
   - `repo` (完整仓库访问)
   - `workflow` (GitHub Actions)
4. 设置过期时间（建议 90 天）
5. 生成并复制 token

## 第六步：访问 Keystatic 管理后台

部署完成后，访问：
```
https://你的Pages项目名.pages.dev/keystatic
```

或者如果你配置了自定义域名，可以访问：
```
https://www.zhangpengchao.com/keystatic
```

点击 **GitHub 登录**，授权后即可进入管理后台！

## 常用操作

### 写新文章
1. 进入 Keystatic 后台
2. 点击左侧 **📝 文章管理**
3. 点击 **Create Post**
4. 填写标题、摘要、选择分类和标签
5. 在正文区域写 Markdown 内容
6. 选择 **发布** 或 **草稿**
7. 点击 **Create** 保存

### 编辑文章
1. 在文章列表中点击要编辑的文章
2. 修改内容
3. 点击 **Update** 保存

### 上传图片
1. 在文章编辑页面
2. 点击封面图区域上传图片
3. 图片会自动保存到 `static/images/uploads/` 目录

## 本地开发（可选）

如果你想在本地测试：

```powershell
cd D:\YiMeng-Zpc.github.io
npm install
npm run dev:all
```

- Hugo 预览：http://localhost:1313
- Keystatic 后台：http://localhost:3000/keystatic

## 故障排除

### 登录后空白页
- 检查环境变量是否正确设置
- 确认 OAuth Proxy URL 末尾没有多余的 `/`

### 文章没有显示
- 检查 `draft` 是否设置为 "否 - 发布"
- 确认 GitHub Actions 构建成功

### 图片上传失败
- 检查 GitHub Token 权限是否包含 `repo`
- 确认 `static/images/uploads/` 目录存在

## 技术细节

- **Keystatic**: 开源 CMS，直接通过 GitHub API 读写文件
- **@keystatic/hugo**: 专门的 Hugo 适配器，自动映射 frontmatter 字段
- **Cloudflare Worker**: 免费的 OAuth 代理，处理 GitHub 登录
- **Cloudflare Pages**: 免费的静态网站托管（但我们的主站还是用 GitHub Pages）
