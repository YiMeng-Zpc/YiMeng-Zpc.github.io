import { config, collection, fields, singletons } from "@keystatic/core";

export default config({
  storage: {
    kind: "github",
    repo: "YiMeng-Zpc/YiMeng-Zpc.github.io",
    branch: "main",
  },
  basePath: "/keystatic",
  ui: {
    brand: {
      name: "忆梦博客管理 ✦",
      mark: {
        // Keystatic 6+ allows customizing the brand mark. Fall back gracefully.
      },
    },
    navigation: {
      // Group collections in a nicer sidebar
    },
  },
  collections: {
    // ========== 博客文章 ==========
    posts: collection({
      label: "📝 文章管理",
      slugField: "title",
      path: "content/posts/*",
      format: { contentField: "content" },
      entryLayout: "content",
      schema: {
        title: fields.slug({
          name: { label: "文章标题", description: "会自动生成 URL 友好的文件名" },
        }),
        date: fields.date({
          label: "📅 发布日期",
          defaultValue: { kind: "today" },
        }),
        description: fields.text({
          label: "📌 文章摘要",
          multiline: true,
          description: "显示在文章列表中的简短描述",
        }),
        tags: fields.array(
          fields.text({ label: "标签" }),
          {
            label: "🏷️ 标签",
            itemLabel: (props) => String(props.value) ?? "标签",
          }
        ),
        categories: fields.select({
          label: "📁 分类",
          options: [
            { label: "技术", value: "技术" },
            { label: "生活", value: "生活" },
            { label: "学习笔记", value: "学习笔记" },
            { label: "随笔", value: "随笔" },
            { label: "教程", value: "教程" },
          ],
          defaultValue: "技术",
        }),
        cover: fields.image({
          label: "🖼️ 封面图片",
          description: "文章列表中显示的封面图，建议尺寸 1200x630",
          publicPath: "content/posts/",
        }),
        draft: fields.checkbox({
          label: "📝 草稿",
          defaultValue: false,
          description: "勾选 = 不发布，取消勾选 = 发布",
        }),
        content: fields.markdoc({
          label: "✏️ 文章正文",
          description:
            "支持富文本编辑！使用工具栏可插入标题、粗体、斜体、链接、图片、代码块、引用、列表、分隔线等。也可直接写 Markdown 语法。",
        }),
      },
    }),

    // ========== 博客配置（单例页面） ==========
    siteConfig: singletons({
      label: "⚙️ 站点设置",
      path: "data/site",
      format: { dataFile: "site" },
      schema: {
        // --- 基本信息 ---
        siteTitle: fields.text({
          label: "🌐 站点标题",
          description: "显示在浏览器标签和页面顶部",
          defaultValue: "忆梦的博客",
        }),
        siteTitleEn: fields.text({
          label: "🌐 英文标题",
          description: "英文版博客标题",
          defaultValue: "YiMeng's Blog",
        }),
        author: fields.text({
          label: "👤 作者名称",
          defaultValue: "忆梦",
        }),
        description: fields.text({
          label: "📝 站点描述",
          multiline: true,
          description: "显示在侧边栏和 SEO 搜索结果中",
          defaultValue: "一个热爱技术的开发者，记录学习与成长的点滴。",
        }),

        // --- 头像 ---
        avatar: fields.image({
          label: "🖼️ 侧边栏头像",
          description: "圆形头像，建议 400x400，正方形",
          publicPath: "static/avatar",
        }),

        // --- 封面/背景 ---
        coverImage: fields.image({
          label: "🏔️ 首页封面图",
          description: "博客首页顶部的大背景图",
          publicPath: "static/images",
        }),
        coverOpacity: fields.text({
          label: "🔆 封面透明度",
          description: "0.0（全透明）到 1.0（不透明），推荐 0.6",
          defaultValue: "0.6",
        }),

        // --- 颜色主题 ---
        primaryColor: fields.text({
          label: "🎨 主色调",
          description: "主要强调色（用于链接、按钮等）",
          defaultValue: "#ff2bd6",
        }),
        secondaryColor: fields.text({
          label: "🎨 副色调",
          defaultValue: "#00f0ff",
        }),
        bgColor: fields.text({
          label: "🎨 背景色",
          defaultValue: "#0b0418",
        }),

        // --- 页脚 ---
        footerAuthor: fields.text({
          label: "📜 页脚作者",
          defaultValue: "忆梦",
        }),
        footerCustom: fields.text({
          label: "📜 页脚自定义文字",
          defaultValue: "Powered by Hugo & Reimu Theme ✦ Built with ♥ by YiMeng",
        }),
        copyrightYear: fields.text({
          label: "📅 版权起始年份",
          defaultValue: "2026",
        }),

        // --- 侧边栏简介 ---
        sidebarBio: fields.text({
          label: "📋 侧边栏个人简介",
          multiline: true,
          description: "显示在头像下方",
          defaultValue: "一个热爱技术的开发者，记录学习与成长的点滴。",
        }),

        // --- 社交链接 ---
        githubUrl: fields.url({
          label: "🐙 GitHub 地址",
          defaultValue: "https://github.com/YiMeng-Zpc",
        }),
        emailUrl: fields.url({
          label: "📧 邮箱地址",
          defaultValue: "mailto:Yi.Meng-@outlook.com",
        }),
        bilibiliUrl: fields.url({
          label: "📺 B站地址",
          description: "留空则不显示",
        }),
        twitterUrl: fields.url({
          label: "🐦 Twitter/X 地址",
          description: "留空则不显示",
        }),

        // --- 搜索 ---
        searchEnabled: fields.checkbox({
          label: "🔍 启用搜索",
          defaultValue: true,
        }),
      },
    }),
  },
});