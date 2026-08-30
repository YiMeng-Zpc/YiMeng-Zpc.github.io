# ✦ 部署架构总览

```
┌─────────────────────────────────────────┐
│  www.zhangpengchao.com                  │
│  └─ GitHub Pages  (Hugo 静态博客)        │
│     • 内容来自 content/posts/*.md        │
│     • 主题：hugo-theme-reimu + 自定义霓虹  │
│     • Workflow: .github/workflows/hugo.yml│
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│  keystatic-admin.<account>.workers.dev   │
│  └─ Cloudflare Workers (Keystatic 后台)   │
│     • Next.js 15 + Keystatic 0.6 + OpenNext│
│     • Workflow: .github/workflows/       │
│       deploy-keystatic.yml                │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│  GitHub OAuth App                        │
│  callback: https://<worker-domain>/      │
│    api/keystatic/github/oauth/callback    │
└─────────────────────────────────────────┘
```

**两条独立的 CI 流水线，互不冲突：**
- **hugo.yml** —— 当 `content/**`、`layouts/**`、`themes/**`、`hugo.toml` 等博客源码变动时，自动重新构建 Hugo 并部署到 GitHub Pages。
- **deploy-keystatic.yml** —— 当 `app/**`、`keystatic.config.ts` 等后台代码变动时，自动构建 Next.js 并部署到 Cloudflare Workers。

---

## 🚀 一、博客主站（已默认自动部署）

GitHub Pages 走的是 GitHub Actions 自动部署，无需额外操作。
- Settings → Pages → Source 选 **GitHub Actions**
- `hugo.yml` 会自动跑

---

## 🚀 二、Keystatic 后台（Cloudflare Workers）

### 步骤 1：创建 GitHub OAuth App
1. 打开 https://github.com/settings/developers → **New OAuth App**
2. **Homepage URL**: `https://www.zhangpengchao.com`
3. **Authorization callback URL**: `https://keystatic-admin.<你的CF账号>.workers.dev/api/keystatic/github/oauth/callback`
   - 替换 `<你的CF账号>` 为你的 Cloudflare 账号子域
   - 这一步 **先用一个占位符**，部署后用真实域名再回来改
4. 拿到 **Client ID** 和 **Client Secret**

### 步骤 2：在 Cloudflare 添加 Secrets（推荐用 GitHub Actions secrets 注入）
去仓库 Settings → Secrets and variables → Actions，添加：
- `KEYSTATIC_GITHUB_CLIENT_ID`
- `KEYSTATIC_GITHUB_CLIENT_SECRET`  
- `KEYSTATIC_SECRET`（一个随机字符串，比如 `openssl rand -hex 32`）
- `CLOUDFLARE_API_TOKEN`（从 Cloudflare Dashboard → My Profile → API Tokens 创建 Edit Cloudflare Workers 权限）

### 步骤 3：首次部署
push 到 `main` 后 `deploy-keystatic.yml` 会自动跑。也可以手动 trigger。

### 步骤 4：拿到真实 worker 域名
部署成功后 Cloudflare 会给你一个 `keystatic-admin.<account>.workers.dev`。
回到 GitHub OAuth App 把 callback URL 改成这个域名。

### 步骤 5：开始使用
打开 `https://keystatic-admin.<account>.workers.dev/keystatic`，点 "Sign in with GitHub"，授权后就能管理文章和站点设置。

每次你用 Keystatic 创建/编辑文章 → 它会直接 commit 到 `content/posts/*.md` → GitHub Actions 触发 hugo.yml → 博客自动更新。

---

## 🔍 故障排查

### OAuth 登录失败 / 跳到 GitHub 后报错
- 检查 OAuth App 的 callback URL 是否和 Worker 域名精确匹配（包括路径 `/api/keystatic/github/oauth/callback`）
- 检查三个 Secrets 是否都设置了

### 后台页面 404
- 确认 `wrangler.toml` 里的 `name` 没和别人冲突
- 看 Cloudflare Workers Logs

### 文章没出现在博客上
- 文章 frontmatter 里 `draft` 不能为 `true`
- 文章必须在 `content/posts/` 下
- Hugo build log 看是否报错

### 想换 OAuth App
1. https://github.com/settings/developers 更新 callback URL
2. 改 GitHub Secrets 里 `KEYSTATIC_GITHUB_CLIENT_ID/SECRET`