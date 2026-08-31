# ✦ Zhang Pengchao's blog

> Hugo + Reimu 主题 + 定制霓虹 CSS + FontAwesome 6 + 樱花粒子 + 鼠标光晕  
> 主站部署在 **GitHub Pages**，Keystatic CMS 后台部署在 **Cloudflare Workers**

🌐 **线上博客**：https://www.zhangpengchao.com  
🛠 **管理后台**：https://keystatic.yimeng.pages.dev/keystatic

---

## 🎯 项目结构

```
.
├── content/                       # Hugo 文章内容（Markdown）
│   └── posts/                     # 博客文章
├── layouts/                       # 自定义主题覆盖（覆盖主题 partial）
│   ├── index.html                 # ✦ 首页文章卡片网格
│   └── partials/
│       ├── header.html            # ✦ 头部导航（FontAwesome）
│       └── sidebar/commonBar.html # ✦ 侧边栏（FontAwesome）
├── static/
│   ├── avatar/default.svg         # ✦ 霓虹头像（紫粉青渐变）
│   └── css/cyber.css              # ✦ 动态炫酷自定义样式
├── themes/hugo-theme-reimu/       # Reimu 主题（submodule）
├── app/                           # Next.js + Keystatic 后台
├── keystatic.config.ts            # Keystatic schema
├── wrangler.toml                  # Cloudflare Workers 配置
├── hugo.toml                      # Hugo 主配置
└── .github/workflows/
    ├── hugo.yml                   # ✦ GitHub Pages 自动部署
    └── deploy-keystatic.yml       # ✦ Cloudflare Workers 自动部署
```

---

## ✨ 视觉特性

- 🌌 **霓虹紫粉青主题**（`#ff2bd6` × `#00f0ff` × `#9d4edd`）
- 🖱️ **鼠标跟随光晕**（mix-blend-mode: screen）
- 🌸 **樱花/萤火粒子飘落**（24 个循环生成）
- 🌈 **Hero 标题霓虹渐变 + 故障闪烁动画**
- ⌨️ **副标题打字机光标**
- 💫 **AOS 动效增强**（fade-up / slide-up / slide-down）
- 🎯 **卡片霓虹边框 + hover 抬升 + 发光**
- 🔮 **头像渐变环** + hover 旋转
- 🌀 **导航 hover 时图标 360° 旋转**
- 🌑 **自动暗色模式**（默认开启）
- 📜 **霓虹滚动条**

---

## 🚀 本地开发

```bash
# 安装子模块
git submodule update --init --recursive

# Hugo 博客预览
hugo server -D

# Next.js 后台预览（需 Node 20+）
npm install
npm run dev
```

打开 http://localhost:1313 看博客，http://localhost:3000 看 Keystatic 后台。

---

## 📦 部署

### 博客主站（GitHub Pages）
- 文件改动 → push 到 `main` → `.github/workflows/hugo.yml` 自动跑
- Settings → Pages → Source 选 **GitHub Actions**

### Keystatic 后台（Cloudflare Workers）
- 文件改动 → push 到 `main` → `.github/workflows/deploy-keystatic.yml` 自动跑
- 详细步骤见 [DEPLOY-KEYSTATIC.md](./DEPLOY-KEYSTATIC.md)

### 必需的 GitHub Secrets
| Secret 名 | 用途 |
|-----------|------|
| `KEYSTATIC_GITHUB_CLIENT_ID` | GitHub OAuth App Client ID |
| `KEYSTATIC_GITHUB_CLIENT_SECRET` | GitHub OAuth App Client Secret |
| `KEYSTATIC_SECRET` | 随机字符串（加密 token 用） |
| `CLOUDFLARE_API_TOKEN` | Cloudflare Workers 部署 token |

---

## 🔧 故障排查

### Hugo 构建警告 `WARN found no layout file for "html" for kind "section"`
无害，意思是 `content/posts/_index.md` 没有自定义 list 模板（主题默认就行）。

### 图标显示为方框/乱码
确认浏览器能访问 `cdn.jsdelivr.net`。如果在国内，可以在 `layouts/partials/header.html` 替换为 unpkg 或自有 CDN。

### 后台登录失败
检查 GitHub OAuth App 的 callback URL 必须精确匹配 `https://<worker-domain>/api/keystatic/github/oauth/callback`。

### 文章数显示 0
确认 `hugo.toml` 里 `params.mainSections = ['posts']` 存在，并且文章的 `draft: false`。