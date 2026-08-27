# Keystatic CMS 部署指南

## 架构说明

```
www.zhangpengchao.com          → GitHub Pages (Hugo 博客)
xxx.pages.dev/keystatic        → Cloudflare Pages (Keystatic 后台)
GitHub OAuth                   → Keystatic 内置处理（不需要额外 Worker）
```

## 步骤一：Cloudflare Pages 部署

### 1. 登录 Cloudflare
1. 打开 https://dash.cloudflare.com
2. 登录你的账号

### 2. 创建 Pages 项目
1. 左侧菜单 → Workers 和 Pages → 创建应用程序 → Pages
2. 点击 "连接到 Git"
3. 选择 GitHub → 授权 Cloudflare 访问
4. 选择仓库：`YiMeng-Zpc/YiMeng-Zpc.github.io`
5. 设置构建配置：
   - **Production 分支**：`main`
   - **构建命令**：`npx opennextjs-cloudflare build`
   - **构建输出目录**：`.open-next`
6. 点击 "保存并部署"

### 3. 设置环境变量
部署完成后，进入 Pages 项目 → 设置 → 环境变量：

| 变量名 | 值 |
|--------|------|
| `KEYSTATIC_GITHUB_CLIENT_ID` | `Ov23liRKe9S4RSOwMTPR` |
| `KEYSTATIC_GITHUB_CLIENT_SECRET` | `73b1dc3e2c3fe11bd18a2212484465e275f246cc` |
| `KEYSTATIC_SECRET` | （随便生成一个随机字符串，用于加密 token） |

> **重要**：这些环境变量需要同时设置到"预览"和"生产"环境！

设置完后需要重新部署一次（在 Pages 项目 → 部署 → 重新部署）。

### 4. 获取你的 Pages 域名
部署完成后，你会得到一个类似这样的地址：
```
https://keystatic-admin.pages.dev
```
或者自定义的子域名。

## 步骤二：更新 GitHub OAuth App

1. 打开 https://github.com/settings/developers
2. 点击你创建的 OAuth App
3. 点击 "Update application"
4. **Authorization callback URL** 改为：
   ```
   https://你的-pages域名.keystatic/admin/api/keystatic/github/oauth/callback
   ```
   例如：`https://keystatic-admin.pages.dev/keystatic/api/keystatic/github/oauth/callback`

> ⚠️ **注意**：URL 必须精确匹配，包括路径！否则 OAuth 登录会失败。

## 步骤三：测试

1. 访问 `https://你的-pages域名/keystatic`
2. 点击 "Sign in with GitHub"
3. 授权后应该能看到 Keystatic 管理界面
4. 可以创建、编辑、删除文章

## 故障排除

### OAuth 登录失败
- 检查 GitHub OAuth App 的 callback URL 是否正确
- 检查环境变量是否设置正确（特别是 KEYSTATIC_SECRET）
- 确保环境变量同时设置了"预览"和"生产"

### 构建失败
- 确保 Cloudflare Pages 的构建命令是 `npx opennextjs-cloudflare build`
- 确保构建输出目录是 `.open-next`

### 文章路径
- Keystatic 创建的文章会保存在 `content/posts/` 目录下
- 格式为 Markdown，带有 frontmatter（YAML 头部信息）
- Keystatic 会自动创建 Pull Request 来合并更改
